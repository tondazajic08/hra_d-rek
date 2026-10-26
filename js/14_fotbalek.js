// Minihra stolní fotbal (fotbálek v chodbě před schody)
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// MINIHRA: STOLNÍ FOTBAL – pohled shora na fotbálek. Ty jsi červený (bráníš
// levou branku), soupeř modrý. Všechny tvoje tyče se posouvají najednou,
// kop = panáčci se otočí a míček odpálí. Hraje se do 5 gólů.
//   klávesnice: šipky / W S = posun, mezerník (Enter) = kop;
//               ve dvou: červení W S + mezerník, modří šipky + Enter
//   mobil: táhni prstem nahoru/dolů (ve dvou: každý na své půlce),
//          kope se samo, když panáček míček trefí
// Menu a tlačítka sdílí vzhled se šachy (drawChessButton, chessMenuRows …).
// =====================================================================
const FOOS = {
  FIELD: { x: 80, y: 150, w: 640, h: 360 },   // hřiště na plátně
  GOAL: 116,              // výška branky (px)
  BALL_R: 7,
  FIG_W: 12, FIG_H: 20,   // panáček (z boku na tyči)
  KICK_TIME: 0.18,        // jak dlouho je noha venku (s)
  KICK_COOLDOWN: 0.35,
  KICK_SPEED: 640,        // rychlost míčku po kopu (px/s)
  MAX_SPEED: 900,
  FRICTION: 0.55,         // kolik rychlosti zbude za sekundu
  ROD_SPEED: 2.4,         // jak rychle se tyče posouvají klávesami (celý rozsah / s)
  WIN: 5,                 // do kolika gólů se hraje
  LEVELS: [
    // speed = jak rychle hýbe tyčemi, err = jak moc mine, react = jak rychle si všimne, kam míček letí, kick = jak často kopne
    { id: 'easy',   name: 'Počítač – lehký',   reward: 5,  speed: 1.1, err: 20, react: 4,  kick: 0.45 },
    { id: 'medium', name: 'Počítač – střední', reward: 15, speed: 1.8, err: 10, react: 7,  kick: 0.8 },
    { id: 'hard',   name: 'Počítač – těžký',   reward: 30, speed: 2.6, err: 6,  react: 11, kick: 1 },
    { id: 'two',    name: 'Dva hráči',         reward: 0 },
  ],
  TEAMS: {
    red:  { dir: 1,  body: '#d23b2f', dark: '#8e2119', name: 'Červení' },
    blue: { dir: -1, body: '#2e63c9', dark: '#1b3d80', name: 'Modří' },
  },
};
// Tyče zleva: brankář, obrana, útok soupeře, záloha, záloha soupeře, útok, obrana soupeře, brankář soupeře
const FOOS_RODS = [['red', 1], ['red', 2], ['blue', 3], ['red', 5], ['blue', 5], ['red', 3], ['blue', 2], ['blue', 1]].map(([team, n], i) => {
  const F = FOOS.FIELD;
  const spacing = { 1: 0, 2: 150, 3: 115, 5: 68 }[n];
  return {
    team, n, spacing,
    x: F.x + F.w * (i + 0.5) / 8,
    maxOff: n === 1 ? 52 : F.h / 2 - 22 - (n - 1) / 2 * spacing,   // jak daleko se tyč posune od středu
  };
});

// Panáčci tyče (y středů) při posunu týmu p (−1 … 1)
function foosFigures(rod, p) {
  const cy = FOOS.FIELD.y + FOOS.FIELD.h / 2 + p * rod.maxOff;
  const out = [];
  for (let k = 0; k < rod.n; k++) out.push(cy + (k - (rod.n - 1) / 2) * rod.spacing);
  return out;
}

// --- průběh ---
const FOOS_QUIT_BTN = { x: 12, y: 14, w: 56, h: 44 };   // vlevo nahoře (vpravo je zvuk)
// menu: obtížnosti, dva hráči, online soupeř (jen s databází, 35_online_hry.js) a Odejít (null)
const foosMenuItems = () => [...FOOS.LEVELS, ...(mpReady() ? [DUEL.ROW] : []), null];
const foosMenuRows = () => foosMenuItems().map((_, i) => ({ x: 210, y: 174 + i * 54, w: 380, h: 46 }));
function openFoosball() {
  state.foos = { phase: 'menu', menuSel: 0, keys: [], level: null, fingers: {} };
  input.events.length = 0;
  playSound([[392, 0, 0.06], [523, 0.07, 0.08]]);
  setMusicTrack('foos', true);   // u fotbálku hraje jeho hudba, hlavní se zastaví
  setScreen('foosball');
}

function foosNewGame(level) {
  const f = state.foos;
  f.level = level;
  f.phase = 'play';
  f.score = { red: 0, blue: 0 };
  f.p = { red: 0, blue: 0 };            // posun tyčí obou týmů
  f.vel = { red: 0, blue: 0 };          // rychlost posunu (pro „švih“ do míčku)
  f.kickT = { red: 0, blue: 0 };
  f.kickCd = { red: 0, blue: 0 };
  f.kickN = { red: 0, blue: 0 };        // kolikrát kdo kopl (online soupeř podle toho ukáže kop)
  f.auto = { red: false, blue: false }; // samočinný kop (ovládání prstem)
  f.aiErr = 0; f.aiErrT = 0; f.aiSeenY = FOOS.FIELD.y + FOOS.FIELD.h / 2;
  f.confirmQuit = false;
  f.reward = 0; f.msg = ''; f.overSel = 0;
  foosServe(f, Math.random() < 0.5 ? 'red' : 'blue');
}

// Míček doprostřed, chvilku počká a pak se rozjede k týmu, který dostal gól
function foosServe(f, toward) {
  const F = FOOS.FIELD;
  f.ball = { x: F.x + F.w / 2, y: F.y + F.h / 2, vx: 0, vy: 0 };
  f.serveT = 0.9;
  f.serveDir = FOOS.TEAMS[toward].dir * -1;   // míček jede na polovinu toho týmu
  f.stillT = 0;
}

function foosLeave() {
  const f = state.foos;
  if (f && f.online) duelQuit(f);   // online zápas skončí i u soupeře (35_online_hry.js)
  if (duel.ask) duelCancelAsk();
  state.foos = null;
  setMusicTrack(audio.prevTrack || 'main');   // zpátky, co hrálo předtím (pokračuje, kde skončilo)
  setScreen('playing');
  input.events.length = 0;
  if (f && f.reward) state.toast = { text: `Výhra ve fotbálku! +${f.reward} Kč`, t: CONFIG.TOAST_TIME + 1 };
}

function foosGoal(f, team) {
  f.score[team]++;
  if (f.online) foosOnlineGoal(f, team);   // pošle gól soupeři (35_online_hry.js)
  foosShowGoal(f, team);
}
function foosShowGoal(f, team) {
  playSound([[523, 0, 0.08], [659, 0.09, 0.08], [784, 0.18, 0.16]]);
  if (f.score[team] >= FOOS.WIN) { foosFinish(f, team); return; }
  f.phase = 'goal';
  f.goalT = 1.3;
  f.goalTeam = team;
}

function foosFinish(f, winner) {
  f.phase = 'over';
  f.overSel = 0;
  f.msg2 = f.online ? duelSettle(winner === 'red' ? 'win' : 'lose') : '';   // sázka (35_online_hry.js)
  const s = `${f.score.red}:${f.score.blue}`;
  if (f.level.id === 'two') {
    f.msg = `${FOOS.TEAMS[winner].name} vyhráli ${s}`;
    playSound(CONFIG.SOUND_COMPLETE);
  } else if (f.online) {
    f.msg = winner === 'red' ? `Vyhrál jsi ${s} proti ${duelOppName()}!` : `Prohrál jsi ${s}`;
    playSound(winner === 'red' ? CONFIG.SOUND_COMPLETE : CONFIG.SOUND_MISS);
  } else if (winner === 'red') {
    f.reward = f.level.reward;
    state.money += f.reward;
    saveProgress();
    f.msg = `Vyhrál jsi ${s} a dostal ${f.reward} Kč`;
    playSound(CONFIG.SOUND_COMPLETE);
  } else {
    f.msg = `Prohrál jsi ${s}`;
    playSound(CONFIG.SOUND_MISS);
  }
}

// --- prsty na mobilu: každý prst ovládá tým podle půlky obrazovky ---
function foosFinger(e, down) {
  const f = state.foos;
  if (state.screen !== 'foosball' || !f || f.phase !== 'play' || e.pointerType === 'mouse') return;
  const g = screenToGame(e.clientX, e.clientY);
  if (!g) return;
  if (down) f.fingers[e.pointerId] = { team: f.level.id === 'two' && g.x > CONFIG.WIDTH / 2 ? 'blue' : 'red', y: g.y };
  else if (f.fingers[e.pointerId]) f.fingers[e.pointerId].y = g.y;
}
window.addEventListener('pointerdown', (e) => foosFinger(e, true));
window.addEventListener('pointermove', (e) => foosFinger(e, false));
const foosFingerUp = (e) => { if (state.foos) delete state.foos.fingers[e.pointerId]; };
window.addEventListener('pointerup', foosFingerUp);
window.addEventListener('pointercancel', foosFingerUp);

// --- počítač (modří): posouvá tyče za míčkem a kope, když je míček před panáčkem ---
function foosAi(f, dt) {
  const L = f.level, ball = f.ball;
  // počítač vidí míček se zpožděním (jako člověk) – na rychlou střelu nestihne zareagovat
  f.aiSeenY += (ball.y - f.aiSeenY) * Math.min(1, dt * L.react);
  const seenY = f.aiSeenY + f.aiErr;
  f.aiErrT -= dt;
  if (f.aiErrT <= 0) { f.aiErr = (Math.random() - 0.5) * 2 * L.err; f.aiErrT = 0.5; }
  // tyč, ke které míček nejvíc míří (nejbližší modrá tyč, před kterou míček je)
  let rod = null, bestD = Infinity;
  for (const r of FOOS_RODS) {
    if (r.team !== 'blue') continue;
    const d = Math.abs(r.x - ball.x) + (ball.x > r.x + 20 ? 400 : 0);   // za tyčí už je pozdě
    if (d < bestD) { bestD = d; rod = r; }
  }
  const center = FOOS.FIELD.y + FOOS.FIELD.h / 2;
  let target = f.p.blue, bestMiss = Infinity;
  for (let k = 0; k < rod.n; k++) {
    const slot = (k - (rod.n - 1) / 2) * rod.spacing;
    const off = Math.max(-rod.maxOff, Math.min(rod.maxOff, seenY - center - slot));
    const miss = Math.abs(seenY - center - slot - off);
    if (miss < bestMiss) { bestMiss = miss; target = off / rod.maxOff; }
  }
  const step = L.speed * dt;
  f.p.blue += Math.max(-step, Math.min(step, target - f.p.blue));
  // kop
  if (f.kickCd.blue <= 0) {
    for (const r of FOOS_RODS) {
      if (r.team !== 'blue') continue;
      const ahead = (ball.x - r.x) * FOOS.TEAMS.blue.dir;   // jak daleko je míček před panáčkem
      if (ahead < -6 || ahead > 26) continue;
      if (foosFigures(r, f.p.blue).some((fy) => Math.abs(ball.y - fy) < 16)) {
        if (Math.random() < L.kick) foosKick(f, 'blue');
        else f.kickCd.blue = 0.25;   // tentokrát nekopl
        break;
      }
    }
  }
}

function foosKick(f, team) {
  f.kickT[team] = FOOS.KICK_TIME;
  f.kickCd[team] = FOOS.KICK_COOLDOWN;
  f.kickN[team]++;
}

// Míček narazí do panáčka (obdélník kolem středu fx, fy); při kopu letí k soupeřově brance
function foosHitFigure(f, team, fx, fy) {
  const b = f.ball, T = FOOS.TEAMS[team], r = FOOS.BALL_R;
  const kicking = f.kickT[team] > 0;
  const hw = FOOS.FIG_W / 2, hh = FOOS.FIG_H / 2;
  // při kopu je noha venku směrem k soupeři
  const left = fx - hw - (kicking && T.dir < 0 ? 10 : 0), right = fx + hw + (kicking && T.dir > 0 ? 10 : 0);
  const cx = Math.max(left, Math.min(right, b.x)), cy = Math.max(fy - hh, Math.min(fy + hh, b.y));
  let dx = b.x - cx, dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return;
  let dist = Math.sqrt(d2);
  if (dist < 0.01) { dx = b.x < fx ? -1 : 1; dy = 0; dist = 1; }
  const nx = dx / dist, ny = dy / dist;
  b.x = cx + nx * r; b.y = cy + ny * r;   // vystrčit ven
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
  b.vy += f.vel[team] * 0.5;              // švih tyčí stočí míček
  const inFront = (b.x - fx) * T.dir > -4;
  if (inFront && (kicking || f.auto[team])) {
    b.vx = T.dir * FOOS.KICK_SPEED * (0.9 + Math.random() * 0.2);
    b.vy = (b.y - fy) * 12 + b.vy * 0.3 + (Math.random() - 0.5) * 260;   // střela trochu do strany
    if (!kicking) foosKick(f, team);
    playSound([[180, 0, 0.04]]);
  } else if (Math.abs(b.vx) < 40) {
    b.vx += T.dir * 40;                   // ať se míček u panáčka nezasekne
  }
}

function foosPhysics(f, dt) {
  const F = FOOS.FIELD, b = f.ball, r = FOOS.BALL_R;
  const boss = !f.online || f.own === 'me';   // online o gólu rozhoduje jen ten, kdo míček řídí (35_online_hry.js)
  const steps = 6, h = dt / steps;
  for (let s = 0; s < steps && f.phase === 'play'; s++) {
    b.x += b.vx * h;
    b.y += b.vy * h;
    // mantinely nahoře a dole
    if (b.y < F.y + r) { b.y = F.y + r; b.vy = Math.abs(b.vy) * 0.85; }
    if (b.y > F.y + F.h - r) { b.y = F.y + F.h - r; b.vy = -Math.abs(b.vy) * 0.85; }
    // levá a pravá strana: v brance gól, jinak odraz
    const inGoal = Math.abs(b.y - (F.y + F.h / 2)) < FOOS.GOAL / 2 - r / 2;
    if (b.x < F.x + r) {
      if (inGoal && b.x < F.x - r) { if (boss) foosGoal(f, 'blue'); else { b.vx = 0; b.vy = 0; } return; }
      if (!inGoal) { b.x = F.x + r; b.vx = Math.abs(b.vx) * 0.85; }
    }
    if (b.x > F.x + F.w - r) {
      if (inGoal && b.x > F.x + F.w + r) { if (boss) foosGoal(f, 'red'); else { b.vx = 0; b.vy = 0; } return; }
      if (!inGoal) { b.x = F.x + F.w - r; b.vx = -Math.abs(b.vx) * 0.85; }
    }
    for (const rod of FOOS_RODS) {
      if (Math.abs(b.x - rod.x) > 24) continue;
      for (const fy of foosFigures(rod, f.p[rod.team])) foosHitFigure(f, rod.team, rod.x, fy);
    }
  }
  // tření a omezení rychlosti
  const k = Math.pow(FOOS.FRICTION, dt);
  b.vx *= k; b.vy *= k;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > FOOS.MAX_SPEED) { b.vx *= FOOS.MAX_SPEED / sp; b.vy *= FOOS.MAX_SPEED / sp; }
  // zaseknutý míček: po chvíli ho „někdo postrčí“
  f.stillT = sp < 30 ? f.stillT + dt : 0;
  if (f.stillT > 1.5 && boss) {
    const cx = F.x + F.w / 2, cy = F.y + F.h / 2;
    b.vx = (cx - b.x > 0 ? 1 : -1) * (120 + Math.random() * 80);
    b.vy = (cy - b.y) * 0.8 + (Math.random() - 0.5) * 160;
    f.stillT = 0;
  }
}

function updateFoosball(dt) {
  const f = state.foos;
  const events = input.events.splice(0);
  const keys = f.keys.splice(0);
  const has = (list, k) => KEYMAP[list].includes(k);

  if (f.phase === 'pick' || f.phase === 'wait') { duelPickUpdate(f, 'foos', events, keys); return; }   // online výzva (35_online_hry.js)
  if (f.phase === 'menu') {
    const items = foosMenuItems(), n = items.length;
    for (const k of keys) {
      if (has('up', k)) f.menuSel = (f.menuSel + n - 1) % n;
      if (has('down', k)) f.menuSel = (f.menuSel + 1) % n;
      if (k === 'Escape') { foosLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? f.menuSel : chessHit(foosMenuRows(), ev);
      if (i < 0) continue;
      const item = items[i];
      if (!item) foosLeave();
      else if (item === DUEL.ROW) duelOpenPick(f);
      else foosNewGame(item);
      return;
    }
    return;
  }
  if (f.online) duelPoll(f);   // zprávy od soupeře (35_online_hry.js)
  if (f.phase === 'over') {
    for (const k of keys) {
      if (has('up', k) || has('down', k)) f.overSel = 1 - f.overSel;
      if (k === 'Escape') { foosLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? f.overSel : chessHit(chessOverButtons(), ev);
      if (i === 0 && f.online) { duelOverAgain(f); return; }   // odveta / zpět do menu
      if (i === 0) { f.phase = 'menu'; f.menuSel = Math.max(0, FOOS.LEVELS.indexOf(f.level)); return; }
      if (i === 1) { foosLeave(); return; }
    }
    return;
  }
  if (f.confirmQuit) {   // „Ukončit zápas?“
    let close = keys.includes('Escape');
    for (const ev of events) {
      const i = ev.type === 'action' ? 0 : chessHit(chessConfirmButtons(), ev);
      if (i === 0) { if (f.online) duelQuit(f); f.phase = 'menu'; f.confirmQuit = false; return; }
      if (i === 1) close = true;
    }
    if (close) f.confirmQuit = false;
    if (!f.online) return;   // online se zápas nedá pozastavit – běží dál
    keys.length = 0;         // mezerník patřil oknu, ne kopu
  } else {
    if (keys.includes('Escape')) { f.confirmQuit = true; return; }
    // tlačítko ✕ vlevo nahoře (na mobilu jediná cesta ven ze zápasu)
    if (events.some((ev) => ev.x != null && pointInRect(ev.x, ev.y, FOOS_QUIT_BTN, 6))) { f.confirmQuit = true; f.fingers = {}; return; }
  }

  // --- zápas ---
  const two = f.level.id === 'two';
  // kop: klávesy (mezerník / Enter); na mobilu se kope samo
  for (const k of keys) {
    const team = two ? (k === 'Space' ? 'red' : k === 'Enter' || k === 'NumpadEnter' ? 'blue' : null)
      : (CONFIG.ACTION_KEYS.includes(k) ? 'red' : null);
    if (team && f.kickCd[team] <= 0) foosKick(f, team);
  }
  // posun tyčí: klávesy nebo prst
  const before = { ...f.p };
  const keyTeam = (team, up, down) => {
    const d = (down.some((c) => input.keys.has(c)) ? 1 : 0) - (up.some((c) => input.keys.has(c)) ? 1 : 0);
    if (d) { f.p[team] += d * FOOS.ROD_SPEED * dt; f.auto[team] = false; }
  };
  if (two) {
    keyTeam('red', ['KeyW'], ['KeyS']);
    keyTeam('blue', ['ArrowUp'], ['ArrowDown']);
  } else {
    keyTeam('red', KEYMAP.up, KEYMAP.down);
  }
  for (const finger of Object.values(f.fingers)) {
    const F = FOOS.FIELD;
    const target = (finger.y - F.y - F.h / 2) / (F.h / 2 - 22);
    const step = 6 * dt;
    f.p[finger.team] += Math.max(-step, Math.min(step, target - f.p[finger.team]));
    f.auto[finger.team] = true;
  }
  if (f.online) foosOnlineOpp(f, dt);   // soupeřovy tyče podle sítě (35_online_hry.js)
  else if (!two) foosAi(f, dt);
  for (const team of ['red', 'blue']) {
    f.p[team] = Math.max(-1, Math.min(1, f.p[team]));
    f.vel[team] = (f.p[team] - before[team]) / dt * 60;   // px/s (přibližně, pro švih)
    f.kickT[team] = Math.max(0, f.kickT[team] - dt);
    f.kickCd[team] = Math.max(0, f.kickCd[team] - dt);
  }

  if (f.phase === 'goal') {
    f.goalT -= dt;
    if (f.goalT <= 0) { f.phase = 'play'; foosServe(f, f.goalTeam === 'red' ? 'blue' : 'red'); }
    return;
  }
  if (f.serveT > 0) {   // výkop: míček se po chvilce rozjede
    f.serveT -= dt;
    // online rozjede míček jen ten, kdo ho řídí (druhý ho uvidí ze sítě)
    if (f.serveT <= 0 && (!f.online || f.own === 'me')) { f.ball.vx = f.serveDir * (140 + Math.random() * 60); f.ball.vy = (Math.random() - 0.5) * 200; }
    return;
  }
  foosPhysics(f, dt);
  if (f.online) foosOnlineAfter(f);   // míček u soupeřovy tyče → předat (35_online_hry.js)
}

// --- kreslení ---
function drawFoosFigure(team, x, y, kick) {
  const T = FOOS.TEAMS[team];
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 8, 11, 0, 0, Math.PI * 2); ctx.fill();
  if (kick > 0) {   // noha venku směrem k soupeři
    ctx.fillStyle = T.dark;
    ctx.fillRect(T.dir > 0 ? x : x - 16, y - 3, 16, 6);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(T.dir > 0 ? x + 13 : x - 16, y - 3, 3, 6);
  }
  ctx.fillStyle = T.body;   // ramena a tělo
  ctx.beginPath(); ctx.ellipse(x, y, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.dark; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#f0c6a2';   // hlava
  ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2a1c';   // vlasy
  ctx.beginPath(); ctx.arc(x - T.dir * 1.2, y, 3.2, 0, Math.PI * 2); ctx.fill();
}

function renderFoosball() {
  const f = state.foos, F = FOOS.FIELD, W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  // pozadí: dlaždice chodby před schody
  ctx.fillStyle = '#e2b8a2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(143, 62, 62, 0.35)';
  for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);
  // skříň stolu
  drawRect({ x: F.x - 34, y: F.y - 34, w: F.w + 68, h: F.h + 68 }, '#151517');
  drawRect({ x: F.x - 26, y: F.y - 26, w: F.w + 52, h: F.h + 52 }, '#2a2a2e');
  // hřiště: pruhy trávy, čáry, branky
  for (let i = 0; i < 10; i++) drawRect({ x: F.x + i * F.w / 10, y: F.y, w: F.w / 10 + 1, h: F.h }, i % 2 ? '#2f8a3e' : '#2a7f38');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(F.x + 1, F.y + 1, F.w - 2, F.h - 2);
  ctx.beginPath(); ctx.moveTo(F.x + F.w / 2, F.y); ctx.lineTo(F.x + F.w / 2, F.y + F.h); ctx.stroke();
  ctx.beginPath(); ctx.arc(F.x + F.w / 2, F.y + F.h / 2, 46, 0, Math.PI * 2); ctx.stroke();
  const gy = F.y + F.h / 2 - FOOS.GOAL / 2;
  for (const side of [0, 1]) {
    const x = side ? F.x + F.w - 70 : F.x;
    ctx.strokeRect(x + (side ? 0 : 1), gy - 30, 70, FOOS.GOAL + 60);
    drawRect({ x: side ? F.x + F.w : F.x - 22, y: gy, w: 22, h: FOOS.GOAL }, '#0c0c0e');   // branka
    drawRect({ x: side ? F.x + F.w : F.x - 22, y: gy, w: 22, h: 3 }, '#d9d9d9');
    drawRect({ x: side ? F.x + F.w : F.x - 22, y: gy + FOOS.GOAL - 3, w: 22, h: 3 }, '#d9d9d9');
  }
  const p = f.p || { red: 0, blue: 0 };
  const ball = f.ball;
  if (ball) {   // míček (pod tyčemi)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath(); ctx.arc(ball.x + 3, ball.y + 3, FOOS.BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6f6f2';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, FOOS.BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(ball.x - 1, ball.y - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  // tyče s rukojetmi (červení dole, modří nahoře) a panáčci
  for (const rod of FOOS_RODS) {
    const red = rod.team === 'red';
    drawRect({ x: rod.x - 2, y: F.y - 34, w: 4, h: F.h + 68 }, '#c9ccd0');
    drawRect({ x: rod.x - 2, y: F.y - 34, w: 1.5, h: F.h + 68 }, '#eef0f2');
    const hy = red ? F.y + F.h + 34 : F.y - 34 - 30;
    drawRect({ x: rod.x - 6, y: hy, w: 12, h: 30 }, '#151517');
    drawRect({ x: rod.x - 6, y: red ? hy + 24 : hy, w: 12, h: 6 }, FOOS.TEAMS[rod.team].body);
    for (const fy of foosFigures(rod, p[rod.team])) drawFoosFigure(rod.team, rod.x, fy, f.kickT ? f.kickT[rod.team] : 0);
  }
  // skóre
  if (f.level) {
    const two = f.level.id === 'two', opp = f.online ? duelOppName() : 'Počítač';
    roundRectPath(W / 2 - 170, 8, 340, 70, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
    drawOutlinedText(`${f.score.red} : ${f.score.blue}`, W / 2, 36, 'bold 34px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(two ? 'Červení' : 'Ty', W / 2 - 110, 36, 'bold 18px sans-serif', '#ff7a6e', 'middle');
    drawOutlinedText(two ? 'Modří' : opp, W / 2 + 112, 36, 'bold 18px sans-serif', '#7aa6ff', 'middle');
    drawOutlinedText(`${f.level.name} · do ${FOOS.WIN} gólů`, W / 2, 64, 'bold 12px sans-serif', '#e8e0d0', 'middle');
    const hint = isTouchHint()
      ? (two ? 'Každý táhne prstem na své půlce · kope se samo' : 'Táhni prstem nahoru a dolů · kope se samo')
      : (two ? 'Červení: W S + mezerník · Modří: šipky + Enter · Esc = konec' : 'Šipky nahoru/dolů = tyče · mezerník = kop · Esc = konec');
    drawOutlinedText(hint, W / 2, 582, 'bold 13px sans-serif', '#ffffff', 'middle');
    if (f.phase === 'play' || f.phase === 'goal') {   // ✕ = ukončit zápas (hlavně pro mobil)
      const q = FOOS_QUIT_BTN;
      roundRectPath(q.x, q.y, q.w, q.h, 10);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      drawOutlinedText('✕', q.x + q.w / 2, q.y + q.h / 2 + 1, 'bold 24px sans-serif', '#ffffff', 'middle');
    }
  }
  if (f.phase === 'goal') {
    drawOutlinedText('GÓÓÓL!', W / 2, F.y + F.h / 2 - 20, 'bold 56px sans-serif', '#ffd54a', 'middle');
    drawOutlinedText(f.online ? (f.goalTeam === 'red' ? 'Dal jsi gól' : `${duelOppName()} dal gól`) : FOOS.TEAMS[f.goalTeam].name + ' dali gól', W / 2, F.y + F.h / 2 + 30, 'bold 20px sans-serif', '#ffffff', 'middle');
  } else if (f.phase === 'play' && f.serveT > 0) {
    drawOutlinedText('Výkop…', W / 2, F.y + F.h / 2 - 40, 'bold 24px sans-serif', '#ffffff', 'middle');
  }

  if (f.phase === 'menu') {
    drawChessBox(180, 110, 440, 420);
    drawOutlinedText('Fotbálek – vyber soupeře', 400, 150, 'bold 24px sans-serif', '#ffd54a', 'middle');
    const rows = foosMenuRows();
    foosMenuItems().forEach((l, i) => {
      const label = l ? l.name + (l.reward ? `  ·  výhra +${l.reward} Kč` : '') : 'Odejít';
      drawChessButton(rows[i], label, i === f.menuSel, !l ? '#5a4636' : l === DUEL.ROW ? '#2f5a7a' : '#3d5f3a');
    });
    drawDuelNote(92);   // „Bob neodpovídá“ (35_online_hry.js)
  } else if (f.phase === 'pick' || f.phase === 'wait') {
    drawDuelPick(f, 'foos');   // výběr soupeře online (35_online_hry.js)
  } else if (f.phase === 'over') {
    drawChessBox(200, 200, 400, 250);
    drawOutlinedText(f.msg, 400, 252, 'bold 22px sans-serif', f.reward || f.level.id === 'two' ? '#ffd54a' : '#ffffff', 'middle');
    if (f.msg2) drawOutlinedText(f.msg2, 400, 284, 'bold 16px sans-serif', '#ffd54a', 'middle');
    chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? (f.online ? duelOverLabel(f) : 'Hrát znovu') : 'Odejít', i === f.overSel));
  } else if (f.confirmQuit) {
    drawChessBox(200, 220, 400, 170);
    drawOutlinedText('Ukončit zápas?', 400, 270, 'bold 24px sans-serif', '#ffffff', 'middle');
    const [yes, no] = chessConfirmButtons();
    drawChessButton(yes, 'Ano, ukončit', !isTouchHint(), '#7a2a20');
    drawChessButton(no, 'Ne, hrát dál', false);
  }
}
