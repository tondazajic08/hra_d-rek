// Výběr startu (venku / ve skříňkách), Locker v Dolních šatnách a výběr skinu
// Část hry Dárek – načítá se v index.html před 15_hlavni.js.
'use strict';

// =====================================================================
// SKINY – vzhled hráče (hlava + oblečení). Vybírá se u Lockeru v Dolních šatnách,
// pamatuje se v prohlížeči (SKIN_KEY) a vidí ho i ostatní online hráči (pole s v databázi).
// Nový skin = nový řádek: { id, name, face?: 'obrazky/x.png' (bez ní Romanova hlava),
//   hair (barva vlasů zezadu), body, check?, dots?, collar, tie?, arms, pants, shoes }
// Za Romanovými oblečeními jsou skiny všech postav ze hry s vlastním vzhledem (učitelé,
// studenti, postavy z Vraha) – person = klíč do TEACHERS, look = kopie vzhledu při načtení.
// Převlékat se jde u Lockeru a v čekárně Among Us (36_among.js).
// =====================================================================
const SKIN_KEY = 'hra_darek_skin_v1';
const SKINS = [
  { id: 'roman', name: 'Roman', hair: '#3a2a1c',
    body: CONFIG.PLAYER_VEST, check: CONFIG.PLAYER_VEST_CHECK, collar: CONFIG.PLAYER_SHIRT, arms: CONFIG.PLAYER_SHIRT, pants: CONFIG.PLAYER_PANTS, shoes: CONFIG.PLAYER_SHOES },
  { id: 'mikina', name: 'Roman v mikině', hair: '#3a2a1c',
    body: '#c62828', collar: '#8e1b1b', arms: '#c62828', pants: '#2e4a7d', shoes: '#f2f2f2' },
  { id: 'dres', name: 'Roman v dresu', hair: '#3a2a1c',
    body: '#1565c0', dots: 'rgba(255, 255, 255, 0.25)', collar: '#ffffff', arms: '#1565c0', pants: '#0d3c80', shoes: '#ffffff' },
  { id: 'oblek', name: 'Roman v obleku', hair: '#3a2a1c',
    body: '#1d1d22', collar: '#ffffff', tie: '#b71c1c', arms: '#1d1d22', pants: '#1d1d22', shoes: '#0d0d0d' },
  { id: 'kostky', name: 'Roman v kostkované košili', hair: '#3a2a1c',
    body: '#b23a3a', check: 'rgba(0, 0, 0, 0.35)', collar: '#b23a3a', arms: '#b23a3a', pants: '#3b4a6b', shoes: '#6d4c2f' },
];
// Postavy ze hry (TEACHERS jsou už načtení – soubory 03–28 jdou před tímhle)
for (const [id, t] of Object.entries(TEACHERS)) {
  if (!t.look || (!t.look.face && !t.look.hair)) continue;
  SKINS.push({ id: `p_${id}`, name: t.name, person: id, look: JSON.parse(JSON.stringify(t.look)), color: t.color, hair: t.look.hair || '#3a2a1c' });
}
const skinFaces = {};   // id → Image (jen skiny s vlastní hlavou)
for (const s of SKINS) if (s.face) { skinFaces[s.id] = new Image(); skinFaces[s.id].src = s.face; }

const skinById = (id) => SKINS.find((s) => s.id === id) || null;
let mySkin = skinById(storageGet(SKIN_KEY)) || SKINS[0];
function setMySkin(skin) {
  mySkin = skin;
  storageSet(SKIN_KEY, skin.id);
}
// Vzhled pro drawFigure (back = postava zezadu: bez obličeje, límce a kravaty)
function skinLook(skin, back) {
  if (skin.person) {   // postava ze hry: stejný vzhled jako ona
    const look = { ...skin.look, face: faceImgs[skin.look.face] || null, fallback: skin.color };
    return back ? { ...look, face: null, collar: look.body, tie: null, hair: skin.hair } : look;
  }
  const face = skinFaces[skin.id] || playerFaceImg;
  const look = { face, fallback: CONFIG.PLAYER_COLOR, body: skin.body, check: skin.check, dots: skin.dots,
    collar: skin.collar, tie: skin.tie, arms: skin.arms, pants: skin.pants, shoes: skin.shoes };
  if (back) Object.assign(look, { face: null, collar: skin.body, tie: null, hair: skin.hair });
  return look;
}
// Hráč se kreslí ve vybraném skinu (všude, kde se volá drawPlayerFigure: hra, úvod, scény)
drawPlayerFigure = function (cx, feetY, phase, blend) {
  drawFigure(cx, feetY, phase, blend, skinLook(mySkin));
};
// Zezadu: přes hlavu vlasy (drawFigure kreslí obličej vždy zepředu)
function drawFigureBack(cx, feetY, look, hair) {
  drawFigure(cx, feetY, 0, 0, look);
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(cx, feetY - 50, 16.5, 18.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = CONFIG.CHARACTER_OUTLINE; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.ellipse(cx - 5, feetY - 58, 6, 8, -0.4, 0, Math.PI * 2); ctx.fill();
}

// =====================================================================
// START – kde nová / načtená hlavní hra začíná: venku před školou, nebo ve skříňkách
// =====================================================================
const START_KEY = 'hra_darek_start_v1';
const START_PLACES = [
  { id: 'venku', label: '🏫 Venku před školou', room: 'ulice' },
  { id: 'satny', label: '🔒 Ve skříňkách (Dolní šatny)', room: 'satnyDole', at: { x: 70, y: 262 } },   // hned u Lockeru (školník je dál)
];
state.spawnPick = null;   // otevřený výběr { sel, next }
let startPlace = START_PLACES.find((p) => p.id === storageGet(START_KEY)) || START_PLACES[0];

// Volá resetGame (10_obrazovky.js) místo enterRoom(CONFIG.START_ROOM)
function enterStartRoom() {
  const p = startPlace, room = ROOMS[p.room];
  if (!p.at) { enterRoom(p.room); return; }
  enterRoom(p.room, { x: room.x + p.at.x - state.player.w / 2, y: room.y + p.at.y - state.player.h / 2 });
}
function pickStart(next) { state.spawnPick = { sel: START_PLACES.indexOf(startPlace), next }; }

const START_PANEL = { x: 180, y: 180, w: 440, h: 230 };
const startRows = () => START_PLACES.map((_, i) => ({ x: START_PANEL.x + 20, y: START_PANEL.y + 70 + i * 62, w: START_PANEL.w - 40, h: 52 }));
function spawnPickEvents(events) {
  const m = state.spawnPick;
  for (const ev of events) {
    let i = null;
    if (ev.type === 'action') i = m.sel;
    else if (ev.x != null) {
      const hit = startRows().findIndex((r) => pointInRect(ev.x, ev.y, r, 0));
      if (hit >= 0) i = hit;
      else if (!pointInRect(ev.x, ev.y, START_PANEL, 0)) { state.spawnPick = null; return; }   // ťuknutí mimo = zpět
    }
    if (i === null) continue;
    state.spawnPick = null;
    startPlace = START_PLACES[i];
    storageSet(START_KEY, startPlace.id);
    playSound([[660, 0, 0.05]]);
    m.next();
    return;
  }
}
window.addEventListener('keydown', (e) => {
  if (!state.spawnPick) return;
  if (e.code === 'Escape') state.spawnPick = null;
  else if (KEYMAP.up.includes(e.code) || KEYMAP.left.includes(e.code)) state.spawnPick.sel = 0;
  else if (KEYMAP.down.includes(e.code) || KEYMAP.right.includes(e.code)) state.spawnPick.sel = 1;
});
function drawSpawnPick() {
  const m = state.spawnPick;
  if (!m) return;
  const P = START_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText('Kde chceš začít?', P.x + P.w / 2, P.y + 36, P.w - 30);
  startRows().forEach((r, i) => {
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = i === m.sel && !isTouchHint() ? '#ffe9a8' : '#fffaf0'; ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#2b1d14'; ctx.textAlign = 'left';
    ctx.fillText(START_PLACES[i].label, r.x + 16, r.y + r.h / 2 + 1, r.w - 30);
  });
  ctx.textAlign = 'center'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#6d5a48';
  ctx.fillText(isTouchHint() ? 'Ťuknutí mimo = zpět' : 'Šipky + mezerník, Esc = zpět', P.x + P.w / 2, P.y + P.h - 16);
}

// =====================================================================
// LOCKER – skříňka na levé zdi Dolních šaten (u místa startu), mezerník = výběr skinu
// =====================================================================
const LOCKER = { room: 'satnyDole', local: { x: 20, y: 252, w: 22, h: 42 } };
function lockerRect() {
  if (!state.room || state.room.id !== LOCKER.room) return null;
  const l = LOCKER.local;
  return { x: state.room.x + l.x, y: state.room.y + l.y, w: l.w, h: l.h };
}
SPOTS.push({ rect: lockerRect, act: () => openSkins(), hintDx: 30 });
// Ve světě: skříňka svítí a nad ní je cedulka (volá renderGame)
function drawLockerWorld() {
  const r = lockerRect();
  if (!r) return;
  drawRect(r, '#7b1fa2');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let y = r.y + 14; y < r.y + r.h - 2; y += 14) ctx.fillRect(r.x, y, r.w, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(r.x + r.w - 3, r.y, 3, r.h);
  const glow = 0.45 + 0.35 * Math.sin(state.time * 4);
  ctx.strokeStyle = `rgba(255, 213, 74, ${glow})`; ctx.lineWidth = 3;
  ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
  ctx.fillText('👕', r.x + r.w / 2, r.y + r.h / 2);
  drawOutlinedText('Locker', r.x + r.w + 26, r.y - 8, 'bold 11px sans-serif', '#ffffff', 'middle');
}

// =====================================================================
// OBRAZOVKA SKINŮ – postava přes většinu obrazovky, šipky po stranách,
// ťuknutí na postavu = otočí se dokola; pozadí jsou šatny s otevřenými skříňkami
// =====================================================================
const SKIN_UI = {
  FEET: { x: 400, y: 520 }, SCALE: 4.2,
  LEFT: { x: 70, y: 270, w: 90, h: 110 }, RIGHT: { x: 640, y: 270, w: 90, h: 110 },
  FIGURE: { x: 290, y: 190, w: 220, h: 340 },   // kam se ťuká pro otočení
  PICK: { x: 560, y: 532, w: 200, h: 52 },
  QUIT: { x: 12, y: 14, w: 56, h: 44 },
  SPIN_TIME: 0.9,
};
function openSkins() {
  state.skins = { sel: SKINS.indexOf(mySkin), spin: -1, slide: 0, keys: [], t: 0 };
  input.events.length = 0;
  playSound([[392, 0, 0.05], [587, 0.06, 0.08]]);
  setScreen('skins');
}
function skinsLeave() {
  state.skins = null;
  setScreen('playing');
  input.events.length = 0;
}
function skinsMove(d) {
  const s = state.skins;
  s.sel = (s.sel + d + SKINS.length) % SKINS.length;
  s.slide = d;          // nová postava přijede z té strany
  s.spin = -1;
  playSound([[523 + d * 40, 0, 0.04]]);
}
function skinsPick() {
  const skin = SKINS[state.skins.sel];
  if (skin === mySkin) { skinsLeave(); return; }
  setMySkin(skin);
  playSound(CONFIG.SOUND_COMPLETE);
  state.toast = { text: `Teď máš na sobě: ${skin.name}`, t: CONFIG.TOAST_TIME };
  skinsLeave();
}
window.addEventListener('keydown', (e) => {
  if (state.screen === 'skins' && state.skins && !e.repeat) state.skins.keys.push(e.code);
});
function updateSkins(dt) {
  const s = state.skins;
  const events = input.events.splice(0), keys = s.keys.splice(0);
  s.t += dt;
  if (s.spin >= 0) { s.spin += dt / SKIN_UI.SPIN_TIME; if (s.spin >= 1) s.spin = -1; }
  s.slide *= Math.exp(-dt * 12);
  if (Math.abs(s.slide) < 0.002) s.slide = 0;
  for (const k of keys) {
    if (k === 'Escape') { skinsLeave(); return; }
    if (KEYMAP.left.includes(k)) skinsMove(-1);
    if (KEYMAP.right.includes(k)) skinsMove(1);
    if (KEYMAP.up.includes(k) || KEYMAP.down.includes(k)) s.spin = 0;   // otočit
  }
  for (const ev of events) {
    if (ev.type === 'action') { skinsPick(); return; }
    if (ev.x == null) continue;
    if (pointInRect(ev.x, ev.y, SKIN_UI.QUIT, 6)) { skinsLeave(); return; }
    if (pointInRect(ev.x, ev.y, SKIN_UI.LEFT, 10)) skinsMove(-1);
    else if (pointInRect(ev.x, ev.y, SKIN_UI.RIGHT, 10)) skinsMove(1);
    else if (pointInRect(ev.x, ev.y, SKIN_UI.PICK, 6)) { skinsPick(); return; }
    else if (pointInRect(ev.x, ev.y, SKIN_UI.FIGURE, 0) && s.spin < 0) s.spin = 0;
  }
}

// --- pozadí: šatny se skříňkami, některé otevřené s oblečením ---
const LOCKER_COLORS = ['#2f6fb0', '#e8c21c', '#2f7a46'];
const OPEN_LOCKERS = {   // index skříňky → co v ní visí
  1: [{ kind: 'hoodie', color: '#c62828' }, { kind: 'bag', color: '#37474f' }],
  4: [{ kind: 'shirt', color: '#f5f5f5' }, { kind: 'shirt', color: '#1565c0' }],
  7: [{ kind: 'jacket', color: '#1d1d22' }, { kind: 'shoes', color: '#ffffff' }],
  9: [{ kind: 'hoodie', color: '#2e7d32' }, { kind: 'shirt', color: '#b23a3a' }],
};
function drawHanging(item, x, y) {
  if (item.kind === 'bag') {
    roundRectPath(x - 18, y + 150, 36, 44, 8); ctx.fillStyle = item.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + 150, 10, Math.PI, 0); ctx.stroke();
    return;
  }
  if (item.kind === 'shoes') {
    for (const dx of [-14, 6]) { roundRectPath(x + dx, y + 200, 18, 9, 4); ctx.fillStyle = item.color; ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke(); }
    return;
  }
  // ramínko a oblečení (tričko / mikina s kapucí / sako)
  ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.moveTo(x - 16, y + 16); ctx.lineTo(x, y + 8); ctx.lineTo(x + 16, y + 16); ctx.stroke();
  const long = item.kind === 'jacket' ? 92 : item.kind === 'hoodie' ? 80 : 66;
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 14); ctx.lineTo(x - 28, y + 40); ctx.lineTo(x - 20, y + 46); ctx.lineTo(x - 15, y + 34);
  ctx.lineTo(x - 15, y + 14 + long); ctx.lineTo(x + 15, y + 14 + long); ctx.lineTo(x + 15, y + 34);
  ctx.lineTo(x + 20, y + 46); ctx.lineTo(x + 28, y + 40); ctx.lineTo(x + 16, y + 14);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (item.kind === 'hoodie') { ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.beginPath(); ctx.arc(x, y + 18, 9, 0, Math.PI); ctx.fill(); ctx.fillRect(x - 10, y + 54, 20, 12); }
  if (item.kind === 'jacket') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - 6, y + 14); ctx.lineTo(x, y + 34); ctx.lineTo(x + 6, y + 14); ctx.fill(); ctx.fillStyle = '#b71c1c'; ctx.fillRect(x - 1.5, y + 18, 3, 16); }
  if (item.kind === 'shirt') { ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; ctx.beginPath(); ctx.arc(x, y + 14, 6, 0, Math.PI); ctx.fill(); }
}
function drawSkinRoom() {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT, floorY = 430;
  ctx.fillStyle = '#cfd6da'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, floorY);   // zeď
  // řada skříněk přes celou zeď
  const lw = 72, top = 40, h = floorY - top - 6;
  for (let i = 0, x = -VIEW.offX - 20; x < W + VIEW.offX; i++, x += lw) {
    const color = LOCKER_COLORS[((i % 3) + 3) % 3], open = OPEN_LOCKERS[i];
    drawRect({ x, y: top, w: lw - 2, h }, color);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'; ctx.lineWidth = 2; ctx.strokeRect(x, top, lw - 2, h);
    if (open) {
      drawRect({ x: x + 4, y: top + 4, w: lw - 10, h: h - 8 }, '#2a2a2e');   // vnitřek
      drawRect({ x: x + 4, y: top + 4, w: lw - 10, h: 10 }, '#3b3b40');      // polička
      drawRect({ x: x + 6, y: top + 24, w: lw - 14, h: 3 }, '#9e9e9e');      // tyč na ramínka
      open.forEach((item, k) => drawHanging(item, x + lw / 2 - 1 + (k ? 6 : -4), top + 25));
      // otevřená dvířka (vykloněná doprava, v perspektivě užší)
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x + lw - 2, top); ctx.lineTo(x + lw + 20, top + 14); ctx.lineTo(x + lw + 20, top + h - 14); ctx.lineTo(x + lw - 2, top + h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; ctx.stroke();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + lw + 4, top + 26 + k * 7, 12, 3);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';   // větrací škvíry, číslo, zámek
      for (let k = 0; k < 5; k++) ctx.fillRect(x + 16, top + 18 + k * 8, lw - 34, 3);
      drawRect({ x: x + lw / 2 - 12, y: top + 70, w: 22, h: 12 }, 'rgba(255, 255, 255, 0.75)');
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#333';
      ctx.fillText(String(100 + i), x + lw / 2 - 1, top + 76);
      drawRect({ x: x + lw - 16, y: top + h / 2 - 12, w: 6, h: 24 }, '#cfd2d4');
    }
  }
  // podlaha s dlaždicemi a lavička
  ctx.fillStyle = '#d9d9d5'; ctx.fillRect(-VIEW.offX, floorY, W + 2 * VIEW.offX, H - floorY);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'; ctx.lineWidth = 1;
  for (let x = -VIEW.offX; x < W + VIEW.offX; x += 50) { ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x + (x - W / 2) * 0.3, H); ctx.stroke(); }
  for (let y = floorY + 30; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(-VIEW.offX, y); ctx.lineTo(W + VIEW.offX, y); ctx.stroke(); }
  drawRect({ x: 120, y: floorY + 4, w: 560, h: 16 }, '#8d5a2b');
  drawRect({ x: 120, y: floorY + 4, w: 560, h: 4 }, '#a8763f');
  for (const x of [140, 650]) drawRect({ x, y: floorY + 20, w: 10, h: 26 }, '#5a3a22');
  // reflektor pod postavou
  const g = ctx.createRadialGradient(400, 520, 10, 400, 520, 150);
  g.addColorStop(0, 'rgba(255, 244, 200, 0.75)'); g.addColorStop(1, 'rgba(255, 244, 200, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(400, 520, 160, 42, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSkinArrow(r, dir) {
  roundRectPath(r.x, r.y, r.w, r.h, 18);
  ctx.fillStyle = 'rgba(20, 22, 34, 0.75)'; ctx.fill();
  ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.stroke();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath(); ctx.moveTo(cx - 14 * dir, cy - 26); ctx.lineTo(cx + 16 * dir, cy); ctx.lineTo(cx - 14 * dir, cy + 26); ctx.closePath(); ctx.fill();
}

function renderSkins() {
  const s = state.skins, U = SKIN_UI, skin = SKINS[s.sel];
  drawSkinRoom();
  // postava: otáčí se kolem svislé osy (zúžení podle cos), zezadu bez obličeje
  const angle = s.spin >= 0 ? s.spin * Math.PI * 2 : 0;
  const sx = Math.cos(angle), back = sx < 0;
  const fx = U.FEET.x + s.slide * 320, breathe = Math.sin(s.t * 2) * 0.01;
  ctx.save();
  ctx.globalAlpha = 1 - Math.min(0.8, Math.abs(s.slide));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(fx, U.FEET.y, 70 * Math.max(0.4, Math.abs(sx)), 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(fx, U.FEET.y);
  ctx.scale(U.SCALE * Math.max(0.04, Math.abs(sx)), U.SCALE * (1 + breathe));
  if (back) drawFigureBack(0, 0, skinLook(skin, true), skin.hair);
  else drawFigure(0, 0, 0, 0, skinLook(skin));
  ctx.restore();

  drawOutlinedText('👕 Locker – vyber si oblečení', 400, 22, 'bold 22px sans-serif', '#ffd54a', 'middle');
  drawSkinArrow(U.LEFT, -1);
  drawSkinArrow(U.RIGHT, 1);
  // jméno skinu a pořadí
  roundRectPath(220, 536, 330, 46, 12);
  ctx.fillStyle = 'rgba(20, 22, 34, 0.8)'; ctx.fill();
  drawOutlinedText(skin.name, 385, 553, 'bold 18px sans-serif', '#ffffff', 'middle');
  drawOutlinedText(`${s.sel + 1} / ${SKINS.length}${skin === mySkin ? '  ·  máš na sobě' : ''}`, 385, 572, 'bold 11px sans-serif', '#e8d3a8', 'middle');
  const P = U.PICK, on = skin === mySkin;
  roundRectPath(P.x, P.y, P.w, P.h, 12);
  ctx.fillStyle = on ? '#5a4636' : '#2e7d32'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
  drawOutlinedText(on ? '✓ Hotovo' : '✓ Vybrat', P.x + P.w / 2, P.y + P.h / 2 + 1, 'bold 19px sans-serif', '#ffffff', 'middle');
  const q = U.QUIT;
  roundRectPath(q.x, q.y, q.w, q.h, 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
  drawOutlinedText('✕', q.x + q.w / 2, q.y + q.h / 2 + 1, 'bold 24px sans-serif', '#ffffff', 'middle');
  drawOutlinedText(isTouchHint() ? 'Ťukni na postavu = otočí se · šipky = další' : '← → = další · ↑ nebo klik na postavu = otočit · mezerník = vybrat · Esc = zpět',
    400, 64, 'bold 12px sans-serif', '#ffffff', 'middle');
}
