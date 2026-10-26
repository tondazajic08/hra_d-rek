// Bacha na Láďu – hororová ukázka z první osoby (raycasting) v Hlavní chodbě a západním křídle
// Část hry Dárek – načítá se v index.html po 38_among_extra.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// BACHA NA LÁĎU (mód v 🎮 Módy, obrazovka 'horor'). Je noc, Roman zůstal zamčený ve škole
// a po chodbách chodí Láďa. Najdi 3 klíče a uteč hlavním vchodem (dole ve vstupní chodbě).
// - 3D pohled jako ve starých hrách (raycasting): z opravdových zdí, dveří a nábytku
//   spojené chodby (díly HOROR.PARTS) se udělá mřížka po 10 px, pro každý sloupec
//   obrazovky se „vystřelí paprsek“ a podle vzdálenosti se nakreslí zeď. Tma a baterka.
// - Láďa (hlava z fotky) chodí po chodbách, když tě uvidí (nebo uslyší běžet), honí tě;
//   když tě ztratí, jde, kde tě viděl naposledy. Když tě chytí: jumpscare.
// - Po 2. klíči zhasnou světla a Láďa se objeví za tebou (naháněčka).
// - Zvuky se tvoří přímo ve hře (Web Audio): hučení, Láďovy kroky (hlasitost a strana podle
//   toho, kde je), tlukot srdce, když je blízko, výkřik.
// Ovládání: W S / ↑ ↓ = dopředu / dozadu, A D / ← → = do stran, myš = otáčení (klikni do hry,
//   nebo táhni se zmáčknutým tlačítkem), Shift = běh (dojde dech), Esc = pauza.
//   Mobil: joystick vlevo, tažení vpravo = otáčení.
// Barvy podle fotek (fotky/chodba za hlavním vchodem, chodba za venkovní učebnou): Hlavní chodba
//   a křídla bílé / světle modrošedé zdi s černou lištou, bílé sloupy, tmavé teraco; vstupní chodba
//   okrová se světlými rámy, šedým pruhem, červeným soklem a modrým kobercem.
// =====================================================================
const HOROR = {
  PARTS: ['hlavni', 'zapad', 'vstup'],   // kde se hraje (díly ROOMS.chodba)
  CELL: 10, NAV: 20,                     // mřížka pro paprsky / pro Láďovo hledání cesty
  FOV: Math.PI / 2.8,
  COL_W: 4,                              // px sloupce obrazovky na jeden paprsek
  WALL_H: 130, EYE: 62,                  // výška zdi a očí (px světa)
  SPEED: 120, RUN: 195, STAMINA: 3.2,    // chůze, běh (px/s), dech na běh (s)
  MOUSE: 0.0026, TOUCH_TURN: 0.009,     // otáčení myší / prstem
  RADIUS: 11,
  LIGHT: 430,                            // dosvit baterky (px)
  LADA: { WALK: 72, RUN: 172, SEE: 520, HEAR: 260, CATCH: 30, LOSE: 4, HEIGHT: 118 },
  KEYS: 3,
  START: { x: 1140, y: 2010, a: -Math.PI / 2 },   // dole v Hlavní chodbě u vstupu
};
// Barvy podle dílu chodby (RGB): zeď nahoře, zeď dole, pruh / lišta, podlaha, strop
const HOROR_STYLE = {
  hlavni: { top: [228, 234, 240], low: [205, 216, 228], band: [40, 40, 44], bandH: 6, lowH: 52, floor: [74, 76, 78], ceil: [235, 238, 242] },
  zapad: { top: [228, 234, 240], low: [205, 216, 228], band: [40, 40, 44], bandH: 6, lowH: 52, floor: [74, 76, 78], ceil: [235, 238, 242] },
  vstup: { top: [226, 160, 72], low: [178, 82, 60], band: [176, 186, 190], bandH: 8, lowH: 46, floor: [44, 74, 104], ceil: [240, 232, 214], panel: [238, 222, 186] },
};
const HOROR_FURNITURE = {   // nábytek: barva a výška (px světa); null = neviditelná zábrana (jako zeď)
  pillar: { c: [240, 242, 246], h: 130 }, chairrow: { c: [40, 90, 180], h: 46 }, chair: { c: [40, 90, 180], h: 46 },
  lowtable: { c: [150, 112, 70], h: 36 }, void: null,
};
let HOROR_MAP = null;
state.horor = null;

// --- Mapa: mřížka z místnosti (0 volno, 1 zeď, 2 nábytek, 3 mimo hru, 4 dveře) ---
function hororMap() {
  if (HOROR_MAP) return HOROR_MAP;
  const room = ROOMS.chodba, C = HOROR.CELL, W = Math.ceil(room.w / C), H = Math.ceil(room.h / C);
  const g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = room.x + (i + 0.5) * C, y = room.y + (j + 0.5) * C;
    g[j * W + i] = HOROR.PARTS.includes(amongPartAt(room, x, y)) ? 0 : 3;
  }
  const fill = (r, v) => {
    const i0 = Math.max(0, Math.floor((r.x - room.x) / C)), i1 = Math.min(W - 1, Math.ceil((r.x + r.w - room.x) / C) - 1);
    const j0 = Math.max(0, Math.floor((r.y - room.y) / C)), j1 = Math.min(H - 1, Math.ceil((r.y + r.h - room.y) / C) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (g[j * W + i] !== 3 || v === 4) g[j * W + i] = v;
  };
  roomWalls(room).forEach((r) => fill(r, 1));
  const obst = new Int16Array(W * H).fill(-1);   // který nábytek je v buňce (barva, výška)
  room.obstacles.forEach((o, k) => {
    const f = HOROR_FURNITURE[o.kind];
    fill(o.rect, f === null ? 1 : 2);
    if (f === null) return;
    for (let j = Math.max(0, Math.floor((o.rect.y - room.y) / C)); j <= Math.min(H - 1, Math.ceil((o.rect.y + o.rect.h - room.y) / C) - 1); j++)
      for (let i = Math.max(0, Math.floor((o.rect.x - room.x) / C)); i <= Math.min(W - 1, Math.ceil((o.rect.x + o.rect.w - room.x) / C) - 1); i++) obst[j * W + i] = k;
  });
  room.doors.forEach((d) => fill(d, 4));
  // navigační mřížka pro Láďu: volno i s okrajem (aby se nezasekl o rohy)
  const N = HOROR.NAV, NW = Math.ceil(room.w / N), NH = Math.ceil(room.h / N), nav = new Uint8Array(NW * NH);
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
    const cx = room.x + (i + 0.5) * N, cy = room.y + (j + 0.5) * N;
    nav[j * NW + i] = hororFree({ room, W, H, g, C }, cx, cy, 13) ? 1 : 0;
  }
  const exit = room.doors.find((d) => d.to === 'venku');
  return (HOROR_MAP = { room, W, H, g, C, NW, NH, nav, obst, exit: { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 } });
}
function hororCell(M, x, y) {
  const i = Math.floor((x - M.room.x) / M.C), j = Math.floor((y - M.room.y) / M.C);
  return i < 0 || j < 0 || i >= M.W || j >= M.H ? 3 : M.g[j * M.W + i];
}
function hororFree(M, x, y, r) {
  return !hororCell(M, x - r, y - r) && !hororCell(M, x + r, y - r) && !hororCell(M, x - r, y + r) && !hororCell(M, x + r, y + r)
    && !hororCell(M, x, y) && !hororCell(M, x - r, y) && !hororCell(M, x + r, y) && !hororCell(M, x, y - r) && !hororCell(M, x, y + r);
}
// Paprsek (DDA po mřížce): vzdálenost ke zdi, druh zdi, strana a kde do ní narazil
function hororCast(M, x, y, ang, max) {
  const C = M.C, px = (x - M.room.x) / C, py = (y - M.room.y) / C, dx = Math.cos(ang), dy = Math.sin(ang);
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  let sx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sy = (dy < 0 ? py - my : my + 1 - py) * ddy, side = 0, t = 0;
  for (let k = 0; k < 600; k++) {
    if (sx < sy) { t = sx; sx += ddx; mx += stepX; side = 0; } else { t = sy; sy += ddy; my += stepY; side = 1; }
    if (t * C > max) return { dist: max, type: 0 };
    if (mx < 0 || my < 0 || mx >= M.W || my >= M.H) return { dist: t * C, type: 3, side, u: 0 };
    const v = M.g[my * M.W + mx];
    if (v) {
      const bx = M.room.x + (px + dx * (t - 0.08)) * C, by = M.room.y + (py + dy * (t - 0.08)) * C;   // kousek před zdí: z jakého dílu se dívám
      return { dist: t * C, type: v, side, u: side ? px + dx * t : py + dy * t, cell: my * M.W + mx, part: amongPartAt(M.room, bx, by) };
    }
  }
  return { dist: max, type: 0 };
}
const hororDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hororAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));   // na −π…π

// --- Zvuky (Web Audio, nic se nestahuje) ---
const hororSnd = { drone: null };
const hororAC = () => (audio.muted ? null : audio.ctx);
function hororPan(c, pan, node) {
  if (!c.createStereoPanner) return node;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan || 0));
  node.connect(p);
  return p;
}
function hororTone(freq, dur, type, gain, pan, to, delay) {
  const c = hororAC();
  if (!c) return;
  try {
    const t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); hororPan(c, pan, g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) { /* bez zvuku */ }
}
function hororNoise(dur, freq, gain, pan, delay) {
  const c = hororAC();
  if (!c) return;
  try {
    const t0 = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.value = gain;
    s.connect(f); f.connect(g); hororPan(c, pan, g).connect(c.destination);
    s.start(t0);
  } catch (e) { /* bez zvuku */ }
}
function hororDrone(on) {
  const c = audio.ctx;
  if (hororSnd.drone) { try { hororSnd.drone.forEach((n) => n.stop && n.stop()); } catch (e) { /* už stojí */ } hororSnd.drone = null; }
  if (!on || !c || audio.muted) return;
  try {
    const g = c.createGain();
    g.gain.value = 0.035;
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 52; o2.type = 'triangle'; o2.frequency.value = 55.5;
    o1.connect(g); o2.connect(g); g.connect(c.destination);
    o1.start(); o2.start();
    hororSnd.drone = [o1, o2];
  } catch (e) { /* bez zvuku */ }
}
const hororScream = () => {
  hororNoise(1.3, 1100, 0.9, 0);
  hororTone(880, 1.2, 'sawtooth', 0.25, 0, 180);
  hororTone(660, 1.0, 'square', 0.15, 0, 140, 0.05);
};
const hororSting = () => { [311, 330, 466].forEach((f) => hororTone(f, 1.1, 'sawtooth', 0.09, 0, f * 0.97)); hororNoise(0.6, 300, 0.4, 0); };

// --- Začátek, konec ---
function openHoror() {
  const M = hororMap(), p = { ...HOROR.START };
  // klíče: náhodná volná místa daleko od startu a od sebe (2 v západním křídle, 1 kdekoli)
  const cells = [];
  for (let j = 0; j < M.NH; j++) for (let i = 0; i < M.NW; i++) if (M.nav[j * M.NW + i]) {
    const x = M.room.x + (i + 0.5) * HOROR.NAV, y = M.room.y + (j + 0.5) * HOROR.NAV;
    cells.push({ x, y, part: amongPartAt(M.room, x, y) });
  }
  const keys = [];
  for (let k = 0; k < HOROR.KEYS; k++) {
    const pool = cells.filter((c) => (k < 2 ? c.part === 'zapad' : c.part !== 'vstup') && hororDist(c, p) > 380 && keys.every((q) => hororDist(c, q) > 320));
    const c = pool[Math.floor(Math.random() * pool.length)] || cells[0];
    keys.push({ x: c.x, y: c.y, got: false });
  }
  // Láďa začíná co nejdál od hráče (v západním křídle)
  const far = cells.filter((c) => c.part === 'zapad').sort((a, b) => hororDist(b, p) - hororDist(a, p))[0];
  state.horor = {
    phase: 'intro', t: 0, p, keys, got: 0, stamina: HOROR.STAMINA, bob: 0, walk: 0,
    lada: { x: far.x, y: far.y, a: 0, mode: 'patrol', path: [], pathT: 0, lostT: 0, seen: null, stepT: 0 },
    flicker: 1, dark: 0, msg: '', msgT: 0, caughtT: 0, overSel: 0, turnPtr: null, beatT: 0, scared: false,
  };
  if (audio.track !== 'horor') hororSnd.prevTrack = audio.track;   // „Zkusit znovu“ nesmí přepsat hudbu, ke které se vrátí
  audio.track = 'horor';   // žádná hudba, jen zvuky hororu
  updateMusic();
  input.events.length = 0;
  setScreen('horor');
}
function hororBegin() {
  const H = state.horor;
  H.phase = 'play'; H.t = 0;
  hororDrone(true);
  hororLock();
}
function hororLeave() {
  hororDrone(false);
  if (document.pointerLockElement) document.exitPointerLock();
  audio.track = hororSnd.prevTrack || 'main';
  updateMusic();
  state.horor = null;
  goToTitle();
}
function hororLock() {   // myš otáčí pohledem (jen počítač)
  if (isTouchHint() || document.pointerLockElement || !canvas.requestPointerLock) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* nejde */ }
}
document.addEventListener('pointerlockchange', () => {
  const H = state.horor;
  if (H && H.phase === 'play' && !document.pointerLockElement && state.screen === 'horor') { H.phase = 'pause'; H.pauseT = 0; }   // Esc uvolní myš → pauza
});
window.addEventListener('mousemove', (e) => {
  const H = state.horor;
  if (!H || H.phase !== 'play') return;
  // zamčená myš, nebo (když zamknout nejde) tažení se zmáčknutým tlačítkem
  if (document.pointerLockElement === canvas || e.buttons) H.p.a += e.movementX * HOROR.MOUSE;
});
// mobil: tažení prstem vpravo = otáčení
window.addEventListener('pointerdown', (e) => {
  const H = state.horor;
  if (!H || state.screen !== 'horor' || e.pointerType === 'mouse' || e.clientX <= window.innerWidth * CONFIG.JOY_ZONE_WIDTH) return;
  H.turnPtr = { id: e.pointerId, x: e.clientX };
});
window.addEventListener('pointermove', (e) => {
  const H = state.horor;
  if (!H || !H.turnPtr || e.pointerId !== H.turnPtr.id) return;
  if (H.phase === 'play') H.p.a += (e.clientX - H.turnPtr.x) * HOROR.TOUCH_TURN;
  H.turnPtr.x = e.clientX;
});
const hororPtrEnd = (e) => { const H = state.horor; if (H && H.turnPtr && e.pointerId === H.turnPtr.id) H.turnPtr = null; };
window.addEventListener('pointerup', hororPtrEnd);
window.addEventListener('pointercancel', hororPtrEnd);
const hororKeys = [];
window.addEventListener('keydown', (e) => { if (state.screen === 'horor' && !e.repeat) hororKeys.push(e.code); });
function hororSay(text, t) { const H = state.horor; H.msg = text; H.msgT = t || 3; }

// --- Láďa: hledání cesty (BFS po navigační mřížce) ---
function hororPath(M, from, to) {
  const N = HOROR.NAV, idx = (p) => Math.floor((p.y - M.room.y) / N) * M.NW + Math.floor((p.x - M.room.x) / N);
  let s = idx(from), goal = idx(to);
  if (!M.nav[goal]) {   // cíl ve zdi: nejbližší volná buňka
    let best = -1, bd = Infinity;
    const gi = goal % M.NW, gj = Math.floor(goal / M.NW);
    for (let j = gj - 3; j <= gj + 3; j++) for (let i = gi - 3; i <= gi + 3; i++) {
      if (i < 0 || j < 0 || i >= M.NW || j >= M.NH || !M.nav[j * M.NW + i]) continue;
      const d = Math.hypot(i - gi, j - gj);
      if (d < bd) { bd = d; best = j * M.NW + i; }
    }
    if (best < 0) return [];
    goal = best;
  }
  const prev = new Int32Array(M.NW * M.NH).fill(-1), q = [s];
  prev[s] = s;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === goal) break;
    const ci = c % M.NW;
    for (const [d, ok] of [[1, ci < M.NW - 1], [-1, ci > 0], [M.NW, true], [-M.NW, true]]) {
      const n = c + d;
      if (!ok || n < 0 || n >= M.nav.length || prev[n] >= 0 || !M.nav[n]) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[goal] < 0) return [];
  const path = [];
  for (let c = goal; c !== s; c = prev[c]) path.push({ x: M.room.x + (c % M.NW + 0.5) * N, y: M.room.y + (Math.floor(c / M.NW) + 0.5) * N });
  return path.reverse();
}
function hororSees(M, L, p) {   // vidí Láďa hráče? (nic mezi nimi)
  const d = hororDist(L, p);
  if (d > HOROR.LADA.SEE) return false;
  const hit = hororCast(M, L.x, L.y, Math.atan2(p.y - L.y, p.x - L.x), d);
  return hit.dist >= d - 4;
}
function hororLada(H, M, dt) {
  const L = H.lada, p = H.p, d = hororDist(L, p), cfg = HOROR.LADA;
  const facing = Math.abs(hororAngle(Math.atan2(p.y - L.y, p.x - L.x) - L.a)) < 1.3;
  const sees = hororSees(M, L, p) && (facing || d < 170 || L.mode === 'chase' || (H.running && d < cfg.HEAR));
  if (sees) {
    if (L.mode !== 'chase') { hororSting(); hororSay('Láďa tě vidí! UTÍKEJ!', 2.5); }
    L.mode = 'chase'; L.seen = { x: p.x, y: p.y }; L.lostT = 0;
  } else if (L.mode === 'chase') {
    L.lostT += dt;
    if (L.lostT > cfg.LOSE) { L.mode = 'search'; L.path = hororPath(M, L, L.seen); }
  }
  L.pathT -= dt;
  if (L.mode === 'chase' && L.pathT <= 0) { L.path = hororPath(M, L, p); L.pathT = 0.35; }
  if (!L.path.length) {
    if (L.mode === 'search') L.mode = 'patrol';
    // procházka: náhodné místo v hratelné části
    for (let k = 0; k < 30 && !L.path.length; k++) {
      const i = Math.floor(Math.random() * M.NW), j = Math.floor(Math.random() * M.NH);
      if (M.nav[j * M.NW + i]) L.path = hororPath(M, L, { x: M.room.x + (i + 0.5) * HOROR.NAV, y: M.room.y + (j + 0.5) * HOROR.NAV });
    }
  }
  const speed = L.mode === 'chase' ? cfg.RUN : cfg.WALK;
  let move = speed * dt;
  while (move > 0 && L.path.length) {
    const t = L.path[0], dx = t.x - L.x, dy = t.y - L.y, dd = Math.hypot(dx, dy);
    L.a = Math.atan2(dy, dx);
    if (dd <= move) { L.x = t.x; L.y = t.y; L.path.shift(); move -= dd; }
    else { L.x += dx / dd * move; L.y += dy / dd * move; move = 0; }
  }
  // kroky: hlasitost a strana podle polohy vůči hráči
  L.stepT -= dt;
  if (L.stepT <= 0) {
    L.stepT = L.mode === 'chase' ? 0.3 : 0.55;
    if (d < 700) {
      const rel = hororAngle(Math.atan2(L.y - p.y, L.x - p.x) - p.a);
      hororNoise(0.09, 140, Math.min(0.9, 60 / Math.max(40, d)) * 1.4, Math.sin(rel));
    }
  }
  if (d < cfg.CATCH) hororCaught(H);
}
function hororCaught(H) {
  H.phase = 'caught'; H.caughtT = 0; H.overSel = 0;
  hororDrone(false);
  hororScream();
  if (document.pointerLockElement) document.exitPointerLock();
}

// --- Krok hry ---
function updateHoror(dt) {
  const H = state.horor, M = hororMap(), keys = hororKeys.splice(0), events = input.events.splice(0);
  if (!H) return;
  H.t += dt;
  if (H.msgT > 0) H.msgT -= dt;
  const tapped = events.some((e) => e.type === 'action' || (e.x != null && !e.inJoyZone));
  if (H.phase === 'intro') {
    if (keys.includes('Escape')) { hororLeave(); return; }
    if (tapped && H.t > 0.4) hororBegin();
    return;
  }
  if (H.phase === 'pause') {
    H.pauseT = (H.pauseT || 0) + dt;   // Esc, který uvolnil myš, ještě neodchází
    if ((keys.includes('Escape') && H.pauseT > 0.5) || keys.includes('KeyQ')) { hororLeave(); return; }
    if (tapped) { H.phase = 'play'; H.pauseT = 0; hororLock(); }
    return;
  }
  if (H.phase === 'caught' || H.phase === 'win') {
    H.caughtT += dt;
    if (H.caughtT < 1.6) return;
    for (const e of events) {
      const i = e.type === 'action' ? H.overSel : chessHit(chessOverButtons(), e);
      if (i === 0) { openHoror(); hororBegin(); return; }
      if (i === 1) { hororLeave(); return; }
    }
    for (const k of keys) {
      if (KEYMAP.up.includes(k) || KEYMAP.down.includes(k)) H.overSel = 1 - H.overSel;
      if (k === 'Escape') { hororLeave(); return; }
    }
    return;
  }
  if (keys.includes('Escape')) { H.phase = 'pause'; H.pauseT = 0; if (document.pointerLockElement) document.exitPointerLock(); return; }
  if (events.some((e) => e.x != null && !e.inJoyZone && !document.pointerLockElement && !isTouchHint())) hororLock();
  // pohyb
  const p = H.p, k = (c) => input.keys.has(c);
  let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);   // šipky = do stran, otáčí myš
  const j = input.joy;
  if (j.active && Math.hypot(j.dx, j.dy) > CONFIG.JOY_DEADZONE) { fwd = -j.dy; side = j.dx; }
  const len = Math.hypot(fwd, side);
  const wantRun = (k('ShiftLeft') || k('ShiftRight') || (j.active && Math.hypot(j.dx, j.dy) > 0.95)) && len > 0;
  H.running = wantRun && H.stamina > 0.05;
  H.stamina = H.running ? Math.max(0, H.stamina - dt) : Math.min(HOROR.STAMINA, H.stamina + dt * 0.6);
  if (len > 0) {
    const sp = (H.running ? HOROR.RUN : HOROR.SPEED) * dt / Math.max(1, len);
    const mx = (Math.cos(p.a) * fwd - Math.sin(p.a) * side) * sp, my = (Math.sin(p.a) * fwd + Math.cos(p.a) * side) * sp;
    if (hororFree(M, p.x + mx, p.y, HOROR.RADIUS)) p.x += mx;
    if (hororFree(M, p.x, p.y + my, HOROR.RADIUS)) p.y += my;
    H.walk += dt * (H.running ? 13 : 8);
  }
  H.bob = Math.sin(H.walk) * (len > 0 ? (H.running ? 6 : 3) : 0);
  // klíče
  for (const key of H.keys) {
    if (key.got || hororDist(key, p) > 34) continue;
    key.got = true; H.got++;
    hororTone(988, 0.15, 'triangle', 0.25); hororTone(1319, 0.3, 'triangle', 0.2, 0, 0, 0.12);
    hororSay(H.got < HOROR.KEYS ? `🔑 Klíč ${H.got}/${HOROR.KEYS}` : '🔑 Máš všechny klíče! Uteč hlavním vchodem (dole ve vstupní chodbě)!', 3.5);
    if (H.got === 2 && !H.scared) hororScare(H, M);   // naháněčka
  }
  // východ
  if (hororDist(M.exit, p) < 50) {
    if (H.got >= HOROR.KEYS) { H.phase = 'win'; H.winT = H.t; H.caughtT = 0; H.overSel = 0; hororDrone(false); if (document.pointerLockElement) document.exitPointerLock(); hororTone(523, 0.2, 'triangle', 0.3); hororTone(784, 0.4, 'triangle', 0.3, 0, 0, 0.2); return; }
    if (H.msgT <= 0) hororSay(`Zamčeno. Najdi klíče (${H.got}/${HOROR.KEYS}).`, 2);
  }
  // světla: blikají, když je Láďa blízko; po naháněčce chvíli tma
  const dl = hororDist(H.lada, p);
  if (H.dark > 0) { H.dark -= dt; H.flicker = H.dark > 0 ? 0.05 : 1; }
  else if (dl < 450 && Math.random() < dt * 3) H.flicker = 0.25 + Math.random() * 0.5;
  else H.flicker += (1 - H.flicker) * Math.min(1, dt * 6);
  // srdce, když je blízko
  H.beatT -= dt;
  if (dl < 320 && H.beatT <= 0) {
    H.beatT = 0.35 + dl / 320 * 0.6;
    hororTone(60, 0.12, 'sine', 0.35); hororTone(55, 0.12, 'sine', 0.3, 0, 0, 0.16);
  }
  hororLada(H, M, dt);
}
// Po 2. klíči: zhasne, zasyčí a Láďa je za tebou
function hororScare(H, M) {
  H.scared = true;
  H.dark = 1.6;
  hororSting();
  const p = H.p;
  // za zády (různé úhly a vzdálenosti), jinak kdekoli blízko mimo zorné pole
  let spot = null;
  for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
    for (const r of [220, 260, 180, 300, 150, 340]) {
      const x = p.x - Math.cos(p.a + da) * r, y = p.y - Math.sin(p.a + da) * r;
      if (hororFree(M, x, y, 13) && hororPath(M, { x, y }, p).length) { spot = { x, y }; break; }
    }
    if (spot) break;
  }
  for (let k = 0; k < 400 && !spot; k++) {
    const i = Math.floor(Math.random() * M.NW), j = Math.floor(Math.random() * M.NH);
    const c = { x: M.room.x + (i + 0.5) * HOROR.NAV, y: M.room.y + (j + 0.5) * HOROR.NAV }, d = hororDist(c, p);
    if (M.nav[j * M.NW + i] && d > 150 && d < 380 && Math.abs(hororAngle(Math.atan2(c.y - p.y, c.x - p.x) - p.a)) > 1) spot = c;
  }
  if (spot) Object.assign(H.lada, { x: spot.x, y: spot.y, mode: 'chase', seen: { x: p.x, y: p.y }, lostT: 0, path: [], pathT: 0 });
  hororSay('Někdo je za tebou…', 3);
}

// --- Kreslení ---
const hororLightAt = (H, dist, cam) => {
  const cone = Math.max(0, Math.min(1, 1 - (Math.abs(cam) - 0.22) / 0.5));
  const near = Math.pow(Math.max(0, 1 - dist / HOROR.LIGHT), 1.35);
  const amb = Math.max(0, 0.07 - dist / 9000);
  return Math.max(amb, cone * near * H.flicker);
};
function renderHoror() {
  const H = state.horor;
  if (!H) return;
  const M = hororMap(), wide = VIEW.offX, left = -wide, width = CONFIG.WIDTH + 2 * wide, Ht = CONFIG.HEIGHT;
  const p = H.p, shake = H.phase === 'caught' && H.caughtT < 1.4 ? (Math.random() - 0.5) * 22 : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);
  ctx.fillStyle = '#000000';
  ctx.fillRect(left - 20, -20, width + 40, Ht + 40);
  const horizon = Ht / 2 + H.bob, tanF = Math.tan(HOROR.FOV / 2), proj = (width / 2) / tanF;
  // podlaha a strop podle dílu, kde stojím: kousek před hráčem nasvícené baterkou
  const st = HOROR_STYLE[amongPartAt(M.room, p.x, p.y)] || HOROR_STYLE.hlavni, rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  const fg = ctx.createRadialGradient(left + width / 2, Ht + 40, 20, left + width / 2, Ht + 40, Ht * 0.75);
  fg.addColorStop(0, rgba(st.floor, 0.95 * H.flicker)); fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fg; ctx.fillRect(left, horizon, width, Ht - horizon);
  const cg = ctx.createRadialGradient(left + width / 2, -60, 20, left + width / 2, -60, Ht * 0.6);
  cg.addColorStop(0, rgba(st.ceil, 0.22 * H.flicker)); cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cg; ctx.fillRect(left, 0, width, horizon);
  // zdi
  const cols = Math.ceil(width / HOROR.COL_W), zbuf = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    const cam = (i + 0.5) / cols * 2 - 1, ra = p.a + Math.atan(cam * tanF);
    const hit = hororCast(M, p.x, p.y, ra, 1600);
    const perp = Math.max(1, hit.dist * Math.cos(ra - p.a));
    zbuf[i] = perp;
    if (!hit.type) continue;
    const top = horizon - (HOROR.WALL_H - HOROR.EYE) / perp * proj, bot = horizon + HOROR.EYE / perp * proj;
    let l = hororLightAt(H, perp, cam) * (hit.side ? 0.72 : 1);
    if (l < 0.01) continue;
    const u = hit.u - Math.floor(hit.u), cell = Math.floor(hit.u);
    const seam = (cell % 8 === 0 && u < 0.18) ? 0.6 : 1;   // spáry / sloupky
    const x = left + i * HOROR.COL_W;
    const shade = (r, g, b, k) => `rgb(${Math.round(r * l * k)}, ${Math.round(g * l * k)}, ${Math.round(b * l * k)})`;
    const ws = HOROR_STYLE[hit.part] || HOROR_STYLE.hlavni;
    if (hit.type === 2) {   // nábytek podle druhu: bílé sloupy až ke stropu, modré sedačky, stolek
      const o = M.room.obstacles[M.obst[hit.cell]], f = (o && HOROR_FURNITURE[o.kind]) || { c: [120, 86, 52], h: 70 };
      const ft = horizon - (f.h - HOROR.EYE) / perp * proj;
      if (f.h < HOROR.WALL_H) { ctx.fillStyle = shade(ws.top[0] * 0.5, ws.top[1] * 0.5, ws.top[2] * 0.5, 1); ctx.fillRect(x, top, HOROR.COL_W + 1, ft - top); }   // zeď za ním (ve tmě)
      ctx.fillStyle = shade(f.c[0], f.c[1], f.c[2], f.h >= HOROR.WALL_H && (u < 0.12 || u > 0.88) ? 0.8 : 1);
      ctx.fillRect(x, ft, HOROR.COL_W + 1, bot - ft);
      if (o && o.kind === 'pillar') { ctx.fillStyle = shade(40, 40, 44, 1); ctx.fillRect(x, bot - 5 / perp * proj, HOROR.COL_W + 1, 5 / perp * proj); }   // černá lišta
      continue;
    }
    if (hit.type === 4) {   // dveře: v chodbách bílé, vchod hnědý (jako na fotkách)
      const dtop = horizon - (105 - HOROR.EYE) / perp * proj, entry = hit.part === 'vstup';
      ctx.fillStyle = shade(ws.top[0], ws.top[1], ws.top[2], 1); ctx.fillRect(x, top, HOROR.COL_W + 1, dtop - top);
      const dc = entry ? [110, 92, 70] : [236, 236, 230], edge = u < 0.1 || u > 0.9;
      ctx.fillStyle = shade(dc[0], dc[1], dc[2], edge ? 0.55 : 1); ctx.fillRect(x, dtop, HOROR.COL_W + 1, bot - dtop);
      continue;
    }
    // zeď podle dílu: nahoře světlá (ve vstupu okrová se světlými rámy), dole sokl, pruh / černá lišta
    const low = horizon + (HOROR.EYE - ws.lowH) / perp * proj, bandH = ws.bandH / perp * proj;
    ctx.fillStyle = shade(ws.top[0], ws.top[1], ws.top[2], seam); ctx.fillRect(x, top, HOROR.COL_W + 1, low - top);
    if (ws.panel && u > 0.15 && u < 0.85 && (Math.floor(hit.u) % 6) > 0) {
      const py = horizon - (100 - HOROR.EYE) / perp * proj, ph = 50 / perp * proj;
      ctx.fillStyle = shade(ws.panel[0], ws.panel[1], ws.panel[2], 1); ctx.fillRect(x, py, HOROR.COL_W + 1, ph);
    }
    ctx.fillStyle = shade(ws.low[0], ws.low[1], ws.low[2], seam); ctx.fillRect(x, low, HOROR.COL_W + 1, bot - low);
    ctx.fillStyle = shade(ws.band[0], ws.band[1], ws.band[2], 1);
    if (ws.panel) ctx.fillRect(x, low - bandH, HOROR.COL_W + 1, bandH);   // šedý pruh nad soklem
    else ctx.fillRect(x, bot - bandH, HOROR.COL_W + 1, bandH);            // černá lišta u podlahy
  }
  // postavy a klíče (od nejvzdálenějšího)
  const sprites = H.keys.filter((k) => !k.got).map((k) => ({ ...k, kind: 'key' }));
  if (H.phase !== 'caught') sprites.push({ x: H.lada.x, y: H.lada.y, kind: 'lada' });
  sprites.sort((a, b) => hororDist(b, p) - hororDist(a, p));
  for (const s of sprites) {
    const d = hororDist(s, p), ang = hororAngle(Math.atan2(s.y - p.y, s.x - p.x) - p.a);
    if (Math.abs(ang) > HOROR.FOV / 2 + 0.25 || d < 8) continue;
    const perp = d * Math.cos(ang), sx = left + width / 2 + Math.tan(ang) * proj;
    const col = Math.floor((sx - left) / HOROR.COL_W);
    if (col >= 0 && col < cols && perp > zbuf[col] + 6) continue;   // za zdí
    const cam = Math.tan(ang) / tanF, l = Math.max(hororLightAt(H, perp, cam), s.kind === 'key' ? 0.35 : 0);
    const feet = horizon + HOROR.EYE / perp * proj;
    if (s.kind === 'key') {   // svítící klíč
      const size = Math.max(10, 34 / perp * proj * 0.35), y = feet - 30 / perp * proj + Math.sin(H.t * 3) * 3;
      const g = ctx.createRadialGradient(sx, y, 2, sx, y, size * 1.6);
      g.addColorStop(0, 'rgba(255, 220, 90, 0.55)'); g.addColorStop(1, 'rgba(255, 220, 90, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, y, size * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔑', sx, y);
      continue;
    }
    // Láďa
    const scale = (HOROR.LADA.HEIGHT / perp * proj) / 80;
    ctx.save();
    if ('filter' in ctx) ctx.filter = `brightness(${Math.max(0.04, l).toFixed(2)})`;
    ctx.translate(sx, feet); ctx.scale(scale, scale);
    drawFigure(0, 0, H.lada.mode === 'chase' ? H.t * 12 : H.t * 6, 1, teacherLook(TEACHERS.lada));
    ctx.restore();
    if (l < 0.4) {   // ve tmě svítí oči
      const ey = feet - 56 * scale, r = Math.max(1.5, 2.6 * scale);
      ctx.fillStyle = `rgba(255, 30, 30, ${0.9 - l})`;
      ctx.beginPath(); ctx.arc(sx - 6 * scale, ey, r, 0, Math.PI * 2); ctx.arc(sx + 6 * scale, ey, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // kužel baterky (lehká záře) a tma na okrajích
  const vg = ctx.createRadialGradient(left + width / 2, Ht / 2, Ht * 0.25, left + width / 2, Ht / 2, width * 0.62);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)'); vg.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = vg; ctx.fillRect(left, 0, width, Ht);
  ctx.restore();
  drawHororHud(H);
}
function drawHororHud(H) {
  const W = CONFIG.WIDTH, Ht = CONFIG.HEIGHT, keysHint = !isTouchHint();
  if (H.phase === 'play' || H.phase === 'pause') {
    drawOutlinedText(`🔑 ${H.got}/${HOROR.KEYS}`, 60, 30, 'bold 22px sans-serif', '#ffd54a', 'middle');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(20, 52, 120, 8);   // dech
    ctx.fillStyle = H.stamina < 0.8 ? '#ff7043' : '#9ccc65'; ctx.fillRect(20, 52, 120 * H.stamina / HOROR.STAMINA, 8);
    if (H.msgT > 0) drawOutlinedText(H.msg, W / 2, 110, 'bold 22px sans-serif', H.msg.startsWith('Láďa') ? '#ff5a4a' : '#ffffff', 'middle');
    if (H.t < 6 && H.phase === 'play') drawOutlinedText(keysHint ? 'WASD / šipky – chůze · myš – otáčení · Shift – běh · Esc – pauza' : 'Joystick – chůze · táhni vpravo – otáčení', W / 2, Ht - 24, 'bold 14px sans-serif', '#cfcfcf', 'middle');
  }
  if (H.phase === 'intro') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('👻 BACHA NA LÁĎU', W / 2, 150, 'bold 46px sans-serif', '#ff4d4d', 'middle');
    ['Je noc. Zůstal jsi zamčený ve škole.', 'Po chodbách chodí Láďa… a hledá tě.', `Najdi ${HOROR.KEYS} klíče a uteč hlavním vchodem.`, 'Když tě uvidí, utíkej!']
      .forEach((t, i) => drawOutlinedText(t, W / 2, 230 + i * 34, 'bold 20px sans-serif', '#ffffff', 'middle'));
    drawOutlinedText(keysHint ? 'WASD nebo šipky – chůze (← → do stran) · myš – otáčení · Shift – běh' : 'Joystick vlevo – chůze · táhni vpravo – otáčení · joystick naplno – běh', W / 2, 400, 'bold 15px sans-serif', '#cfcfcf', 'middle');
    drawOutlinedText('🎧 Nejlepší se sluchátky', W / 2, 432, 'bold 15px sans-serif', '#cfcfcf', 'middle');
    drawOutlinedText(keysHint ? 'Mezerník nebo klik = začít · Esc = zpět' : 'Ťukni = začít', W / 2, 500, 'bold 20px sans-serif', '#ffd54a', 'middle');
  } else if (H.phase === 'pause') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('Pauza', W / 2, 240, 'bold 40px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(keysHint ? 'Klik / mezerník = pokračovat · Esc = odejít' : 'Ťukni = pokračovat', W / 2, 300, 'bold 18px sans-serif', '#ffd54a', 'middle');
  } else if (H.phase === 'caught') {
    const t = H.caughtT;
    if (t < 1.4) {   // jumpscare: Láďova hlava přes celou obrazovku
      ctx.fillStyle = `rgba(${120 + Math.random() * 100}, 0, 0, 0.9)`; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
      const img = faceImgs.lada, s = 380 + t * 520 + Math.random() * 30;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      if (img && img.complete) ctx.drawImage(img, W / 2 - s / 2 + (Math.random() - 0.5) * 30, Ht / 2 - s / 2 + (Math.random() - 0.5) * 30, s, s);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(30, 0, 0, 0.92)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
      drawOutlinedText('LÁĎA TĚ CHYTIL!', W / 2, 220, 'bold 48px sans-serif', '#ff4d4d', 'middle');
      drawOutlinedText(`Klíče: ${H.got}/${HOROR.KEYS}`, W / 2, 272, 'bold 18px sans-serif', '#ffffff', 'middle');
      chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? 'Zkusit znovu' : 'Odejít', i === H.overSel));
    }
  } else if (H.phase === 'win' && H.caughtT > 0.3) {
    ctx.fillStyle = 'rgba(0, 20, 10, 0.9)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('UTEKL JSI! 🎉', W / 2, 220, 'bold 48px sans-serif', '#7ee08a', 'middle');
    drawOutlinedText(`Za ${Math.round(H.winT || 0)} s – Láďa zůstal ve škole sám.`, W / 2, 272, 'bold 18px sans-serif', '#ffffff', 'middle');
    if (H.caughtT >= 1.6) chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? 'Hrát znovu' : 'Odejít', i === H.overSel));
  }
}

// Úvod → 🎮 Módy → 👻 Bacha na Láďu (10_obrazovky.js, modesItems)
{
  const _press = pressButton;
  pressButton = function (id) { if (id === 'horor') openHoror(); else _press(id); };
}
