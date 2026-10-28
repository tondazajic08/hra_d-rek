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
  PITCH: 240,                            // px – jak moc jde koukat nahoru / dolů
  RADIUS: 11,
  LIGHT: 680,                            // dosvit baterky (px) – víc vidět, ať se člověk neztrácí
  ROW: 3,                                // px výšky obrazovky na řádek podlahy / stropu
  FL: 180,                               // výška patra (schody: 24 stupňů po 7,5 px, nášlap 20 px)
  BAT: 110,                              // s – na jak dlouho vydrží plná baterka
  BAT_CHANCE: 0.45,                      // kolik šuplíků má v sobě baterku
  DRAWER_DIST: 40,                       // px od šuplíku, odkud jde otevřít
  LADA: { WALK: 70, CHECK: 105, RUN: 168, SEE: 520, HEAR: 300, CATCH: 30, LOOK: 3, HEIGHT: 118 },
  KEYS: 8,                               // klíčů k útěku (každá hra jinde)
  SCARE_AT: 4,                           // po kolikátém klíči je naháněčka
  GUN_ROOM: 'kabinet2',                  // Kabinet Křiváček – zbraň, zamčený (klíč od Křiváčka 🗝)
  STUN: 40,                              // s – jak dlouho Láďa spí po zásahu
  DOWN_TIME: 60,                         // s – online: jak dlouho chycený leží, než ho kamarádi oživí lékárničkou
  EYES: 5,                               // s – očka: pohled Láďovýma očima
  HIDE_DIST: 42,                         // px od okraje skříně / kabinky
  START: { room: 'chodba', x: 1140, y: 2010, a: -Math.PI / 2 },   // dole v Hlavní chodbě u vstupu
  LADA_START: 'patroA2',
  KEY_ROOMS: ['a113', 'a114', 'a107', 'a211', 'a212', 'a209', 'a210', 'sborovna', 'a310', 'a311', 'a302', 'aula', 'a309', 'a305', 'c101', 'c109', 'c202', 'c203', 'c301', 'c308', 'laborky', 'telocvicna', 'reditelna'],
};
// Mapa = celá škola z normální hry: všechny místnosti, kam se dá dojít dveřmi z Přízemí (budova A i C,
// tělocvična, šatny, laborky…), kromě venku, parkoviště a místností kreslených zepředu (bufet…). id → null
let HOROR_ROOM_SET = null;
const HOROR_OUTSIDE = ['venku', 'parkoviste'];
function HOROR_ROOMS() {
  if (HOROR_ROOM_SET) return HOROR_ROOM_SET;
  const set = { chodba: null }, q = ['chodba'];
  for (let h = 0; h < q.length; h++) for (const d of ROOMS[q[h]].doors) {
    const t = ROOMS[d.to];
    if (!t || d.to in set || t.front || HOROR_OUTSIDE.includes(d.to)) continue;
    set[d.to] = null; q.push(d.to);
  }
  return (HOROR_ROOM_SET = set);
}
const HOROR_HALLS = ['chodba', 'patroA', 'patroA2', 'cecko', 'cecko2', 'cecko3', 'labChodba', 'satny'];   // chodby (Láďa tu chodí častěji)
const HOROR_STAIR_PARTS = ['schodyA', 'schodyPatro', 'schodyPatro2'];   // schodiště A – s výškami (hororStairH)
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
// Úkryty (podle druhu nábytku z mapy hry)
const HOROR_FURNITURE = {
  stage: { hide: 'pod pódiem' }, wardrobe: { hide: 've skříni' }, stall: { hide: 'v záchodové kabince' },
  lockers: { hide: 've skříňce' }, desk: { hide: 'pod katedrou' }, pingpong: { hide: 'pod pingpongovým stolem' },
  piano: { hide: 'pod klavírem' }, bench: { hide: 'pod lavičkou' }, roundtable: { hide: 'pod stolem' }, pcdesk: { hide: 'pod stolem s počítači' },
  labbench: { hide: 'za laboratorním stolem' }, chembench: { hide: 'za laboratorním stolem' },
};
const HOROR_HIDE_IN = ['wardrobe', 'lockers', 'stall'];   // uvnitř (škvíra mezi dvířky); ostatní = pod / za nábytkem
// Nábytek ve 3D: každý kus z mapy hry (room.obstacles, kresba OBSTACLE_ART v 08_grafika_mistnosti.js) se
// poskládá z krabic { x, y, w, h (px mapy), z0, z1 (výška nad podlahou), c (barva), s (stojí na zemi a zakrývá) }.
// Stejné barvy a rozložení jako shora ve hře: deska stolu a nohy, židle se sedákem a opěradlem, monitory,
// dvířka skříněk… Měřítko: 1 px ≈ 2,5 cm (stůl 30 = 75 cm, sedák 18, skříňka 74, strop 130).
// drawer = kde je šuplík (otevírá se, může v něm být baterka): { lo, hi } výška čela
const hororRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function hororModel(o, zb, face) {   // face = strana s volnou podlahou ('top' | 'bottom' | 'left' | 'right'), kam míří přední strana
  const r = o.rect, k = o.kind, B = [];
  // solid = zakrývá, co je za ním (jen když stojí na zemi – vznášející se deska / police nesmí zakrýt prostor pod sebou)
  const box = (x, y, w, h, z0, z1, c, solid, grounded) => { if (w > 0.2 && h > 0.2) B.push({ x, y, w, h, z0, z1, c: typeof c === 'string' ? hororRGB(c) : c, s: solid && (z0 <= 0.5 || grounded) ? 1 : 0 }); };
  const legs = (t, z, c) => {
    const s = 2.5;
    for (const [x, y] of [[t.x + 1, t.y + 1], [t.x + t.w - 1 - s, t.y + 1], [t.x + 1, t.y + t.h - 1 - s], [t.x + t.w - 1 - s, t.y + t.h - 1 - s]]) box(x, y, s, s, 0, z, c || '#55565a', 0);
  };
  const table = (t, z, c, legC) => { box(t.x, t.y, t.w, t.h, z - 2.5, z, c, 0); legs(t, z - 2.5, legC); };
  const chair = (st, back, c, cb, z) => {   // st = sedák, back = strana s opěradlem
    const zs = z || 18;
    box(st.x, st.y, st.w, st.h, zs - 2, zs, c, 0); legs(st, zs - 2, '#3c3c40');
    const t = 2.5, b = { top: [st.x, st.y, st.w, t], bottom: [st.x, st.y + st.h - t, st.w, t], left: [st.x, st.y, t, st.h], right: [st.x + st.w - t, st.y, t, st.h] }[back];
    if (b) box(b[0], b[1], b[2], b[3], zs, zs + 18, cb || c, 0);
  };
  const rail = (hand, post, h) => {   // zábradlí: madlo a tyčky (na schodech kopíruje stupně)
    const zr = (x, y, sm) => Math.max(zb(x - 5, y, sm), zb(x + 5, y, sm), zb(x, y - 5, sm), zb(x, y + 5, sm));   // stojí na vyšší straně (ne v díře)
    const vert = r.h > r.w, len = vert ? r.h : r.w, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    for (let a = 0; a < len; a += 6) {
      const l = Math.min(6, len - a), x = vert ? cx - 1.5 : r.x + a, y = vert ? r.y + a : cy - 1.5;
      const za = zr(x, y, true), zc = zr(vert ? cx : x + l, vert ? y + l : cy, true);   // madlo jde se schody šikmo
      box(x, y, vert ? 3 : l, vert ? l : 3, Math.min(za, zc) + h - 3, Math.max(za, zc) + h, hand, 0);
    }
    for (let a = 4; a < len - 2; a += 12) {
      const x = vert ? cx - 0.8 : r.x + a, y = vert ? r.y + a : cy - 0.8, z = zr(x, y);
      box(x, y, 1.6, 1.6, z, z + h - 3, post, 0);
    }
  };
  const stack = (layers, rr) => {   // vrstvy na sobě; souvislá řada od země zakrývá
    const q = rr || r;
    let top = 0;
    for (const [z0, z1, c] of layers) { const g = z0 <= top + 0.01; box(q.x, q.y, q.w, q.h, z0, z1, c, 1, g); if (g) top = Math.max(top, z1); }
  };
  const inset = (q, d) => ({ x: q.x + d, y: q.y + d, w: q.w - 2 * d, h: q.h - 2 * d });
  const fc = face || 'bottom', fh = fc === 'top' || fc === 'bottom';
  // tenký panel na přední straně: a0..a1 = podíl šířky (0..1), z0..z1 výška, out = jak daleko před čelem
  const panel = (a0, a1, z0, z1, c, out) => {
    const d = out || 0.8, len = fh ? r.w : r.h, s0 = (fh ? r.x : r.y) + len * a0, l = len * (a1 - a0);
    if (fh) box(s0, fc === 'top' ? r.y - d : r.y + r.h, l, d, z0, z1, c, 0);
    else box(fc === 'left' ? r.x - d : r.x + r.w, s0, d, l, z0, z1, c, 0);
  };
  let rs = (Math.round(r.x * 7 + r.y * 13) | 0) || 1;
  const rnd = () => { rs = (Math.imul(rs, 1103515245) + 12345) | 0; return ((rs >>> 8) & 0xffff) / 65536; };
  let drawer = null;
  if (k === 'desk') {
    const chairs = o.chairs !== false;
    if (chairs && (o.face === 'left' || o.face === 'right')) {   // lavice nastojato, židle vedle
      const dw = Math.round(r.w * 0.62), top = { x: o.face === 'right' ? r.x + r.w - dw : r.x, y: r.y, w: dw, h: r.h };
      table(top, 30, '#d8b47c');
      const sw = r.w - dw - 2, sx = o.face === 'right' ? r.x : top.x + top.w + 2, n = Math.max(1, Math.round(r.h / 28));
      for (let i = 0; i < n; i++) chair({ x: sx, y: r.y + (i + 0.5) * r.h / n - 6, w: sw, h: 12 }, o.face === 'right' ? 'left' : 'right', o.chair || '#3b6fb6');
    } else {
      const dh = chairs ? Math.round(r.h * 0.62) : r.h, top = { x: r.x, y: o.flip ? r.y + r.h - dh : r.y, w: r.w, h: dh };
      if (chairs) {
        table(top, 30, '#d8b47c');
        const sh = r.h - top.h - 2, sy = o.flip ? r.y : top.y + top.h + 2, n = Math.max(1, Math.round(r.w / 30));
        for (let i = 0; i < n; i++) chair({ x: r.x + (i + 0.5) * r.w / n - 6, y: sy, w: 12, h: sh }, o.flip ? 'top' : 'bottom', o.chair || '#3b6fb6');
      } else {   // katedra / stůl v kabinetu: deska, na jednom konci skříňka se šuplíky
        box(top.x, top.y, top.w, top.h, 27.5, 30, '#c9a46c', 0);
        const vert = top.h > top.w, pw = Math.min(18, (vert ? top.h : top.w) * 0.4);
        const ped = vert ? { x: top.x + 1, y: top.y + top.h - pw - 1, w: top.w - 2, h: pw } : { x: top.x + top.w - pw - 1, y: top.y + 1, w: pw, h: top.h - 2 };
        stack([[0, 27.5, '#b08850']], ped);
        legs(vert ? { x: top.x, y: top.y, w: top.w, h: top.h - pw } : { x: top.x, y: top.y, w: top.w - pw, h: top.h }, 27.5);
        drawer = { lo: 18, hi: 26, rect: ped };
      }
    }
  } else if (k === 'pcdesk') {   // stůl s počítači podél zdi (jako ve hře)
    const horiz = o.wall === 'top' || o.wall === 'bottom', C = 14;
    const desk = { top: { x: r.x, y: r.y, w: r.w, h: r.h - C }, bottom: { x: r.x, y: r.y + C, w: r.w, h: r.h - C }, left: { x: r.x, y: r.y, w: r.w - C, h: r.h }, right: { x: r.x + C, y: r.y, w: r.w - C, h: r.h } }[o.wall] || r;
    table(desk, 30, '#e6d3ae');
    const len = horiz ? r.w : r.h, n = Math.max(1, Math.floor(len / 52));
    for (let q = 0; q < n; q++) {
      const a = (len / n) * (q + 0.5);
      const P = (m, d, w, h) => {
        const along = (horiz ? r.x : r.y) + a + m;
        if (o.wall === 'top') return { x: along - w / 2, y: desk.y + d, w, h };
        if (o.wall === 'bottom') return { x: along - w / 2, y: desk.y + desk.h - d - h, w, h };
        if (o.wall === 'right') return { x: desk.x + desk.w - d - h, y: along - w / 2, w: h, h: w };
        return { x: desk.x + d, y: along - w / 2, w: h, h: w };
      };
      const mo = P(0, 3, 30, 3), ft = P(0, 7, 6, 4), kb = P(-2, 17, 24, 7), ms = P(15, 18, 5, 7), st = P(0, (horiz ? r.h : r.w) - C + 2, 16, C - 3);
      box(mo.x, mo.y, mo.w, mo.h, 34, 52, '#151517', 0);
      box(ft.x, ft.y, ft.w, ft.h, 30, 34, '#2a2a2a', 0);
      box(kb.x, kb.y, kb.w, kb.h, 30, 31.5, '#2b2b2b', 0);
      box(ms.x, ms.y, ms.w, ms.h, 30, 31.5, '#3a3a3a', 0);
      chair(st, { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[o.wall], o.chair || '#e3b23c');
    }
  } else if (k === 'labbench') {   // laboratorní stůl: plná skříňka, deska, umyvadla, stoličky
    const C = 12, ch = o.chairs || [], look = o.look || {};
    const top = { x: r.x + (ch.includes('left') ? C : 0), y: r.y + (ch.includes('top') ? C : 0), w: r.w - (ch.includes('left') ? C : 0) - (ch.includes('right') ? C : 0), h: r.h - (ch.includes('top') ? C : 0) - (ch.includes('bottom') ? C : 0) };
    stack([[0, 4, '#4a4036'], [4, 31, '#cdb98f'], [31, 34, look.top || '#efdfbe']], top);
    for (const side of ch) {
      const along = side === 'top' || side === 'bottom', len = along ? top.w : top.h, n = Math.max(1, Math.floor(len / 26));
      for (let q = 0; q < n; q++) {
        const a = (len / n) * (q + 0.5);
        const st = along ? { x: top.x + a - 8, y: side === 'top' ? r.y + 1 : top.y + top.h + 1, w: 16, h: C - 2 } : { x: side === 'left' ? r.x + 1 : top.x + top.w + 1, y: top.y + a - 8, w: C - 2, h: 16 };
        chair(st, side, look.chair || '#e3b23c', look.chairBack || '#c8962a', 24);
      }
    }
    const long = top.w >= top.h;
    for (const at of o.sinks || []) {
      const cx = long ? top.x + top.w * at : top.x + top.w / 2, cy = long ? top.y + top.h / 2 : top.y + top.h * at;
      box(cx - 8, cy - 6, 16, 12, 34, 35, '#aeb6bc', 0);
      box(cx - 1, cy - 8, 2, 2, 34, 44, '#7d868c', 0);
    }
  } else if (k === 'pillar') stack([[0, 5, '#1c2030'], [5, 130, '#f2f4f6']]);
  else if (k === 'radiator') {   // radiátor: žebra po 4 px a trubka nahoře
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h, c = o.color || '#e6d48f';
    for (let a = 0; a < len - 1; a += 4) box(horiz ? r.x + a : r.x, horiz ? r.y : r.y + a, horiz ? 2.6 : r.w, horiz ? r.h : 2.6, 4, 24, c, 1);
    box(r.x, r.y, r.w, r.h, 24, 26, o.rib || '#bfa95e', 0);
    legs(r, 4, '#8a8a8a');
  }
  else if (k === 'chair') chair(inset(r, 2), 'bottom', '#2f62c4', '#1d3f86');
  else if (k === 'lockers') {   // plechové skříňky: dvířka po 14 px, každé svou barvou
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h;
    for (let a = 0, i = 0; a < len; a += 14, i++) {
      const l = Math.min(14, len - a), c = o.colors ? o.colors[i % o.colors.length] : o.color || '#8a9aa6', q = horiz ? { x: r.x + a, y: r.y, w: l - 0.6, h: r.h } : { x: r.x, y: r.y + a, w: r.w, h: l - 0.6 };
      stack([[0, 4, '#2a2a2e'], [4, 74, c]], q);
    }
    drawer = { lo: 46, hi: 70 };
  } else if (k === 'bench') { table(r, 17, '#d6a25e', o.frame || '#2e5e3a'); }
  else if (k === 'railing') { if (Math.min(r.w, r.h) <= 14) rail(o.handrail || '#c48a4f', o.color || '#b9bfc3', 40); else stack([[0, 38, o.color || '#b9bfc3'], [38, 41, o.handrail || '#c48a4f']]); }
  else if (k === 'ironrail') rail('#a8703f', '#161616', 40);
  else if (k === 'pingpong') { table(r, 30, '#1f4e79'); const h = r.w >= r.h; box(h ? r.x + r.w / 2 - 1 : r.x - 3, h ? r.y - 3 : r.y + r.h / 2 - 1, h ? 2 : r.w + 6, h ? r.h + 6 : 2, 30, 36, '#e8e8e8', 0); }
  else if (k === 'wallbars') {   // žebřiny: svislé hranoly po 30 px a příčky po 8 px (je mezi nimi vidět)
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h, th = horiz ? r.h : r.w, c0 = horiz ? r.y : r.x;
    const B = (a, l, z0, z1, c) => box(horiz ? r.x + a : c0, horiz ? c0 : r.y + a, horiz ? l : th, horiz ? th : l, z0, z1, c, 0);
    for (let a = 0; a <= len - 3; a += 30) B(a, 3, 0, 110, '#a8763f');
    if ((len - 3) % 30) B(len - 3, 3, 0, 110, '#a8763f');
    for (let z = 6; z < 108; z += 8) B(0, len, z, z + 2, '#c9965a');
  }
  else if (k === 'pole') stack([[0, 100, '#2a4fa8']]);
  else if (k === 'shelf') {   // knihovna: dole skříňka se šuplíkem, nad ní 3 police s jednotlivými knihami
    const books = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#ecf0f1', '#d35400', '#34495e'];
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h, dep = horiz ? r.h : r.w;
    stack([[0, 24, '#7e5a36']]);
    for (const z of [24, 42, 60]) box(r.x, r.y, r.w, r.h, z, z + 2, '#6e4a2a', 0);   // police
    box(r.x, r.y, r.w, r.h, 78, 82, '#6e4a2a', 1);
    const sideW = 2;   // boky
    box(r.x, r.y, horiz ? sideW : r.w, horiz ? r.h : sideW, 24, 78, '#6e4a2a', 1);
    box(horiz ? r.x + r.w - sideW : r.x, horiz ? r.y : r.y + r.h - sideW, horiz ? sideW : r.w, horiz ? r.h : sideW, 24, 78, '#6e4a2a', 1);
    // zadní stěna (dál od volné podlahy)
    const back = { top: [r.x, r.y + r.h - 1, r.w, 1], bottom: [r.x, r.y, r.w, 1], left: [r.x + r.w - 1, r.y, 1, r.h], right: [r.x, r.y, 1, r.h] }[fc];
    box(back[0], back[1], back[2], back[3], 24, 78, '#5a3c22', 1);
    for (const z of [26, 44, 62]) {
      for (let a = sideW + 0.5; a < len - sideW - 1.5;) {
        const bw = 2 + rnd() * 2.6, bh = 10 + rnd() * 5.5, gap = rnd() < 0.12 ? 3 + rnd() * 4 : 0.35;
        if (a + bw > len - sideW - 0.5) break;
        const d0 = 1.5, dd = dep - 3 - rnd() * 2, c = books[Math.floor(rnd() * books.length)];
        box(horiz ? r.x + a : r.x + d0, horiz ? r.y + d0 : r.y + a, horiz ? bw : dd, horiz ? dd : bw, z, z + bh, c, 1);
        a += bw + gap;
      }
    }
    drawer = { lo: 6, hi: 22 };
  } else if (k === 'lowwall') stack([[0, 36, '#f2f1ed'], [36, 40, '#c8955a']]);
  else if (k === 'plainwall') stack([[0, 130, '#eceeef']]);
  else if (k === 'chairrow') {   // řada modrých sedaček na černé liště
    const vert = r.h > r.w, len = vert ? r.h : r.w, n = Math.max(1, Math.round(len / 22)), seat = len / n;
    box(vert ? r.x + r.w / 2 - 2 : r.x + 2, vert ? r.y + 2 : r.y + r.h / 2 - 2, vert ? 4 : r.w - 4, vert ? r.h - 4 : 4, 0, 14, '#1b1b1d', 0);
    const back = { right: 'left', up: 'bottom', left: 'right' }[o.face] || 'top';
    for (let i = 0; i < n; i++) {
      const a = i * seat + 1.5;
      chair(vert ? { x: r.x, y: r.y + a, w: r.w, h: seat - 3 } : { x: r.x + a, y: r.y, w: seat - 3, h: r.h }, back, '#2459c2', '#173c8c');
    }
  } else if (k === 'coffeemachine') {   // kávovar: černá skříň, vpředu reklama, tlačítka, výdejní okénko, reklama dole
    stack([[0, 84, '#1d1d20'], [84, 86, '#5a3420']]);
    panel(0.08, 0.92, 62, 82, '#e98a3a');
    panel(0.12, 0.42, 66, 78, '#5a3420', 1.2);
    panel(0.55, 0.88, 40, 58, '#f4f4f4');
    for (let i = 0; i < 4; i++) panel(0.6, 0.83, 54 - i * 4, 55.5 - i * 4, '#9aa0a6', 1.4);
    panel(0.15, 0.48, 40, 56, '#2c4a5a');   // displej
    panel(0.3, 0.7, 24, 34, '#3a3a3e', 0.4);   // výdejní okénko
    panel(0.08, 0.92, 4, 20, '#4fb07a');
  }
  else if (k === 'printer') stack([[0, 26, '#6d7175'], [26, 38, '#c8cbce'], [38, 42, '#8f9499']]);
  else if (k === 'roundtable') { table(inset(r, 4), 30, '#dca66a'); chair({ x: r.x + r.w - 14, y: r.y + r.h - 14, w: 12, h: 12 }, 'right', '#6aa6dc'); }
  else if (k === 'stage') stack([[0, 16, '#7a4a26']]);
  else if (k === 'piano') {   // křídlo: tělo na nohách, klávesnice, otevřené víko na tyčce
    const body = { x: r.x, y: r.y + 6, w: r.w, h: r.h - 6 };
    box(body.x, body.y, body.w, body.h, 24, 34, '#111113', 0);
    for (const [x, y] of [[body.x + 2, body.y + 2], [body.x + body.w - 5, body.y + 2], [body.x + body.w / 2 - 1.5, body.y + body.h - 5]]) box(x, y, 3, 3, 0, 24, '#111113', 0);
    box(r.x, r.y, r.w, 6, 26, 28, '#f4f4f0', 0);   // bílé klávesy
    for (let x = r.x + 3; x < r.x + r.w - 2; x += 5) box(x, r.y, 2, 3.5, 28, 29, '#111113', 0);   // černé klávesy
    box(r.x, r.y + 6, r.w, 1.5, 28, 40, '#111113', 0);   // stojan na noty
    box(body.x + 2, body.y + 4, body.w - 4, body.h - 6, 46, 47.5, '#1d1d20', 0);   // víko
    box(body.x + body.w - 6, body.y + body.h / 2, 1.5, 1.5, 34, 46, '#555', 0);   // tyčka víka
  }
  else if (k === 'aulachairs') {
    for (let x = r.x + 4; x + 20 <= r.x + r.w; x += 34) for (let y = r.y + 3; y + 20 <= r.y + r.h; y += 24) {
      chair({ x, y, w: 20, h: 20 }, 'none', '#6b2a5e');
      box(x + 16, y - 1, 6, 22, 18, 38, '#b9905e', 0);
    }
  } else if (k === 'wardrobe') stack([[0, 4, '#7a5430'], [4, 84, '#c48c52'], [84, 86, '#b07a44']]);
  else if (k === 'lowtable') table(r, 18, '#d3a46c');
  else if (k === 'chesstable') { table(r, 30, '#1c1c1e'); box(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 30, 30.6, '#9a9a9a', 0); }
  else if (k === 'beanbag') { stack([[0, 10, '#2f4c90']]); box(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10, 16, '#22386e', 1); }
  else if (k === 'foosball') {
    stack([[0, 33, '#1a1a1c'], [33, 34, '#2f8a3e']]);
    const vert = r.h > r.w;
    for (let i = 1; i < 9; i++) { const a = (vert ? r.h : r.w) * i / 9; box(vert ? r.x - 4 : r.x + a - 1, vert ? r.y + a - 1 : r.y - 4, vert ? r.w + 8 : 2, vert ? 2 : r.h + 8, 36, 38, '#c9ccd0', 0); }
  } else if (k === 'kiosk') {   // informační kiosek: noha a skříň s obrazovkou, dole klávesnice
    box(r.x + r.w / 2 - 5, r.y + r.h / 2 - 5, 10, 10, 0, 30, '#c9c7c2', 1);
    box(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 0, 3, '#c9c7c2', 1);
    stack([[30, 66, '#e9e7e2']], inset(r, 2));
    panel(0.15, 0.85, 42, 62, '#1f4fb0', -1.2);
    panel(0.2, 0.8, 44, 60, '#5a8fe0', -1);
    panel(0.3, 0.7, 33, 37, '#2b2b2b', -1);
  } else if (k === 'showcase' || k === 'trophies') {   // prosklená vitrína: dřevěný / kovový rám, police a předměty uvnitř (sklo je průhledné)
    const show = k === 'showcase', frame = show ? '#d9b77e' : '#c7cdd2', top = show ? 80 : 84;
    stack([[0, 28, frame]]);
    box(r.x, r.y, r.w, r.h, top, top + 3, frame, 1);
    for (const [x, y] of [[r.x, r.y], [r.x + r.w - 2, r.y], [r.x, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]]) box(x, y, 2, 2, 28, top, frame, 1);
    const back = { top: [r.x, r.y + r.h - 1, r.w, 1], bottom: [r.x, r.y, r.w, 1], left: [r.x + r.w - 1, r.y, 1, r.h], right: [r.x, r.y, 1, r.h] }[fc];
    box(back[0], back[1], back[2], back[3], 28, top, show ? '#e8cc98' : '#dfeaf0', 1);
    box(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 54, 55, show ? '#e8cc98' : '#eef3f6', 0);   // police
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h, n = Math.max(1, Math.floor(len / 10));
    for (const z of [28, 55]) for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * len / n, c = show ? ['#e8742c', '#2d7fd6', '#c0392b'][i % 3] : (i % 3 === 2 ? '#c0c4c8' : '#e2b52c');
      const x = horiz ? r.x + a - 2 : r.x + r.w / 2 - 2, y = horiz ? r.y + r.h / 2 - 2 : r.y + a - 2;
      if (show) box(x, y, 4, 4, z, z + 8 + (i % 2) * 4, c, 0);
      else { box(x + 0.5, y + 0.5, 3, 3, z, z + 2, '#8a6a1c', 0); box(x + 1.5, y + 1.5, 1, 1, z + 2, z + 8, c, 0); box(x, y, 4, 4, z + 8, z + 14, c, 0); }   // pohár: podstavec, nožka, kalich
    }
  }
  else if (k === 'bins') { const h = r.w >= r.h; stack([[0, 26, '#f0c419']], h ? { x: r.x, y: r.y, w: r.w / 2 - 1, h: r.h } : { x: r.x, y: r.y, w: r.w, h: r.h / 2 - 1 }); stack([[0, 26, '#2e63c9']], h ? { x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h } : { x: r.x, y: r.y + r.h / 2, w: r.w, h: r.h / 2 }); }
  else if (k === 'plant' || k === 'grassplant') {   // květina: květináč a trs listů (několik různě vysokých chomáčů)
    const pot = inset(r, r.w * 0.22), tall = k === 'plant' ? 46 : 30, greens = ['#2f7a34', '#3f8f3f', '#57a84a', '#2a6a2e'];
    stack([[0, 12, '#a0522d'], [12, 13.5, '#6d3a1d']], pot);
    for (let i = 0; i < 7; i++) {
      const sz = r.w * (0.25 + rnd() * 0.25), cx = r.x + r.w / 2 + (rnd() - 0.5) * r.w * 0.55, cy = r.y + r.h / 2 + (rnd() - 0.5) * r.h * 0.55;
      const z0 = 12 + rnd() * (tall - 22), z1 = Math.min(tall, z0 + 8 + rnd() * 12);
      box(cx - sz / 2, cy - sz / 2, sz, sz, z0, z1, greens[i % greens.length], 0);
    }
    box(r.x + r.w / 2 - 1, r.y + r.h / 2 - 1, 2, 2, 12, tall - 6, '#3d5a2a', 0);   // stonek
  }
  else if (k === 'stall') {   // kabinka: přepážky, mísa, barevné dveře (facing right = dveře vpravo)
    const right = o.facing === 'right', t = 3, dc = o.door || '#4a7fc0';
    if (right) { box(r.x, r.y, r.w, t, 4, 84, '#c9cfd4', 1); box(r.x, r.y + r.h - t, r.w, t, 4, 84, '#c9cfd4', 1); box(r.x, r.y, t, r.h, 4, 84, '#c9cfd4', 1); box(r.x + r.w - t, r.y + t, t, r.h - 2 * t, 4, 80, dc, 1); box(r.x + 4, r.y + r.h / 2 - 9, 24, 18, 0, 16, '#ffffff', 1); }
    else { box(r.x, r.y, t, r.h, 4, 84, '#c9cfd4', 1); box(r.x + r.w - t, r.y, t, r.h, 4, 84, '#c9cfd4', 1); box(r.x, r.y, r.w, t, 4, 84, '#c9cfd4', 1); box(r.x + t, r.y + r.h - t, r.w - 2 * t, t, 4, 80, dc, 1); box(r.x + r.w / 2 - 9, r.y + 4, 18, 24, 0, 16, '#ffffff', 1); }
  } else if (k === 'monitor') { box(r.x + 5, r.y, 5, r.h, 32, 48, '#212121', 0); box(r.x + 1, r.y + r.h / 2 - 4, 5, 8, 30, 32, '#37474f', 0); }
  else if (k === 'urinal') box(r.x, r.y, r.w, r.h, 18, 46, '#f4f6f8', 1);
  else if (k === 'wcwall') stack([[0, 84, '#c9cfd4']]);
  else if (k === 'sink') { box(r.x, r.y, r.w, r.h, 30, 36, '#f2f4f6', 0); box(r.x + r.w / 2 - 4, r.y + r.h / 2 - 4, 8, 8, 0, 30, '#dfe3e7', 0); }
  else if (k === 'trashbin') stack([[0, 24, '#5d6166']]);
  else if (k === 'guitar') {   // kytara opřená na stojanu: tělo, ozvučný otvor, krk, hlava
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, w = Math.min(r.w, r.h) * 0.9;
    box(cx - w / 2, cy - 3, w, 6, 2, 22, '#a0522d', 1);
    box(cx - w / 2 + 2, cy - 3.6, w - 4, 0.6, 12, 18, '#5a2d14', 0);
    box(cx - 1.2, cy - 1.2, 2.4, 2.4, 22, 50, '#6d3a1d', 0);
    box(cx - 2, cy - 2, 4, 4, 50, 56, '#3a2010', 0);
    box(cx - w / 2, cy + 3, w, 2, 0, 2, '#222', 0);
  } else if (k === 'drums') {   // bicí: velký buben, malý buben, tomy, činely na stojanech, stolička
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    box(cx - 9, cy - 6, 18, 12, 0, 18, '#b03030', 1); box(cx - 8, cy - 6.6, 16, 0.6, 2, 16, '#eeeeee', 0);   // velký buben, blána
    box(cx - 16, cy + 2, 9, 9, 16, 22, '#c8c8cc', 1); box(cx - 16, cy + 2, 9, 9, 22, 22.6, '#f2f2f2', 0);       // malý buben
    for (const dx of [-6, 3]) { box(cx + dx, cy - 3, 7, 7, 22, 28, '#b03030', 1); box(cx + dx, cy - 3, 7, 7, 28, 28.5, '#f2f2f2', 0); }   // tomy
    box(cx + 10, cy + 2, 10, 10, 10, 17, '#b03030', 1);   // kotel
    for (const [x, y, z] of [[r.x + 2, r.y + 2, 40], [r.x + r.w - 14, r.y + 2, 44], [r.x + 2, r.y + r.h - 14, 34]]) {
      box(x + 5.5, y + 5.5, 1.2, 1.2, 0, z, '#9a9a9a', 0); box(x, y, 12, 12, z, z + 0.8, '#d4a937', 0);   // stojan a činel
    }
    box(cx - 4, r.y + r.h - 9, 8, 8, 0, 14, '#222', 0);   // stolička
  }
  else if (k === 'keyboard') { table(r, 28, '#1b1b1b'); box(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 28, 29, '#f4f4f0', 0); }
  else if (k === 'ballcrate') stack([[0, 24, '#8a5a2e']]);
  else if (k === 'chembench') stack([[0, 4, '#3a3a3e'], [4, 32, '#e0e0dc'], [32, 35, '#2a2a2e']]);
  else if (k === 'langbench') { table(r, 30, '#c9a06a'); }
  else if (k !== 'void') stack([[0, 36, '#8a7a6a']]);
  const z = zb(r.x + r.w / 2, r.y + r.h / 2);
  if (z && k !== 'ironrail' && k !== 'railing') for (const b of B) { b.z0 += z; b.z1 += z; }
  return { boxes: B, drawer };
}
const HOROR_MAPS = {};
state.horor = null;

// --- Kresba místnosti z normální hry → barvy, okna, tabule, schody ---
// Kresba se nakreslí do neviditelného obrázku (ctx se na chvíli přesměruje), z pixelů se pak vezme barva
// podlahy a zdí, okna (modré sklo), tabule a plakáty na zdech. Ramena schodů se zachytí z volání
// drawStoneFlight / drawStairFlight / drawGraniteFlight (rect + směr stoupání); šatny mají schody kreslené ručně.
const HOROR_EXTRA_FLIGHTS = {
  satny2: [[170, 340, 70, 80, 'right', 18], [20, 123, 150, 217, 'down', 18]],
  satny3: [[280, 100, 120, 225, 'up', 20], [156, 20, 124, 80, 'left', 20]],
};
function hororOffscreen(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const off = cv.getContext('2d'), proto = CanvasRenderingContext2D.prototype, keys = [];
  for (const k of Object.getOwnPropertyNames(proto)) {
    if (k === 'constructor' || k === 'canvas') continue;
    const d = Object.getOwnPropertyDescriptor(proto, k);
    if (typeof d.value === 'function') Object.defineProperty(ctx, k, { configurable: true, writable: true, value: (...a) => off[k](...a) });
    else if (d.get) Object.defineProperty(ctx, k, { configurable: true, get: () => off[k], set: (v) => { off[k] = v; } });
    else continue;
    keys.push(k);
  }
  try { fn(); } finally { for (const k of keys) delete ctx[k]; }
  return off;
}
function hororArtScan(room) {
  const S = 0.5, w = Math.ceil(room.w * S), h = Math.ceil(room.h * S), flights = [];
  const keep = { s: drawStoneFlight, n: drawStairFlight, g: drawGraniteFlight };
  let data = null;
  try {
    drawStoneFlight = (f, d, st) => { flights.push({ x: f.x, y: f.y, w: f.w, h: f.h, dir: d, step: st || 16 }); keep.s(f, d, st); };
    drawStairFlight = (f, d, st) => { flights.push({ x: f.x, y: f.y, w: f.w, h: f.h, dir: d, step: st || 16 }); keep.n(f, d, st); };
    drawGraniteFlight = (f, d) => { flights.push({ x: f.x, y: f.y, w: f.w, h: f.h, dir: d || 'up', step: 16 }); keep.g(f, d); };
    const off = hororOffscreen(w, h, () => {
      cullReset();
      ctx.setTransform(S, 0, 0, S, -room.x * S, -room.y * S);
      const art = ROOM_ART[room.id];
      if (room.parts) {
        for (const part of room.parts) ROOM_ART[part.art].draw({ ...part.frame, id: part.id, obstacles: room.obstacles.filter((o) => o.part === part.id), doors: room.doors.filter((d) => d.part === part.id) });
        for (const o of room.openings || []) { const [a] = o.fill || ['old']; if (FLOOR_FILLS[a]) FLOOR_FILLS[a](o); }
      } else if (art) art.draw(room);
      else { drawRect(room, room.floorColor || '#b0a890'); for (const wall of buildRoomWalls(room)) drawRect(wall, room.wallColor || '#e8e4dc'); }
    });
    data = off.getImageData(0, 0, w, h).data;
  } catch (e) { data = null; }
  finally { drawStoneFlight = keep.s; drawStairFlight = keep.n; drawGraniteFlight = keep.g; }
  for (const [x, y, fw, fh, dir, step] of HOROR_EXTRA_FLIGHTS[room.id] || []) flights.push({ x: room.x + x, y: room.y + y, w: fw, h: fh, dir, step });
  return { S, w, h, data, flights };
}
// Výška na rameni schodů f v bodě (x, y): plynule, nebo po stupních
function hororFlightAlong(f, x, y) {
  const a = f.dir === 'up' ? f.y + f.h - y : f.dir === 'down' ? y - f.y : f.dir === 'left' ? f.x + f.w - x : x - f.x;
  return Math.max(0, Math.min(f.dir === 'up' || f.dir === 'down' ? f.h : f.w, a));
}
const hororFlightH = (f, x, y, steps) => {
  const a = hororFlightAlong(f, x, y), RISE = HOROR.FL / 24, n = Math.max(1, Math.round((f.dir === 'up' || f.dir === 'down' ? f.h : f.w) / f.step));
  return f.base + (steps ? Math.min(n - 0.5, Math.floor(a / f.step) + 0.5) : a / f.step) * RISE;
};
// Z kresby: barva podlahy (po 4 px), zdi (barva, okno / tabule / plakát), ramena schodů a jejich výšky
function hororMapArt(M, scan) {
  const { room, W, H, C, g } = M;
  // --- výšky: od místa, kde se začíná (start / první dveře), přes ramena schodů (BFS po buňkách)
  const flights = scan.flights.filter((f) => !(M.stairs && M.stairs.some((s) => f.x + f.w / 2 >= s.x && f.y + f.h / 2 >= s.y && f.x + f.w / 2 < s.x + 320 && f.y + f.h / 2 < s.y + 340)));
  flights.forEach((f) => { f.base = NaN; });
  const fi = new Int16Array(W * H).fill(-1), hs = new Float32Array(W * H).fill(NaN);
  flights.forEach((f, k) => {
    for (let j = Math.floor((f.y - room.y) / C); j < Math.ceil((f.y + f.h - room.y) / C); j++)
      for (let i = Math.floor((f.x - room.x) / C); i < Math.ceil((f.x + f.w - room.x) / C); i++) {
        const cx = room.x + (i + 0.5) * C, cy = room.y + (j + 0.5) * C;
        if (i >= 0 && j >= 0 && i < W && j < H && cx >= f.x && cx < f.x + f.w && cy >= f.y && cy < f.y + f.h) fi[j * W + i] = k;
      }
  });
  const manual = (c) => M.stairs && M.fh[c] !== 0;
  const walk = (c) => g[c] === 0 || g[c] === 6;
  let seed = null;
  if (M.id === HOROR.START.room) seed = HOROR.START;
  else { const d = M.doors.find((q) => q.open && !q.hidden) || M.doors[0]; if (d) seed = { x: d.ix, y: d.iy }; }
  if (flights.length && seed) {
    const s0 = Math.floor((seed.y - room.y) / C) * W + Math.floor((seed.x - room.x) / C), q = [];
    if (s0 >= 0 && s0 < W * H) { hs[s0] = manual(s0) ? M.fh[s0] : 0; q.push(s0); }
    const cxy = (c) => [room.x + (c % W + 0.5) * C, room.y + (Math.floor(c / W) + 0.5) * C];
    for (let h = 0; h < q.length; h++) {
      const p = q[h], pi = p % W, [px, py] = cxy(p);
      for (const [d, ok] of [[1, pi < W - 1], [-1, pi > 0], [W, true], [-W, true]]) {
        const c = p + d;
        if (!ok || c < 0 || c >= W * H || !Number.isNaN(hs[c]) || !walk(c)) continue;
        const [x, y] = cxy(c);
        let v;
        if (manual(c)) v = hororStairH(M.stairs[0].floor, x - M.stairs[0].x, y - M.stairs[0].y, false);
        else if (fi[c] >= 0) {
          const f = flights[fi[c]];
          if (Number.isNaN(f.base)) { const from = fi[p] === fi[c] ? hs[p] : hs[p]; f.base = from - hororFlightAlong(f, (x + px) / 2, (y + py) / 2) / f.step * (HOROR.FL / 24); }
          v = hororFlightH(f, x, y, false);
        } else if (fi[p] >= 0) v = hororFlightH(flights[fi[p]], x, y, false);
        else v = hs[p];
        hs[c] = v; q.push(c);
      }
    }
    for (let c = 0; c < W * H; c++) {
      if (Number.isNaN(hs[c]) || manual(c)) continue;
      const [x, y] = cxy(c);
      const v = fi[c] >= 0 && !Number.isNaN(flights[fi[c]].base) ? hororFlightH(flights[fi[c]], x, y, true) : hs[c];
      if (Math.abs(v) > 0.5) { M.fh[c] = v; if (v > 0) M.ch[c] = Math.max(M.ch[c], v + HOROR.WALL_H); }
    }
    // nábytek a zábradlí stojí na sousední podlaze
    for (let pass = 0; pass < 3; pass++) for (let c = 0; c < W * H; c++) {
      if (g[c] !== 2 || M.fh[c] !== 0) continue;
      const ci = c % W;
      for (const [d, ok] of [[1, ci < W - 1], [-1, ci > 0], [W, true], [-W, true]]) if (ok && c + d >= 0 && c + d < W * H && M.fh[c + d] !== 0 && g[c + d] !== 1) { M.fh[c] = M.fh[c + d]; M.ch[c] = Math.max(M.ch[c], M.ch[c + d]); break; }
    }
  }
  M.flights = flights.filter((f) => !Number.isNaN(f.base)); M.flightsAll = flights;
  M.fi = fi;
  if (!scan.data) return;
  // --- barvy z kresby
  const D = scan.data, S = scan.S, aw = scan.w, ah = scan.h;
  const px = (x, y) => {
    const i = Math.floor((x - room.x) * S), j = Math.floor((y - room.y) * S);
    if (i < 0 || j < 0 || i >= aw || j >= ah) return null;
    const o = (j * aw + i) * 4;
    return [D[o], D[o + 1], D[o + 2]];
  };
  // podlaha po 4 px (pro podlahu ve 3D) a barva buňky (schody)
  const fw = Math.ceil(room.w / 4), fhh = Math.ceil(room.h / 4), fc = new Uint8Array(fw * fhh * 3);
  for (let j = 0; j < fhh; j++) for (let i = 0; i < fw; i++) {
    const c = px(room.x + i * 4 + 2, room.y + j * 4 + 2);
    if (c) { const o = (j * fw + i) * 3; fc[o] = c[0]; fc[o + 1] = c[1]; fc[o + 2] = c[2]; }
  }
  M.fc = fc; M.fcw = fw; M.fch = fhh;
  M.cellCol = (c) => { const i = Math.min(fw - 1, Math.floor(((c % W) + 0.5) * C / 4)), j = Math.min(fhh - 1, Math.floor((Math.floor(c / W) + 0.5) * C / 4)), o = (j * fw + i) * 3; return [fc[o], fc[o + 1], fc[o + 2]]; };
  // zdi: barva, okno (1), tabule (2), plakát (3)
  const wcol = new Uint8Array(W * H * 3), wft = new Uint8Array(W * H), wfc = new Uint8Array(W * H * 3);
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11, glass = (c) => c[2] >= 205 && c[1] >= 205 && c[0] >= 180 && c[2] >= c[0] + 10;   // světle modré sklo (ne šedomodrý pruh)
  for (let c = 0; c < W * H; c++) {
    if (g[c] !== 1) continue;
    const i = c % W, j = Math.floor(c / W);
    let n = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const ni = i + dx, nj = j + dy;
      if (ni >= 0 && nj >= 0 && ni < W && nj < H && (g[nj * W + ni] === 0 || g[nj * W + ni] === 2)) { n = [dx, dy]; break; }
    }
    if (!n) continue;
    const fx = room.x + (i + 0.5 + n[0] * 0.5) * C, fy = room.y + (j + 0.5 + n[1] * 0.5) * C;
    const sm = [];
    for (let d = 5; d <= 17; d += 2) { const q = px(fx - n[0] * d, fy - n[1] * d); if (q) sm.push(q); }
    if (!sm.length) continue;
    const mid = sm[Math.min(sm.length - 1, 2)];
    let type = 0, col = mid;
    const gl = sm.filter(glass), dark = sm.filter((q) => lum(q) < 100), sat = sm.filter((q) => Math.max(...q) - Math.min(...q) > 70 && !glass(q));
    if (gl.length >= 2) { type = 1; col = gl[0]; }
    else if (dark.length >= 3) { type = 2; col = dark[Math.floor(dark.length / 2)]; }
    // barva zdi: nejsvětlejší ze vzorků mimo okno / tabuli
    const wallC = sm.filter((q) => !glass(q) && lum(q) >= 100).sort((a, b) => lum(b) - lum(a))[0] || mid;
    const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    if (!type && sat.length >= 3 && diff(sat[0], wallC) > 90) { type = 3; col = sat[0]; }   // plakát: jiná barva než zeď
    wcol[c * 3] = wallC[0]; wcol[c * 3 + 1] = wallC[1]; wcol[c * 3 + 2] = wallC[2];
    wft[c] = type; wfc[c * 3] = col[0]; wfc[c * 3 + 1] = col[1]; wfc[c * 3 + 2] = col[2];
  }
  // místnost s tmavými zdmi: to nejsou tabule, ale barva zdi
  let faces = 0, dark = 0, post = 0;
  for (let c = 0; c < W * H; c++) if (wcol[c * 3] || wcol[c * 3 + 1] || wcol[c * 3 + 2]) { faces++; if (wft[c] === 2) dark++; if (wft[c] === 3) post++; }
  if (faces && post / faces > 0.25) for (let c = 0; c < W * H; c++) if (wft[c] === 3) wft[c] = 0;   // barevné zdi, ne plakáty
  if (faces && dark / faces > 0.3) for (let c = 0; c < W * H; c++) if (wft[c] === 2) { wft[c] = 0; wcol[c * 3] = wfc[c * 3]; wcol[c * 3 + 1] = wfc[c * 3 + 1]; wcol[c * 3 + 2] = wfc[c * 3 + 2]; }
  Object.assign(M, { wcol, wft, wfc });
}
// --- Mapa místnosti: mřížka (0 volno, 1 zeď, 2 nábytek, 3 mimo hru, 4 dveře), dveře, úkryty ---
function hororMap(roomId) {
  if (HOROR_MAPS[roomId]) return HOROR_MAPS[roomId];
  const room = ROOMS[roomId], rule = HOROR_ROOMS()[roomId], rules = HOROR_ROOMS(), C = HOROR.CELL;
  const W = Math.ceil(room.w / C), H = Math.ceil(room.h / C), g = new Uint8Array(W * H);
  const allowed = (x, y) => {   // složená místnost: jen uvnitř dílů (mimo ně nic není)
    if (!room.parts) return true;
    const part = amongPartAt(room, x, y);
    return !!part && (!rule || rule.includes(part));
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) g[j * W + i] = allowed(room.x + (i + 0.5) * C, room.y + (j + 0.5) * C) ? 0 : 3;
  const cells = (r, f) => {
    for (let j = Math.max(0, Math.floor((r.y - room.y) / C)); j <= Math.min(H - 1, Math.ceil((r.y + r.h - room.y) / C) - 1); j++)
      for (let i = Math.max(0, Math.floor((r.x - room.x) / C)); i <= Math.min(W - 1, Math.ceil((r.x + r.w - room.x) / C) - 1); i++) f(j * W + i);
  };
  roomWalls(room).forEach((r) => cells(r, (k) => { if (g[k] !== 3) g[k] = 1; }));
  const stairs = (room.parts || []).filter((pt) => HOROR_STAIR_PARTS.includes(pt.id) && pt.frame).map((pt) => ({ x: pt.frame.x, y: pt.frame.y, floor: hororFloorNo(roomId) }));
  const inStairs = (x, y) => stairs.some((st) => x >= st.x && y >= st.y && x < st.x + 320 && y < st.y + 340);
  const obst = new Int16Array(W * H).fill(-1), hides = [];
  room.obstacles.forEach((o, k) => {
    const cx = o.rect.x + o.rect.w / 2, cy = o.rect.y + o.rect.h / 2;
    if (!allowed(cx, cy)) return;
    if (o.kind === 'void' || o.kind === 'plainwall') {   // černé místo mimo budovu = zeď; na schodišti díra dolů
      const pit = o.kind === 'void' && inStairs(cx, cy);
      cells(o.rect, (c) => { if (g[c] !== 3) g[c] = pit ? 6 : 1; });
      return;
    }
    cells(o.rect, (c) => { if (g[c] !== 3) { g[c] = 2; obst[c] = k; } });
    const f = HOROR_FURNITURE[o.kind];
    if (f && f.hide && !(o.kind === 'desk' && o.chairs !== false)) hides.push({ x: cx, y: cy, rect: o.rect, kind: o.kind, where: f.hide });   // pod lavicí se židlemi ne, pod katedrou ano
  });
  // dveře: průchozí do místností mapy (a východ ven), ostatní zamčené
  const doors = [], doorAt = new Int16Array(W * H).fill(-1);
  room.doors.forEach((d) => {
    if (rule && !rule.includes(d.part)) return;
    if (d.hidden && !(d.to in rules)) return;   // skryté místo (kávovar…) do místnosti, která v hororu není – nic tam není
    const exit = d.to === 'venku' && roomId === 'chodba', open = exit || (d.to in rules && !ROOMS[d.to].front);   // východ = hlavní vchod
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
  const M = { id: roomId, room, W, H, g, C, obst, doors, doorAt, hides, fl, fh, ch, drawers: [], stairs: stairs.length ? stairs : null, lamps: [] };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = room.x + (i + 0.5) * C, y = room.y + (j + 0.5) * C;
    let code = base;
    if (room.parts) {
      const part = amongPartAt(room, x, y);
      if (part === 'vstup') code = 4;
      if (HOROR_STAIR_PARTS.includes(part)) { code = 4; fh[j * W + i] = hororHeightAt(M, x, y, true); ch[j * W + i] = HOROR.FL + HOROR.WALL_H; }
    }
    fl[j * W + i] = code;
  }
  hororMapArt(M, hororArtScan(room));   // barvy, okna, tabule, schody z kresby hry
  // nábytek ve 3D (hororModel) a šuplíky – čelem k volné podlaze, s úchytkou
  const boxes = [], zb = (x, y, smooth) => hororHeightAt(M, x, y, !smooth), freeAt = (x, y) => hororCell(M, x, y) === 0;
  room.obstacles.forEach((o) => {
    if (!allowed(o.rect.x + o.rect.w / 2, o.rect.y + o.rect.h / 2) || o.kind === 'void' || o.kind === 'plainwall') return;
    const faceOf = () => {   // strana s nejvíc volnou podlahou před nábytkem
      let best = 'bottom', bn = -1;
      const cnt = {};
      for (const sd of ['bottom', 'top', 'right', 'left']) {
        let n = 0;
        for (const a of [0.25, 0.5, 0.75]) {
          const qx = sd === 'left' ? o.rect.x - 16 : sd === 'right' ? o.rect.x + o.rect.w + 16 : o.rect.x + o.rect.w * a;
          const qy = sd === 'top' ? o.rect.y - 16 : sd === 'bottom' ? o.rect.y + o.rect.h + 16 : o.rect.y + o.rect.h * a;
          if (freeAt(qx, qy)) n++;
        }
        cnt[sd] = n;
        if (n > bn) { bn = n; best = sd; }
      }
      // zády ke zdi: když je jedna strana zablokovaná a protější volná, čelem je ta protější
      const opp = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' };
      for (const sd of ['left', 'right', 'top', 'bottom']) if (cnt[sd] === 0 && cnt[opp[sd]] >= 2) return opp[sd];
      return best;
    };
    const m = hororModel(o, zb, faceOf());
    boxes.push(...m.boxes);
    if (!m.drawer) return;
    const R = m.drawer.rect || o.rect, horiz = R.w >= R.h;
    const parts = o.kind === 'lockers' ? Math.max(1, Math.round((horiz ? R.w : R.h) / 160)) : 1;
    for (let q = 0; q < parts; q++) {
      const r = parts > 1 ? (horiz ? { x: R.x + R.w * q / parts, y: R.y, w: R.w / parts, h: R.h } : { x: R.x, y: R.y + R.h * q / parts, w: R.w, h: R.h / parts }) : R;
      // čelo: strana, před kterou je nejvíc volné podlahy
      let best = null, bs = -1;
      for (const sd of ['top', 'bottom', 'left', 'right']) {
        let n = 0;
        for (const a of [0.25, 0.5, 0.75]) {
          const qx = sd === 'left' ? o.rect.x - 14 : sd === 'right' ? o.rect.x + o.rect.w + 14 : r.x + r.w * a;
          const qy = sd === 'top' ? o.rect.y - 14 : sd === 'bottom' ? o.rect.y + o.rect.h + 14 : r.y + r.h * a;
          if (freeAt(qx, qy)) n++;
        }
        const sl = sd === 'top' || sd === 'bottom' ? r.w : r.h;
        if (n * 1000 + sl > bs) { bs = n * 1000 + sl; best = sd; }
      }
      if (bs < 1000) continue;   // nikde volno – šuplík by nešel otevřít
      const hz = best === 'top' || best === 'bottom', len = hz ? r.w : r.h, w = Math.min(34, len - 4), z = zb(r.x + r.w / 2, r.y + r.h / 2);
      const DEP = 14, pr = hz ? { x: r.x + (r.w - w) / 2, y: best === 'top' ? o.rect.y - DEP : o.rect.y + o.rect.h, w, h: DEP } : { x: best === 'left' ? o.rect.x - DEP : o.rect.x + o.rect.w, y: r.y + (r.h - w) / 2, w: DEP, h: w };
      const id = `${roomId}:${M.drawers.length}`, lo = m.drawer.lo + z, hi = m.drawer.hi + z, mid = (lo + hi) / 2;
      const host = m.boxes.find((b) => b.s && r.x + r.w / 2 >= b.x && r.x + r.w / 2 <= b.x + b.w && r.y + r.h / 2 >= b.y && r.y + r.h / 2 <= b.y + b.h && b.z0 <= mid && b.z1 >= mid);   // skříňka, ve které šuplík je
      const col = host ? host.c : [150, 110, 70], front = col.map((v) => Math.min(255, v + 30));
      const nx = best === 'left' ? -1 : best === 'right' ? 1 : 0, ny = best === 'top' ? -1 : best === 'bottom' ? 1 : 0;
      const faceX = best === 'left' ? o.rect.x : o.rect.x + o.rect.w, faceY = best === 'top' ? o.rect.y : o.rect.y + o.rect.h;
      // obdélník šuplíku: a = podél čela (od kraje šuplíku), d = kolik před čelem, la / ld = délka / hloubka
      const DR = (a, d, la, ld) => (hz ? { x: pr.x + a, y: ny > 0 ? faceY + d : faceY - d - ld, w: la, h: ld } : { x: nx > 0 ? faceX + d : faceX - d - ld, y: pr.y + a, w: ld, h: la });
      const slide = { dr: id, nx, ny, dep: DEP }, brass = [218, 196, 120];
      // zavřený: světlejší čelo s hranou a mosazná úchytka
      boxes.push({ ...DR(0, 0, w, 0.8), z0: lo, z1: hi, c: front, s: 0, drc: id });
      boxes.push({ ...DR(w / 2 - 5, 0.8, 10, 1.4), z0: mid - 1, z1: mid + 1.2, c: brass, s: 0, drc: id });
      // otevřený (vysune se o DEP px): čelo, úchytka, boky, dno a tmavé vnitřky
      boxes.push({ ...DR(0, DEP - 1.2, w, 1.2), z0: lo, z1: hi, c: front, s: 0, ...slide });
      boxes.push({ ...DR(w / 2 - 5, DEP, 10, 1.4), z0: mid - 1, z1: mid + 1.2, c: brass, s: 0, ...slide });
      boxes.push({ ...DR(0, 0, 1.2, DEP - 1.2), z0: lo + 1, z1: hi - 2, c: col, s: 0, ...slide });
      boxes.push({ ...DR(w - 1.2, 0, 1.2, DEP - 1.2), z0: lo + 1, z1: hi - 2, c: col, s: 0, ...slide });
      boxes.push({ ...DR(1.2, 0, w - 2.4, DEP - 1.2), z0: lo + 1, z1: lo + 2.2, c: [62, 44, 28], s: 0, ...slide });
      M.drawers.push({ id, kind: o.kind, rect: o.rect, cx: r.x + r.w / 2, cy: r.y + r.h / 2, px: pr.x + pr.w / 2, py: pr.y + pr.h / 2, lo, hi });
    }
  });
  // věci nakreslené jen v obrázku místnosti (ne jako nábytek): koše v tělocvičně
  if (roomId === 'telocvicna') {
    const t = CONFIG.WALL_THICKNESS, cy = room.y + room.h / 2, B = (x, y, w, h, z0, z1, c) => boxes.push({ x, y, w, h, z0, z1, c: hororRGB(c), s: 0 });
    for (const [x, dir] of [[room.x + t, 1], [room.x + room.w - t, -1]]) {
      const bx = dir > 0 ? x : x - 3;
      B(bx, cy - 22, 3, 44, 78, 104, '#ffffff');                       // deska
      B(bx + dir * 0.2, cy - 8, 3.2, 16, 82, 92, '#d32f2f');           // čtverec na desce
      const rx = dir > 0 ? x + 3 : x - 21;
      B(rx, cy - 9, 18, 2, 84, 85.5, '#ff6f00'); B(rx, cy + 7, 18, 2, 84, 85.5, '#ff6f00');   // obroučka
      B(dir > 0 ? rx + 16 : rx, cy - 9, 2, 18, 84, 85.5, '#ff6f00');
      for (let k = 0; k < 4; k++) B(rx + 2 + k * 4, cy - 7, 1, 14, 74, 84, '#eeeeee');      // síťka
    }
  }
  // které krabice jsou v které buňce (paprsek je hledá po buňkách)
  const lists = Array.from({ length: W * H }, () => null);
  boxes.forEach((b, bi) => {
    const i0 = Math.max(0, Math.floor((b.x - room.x) / C)), i1 = Math.min(W - 1, Math.floor((b.x + b.w - room.x - 0.01) / C));
    const j0 = Math.max(0, Math.floor((b.y - room.y) / C)), j1 = Math.min(H - 1, Math.floor((b.y + b.h - room.y - 0.01) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (lists[j * W + i] = lists[j * W + i] || []).push(bi);
  });
  const cbStart = new Int32Array(W * H + 1), flat = [];
  for (let c = 0; c < W * H; c++) { cbStart[c] = flat.length; if (lists[c]) flat.push(...lists[c]); }
  cbStart[W * H] = flat.length;
  Object.assign(M, { boxes, cbStart, cbList: Int32Array.from(flat), stamp: new Uint32Array(boxes.length) });
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
  // klíče: 8 různých náhodných místností (kromě startu a Křiváčkova kabinetu), v každé náhodné místo
  const pool = Object.keys(HOROR_ROOMS()).filter((r) => r !== HOROR.START.room && r !== HOROR.GUN_ROOM), keys = [];
  const spotIn = (room) => hororRandomSpot(hororMap(room), null);
  while (keys.length < HOROR.KEYS && pool.length) {
    const room = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], s = spotIn(room);
    if (s) keys.push({ room, x: s.x, y: s.y, got: false });
  }
  // klíč od Křiváčka (🗝) a zbraň v jeho kabinetu (1–4 náboje)
  let kk = null;
  while (!kk && pool.length) { const room = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], s = spotIn(room); if (s) kk = { room, x: s.x, y: s.y, got: false, by: '' }; }
  const gs = HOROR.GUN_ROOM in HOROR_ROOMS() ? spotIn(HOROR.GUN_ROOM) : null;
  const gun = gs ? { room: HOROR.GUN_ROOM, x: gs.x, y: gs.y, by: '', ammo: 1 + Math.floor(Math.random() * 4) } : null;
  const rooms = Object.keys(HOROR_ROOMS()).filter((r) => r !== HOROR.START.room && !keys.some((k) => k.room === r));
  let lroom = rooms[Math.floor(Math.random() * rooms.length)], ls = hororRandomSpot(hororMap(lroom), null);
  if (!ls) { lroom = HOROR.LADA_START; ls = hororRandomSpot(hororMap(lroom), null); }
  return {
    keys, kk, gun, seed: Math.floor(Math.random() * 1e9),
    lada: { room: lroom, x: ls.x, y: ls.y, a: 0, mode: 'patrol', path: [], via: null, goal: null, pathT: 0, lookT: 0, stepT: 0, seenT: 99, tg: '' },
  };
}
// Hráč na začátku kola (i = pořadí online hráče – ať nestojí na sobě)
function hororResetPlayer(H, i) {
  const k = i || 0;
  H.p = { ...HOROR.START, x: HOROR.START.x + ((k % 2) ? 1 : -1) * Math.ceil(k / 2) * 34 };
  const U = (id) => (typeof hororUp === 'function' ? hororUp(id) : 0);   // vylepšení z obchodu (41_ucty_a_odmeny.js)
  H.up = { speed: 1 + 0.08 * U('rychlost'), stamina: HOROR.STAMINA + U('vydrz'), regen: 1 + 0.12 * U('vydrz'), bat: HOROR.BAT * (1 + 0.25 * U('baterka')), light: 1 + 0.15 * U('svetlo'), quiet: 1 - 0.25 * U('tichost') };
  H.bonusSp = U('nahradni');
  H.items = typeof hororItemsGet === 'function' ? hororItemsGet() : {};   // koupené věci (41_ucty_a_odmeny.js)
  Object.assign(H, { eyesT: 0, barT: 0, downed: false, flashT: 0 });
  Object.assign(H, { pitch: 0, stamina: H.up.stamina, tired: false, bob: 0, walk: 0, bat: 100, lightK: 1, pz: 0, ghost: false, hidden: null, hideSeen: false, doorCd: 0, fade: 0.4, breathT: 0, dark: 0, flicker: 1, scared: false });
}
function openHoror() {
  const r = hororMakeRound();
  state.horor = {
    phase: 'intro', t: 0, menuSel: 0, keys: r.keys, kk: r.kk, gun: r.gun, got: 0, seed: r.seed, lada: r.lada,
    open: new Set(), taken: new Set(), sp: {}, out: [], down: {}, sv: {}, hs: {}, hidPrev: {}, net: null,
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
  if (!H.net) hororResetPlayer(H, 0);   // vylepšení koupená v obchodě platí hned
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
  if (document.pointerLockElement === canvas || e.buttons) { H.p.a += e.movementX * HOROR.MOUSE; H.pitch = Math.max(-HOROR.PITCH, Math.min(HOROR.PITCH, (H.pitch || 0) - e.movementY * 0.9)); }
});
window.addEventListener('pointerdown', (e) => {
  const H = state.horor;
  if (!H || state.screen !== 'horor' || e.pointerType === 'mouse' || e.clientX <= window.innerWidth * CONFIG.JOY_ZONE_WIDTH) return;
  H.turnPtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  const H = state.horor;
  if (!H || !H.turnPtr || e.pointerId !== H.turnPtr.id) return;
  if (H.phase === 'play') { H.p.a += (e.clientX - H.turnPtr.x) * HOROR.TOUCH_TURN; H.pitch = Math.max(-HOROR.PITCH, Math.min(HOROR.PITCH, (H.pitch || 0) - (e.clientY - H.turnPtr.y) * 1.6)); }
  H.turnPtr.x = e.clientX; H.turnPtr.y = e.clientY;
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
// Jak moc je šuplík vysunutý (0 zavřený … 1 otevřený), plynule
function hororDrawerK(H, id) {
  const v = H.anim && H.anim[id];
  return v === undefined ? (H.open && H.open.has(id) ? 1 : 0) : v;
}
function hororDrawerAnim(H, dt) {
  H.anim = H.anim || {};
  for (const id of H.open) if (!(id in H.anim)) H.anim[id] = 0;
  for (const id of Object.keys(H.anim)) {
    const want = H.open.has(id) ? 1 : 0, v = H.anim[id];
    H.anim[id] = want > v ? Math.min(1, v + dt * 5) : Math.max(0, v - dt * 5);
    if (!want && H.anim[id] <= 0) delete H.anim[id];
  }
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
// Koupená věc z obchodu (druhá šance, tyčinka, očka, lékárnička): ubere se i z uložení
function hororUseItem(H, id) {
  if (!H.items || !(H.items[id] > 0)) return false;
  H.items[id]--;
  if (typeof hororItemAdd === 'function') hororItemAdd(id, -1);
  return true;
}
function hororSecondChance(H) {
  H.stamina = H.up.stamina; H.tired = false; H.barT = 3;
  hororSting();
  hororSay('🛡 Druhá šance! Vytrhl ses Láďovi – utíkej!', 3.5);
}
// Klávesy 1 / 2 / 3 a střelba (Q, klik): tyčinka, očka, lékárnička
function hororItemKey(H, which) {
  if (H.ghost || H.downed) return;
  if (which === 'tycinka') {
    if (!hororUseItem(H, 'tycinka')) { hororSay('Nemáš tyčinku – kup ji v ⭐ Vylepšení.', 2); return; }
    H.stamina = H.up.stamina; H.tired = false; H.barT = 10;
    hororTone(660, 0.1, 'triangle', 0.2); hororSay('🍫 Tyčinka! 10 s sprintuješ bez únavy.', 2.5);
  } else if (which === 'ocka') {
    if (!hororUseItem(H, 'ocka')) { hororSay('Nemáš očka – kup je v ⭐ Vylepšení.', 2); return; }
    H.eyesT = HOROR.EYES; hororSting();
  } else if (which === 'lekarnicka') {
    const mate = typeof hororDownNear === 'function' ? hororDownNear(H) : null;
    if (!mate) { hororSay(H.net ? 'Lékárničkou oživíš kamaráda, který leží (stoupni si k němu).' : 'Lékárnička je na oživení kamaráda v online hře.', 2.5); return; }
    if (!hororUseItem(H, 'lekarnicka')) { hororSay('Nemáš lékárničku – kup ji v ⭐ Vylepšení.', 2); return; }
    hororDo({ k: 'revive', to: mate.id });
    hororTone(784, 0.2, 'triangle', 0.25); hororSay(`⛑ Oživil jsi: ${mate.n}`, 2.5);
  }
}
function hororShoot(H) {
  const me = hororMe(), g = H.gun;
  if (!g || g.by !== me || H.ghost || H.downed) return;
  if (g.ammo <= 0) { hororSay('Došly náboje.', 1.5); return; }
  const L = H.lada, p = H.p;
  let hit = false;
  if (L.room === p.room && L.mode !== 'stun') {
    const d = hororDist(L, p), da = Math.abs(hororAngle(Math.atan2(L.y - p.y, L.x - p.x) - p.a));
    hit = d < 900 && da < Math.max(0.05, Math.atan(16 / d)) && hororCast(hororMap(p.room), p.x, p.y, Math.atan2(L.y - p.y, L.x - p.x), d).dist >= d - 6;
  }
  H.flashT = 0.12;
  hororNoise(0.35, 300, 0.9, 0); hororTone(90, 0.3, 'sawtooth', 0.3);
  hororDo({ k: 'shoot', hit });
  hororSay(hit ? `💤 Trefa! Láďa usnul na ${HOROR.STUN} s.` : 'Vedle…', 2.5);
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
    const opening = !H.open.has(d.id);
    if (opening) H.open.add(d.id); else H.open.delete(d.id);
    if (me) {
      hororNoise(0.22, 900, 0.3, 0);
      if (opening) hororSay(hororDrawerHas(H, d.id) && !H.taken.has(d.id) ? '🔋 V šuplíku je baterka! (E = vzít)' : 'Prázdný šuplík…', 1.6);
    }
  } else if (d.k === 'take') {
    if (!H.open.has(d.id) || H.taken.has(d.id) || !hororDrawerHas(H, d.id)) return;
    H.taken.add(d.id); H.sp[who]++;
    if (me) { hororTone(660, 0.12, 'triangle', 0.2); hororSay('🔋 Máš náhradní baterku (R = vyměnit)', 2.5); }
  } else if (d.k === 'use') {
    if (H.sp[who] <= 0) return;
    H.sp[who]--;
    if (me) { H.bat = 100; hororTone(880, 0.1, 'square', 0.12); hororSay('🔦 Nová baterka', 1.5); }
  } else if (d.k === 'give') {
    if (typeof d.to !== 'string' || (!d.free && H.sp[who] <= 0)) return;
    if (!d.free) H.sp[who]--;
    H.sp[d.to] = (H.sp[d.to] || 0) + 1;   // free = náhradní baterka z obchodu (počítá si ji hráč sám)
  } else if (d.k === 'key') {
    const key = H.keys[d.i];
    if (!key || key.got) return;
    key.got = true; key.by = who;
    H.got = H.keys.filter((k) => k.got).length;
    if (me) {
      hororTone(988, 0.15, 'triangle', 0.25); hororTone(1319, 0.3, 'triangle', 0.2, 0, 0, 0.12);
      hororSay(H.got < HOROR.KEYS ? `🔑 Klíč ${H.got}/${HOROR.KEYS}` : '🔑 Máte všechny klíče! Utečte hlavním vchodem (přízemí, dole ve vstupní chodbě)!', 3.5);
    }
    if (H.got === HOROR.SCARE_AT && !H.scared) { const t = hororWho(H, who); if (t) hororScare(H, t); }   // naháněčka
  } else if (d.k === 'kk') {   // klíč od Křiváčka – odemkne jeho kabinet všem
    if (!H.kk || H.kk.got) return;
    H.kk.got = true; H.kk.by = who;
    if (me) { hororTone(880, 0.15, 'triangle', 0.25); hororSay('🗝 Klíč od Křiváčka! Jeho kabinet (Přízemí, západní chodba) je odemčený – je tam zbraň.', 4.5); }
  } else if (d.k === 'gun') {
    if (!H.gun || H.gun.by) return;
    H.gun.by = who;
    if (me) { hororTone(330, 0.2, 'square', 0.2); hororSay(`Máš pistoli! Nábojů: ${H.gun.ammo}. Střílí se Q nebo klikem – zásah uspí Láďu na ${HOROR.STUN} s.`, 5); }
  } else if (d.k === 'shoot') {
    if (!H.gun || H.gun.by !== who || H.gun.ammo <= 0) return;
    H.gun.ammo--;
    if (d.hit) Object.assign(H.lada, { mode: 'stun', stunT: HOROR.STUN, path: [], via: null, tg: '' });
  } else if (d.k === 'revive') {
    if (H.down && typeof d.to === 'string' && d.to in H.down) delete H.down[d.to];
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
  if (L.mode === 'stun' || L.room !== t.room || t.hidden) return false;
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
  if (!H.ghost && !H.downed && H.phase !== 'caught' && H.p) out.push({ id: hororMe(), room: H.p.room, x: H.p.x, y: H.p.y, hidden: !!H.hidden, running: !!H.running, quiet: H.up ? H.up.quiet : 1 });
  if (H.net && typeof hororOthers === 'function') {
    for (const o of hororOthers()) if (!H.out.includes(o.id) && !o.gh && !(H.down && o.id in H.down)) out.push({ id: o.id, room: o.r, x: o.x, y: o.y, hidden: o.hh, running: o.hr, chance: o.ch });
  }
  return out;
}
// Chytil hráče id
function hororCatch(H, id) {
  const L = H.lada, me = id === hororMe();
  // 🛡 druhá šance: vytrhne se, Láďa je 3 s omráčený
  const t = me ? null : hororTargets(H).find((q) => q.id === id);
  if (me ? H.items && H.items.sance > 0 : t && t.chance) {
    if (me) { hororUseItem(H, 'sance'); hororSecondChance(H); } else H.sv[id] = (H.sv[id] || 0) + 1;
    Object.assign(L, { mode: 'stun', stunT: 3, path: [], via: null, tg: '' });
    return;
  }
  if (H.net) H.down[id] = HOROR.DOWN_TIME;   // online: leží, kamarádi ho můžou oživit lékárničkou
  else if (!H.out.includes(id)) H.out.push(id);
  if (me) hororCaught(H);
  Object.assign(L, { mode: 'look', lookT: HOROR.LADA.LOOK, path: [], via: null, tg: '' });
}
// Láďa – řídí ho jen jeden (sám / online hostitel), ostatním přijde poloha
function hororLada(H, dt) {
  const L = H.lada, cfg = HOROR.LADA;
  if (L.stunT > 0) {   // spí (zásah ze zbraně / druhá šance)
    L.stunT -= dt; L.mode = 'stun';
    if (L.stunT > 0) return;
    Object.assign(L, { mode: 'patrol', path: [], via: null, tg: '' });
  }
  const T = hororTargets(H);
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
    const heard = T.find((t) => t.room === L.room && t.running && hororDist(L, t) < cfg.HEAR * (t.quiet || 1));
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
      const rooms = Object.keys(HOROR_ROOMS()), halls = HOROR_HALLS.filter((r) => r in HOROR_ROOMS()), pick = Math.random() < 0.5 ? halls[Math.floor(Math.random() * halls.length)] : rooms[Math.floor(Math.random() * rooms.length)];
      const s = hororRandomSpot(hororMap(pick), null);
      if (s) hororPlan(L, { room: pick, x: s.x, y: s.y });
    }
  }
  // chůze po cestě, na konci cesty dveře → druhá místnost
  const speed = L.mode === 'chase' ? cfg.RUN : L.mode === 'check' ? cfg.CHECK : cfg.WALK;
  let move = L.mode === 'look' || L.mode === 'stun' ? 0 : speed * dt;
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
const HOROR_MENU = [0, 1, 2, 3].map((i) => ({ x: 250, y: 400 + i * 48, w: 300, h: 42 }));
const HOROR_ITEM_BTNS = [0, 1, 2, 3].map((i) => ({ x: 300 + i * 52, y: 34, w: 46, h: 34 }));   // 🍫 👁 ⛑ 🔫
window.addEventListener('mousedown', (e) => {   // klik se zamčenou myší = výstřel
  const H = state.horor;
  if (H && state.screen === 'horor' && H.phase === 'play' && document.pointerLockElement === canvas && e.button === 0) hororKeys.push('Mouse0');
});
const HOROR_BAT_BTN = { x: 660, y: 396, w: 120, h: 60 }, HOROR_GIVE_BTN = { x: 660, y: 322, w: 120, h: 60 }, HOROR_DRAWER_BTN = { x: 530, y: 470, w: 120, h: 60 };
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
      if (KEYMAP.up.includes(k)) H.menuSel = (H.menuSel + 3) % 4;
      if (KEYMAP.down.includes(k)) H.menuSel = (H.menuSel + 1) % 4;
    }
    if (H.t < 0.3) return;
    for (const e of events) {
      const i = e.type === 'action' ? H.menuSel : e.x != null ? HOROR_MENU.findIndex((r) => pointInRect(e.x, e.y, r, 4)) : -1;
      if (i === 0) { hororBegin(); return; }
      if (i === 1 && typeof hororOnlinePick === 'function') { hororOnlinePick(H); return; }
      if (i === 2 && typeof hororShopInput === 'function') { H.phase = 'shop'; H.shopSel = 0; H.shopMsgT = 0; return; }
      if (i === 3) { hororLeave(); return; }
    }
    return;
  }
  if (H.phase === 'shop') { H.shopMsgT = (H.shopMsgT || 0) - dt; hororShopInput(H, keys, events); return; }   // ⭐ Vylepšení (41_ucty_a_odmeny.js)
  if (H.phase === 'pause') {
    H.pauseT = (H.pauseT || 0) + dt;
    if ((keys.includes('Escape') && H.pauseT > 0.5) || keys.includes('KeyQ')) { hororLeave(); return; }
    if (tapped) { H.phase = 'play'; H.pauseT = 0; hororLock(); }
    return;
  }
  if (H.phase === 'caught' || H.phase === 'win') {
    H.caughtT += dt;
    if (H.caughtT < 1.6) return;
    if (H.net && H.phase === 'caught') {   // online: ležíš (kamarádi tě můžou oživit), nebo jsi duch
      H.phase = 'play'; hororDrone(true);
      if (H.ghost) hororSay('👻 Jsi duch – Láďa tě nevidí, pomáhej ostatním.', 5);
      else hororSay(`🆘 Ležíš! Kamarád tě může do ${HOROR.DOWN_TIME} s oživit lékárničkou.`, 5);
      return;
    }
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
  const drawerTap = events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_DRAWER_BTN, 6));
  if (!H.ghost) {
    const dr = hororDrawerNear(H);
    if (dr && (keys.includes('KeyE') || drawerTap)) { const a = hororDrawerAction(H, dr); hororDo({ k: a.k, id: a.id }); }
    else if (keys.includes('KeyF') || hideTap || (keys.includes('KeyE') && !dr)) hororToggleHide(H);
  }
  hororDrawerAnim(H, dt);
  // baterka: vybíjí se; R = vyměnit za náhradní; G = půjčit kamarádovi (online)
  const mySp = (H.sp[hororMe()] || 0) + (H.bonusSp || 0);
  if (!H.ghost) {
    const before = H.bat;
    H.bat = Math.max(0, H.bat - dt * 100 / H.up.bat);
    if (before > 20 && H.bat <= 20) hororSay(mySp ? 'Baterka slábne… R = vyměnit' : 'Baterka slábne! Hledej novou v šuplících.', 3);
    if (before > 0 && H.bat <= 0) hororSay(mySp ? 'Baterka došla! R = vyměnit' : 'Baterka došla! Najdi novou v šuplíku.', 3.5);
  }
  H.lightK = H.ghost ? 1 : H.bat > 25 ? 1 : H.bat > 0 ? 0.3 + 0.7 * H.bat / 25 : 0;
  if ((keys.includes('KeyR') || events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_BAT_BTN, 6) && mySp > 0)) && !H.ghost && H.bat < 100) {
    if (H.bonusSp > 0) { H.bonusSp--; H.bat = 100; hororTone(880, 0.1, 'square', 0.12); hororSay('🔦 Nová baterka', 1.5); }
    else if (mySp > 0) hororDo({ k: 'use' }); else hororSay('Nemáš náhradní baterku – hledej v šuplících.', 2);
  }
  const mate = typeof hororMateNear === 'function' ? hororMateNear(H) : null;
  if ((keys.includes('KeyG') || events.some((e) => e.x != null && pointInRect(e.x, e.y, HOROR_GIVE_BTN, 6))) && mate && !H.ghost) {
    if ((H.sp[hororMe()] || 0) > 0) { hororDo({ k: 'give', to: mate.id }); hororSay(`🔋 Půjčil jsi baterku: ${mate.n}`, 2); }
    else if (H.bonusSp > 0) { H.bonusSp--; hororDo({ k: 'give', to: mate.id, free: 1 }); hororSay(`🔋 Půjčil jsi baterku: ${mate.n}`, 2); }
    else hororSay('Nemáš náhradní baterku na půjčení.', 2);
  }
  // koupené věci: 1 tyčinka, 2 očka, 3 lékárnička; střelba Q / klik (na mobilu tlačítka nahoře)
  for (const [code, id] of [['Digit1', 'tycinka'], ['Digit2', 'ocka'], ['Digit3', 'lekarnicka']]) if (keys.includes(code)) hororItemKey(H, id);
  for (const e of events) {
    if (e.x == null) continue;
    const b = HOROR_ITEM_BTNS.findIndex((r) => pointInRect(e.x, e.y, r, 3));
    if (b >= 0 && b < 3) hororItemKey(H, ['tycinka', 'ocka', 'lekarnicka'][b]);
    if (b === 3) hororShoot(H);
  }
  if (keys.includes('KeyQ') || keys.includes('Mouse0')) hororShoot(H);
  if (H.eyesT > 0) H.eyesT -= dt;
  if (H.barT > 0) H.barT -= dt;
  if (H.flashT > 0) H.flashT -= dt;
  const p = H.p, M = hororMap(p.room), k = (c) => input.keys.has(c);
  // pohyb (ve skříni se stojí)
  let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const j = input.joy;
  if (j.active && Math.hypot(j.dx, j.dy) > CONFIG.JOY_DEADZONE) { fwd = -j.dy; side = j.dx; }
  if (H.hidden || H.downed) { fwd = 0; side = 0; }   // ve skříni / ležíš (online)
  const len = Math.hypot(fwd, side);
  const wantRun = (k('ShiftLeft') || k('ShiftRight') || (j.active && Math.hypot(j.dx, j.dy) > 0.95)) && len > 0;
  // výdrž: sprint ji bere, jinak se obnovuje; po vyčerpání chvíli sprintovat nejde
  if (H.tired && H.stamina >= HOROR.TIRED) H.tired = false;
  H.running = wantRun && !H.tired && H.stamina > 0;
  if (H.running && H.barT <= 0) { H.stamina = Math.max(0, H.stamina - dt); if (H.stamina <= 0) { H.tired = true; hororSay('Došel ti dech!', 1.5); } }
  else H.stamina = Math.min(H.up.stamina, H.stamina + dt * HOROR.REGEN * H.up.regen * (len > 0 ? 0.6 : 1));
  if (H.tired) { H.breathT -= dt; if (H.breathT <= 0) { H.breathT = 0.7; hororNoise(0.35, 700, 0.12, 0); } }
  if (len > 0) {
    const sp = (H.running ? HOROR.RUN : HOROR.SPEED) * H.up.speed * dt / Math.max(1, len);
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
      if (hororLockedDoor(H, d)) { if (H.msgT <= 0) hororSay('🔒 Kabinet Křiváček je zamčený – klíč od Křiváčka 🗝 je někde ve škole.', 2.5); H.doorCd = 1; break; }
      hororPlayerThrough(H, d);
      return;
    }
  }
  // klíč od Křiváčka a zbraň
  if (!H.ghost && !H.downed && (H.keyCd || 0) <= 0) {
    if (H.kk && !H.kk.got && H.kk.room === p.room && hororDist(H.kk, p) < 34) { H.keyCd = 0.5; hororDo({ k: 'kk' }); }
    if (H.gun && !H.gun.by && H.gun.room === p.room && hororDist(H.gun, p) < 34) { H.keyCd = 0.5; hororDo({ k: 'gun' }); }
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
  if (typeof mainMoneyAdd === 'function') { mainMoneyAdd(250); H.reward = 250; }   // odměna do peněz hry (41_ucty_a_odmeny.js)
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
  const near = k > 0 ? Math.pow(Math.max(0, 1 - dist / (HOROR.LIGHT * (H.up ? H.up.light : 1) * Math.max(0.2, k))), 1.15) : 0;
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
const HOROR_TEX_LUM = { 1: 504, 2: 324, 3: 648, 4: 490, 5: 292 };   // průměrný jas textur (k barvě z kresby)
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
      if (floor) {
        hororFloorTex(code, wx, wy, col);
        if (M.fc) {   // barva podlahy jako ve hře, kresba (spáry, kamínky) z textury
          const fi2 = Math.floor((wy - ry) / 4) * M.fcw + Math.floor((wx - rx) / 4);
          if (fi2 >= 0 && fi2 < M.fcw * M.fch) {
            const k = Math.max(0.55, Math.min(1.3, (col[0] + col[1] + col[2]) / (HOROR_TEX_LUM[code] || 500))), o3 = fi2 * 3;
            col[0] = M.fc[o3] * k; col[1] = M.fc[o3 + 1] * k; col[2] = M.fc[o3 + 2] * k;
          }
        }
      } else hororCeilTex(code, wx, wy, col);
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
const hororLockedDoor = (H, d) => d.to === HOROR.GUN_ROOM && !!H && !!H.kk && !H.kk.got;
function hororSignText(M, d) {
  if (d.exit) return { t: 'VÝCHOD', c: [30, 130, 60] };
  if (d.hidden) {   // konec schodů (u schodiště A šipka nahoru / dolů)
    const a = hororFloorNo(d.to), b = hororFloorNo(M.id), arrow = a > b ? '↑ ' : a < b ? '↓ ' : '';
    return { t: `${arrow}${ROOMS[d.to].name}`, c: [40, 90, 60] };
  }
  return d.open && !hororLockedDoor(state.horor, d) ? { t: ROOMS[d.to].name, c: [30, 60, 140] } : { t: `🔒 ${ROOMS[d.to].name}`, c: [80, 80, 90] };
}
// Pistole (kreslená, ne emoji): černý závěr s hlavní, rukojeť s dřevěnými střenkami, lučík a spoušť.
// (cx, cy) = střed, size = délka, k = jas (světlo baterky), hlaveň doleva
function hororDrawPistol(cx, cy, size, k) {
  const s = size / 40, c = (r, g, b) => `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-20, -12);
  ctx.fillStyle = c(28, 28, 32);
  ctx.fillRect(0, 2, 34, 8);                    // závěr
  ctx.fillRect(-4, 4, 5, 4);                    // ústí hlavně
  ctx.fillStyle = c(70, 70, 78); ctx.fillRect(2, 2, 30, 2);   // odlesk na závěru
  ctx.fillStyle = c(20, 20, 24);
  for (let x = 22; x < 32; x += 3) ctx.fillRect(x, 4, 1.2, 5);   // drážky na závěru
  ctx.fillRect(1, 0.5, 2, 2); ctx.fillRect(30, 0.5, 2, 2);   // mířidla
  ctx.beginPath();                               // rukojeť (šikmo dozadu)
  ctx.moveTo(22, 10); ctx.lineTo(33, 10); ctx.lineTo(37, 24); ctx.lineTo(27, 25); ctx.closePath();
  ctx.fillStyle = c(28, 28, 32); ctx.fill();
  ctx.beginPath(); ctx.moveTo(24.5, 12); ctx.lineTo(31.5, 12); ctx.lineTo(34.5, 22.5); ctx.lineTo(28, 23); ctx.closePath();
  ctx.fillStyle = c(110, 70, 40); ctx.fill();    // dřevěné střenky
  ctx.strokeStyle = c(28, 28, 32); ctx.lineWidth = 1.6;   // lučík
  ctx.beginPath(); ctx.moveTo(15, 10); ctx.quadraticCurveTo(15, 17, 22, 16); ctx.stroke();
  ctx.fillStyle = c(28, 28, 32); ctx.fillRect(18, 10, 1.6, 4);   // spoušť
  ctx.restore();
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
  if (s.kind === 'item') {   // klíč od Křiváčka / zbraň – svítí, ať jdou najít
    const size = Math.max(10, 34 / perp * proj * 0.35), y = hy(30) + Math.sin(H.t * 3) * 3;
    const g = ctx.createRadialGradient(sx, y, 2, sx, y, size * 1.6);
    g.addColorStop(0, `rgba(${s.glow}, 0.55)`); g.addColorStop(1, `rgba(${s.glow}, 0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, y, size * 1.6, 0, Math.PI * 2); ctx.fill();
    if (s.icon === '🔫') hororDrawPistol(sx, y, size * 1.5, Math.max(0.35, Math.min(1.3, l0 + 0.3)));
    else { ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.icon, sx, y); }
    return;
  }
  if (s.kind === 'mate' || s.kind === 'self') {   // kamarád (online) / já (očka): postava, jméno, baterka; ležící = na zemi
    const o = s.o || { phase: H.walk, blend: 0, n: 'Ty' }, scale = (106 / perp * proj) / 80, lying = s.kind === 'mate' && H.down && o.id in H.down;
    ctx.save();
    if ('filter' in ctx) ctx.filter = `brightness(${Math.max(0.3, l).toFixed(2)})`;
    ctx.translate(sx, feet); ctx.scale(scale, scale);
    if (lying) { ctx.rotate(-Math.PI / 2); ctx.translate(-8, 30); }
    drawFigure(0, 0, lying ? 0 : o.phase, lying ? 0 : o.blend, s.kind === 'self' ? skinLook(mySkin) : remoteLook(o));
    ctx.restore();
    const fsz = `bold ${Math.round(Math.max(10, Math.min(16, 14 / perp * proj * 0.4)))}px sans-serif`;
    if (lying) drawOutlinedText(`🆘 ${o.n} – ${Math.ceil(H.down[o.id])} s (⛑ = 3)`, sx, hy(50), fsz, '#ff8a80', 'middle');
    else drawOutlinedText(`${o.n}${o.hb !== undefined ? ` 🔋${o.hb}%` : ''}`, sx, hy(124), fsz, '#ffffff', 'middle');
    return;
  }
  const stun = H.lada.mode === 'stun';
  if (stun) drawOutlinedText('💤', sx + Math.sin(H.t * 2) * 6, hy(HOROR.LADA.HEIGHT + 10) - (H.t * 20 % 20), `bold ${Math.round(Math.max(12, 30 / perp * proj * 0.5))}px sans-serif`, '#bbdefb', 'middle');
  const scale = (HOROR.LADA.HEIGHT / perp * proj) / 80, phase = H.lada.mode === 'chase' ? H.t * 12 : H.lada.mode === 'look' || stun ? 0 : H.t * 6;
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
const HOROR_COL = { ovl: [], hits: [], tick: 0, samp: new Float32Array(400 * 3 * 96), n: new Int16Array(400) };   // samp: kde je co zakryté (pro postavy a klíče)
function hororColumn(H, M, ray, x, cw, horizon, proj, E, Ht, ci) {
  const C = M.C, W = M.W, ox = H.p.x, oy = H.p.y, px = (ox - M.room.x) / C, py = (oy - M.room.y) / C, dx = ray.dx, dy = ray.dy, cos = ray.cos;
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9)), stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
  let sx = (dx < 0 ? px - mx : mx + 1 - px) * ddx, sy = (dy < 0 ? py - my : my + 1 - py) * ddy;
  const Y = (d, h) => horizon + (E - h) / d * proj;
  const ovl = HOROR_COL.ovl, hits = HOROR_COL.hits, tick = ++HOROR_COL.tick;
  ovl.length = 0;
  const SM = HOROR_COL.samp, sOff = ci * 3 * 96;
  let ns = 0;
  let ytop = 0, ybot = Ht, cell = my * W + mx;
  const inMap = mx >= 0 && my >= 0 && mx < W && my < M.H;
  let prevBase = inMap ? M.fh[cell] : 0, prevC = inMap ? M.ch[cell] : HOROR.WALL_H, prevCell = inMap ? cell : -1, d0 = 0.6, zb = 1600;
  const stoneC = (c) => (M.cellCol && c >= 0 ? M.cellCol(c) : [196, 194, 188]);
  const light = (d) => hororLightAt(H, d, ray.cam);
  const fill = (c, k, a, b) => {   // svislý pruh barvy c (× k) mezi y a, b – jen v otevřeném místě
    const y0 = Math.max(ytop, Math.min(a, b)), y1 = Math.min(ybot, Math.max(a, b));
    if (y1 <= y0 || k < 0.01) return;
    ctx.fillStyle = `rgb(${Math.min(255, c[0] * k) | 0}, ${Math.min(255, c[1] * k) | 0}, ${Math.min(255, c[2] * k) | 0})`;
    ctx.fillRect(x, y0, cw, y1 - y0);
  };
  // nábytek v buňce: přesný průsečík paprsku s každou krabicí; plné (stojí na zemi) hned, ostatní nakonec
  const doBoxes = (cl) => {
    hits.length = 0;
    for (let q = M.cbStart[cl]; q < M.cbStart[cl + 1]; q++) {
      const bi = M.cbList[q];
      if (M.stamp[bi] === tick) continue;
      M.stamp[bi] = tick;
      const b = M.boxes[bi];
      let bx = b.x, by = b.y;
      if (b.drc && hororDrawerK(H, b.drc) > 0.02) continue;   // čelo zavřeného šuplíku
      if (b.dr) {   // vysunutý šuplík (plynule)
        const kk = hororDrawerK(H, b.dr);
        if (kk <= 0.02) continue;
        bx += b.nx * (kk - 1) * b.dep; by += b.ny * (kk - 1) * b.dep;
      }
      let t0 = -1e9, t1 = 1e9, ax = 0;
      if (Math.abs(dx) < 1e-9) { if (ox < bx || ox > bx + b.w) continue; } else {
        let a = (bx - ox) / dx, c = (bx + b.w - ox) / dx;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = a; t1 = c;
      }
      if (Math.abs(dy) < 1e-9) { if (oy < by || oy > by + b.h) continue; } else {
        let a = (by - oy) / dy, c = (by + b.h - oy) / dy;
        if (a > c) { const s = a; a = c; c = s; }
        if (a > t0) { t0 = a; ax = 1; }
        t1 = Math.min(t1, c);
      }
      if (t1 < t0 || t1 <= 0.5) continue;
      hits.push({ b, t0: Math.max(0.5, t0), t1, ax, bx, by });
    }
    if (hits.length > 1) hits.sort((p, q) => p.t0 - q.t0 || p.b.z0 - q.b.z0);
    let cover = Infinity;   // zakrytí od plných krabic – použije se, až je nakreslený celý „sloupec“ nad sebou (skříňka na soklu…)
    const flush = (t) => { if (cover < Infinity && !(t < Infinity && Math.abs(t - lastT) < 0.6)) { ybot = Math.min(ybot, cover); cover = Infinity; } };
    let lastT = -1;
    for (const h of hits) {
      flush(h.t0);
      const b = h.b, e0 = h.t0 * cos, e1 = h.t1 * cos, lb = light(e0) * (h.ax ? 0.72 : 1);
      const along = h.ax ? ox + dx * h.t0 - h.bx : oy + dy * h.t0 - h.by, len = h.ax ? b.w : b.h, edge = len > 4 && (along < 1.2 || len - along < 1.2);
      if (b.s) {
        fill(b.c, lb * (edge ? 0.62 : 1), Y(e0, b.z1), Y(e0, b.z0));
        if (b.z1 < E) fill(b.c, light(e0) * 1.12, Y(e1, b.z1), Y(e0, b.z1));
        fill(b.c, Math.min(1.6, lb * 1.3 + 0.05), Y(e0, b.z1), Y(e0, b.z1 - 1.2));   // osvětlená horní hrana
        cover = Math.min(cover, b.z1 < E ? Y(e1, b.z1) : Y(e0, b.z1)); lastT = h.t0;
      } else {   // průhledné (nohy, desky, opěradla): daleko jen větší kusy, a nejvýš 48 na sloupec (rychlost)
        flush(Infinity);
        if (ovl.length < 48 && (e0 < 320 || b.w > 3.5 && b.h > 3.5) && lb > 0.02) ovl.push({ b, e0, e1, lb, lt: light(e0), edge, ytop, ybot });
      }
    }
    flush(Infinity);
  };
  if (inMap) doBoxes(cell);
  let side = 0, t = 0;
  for (let k = 0; k < 400; k++) {
    if (sx < sy) { t = sx; sx += ddx; mx += stepX; side = 0; } else { t = sy; sy += ddy; my += stepY; side = 1; }
    const d1 = Math.max(0.6, t * C * cos);
    // podlaha a strop buňky, kterou paprsek právě opustil (od d0 do d1): schody / díra, vysoký strop schodiště
    if (prevBase !== 0 && prevBase < E) fill(stoneC(prevCell), light((d0 + d1) / 2) * (prevBase < 0 ? 0.7 : 1), Y(d1, prevBase), Y(d0, prevBase));
    ybot = Math.min(ybot, Y(d0, prevBase), Y(d1, prevBase));
    if (prevC > E && prevC !== HOROR.WALL_H) fill([18, 18, 20], light(d1), Y(d0, prevC), Y(d1, prevC));
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
    const base = M.fh[cell], c = M.ch[cell], l = light(d1) * (side ? 0.72 : 1);
    if (base > prevBase) { fill(stoneC(cell), l * 0.72, Y(d1, base), Y(d1, prevBase)); fill([90, 88, 84], l, Y(d1, base), Y(d1, base) + Math.max(1, 1.5 / d1 * proj)); }   // podstupnice a hrana schodu
    ybot = Math.min(ybot, Y(d1, Math.max(base, prevBase)));
    if (c < prevC) { fill(hororStyle(M.id, null).top, l, Y(d1, prevC), Y(d1, c)); ytop = Math.max(ytop, Y(d1, c)); }   // překlad nad vchodem na schodiště
    if (ns < 96) { SM[sOff + ns * 3] = d1; SM[sOff + ns * 3 + 1] = ytop; SM[sOff + ns * 3 + 2] = ybot; ns++; }
    if (ytop >= ybot) { zb = d1; break; }
    doBoxes(cell);
    if (ytop >= ybot) { zb = d1; break; }
    prevBase = base; prevC = c; prevCell = cell;
  }
  HOROR_COL.n[ci] = ns;
  // průhledné věci (desky stolů, nohy, židle, monitory, zábradlí, vytažené šuplíky) od nejvzdálenější
  for (let i = ovl.length - 1; i >= 0; i--) {
    const o = ovl[i], b = o.b;
    ytop = o.ytop; ybot = o.ybot;
    fill(b.c, o.lb * (o.edge ? 0.62 : 1), Y(o.e0, b.z1), Y(o.e0, b.z0));
    if (b.z1 < E) fill(b.inner ? [60, 42, 26] : b.c, o.lt * (b.inner ? 1 : 1.12), Y(o.e1, b.z1), Y(o.e0, b.z1));
    else if (b.z0 > E) fill(b.c, o.lt * 0.5, Y(o.e0, b.z0), Y(o.e1, b.z0));
    if (b.z1 - b.z0 > 1.5) fill(b.c, Math.min(1.6, o.lb * 1.3 + 0.05), Y(o.e0, b.z1), Y(o.e0, b.z1 - 0.8));
  }
  return zb;
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
  // zeď podle dílu: barva z kresby hry (jinak podle stylu), dole sokl, pruh / lišta
  const low = hy(ws.lowH), ci = hit.cell, wc = M.wcol && ci >= 0 && (M.wcol[ci * 3] || M.wcol[ci * 3 + 1]) ? [M.wcol[ci * 3], M.wcol[ci * 3 + 1], M.wcol[ci * 3 + 2]] : ws.top;
  fill(wc, l * seam, top, low);
  const ft = M.wft && ci >= 0 ? M.wft[ci] : 0;
  if (ft) {
    const fc = [M.wfc[ci * 3], M.wfc[ci * 3 + 1], M.wfc[ci * 3 + 2]], cellNo = Math.floor(hit.u);
    if (ft === 1) {   // okno: rám, sklo (venku noc, trochu měsíc), příčky
      const moon = Math.max(l, 0.32), frame = u < 0.09 && cellNo % 3 === 0;
      fill([226, 224, 216], l, hy(116), hy(44));
      if (!frame) {
        fill([fc[0] * 0.28, fc[1] * 0.34, fc[2] * 0.48], moon, hy(112), hy(48));
        fill([226, 224, 216], l, hy(84), hy(81));   // příčka
      }
      fill([236, 234, 228], l * 1.1, hy(44), hy(41));   // parapet
    } else if (ft === 2) {   // tabule: dřevěný rám a plocha
      fill([138, 90, 46], l, hy(104), hy(40));
      fill(fc, Math.max(l, 0.05) * 1.1, hy(101), hy(43));
      fill([200, 196, 180], l, hy(44), hy(41));   // lišta na křídy
    } else if (ft === 3 && (u > 0.15 && u < 0.85)) fill(fc, l, hy(98), hy(70));   // plakát
  }
  if (ws.panel && u > 0.12 && u < 0.88 && (Math.floor(hit.u) % 7) > 0) fill(ws.panel, l, hy(122), hy(60));
  fill(ws.low, l * seam, low, bot);
  if (ws.panel) fill(ws.band, l, hy(ws.lowH + ws.bandH), low); else fill(ws.band, l, hy(ws.bandH), bot);
}
// Výška podlahy pod bodem (na schodech; přesně = plynule pro kameru, jinak po stupních)
function hororHeightAt(M, x, y, steps) {
  for (const s of M.stairs || []) {
    const lx = x - s.x, ly = y - s.y;
    if (lx >= 0 && ly >= 0 && lx < 320 && ly < 340) return hororStairH(s.floor, lx, ly, steps);
  }
  if (!M.fi) return 0;
  const i = Math.floor((x - M.room.x) / M.C), j = Math.floor((y - M.room.y) / M.C);
  if (i < 0 || j < 0 || i >= M.W || j >= M.H) return 0;
  const c = j * M.W + i, k = M.fi[c];
  if (k >= 0 && M.flightsAll && !Number.isNaN(M.flightsAll[k].base)) return hororFlightH(M.flightsAll[k], x, y, steps);
  return M.fh[c];
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
  if (H.eyesT > 0 && H.p && H.lada && H.phase === 'play') {   // 👁 očka: pohled Láďovýma očima
    const L = H.lada, save = { p: H.p, pz: H.pz, pitch: H.pitch, bob: H.bob, hidden: H.hidden, lightK: H.lightK };
    H.viewSelf = H.p;
    H.p = { room: L.room, x: L.x, y: L.y, a: L.a };
    H.pz = hororHeightAt(hororMap(L.room), L.x, L.y, false) + 34; H.pitch = 0; H.bob = 0; H.hidden = null; H.lightK = 1;
    try { hororRenderView(H); } finally { Object.assign(H, save); H.viewSelf = null; }
    ctx.fillStyle = 'rgba(160, 0, 0, 0.25)'; ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
    drawOutlinedText(`👁 Láďovýma očima… ${Math.ceil(H.eyesT)} s`, CONFIG.WIDTH / 2, 120, 'bold 24px sans-serif', '#ff8a80', 'middle');
    return;
  }
  hororRenderView(H);
}
function hororRenderView(H) {
  if (!H.p) { drawHororHud(H); return; }
  const p = H.p, M = hororMap(p.room), wide = VIEW.offX, left = -wide, width = CONFIG.WIDTH + 2 * wide, Ht = CONFIG.HEIGHT;
  const shake = H.phase === 'caught' && H.caughtT < 1.4 ? (Math.random() - 0.5) * 22 : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);
  ctx.fillStyle = '#000000';
  ctx.fillRect(left - 20, -20, width + 40, Ht + 40);
  const horizon = Ht / 2 + H.bob + (H.pitch || 0), tanF = Math.tan(HOROR.FOV / 2), proj = (width / 2) / tanF, E = (H.downed ? 14 : HOROR.EYE) + (H.pz || 0);   // ležíš = oči u země
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
  if (H.phase !== 'caught' && H.lada.room === p.room && !H.viewSelf) sprites.push({ x: H.lada.x, y: H.lada.y, kind: 'lada' });
  if (H.viewSelf && H.viewSelf.room === p.room && !H.ghost) sprites.push({ x: H.viewSelf.x, y: H.viewSelf.y, kind: 'self' });
  if (H.kk && !H.kk.got && H.kk.room === p.room) sprites.push({ x: H.kk.x, y: H.kk.y, kind: 'item', icon: '🗝', glow: '255, 200, 60' });
  if (H.gun && !H.gun.by && H.gun.room === p.room) sprites.push({ x: H.gun.x, y: H.gun.y, kind: 'item', icon: '🔫', glow: '160, 200, 255' });
  for (const d of M.doors) {
    if ((d.ix - d.cx) * (p.x - d.cx) + (d.iy - d.cy) * (p.y - d.cy) <= 0) continue;   // jen ze strany místnosti
    const half = Math.min(d.w, d.h) / 2, vx = d.ix - d.cx, vy = d.iy - d.cy, vl = Math.hypot(vx, vy) || 1;
    sprites.push({ x: d.cx + vx / vl * half, y: d.cy + vy / vl * half, kind: 'sign', d });
  }
  for (const lamp of M.lamps) sprites.push({ x: lamp.x, y: lamp.y, kind: 'lamp' });
  for (const dr of M.drawers) if (hororDrawerK(H, dr.id) > 0.85 && hororDrawerHas(H, dr.id) && !H.taken.has(dr.id)) sprites.push({ x: dr.px, y: dr.py, kind: 'bat', h: dr.lo + 6 });
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
  if (H.downed) { ctx.fillStyle = `rgba(150, 0, 0, ${0.25 + 0.1 * Math.sin(H.t * 3)})`; ctx.fillRect(left, 0, width, Ht); }   // ležíš
  if (H.flashT > 0) { ctx.fillStyle = 'rgba(255, 240, 200, 0.35)'; ctx.fillRect(left, 0, width, Ht); }   // výstřel
  if (H.hidden && HOROR_HIDE_IN.includes(H.hidden.kind)) {   // ve skříni / skříňce / kabince: tma a škvíra mezi dvířky
    ctx.fillStyle = 'rgba(0, 0, 0, 0.93)';
    ctx.fillRect(left, 0, width / 2 - 26, Ht); ctx.fillRect(left + width / 2 + 26, 0, width / 2, Ht);
    ctx.fillStyle = 'rgba(40, 26, 14, 0.9)';
    ctx.fillRect(left + width / 2 - 34, 0, 8, Ht); ctx.fillRect(left + width / 2 + 26, 0, 8, Ht);
  } else if (H.hidden) {   // pod / za nábytkem: nahoře deska, kouká se jen škvírou u země
    ctx.fillStyle = 'rgba(0, 0, 0, 0.94)';
    ctx.fillRect(left, 0, width, Ht * 0.6); ctx.fillRect(left, Ht * 0.86, width, Ht * 0.14);
    ctx.fillStyle = 'rgba(70, 48, 28, 0.95)'; ctx.fillRect(left, Ht * 0.6, width, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(left, Ht * 0.6 + 10, width * 0.08, Ht * 0.26); ctx.fillRect(left + width * 0.92, Ht * 0.6 + 10, width * 0.08, Ht * 0.26);
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
    ctx.font = 'bold 10px sans-serif';
    // kde jsou klíče, se neukazuje – musíš je najít
    if (H.kk && H.kk.got) { ctx.fillStyle = '#7ee08a'; ctx.fillText('🗝 Křiváček odemčen', 104, 28); }
    // věci a zbraň (tlačítka nahoře – na mobilu se na ně ťuká)
    const it = H.items || {}, g = H.gun && H.gun.by === hororMe() ? H.gun : null;
    [['🍫', it.tycinka, '1'], ['👁', it.ocka, '2'], ['⛑', it.lekarnicka, '3'], ['🔫', g ? g.ammo : 0, 'Q']].forEach(([ic, n, key], i) => {
      if (!n && !(i === 3 && g)) return;
      const r = HOROR_ITEM_BTNS[i];
      roundRectPath(r.x, r.y, r.w, r.h, 6); ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fill();
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
      if (i === 3) hororDrawPistol(r.x + 15, r.y + r.h / 2 + 1, 22, 1.6); else ctx.fillText(ic, r.x + 15, r.y + r.h / 2 + 1);
      ctx.font = 'bold 11px sans-serif'; ctx.fillText(`${n || 0}`, r.x + 33, r.y + 12);
      if (keysHint) { ctx.fillStyle = '#9e9e9e'; ctx.fillText(key, r.x + 33, r.y + 26); }
    });
    ctx.textAlign = 'left';
    if (H.downed) drawOutlinedText(`🆘 Ležíš! Kamarád tě může oživit lékárničkou – ${Math.ceil(H.downT || 0)} s`, W / 2, Ht / 2 + 60, 'bold 20px sans-serif', '#ff8a80', 'middle');
    if (H.lada && H.lada.mode === 'stun') drawOutlinedText('💤 Láďa spí', W / 2, 92, 'bold 14px sans-serif', '#bbdefb', 'middle');
    // sprint (výdrž)
    drawOutlinedText(H.tired ? 'Došel dech…' : keysHint ? 'Sprint (Shift)' : 'Sprint', 90, 72, 'bold 11px sans-serif', H.tired ? '#ff8a80' : '#cfcfcf', 'middle');
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fillRect(20, 82, 140, 9);
    ctx.fillStyle = H.tired ? '#e53935' : H.stamina < 1.2 ? '#ff9800' : '#9ccc65';
    ctx.fillRect(20, 82, 140 * H.stamina / H.up.stamina, 9);
    // baterka a náhradní baterky
    const sp = (H.sp[hororMe()] || 0) + (H.bonusSp || 0);
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
    const dr = hororDrawerNear(H), hn = hororHideNear(H);
    if (dr) {
      const a = hororDrawerAction(H, dr);
      if (keysHint) drawOutlinedText(`E – ${a.label}`, W / 2, Ht - 60, 'bold 18px sans-serif', '#ffd54a', 'middle');
      else drawChessButton(HOROR_DRAWER_BTN, a.label, false, '#5a4632');
    }
    if ((H.hidden || hn) && !H.ghost) {
      const label = H.hidden ? 'Vylézt' : `Schovat se`;
      if (keysHint) drawOutlinedText(`${dr ? 'F' : 'E'} – ${label}${hn ? ` (${hn.where})` : ''}`, W / 2, Ht - (dr ? 86 : 60), 'bold 18px sans-serif', '#ffd54a', 'middle');
      else drawChessButton(HOROR_HIDE_BTN, `🫣 ${label}`, false, '#4a3a28');
    }
    if (!keysHint && sp > 0 && H.bat < 60 && !H.ghost) drawChessButton(HOROR_BAT_BTN, '🔋 Vyměnit', false, '#3d5a2a');
    const mate = typeof hororMateNear === 'function' ? hororMateNear(H) : null;
    if (mate && sp > 0 && !H.ghost) {
      if (keysHint) drawOutlinedText(`G – půjčit baterku: ${mate.n}`, W / 2, Ht - 86, 'bold 15px sans-serif', '#a5d6a7', 'middle');
      else drawChessButton(HOROR_GIVE_BTN, '🔋 Půjčit', false, '#2a4a5a');
    }
    if (H.t < 7 && H.phase === 'play') drawOutlinedText(keysHint ? 'WASD – chůze · myš – rozhlížení · Shift – sprint · E – šuplík · F – schovat · R – baterka · Esc – pauza' : 'Joystick – chůze · táhni vpravo – otáčení', W / 2, Ht - 24, 'bold 13px sans-serif', '#cfcfcf', 'middle');
  }
  if (H.phase === 'intro') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, Ht);
    drawOutlinedText('👻 BACHA NA LÁĎU', W / 2, 130, 'bold 46px sans-serif', '#ff4d4d', 'middle');
    ['Je noc. Zůstal jsi zamčený ve škole.', 'Po chodbách a třídách chodí Láďa… a hledá tě.', `Najdi ${HOROR.KEYS} klíčů (pokaždé jinde) a uteč hlavním vchodem.`,
      'Když tě uvidí, utíkej – ztrať se mu z očí, nebo se schovej.', 'Baterka se vybíjí – nové jsou v šuplících. Klíč od Křiváčka 🗝 odemkne jeho kabinet s pistolí.']
      .forEach((t, i) => drawOutlinedText(t, W / 2, 185 + i * 28, 'bold 16px sans-serif', '#ffffff', 'middle', W - 40));
    drawOutlinedText(keysHint ? 'WASD – chůze · myš – rozhlížení · Shift – sprint · E – šuplík · F – schovat · R – baterka' : 'Joystick vlevo – chůze (naplno = sprint) · táhni vpravo – rozhlížení', W / 2, 335, 'bold 13px sans-serif', '#cfcfcf', 'middle', W - 30);
    drawOutlinedText(`🎧 Nejlepší se sluchátky   ·   💰 ${typeof mainMoneyGet === 'function' ? mainMoneyGet() : 0} Kč   ·   za útěk +250 Kč`, W / 2, 365, 'bold 14px sans-serif', '#ffd54a', 'middle');
    ['🔦 Hrát sám', '👥 Hrát s kamarády (online, max 4)', '⭐ Vylepšení postavy', 'Zpět'].forEach((t, i) => drawChessButton(HOROR_MENU[i], t, i === H.menuSel, ['#7a2a2a', '#2f5a7a', '#7a5a12', '#5a4636'][i]));
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
    drawOutlinedText(`Za ${Math.round(H.winT || 0)} s – Láďa zůstal ve škole sám.${H.reward ? `  💰 +${H.reward} Kč` : ''}`, W / 2, 272, 'bold 18px sans-serif', '#ffffff', 'middle');
    if (H.caughtT >= 1.6) chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? 'Hrát znovu' : 'Odejít', i === H.overSel));
  }
  if (typeof drawHororNet === 'function') drawHororNet(H);   // online: seznam her, čekárna, konec (40_horor_online.js)
  if (H.phase === 'shop' && typeof drawHororShop === 'function') drawHororShop(H);   // ⭐ Vylepšení (41_ucty_a_odmeny.js)
}

// Úvod → 🎮 Módy → 👻 Bacha na Láďu (10_obrazovky.js, modesItems)
{
  const _press = pressButton;
  pressButton = function (id) { if (id === 'horor') openHoror(); else _press(id); };
}
