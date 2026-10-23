// Katalog úkolů, mapa školy a výběr písničky
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// KATALOG ÚKOLŮ – seznam všech úkolů a jejich stav (Q / tlačítko vpravo nahoře)
// =====================================================================
const CATALOG_PANEL = { x: 60, y: 64, w: 680, h: 500 };
const CATALOG_ROW = 82;           // výška jednoho úkolu v seznamu
const CATALOG_VISIBLE = 5;        // kolik úkolů je vidět najednou (víc → posun šipkami)

function toggleCatalog() {
  if (state.catalog) { state.catalog = null; return; }
  if (state.dialog || state.transition) return;
  state.map = state.inventory = null;
  // výběr začne na úkolu, na kterém hráč naposledy pracoval
  const i = Math.max(0, activeQuests().findIndex((q) => q.id === state.tracked));
  state.catalog = { sel: i };
  playSound([[660, 0, 0.04], [880, 0.05, 0.05]]);
}
function catalogMove(d) {
  const c = state.catalog;
  c.sel = Math.min(activeQuests().length - 1, Math.max(0, c.sel + d));
}
// Ťuknutí na tlačítko katalogu (vpravo nahoře) – otevře / zavře
function takeCatalogTaps() {
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, CONFIG.CATALOG_BUTTON, 4);
    if (hit) toggleCatalog();
    return !hit;
  });
}

function drawCatalogButton() {
  const b = CONFIG.CATALOG_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = state.catalog ? 'rgba(255, 213, 74, 0.9)' : 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  // ikonka: deska s papírem a řádky
  const x = b.x + 9, y = b.y + 5;
  drawRect({ x, y: y + 1, w: 16, h: 19 }, state.catalog ? '#2b1d14' : '#ffffff');
  drawRect({ x: x + 5, y, w: 6, h: 3 }, state.catalog ? '#2b1d14' : '#ffffff');
  ctx.fillStyle = state.catalog ? '#ffd54a' : '#2b2b2b';
  for (let k = 0; k < 4; k++) ctx.fillRect(x + 3, y + 6 + k * 3.5, 10, 1.5);
  // počet rozdělaných úkolů
  const active = activeQuests().filter((q) => ['assigned', 'carrying'].includes(questStage(q))).length;
  if (active && !state.catalog) {
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(b.x + b.w - 3, b.y + 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(active), b.x + b.w - 3, b.y + 4.5);
  }
}

function drawCatalog() {
  const c = state.catalog;
  if (!c) return;
  const P = CATALOG_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8';
  ctx.fill();
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#3b2a1c';
  ctx.fillText('Seznam úkolů', P.x + 24, P.y + 32);
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Splněno ${questsDone()} z ${activeQuests().length}`, P.x + P.w - 24, P.y + 32);
  ctx.fillStyle = 'rgba(59, 42, 28, 0.25)';
  ctx.fillRect(P.x + 20, P.y + 56, P.w - 40, 2);

  // posun seznamu, ať je vybraný úkol vidět
  const quests = activeQuests();
  const first = Math.min(Math.max(0, c.sel - CATALOG_VISIBLE + 1), Math.max(0, quests.length - CATALOG_VISIBLE));
  const look = {
    none:     { color: '#9e9e9e', mark: '•', label: 'Nový' },
    assigned: { color: '#f0a020', mark: '▶', label: 'Rozdělaný' },
    carrying: { color: '#f0a020', mark: '▶', label: 'Odnes' },
    done:     { color: '#43a047', mark: '✔', label: 'Hotovo' },
  };
  quests.slice(first, first + CATALOG_VISIBLE).forEach((q, k) => {
    const i = first + k;
    const y = P.y + 66 + k * CATALOG_ROW;
    const st = questStage(q), L = look[st];
    roundRectPath(P.x + 16, y, P.w - 32, CATALOG_ROW - 8, 10);
    ctx.fillStyle = i === c.sel && !isTouchHint() ? '#ffe9a8' : st === 'done' ? '#e6efdc' : '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // značka stavu
    ctx.fillStyle = L.color;
    ctx.beginPath(); ctx.arc(P.x + 46, y + 37, 16, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText(L.mark, P.x + 46, y + 38);
    // název, kdo zadává, co dělat
    const teacher = TEACHERS[q.teacher];
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = st === 'done' ? '#5b7a4a' : '#2b1d14';
    ctx.fillText(q.title, P.x + 74, y + 20);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = L.color;
    ctx.textAlign = 'right';
    ctx.fillText(L.label.toUpperCase(), P.x + P.w - 32, y + 20);
    const others = mpQuestDoneBy(q.id);   // online hráči, kteří to už mají (29_multiplayer.js)
    if (others.length) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#43a047';
      ctx.fillText(`👥 ✔ ${others.join(', ')}`, P.x + P.w - 32, y + 42, 230);
    }
    ctx.textAlign = 'left';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#6b5a48';
    ctx.fillText('Zadává: ' + teacher.name, P.x + 74, y + 42);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = st === 'done' ? '#5b7a4a' : '#3b2a1c';
    ctx.fillText(st === 'done' ? 'Hotovo – díky!' : questHint(q), P.x + 74, y + 62);
  });
  // šipky, když je úkolů víc, než se vejde
  ctx.fillStyle = '#8a5a2e';
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  if (first > 0) ctx.fillText('▲ další úkoly', P.x + P.w / 2, P.y + 62);
  if (first + CATALOG_VISIBLE < quests.length) ctx.fillText('▼ další úkoly', P.x + P.w / 2, P.y + P.h - 34);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#6b5a48';
  ctx.fillText(isTouchHint() ? 'Ťukni mimo seznam = zavřít' : 'Q / Esc / mezerník = zavřít  ·  ↑ ↓ = posun', P.x + P.w / 2, P.y + P.h - 14);
}

// =====================================================================
// MAPA ŠKOLY – chodby v přízemí, v 1. patře budovy A a v Céčku; je na ní vidět,
// kde je právě Kuba Vozábal (chodí dál i s otevřenou mapou) a kde jsi ty.
// Klávesa K nebo tlačítko vedle úkolů; zavře se mezerníkem, K, Esc nebo ťuknutím.
// =====================================================================
const MAP_PANEL = { x: 16, y: 52, w: 768, h: 532 };
// Plánky: místnost → kde a jak velká je na mapě (ox, oy = levý horní roh plánku na plátně,
// s = měřítko, from = výřez z místnosti v px)
const MAP_SHEETS = [
  { title: 'Přízemí – budova A', rooms: [{ id: 'chodba', ox: 40, oy: 112, s: 0.172, from: { x: 0, y: 0 } }] },
  { title: '1. patro – budova A', rooms: [{ id: 'patroA', ox: 424, oy: 110, s: 0.188, from: { x: 280, y: 1160 } }] },
  { title: '2. patro – budova A', rooms: [{ id: 'patroA2', ox: 424, oy: 270, s: 0.188, from: { x: 280, y: 1160 } }] },
  { title: 'Céčko – přízemí, 2. a 3. patro', rooms: [
    { id: 'cecko',  ox: 424, oy: 428, s: 0.12, from: { x: 0, y: 0 }, label: 'Vchod a 1. patro' },
    { id: 'cecko2', ox: 534, oy: 428, s: 0.12, from: { x: 0, y: 0 }, label: '2. patro' },
    { id: 'cecko3', ox: 600, oy: 428, s: 0.12, from: { x: 0, y: 0 }, label: '3. patro' },
  ] },
];
const MAP_SHEET_TITLE_Y = { 0: 100, 1: 100, 2: 260, 3: 418 };

function toggleMap() {
  if (state.map) { state.map = null; return; }
  if (state.dialog || state.transition || (state.room && state.room.front)) return;
  state.catalog = state.inventory = null;
  state.map = {};
  playSound([[523, 0, 0.04], [784, 0.05, 0.05]]);
}
function takeMapTaps() {
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, CONFIG.MAP_BUTTON, 4);
    if (hit) toggleMap();
    return !hit;
  });
}

// Bod v místnosti (px od jejího rohu) → bod na mapě, nebo null (místnost není na mapě)
function mapPoint(roomId, x, y) {
  for (const sheet of MAP_SHEETS) {
    for (const m of sheet.rooms) if (m.id === roomId) return { x: m.ox + (x - m.from.x) * m.s, y: m.oy + (y - m.from.y) * m.s };
  }
  return null;
}
// Kde je postava (název části chodby nebo místnosti)
function mapAreaName(roomId, x, y) {
  const room = ROOMS[roomId];
  if (!room.parts) return room.name;
  let name = room.name;
  for (const part of room.parts) {
    if (x >= part.offset.x && x <= part.offset.x + part.w && y >= part.offset.y && y <= part.offset.y + part.h) name = part.name;
  }
  return name;
}

function drawMapButton() {
  const b = CONFIG.MAP_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = state.map ? 'rgba(255, 213, 74, 0.9)' : 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  // ikonka: složená mapa s červenou tečkou
  const x = b.x + 7, y = b.y + 7, c = state.map ? '#2b1d14' : '#ffffff';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x, y + 2); ctx.lineTo(x + 7, y); ctx.lineTo(x + 13, y + 2); ctx.lineTo(x + 20, y);
  ctx.lineTo(x + 20, y + 15); ctx.lineTo(x + 13, y + 17); ctx.lineTo(x + 7, y + 15); ctx.lineTo(x, y + 17);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = state.map ? '#ffd54a' : '#9aa0a6';
  ctx.fillRect(x + 7, y, 1, 15); ctx.fillRect(x + 13, y + 2, 1, 15);
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(x + 10, y + 8, 3, 0, Math.PI * 2); ctx.fill();
}

// Plánek místnosti: jen podlaha, kudy se dá chodit (bez zdí a plných bloků; nábytek se
// nepočítá). Spočítá se jednou po čtverečcích 10 px a uloží jako obrázek; popisky
// chodeb jsou uprostřed jejich podlahy.
const MAP_CELL = 10;
const mapCache = {};
function mapRaster(id) {
  if (mapCache[id]) return mapCache[id];
  const room = ROOMS[id];
  const solids = roomWalls(room).concat(room.obstacles.filter((o) => o.kind === 'void').map((o) => o.rect));
  const cols = Math.ceil(room.w / MAP_CELL), rows = Math.ceil(room.h / MAP_CELL);
  const c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  const g = c.getContext('2d');
  const sums = {};   // popisky: součet poloh čtverečků podle názvu části
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * MAP_CELL, y = (j + 0.5) * MAP_CELL;
    const pt = { x: room.x + x - 1, y: room.y + y - 1, w: 2, h: 2 };
    if (solids.some((r) => rectsOverlap(pt, r))) continue;
    let part = null;
    for (const p of room.parts || []) if (x >= p.offset.x && x < p.offset.x + p.w && y >= p.offset.y && y < p.offset.y + p.h) part = p;
    if (room.parts && !part) continue;   // mezi díly spojené chodby nic není
    const stairs = part && /^schody/.test(part.id);
    g.fillStyle = stairs ? '#d7ccc8' : '#cfd8dc';
    g.fillRect(i, j, 1, 1);
    if (part && !stairs) {
      const n = part.name.replace(' v patře', '').replace('Chodba za hlavním vchodem', 'Hlavní chodba');
      const sm = sums[n] || (sums[n] = { x: 0, y: 0, n: 0 });
      sm.x += x; sm.y += y; sm.n++;
    }
  }
  const labels = Object.entries(sums).filter(([, v]) => v.n > 60).map(([name, v]) => ({ name, x: v.x / v.n, y: v.y / v.n }));
  return (mapCache[id] = { canvas: c, labels });
}

function drawMapRoom(m) {
  const room = ROOMS[m.id], ras = mapRaster(m.id);
  const x0 = m.ox - m.from.x * m.s, y0 = m.oy - m.from.y * m.s;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // obrys (o pixel větší a tmavý) a pak podlaha
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    ctx.globalAlpha = 0.55;
    ctx.filter = 'brightness(0.35)';
    ctx.drawImage(ras.canvas, x0 + dx, y0 + dy, room.w * m.s, room.h * m.s);
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(ras.canvas, x0, y0, room.w * m.s, room.h * m.s);
  ctx.restore();
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = '#3b2a1c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of ras.labels) ctx.fillText(l.name, x0 + l.x * m.s, y0 + l.y * m.s);
}

function drawMapDot(p, color, label, pulse) {
  const rad = 5 + (pulse ? Math.sin(state.time * 6) * 1.5 : 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath(); ctx.arc(p.x + 1, p.y + 1, rad + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  drawOutlinedText(label, p.x, p.y - 13, 'bold 12px sans-serif', '#ffffff', 'middle');
}

function drawMap() {
  if (!state.map) return;
  const P = MAP_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8';
  ctx.fill();
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#3b2a1c';
  ctx.fillText('Mapa školy', P.x + 22, P.y + 26);
  MAP_SHEETS.forEach((sheet, i) => {
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#8a5a2e';
    ctx.textAlign = 'left';
    ctx.fillText(sheet.title, sheet.rooms[0].ox, MAP_SHEET_TITLE_Y[i]);
    for (const m of sheet.rooms) {
      drawMapRoom(m);
      if (m.label) {
        ctx.font = '10px sans-serif'; ctx.fillStyle = '#6b5a48'; ctx.textAlign = 'left';
        ctx.fillText(m.label, m.ox, m.oy + ROOMS[m.id].h * m.s + 10);
      }
    }
  });
  // Kuba a hráč
  const kuba = TEACHERS.vozabal;
  const kp = kuba && kuba.rect ? mapPoint(kuba.room, kuba.pos.x, kuba.pos.y) : null;
  const room = state.room, pl = state.player;
  const pp = mapPoint(room.id, pl.x + pl.w / 2 - room.x, pl.y + pl.h / 2 - room.y);
  if (pp) drawMapDot(pp, '#2e63c9', 'Ty', false);
  if (kp) drawMapDot(kp, '#e53935', 'Kuba', true);
  // kde kdo je
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#c62828';
  if (kuba) ctx.fillText('● Kuba Vozábal: ' + mapAreaName(kuba.room, kuba.pos.x, kuba.pos.y), P.x + 410, P.y + 470);
  ctx.fillStyle = '#1d4fa8';
  ctx.fillText('● Ty: ' + (pp ? mapAreaName(room.id, pl.x + pl.w / 2 - room.x, pl.y + pl.h / 2 - room.y) : room.name), P.x + 410, P.y + 490);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#6b5a48';
  ctx.fillText(isTouchHint() ? 'Ťukni kamkoli = zavřít' : 'K / Esc / mezerník = zavřít', P.x + 410, P.y + 514);
}

// =====================================================================
// SEZNAM HUDBY NA POZADÍ – P nebo tlačítko s hudbou nahoře: písničky vybraného alba;
// Z (nebo tlačítko „Album“ v seznamu): výběr alba Mix / Red Hot Chili Peppers.
// Ťuknutí / mezerník pustí, co je vybrané (ve hře i na úvodu, vzhled jako katalog úkolů).
// =====================================================================
const MUSIC_PANEL = { x: 150, y: 60, w: 500, h: 490 };
const ALBUM_BUTTON = { x: MUSIC_PANEL.x + MUSIC_PANEL.w - 170, y: MUSIC_PANEL.y + 16, w: 150, h: 32 };
const musicMenuList = () => (state.musicMenu.albums ? Object.keys(CONFIG.MUSIC_ALBUMS) : musicPlaylist());
function musicRows() {
  const n = musicMenuList().length, h = Math.min(56, Math.floor(380 / Math.max(1, n)));
  return musicMenuList().map((_, i) => ({ x: MUSIC_PANEL.x + 16, y: MUSIC_PANEL.y + 66 + i * h, w: MUSIC_PANEL.w - 32, h: h - 6 }));
}
// albums = true: rovnou výběr alba (klávesa Z)
function toggleMusicMenu(albums = false) {
  if (state.musicMenu && !!state.musicMenu.albums === albums) { state.musicMenu = null; return; }
  if (state.screen === 'playing' && (state.dialog || state.transition || state.songMenu)) return;
  state.catalog = state.map = state.inventory = null;
  state.musicMenu = { albums, sel: albums ? Object.keys(CONFIG.MUSIC_ALBUMS).indexOf(audio.album) : audio.mainIndex };
  playSound([[660, 0, 0.04], [880, 0.05, 0.05]]);
}
function musicMenuMove(d) {
  const n = musicMenuList().length;
  state.musicMenu.sel = (state.musicMenu.sel + d + n) % n;
}
// Mezerník / Enter pustí vybrané, ťuknutí na řádek pustí to, „Album“ přepne na výběr alba,
// ťuknutí mimo seznam zavře
function musicMenuEvents(events) {
  const m = state.musicMenu;
  for (const ev of events) {
    let i = null;
    if (ev.type === 'action') i = m.sel;
    else if (ev.x != null) {
      if (!m.albums && pointInRect(ev.x, ev.y, ALBUM_BUTTON, 2)) { toggleMusicMenu(true); return; }
      i = musicRows().findIndex((r) => pointInRect(ev.x, ev.y, r, 0));
      if (i < 0) {
        if (!pointInRect(ev.x, ev.y, MUSIC_PANEL, 0)) { state.musicMenu = null; return; }
        continue;
      }
    }
    if (i === null) continue;
    if (m.albums) {   // vybrané album → jeho první písnička, pak seznam jeho písniček
      const id = Object.keys(CONFIG.MUSIC_ALBUMS)[i];
      setAlbum(id);
      state.musicMenu = { albums: false, sel: 0 };
      return;
    }
    state.musicMenu = null;
    audio.mainFails = 0;
    playMainTrack(i);
    if (audio.track !== 'main') setMusicTrack('main');   // písnička od Mykyho / Treplev skončí
    return;
  }
}
function drawMusicMenu() {
  const m = state.musicMenu;
  if (!m) return;
  const P = MUSIC_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8';
  ctx.fill();
  ctx.strokeStyle = '#8a5a2e';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#3b2a1c';
  ctx.fillText(m.albums ? '💿 Vyber album' : `🎵 ${CONFIG.MUSIC_ALBUMS[audio.album].name}`, P.x + 24, P.y + 32, 290);
  if (!m.albums) {   // přepínač alba
    const b = ALBUM_BUTTON;
    roundRectPath(b.x, b.y, b.w, b.h, 8); ctx.fillStyle = '#8a5a2e'; ctx.fill();
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText('💿 Album (Z) ⇄', b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.fillStyle = 'rgba(59, 42, 28, 0.25)';
  ctx.fillRect(P.x + 20, P.y + 56, P.w - 40, 2);
  const playingNow = m.albums ? Object.keys(CONFIG.MUSIC_ALBUMS).indexOf(audio.album) : audio.track === 'main' ? audio.mainIndex : -1;
  const list = musicMenuList(), mykyFrom = m.albums ? Infinity : CONFIG.MUSIC_ALBUMS[audio.album].songs.length;
  musicRows().forEach((r, i) => {
    const now = i === playingNow;
    const label = m.albums ? `${CONFIG.MUSIC_ALBUMS[list[i]].name}  ·  ${CONFIG.MUSIC_ALBUMS[list[i]].songs.length + (list[i] === 'mix' && state.story && state.story.headphones ? TEACHERS.myky.songs.length : 0)} písniček` : list[i].name;
    roundRectPath(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = i === m.sel && !isTouchHint() ? '#ffe9a8' : now ? '#e6efdc' : '#fffaf0';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const rad = Math.min(14, r.h / 2 - 3);
    ctx.fillStyle = now ? '#43a047' : i >= mykyFrom ? '#8e24aa' : '#9e9e9e';   // fialově písničky od Mykyho
    ctx.beginPath(); ctx.arc(r.x + 24, r.y + r.h / 2, rad, 0, Math.PI * 2); ctx.fill();
    ctx.font = `bold ${r.h < 34 ? 12 : 15}px sans-serif`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText(now ? '▶' : String(i + 1), r.x + 24, r.y + r.h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.font = `bold ${r.h < 34 ? 14 : 17}px sans-serif`;
    ctx.fillStyle = now ? '#2f6b2f' : '#2b1d14';
    ctx.fillText(label + (i >= mykyFrom ? '  🎧' : ''), r.x + 50, r.y + r.h / 2 + 1, r.w - 120);
    if (now) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#43a047';
      ctx.fillText(audio.muted ? 'ZTLUMENO' : m.albums ? 'VYBRANÉ' : 'HRAJE', r.x + r.w - 14, r.y + r.h / 2 + 1);
    }
  });
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#6b5a48';
  const tip = m.albums ? (isTouchHint() ? 'Ťukni na album' : '↑ ↓ + mezerník = vybrat album  ·  Z / Esc = zavřít')
    : (isTouchHint() ? 'Ťukni na písničku · mimo seznam = zavřít' : '↑ ↓ + mezerník = pustit  ·  Z = album  ·  P / Esc = zavřít');
  ctx.fillText(tip, P.x + P.w / 2, P.y + P.h - 16);
}

// =====================================================================
// VÝBĚR PÍSNIČKY – po rozhovoru s Mykym (songs u postavy); hraje místo hudby na pozadí
// =====================================================================
const SONG_PANEL = { x: 170, y: 150, w: 460, h: 300 };
const songRows = () => [...state.songMenu.songs, null].map((_, i) => ({ x: 200, y: 214 + i * 52, w: 400, h: 44 }));
function songMenuMove(d) {
  const n = state.songMenu.songs.length + 1;
  state.songMenu.sel = (state.songMenu.sel + d + n) % n;
}
// Index řádku pod ťuknutím (poslední = „Teď ne“), null = mimo řádky
function songMenuHit(ev) {
  if (ev.x == null) return null;
  const i = songRows().findIndex((r) => pointInRect(ev.x, ev.y, r, 0));
  if (i >= 0) return i;
  return pointInRect(ev.x, ev.y, SONG_PANEL, 0) ? null : state.songMenu.songs.length;   // ťuk mimo = zavřít
}
function drawSongMenu() {
  const m = state.songMenu;
  if (!m) return;
  drawChessBox(SONG_PANEL.x, SONG_PANEL.y, SONG_PANEL.w, SONG_PANEL.h);
  drawOutlinedText('🎧 Vyber písničku', 400, SONG_PANEL.y + 34, 'bold 22px sans-serif', '#ffd54a', 'middle');
  songRows().forEach((r, i) => {
    const song = m.songs[i];
    drawChessButton(r, song ? '♪ ' + song.name : 'Teď ne', i === m.sel, song ? '#3d5f3a' : '#5a4636');
  });
}

