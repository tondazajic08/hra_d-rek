// Režim Among Us: založení hry, seznam her a čekárna v Hlavní chodbě
// Část hry Dárek – načítá se v index.html po 35_online_hry.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// AMONG US – samostatný online režim (state.mode === 'among'). Zatím 1. krok:
// - Na úvodu tlačítko „👾 Among Us“ → seznam založených her, „Založit hru“, Zpět.
// - Hra = skupina online hráčů se stejným polem g v záznamu hraci/<id>
//   (g = id hry, gj = kdy se připojil). Žádná zvláštní cesta v databázi:
//   seznam her se skládá z živých záznamů ostatních, a když všichni odejdou
//   (nebo zavřou hru), hra ze seznamu sama zmizí.
// - Hostitel = kdo je ve hře nejdéle (nejmenší gj) – když odejde, je jím další.
// - Čekárna je Hlavní chodba za vchodem (díl 'hlavni' spojené chodby):
//   nejde z ní odejít, nejsou tu učitelé, nejdou úkoly ani minihry.
//   Hráči ve hře vidí jen sebe navzájem (mpHere podle g), ne hráče ze školy.
// - Postup hlavní hry se v tomhle režimu neukládá ani nemaže.
// Další kroky: start hry hostitelem, tajné role, zabíjení, hlášení a hlasování, úkoly.
// =====================================================================
const AMONG = {
  MAX: 10,                 // hráčů v jedné hře
  LOBBY_PART: 'hlavni',    // díl spojené chodby s čekárnou
  WALL: 20,                // zeď dílu – hráč zůstane uvnitř
  PANEL: { x: 190, y: 104, w: 420, h: 460 },
  ROWS: 5,                 // kolik her se vejde do seznamu
  HUD: { x: 600, y: 112, w: 190 },
};
const among = {
  game: '',      // id hry, ve které jsem
  joined: 0,     // kdy jsem se připojil (čas serveru) – určuje hostitele
  note: '', noteT: 0,
};
state.amongPick = null;   // otevřený seznam her na úvodu { sel }
const amongOn = () => state.mode === 'among';
const amongGameId = () => (amongOn() ? among.game : '');
function amongNote(text) { among.note = text; among.noteT = performance.now(); }

// Čas serveru i na úvodu (vlastní záznam se tam neposílá, takže mp.offset může chybět):
// pak stačí nejnovější záznam ostatních – každý živý hráč se ozve aspoň po 3 s
function amongNow() {
  if (mp.offset !== null) return mpServerNow();
  let t = 0;
  for (const o of Object.values(mp.others)) t = Math.max(t, o.t || 0);
  return t || Date.now();
}
const amongAlive = (o) => amongNow() - o.t < MP.STALE;

// Založené hry: id → { id, players: [{ id, n, gj, me }] } (hostitel první)
function amongGames() {
  const games = {};
  for (const o of Object.values(mp.others)) {
    if (!o.g || !amongAlive(o)) continue;
    (games[o.g] = games[o.g] || { id: o.g, players: [] }).players.push({ id: o.id, n: o.n, gj: o.gj || 0 });
  }
  if (amongOn() && among.game) (games[among.game] = games[among.game] || { id: among.game, players: [] }).players.push({ id: mp.id, n: mp.name, gj: among.joined, me: true });
  for (const g of Object.values(games)) g.players.sort((a, b) => a.gj - b.gj || (a.id < b.id ? -1 : 1));
  return Object.values(games).sort((a, b) => a.players[0].gj - b.players[0].gj);
}
const amongMyGame = () => amongGames().find((g) => g.id === among.game) || null;

// --- Seznam her na úvodu ---
const amongRows = (n) => Array.from({ length: n }, (_, i) => ({ x: 220, y: 200 + i * 50, w: 360, h: 44 }));
const AMONG_CREATE = { x: 220, y: 456, w: 360, h: 44 };
const AMONG_BACK = { x: 220, y: 508, w: 360, h: 44 };
function amongOpenPick() {
  if (!mp.on) { setOnline(true); if (!mp.on) return; }   // poprvé se zeptá na jméno
  state.amongPick = { sel: 0 };
  playSound([[392, 0, 0.06], [523, 0.07, 0.08]]);
}
// Položky: hry (max AMONG.ROWS), Založit hru, Zpět
function amongPickItems() {
  const games = amongGames().slice(0, AMONG.ROWS);
  return [...games.map((g) => ({ kind: 'game', g })), { kind: 'create' }, { kind: 'back' }];
}
function amongPickRect(items, i) {
  const it = items[i];
  return it.kind === 'game' ? amongRows(i + 1)[i] : it.kind === 'create' ? AMONG_CREATE : AMONG_BACK;
}
function amongPickEvents(events) {
  const P = state.amongPick, items = amongPickItems();
  P.sel = Math.min(P.sel, items.length - 1);
  for (const ev of events) {
    let i = -1;
    if (ev.type === 'action') i = P.sel;
    else if (ev.x != null) {
      i = items.findIndex((_, k) => pointInRect(ev.x, ev.y, amongPickRect(items, k), 0));
      if (i < 0 && !pointInRect(ev.x, ev.y, AMONG.PANEL, 0)) { state.amongPick = null; return; }   // ťuknutí mimo = zpět
    }
    if (i < 0) continue;
    const it = items[i];
    if (it.kind === 'back') { state.amongPick = null; return; }
    if (it.kind === 'create') { amongJoin(mp.id.slice(0, 6) + Date.now().toString(36)); return; }
    if (it.g.players.length >= AMONG.MAX) { amongNote('Hra je plná'); continue; }
    amongJoin(it.g.id);
    return;
  }
}
window.addEventListener('keydown', (e) => {
  const P = state.amongPick;
  if (!P || state.screen !== 'title') return;
  const n = amongPickItems().length;
  if (e.code === 'Escape') state.amongPick = null;
  else if (KEYMAP.up.includes(e.code)) P.sel = (P.sel + n - 1) % n;
  else if (KEYMAP.down.includes(e.code)) P.sel = (P.sel + 1) % n;
  else return;
  e.stopImmediatePropagation();
}, true);

function drawAmongPick() {
  const P = state.amongPick;
  if (!P || state.screen !== 'title') return;
  const A = AMONG.PANEL, items = amongPickItems();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(A.x, A.y, A.w, A.h, 16);
  ctx.fillStyle = '#1d2333'; ctx.fill();
  ctx.strokeStyle = '#c51111'; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText('👾 Among Us', 400, A.y + 34, 'bold 28px sans-serif', '#ff5a4a', 'middle');
  const games = items.filter((it) => it.kind === 'game');
  const sub = mp.status !== 'ok' ? 'Připojuji se…' : games.length ? 'Připoj se ke hře, nebo založ novou' : 'Zatím žádná hra – založ ji a kamarádi se připojí';
  drawOutlinedText(sub, 400, A.y + 68, 'bold 14px sans-serif', '#c9d3e8', 'middle');
  items.forEach((it, i) => {
    const r = amongPickRect(items, i), sel = i === P.sel;
    if (it.kind === 'game') {
      const names = it.g.players.map((p) => p.n), full = names.length >= AMONG.MAX;
      const label = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}  ·  ${names.length}/${AMONG.MAX}${full ? ' (plná)' : ''}`;
      drawChessButton(r, label, sel && !full, full ? '#4a4a4a' : '#2f5a7a');
    } else if (it.kind === 'create') drawChessButton(r, '➕ Založit hru', sel, '#2e7d32');
    else drawChessButton(r, 'Zpět', sel, '#5a4636');
  });
  if (among.note && performance.now() - among.noteT < 6000) drawOutlinedText(among.note, 400, A.y + A.h + 18, 'bold 15px sans-serif', '#ff8a80', 'middle');
}

// --- Připojení a odchod ---
function amongJoin(gameId) {
  if (!mp.on) { setOnline(true); if (!mp.on) return; }
  state.amongPick = null;
  among.game = gameId;
  among.joined = Math.round(amongNow());
  state.mode = 'among';
  state.speedrun = null;
  state.modePick = null;
  resetGame(null);   // jen ve hře (paměť) – uložený postup hlavní hry zůstane, saveProgress tu nic nedělá
  amongEnterLobby();
  setScreen('playing');
  mp.last = '';      // hned dát vědět ostatním (pole g)
  playSound([[523, 0, 0.06], [659, 0.07, 0.06], [784, 0.14, 0.1]]);
}
// Čekárna: Hlavní chodba, každý na trochu jiném místě, ať nestojí na sobě
function amongLobbyRect() {
  const f = ROOMS.chodba.parts.find((pt) => pt.id === AMONG.LOBBY_PART).frame, W = AMONG.WALL;
  return { x: f.x + W, y: f.y + W, w: f.w - 2 * W, h: f.h - 2 * W };
}
function amongEnterLobby() {
  const L = amongLobbyRect(), p = state.player;
  enterRoom('chodba', {
    x: L.x + L.w / 2 - p.w / 2 + (Math.random() - 0.5) * 160,
    y: L.y + L.h / 2 - p.h / 2 + (Math.random() - 0.5) * 60,
  });
}
// Na úvod (☰ → Hlavní menu, nebo když databáze režim nedovolí)
{
  const _goToTitle = goToTitle;
  goToTitle = function () {
    among.game = '';
    _goToTitle();
  };
}
// Databáze bez nových pravidel odmítne pole g (29_multiplayer.js) → zpět na úvod se zprávou
function amongBlocked() {
  if (!amongOn()) return;
  goToTitle();
  state.amongPick = { sel: 0 };
  amongNote('Among Us zatím nejde – databáze nemá nová pravidla');
}

// --- V režimu: žádní učitelé, žádné úkoly, žádné ukládání ---
{
  const _enterRoom = enterRoom;
  enterRoom = function (roomId, spawn) {
    _enterRoom(roomId, spawn);
    if (!amongOn()) return;
    state.teachers = [];
    state.solids = roomWalls(state.room).concat(state.room.obstacles.map((o) => o.rect));   // bez učitelů
  };
  const _saveProgress = saveProgress;
  saveProgress = function () { if (!amongOn()) _saveProgress(); };   // hlavní hra se nepřepíše
  const _drawTalkHint = drawTalkHint;
  drawTalkHint = function () { if (!amongOn()) _drawTalkHint(); };   // žádné „mezerník – mluvit“
  const _drawGossip = drawGossipBubble;
  drawGossipBubble = function () { if (!amongOn()) _drawGossip(); };
  const _drawMichele = drawMicheleChat;
  drawMicheleChat = function () { if (!amongOn()) _drawMichele(); };
  const _drawHud = drawHud;
  drawHud = function () { if (amongOn()) drawAmongHud(); else _drawHud(); };
  // úvod: tlačítko Among Us pod ostatními (jen s databází pro online)
  const _getButtons = getButtons;
  getButtons = function () {
    const b = _getButtons();
    if (state.screen !== 'title' || !mpReady()) return b;
    const bottom = b.reduce((m, x) => Math.max(m, x.rect.y + x.rect.h), 0);
    b.push({ id: 'among', label: '👾 Among Us (online)', primary: false, rect: { x: CONFIG.WIDTH / 2 - 170, y: bottom + 12, w: 340, h: 44 } });
    return b;
  };
  const _pressButton = pressButton;
  pressButton = function (id) { if (id === 'among') amongOpenPick(); else _pressButton(id); };
  const _updateMenu = updateMenu;
  updateMenu = function () {
    if (state.amongPick && state.screen === 'title') { amongPickEvents(input.events.splice(0)); return; }
    _updateMenu();
  };
}

// Krok hry v režimu (místo updatePlaying): jen chůze po čekárně a menu ☰
function updateAmong(dt) {
  updateTimers(dt);
  state.catalog = null; state.map = null; state.inventory = null; state.musicMenu = null; state.dialog = null;
  const events = input.events.splice(0);
  if (state.pauseMenu) { pauseMenuEvents(events); return; }
  const p = state.player, dir = getMoveVector(), ox = p.x, oy = p.y;
  moveWithCollisions(p, dir.x * p.speed * dt, dir.y * p.speed * dt, state.solids);
  const L = amongLobbyRect();   // z čekárny se neodchází
  p.x = Math.max(L.x, Math.min(L.x + L.w - p.w, p.x));
  p.y = Math.max(L.y, Math.min(L.y + L.h - p.h, p.y));
  updateWalkAnimation(p, Math.hypot(p.x - ox, p.y - oy) > 0.05, dt);
}

// --- Horní lišta a seznam hráčů v čekárně ---
function drawAmongHud() {
  const g = amongMyGame(), players = g ? g.players : [];
  ctx.textBaseline = 'middle';
  ctx.font = CONFIG.COUNTER_FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#ff5a4a';
  ctx.fillText('👾 Among Us · čekárna', 12, CONFIG.TITLE_Y);
  ctx.font = CONFIG.TASK_FONT; ctx.textAlign = 'center'; ctx.fillStyle = CONFIG.TASK_COLOR;
  const host = players[0];
  ctx.fillText(host && host.me ? 'Jsi hostitel – start hry přijde v dalším kroku' : `Čeká se na start hry (hostitel: ${host ? host.n : '?'})`, CONFIG.WIDTH / 2, CONFIG.TASK_Y, CONFIG.MUSIC_BUTTON.x - 40);
  // hráči vpravo pod počtem online
  const H = AMONG.HUD, rowH = 20, h = 30 + players.length * rowH;
  roundRectPath(H.x, H.y, H.w, h, 8);
  ctx.fillStyle = 'rgba(15, 20, 35, 0.75)'; ctx.fill();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`Hráči ${players.length}/${AMONG.MAX}`, H.x + 10, H.y + 15);
  players.forEach((pl, i) => {
    ctx.fillStyle = pl.me ? '#ffd54a' : '#e0e6f2';
    ctx.fillText(`${i === 0 ? '👑 ' : '• '}${pl.n}${pl.me ? ' (ty)' : ''}`, H.x + 10, H.y + 34 + i * rowH, H.w - 20);
  });
}
