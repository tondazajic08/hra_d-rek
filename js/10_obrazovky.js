// Obrazovky – úvod, hra, závěr, tlačítka
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// OBRAZOVKY – úvod, hra, závěr
// =====================================================================

// Poslední známý stav úkolů – podle změn se pouští zvuky a ukládá postup,
// takže logika úkolů o zvuku ani ukládání nemusí vědět
const progressWatch = { sig: '' };
const questSignature = () => QUESTS.map((q) => questStage(q)).join(',');

// Uvede hru do výchozího stavu (nebo do uloženého postupu) bez obnovení stránky
function resetGame(progress) {
  state.quests = progress ? { ...progress.quests } : {};
  state.tracked = progress ? progress.tracked : null;
  state.catalog = null;
  state.money = progress ? progress.money : 0;
  state.bag = progress ? progress.bag : [];
  state.shopSel = 0;
  state.dialog = null;
  state.toast = null;
  state.effects = [];
  state.transition = null;
  endPrank();   // gumy: nová / načtená hra začíná s nafouknutými gumami a bez nože
  state.story = { ...newStory(), ...(progress && progress.story ? progress.story : {}), lastRoom: null };
  applyStory();   // Lili u Kluse nebo u Bečváře podle postupu (17_pribehy.js)
  applyPivo();    // Soumar u kabinetu nebo odlákaný Kubou (21_pivo.js)
  applyStruny();  // kleště se po načtení vrací školníkovi (22_struny.js)
  applyDamien();  // Damien a Michaelle doma, nebo už v holčičí šatně (24_damien.js)
  applyVrah(progress);   // režim Vrah: postavy na místa z příběhu, jinak domů (18_vrah.js)
  input.events.length = 0;
  if (state.mode === 'vrah') vrahStart(); else enterStartRoom();   // venku / ve skříňkách (33_skiny.js)
  progressWatch.sig = questSignature();
  progressWatch.bagSig = `${state.money}|${state.bag.join(',')}`;
  progressWatch.nextSave = state.time;
}

// při zavření / přepnutí stránky (hlavně mobil) uložit, ať se nic neztratí
const saveOnLeave = () => { if (state.screen === 'playing' || (state.speedrun && !state.speedrun.done && ['basket', 'chess', 'foosball', 'pingpong'].includes(state.screen))) saveProgress(); };
window.addEventListener('pagehide', saveOnLeave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnLeave(); });

function setScreen(screen) {
  state.screen = screen;
  document.body.classList.toggle('menu', screen !== 'playing' && screen !== 'horor');   // joystick i v hororu (39_horor.js)
}

// mode: null = hlavní hra, 'vrah' = Vrah z učebny C109
function startPlaying(progress, mode = null, speedrun = false) {
  state.mode = mode;
  resetGame(progress);
  // časovač: nová hra podle výběru režimu, načtená hra pokračuje s uloženým časem (28_speedrun.js)
  state.speedrun = progress ? progress.speedrun : (speedrun ? { t: 0 } : null);
  state.modePick = null;
  if (!progress) storageRemove(saveKey());
  setScreen('playing');
}

// Zpátky na úvodní obrazovku: znovu načíst, co je kde rozehrané
function goToTitle() {
  state.mode = null;
  state.speedrun = null;
  state.savedGame = loadProgress();
  state.savedVrah = loadProgress(CONFIG.SAVE_KEY_VRAH);
  setScreen('title');
}

function startEnd() {
  finishSpeedrun();   // zastaví čas a porovná s rekordem (28_speedrun.js)
  storageRemove(saveKey());
  if (state.mode === 'vrah') state.savedVrah = null; else state.savedGame = null;
  state.endTime = 0;
  state.toast = null;   // ať v zastaveném pozadí nevisí rozpracované efekty
  state.effects = [];
  state.confetti = [];
  for (let i = 0; i < CONFIG.CONFETTI_COUNT; i++) {
    state.confetti.push(makeConfetto(-Math.random() * CONFIG.HEIGHT));
  }
  setScreen('end');
}

// Po každém kroku hry: zvuky, uložení a případný konec
function watchProgress() {
  const w = progressWatch;
  const sig = questSignature();
  if (sig !== w.sig) {
    const before = w.sig.split(',');
    const now = sig.split(',');
    if (now.some((st, i) => st === 'done' && before[i] !== 'done')) playSound(CONFIG.SOUND_COMPLETE);
    else if (now.some((st, i) => st === 'carrying' && before[i] !== 'carrying')) playSound(CONFIG.SOUND_PICKUP);
    w.sig = sig;
    saveProgress();
  }
  // peníze a věci se mění i mimo úkoly (Mála půjčuje, bufet, šachy…) – uložit hned
  const bagSig = `${state.money}|${state.bag.join(',')}`;
  if (bagSig !== w.bagSig) { w.bagSig = bagSig; saveProgress(); }
  // a pro jistotu průběžně každých 5 s (energie, rozdělané příběhy…)
  if (!(w.nextSave > state.time - 5)) { w.nextSave = state.time; saveProgress(); }
  // závěr až po zavření posledního poděkování
  if (questsDone() >= activeQuests().length && !state.dialog && !state.scene && !state.choice && !state.rhythm && !state.quiz && !state.gameOver && !state.transition && !state.giveMenu && !state.wires) startEnd();
}

// --- Tlačítka ---
function getButtons() {
  const x = CONFIG.WIDTH / 2 - CONFIG.BUTTON_W / 2;
  const btn = (id, label, y, primary) => ({ id, label, primary, rect: { x, y, w: CONFIG.BUTTON_W, h: CONFIG.BUTTON_H } });
  if (state.screen === 'title') {
    // na obloze nad budovou školy: jen hlavní hra (s uloženým postupem dvě tlačítka vedle sebe)
    // a pod tím „🎮 Módy“ – Vrah, Among Us a žebříček jsou v nabídce módů (modesItems)
    const y = TITLE_SCENE.BUTTON_Y, my = y + CONFIG.BUTTON_H + 14;
    const modes = btn('modes', '🎮 Módy', my, false);
    modes.rect = { x: CONFIG.WIDTH / 2 - 170, y: my, w: 340, h: 44 };
    if (!state.savedGame) return [btn('new', 'Hrát', y, true), modes];
    const done = Object.values(state.savedGame.quests).filter((st) => st === 'done').length;
    const b = [btn('continue', `Pokračovat (${done}/${activeQuests(state.savedGame.story || newStory()).length})`, y, true), btn('new', 'Nová hra', y, false)];
    b[0].rect.x = CONFIG.WIDTH / 2 - CONFIG.BUTTON_W - 6;
    b[1].rect.x = CONFIG.WIDTH / 2 + 6;
    return b.concat(modes);
  }
  if (state.screen === 'end') {   // znovu stejný režim, nebo zpátky na úvod (výběr hry / Vraha)
    const b = [btn('restart', 'Hrát znovu', 400, true), btn('title', 'Na úvod', 400, false)];
    b[0].rect.x = CONFIG.WIDTH / 2 - CONFIG.BUTTON_W - 6;
    b[1].rect.x = CONFIG.WIDTH / 2 + 6;
    if (state.speedrun && state.speedrun.done && leaderboardReady()) {   // speedrun: třetí tlačítko – odeslat čas / žebříček (28_speedrun.js)
      b.push(btn('score', scoreButtonLabel(), 400, false));
      b.forEach((x, i) => { x.rect.x = 30 + i * (CONFIG.BUTTON_W + 10); });
    }
    return b;
  }
  return [];
}

// --- Nabídka „🎮 Módy“ na úvodu: Vrah z učebny C109, Among Us, žebříček ---
state.modesMenu = null;   // otevřená nabídka { sel }
function modesItems() {
  const items = state.savedVrah
    ? [{ id: 'vrah', label: '🔍 Pokračovat ve Vrahovi' }, { id: 'vrahNew', label: 'Začít Vraha znovu' }]
    : [{ id: 'vrah', label: '🔍 Vrah z učebny C109' }];
  items.push({ id: 'horor', label: '👻 Bacha na Láďu' });                             // 39_horor.js
  if (mpReady()) items.push({ id: 'among', label: '👾 Among Us (online)' });         // 36_among.js
  if (leaderboardReady()) items.push({ id: 'leaderboard', label: '🏆 Žebříček' });   // 28_speedrun.js
  items.push({ id: 'back', label: 'Zpět' });
  return items;
}
const MODES_PANEL = () => { const h = 96 + modesItems().length * 56; return { x: 220, y: Math.round(CONFIG.HEIGHT / 2 - h / 2), w: 360, h }; };
const modesRow = (i) => ({ x: 240, y: MODES_PANEL().y + 70 + i * 56, w: 320, h: 46 });
function modesEvents(events) {
  const M = state.modesMenu, items = modesItems();
  M.sel = Math.min(M.sel, items.length - 1);
  for (const ev of events) {
    let i = -1;
    if (ev.type === 'action') i = M.sel;
    else if (ev.x != null) {
      i = items.findIndex((_, k) => pointInRect(ev.x, ev.y, modesRow(k), 0));
      if (i < 0 && !pointInRect(ev.x, ev.y, MODES_PANEL(), 0)) { state.modesMenu = null; return; }   // ťuknutí mimo = zpět
    }
    if (i < 0) continue;
    state.modesMenu = null;
    if (items[i].id !== 'back') pressButton(items[i].id);
    return;
  }
}
window.addEventListener('keydown', (e) => {
  const M = state.modesMenu;
  if (!M || state.screen !== 'title') return;
  const n = modesItems().length;
  if (e.code === 'Escape') state.modesMenu = null;
  else if (KEYMAP.up.includes(e.code)) M.sel = (M.sel + n - 1) % n;
  else if (KEYMAP.down.includes(e.code)) M.sel = (M.sel + 1) % n;
  else return;
  e.stopImmediatePropagation();
}, true);
function drawModesMenu() {
  const M = state.modesMenu;
  if (!M || state.screen !== 'title') return;
  const P = MODES_PANEL(), items = modesItems();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 16);
  ctx.fillStyle = '#3a2616'; ctx.fill();
  ctx.strokeStyle = '#c99a62'; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText('🎮 Módy', 400, P.y + 36, 'bold 26px sans-serif', '#ffd54a', 'middle');
  items.forEach((it, i) => drawChessButton(modesRow(i), it.label, i === M.sel, it.id === 'back' ? '#5a4636' : '#2f5a7a'));
}

function pressButton(id) {
  if (id === 'modes') { state.modesMenu = { sel: 0 }; return; }   // nabídka módů
  if (id === 'continue') pickStart(() => startPlaying(state.savedGame));   // kde začít (33_skiny.js)
  else if (id === 'vrah') { if (state.savedVrah) startPlaying(state.savedVrah, 'vrah'); else pickMode((sp) => startPlaying(null, 'vrah', sp)); }
  else if (id === 'vrahNew') pickMode((sp) => startPlaying(null, 'vrah', sp));   // Vrah od začátku (uložení se smaže)
  else if (id === 'restart') { const mode = state.mode; pickMode((sp) => (mode ? startPlaying(null, mode, sp) : pickStart(() => startPlaying(null, null, sp)))); }   // znovu stejný režim
  else if (id === 'title') goToTitle();
  else if (id === 'leaderboard') openLeaderboard('hra');   // žebříček z hlavního menu (28_speedrun.js)
  else if (id === 'score') scoreButtonPress();   // odeslání času do žebříčku (28_speedrun.js)
  else pickMode((sp) => pickStart(() => startPlaying(null, null, sp))); // 'new': normální hra / speedrun, pak kde začít
}

// Mezerník/Enter zmáčkne hlavní tlačítko, klik/ťuknutí to, na které míří
function updateMenu() {
  const events = input.events.splice(0);
  if (state.modePick) { modePickEvents(events); return; }   // výběr režimu (28_speedrun.js)
  if (state.modesMenu) { modesEvents(events); return; }     // 🎮 Módy
  if (state.spawnPick) { spawnPickEvents(events); return; }  // kde začít (33_skiny.js)
  if (state.lb) { leaderboardEvents(events); return; }       // žebříček (28_speedrun.js)
  if (state.musicMenu) { musicMenuEvents(events); return; }   // seznam hudby přes úvod
  if (state.screen === 'end' && state.endTime < CONFIG.END_INPUT_DELAY) return;
  const buttons = getButtons();
  for (const ev of events) {
    if (ev.type === 'action') { pressButton(buttons[0].id); return; }
    if (ev.x === null) continue;
    const b = buttons.find((b) => pointInRect(ev.x, ev.y, b.rect, 0));
    if (b) { pressButton(b.id); return; }
  }
}

// --- Konfety ---
function makeConfetto(y) {
  const colors = CONFIG.CONFETTI_COLORS;
  return {
    x: Math.random() * CONFIG.WIDTH,
    y,
    vx: -20 + Math.random() * 40,
    vy: 60 + Math.random() * 110,
    rot: Math.random() * Math.PI * 2,
    vr: -5 + Math.random() * 10,
    w: 6 + Math.random() * 5,
    h: 4 + Math.random() * 4,
    phase: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

function updateConfetti(dt) {
  for (const c of state.confetti) {
    c.x += (c.vx + Math.sin(state.time * 2 + c.phase) * 30) * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    if (c.y > CONFIG.HEIGHT + 10) Object.assign(c, makeConfetto(-10)); // padají pořád dokola
  }
}

function drawConfetti() {
  for (const c of state.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(1, Math.abs(Math.cos(c.rot * 0.7)) * 0.8 + 0.2); // „otáčení“ ve vzduchu
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
}

// --- Vykreslení obrazovek ---
function drawButtons() {
  for (const b of getButtons()) {
    const r = b.rect;
    roundRectPath(r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = b.primary ? CONFIG.BUTTON_COLOR : CONFIG.BUTTON_SECONDARY_COLOR;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = CONFIG.BUTTON_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.BUTTON_TEXT_COLOR;
    ctx.fillText(b.label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
}

function drawCenteredText(text, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, CONFIG.WIDTH / 2, y, CONFIG.WIDTH - 20);   // dlouhý text se zúží (mobil má větší písmo)
}

// Úvod: střed školy zepředu (rizalit bez křídel, stejná kresba jako pohled Před školou)
// zvětšený přes celou obrazovku. V oknech se střídají postavy s hlavou z fotky (každá
// v jednom okně, nepřekrývají se), hráč stojí v hlavních dveřích. Nadpis a tlačítka
// jsou nahoře přes štít, ovládání dole.
const TITLE_SCENE = {
  SCALE: 1.875,         // zvětšení scény Před školou (střed školy přes celou výšku)
  CENTER_X: 800,        // střed budovy (px v místnosti ulice) – na střed obrazovky
  TOP_Y: 40,            // co z místnosti je u horního okraje obrazovky (px)
  BUTTON_Y: 352,
  // nadpis do oblouku (půlkruh) uprostřed obrazovky, pod ním stuha s věnováním a tlačítko
  // velký plochý oblouk nad horními okny, konce jdou dolů vedle fasády (okna nezakrývá)
  ARC: { cx: 400, cy: 968, r: 900, font: 'bold 50px sans-serif', spacing: 4 },
  RIBBON_Y: 318,
  SWAP_TIME: 5,         // po kolika sekundách se postavy v oknech vystřídají
  PLAYER_SCALE: 0.95,   // hráč ve dveřích (hlava pod oknem nad dveřmi)
};
// Okna rizalitu: [střed x, horní okraj y, šířka, výška, oblouk] v místnosti ulice
// (5 obloukových nahoře, 5 v 1. patře, 4 v přízemí – uprostřed je vchod)
const TITLE_WINDOWS = (() => {
  const rx = SCHOOL.rizX, list = [];
  for (let i = 0; i < 5; i++) list.push([rx + 46 + i * 52, 132, 30, 50, true]);
  for (let i = 0; i < 5; i++) list.push([rx + 46 + i * 52, 230, 30, 36, false]);
  for (let i = 0; i < 5; i++) if (i !== 2) list.push([rx + 46 + i * 52, 300, 28, 38, false]);
  return list;
})();

// Nadpis po oblouku nad středem (cx, cy): bílá písmena s tlustým tmavým obrysem a stínem,
// ať jsou vidět na žluté fasádě i na obloze
function drawArcTitle(text, { cx, cy, r, font, spacing }) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) / r;   // úhel, který nápis zabere
  for (const pass of ['shadow', 'stroke', 'fill']) {
    let a = -Math.PI / 2 - total / 2;
    [...text].forEach((ch, i) => {
      const half = widths[i] / 2 / r;
      a += half;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a + Math.PI / 2);
      if (pass === 'shadow') { ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillText(ch, 3, 4); }
      if (pass === 'stroke') { ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 9; ctx.strokeText(ch, 0, 0); }
      if (pass === 'fill') { ctx.fillStyle = '#ffffff'; ctx.fillText(ch, 0, 0); }
      ctx.restore();
      a += half;
    });
  }
  ctx.restore();
}
// Červená stuha s textem (věnování pod nadpisem)
function drawRibbon(text, cx, cy) {
  ctx.save();
  ctx.font = 'bold 22px sans-serif';
  const w = ctx.measureText(text).width + 56, h = 38, x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = '#8e1b1b';   // zadní konce stuhy s výřezem
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x - 26 : x + w + 26, ix = s < 0 ? x + 8 : x + w - 8;
    ctx.beginPath();
    ctx.moveTo(ix, y + 8); ctx.lineTo(ex, y + 8); ctx.lineTo(ex + s * -12, y + h / 2 + 8); ctx.lineTo(ex, y + h + 8); ctx.lineTo(ix, y + h + 8);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#c62828';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x, y + 3, w, 2);
  ctx.fillRect(x, y + h - 5, w, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}
// Tlačítko na úvodu: hlavní je velké zelené s ▶ a jemně pulzuje, vedlejší je modré
function drawTitleButton(b, t) {
  const r = b.rect, pulse = b.primary ? 1 + Math.sin(t * 3) * 0.04 : 1;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRectPath(-r.w / 2 + 3, -r.h / 2 + 5, r.w, r.h, r.h / 2);
  ctx.fill();
  roundRectPath(-r.w / 2, -r.h / 2, r.w, r.h, r.h / 2);
  const g = ctx.createLinearGradient(0, -r.h / 2, 0, r.h / 2);
  if (b.primary) { g.addColorStop(0, '#5cc05f'); g.addColorStop(1, '#2e7d32'); }
  else { g.addColorStop(0, '#5c8fd6'); g.addColorStop(1, '#2f5fa8'); }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = b.primary ? 'bold 24px sans-serif' : 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  const label = b.primary ? '▶ ' + b.label.toUpperCase() : b.label;
  const maxW = r.w - 24;   // text se vždy vejde do tlačítka (na mobilu je písmo širší)
  ctx.strokeText(label, 0, 1, maxW);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 0, 1, maxW);
  ctx.restore();
}

function renderTitle() {
  const room = ROOMS.ulice, T = TITLE_SCENE, k = T.SCALE;
  const t = state.time;
  const sky = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
  sky.addColorStop(0, '#9fbfdc'); sky.addColorStop(1, '#eef1f2');
  ctx.fillStyle = sky;
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);   // na širokém mobilu obloha i po stranách

  ctx.save();
  ctx.translate(CONFIG.WIDTH / 2 - k * (room.x + T.CENTER_X), -k * (room.y + T.TOP_Y));
  ctx.scale(k, k);
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  // místo křídel stromy po stranách
  for (const [tx, ty, tr, c] of [[560, 200, 80, '#5f7d55'], [590, 320, 70, '#6f8a62'], [1040, 200, 80, '#5f7d55'], [1010, 320, 70, '#6f8a62']]) {
    ctx.fillStyle = '#5a4430'; ctx.fillRect(X(tx - 7), Y(ty), 14, 200);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(tx), Y(ty), tr, 0, Math.PI * 2); ctx.fill();
  }
  drawFrontScene(room, { label: false, sky: false, wings: false });

  // v oknech postavy s hlavou z fotky; je jich víc než oken, tak se po SWAP_TIME vystřídají
  // (okno i v kole c ukazuje postavu (i + c * oken) % počet – v jednom kole se neopakují)
  const people = Object.values(TEACHERS).filter((c) => c.look && c.look.face);
  const n = TITLE_WINDOWS.length;
  TITLE_WINDOWS.forEach((w, i) => {
    if (!people.length) return;
    const local = t / T.SWAP_TIME - i * 0.03;   // okna se střídají kousek po sobě
    const round = Math.floor(local), f = local - round;
    const c = people[(((i + round * n) % people.length) + people.length) % people.length];   // i pro záporné kolo na začátku
    const img = faceImgs[c.look.face];
    if (!img || !img.complete || !img.naturalWidth) return;
    // vykoukne na začátku kola, schová se na konci
    const up = Math.min(1, f / 0.08, (1 - f) / 0.08) * (0.92 + Math.sin(t * 1.3 + i * 1.7) * 0.05);
    if (up <= 0) return;
    const size = w[2] - 2;   // hlava se vejde do okna
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(w[0] - w[2] / 2), Y(w[1]), w[2], w[3]);
    if (w[4]) ctx.arc(X(w[0]), Y(w[1]), w[2] / 2, Math.PI, 0);   // obloukové okno
    ctx.clip();
    ctx.drawImage(img, X(w[0] - size / 2), Y(w[1] + w[3] - size * up), size, size);
    ctx.restore();
    ctx.fillStyle = '#ffffff';   // příčle okna přes hlavu, ať je v okně
    ctx.fillRect(X(w[0] - w[2] / 2), Y(w[1] + w[3] * 0.45), w[2], 1.5);
  });

  // hráč stojí v hlavních dveřích a lehce se pohupuje
  const px = X(SCHOOL.rizX + SCHOOL.rizW / 2), feet = Y(SCHOOL.base + 2);
  ctx.fillStyle = CONFIG.CHARACTER_SHADOW;
  ctx.beginPath(); ctx.ellipse(px + 2, feet, 16 * T.PLAYER_SCALE, 4 * T.PLAYER_SCALE, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(px, feet - Math.abs(Math.sin(t * 2.2)) * 2);
  ctx.scale(T.PLAYER_SCALE, T.PLAYER_SCALE);
  drawPlayerFigure(0, 0, 0, 0);
  ctx.restore();
  ctx.restore();

  // nadpis do oblouku, stuha s věnováním a tlačítka uprostřed
  drawArcTitle(CONFIG.GAME_TITLE.toUpperCase(), T.ARC);
  drawRibbon(CONFIG.GAME_SUBTITLE, CONFIG.WIDTH / 2, T.RIBBON_Y);
  for (const b of getButtons()) drawTitleButton(b, t);

  // ovládání dole (jen to, které hráč používá)
  ctx.fillStyle = 'rgba(20, 26, 40, 0.75)';
  ctx.fillRect(0, CONFIG.HEIGHT - 22, CONFIG.WIDTH, 22);
  drawCenteredText(isTouchHint() ? CONFIG.CONTROLS_TOUCH : CONFIG.CONTROLS_KEYBOARD, CONFIG.HEIGHT - 11,
    CONFIG.MENU_SMALL_FONT, '#e8e8e8');
}

function renderEnd() {
  renderGame(); // zastavená hra v pozadí
  ctx.fillStyle = CONFIG.END_OVERLAY;
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  drawConfetti();
  const pop = 1 + 0.04 * Math.sin(state.time * 4); // titulek jemně „dýchá“
  ctx.save();
  ctx.translate(CONFIG.WIDTH / 2, 220);
  ctx.scale(pop, pop);
  ctx.translate(-CONFIG.WIDTH / 2, -220);
  const vrah = state.mode === 'vrah';   // konec příběhu Vrah z učebny C109
  drawCenteredText(vrah ? '🏆 Zahradní detektiv!' : CONFIG.END_TITLE.replace('{name}', CONFIG.PLAYER_NAME), 220,
    CONFIG.MENU_TITLE_FONT, CONFIG.MENU_TITLE_COLOR);
  ctx.restore();
  drawCenteredText(vrah ? `Případ Ferdinand je uzavřen. Holub je zelený a Ferdinand II. je tvůj.${state.vrah && state.vrah.jednicka ? ' + 📗 jednička z biologie' : ''}` : CONFIG.END_TEXT, 285, CONFIG.MENU_SUBTITLE_FONT, CONFIG.MENU_TEXT_COLOR);
  drawCenteredText(`Splněno ${activeQuests().length}/${activeQuests().length} úkolů`, 320,
    CONFIG.MENU_SMALL_FONT, CONFIG.MENU_SMALL_COLOR);
  const sr = state.speedrun;   // speedrun: výsledný čas a rekord
  if (sr && sr.done) {
    drawCenteredText(`⏱ Čas: ${formatRunTime(sr.t)}${sr.record ? '   🏆 nový rekord!' : ''}`, 350, 'bold 22px sans-serif', CONFIG.MENU_TITLE_COLOR);
    if (!sr.record) drawCenteredText(`Nejlepší čas: ${formatRunTime(sr.best)}`, 375, CONFIG.MENU_SMALL_FONT, CONFIG.MENU_SMALL_COLOR);
  }
  if (state.endTime >= CONFIG.END_INPUT_DELAY) drawButtons();
}
