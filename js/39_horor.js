// Bacha na Láďu – horor z první osoby (raycasting) po celé budově A
// Část hry Dárek – načítá se v index.html po 38_among_extra.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// BACHA NA LÁĎU (mód v 🎮 Módy, obrazovka 'horor'). Je noc, Roman zůstal zamčený ve škole
// a po budově A chodí Láďa. Najdi 3 klíče (jsou ve třídách) a uteč hlavním vchodem.
// - Mapa = budova A jako mapa A v Among Us (AMONG_MAPS.A.rooms): přízemí bez části s fotbálkem,
//   1. a 2. patro a místnosti, do kterých z nich vedou dveře. Dveře mezi nimi jdou projít
//   (jako ve hře), ostatní jsou zamčené. Každá místnost má svou mřížku po 10 px (hororMap).
// - 3D pohled (raycasting): pro každý sloupec obrazovky paprsek po mřížce, podle vzdálenosti
//   se nakreslí zeď. Tma a baterka. Barvy chodeb podle virtuální prohlídky na gympt.cz.
// - Láďa chodí po celé budově (i po schodech, hledá cestu přes dveře – hororRoute).
//   Když tě uvidí, honí tě; když tě ztratí z očí, jde tam, kde tě viděl naposledy (i za
//   tebou dveřmi, když viděl, kudy jsi utekl), chvíli se rozhlíží a pak to vzdá = SETŘESENÍ.
//   Slyší tě běžet (stejná místnost, do 300 px) – jde se podívat.
// - Schování: ve skříni nebo v záchodové kabince (E). Když tě Láďa neviděl zalézt, nenajde tě.
// - Sprint na Shift, dech (výdrž) – když dojde, chvíli to nejde.
// - Po 2. klíči zhasnou světla a Láďa se objeví za tebou (naháněčka). Chytí tě = jumpscare.
// Ovládání: W S / ↑ ↓ dopředu / dozadu, A D / ← → do stran, myš otáčení, Shift sprint,
//   E schovat / vylézt, Esc pauza. Mobil: joystick vlevo, tažení vpravo = otáčení, tlačítka.
// =====================================================================
const HOROR = {
  CELL: 10, NAV: 20,                     // mřížka pro paprsky / pro Láďovo hledání cesty
  FOV: Math.PI / 2.8,
  COL_W: 4,                              // px sloupce obrazovky na jeden paprsek
  WALL_H: 130, EYE: 62,                  // výška zdi a očí (px světa)
  SPEED: 115, RUN: 200,                  // chůze, sprint (px/s)
  STAMINA: 4, REGEN: 0.55, TIRED: 1.4,   // výdrž sprintu (s), obnova za s, po vyčerpání sprint až od TIRED
  MOUSE: 0.0026, TOUCH_TURN: 0.009,
  RADIUS: 11,
  LIGHT: 430,                            // dosvit baterky (px)
  LADA: { WALK: 70, CHECK: 105, RUN: 168, SEE: 520, HEAR: 300, CATCH: 30, LOOK: 3, HEIGHT: 118 },
  KEYS: 3,
  HIDE_DIST: 42,                         // px od okraje skříně / kabinky
  START: { room: 'chodba', x: 1140, y: 2010, a: -Math.PI / 2 },   // dole v Hlavní chodbě u vstupu
  LADA_START: 'patroA2',
  KEY_ROOMS: ['a113', 'a114', 'a107', 'a211', 'a212', 'a209', 'a210', 'sborovna', 'a310', 'a311', 'a302', 'aula', 'a309', 'a305'],
};
const HOROR_ROOMS = () => AMONG_MAPS.A.rooms;   // místnosti mapy (38_among_extra.js doplní třídy)
// Barvy (RGB): zeď nahoře, zeď dole, pruh / lišta, podlaha, strop; panel = krémové plochy (vstup)
const HOROR_STYLE = {
  hlavni: { top: [238, 239, 240], low: [232, 234, 236], band: [26, 30, 42], bandH: 6, lowH: 40, floor: [176, 170, 158], ceil: [242, 242, 240] },
  vstup: { top: [226, 162, 76], low: [198, 94, 62], band: [180, 194, 200], bandH: 10, lowH: 44, floor: [162, 162, 160], ceil: [244, 236, 220], panel: [238, 224, 198] },
  trida: { top: [236, 232, 222], low: [222, 216, 202], band: [112, 80, 50], bandH: 8, lowH: 30, floor: [150, 108, 66], ceil: [242, 240, 236] },
  wc: { top: [236, 240, 242], low: [178, 206, 224], band: [120, 150, 170], bandH: 4, lowH: 60, floor: [196, 198, 200], ceil: [240, 242, 244] },
  aula: { top: [240, 232, 214], low: [200, 176, 140], band: [110, 80, 50], bandH: 8, lowH: 34, floor: [140, 96, 56], ceil: [246, 240, 228] },
};
function hororStyle(roomId, part) {
  if (roomId === 'chodba') return part === 'vstup' ? HOROR_STYLE.vstup : HOROR_STYLE.hlavni;
  if (roomId === 'patroA' || roomId === 'patroA2') return HOROR_STYLE.hlavni;
  if (roomId.startsWith('wc')) return HOROR_STYLE.wc;
  if (roomId === 'aula') return HOROR_STYLE.aula;
  return HOROR_STYLE.trida;
}
// Nábytek: barva a výška (px světa); hide = dá se do něj schovat; null = neviditelná zábrana
const HOROR_FURNITURE = {
  pillar: { c: [240, 242, 246], h: 130 }, chairrow: { c: [40, 90, 180], h: 46 }, chair: { c: [40, 90, 180], h: 46 },
  lowtable: { c: [150, 112, 70], h: 36 }, desk: { c: [196, 160, 112], h: 46 }, labbench: { c: [150, 156, 160], h: 52 },
  shelf: { c: [140, 100, 62], h: 112 }, pcdesk: { c: [170, 170, 172], h: 48 }, ironrail: { c: [40, 40, 44], h: 62 },
  plant: { c: [60, 120, 60], h: 70 }, grassplant: { c: [70, 130, 60], h: 60 }, radiator: { c: [228, 222, 200], h: 40 },
  sink: { c: [236, 238, 240], h: 52 }, langbench: { c: [190, 156, 110], h: 46 }, urinal: { c: [236, 238, 240], h: 62 },
  printer: { c: [120, 124, 130], h: 52 }, monitor: { c: [40, 44, 52], h: 56 }, roundtable: { c: [176, 136, 90], h: 46 },
  aulachairs: { c: [150, 40, 46], h: 48 }, guitar: { c: [150, 90, 40], h: 64 }, wcwall: { c: [200, 216, 226], h: 130 },
  trashbin: { c: [100, 104, 110], h: 40 }, stage: { c: [96, 66, 40], h: 40, hide: 'pod pódiem' }, piano: { c: [26, 26, 30], h: 64 },
  wardrobe: { c: [120, 82, 46], h: 128, hide: 've skříni' }, stall: { c: [176, 196, 210], h: 130, hide: 'v záchodové kabince' },
  void: null,
};
const HOROR_MAPS = {};
state.horor = null;

// --- Mapa místnosti: mřížka (0 volno, 1 zeď, 2 nábytek, 3 mimo hru, 4 dveře), dveře, úkryty ---
function hororMap(roomId) {
  if (HOROR_MAPS[roomId]) return HOROR_MAPS[roomId];
  const room = ROOMS[roomId], rule = HOROR_ROOMS()[roomId], rules = HOROR_ROOMS(), C = HOROR.CELL;
  const W = Math.ceil(room.w / C), H = Math.ceil(room.h / C), g = new Uint8Array(W * H);
  const allowed = (x, y) => !rule || rule.includes(amongPartAt(room, x, y));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) g[j * W + i] = allowed(room.x + (i + 0.5) * C, room.y + (j + 0.5) * C) ? 0 : 3;
  const cells = (r, f) => {
    for (let j = Math.max(0, Math.floor((r.y - room.y) / C)); j <= Math.min(H - 1, Math.ceil((r.y + r.h - room.y) / C) - 1); j++)
      for (let i = Math.max(0, Math.floor((r.x - room.x) / C)); i <= Math.min(W - 1, Math.ceil((r.x + r.w - room.x) / C) - 1); i++) f(j * W + i);
  };
  roomWalls(room).forEach((r) => cells(r, (k) => { if (g[k] !== 3) g[k] = 1; }));
  const obst = new Int16Array(W * H).fill(-1), hides = [];
  room.obstacles.forEach((o, k) => {
    if (!allowed(o.rect.x + o.rect.w / 2, o.rect.y + o.rect.h / 2)) return;
    const f = HOROR_FURNITURE[o.kind];
    cells(o.rect, (c) => { if (g[c] !== 3) g[c] = f === null ? 1 : 2; if (f !== null) obst[c] = k; });
    if (f && f.hide) hides.push({ x: o.rect.x + o.rect.w / 2, y: o.rect.y + o.rect.h / 2, rect: o.rect, kind: o.kind, where: f.hide });
  });
  // dveře: průchozí do místností mapy (a východ ven), ostatní zamčené
  const doors = [], doorAt = new Int16Array(W * H).fill(-1);
  room.doors.forEach((d) => {
    if (rule && !rule.includes(d.part)) return;
    const exit = d.to === 'venku', open = exit || (d.to in rules && !ROOMS[d.to].front);
    const k = doors.push({ ...d, open, exit, cx: d.x + d.w / 2, cy: d.y + d.h / 2 }) - 1;
    cells(d, (c) => { g[c] = 4; doorAt[c] = k; });
  });
  for (const d of doors) {   // bod kousek před dveřmi uvnitř místnosti (sem jde Láďa)
    const n = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[d.side] || [0, 0];
    d.ix = d.cx + n[0] * 26; d.iy = d.cy + n[1] * 26;
  }
  const M = { id: roomId, room, W, H, g, C, obst, doors, doorAt, hides };
  const N = HOROR.NAV, NW = Math.ceil(room.w / N), NH = Math.ceil(room.h / N), nav = new Uint8Array(NW * NH);
  for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) nav[j * NW + i] = hororFree(M, room.x + (i + 0.5) * N, room.y + (j + 0.5) * N, HOROR.RADIUS) ? 1 : 0;   // Láďa projde tam, kam hráč
  Object.assign(M, { NW, NH, nav });
  // kam se dá dojít od dveří (klíče a Láďovy cíle jen sem – ne do kapes za lavicemi)
  const reach = new Uint8Array(NW * NH), q = [];
  const seed = (x, y) => {
    const i = Math.floor((x - room.x) / N), j = Math.floor((y - room.y) / N);
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const c = (j + dj) * NW + (i + di);
      if (i + di >= 0 && j + dj >= 0 && i + di < NW && j + dj < NH && nav[c] && !reach[c]) { reach[c] = 1; q.push(c); }
    }
  };
  doors.filter((d) => d.open).forEach((d) => seed(d.ix, d.iy));
  if (roomId === HOROR.START.room) seed(HOROR.START.x, HOROR.START.y);
  for (let h = 0; h < q.length; h++) {
    const c = q[h], ci = c % NW;
    for (const [d, ok] of [[1, ci < NW - 1], [-1, ci > 0], [NW, true], [-NW, true]]) {
      const n = c + d;
      if (ok && n >= 0 && n < nav.length && nav[n] && !reach[n]) { reach[n] = 1; q.push(n); }
    }
  }
  M.reach = reach;
  // úkryty jen ty, ke kterým se dá dojít (ne za lavicemi)
  M.hides = hides.filter((h) => {
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      if (reach[j * NW + i] && hororRectDist(h.rect, { x: room.x + (i + 0.5) * N, y: room.y + (j + 0.5) * N }) < HOROR.HIDE_DIST - 4) return true;
    }
    return false;
  });
  for (const d of doors) {   // dojde Láďa k těmhle dveřím? (jinak přes ně neplánuje)
    const i = Math.floor((d.ix - room.x) / N), j = Math.floor((d.iy - room.y) / N);
    d.navOk = false;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (i + b >= 0 && j + a >= 0 && i + b < NW && j + a < NH && reach[(j + a) * NW + i + b]) d.navOk = true;
  }
  return (HOROR_MAPS[roomId] = M);
}
function hororCell(M, x, y) {
  const i = Math.floor((x - M.room.x) / M.C), j = Math.floor((y - M.room.y) / M.C);
  return i < 0 || j < 0 || i >= M.W || j >= M.H ? 3 : M.g[j * M.W + i];
}
function hororFree(M, x, y, r) {
  return !hororCell(M, x - r, y - r) && !hororCell(M, x + r, y - r) && !hororCell(M, x - r, y + r) && !hororCell(M, x + r, y + r)
    && !hororCell(M, x, y) && !hororCell(M, x - r, y) && !hororCell(M, x + r, y) && !hororCell(M, x, y - r) && !hororCell(M, x, y + r);
}
// Paprsek (DDA po mřížce): vzdálenost ke zdi, druh, strana, buňka a díl, ze kterého se dívám
function hororCast(M, x, y, ang, max) {
  const C = M.C, px = (x - M.room.x) / C, py = (y - M.room.y) / C, dx = Math.cos(ang), dy = Math.sin(ang);
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  let sx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sy = (dy < 0 ? py - my : my + 1 - py) * ddy, side = 0, t = 0;
  for (let k = 0; k < 700; k++) {
    if (sx < sy) { t = sx; sx += ddx; mx += stepX; side = 0; } else { t = sy; sy += ddy; my += stepY; side = 1; }
    if (t * C > max) return { dist: max, type: 0 };
    if (mx < 0 || my < 0 || mx >= M.W || my >= M.H) return { dist: t * C, type: 3, side, u: 0, cell: -1 };
    const v = M.g[my * M.W + mx];
    if (v) {
      const bx = M.room.x + (px + dx * (t - 0.08)) * C, by = M.room.y + (py + dy * (t - 0.08)) * C;
      return { dist: t * C, type: v, side, u: side ? px + dx * t : py + dy * t, cell: my * M.W + mx, part: M.room.parts ? amongPartAt(M.room, bx, by) : null };
    }
  }
  return { dist: max, type: 0 };
}
const hororDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hororRectDist = (r, p) => Math.hypot(p.x - Math.max(r.x, Math.min(r.x + r.w, p.x)), p.y - Math.max(r.y, Math.min(r.y + r.h, p.y)));
const hororAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Náhodné volné místo v místnosti (na navigační mřížce)
function hororRandomSpot(M, away, minD) {
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(Math.random() * M.NW), j = Math.floor(Math.random() * M.NH);
    if (!M.reach[j * M.NW + i]) continue;   // jen kam se dá dojít
    const s = { x: M.room.x + (i + 0.5) * HOROR.NAV, y: M.room.y + (j + 0.5) * HOROR.NAV };
    if (!away || hororDist(s, away) >= (minD || 0)) return s;
  }
  return null;
}

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
const hororDoorSnd = () => { hororNoise(0.18, 500, 0.35, 0); hororTone(140, 0.2, 'square', 0.08); };

// --- Začátek, konec ---
function openHoror() {
  const p = { ...HOROR.START };
  // klíče: 3 různé náhodné třídy, v každé náhodné volné místo
  const pool = HOROR.KEY_ROOMS.filter((r) => r in HOROR_ROOMS()).slice(), keys = [];
  for (let k = 0; k < HOROR.KEYS; k++) {
    const room = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], M = hororMap(room);
    const s = hororRandomSpot(M, null) || { x: M.room.x + M.room.w / 2, y: M.room.y + M.room.h / 2 };
    keys.push({ room, x: s.x, y: s.y, got: false });
  }
  const LM = hororMap(HOROR.LADA_START), ls = hororRandomSpot(LM, null);
  state.horor = {
    phase: 'intro', t: 0, p, keys, got: 0, stamina: HOROR.STAMINA, tired: false, bob: 0, walk: 0,
    lada: { room: HOROR.LADA_START, x: ls.x, y: ls.y, a: 0, mode: 'patrol', path: [], via: null, goal: null, pathT: 0, lookT: 0, stepT: 0, seenT: 99 },
    flicker: 1, dark: 0, msg: '', msgT: 0, caughtT: 0, overSel: 0, turnPtr: null, beatT: 0, scared: false,
    hidden: null, hideSeen: false, doorCd: 0, fade: 0, breathT: 0,
  };
  if (audio.track !== 'horor') hororSnd.prevTrack = audio.track;   // „Zkusit znovu“ nesmí přepsat hudbu, ke které se vrátí
  audio.track = 'horor';
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
function hororLock() {
  if (isTouchHint() || document.pointerLockElement || !canvas.requestPointerLock) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* nejde */ }
}
document.addEventListener('pointerlockchange', () => {
  const H = state.horor;
  if (H && H.phase === 'play' && !document.pointerLockElement && state.screen === 'horor') { H.phase = 'pause'; H.pauseT = 0; }
});
window.addEventListener('mousemove', (e) => {
  const H = state.horor;
  if (!H || H.phase !== 'play') return;
  if (document.pointerLockElement === canvas || e.buttons) H.p.a += e.movementX * HOROR.MOUSE;
});
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
const hororRoomName = (id) => ROOMS[id].name;

// --- Dveře: kudy z místnosti do místnosti ---
function hororRoute(from, to) {   // BFS po místnostech → seznam dveří (první = z místnosti from)
  if (from === to) return [];
  const prev = { [from]: null }, q = [from];
  for (let h = 0; h < q.length; h++) {
    const r = q[h];
    for (const d of hororMap(r).doors) {
      if (!d.open || d.exit || !d.navOk || d.to in prev) continue;
      prev[d.to] = { r, d };
      if (d.to === to) { const out = []; for (let x = to; prev[x]; x = prev[x].r) out.unshift(prev[x].d); return out; }
      q.push(d.to);
    }
  }
  return null;
}
// Kam se postaví ten, kdo prošel dveřmi d (střed postavy v cílové místnosti) a kam se dívá
function hororThrough(d) {
  const s = CONFIG.PLAYER_SIZE / 2, x = d.spawn ? d.spawn.x + s : ROOMS[d.to].x + ROOMS[d.to].w / 2, y = d.spawn ? d.spawn.y + s : ROOMS[d.to].y + ROOMS[d.to].h / 2;
  const back = hororMap(d.to).doors.filter((b) => b.to === d.from).sort((a, b) => Math.hypot(a.cx - x, a.cy - y) - Math.hypot(b.cx - x, b.cy - y))[0];
  return { x, y, a: back ? Math.atan2(y - back.cy, x - back.cx) : 0 };
}

// --- Láďa ---
function hororPath(M, from, to) {   // BFS po navigační mřížce jedné místnosti
  const N = HOROR.NAV, idx = (p) => Math.floor((p.y - M.room.y) / N) * M.NW + Math.floor((p.x - M.room.x) / N);
  const near = (c) => {   // ve zdi: nejbližší volná buňka
    if (c >= 0 && c < M.nav.length && M.nav[c]) return c;
    const gi = c % M.NW, gj = Math.floor(c / M.NW);
    let best = -1, bd = Infinity;
    for (let j = gj - 4; j <= gj + 4; j++) for (let i = gi - 4; i <= gi + 4; i++) {
      if (i < 0 || j < 0 || i >= M.NW || j >= M.NH || !M.nav[j * M.NW + i]) continue;
      const dd = Math.hypot(i - gi, j - gj);
      if (dd < bd) { bd = dd; best = j * M.NW + i; }
    }
    return best;
  };
  const s = near(idx(from)), goal = near(idx(to));
  if (s < 0 || goal < 0) return [];
  const prev = new Int32Array(M.NW * M.NH).fill(-1), q = [s];
  prev[s] = s;
  for (let h = 0; h < q.length && prev[goal] < 0; h++) {
    const c = q[h], ci = c % M.NW;
    for (const [d, ok] of [[1, ci < M.NW - 1], [-1, ci > 0], [M.NW, true], [-M.NW, true]]) {
      const n = c + d;
      if (!ok || n < 0 || n >= M.nav.length || prev[n] >= 0 || !M.nav[n]) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[goal] < 0) return [];
  const path = [];
  for (let c = goal; c !== s; c = prev[c]) path.push({ x: M.room.x + (c % M.NW + 0.5) * N, y: M.room.y + (Math.floor(c / M.NW) + 0.5) * N });
  path.reverse();
  if (hororFree(M, to.x, to.y, 10)) path.push({ x: to.x, y: to.y });   // až přesně na cíl, když tam je volno
  return path;
}
// Naplánuje cestu k cíli (i přes dveře do jiné místnosti)
function hororPlan(L, goal) {
  L.goal = goal;
  if (goal.room === L.room) { L.via = null; L.path = hororPath(hororMap(L.room), L, goal); return; }
  const route = hororRoute(L.room, goal.room);
  if (!route || !route.length) { L.path = []; L.via = null; return; }
  const d = route[0];
  L.via = d;
  L.path = hororPath(hororMap(L.room), L, { x: d.ix, y: d.iy });
}
function hororSees(H) {
  const L = H.lada, p = H.p;
  if (L.room !== p.room || H.hidden) return false;
  const d = hororDist(L, p);
  if (d > HOROR.LADA.SEE) return false;
  const facing = Math.abs(hororAngle(Math.atan2(p.y - L.y, p.x - L.x) - L.a)) < 1.3;
  if (!(facing || d < 170 || L.mode === 'chase')) return false;
  const hit = hororCast(hororMap(L.room), L.x, L.y, Math.atan2(p.y - L.y, p.x - L.x), d);
  return hit.dist >= d - 4;
}
function hororLada(H, dt) {
  const L = H.lada, p = H.p, cfg = HOROR.LADA, same = L.room === p.room, d = same ? hororDist(L, p) : 9999;
  const sees = hororSees(H);
  L.seenT = sees ? 0 : L.seenT + dt;
  if (sees) {
    if (L.mode !== 'chase') { hororSting(); hororSay('Láďa tě vidí! UTÍKEJ!', 2.5); }
    L.mode = 'chase'; L.wasChase = true;
    L.last = { room: p.room, x: p.x, y: p.y };
  } else if (same && H.running && d < cfg.HEAR && L.mode !== 'chase') {   // slyší běh – jde se podívat
    if (L.mode !== 'check') hororSay('Láďa tě slyšel…', 2);
    L.mode = 'check';
    L.last = { room: p.room, x: p.x, y: p.y };
    hororPlan(L, L.last);
  }
  L.pathT -= dt;
  if (L.mode === 'chase' && L.pathT <= 0) { L.pathT = 0.3; hororPlan(L, L.last); }
  // došel na cíl
  if (!L.path.length && !L.via) {
    if ((L.mode === 'chase' && !sees) || L.mode === 'check') {   // tady tě viděl naposledy – rozhlíží se
      L.mode = 'look'; L.lookT = cfg.LOOK;
    } else if (L.mode === 'look') {
      L.lookT -= dt; L.a += dt * 2.2;
      if (L.lookT <= 0) { L.mode = 'patrol'; if (L.wasChase) { hororSay('Setřásl jsi ho… zatím.', 2.5); L.wasChase = false; } }
    }
    if (L.mode === 'patrol') {   // procházka: náhodná místnost (chodby častěji) a místo v ní
      const rooms = Object.keys(HOROR_ROOMS()), pick = Math.random() < 0.55 ? ['chodba', 'patroA', 'patroA2'][Math.floor(Math.random() * 3)] : rooms[Math.floor(Math.random() * rooms.length)];
      const s = hororRandomSpot(hororMap(pick), null);
      if (s) hororPlan(L, { room: pick, x: s.x, y: s.y });
    }
  }
  // chůze po cestě, na konci cesty dveře → druhá místnost
  const speed = L.mode === 'chase' ? cfg.RUN : L.mode === 'check' ? cfg.CHECK : cfg.WALK;
  let move = L.mode === 'look' ? 0 : speed * dt;
  while (move > 0 && L.path.length) {
    const t = L.path[0], dx = t.x - L.x, dy = t.y - L.y, dd = Math.hypot(dx, dy);
    if (dd > 0.01) L.a = Math.atan2(dy, dx);
    if (dd <= move) { L.x = t.x; L.y = t.y; L.path.shift(); move -= dd; }
    else { L.x += dx / dd * move; L.y += dy / dd * move; move = 0; }
  }
  if (!L.path.length && L.via) {
    const th = hororThrough({ ...L.via, from: L.room });
    if (L.room === p.room || L.via.to === p.room) hororDoorSnd();
    L.room = L.via.to; L.x = th.x; L.y = th.y; L.a = th.a; L.via = null;
    if (L.goal) hororPlan(L, L.goal);
  }
  // kroky: ve stejné místnosti podle polohy, ze sousední potichu
  L.stepT -= dt;
  if (L.stepT <= 0) {
    L.stepT = L.mode === 'chase' ? 0.3 : 0.55;
    if (same && d < 700) {
      const rel = hororAngle(Math.atan2(L.y - p.y, L.x - p.x) - p.a);
      hororNoise(0.09, 140, Math.min(0.9, 60 / Math.max(40, d)) * 1.4, Math.sin(rel));
    } else if (hororMap(p.room).doors.some((dd) => dd.to === L.room)) hororNoise(0.09, 120, 0.12, 0);
  }
  // chycení: venku, nebo ve skříni, když viděl, jak tam zalézáš
  if (same && d < cfg.CATCH && (!H.hidden || H.hideSeen)) hororCaught(H);
  if (same && H.hidden && H.hideSeen) {   // došel ke skříni, do které tě viděl zalézt → otevře ji
    const r = H.hidden.rect, qx = Math.max(r.x, Math.min(r.x + r.w, L.x)), qy = Math.max(r.y, Math.min(r.y + r.h, L.y));
    if (Math.hypot(qx - L.x, qy - L.y) < 40 || hororDist(L, H.hideFrom) < 26) hororCaught(H);
  }
}
function hororCaught(H) {
  H.phase = 'caught'; H.caughtT = 0; H.overSel = 0; H.hidden = null;
  hororDrone(false);
  hororScream();
  if (document.pointerLockElement) document.exitPointerLock();
}

// --- Schovávání ---
function hororHideNear(H) {
  if (H.hidden) return null;
  const M = hororMap(H.p.room);
  return M.hides.find((h) => hororRectDist(h.rect, H.p) < HOROR.HIDE_DIST) || null;   // k okraji skříně / kabinky
}
function hororToggleHide(H) {
  if (H.hidden) {   // vylézt
    H.hidden = null; H.hideSeen = false;
    hororNoise(0.25, 300, 0.4, 0);
    return;
  }
  const h = hororHideNear(H);
  if (!h) return;
  const L = H.lada;
  H.hideSeen = L.room === H.p.room && L.seenT < 0.6 && hororDist(L, H.p) < 320;   // viděl, jak zalézáš
  H.hidden = h; H.hideFrom = { x: H.p.x, y: H.p.y };
  hororNoise(0.25, 300, 0.4, 0);
  hororSay(`Schovaný ${h.where}… E = vylézt`, 2.5);
  if (H.hideSeen) { L.mode = 'chase'; L.last = { room: H.p.room, x: H.p.x, y: H.p.y }; hororPlan(L, L.last); }   // jde tam, kde jsi zalezl
}

// --- Krok hry ---
function updateHoror(dt) {
  const H = state.horor, keys = hororKeys.splice(0), events = input.events.splice(0);
  if (!H) return;
  H.t += dt;
  if (H.msgT > 0) H.msgT -= dt;
  if (H.fade > 0) H.fade -= dt;
  const tapped = events.some((e) => e.type === 'action' || (e.x != null && !e.inJoyZone));
  if (H.phase === 'intro') {
    if (keys.includes('Escape')) { hororLeave(); return; }
    if (tapped && H.t > 0.4) hororBegin();
    return;
  }
  if (H.phase === 'pause') {
    H.pauseT = (H.pauseT || 0) + dt;
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
  // schovat / vylézt (E nebo tlačítko na mobilu)
  const hideTap = events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_HIDE_BTN, 6));
  if (keys.includes('KeyE') || hideTap) hororToggleHide(H);
  const p = H.p, M = hororMap(p.room), k = (c) => input.keys.has(c);
  // pohyb (ve skříni se stojí)
  let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const j = input.joy;
  if (j.active && Math.hypot(j.dx, j.dy) > CONFIG.JOY_DEADZONE) { fwd = -j.dy; side = j.dx; }
  if (H.hidden) { fwd = 0; side = 0; }
  const len = Math.hypot(fwd, side);
  const wantRun = (k('ShiftLeft') || k('ShiftRight') || (j.active && Math.hypot(j.dx, j.dy) > 0.95)) && len > 0;
  // výdrž: sprint ji bere, jinak se obnovuje; po vyčerpání chvíli sprintovat nejde
  if (H.tired && H.stamina >= HOROR.TIRED) H.tired = false;
  H.running = wantRun && !H.tired && H.stamina > 0;
  if (H.running) { H.stamina = Math.max(0, H.stamina - dt); if (H.stamina <= 0) { H.tired = true; hororSay('Došel ti dech!', 1.5); } }
  else H.stamina = Math.min(HOROR.STAMINA, H.stamina + dt * HOROR.REGEN * (len > 0 ? 0.6 : 1));
  if (H.tired) { H.breathT -= dt; if (H.breathT <= 0) { H.breathT = 0.7; hororNoise(0.35, 700, 0.12, 0); } }
  if (len > 0) {
    const sp = (H.running ? HOROR.RUN : HOROR.SPEED) * dt / Math.max(1, len);
    const mx = (Math.cos(p.a) * fwd - Math.sin(p.a) * side) * sp, my = (Math.sin(p.a) * fwd + Math.cos(p.a) * side) * sp;
    if (hororFree(M, p.x + mx, p.y, HOROR.RADIUS)) p.x += mx;
    if (hororFree(M, p.x, p.y + my, HOROR.RADIUS)) p.y += my;
    H.walk += dt * (H.running ? 13 : 8);
  }
  H.bob = Math.sin(H.walk) * (len > 0 ? (H.running ? 6 : 3) : 0);
  // dveře: když do nich vejdeš, jsi v další místnosti (zamčené nepustí)
  H.doorCd -= dt;
  if (H.doorCd <= 0 && len > 0) {
    const mvx = Math.cos(p.a) * fwd - Math.sin(p.a) * side, mvy = Math.sin(p.a) * fwd + Math.cos(p.a) * side;
    for (const d of M.doors) {
      // blízko dveří (u schodů je zábradlí, proto 26 px) a jdu směrem k nim
      const qx = Math.max(d.x, Math.min(d.x + d.w, p.x)), qy = Math.max(d.y, Math.min(d.y + d.h, p.y));
      if (Math.hypot(qx - p.x, qy - p.y) > HOROR.RADIUS + 15 || (qx - p.x) * mvx + (qy - p.y) * mvy <= 0) continue;
      if (d.exit) {
        if (H.got >= HOROR.KEYS) { hororWin(H); return; }
        if (H.msgT <= 0) hororSay(`Zamčeno. Najdi klíče (${H.got}/${HOROR.KEYS}).`, 2);
        H.doorCd = 1;
        break;
      }
      if (!d.open) { if (H.msgT <= 0) hororSay('Zamčeno.', 1.2); H.doorCd = 1; break; }
      hororPlayerThrough(H, d);
      return;
    }
  }
  // klíče
  for (const key of H.keys) {
    if (key.got || key.room !== p.room || hororDist(key, p) > 34) continue;
    key.got = true; H.got++;
    hororTone(988, 0.15, 'triangle', 0.25); hororTone(1319, 0.3, 'triangle', 0.2, 0, 0, 0.12);
    hororSay(H.got < HOROR.KEYS ? `🔑 Klíč ${H.got}/${HOROR.KEYS}` : '🔑 Máš všechny klíče! Uteč hlavním vchodem (přízemí, dole ve vstupní chodbě)!', 3.5);
    if (H.got === 2 && !H.scared) hororScare(H);   // naháněčka
  }
  // světla blikají, když je Láďa blízko; po naháněčce chvíli tma
  const L = H.lada, dl = L.room === p.room ? hororDist(L, p) : 9999;
  if (H.dark > 0) { H.dark -= dt; H.flicker = H.dark > 0 ? 0.05 : 1; }
  else if (dl < 450 && Math.random() < dt * 3) H.flicker = 0.25 + Math.random() * 0.5;
  else H.flicker += (1 - H.flicker) * Math.min(1, dt * 6);
  H.beatT -= dt;
  if (dl < 320 && H.beatT <= 0) {
    H.beatT = 0.35 + dl / 320 * 0.6;
    hororTone(60, 0.12, 'sine', 0.35); hororTone(55, 0.12, 'sine', 0.3, 0, 0, 0.16);
  }
  hororLada(H, dt);
}
function hororPlayerThrough(H, d) {
  const p = H.p, from = p.room, th = hororThrough({ ...d, from });
  const L = H.lada;
  // Láďa tě viděl utíkat dveřmi → půjde za tebou
  if (L.mode === 'chase' && L.room === from && L.seenT < 1.5) { L.last = { room: d.to, x: th.x, y: th.y }; hororPlan(L, L.last); }
  p.room = d.to; p.x = th.x; p.y = th.y; p.a = th.a;
  H.doorCd = 0.6; H.fade = 0.3;
  hororDoorSnd();
  hororSay(hororRoomName(d.to), 1.4);
}
function hororWin(H) {
  H.phase = 'win'; H.winT = H.t; H.caughtT = 0; H.overSel = 0;
  hororDrone(false);
  if (document.pointerLockElement) document.exitPointerLock();
  hororTone(523, 0.2, 'triangle', 0.3); hororTone(784, 0.4, 'triangle', 0.3, 0, 0, 0.2);
}
// Po 2. klíči: zhasne a Láďa je za tebou (ve stejné místnosti)
function hororScare(H) {
  H.scared = true;
  H.dark = 1.6;
  hororSting();
  const p = H.p, M = hororMap(p.room);
  let spot = null;
  for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
    for (const r of [200, 240, 160, 280, 130, 320]) {
      const x = p.x - Math.cos(p.a + da) * r, y = p.y - Math.sin(p.a + da) * r;
      if (hororFree(M, x, y, 13) && hororPath(M, { x, y }, p).length) { spot = { x, y }; break; }
    }
    if (spot) break;
  }
  if (!spot) spot = hororRandomSpot(M, p, 150);
  if (spot) {
    Object.assign(H.lada, { room: p.room, x: spot.x, y: spot.y, mode: 'chase', last: { room: p.room, x: p.x, y: p.y }, seenT: 0, pathT: 0, via: null });
    hororPlan(H.lada, H.lada.last);
  }
  hororSay('Někdo je za tebou…', 3);
}

// --- Kreslení ---
// Kde má postava z drawFigure oči (od nohou, px postavy): stejný výpočet hlavy jako v drawFigure
function hororEyes(phase, blend) {
  const step = Math.sin(phase) * blend, sway = step * CONFIG.PLAYER_SWAY, size = CONFIG.PLAYER_HEAD_SIZE;
  const neckX = Math.round(Math.sin(sway) * 26), bob = Math.round(Math.abs(step) * 1.5);
  const hy = -13 - 24 - size + 5 - bob;
  return { x: neckX, y: hy + size * 0.46, dx: size * 0.17 };
}
const hororLightAt = (H, dist, cam) => {
  const cone = Math.max(0, Math.min(1, 1 - (Math.abs(cam) - 0.22) / 0.5));
  const near = Math.pow(Math.max(0, 1 - dist / HOROR.LIGHT), 1.35);
  const amb = Math.max(0, 0.07 - dist / 9000);
  return Math.max(amb, cone * near * H.flicker);
};
const HOROR_HIDE_BTN = { x: 660, y: 470, w: 120, h: 60 };
function renderHoror() {
  const H = state.horor;
  if (!H) return;
  const p = H.p, M = hororMap(p.room), wide = VIEW.offX, left = -wide, width = CONFIG.WIDTH + 2 * wide, Ht = CONFIG.HEIGHT;
  const shake = H.phase === 'caught' && H.caughtT < 1.4 ? (Math.random() - 0.5) * 22 : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);
  ctx.fillStyle = '#000000';
  ctx.fillRect(left - 20, -20, width + 40, Ht + 40);
  const horizon = Ht / 2 + H.bob, tanF = Math.tan(HOROR.FOV / 2), proj = (width / 2) / tanF;
  const st = hororStyle(p.room, M.room.parts ? amongPartAt(M.room, p.x, p.y) : null), rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
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
    const l = hororLightAt(H, perp, cam) * (hit.side ? 0.72 : 1);
    if (l < 0.01) continue;
    const u = hit.u - Math.floor(hit.u), seam = (Math.floor(hit.u) % 8 === 0 && u < 0.18) ? 0.6 : 1;
    const x = left + i * HOROR.COL_W, cw = HOROR.COL_W + 1;
    const shade = (c, k) => `rgb(${Math.round(c[0] * l * k)}, ${Math.round(c[1] * l * k)}, ${Math.round(c[2] * l * k)})`;
    const ws = hororStyle(p.room, hit.part);
    if (hit.type === 2) {   // nábytek podle druhu
      const o = M.room.obstacles[M.obst[hit.cell]], f = (o && HOROR_FURNITURE[o.kind]) || { c: [120, 86, 52], h: 70 };
      const ft = horizon - (f.h - HOROR.EYE) / perp * proj;
      if (f.h < HOROR.WALL_H) { ctx.fillStyle = shade(ws.top, 0.5); ctx.fillRect(x, top, cw, ft - top); }
      ctx.fillStyle = shade(f.c, f.h >= HOROR.WALL_H - 10 && (u < 0.12 || u > 0.88) ? 0.8 : 1);
      ctx.fillRect(x, ft, cw, bot - ft);
      if (f.hide && u > 0.46 && u < 0.54) { ctx.fillStyle = shade([30, 22, 14], 1); ctx.fillRect(x, ft + (bot - ft) * 0.1, cw, (bot - ft) * 0.85); }   // spára dvířek
      if (o && o.kind === 'pillar') { ctx.fillStyle = shade([40, 40, 44], 1); ctx.fillRect(x, bot - 5 / perp * proj, cw, 5 / perp * proj); }
      continue;
    }
    if (hit.type === 4) {   // dveře: průchozí bílé (vchod hnědý), zamčené tmavší, východ zelený s klíči
      const d = M.doors[M.doorAt[hit.cell]] || {}, dtop = horizon - (105 - HOROR.EYE) / perp * proj;
      ctx.fillStyle = shade(ws.top, 1); ctx.fillRect(x, top, cw, dtop - top);
      const dc = d.exit ? (H.got >= HOROR.KEYS ? [120, 200, 120] : [110, 92, 70]) : d.open ? [236, 236, 230] : [120, 112, 100];
      // kde na dveřích paprsek je (0–1 přes celou šířku dveří, ne po buňkách) – rám a klika jen jednou
      const wpos = (hit.side ? M.room.x : M.room.y) + hit.u * M.C, du = d.x !== undefined ? (hit.side ? (wpos - d.x) / d.w : (wpos - d.y) / d.h) : u;
      ctx.fillStyle = shade(dc, du < 0.06 || du > 0.94 ? 0.55 : 1); ctx.fillRect(x, dtop, cw, bot - dtop);
      if (d.open && !d.exit && du > 0.8 && du < 0.86) { ctx.fillStyle = shade([200, 170, 60], 1); ctx.fillRect(x, horizon + (HOROR.EYE - 52) / perp * proj, cw, 4 / perp * proj); }   // klika
      continue;
    }
    const low = horizon + (HOROR.EYE - ws.lowH) / perp * proj, bandH = ws.bandH / perp * proj;
    ctx.fillStyle = shade(ws.top, seam); ctx.fillRect(x, top, cw, low - top);
    if (ws.panel && u > 0.12 && u < 0.88 && (Math.floor(hit.u) % 7) > 0) {
      const py = horizon - (122 - HOROR.EYE) / perp * proj, ph = 62 / perp * proj;
      ctx.fillStyle = shade(ws.panel, 1); ctx.fillRect(x, py, cw, ph);
    }
    ctx.fillStyle = shade(ws.low, seam); ctx.fillRect(x, low, cw, bot - low);
    ctx.fillStyle = shade(ws.band, 1);
    if (ws.panel) ctx.fillRect(x, low - bandH, cw, bandH); else ctx.fillRect(x, bot - bandH, cw, bandH);
  }
  // postavy a klíče v této místnosti (od nejvzdálenějšího)
  const sprites = H.keys.filter((k) => !k.got && k.room === p.room).map((k) => ({ ...k, kind: 'key' }));
  if (H.phase !== 'caught' && H.lada.room === p.room) sprites.push({ x: H.lada.x, y: H.lada.y, kind: 'lada' });
  sprites.sort((a, b) => hororDist(b, p) - hororDist(a, p));
  for (const s of sprites) {
    const d = hororDist(s, p), ang = hororAngle(Math.atan2(s.y - p.y, s.x - p.x) - p.a);
    if (Math.abs(ang) > HOROR.FOV / 2 + 0.25 || d < 8) continue;
    const perp = d * Math.cos(ang), sx = left + width / 2 + Math.tan(ang) * proj;
    const col = Math.floor((sx - left) / HOROR.COL_W);
    if (col >= 0 && col < cols && perp > zbuf[col] + 6) continue;
    const cam = Math.tan(ang) / tanF, l = Math.max(hororLightAt(H, perp, cam), s.kind === 'key' ? 0.35 : 0);
    const feet = horizon + HOROR.EYE / perp * proj;
    if (s.kind === 'key') {
      const size = Math.max(10, 34 / perp * proj * 0.35), y = feet - 30 / perp * proj + Math.sin(H.t * 3) * 3;
      const g = ctx.createRadialGradient(sx, y, 2, sx, y, size * 1.6);
      g.addColorStop(0, 'rgba(255, 220, 90, 0.55)'); g.addColorStop(1, 'rgba(255, 220, 90, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, y, size * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔑', sx, y);
      continue;
    }
    const scale = (HOROR.LADA.HEIGHT / perp * proj) / 80, phase = H.lada.mode === 'chase' ? H.t * 12 : H.lada.mode === 'look' ? 0 : H.t * 6;
    ctx.save();
    if ('filter' in ctx) ctx.filter = `brightness(${Math.max(0.04, l).toFixed(2)})`;
    ctx.translate(sx, feet); ctx.scale(scale, scale);
    drawFigure(0, 0, phase, H.lada.mode === 'look' ? 0 : 1, teacherLook(TEACHERS.lada));
    ctx.restore();
    if (l < 0.4) {   // ve tmě svítí oči – jdou s hlavou
      const e = hororEyes(phase, H.lada.mode === 'look' ? 0 : 1), r = Math.max(1.5, 2.6 * scale);
      ctx.fillStyle = `rgba(255, 30, 30, ${0.9 - l})`;
      ctx.beginPath();
      ctx.arc(sx + (e.x - e.dx) * scale, feet + e.y * scale, r, 0, Math.PI * 2);
      ctx.arc(sx + (e.x + e.dx) * scale, feet + e.y * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const vg = ctx.createRadialGradient(left + width / 2, Ht / 2, Ht * 0.25, left + width / 2, Ht / 2, width * 0.62);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)'); vg.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = vg; ctx.fillRect(left, 0, width, Ht);
  if (H.hidden) {   // ve skříni: tma a škvíra mezi dvířky
    ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
    ctx.fillRect(left, 0, width / 2 - 26, Ht); ctx.fillRect(left + width / 2 + 26, 0, width / 2, Ht);
    ctx.fillStyle = 'rgba(40, 26, 14, 0.9)';
    ctx.fillRect(left + width / 2 - 34, 0, 8, Ht); ctx.fillRect(left + width / 2 + 26, 0, 8, Ht);
  }
  if (H.fade > 0) { ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, H.fade / 0.3)})`; ctx.fillRect(left, 0, width, Ht); }
  ctx.restore();
  drawHororHud(H);
}
function drawHororHud(H) {
  const W = CONFIG.WIDTH, Ht = CONFIG.HEIGHT, keysHint = !isTouchHint();
  if (H.phase === 'play' || H.phase === 'pause') {
    drawOutlinedText(`🔑 ${H.got}/${HOROR.KEYS}`, 60, 28, 'bold 22px sans-serif', '#ffd54a', 'middle');
    // kde jsou klíče (třídy), získané škrtnuté
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    H.keys.forEach((k, i) => { ctx.fillStyle = k.got ? '#7ee08a' : '#e0e0e0'; ctx.fillText(`${k.got ? '✔' : '•'} ${hororRoomName(k.room)}`, 110, 18 + i * 15); });
    // sprint (výdrž)
    drawOutlinedText(H.tired ? 'Došel dech…' : keysHint ? 'Sprint (Shift)' : 'Sprint', 90, 72, 'bold 11px sans-serif', H.tired ? '#ff8a80' : '#cfcfcf', 'middle');
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(20, 82, 140, 9);
    ctx.fillStyle = H.tired ? '#e53935' : H.stamina < 1.2 ? '#ff9800' : '#9ccc65';
    ctx.fillRect(20, 82, 140 * H.stamina / HOROR.STAMINA, 9);
    drawOutlinedText(hororRoomName(H.p.room), W / 2, 22, 'bold 14px sans-serif', '#9e9e9e', 'middle');
    if (H.msgT > 0) drawOutlinedText(H.msg, W / 2, 110, 'bold 22px sans-serif', /^Láďa/.test(H.msg) ? '#ff5a4a' : '#ffffff', 'middle');
    // schovat se: nápověda / tlačítko
    const hn = hororHideNear(H);
    if (H.hidden || hn) {
      const label = H.hidden ? 'Vylézt' : `Schovat se`;
      if (keysHint) drawOutlinedText(`E – ${label}${hn ? ` (${hn.where})` : ''}`, W / 2, Ht - 60, 'bold 18px sans-serif', '#ffd54a', 'middle');
      else drawChessButton(HOROR_HIDE_BTN, `🫣 ${label}`, false, '#4a3a28');
    }
    if (H.t < 7 && H.phase === 'play') drawOutlinedText(keysHint ? 'WASD / šipky – chůze · myš – otáčení · Shift – sprint · E – schovat · Esc – pauza' : 'Joystick – chůze · táhni vpravo – otáčení', W / 2, Ht - 24, 'bold 13px sans-serif', '#cfcfcf', 'middle');
  }
  if (H.phase === 'intro') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('👻 BACHA NA LÁĎU', W / 2, 130, 'bold 46px sans-serif', '#ff4d4d', 'middle');
    ['Je noc. Zůstal jsi zamčený v budově A.', 'Po chodbách a třídách chodí Láďa… a hledá tě.', `Najdi ${HOROR.KEYS} klíče (jsou ve třídách) a uteč hlavním vchodem.`,
      'Když tě uvidí, utíkej – ztrať se mu z očí, nebo se schovej do skříně.']
      .forEach((t, i) => drawOutlinedText(t, W / 2, 205 + i * 32, 'bold 18px sans-serif', '#ffffff', 'middle', W - 40));
    drawOutlinedText(keysHint ? 'WASD / šipky – chůze (← → do stran) · myš – otáčení · Shift – sprint · E – schovat' : 'Joystick vlevo – chůze (naplno = sprint) · táhni vpravo – otáčení', W / 2, 375, 'bold 14px sans-serif', '#cfcfcf', 'middle');
    drawOutlinedText('🎧 Nejlepší se sluchátky', W / 2, 405, 'bold 14px sans-serif', '#cfcfcf', 'middle');
    drawOutlinedText(keysHint ? 'Mezerník nebo klik = začít · Esc = zpět' : 'Ťukni = začít', W / 2, 480, 'bold 20px sans-serif', '#ffd54a', 'middle');
  } else if (H.phase === 'pause') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('Pauza', W / 2, 240, 'bold 40px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(keysHint ? 'Klik / mezerník = pokračovat · Esc = odejít' : 'Ťukni = pokračovat', W / 2, 300, 'bold 18px sans-serif', '#ffd54a', 'middle');
  } else if (H.phase === 'caught') {
    const t = H.caughtT;
    if (t < 1.4) {
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
