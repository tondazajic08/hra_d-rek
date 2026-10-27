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
  LIGHT: 680,                            // dosvit baterky (px) – víc vidět, ať se člověk neztrácí
  ROW: 3,                                // px výšky obrazovky na řádek podlahy / stropu
  FL: 180,                               // výška patra (schody: 24 stupňů po 7,5 px, nášlap 20 px)
  BAT: 110,                              // s – na jak dlouho vydrží plná baterka
  BAT_CHANCE: 0.45,                      // kolik šuplíků má v sobě baterku
  DRAWER_DIST: 40,                       // px od šuplíku, odkud jde otevřít
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
  lowtable: { c: [150, 112, 70], h: 36, thin: 1 }, desk: { c: [196, 160, 112], h: 46, thin: 1 }, labbench: { c: [150, 156, 160], h: 52 },
  shelf: { c: [140, 100, 62], h: 112 }, pcdesk: { c: [170, 170, 172], h: 48, thin: 1 }, ironrail: { c: [40, 40, 44], h: 62, thin: 1, rail: 1 },
  plant: { c: [60, 120, 60], h: 70 }, grassplant: { c: [70, 130, 60], h: 60 }, radiator: { c: [228, 222, 200], h: 40 },
  sink: { c: [236, 238, 240], h: 52 }, langbench: { c: [190, 156, 110], h: 46, thin: 1 }, urinal: { c: [236, 238, 240], h: 62 },
  printer: { c: [120, 124, 130], h: 52 }, monitor: { c: [40, 44, 52], h: 56 }, roundtable: { c: [176, 136, 90], h: 46, thin: 1 },
  aulachairs: { c: [150, 40, 46], h: 48 }, guitar: { c: [150, 90, 40], h: 64 }, wcwall: { c: [200, 216, 226], h: 130 },
  trashbin: { c: [100, 104, 110], h: 40 }, stage: { c: [96, 66, 40], h: 40, hide: 'pod pódiem' }, piano: { c: [26, 26, 30], h: 64 },
  wardrobe: { c: [120, 82, 46], h: 128, hide: 've skříni' }, stall: { c: [176, 196, 210], h: 130, hide: 'v záchodové kabince' },
  void: null,   // díra (zrcadlo schodiště) – nedá se tam jít, ale je vidět dolů
  // stolky a komody se šuplíky (hororMap je rozmístí), drawers = šuplíky [od, do] px nad podlahou; otevírá se horní
  suplik: { c: [150, 106, 62], h: 84, drawers: [[4, 28], [30, 56], [58, 80]] },
  stolek: { c: [176, 132, 84], h: 52, drawers: [[32, 48]] },
};
const HOROR_FUR_DEFAULT = { c: [120, 86, 52], h: 60 };
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
    cells(o.rect, (c) => { if (g[c] !== 3) g[c] = f === null ? 6 : 2; if (f !== null) obst[c] = k; });   // 6 = díra
    if (f && f.hide) hides.push({ x: o.rect.x + o.rect.w / 2, y: o.rect.y + o.rect.h / 2, rect: o.rect, kind: o.kind, where: f.hide });
  });
  const obs = room.obstacles.map((o) => ({ rect: o.rect, kind: o.kind, f: HOROR_FURNITURE[o.kind] || HOROR_FUR_DEFAULT }));
  // stolky a komody se šuplíky: ke zdi, kus od dveří, vždy stejně (podle jména místnosti – online to tak vidí všichni)
  const drawers = [], pull = new Int16Array(W * H).fill(-1);
  let rs = 7;
  for (const ch of roomId) rs = (Math.imul(rs, 31) + ch.charCodeAt(0)) | 0;
  const rnd = () => { rs = (Math.imul(rs, 1103515245) + 12345) | 0; return ((rs >>> 8) & 0xffff) / 65536; };
  const want = roomId.startsWith('wc') ? 0 : room.parts ? 6 : roomId === 'aula' ? 2 : 2;
  const gAt = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 1 : g[j * W + i]);
  for (let tries = 0; tries < 1500 && drawers.length < want; tries++) {
    const kind = rnd() < 0.5 ? 'suplik' : 'stolek', f = HOROR_FURNITURE[kind], along = kind === 'suplik' ? 4 : 3;
    const side = ['top', 'bottom', 'left', 'right'][Math.floor(rnd() * 4)], hor = side === 'top' || side === 'bottom';
    const cw = hor ? along : 2, chh = hor ? 2 : along, i0 = Math.floor(rnd() * W), j0 = Math.floor(rnd() * H);
    let ok = true;
    for (let j = j0; j < j0 + chh && ok; j++) for (let i = i0; i < i0 + cw && ok; i++) if (gAt(i, j) !== 0) ok = false;
    if (!ok) continue;
    // za zády zeď, před sebou volno (4 buňky)
    const [nx, ny] = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[side];
    for (let a = 0; a < along && ok; a++) {
      const bi = hor ? i0 + a : side === 'left' ? i0 - 1 : i0 + cw, bj = hor ? (side === 'top' ? j0 - 1 : j0 + chh) : j0 + a;
      if (gAt(bi, bj) !== 1) ok = false;
      for (let k = 1; k <= 4 && ok; k++) {
        const fi = hor ? i0 + a : (side === 'left' ? i0 + cw - 1 : i0) + nx * k, fj = hor ? (side === 'top' ? j0 + chh - 1 : j0) + ny * k : j0 + a;
        if (gAt(fi, fj) !== 0) ok = false;
      }
    }
    if (!ok) continue;
    const rect = { x: room.x + i0 * C, y: room.y + j0 * C, w: cw * C, h: chh * C }, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    if (room.doors.some((d) => Math.hypot(d.x + d.w / 2 - cx, d.y + d.h / 2 - cy) < 80)) continue;
    if (drawers.some((d) => Math.hypot(d.cx - cx, d.cy - cy) < 90)) continue;
    if (room.parts) { const part = amongPartAt(room, cx, cy); if (!part || part.startsWith('schody') || (rule && !rule.includes(part))) continue; }
    const k = obs.push({ rect, kind, f }) - 1, top = f.drawers[f.drawers.length - 1];
    cells(rect, (c) => { g[c] = 2; obst[c] = k; });
    // vytažený šuplík: řada buněk před komodou
    const pr = hor ? { x: rect.x, y: side === 'top' ? rect.y + rect.h : rect.y - C, w: rect.w, h: C } : { x: side === 'left' ? rect.x + rect.w : rect.x - C, y: rect.y, w: C, h: rect.h };
    const n = drawers.length;
    cells({ x: pr.x + 1, y: pr.y + 1, w: pr.w - 2, h: pr.h - 2 }, (c) => { pull[c] = n; });
    drawers.push({ id: `${roomId}:${n}`, kind, rect, cx, cy, px: pr.x + pr.w / 2, py: pr.y + pr.h / 2, lo: top[0], hi: top[1], c: f.c.map((v) => Math.min(255, v + 20)) });
  }
  // nohy stolů: rohové buňky
  const leg = new Uint8Array(W * H);
  obs.forEach((o) => {
    if (!o.f.thin || o.f.rail) return;
    const r = o.rect, pts = [[r.x + 3, r.y + 3], [r.x + r.w - 3, r.y + 3], [r.x + 3, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]];
    for (const [x, y] of pts) { const i = Math.floor((x - room.x) / C), j = Math.floor((y - room.y) / C); if (i >= 0 && j >= 0 && i < W && j < H) leg[j * W + i] = 1; }
  });
  // dveře: průchozí do místností mapy (a východ ven), ostatní zamčené
  const doors = [], doorAt = new Int16Array(W * H).fill(-1);
  room.doors.forEach((d) => {
    if (rule && !rule.includes(d.part)) return;
    const exit = d.to === 'venku', open = exit || (d.to in rules && !ROOMS[d.to].front);
    const k = doors.push({ ...d, open, exit, cx: d.x + d.w / 2, cy: d.y + d.h / 2 }) - 1;
    cells(d, (c) => { g[c] = d.hidden ? 5 : 4; doorAt[c] = k; });   // 5 = konec schodů (přechod do patra)
  });
  for (const d of doors) {   // bod kousek před dveřmi uvnitř místnosti (sem jde Láďa)
    const n = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[d.side] || [0, 0];
    d.ix = d.cx + n[0] * 26; d.iy = d.cy + n[1] * 26;
  }
  // podlaha / strop (kód textury na buňku): 1 teraco, 2 parkety, 3 dlaždice, 4 kámen, 5 prkna
  // výška podlahy fh (schody, díry) a stropu ch (nad schodištěm je vysoko)
  const fl = new Uint8Array(W * H), base = roomId.startsWith('wc') ? 3 : roomId === 'aula' ? 5 : room.parts ? 1 : 2;
  const fh = new Float32Array(W * H), ch = new Float32Array(W * H).fill(HOROR.WALL_H);
  const stairs = (room.parts || []).filter((pt) => pt.id.startsWith('schody') && pt.frame).map((pt) => ({ x: pt.frame.x, y: pt.frame.y, floor: hororFloorNo(roomId) }));
  const M = { id: roomId, room, W, H, g, C, obst, obs, doors, doorAt, hides, fl, fh, ch, leg, drawers, pull, stairs: stairs.length ? stairs : null, lamps: [] };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = room.x + (i + 0.5) * C, y = room.y + (j + 0.5) * C;
    let code = base;
    if (room.parts) {
      const part = amongPartAt(room, x, y);
      if (part === 'vstup') code = 4;
      if (part && part.startsWith('schody')) { code = 4; fh[j * W + i] = hororHeightAt(M, x, y, true); ch[j * W + i] = HOROR.FL + HOROR.WALL_H; }
    }
    fl[j * W + i] = code;
  }
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
  if (room.parts) {   // kulaté lampy na chodbách: po chodbě co 180 px (jen nad místy, kam se dá dojít)
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      if (!reach[j * NW + i] || hororFree(M, room.x + (i + 0.5) * N, room.y + (j + 0.5) * N, 30) === false) continue;
      const c = { x: room.x + (i + 0.5) * N, y: room.y + (j + 0.5) * N };
      const part = amongPartAt(room, c.x, c.y);
      if (part && part.startsWith('schody')) continue;
      if (M.lamps.every((l) => hororDist(l, c) >= 180)) M.lamps.push(c);
    }
  }
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
// Nové kolo: klíče ve 3 náhodných třídách, Láďa nahoře, náhodné číslo pro obsah šuplíků (seed)
function hororMakeRound() {
  const pool = HOROR.KEY_ROOMS.filter((r) => r in HOROR_ROOMS()).slice(), keys = [];
  for (let k = 0; k < HOROR.KEYS; k++) {
    const room = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], M = hororMap(room);
    const s = hororRandomSpot(M, null) || { x: M.room.x + M.room.w / 2, y: M.room.y + M.room.h / 2 };
    keys.push({ room, x: s.x, y: s.y, got: false });
  }
  const ls = hororRandomSpot(hororMap(HOROR.LADA_START), null);
  return {
    keys, seed: Math.floor(Math.random() * 1e9),
    lada: { room: HOROR.LADA_START, x: ls.x, y: ls.y, a: 0, mode: 'patrol', path: [], via: null, goal: null, pathT: 0, lookT: 0, stepT: 0, seenT: 99, tg: '' },
  };
}
// Hráč na začátku kola (i = pořadí online hráče – ať nestojí na sobě)
function hororResetPlayer(H, i) {
  const k = i || 0;
  H.p = { ...HOROR.START, x: HOROR.START.x + ((k % 2) ? 1 : -1) * Math.ceil(k / 2) * 34 };
  Object.assign(H, { stamina: HOROR.STAMINA, tired: false, bob: 0, walk: 0, bat: 100, lightK: 1, pz: 0, ghost: false, hidden: null, hideSeen: false, doorCd: 0, fade: 0.4, breathT: 0, dark: 0, flicker: 1, scared: false });
}
function openHoror() {
  const r = hororMakeRound();
  state.horor = {
    phase: 'intro', t: 0, menuSel: 0, keys: r.keys, got: 0, seed: r.seed, lada: r.lada,
    open: new Set(), taken: new Set(), sp: {}, out: [], hs: {}, hidPrev: {}, net: null,
    msg: '', msgT: 0, caughtT: 0, overSel: 0, turnPtr: null, beatT: 0,
  };
  hororResetPlayer(state.horor, 0);
  if (audio.track !== 'horor') hororSnd.prevTrack = audio.track;   // „Zkusit znovu“ nesmí přepsat hudbu, ke které se vrátí
  audio.track = 'horor';
  updateMusic();
  input.events.length = 0;
  setScreen('horor');
}
function hororBegin() {
  const H = state.horor;
  H.phase = 'play'; H.t = 0; H.fade = 0;
  hororDrone(true);
  hororLock();
}
function hororLeave() {
  if (typeof hororNetLeave === 'function') hororNetLeave();   // online hra (40_horor_online.js)
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
const hororMe = () => (state.horor && state.horor.net ? mp.id : 'me');
// Je v šuplíku baterka? (podle čísla kola – online to vyjde všem stejně)
function hororDrawerHas(H, id) {
  let h = H.seed | 0;
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return hororHash(h, 977) < HOROR.BAT_CHANCE;
}
// Šuplík, u kterého stojím
function hororDrawerNear(H) {
  if (H.hidden || H.ghost) return null;
  let best = null, bd = HOROR.DRAWER_DIST;
  for (const d of hororMap(H.p.room).drawers) { const dd = hororRectDist(d.rect, H.p); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
// Co se stane, když stisknu E u šuplíku
function hororDrawerAction(H, d) {
  if (!H.open.has(d.id)) return { k: 'drw', id: d.id, label: 'Otevřít šuplík' };
  if (hororDrawerHas(H, d.id) && !H.taken.has(d.id)) return { k: 'take', id: d.id, label: 'Vzít baterku 🔋' };
  return { k: 'drw', id: d.id, label: 'Zavřít šuplík' };
}
// Moje akce: sám = hned, online = přes hostitele (40_horor_online.js)
function hororDo(d) {
  const H = state.horor;
  if (H.net && typeof hororNetDo === 'function') hororNetDo(H, d);
  else hororAct(H, hororMe(), d);
}
// Kde je hráč who (já nebo kamarád online)
function hororWho(H, who) {
  if (who === hororMe()) return { id: who, room: H.p.room, x: H.p.x, y: H.p.y, a: H.p.a };
  const o = typeof hororOthers === 'function' ? hororOthers().find((q) => q.id === who) : null;
  return o ? { id: who, room: o.r, x: o.x, y: o.y, a: o.ang } : null;
}
// Akce hráče who – provede ji ten, kdo řídí hru (sám / hostitel)
function hororAct(H, who, d) {
  const me = who === hororMe();
  H.sp[who] = H.sp[who] || 0;
  if (d.k === 'drw') {
    if (H.open.has(d.id)) H.open.delete(d.id); else H.open.add(d.id);
    if (me) hororNoise(0.22, 900, 0.3, 0);
  } else if (d.k === 'take') {
    if (!H.open.has(d.id) || H.taken.has(d.id) || !hororDrawerHas(H, d.id)) return;
    H.taken.add(d.id); H.sp[who]++;
    if (me) { hororTone(660, 0.12, 'triangle', 0.2); hororSay('🔋 Máš náhradní baterku (R = vyměnit)', 2.5); }
  } else if (d.k === 'use') {
    if (H.sp[who] <= 0) return;
    H.sp[who]--;
    if (me) { H.bat = 100; hororTone(880, 0.1, 'square', 0.12); hororSay('🔦 Nová baterka', 1.5); }
  } else if (d.k === 'give') {
    if (H.sp[who] <= 0 || typeof d.to !== 'string') return;
    H.sp[who]--; H.sp[d.to] = (H.sp[d.to] || 0) + 1;
  } else if (d.k === 'key') {
    const key = H.keys[d.i];
    if (!key || key.got) return;
    key.got = true; key.by = who;
    H.got = H.keys.filter((k) => k.got).length;
    if (me) {
      hororTone(988, 0.15, 'triangle', 0.25); hororTone(1319, 0.3, 'triangle', 0.2, 0, 0, 0.12);
      hororSay(H.got < HOROR.KEYS ? `🔑 Klíč ${H.got}/${HOROR.KEYS}` : '🔑 Máte všechny klíče! Utečte hlavním vchodem (přízemí, dole ve vstupní chodbě)!', 3.5);
    }
    if (H.got === 2 && !H.scared) { const t = hororWho(H, who); if (t) hororScare(H, t); }   // naháněčka
  } else if (d.k === 'exit') {
    if (H.got >= HOROR.KEYS) { H.st = 'win'; H.winBy = who; if (!H.net) hororWin(H); }
  }
}
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
// Vidí Láďa hráče t? (stejná místnost, není schovaný, dívá se jeho směrem nebo je blízko, nic mezi nimi)
function hororSeesT(L, t) {
  if (L.room !== t.room || t.hidden) return false;
  const d = hororDist(L, t);
  if (d > HOROR.LADA.SEE) return false;
  const facing = Math.abs(hororAngle(Math.atan2(t.y - L.y, t.x - L.x) - L.a)) < 1.3;
  if (!(facing || d < 170 || (L.mode === 'chase' && L.tg === t.id))) return false;
  const hit = hororCast(hororMap(L.room), L.x, L.y, Math.atan2(t.y - L.y, t.x - L.x), d);
  return hit.dist >= d - 4;
}
const hororSees = (H) => hororSeesT(H.lada, { id: hororMe(), room: H.p.room, x: H.p.x, y: H.p.y, hidden: !!H.hidden });
// Koho Láďa honí: já (když nejsem chycený) a online kamarádi, které ještě nechytil
function hororTargets(H) {
  const out = [];
  if (!H.ghost && H.phase !== 'caught' && H.p) out.push({ id: hororMe(), room: H.p.room, x: H.p.x, y: H.p.y, hidden: !!H.hidden, running: !!H.running });
  if (H.net && typeof hororOthers === 'function') {
    for (const o of hororOthers()) if (!H.out.includes(o.id) && !o.gh) out.push({ id: o.id, room: o.r, x: o.x, y: o.y, hidden: o.hh, running: o.hr });
  }
  return out;
}
// Chytil hráče id
function hororCatch(H, id) {
  const L = H.lada;
  if (!H.out.includes(id)) H.out.push(id);
  if (id === hororMe()) hororCaught(H);
  Object.assign(L, { mode: 'look', lookT: HOROR.LADA.LOOK, path: [], via: null, tg: '' });
}
// Láďa – řídí ho jen jeden (sám / online hostitel), ostatním přijde poloha
function hororLada(H, dt) {
  const L = H.lada, cfg = HOROR.LADA, T = hororTargets(H);
  let seen = null, sd = 1e9;
  for (const t of T) if (hororSeesT(L, t)) { const d = hororDist(L, t); if (d < sd) { sd = d; seen = t; } }
  L.seenT = seen ? 0 : L.seenT + dt;
  // zalezl do skříně: viděl to Láďa? (pak tam jde a vytáhne ho)
  for (const t of T) {
    if (t.hidden && !H.hidPrev[t.id]) {
      H.hs[t.id] = L.room === t.room && L.seenT < 0.6 && L.tg === t.id && hororDist(L, t) < 320;
      if (H.hs[t.id]) { L.mode = 'chase'; L.last = { room: t.room, x: t.x, y: t.y }; hororPlan(L, L.last); }
    }
    if (!t.hidden) H.hs[t.id] = false;
    H.hidPrev[t.id] = t.hidden;
  }
  const tg = T.find((t) => t.id === L.tg);
  if (seen) {
    L.mode = 'chase'; L.wasChase = true; L.tg = seen.id;
    L.last = { room: seen.room, x: seen.x, y: seen.y };
  } else if (tg && L.mode === 'chase' && tg.room !== L.room && L.last && L.last.room === L.room && L.seenT < 1.5) {   // viděl ho utíkat dveřmi → za ním
    L.last = { room: tg.room, x: tg.x, y: tg.y }; hororPlan(L, L.last);
  } else if (L.mode !== 'chase') {   // slyší běh – jde se podívat
    const heard = T.find((t) => t.room === L.room && t.running && hororDist(L, t) < cfg.HEAR);
    if (heard) { L.mode = 'check'; L.tg = heard.id; L.last = { room: heard.room, x: heard.x, y: heard.y }; hororPlan(L, L.last); }
  }
  L.pathT -= dt;
  if (L.mode === 'chase' && L.pathT <= 0) { L.pathT = 0.3; hororPlan(L, L.last); }
  // došel na cíl
  if (!L.path.length && !L.via) {
    if ((L.mode === 'chase' && !seen) || L.mode === 'check') {   // tady tě viděl naposledy – rozhlíží se
      L.mode = 'look'; L.lookT = cfg.LOOK;
    } else if (L.mode === 'look') {
      L.lookT -= dt; L.a += dt * 2.2;
      if (L.lookT <= 0) { L.mode = 'patrol'; L.wasChase = false; L.tg = ''; }
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
    L.room = L.via.to; L.x = th.x; L.y = th.y; L.a = th.a; L.via = null;
    if (L.goal) hororPlan(L, L.goal);
  }
  // chycení: venku, nebo ve skříni, když viděl, jak tam zalézá
  for (const t of T) {
    if (t.room !== L.room) continue;
    const d = hororDist(L, t);
    if ((d < cfg.CATCH && (!t.hidden || H.hs[t.id])) || (t.hidden && H.hs[t.id] && d < 40)) { hororCatch(H, t.id); return; }
  }
}
// Co z Láďi slyším a vidím (všichni – i online, kde ho řídí hostitel)
function hororLadaFx(H, dt) {
  const L = H.lada, p = H.p, me = hororMe(), same = L.room === p.room, d = same ? hororDist(L, p) : 9999;
  if (!H.ghost) {
    const chasing = L.mode === 'chase' && L.tg === me, checking = L.mode === 'check' && L.tg === me;
    if (chasing && !H.fxChase) { hororSting(); hororSay('Láďa tě vidí! UTÍKEJ!', 2.5); }
    if (checking && !H.fxCheck) hororSay('Láďa tě slyšel…', 2);
    if (chasing) H.fxWas = true;
    if (L.mode === 'patrol' && H.fxWas) { hororSay('Setřásl jsi ho… zatím.', 2.5); H.fxWas = false; }
    H.fxChase = chasing; H.fxCheck = checking;
  }
  if (H.fxRoom !== L.room) { if (H.fxRoom && (L.room === p.room || H.fxRoom === p.room)) hororDoorSnd(); H.fxRoom = L.room; }
  // kroky: ve stejné místnosti podle polohy, ze sousední potichu
  L.stepT = (L.stepT || 0) - dt;
  if (L.stepT <= 0) {
    L.stepT = L.mode === 'chase' ? 0.3 : 0.55;
    if (same && d < 700) {
      const rel = hororAngle(Math.atan2(L.y - p.y, L.x - p.x) - p.a);
      hororNoise(0.09, 140, Math.min(0.9, 60 / Math.max(40, d)) * 1.4, Math.sin(rel));
    } else if (hororMap(p.room).doors.some((dd) => dd.to === L.room)) hororNoise(0.09, 120, 0.12, 0);
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
  H.hidden = h; H.hideFrom = { x: H.p.x, y: H.p.y };   // jestli to Láďa viděl, pozná hororLada (H.hs)
  hororNoise(0.25, 300, 0.4, 0);
  hororSay(`Schovaný ${h.where}… E = vylézt`, 2.5);
}

// --- Krok hry ---
const HOROR_MENU = [{ x: 250, y: 430, w: 300, h: 44 }, { x: 250, y: 482, w: 300, h: 44 }, { x: 250, y: 534, w: 300, h: 44 }];
const HOROR_BAT_BTN = { x: 660, y: 396, w: 120, h: 60 }, HOROR_GIVE_BTN = { x: 660, y: 322, w: 120, h: 60 };
function updateHoror(dt) {
  const H = state.horor, keys = hororKeys.splice(0), events = input.events.splice(0);
  if (!H) return;
  H.t += dt;
  if (H.msgT > 0) H.msgT -= dt;
  if (H.fade > 0) H.fade -= dt;
  if (H.net && typeof hororNetTick === 'function' && hororNetTick(H, dt, keys, events) === false) return;   // online: síť, seznam her, čekárna
  const tapped = events.some((e) => e.type === 'action' || (e.x != null && !e.inJoyZone));
  if (H.phase === 'intro') {   // Hrát sám / S kamarády (online) / Zpět
    if (keys.includes('Escape')) { hororLeave(); return; }
    for (const k of keys) {
      if (KEYMAP.up.includes(k)) H.menuSel = (H.menuSel + 2) % 3;
      if (KEYMAP.down.includes(k)) H.menuSel = (H.menuSel + 1) % 3;
    }
    if (H.t < 0.3) return;
    for (const e of events) {
      const i = e.type === 'action' ? H.menuSel : e.x != null ? HOROR_MENU.findIndex((r) => pointInRect(e.x, e.y, r, 4)) : -1;
      if (i === 0) { hororBegin(); return; }
      if (i === 1 && typeof hororOnlinePick === 'function') { hororOnlinePick(H); return; }
      if (i === 2) { hororLeave(); return; }
    }
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
    if (H.net && H.phase === 'caught') { H.phase = 'play'; H.ghost = true; hororDrone(true); hororSay('👻 Chytil tě. Jsi duch – Láďa tě nevidí, pomáhej ostatním.', 5); return; }
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
  // E (tlačítko na mobilu): šuplík, jinak schovat / vylézt
  const hideTap = events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_HIDE_BTN, 6));
  if ((keys.includes('KeyE') || hideTap) && !H.ghost) {
    const dr = hororDrawerNear(H);
    if (dr) { const a = hororDrawerAction(H, dr); hororDo({ k: a.k, id: a.id }); } else hororToggleHide(H);
  }
  // baterka: vybíjí se; R = vyměnit za náhradní; G = půjčit kamarádovi (online)
  const mySp = H.sp[hororMe()] || 0;
  if (!H.ghost) {
    const before = H.bat;
    H.bat = Math.max(0, H.bat - dt * 100 / HOROR.BAT);
    if (before > 20 && H.bat <= 20) hororSay(mySp ? 'Baterka slábne… R = vyměnit' : 'Baterka slábne! Hledej novou v šuplících.', 3);
    if (before > 0 && H.bat <= 0) hororSay(mySp ? 'Baterka došla! R = vyměnit' : 'Baterka došla! Najdi novou v šuplíku.', 3.5);
  }
  H.lightK = H.ghost ? 1 : H.bat > 25 ? 1 : H.bat > 0 ? 0.3 + 0.7 * H.bat / 25 : 0;
  if ((keys.includes('KeyR') || events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_BAT_BTN, 6) && mySp > 0)) && !H.ghost && H.bat < 100) {
    if (mySp > 0) hororDo({ k: 'use' }); else hororSay('Nemáš náhradní baterku – hledej v šuplících.', 2);
  }
  const mate = typeof hororMateNear === 'function' ? hororMateNear(H) : null;
  if ((keys.includes('KeyG') || events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_GIVE_BTN, 6))) && mate && !H.ghost) {
    if (mySp > 0) { hororDo({ k: 'give', to: mate.id }); hororSay(`🔋 Půjčil jsi baterku: ${mate.n}`, 2); } else hororSay('Nemáš náhradní baterku na půjčení.', 2);
  }
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
  const fz = hororHeightAt(M, p.x, p.y, false);   // na schodech oči výš / níž
  H.pz += (fz - H.pz) * Math.min(1, dt * 14);
  // dveře: když do nich vejdeš, jsi v další místnosti (zamčené nepustí)
  H.doorCd -= dt;
  if (H.doorCd <= 0 && len > 0) {
    const mvx = Math.cos(p.a) * fwd - Math.sin(p.a) * side, mvy = Math.sin(p.a) * fwd + Math.cos(p.a) * side;
    for (const d of M.doors) {
      // blízko dveří (u schodů je zábradlí, proto 26 px) a jdu směrem k nim
      const qx = Math.max(d.x, Math.min(d.x + d.w, p.x)), qy = Math.max(d.y, Math.min(d.y + d.h, p.y));
      if (Math.hypot(qx - p.x, qy - p.y) > HOROR.RADIUS + 15 || (qx - p.x) * mvx + (qy - p.y) * mvy <= 0) continue;
      if (d.exit) {
        if (H.got >= HOROR.KEYS && !H.ghost) { hororDo({ k: 'exit' }); H.doorCd = 1; return; }
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
  H.keyCd = (H.keyCd || 0) - dt;
  H.keys.forEach((key, i) => {
    if (key.got || key.room !== p.room || hororDist(key, p) > 34 || H.ghost || H.keyCd > 0) return;
    H.keyCd = 0.5;
    hororDo({ k: 'key', i });
  });
  // světla blikají, když je Láďa blízko; po naháněčce chvíli tma
  const L = H.lada, dl = L.room === p.room ? hororDist(L, p) : 9999;
  if (H.dark > 0) { H.dark -= dt; H.flicker = H.dark > 0 ? 0.05 : 1; }
  else if (dl < 450 && Math.random() < dt * 3) H.flicker = 0.25 + Math.random() * 0.5;
  else if (H.bat > 0 && H.bat < 10 && !H.ghost && Math.random() < dt * 4) H.flicker = 0.3 + Math.random() * 0.4;   // dochází baterka
  else H.flicker += (1 - H.flicker) * Math.min(1, dt * 6);
  H.beatT -= dt;
  if (dl < 320 && H.beatT <= 0) {
    H.beatT = 0.35 + dl / 320 * 0.6;
    hororTone(60, 0.12, 'sine', 0.35); hororTone(55, 0.12, 'sine', 0.3, 0, 0, 0.16);
  }
  if (!H.net || (typeof hororIsHost === 'function' && hororIsHost())) hororLada(H, dt);   // online řídí Láďu hostitel
  if (state.horor === H && H.phase !== 'caught') hororLadaFx(H, dt);
}
function hororPlayerThrough(H, d) {
  const p = H.p, from = p.room, th = hororThrough({ ...d, from });
  p.room = d.to; p.x = th.x; p.y = th.y; p.a = th.a;   // Láďa za tebou dveřmi: hororLada (viděl tě utíkat)
  H.pz = hororHeightAt(hororMap(d.to), p.x, p.y, false);
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
function hororScare(H, t) {
  H.scared = true;
  H.sc = { n: ((H.sc && H.sc.n) || 0) + 1, id: t.id };   // online: hráč t pozná, že je to on (40_horor_online.js)
  if (t.id === hororMe()) hororScareFx(H);
  const p = t, M = hororMap(p.room);
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
    Object.assign(H.lada, { room: p.room, x: spot.x, y: spot.y, mode: 'chase', tg: t.id, last: { room: p.room, x: p.x, y: p.y }, seenT: 0, pathT: 0, via: null });
    hororPlan(H.lada, H.lada.last);
  }
}
function hororScareFx(H) { H.dark = 1.6; hororSting(); hororSay('Někdo je za tebou…', 3); }

// --- Kreslení ---
// Kde má postava z drawFigure oči (od nohou, px postavy): stejný výpočet hlavy jako v drawFigure
function hororEyes(phase, blend) {
  const step = Math.sin(phase) * blend, sway = step * CONFIG.PLAYER_SWAY, size = CONFIG.PLAYER_HEAD_SIZE;
  const neckX = Math.round(Math.sin(sway) * 26), bob = Math.round(Math.abs(step) * 1.5);
  const hy = -13 - 24 - size + 5 - bob;
  return { x: neckX, y: hy + size * 0.46, dx: size * 0.17 };
}
// Světlo baterky: kužel uprostřed, dosvit podle baterky (H.lightK); trochu světla i mimo (ať se člověk neztrácí)
const hororCone = (cam) => Math.max(0, Math.min(1, 1 - (Math.abs(cam) - 0.38) / 0.67));
const hororLightAt = (H, dist, cam) => {
  const k = H.lightK === undefined ? 1 : H.lightK;
  const near = k > 0 ? Math.pow(Math.max(0, 1 - dist / (HOROR.LIGHT * Math.max(0.2, k))), 1.15) : 0;
  const amb = Math.max(0.04, 0.17 - dist / 7000) * (k > 0 ? 1 : 0.75);
  return Math.max(amb, hororCone(cam) * near) * H.flicker;
};
const HOROR_HIDE_BTN = { x: 660, y: 470, w: 120, h: 60 };
// Textury podlahy a stropu (kód z mapy místnosti → barva), hash = náhodné kamínky / prkna
const hororHash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const hororMod = (v, m) => ((v % m) + m) % m;
function hororFloorTex(code, wx, wy, out) {
  let r, g, b;
  if (code === 1) {   // teraco: kamínky a spáry po 40 px
    const h = hororHash(Math.floor(wx / 2.5), Math.floor(wy / 2.5)), d = h < 0.12 ? -72 : h > 0.94 ? 30 : (h - 0.5) * 18;
    const seam = hororMod(wx, 40) < 1.6 || hororMod(wy, 40) < 1.6 ? -32 : 0;
    r = 176 + d + seam; g = 170 + d + seam; b = 158 + d + seam;
  } else if (code === 2) {   // parkety (prkna 12 × 48 px)
    const row = Math.floor(wy / 12), col = Math.floor((wx + row * 17) / 48), h = hororHash(row, col) - 0.5;
    const seam = hororMod(wy, 12) < 1.2 || hororMod(wx + row * 17, 48) < 1.2 ? -40 : 0;
    r = 150 + h * 36 + seam; g = 108 + h * 26 + seam; b = 66 + h * 18 + seam;
  } else if (code === 3) {   // dlaždice na WC
    const seam = hororMod(wx, 24) < 1.5 || hororMod(wy, 24) < 1.5 ? -60 : 0;
    r = 214 + seam; g = 216 + seam; b = 218 + seam;
  } else if (code === 4) {   // kámen (vstupní chodba, podesty)
    const h = hororHash(Math.floor(wx / 3), Math.floor(wy / 3)), d = (h - 0.5) * 22;
    r = 166 + d; g = 164 + d; b = 160 + d;
  } else if (code === 5) {   // prkna v aule
    const col = Math.floor(wx / 14), h = hororHash(col, Math.floor((wy + col * 23) / 90)) - 0.5, seam = hororMod(wx, 14) < 1.2 ? -36 : 0;
    r = 140 + h * 30 + seam; g = 96 + h * 22 + seam; b = 56 + h * 14 + seam;
  } else { r = 60; g = 60; b = 60; }
  out[0] = r; out[1] = g; out[2] = b;
}
function hororCeilTex(code, wx, wy, out) {
  if (code === 1 || code === 4) {   // chodby: klenby – žebra po 190 px
    const rib = hororMod(wx, 190) < 9 || hororMod(wy, 190) < 9 ? 0.8 : 1;
    out[0] = 236 * rib; out[1] = 236 * rib; out[2] = 232 * rib;
  } else { out[0] = 238; out[1] = 236; out[2] = 230; }
}
let HOROR_FB = null;
function hororFloorBuf(w, h) {
  if (!HOROR_FB || HOROR_FB.width !== w || HOROR_FB.height !== h) {
    HOROR_FB = document.createElement('canvas');
    HOROR_FB.width = w; HOROR_FB.height = h;
    HOROR_FB.c2 = HOROR_FB.getContext('2d');
    HOROR_FB.img = HOROR_FB.c2.createImageData(w, h);
  }
  return HOROR_FB;
}
// Podlaha (výška 0) a strop (HOROR.WALL_H) do malého obrázku (1 bod = sloupec paprsku × HOROR.ROW px), pak roztáhnout.
// Schody, díry a nábytek se kreslí přes to (hororColumn); oko je ve výšce E (na schodech výš).
function hororDrawFloor(H, M, cols, rays, horizon, proj, left, width, Ht, E) {
  const RS = HOROR.ROW, rows = Math.ceil(Ht / RS), FB = hororFloorBuf(cols, rows), data = FB.img.data, col = [0, 0, 0];
  const p = H.p, C = M.C, rx = M.room.x, ry = M.room.y, maxD = HOROR.LIGHT + 300, ceilOk = E < HOROR.WALL_H - 2;
  for (let r = 0; r < rows; r++) {
    const sy = (r + 0.5) * RS, floor = sy > horizon;
    const dz = floor ? sy - horizon : horizon - sy;
    const base = dz < 0.5 || (!floor && !ceilOk) ? Infinity : (floor ? E : HOROR.WALL_H - E) * proj / dz;
    for (let i = 0; i < cols; i++) {
      const o = (r * cols + i) * 4, ray = rays[i];
      if (base > maxD) { data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 255; continue; }
      const along = base / ray.cos, wx = p.x + ray.dx * along, wy = p.y + ray.dy * along;
      const ci = Math.floor((wx - rx) / C), cj = Math.floor((wy - ry) / C);
      const code = ci >= 0 && cj >= 0 && ci < M.W && cj < M.H ? M.fl[cj * M.W + ci] : 0;
      if (floor) hororFloorTex(code, wx, wy, col); else hororCeilTex(code, wx, wy, col);
      const l = hororLightAt(H, base, ray.cam) * (floor ? 1 : 0.55);
      data[o] = col[0] * l; data[o + 1] = col[1] * l; data[o + 2] = col[2] * l; data[o + 3] = 255;
    }
  }
  FB.c2.putImageData(FB.img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(FB, left, 0, width, rows * RS);
  ctx.restore();
}
// Patro místnosti (pro šipku na schodech)
const hororFloorNo = (id) => (id === 'patroA2' ? 2 : id === 'patroA' ? 1 : 0);
// Nápis nad dveřmi: kam vedou
function hororSignText(M, d) {
  if (d.exit) return { t: 'VÝCHOD', c: [30, 130, 60] };
  if (d.hidden) {   // konec schodů
    const up = hororFloorNo(d.to) > hororFloorNo(M.id);
    return { t: `${up ? '↑' : '↓'} ${ROOMS[d.to].name}`, c: [40, 90, 60] };
  }
  return d.open ? { t: ROOMS[d.to].name, c: [30, 60, 140] } : { t: `🔒 ${ROOMS[d.to].name}`, c: [80, 80, 90] };
}
// Jedna věc v pohledu (cedulka, lampa, baterka, klíč, kamarád, Láďa)
function hororSprite(H, M, s, d, perp, sx, l0, fh, horizon, proj, E) {
  const hy = (h) => horizon - (fh + h - E) / perp * proj, feet = hy(0);
  if (s.kind === 'sign') {   // cedulka nad dveřmi (čitelná i v šeru)
    if (d > 760) return;
    const st = hororSignText(M, s.d), l = Math.max(0.5, l0), fs = Math.max(7, Math.min(26, 15 / perp * proj * 0.6));
    const sb = hororHeightAt(M, s.d.ix, s.d.iy, true), y = horizon - (sb + 122 - E) / perp * proj;
    ctx.font = `bold ${Math.round(fs)}px sans-serif`;
    const tw = ctx.measureText(st.t).width + fs;
    ctx.fillStyle = `rgb(${st.c[0] * l | 0}, ${st.c[1] * l | 0}, ${st.c[2] * l | 0})`;
    ctx.fillRect(sx - tw / 2, y - fs * 0.75, tw, fs * 1.5);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * l})`; ctx.lineWidth = Math.max(1, fs / 10); ctx.strokeRect(sx - tw / 2, y - fs * 0.75, tw, fs * 1.5);
    ctx.fillStyle = `rgb(${255 * l | 0}, ${255 * l | 0}, ${255 * l | 0})`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(st.t, sx, y + 1);
    return;
  }
  if (s.kind === 'lamp') {   // kulatá lampa na šňůře (v noci zhasnutá)
    const l = Math.max(0.12, l0), r = 9 / perp * proj, gy = hy(108);
    ctx.strokeStyle = `rgba(20, 20, 20, ${0.9 * l})`; ctx.lineWidth = Math.max(1, 0.8 / perp * proj);
    ctx.beginPath(); ctx.moveTo(sx, hy(HOROR.WALL_H)); ctx.lineTo(sx, gy - r); ctx.stroke();
    ctx.fillStyle = `rgb(${236 * l | 0}, ${236 * l | 0}, ${230 * l | 0})`;
    ctx.beginPath(); ctx.arc(sx, gy, r, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (s.kind === 'bat') {   // baterka v otevřeném šuplíku – svítí, ať jde vidět
    const y = horizon - (s.h - E) / perp * proj, size = Math.max(10, Math.min(44, 26 / perp * proj * 0.5));
    const g = ctx.createRadialGradient(sx, y, 1, sx, y, size * 1.4);
    g.addColorStop(0, 'rgba(120, 255, 140, 0.5)'); g.addColorStop(1, 'rgba(120, 255, 140, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, y, size * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔋', sx, y);
    return;
  }
  const l = Math.max(l0, s.kind === 'key' ? 0.35 : s.kind === 'mate' ? 0.3 : 0);
  if (s.kind === 'key') {
    const size = Math.max(10, 34 / perp * proj * 0.35), y = hy(30) + Math.sin(H.t * 3) * 3;
    const g = ctx.createRadialGradient(sx, y, 2, sx, y, size * 1.6);
    g.addColorStop(0, 'rgba(255, 220, 90, 0.55)'); g.addColorStop(1, 'rgba(255, 220, 90, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, y, size * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔑', sx, y);
    return;
  }
  if (s.kind === 'mate') {   // kamarád (online): postava, jméno, baterka
    const o = s.o, scale = (106 / perp * proj) / 80;
    ctx.save();
    if ('filter' in ctx) ctx.filter = `brightness(${Math.max(0.3, l).toFixed(2)})`;
    ctx.translate(sx, feet); ctx.scale(scale, scale);
    drawFigure(0, 0, o.phase, o.blend, remoteLook(o));
    ctx.restore();
    drawOutlinedText(`${o.n}${o.hb !== undefined ? ` 🔋${o.hb}%` : ''}`, sx, hy(124), `bold ${Math.round(Math.max(10, Math.min(16, 14 / perp * proj * 0.4)))}px sans-serif`, '#ffffff', 'middle');
    return;
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
// Jeden sloupec obrazovky: paprsek po mřížce OD NEJBLIŽŠÍHO. Každá buňka má podlahu (výška M.fh, na ní
// nábytek do výšky f.h) a strop (M.ch). Kreslí se přední stěny stupňů / nábytku, jejich vršky, překlady
// nad schodištěm a nakonec zeď. Otevřené místo na obrazovce je mezi ytop a ybot. Zábradlí, stoly a
// vytažené šuplíky jsou průhledné (je vidět mezi nohama) – kreslí se nakonec od nejvzdálenějšího.
const HOROR_COL = { ovl: [], samp: new Float32Array(400 * 3 * 96), n: new Int16Array(400) };   // samp: kde je co zakryté (pro postavy a klíče)
function hororColumn(H, M, ray, x, cw, horizon, proj, E, Ht, ci) {
  const C = M.C, W = M.W, px = (H.p.x - M.room.x) / C, py = (H.p.y - M.room.y) / C, dx = ray.dx, dy = ray.dy, cos = ray.cos;
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9)), stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  let sx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sy = (dy < 0 ? py - my : my + 1 - py) * ddy;
  const Y = (d, h) => horizon + (E - h) / d * proj;
  const ovl = HOROR_COL.ovl;
  ovl.length = 0;
  const SM = HOROR_COL.samp, sOff = ci * 3 * 96;
  let ns = 0;
  let ytop = 0, ybot = Ht, cell = my * W + mx;
  const inMap = mx >= 0 && my >= 0 && mx < W && my < M.H;
  let prevBase = inMap ? M.fh[cell] : 0, prevF = prevBase, prevC = inMap ? M.ch[cell] : HOROR.WALL_H, prevPaint = 0, prevFur = null, prevOb = -1, d0 = 0.6, zb = 1600, pend = null;
  const light = (d) => hororLightAt(H, d, ray.cam);
  const fill = (c, k, a, b) => {   // svislý pruh barvy c (× k) mezi y a, b – jen v otevřeném místě
    const y0 = Math.max(ytop, Math.min(a, b)), y1 = Math.min(ybot, Math.max(a, b));
    if (y1 <= y0 || k < 0.01) return;
    ctx.fillStyle = `rgb(${Math.min(255, c[0] * k) | 0}, ${Math.min(255, c[1] * k) | 0}, ${Math.min(255, c[2] * k) | 0})`;
    ctx.fillRect(x, y0, cw, y1 - y0);
  };
  let side = 0, t = 0;
  for (let k = 0; k < 400; k++) {
    if (sx < sy) { t = sx; sx += ddx; mx += stepX; side = 0; } else { t = sy; sy += ddy; my += stepY; side = 1; }
    const d1 = Math.max(0.6, t * C * cos);
    if (pend) { pend.d1 = d1; pend = null; }
    // vršek a strop buňky, kterou paprsek právě opustil (od d0 do d1)
    if (prevF < E && prevPaint) fill(prevPaint === 3 ? prevFur.c : [196, 194, 188], light((d0 + d1) / 2) * (prevPaint === 3 ? 1.15 : prevBase < 0 ? 0.7 : 1), Y(d1, prevF), Y(d0, prevF));
    ybot = Math.min(ybot, Y(d0, prevF), Y(d1, prevF));
    if (prevC > E && prevC !== HOROR.WALL_H) fill([18, 18, 20], light(d1), Y(d0, prevC), Y(d1, prevC));   // vysoký strop schodiště (tma)
    ytop = Math.max(ytop, Y(d0, prevC), Y(d1, prevC));
    d0 = d1;
    if (ytop >= ybot) { zb = d1; break; }
    if (t * C > 1600) break;
    const u = side ? px + dx * t : py + dy * t;
    if (mx < 0 || my < 0 || mx >= W || my >= M.H) { hororWallFace(H, M, { type: 3, side, u, cell: -1 }, d1, ray.cam, x, cw, Y, prevBase, prevC, fill, light(d1)); zb = d1; break; }
    cell = my * W + mx;
    const v = M.g[cell];
    if (v === 1 || v === 3 || v === 4 || v === 5) {
      const bx = M.room.x + (px + dx * (t - 0.08)) * C, by = M.room.y + (py + dy * (t - 0.08)) * C;
      hororWallFace(H, M, { type: v, side, u, cell, part: M.room.parts ? amongPartAt(M.room, bx, by) : null }, d1, ray.cam, x, cw, Y, prevBase, prevC, fill, light(d1) * (side ? 0.72 : 1));
      zb = d1; break;
    }
    const base = M.fh[cell], c = M.ch[cell], ob = M.obst[cell], fur = ob >= 0 ? M.obs[ob].f : null;
    let f = base, paint = base !== 0 ? 1 : 0;
    const l = light(d1) * (side ? 0.72 : 1);
    if (fur && !fur.thin) { f = base + fur.h; paint = 3; }
    // přední stěna: stupeň nahoru / nábytek / okraj díry
    if (f > prevF) {
      if (paint === 3) { if (ob !== prevOb) hororBoxFace(M, ob, fur, d1, u, side, Y, base, prevF, f, fill, l); }
      else { fill([150, 148, 142], l * 0.8, Y(d1, f), Y(d1, prevF)); fill([90, 88, 84], l, Y(d1, f), Y(d1, f) + Math.max(1, 1.5 / d1 * proj)); }   // podstupnice a hrana
    }
    ybot = Math.min(ybot, Y(d1, Math.max(f, prevF)));
    if (c < prevC) { fill(hororStyle(M.id, null).top, l, Y(d1, prevC), Y(d1, c)); ytop = Math.max(ytop, Y(d1, c)); }   // překlad nad vchodem na schodiště
    // průhledné věci – nakreslí se nakonec
    if (ns < 96) { SM[sOff + ns * 3] = d1; SM[sOff + ns * 3 + 1] = ytop; SM[sOff + ns * 3 + 2] = ybot; ns++; }
    const lt = light(d1 + 5);   // vršky bez stínu podle strany (jinak šachovnice)
    if (fur && fur.thin) ovl.push(pend = { d0: d1, d1: d1 + 10, u, side, base, fur, cell, front: ob !== prevOb, ytop, ybot, l, lt });
    else if (M.pull[cell] >= 0 && H.open && H.open.has(M.drawers[M.pull[cell]].id)) ovl.push(pend = { d0: d1, d1: d1 + 10, u, side, base, pull: M.drawers[M.pull[cell]], ytop, ybot, l, lt });
    if (ytop >= ybot) { zb = d1; break; }
    prevBase = base; prevF = f; prevC = c; prevPaint = paint; prevFur = fur; prevOb = ob;
  }
  HOROR_COL.n[ci] = ns;
  // průhledné věci od nejvzdálenější: zábradlí (madlo + tyčky), stoly (deska + nohy), vytažené šuplíky
  for (let i = ovl.length - 1; i >= 0; i--) {
    const o = ovl[i], d = o.d0, l = o.l;
    ytop = o.ytop; ybot = o.ybot;
    if (o.pull) {   // vytažený šuplík: přední čelo a tmavé vnitřky
      const p = o.pull;
      fill(p.c, l * 1.05, Y(d, p.hi), Y(d, p.lo));
      if (p.hi < E) fill([60, 42, 26], o.lt, Y(o.d1, p.hi), Y(d, p.hi));
      continue;
    }
    const f = o.fur, top = o.base + f.h, uu = o.u - Math.floor(o.u);
    if (f.rail) {
      fill([120, 80, 46], l, Y(d, top), Y(d, top - 5));
      if (Math.floor(o.u * 2.5) % 2 === 0 && uu > 0.15 && uu < 0.6) fill([30, 30, 34], l, Y(d, top), Y(d, o.base));
      continue;
    }
    // stůl: noha v rohu, deska (přední hrana + vršek)
    if (M.leg[o.cell] && uu > 0.3 && uu < 0.75) fill(f.c, l * 0.55, Y(d, top - 5), Y(d, o.base));
    if (o.front) fill(f.c, l * 0.85, Y(d, top), Y(d, top - 5));
    if (top < E) fill(f.c, o.lt * 1.15, Y(o.d1, top), Y(d, top));
    if (o.front) fill([255, 255, 255], l * 0.55, Y(d, top), Y(d, top) + 1.5);   // světlá hrana desky
  }
  return zb;
}
// Přední stěna nábytku (s hranami, ať je vidět tvar); u stolků a komod šuplíky s úchytkami
function hororBoxFace(M, ob, fur, d, u, side, Y, base, from, top, fill, l) {
  const uu = u - Math.floor(u), o = M.obs[ob];
  // hrana: sousední buňka podél stěny už není ten samý kus nábytku
  let edge = false;
  if (uu < 0.12 || uu > 0.88) {
    const r = o.rect, wpos = (side ? M.room.x : M.room.y) + u * M.C;
    edge = side ? (wpos - r.x < 2 || r.x + r.w - wpos < 2) : (wpos - r.y < 2 || r.y + r.h - wpos < 2);
  }
  const k = edge ? 0.6 : 1;
  fill(fur.c, l * k, Y(d, top), Y(d, from));
  fill(fur.c, Math.min(1.6, l * 1.35 + 0.08), Y(d, top), Y(d, top - 2.5));   // osvětlená horní hrana
  fill([20, 20, 22], l, Y(d, base + 4), Y(d, base));   // stín u podlahy
  if (fur.drawers && !edge) {   // šuplíky: spáry a úchytky
    const r = o.rect, wpos = (side ? M.room.x : M.room.y) + u * M.C, rel = side ? (wpos - r.x) / r.w : (wpos - r.y) / r.h;
    for (const [lo, hi] of fur.drawers) {
      fill([30, 22, 14], l, Y(d, base + hi), Y(d, base + hi) + 1.2);
      if (rel > 0.42 && rel < 0.58) fill([200, 190, 160], l * 1.2, Y(d, base + (lo + hi) / 2 + 2), Y(d, base + (lo + hi) / 2 - 2));
    }
  }
}
// Zeď / dveře / konec schodů / okraj mapy (od výšky base do výšky ceil)
function hororWallFace(H, M, hit, perp, cam, x, cw, Y, base, ceil, fill, l) {
  if (l < 0.01) return;
  const u = hit.u - Math.floor(hit.u), seam = (Math.floor(hit.u) % 8 === 0 && u < 0.18) ? 0.6 : 1;
  const hy = (h) => Y(perp, base + h), top = Y(perp, ceil), bot = Y(perp, base);
  const ws = hororStyle(M.id, hit.part || (M.room.parts ? amongPartAt(M.room, H.p.x, H.p.y) : null));
  if (hit.type === 4 || hit.type === 5) {
    const d = M.doors[M.doorAt[hit.cell]] || {}, dtop = hy(105);
    const wpos = (hit.side ? M.room.x : M.room.y) + hit.u * M.C, du = d.x !== undefined ? (hit.side ? (wpos - d.x) / d.w : (wpos - d.y) / d.h) : u;
    fill(ws.top, l, top, dtop);
    if (hit.type === 5) {   // konec schodů: chodba dalšího patra ve tmě
      fill([12, 12, 14], 1, dtop, bot);
      fill([150, 148, 142], l * 0.35, bot - (bot - dtop) * 0.12, bot);
      return;
    }
    const dc = d.exit ? (H.got >= HOROR.KEYS ? [120, 200, 120] : [110, 92, 70]) : d.open ? [236, 236, 230] : [120, 112, 100];
    const frame = du < 0.06 || du > 0.94;
    fill(dc, l * (frame ? 0.55 : 1), dtop, bot);
    if (!frame && !d.exit) {   // prosklené výplně (jako školní dveře na fotkách) a klika
      if ((du > 0.16 && du < 0.44) || (du > 0.56 && du < 0.84)) {
        const g = d.open ? [72, 86, 98] : [60, 62, 68];
        fill(g, l, hy(98), hy(70)); fill(g, l, hy(64), hy(46));
      }
      if (du > 0.8 && du < 0.86) fill([200, 170, 60], l, hy(52), hy(48));
    }
    return;
  }
  // zeď podle dílu: nahoře světlá (ve vstupu okrová s krémovými plochami), dole sokl, pruh / lišta
  const low = hy(ws.lowH);
  fill(ws.top, l * seam, top, low);
  if (ws.panel && u > 0.12 && u < 0.88 && (Math.floor(hit.u) % 7) > 0) fill(ws.panel, l, hy(122), hy(60));
  fill(ws.low, l * seam, low, bot);
  if (ws.panel) fill(ws.band, l, hy(ws.lowH + ws.bandH), low); else fill(ws.band, l, hy(ws.bandH), bot);
}
// Výška podlahy pod bodem (na schodech; přesně = plynule pro kameru, jinak po stupních)
function hororHeightAt(M, x, y, steps) {
  if (!M.stairs) return 0;
  for (const s of M.stairs) {
    const lx = x - s.x, ly = y - s.y;
    if (lx >= 0 && ly >= 0 && lx < 320 && ly < 340) return hororStairH(s.floor, lx, ly, steps);
  }
  return 0;
}
// Schodiště A (02_mistnosti.js, SCHODY_A): 1. rameno nahoru (x 200–300), podesta, 2. rameno doleva,
// podesta, 3. rameno (x 20–120) až do patra. V patrech je vidět dolů na ramena pod sebou (díry).
function hororStairH(floor, lx, ly, steps) {
  const FL = HOROR.FL, RISE = FL / 24, s1 = RISE * 10, s2 = RISE * 14;
  const q = (along) => (steps ? Math.floor(along / 20) + 0.5 : along / 20) * RISE;   // stupeň 20 px
  if (lx < 20 || lx >= 300 || ly < 20 || ly >= 320) return 0;
  let g0;
  const mirror = lx >= 120 && lx < 200 && ly >= 120;
  if (lx >= 200) g0 = ly >= 120 ? Math.min(s1, q(320 - ly)) : s1;
  else if (lx >= 120) g0 = ly < 120 ? s1 + Math.min(s2 - s1, q(200 - lx)) : 0;
  else g0 = ly < 120 ? s2 : s2 + Math.min(FL - s2, q(ly - 120));
  if (floor === 0) return g0;
  if (floor === 1) return lx < 200 && ly >= 120 ? g0 - FL : g0;
  return mirror ? -2 * FL : g0 - FL;
}
function renderHoror() {
  const H = state.horor;
  if (!H) return;
  if (!H.p) { drawHororHud(H); return; }
  const p = H.p, M = hororMap(p.room), wide = VIEW.offX, left = -wide, width = CONFIG.WIDTH + 2 * wide, Ht = CONFIG.HEIGHT;
  const shake = H.phase === 'caught' && H.caughtT < 1.4 ? (Math.random() - 0.5) * 22 : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);
  ctx.fillStyle = '#000000';
  ctx.fillRect(left - 20, -20, width + 40, Ht + 40);
  const horizon = Ht / 2 + H.bob, tanF = Math.tan(HOROR.FOV / 2), proj = (width / 2) / tanF, E = HOROR.EYE + (H.pz || 0);
  const cols = Math.ceil(width / HOROR.COL_W), rays = [];
  for (let i = 0; i < cols; i++) {
    const cam = (i + 0.5) / cols * 2 - 1, ra = p.a + Math.atan(cam * tanF);
    rays.push({ cam, ra, dx: Math.cos(ra), dy: Math.sin(ra), cos: Math.cos(ra - p.a) });
  }
  hororDrawFloor(H, M, cols, rays, horizon, proj, left, width, Ht, E);
  const zbuf = new Float32Array(cols);
  for (let i = 0; i < cols; i++) zbuf[i] = hororColumn(H, M, rays[i], left + i * HOROR.COL_W, HOROR.COL_W + 1, horizon, proj, E, Ht, i);
  const clipAt = (ci, d) => {   // co je ve vzdálenosti d v tomhle sloupci vidět (schody, nábytek a překlady zakrývají)
    const SM = HOROR_COL.samp, o = ci * 3 * 96;
    let a = 0, b = Ht;
    for (let k = 0; k < HOROR_COL.n[ci] && SM[o + k * 3] <= d; k++) { a = SM[o + k * 3 + 1]; b = SM[o + k * 3 + 2]; }
    return [a, b];
  };
  // cedulky nad dveřmi, lampy, klíče, baterky v šuplících, ostatní hráči a Láďa (od nejvzdálenějšího)
  const sprites = H.keys.filter((k) => !k.got && k.room === p.room).map((k) => ({ ...k, kind: 'key' }));
  if (H.phase !== 'caught' && H.lada.room === p.room) sprites.push({ x: H.lada.x, y: H.lada.y, kind: 'lada' });
  for (const d of M.doors) {
    if ((d.ix - d.cx) * (p.x - d.cx) + (d.iy - d.cy) * (p.y - d.cy) <= 0) continue;   // jen ze strany místnosti
    const half = Math.min(d.w, d.h) / 2, vx = d.ix - d.cx, vy = d.iy - d.cy, vl = Math.hypot(vx, vy) || 1;
    sprites.push({ x: d.cx + vx / vl * half, y: d.cy + vy / vl * half, kind: 'sign', d });
  }
  for (const lamp of M.lamps) sprites.push({ x: lamp.x, y: lamp.y, kind: 'lamp' });
  for (const dr of M.drawers) if (H.open && H.open.has(dr.id) && hororDrawerHas(H, dr.id) && !H.taken.has(dr.id)) sprites.push({ x: dr.px, y: dr.py, kind: 'bat', h: dr.hi - 4 });
  if (typeof hororOthers === 'function') for (const o of hororOthers()) if (o.r === p.room && !o.hh && (!o.gh || H.ghost)) sprites.push({ x: o.dx, y: o.dy, kind: 'mate', o });
  sprites.sort((a, b) => hororDist(b, p) - hororDist(a, p));
  for (const s of sprites) {
    const d = hororDist(s, p), ang = hororAngle(Math.atan2(s.y - p.y, s.x - p.x) - p.a);
    if (Math.abs(ang) > HOROR.FOV / 2 + 0.25 || d < 8) continue;
    const perp = d * Math.cos(ang), sx = left + width / 2 + Math.tan(ang) * proj;
    const col = Math.max(0, Math.min(cols - 1, Math.floor((sx - left) / HOROR.COL_W)));
    if (perp > zbuf[col] + (s.kind === 'sign' ? 14 : 6)) continue;   // za zdí
    const cam = Math.tan(ang) / tanF, l0 = hororLightAt(H, perp, cam), fh = s.kind === 'lamp' || s.kind === 'sign' ? 0 : hororHeightAt(M, s.x, s.y, false);
    const [ca, cb] = clipAt(col, perp - 4);
    if (cb - ca < 2) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(left - 50, ca, width + 100, cb - ca); ctx.clip();
    hororSprite(H, M, s, d, perp, sx, l0, fh, horizon, proj, E);
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(left + width / 2, Ht / 2, Ht * 0.3, left + width / 2, Ht / 2, width * 0.66);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)'); vg.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = vg; ctx.fillRect(left, 0, width, Ht);
  if (H.ghost) { ctx.fillStyle = 'rgba(120, 0, 0, 0.22)'; ctx.fillRect(left, 0, width, Ht); }   // chycený (online) = duch
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
    // baterka a náhradní baterky
    const sp = H.sp[hororMe()] || 0;
    if (!H.ghost) {
      drawOutlinedText(`🔦 ${Math.ceil(H.bat)} %${sp ? `   🔋×${sp}${keysHint ? ' (R)' : ''}` : ''}`, 90, 106, 'bold 11px sans-serif', H.bat < 20 ? '#ff8a80' : '#cfcfcf', 'middle');
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(20, 116, 140, 9);
      ctx.fillStyle = H.bat < 10 ? '#e53935' : H.bat < 25 ? '#ff9800' : '#ffe082';
      ctx.fillRect(20, 116, 140 * H.bat / 100, 9);
    }
    if (typeof drawHororMates === 'function') drawHororMates(H);   // online: kdo hraje (40_horor_online.js)
    drawOutlinedText(hororRoomName(H.p.room), W / 2, 22, 'bold 14px sans-serif', '#9e9e9e', 'middle');
    if (H.msgT > 0) drawOutlinedText(H.msg, W / 2, 110, 'bold 22px sans-serif', /^Láďa/.test(H.msg) ? '#ff5a4a' : '#ffffff', 'middle');
    // šuplík / schovat se: nápověda (E) nebo tlačítko na mobilu
    const dr = hororDrawerNear(H), hn = dr ? null : hororHideNear(H);
    if (dr) {
      const a = hororDrawerAction(H, dr);
      if (keysHint) drawOutlinedText(`E – ${a.label}`, W / 2, Ht - 60, 'bold 18px sans-serif', '#ffd54a', 'middle');
      else drawChessButton(HOROR_HIDE_BTN, a.label, false, '#5a4632');
    } else if ((H.hidden || hn) && !H.ghost) {
      const label = H.hidden ? 'Vylézt' : `Schovat se`;
      if (keysHint) drawOutlinedText(`E – ${label}${hn ? ` (${hn.where})` : ''}`, W / 2, Ht - 60, 'bold 18px sans-serif', '#ffd54a', 'middle');
      else drawChessButton(HOROR_HIDE_BTN, `🫣 ${label}`, false, '#4a3a28');
    }
    if (!keysHint && sp > 0 && H.bat < 60 && !H.ghost) drawChessButton(HOROR_BAT_BTN, '🔋 Vyměnit', false, '#3d5a2a');
    const mate = typeof hororMateNear === 'function' ? hororMateNear(H) : null;
    if (mate && sp > 0 && !H.ghost) {
      if (keysHint) drawOutlinedText(`G – půjčit baterku: ${mate.n}`, W / 2, Ht - 86, 'bold 15px sans-serif', '#a5d6a7', 'middle');
      else drawChessButton(HOROR_GIVE_BTN, '🔋 Půjčit', false, '#2a4a5a');
    }
    if (H.t < 7 && H.phase === 'play') drawOutlinedText(keysHint ? 'WASD – chůze · myš – otáčení · Shift – sprint · E – šuplík / schovat · R – baterka · Esc – pauza' : 'Joystick – chůze · táhni vpravo – otáčení', W / 2, Ht - 24, 'bold 13px sans-serif', '#cfcfcf', 'middle');
  }
  if (H.phase === 'intro') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('👻 BACHA NA LÁĎU', W / 2, 130, 'bold 46px sans-serif', '#ff4d4d', 'middle');
    ['Je noc. Zůstal jsi zamčený v budově A.', 'Po chodbách a třídách chodí Láďa… a hledá tě.', `Najdi ${HOROR.KEYS} klíče (jsou ve třídách) a uteč hlavním vchodem.`,
      'Když tě uvidí, utíkej – ztrať se mu z očí, nebo se schovej do skříně.', 'Baterka se vybíjí – nové jsou v šuplících.']
      .forEach((t, i) => drawOutlinedText(t, W / 2, 190 + i * 30, 'bold 17px sans-serif', '#ffffff', 'middle', W - 40));
    drawOutlinedText(keysHint ? 'WASD – chůze · myš – otáčení · Shift – sprint · E – šuplík / schovat · R – baterka' : 'Joystick vlevo – chůze (naplno = sprint) · táhni vpravo – otáčení', W / 2, 352, 'bold 14px sans-serif', '#cfcfcf', 'middle');
    drawOutlinedText('🎧 Nejlepší se sluchátky', W / 2, 380, 'bold 14px sans-serif', '#cfcfcf', 'middle');
    ['🔦 Hrát sám', '👥 Hrát s kamarády (online, max 4)', 'Zpět'].forEach((t, i) => drawChessButton(HOROR_MENU[i], t, i === H.menuSel, i === 1 ? '#2f5a7a' : i === 2 ? '#5a4636' : '#7a2a2a'));
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
  if (typeof drawHororNet === 'function') drawHororNet(H);   // online: seznam her, čekárna, konec (40_horor_online.js)
}

// Úvod → 🎮 Módy → 👻 Bacha na Láďu (10_obrazovky.js, modesItems)
{
  const _press = pressButton;
  pressButton = function (id) { if (id === 'horor') openHoror(); else _press(id); };
}
