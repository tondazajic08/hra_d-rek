// Režim Among Us: seznam her, čekárna, mapy A a C, role, zabíjení, porady a hlasování
// Část hry Dárek – načítá se v index.html po 35_online_hry.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// AMONG US – samostatný online režim (state.mode === 'among').
// 1. Seznam her a čekárna: na úvodu „👾 Among Us“ → seznam založených her, „Založit hru“.
//    Hra = skupina online hráčů se stejným polem g v záznamu hraci/<id> (gj = kdy se připojil,
//    gp = hraje kolo). Seznam her se skládá z živých záznamů – když všichni odejdou, hra zmizí.
//    Hostitel = kdo je ve hře nejdéle (nejmenší gj). Čekárna = Hlavní chodba za vchodem,
//    bez učitelů, úkolů a miniher; hráči ve hře vidí jen sebe navzájem (mpHere podle g).
//    Postup hlavní hry se v tomhle režimu neukládá ani nemaže.
// 2. Kolo: hostitel spustí hru (aspoň AMONG.MIN hráčů), záškodníci se losují (do 6 hráčů 1,
//    od 7 hráčů 2). Role Záškodník / Nevinný se ukáže přes celou obrazovku.
// 3. Mapy, nastavení, zabíjení, porady:
//    - Mapa A = budova A: přízemí bez části s fotbálkem (Hlavní chodba, křídla, schodiště)
//      a chodby 1. a 2. patra. Mapa C = od fotbálku dál: chodba před schody, Spojovačka,
//      hala s pingpongem a chodby Céčka (přízemí, 2. a 3. patro). Do tříd se nechodí.
//    - Nastavení v čekárně (⚙, mění jen hostitel) podle skutečné hry: mapa, čekání mezi
//      zabitími (výchozí 25 s), vzdálenost zabití, porady na hráče, čekání na poradu,
//      čas na diskuzi a hlasování, rychlost, ukázat roli vyhozeného, anonymní hlasování.
//    - Záškodník zabíjí (🔪 / Q) blízkého nevinného, na zemi zůstane tělo. Mrtvý je duch:
//      chodí dál, ale živí ho nevidí ani neslyší a nehlasuje.
//    - Tělo jde nahlásit (📢 / R), u tlačítka na startu jde svolat poradu (🚨 / E).
//      Porada: úvod, diskuze, hlasování (hráč nebo přeskočit). Nejvíc hlasů = vyhozen,
//      nerozhodně / přeskočit = nikdo. Pak zpátky na start mapy.
//    - Konec: záškodníci vyřazení = vyhráli nevinní; záškodníků je stejně jako nevinných
//      = vyhráli záškodníci. Pak všichni zpět do čekárny.
// Síť: stav kola řídí hostitel – among/<hra>/s = { d: JSON stavu, t } (jen hostitel zapisuje,
//   všichni sledují proudem). Ostatní posílají, co udělali, jako zprávy among/<hra>/e/<klíč>
//   = { f: kdo, d: JSON { k: 'kill' | 'rep' | 'emer' | 'vote', r: kolo, … }, t };
//   hostitel je zkontroluje, započítá do stavu a smaže. Když hostitel odejde, pokračuje další.
//   Pozn.: role jsou v databázi čitelně – kdo by se díval do vývojářských nástrojů, uvidí je.
// 4. Úkoly (37_among_ukoly.js): každý dostane na mapě N míst (testy z předmětů, rychlá matika,
//    kabely, Bakaláři, tabule, koš). Když nevinní splní všechny úkoly, vyhráli.
//    Animace smrti: oběť vidí útok přes celou obrazovku, ostatní padající tělo a krev.
// 5. (38_among_extra.js) třídy na mapách, venty pro záškodníka, sabotáže (světla, dveře),
//    barvy hráčů a převlékání v čekárně (👕 → Locker se všemi postavami ze hry).
// =====================================================================
const AMONG = {
  MAX: 10,                 // hráčů v jedné hře
  MIN: 4,                  // aspoň tolik hráčů, aby šla hra spustit
  IMPOSTORS: (n) => (n >= 7 ? 2 : 1),   // záškodníci podle počtu hráčů
  PATH: 'among',           // databáze: among/<id hry>/s (stav) a /e (zprávy hostiteli)
  REVEAL: 4.5,             // s – obrazovka s rolí na začátku kola
  FIRST_KILL: 10,          // s – první zabití v kole nejdřív po tolika s (jako ve hře)
  MEET_INTRO: 3,           // s – úvod porady („Nalezeno tělo!“)
  EJECT_TIME: 6,           // s – obrazovka s vyhozeným
  END_TIME: 7,             // s – kdo vyhrál
  KILL_DIST: [55, 85, 120],   // px mezi středy: krátká / střední / dlouhá
  REPORT_DIST: 95,         // px k tělu
  BUTTON_DIST: 80,         // px k tlačítku porady
  START_BTN: { x: 290, y: 524, w: 220, h: 48 },   // hostitel v čekárně
  SET_BTN: { x: 520, y: 524, w: 150, h: 48 },     // ⚙ Nastavení (hostitel), ostatní uprostřed
  ACT: {   // akční tlačítka vpravo dole (vlevo je na mobilu joystick)
    kill: { x: 690, y: 470, w: 96, h: 96 },
    report: { x: 584, y: 470, w: 96, h: 96 },
    emer: { x: 478, y: 470, w: 96, h: 96 },   // POUŽÍT: úkol / vent / vypínač / porada
    sab: { x: 372, y: 470, w: 96, h: 96 },    // záškodník: sabotáž (38_among_extra.js)
  },
  KEYS: { kill: 'KeyQ', report: 'KeyR', emer: 'KeyE', sab: 'KeyF' },
  LOBBY_PART: 'hlavni',    // díl spojené chodby s čekárnou
  WALL: 20,                // zeď dílu – hráč zůstane uvnitř
  PANEL: { x: 190, y: 104, w: 420, h: 460 },
  ROWS: 5,                 // kolik her se vejde do seznamu
  HUD: { x: 600, y: 112, w: 190 },
};
// Mapy: místnosti, kam se smí (u spojené chodby jen vyjmenované díly) a tlačítko porady (kolem něj start)
const AMONG_MAPS = {
  A: {
    name: 'A – budova A', rooms: { chodba: ['zapad', 'vychod', 'hlavniTop', 'hlavni', 'schodyA', 'vstup'], patroA: null, patroA2: null },
    button: { room: 'chodba', part: 'hlavni', x: 380, y: 190 },   // start = kruh hráčů kolem tlačítka porady
  },
  C: {
    name: 'C – Céčko', rooms: { chodba: ['predSchody', 'prosklena', 'hala'], cecko: null, cecko2: null, cecko3: null },
    button: { room: 'chodba', part: 'predSchody', x: 300, y: 560 },
  },
};
// Nastavení v čekárně (výchozí podle skutečné hry, čekání mezi zabitími 25 s podle uživatele)
const AMONG_SETTINGS = [
  { id: 'map', label: 'Mapa', values: ['A', 'C'], show: (v) => AMONG_MAPS[v].name },
  { id: 'kc', label: 'Čekání mezi zabitími', values: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], show: (v) => `${v} s` },
  { id: 'kd', label: 'Vzdálenost zabití', values: [0, 1, 2], show: (v) => ['Krátká', 'Střední', 'Dlouhá'][v] },
  { id: 'em', label: 'Porady na hráče', values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], show: (v) => `${v}` },
  { id: 'ec', label: 'Čekání na poradu', values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], show: (v) => `${v} s` },
  { id: 'dt', label: 'Čas na diskuzi', values: [0, 15, 30, 45, 60, 75, 90, 105, 120], show: (v) => `${v} s` },
  { id: 'vt', label: 'Čas na hlasování', values: [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300], show: (v) => `${v} s` },
  { id: 'sp', label: 'Rychlost hráčů', values: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3], show: (v) => `${v}×` },
  { id: 'ce', label: 'Ukázat roli vyhozeného', values: [1, 0], show: (v) => (v ? 'Ano' : 'Ne') },
  { id: 'an', label: 'Anonymní hlasování', values: [0, 1], show: (v) => (v ? 'Ano' : 'Ne') },
];
const AMONG_DEFAULTS = { map: 'A', kc: 25, kd: 1, em: 1, ec: 15, dt: 15, vt: 120, sp: 1, ce: 1, an: 0 };

const among = {
  game: '',      // id hry, ve které jsem
  joined: 0,     // kdy jsem se připojil (čas serveru) – určuje hostitele
  note: '', noteT: 0,
  phase: 'lobby', // 'lobby' | 'reveal' (role) | 'play' | 'meet' (porada) | 'eject' | 'end'
  S: null,        // stav hry od hostitele (among/<hra>/s)
  round: 0,       // číslo kola, které hraju (S.k)
  role: '',       // 'zaskodnik' | 'nevinny'
  dead: false,    // jsem duch
  revealT: 0, deathT: 0,
  killCd: 0,      // s do dalšího zabití
  vote: null,     // vybraný hráč na poradě (id nebo 'skip'), voted = už odhlasováno
  voted: false,
  es: null, esE: null,   // EventSource na stav a (hostitel) na zprávy
  inbox: [],      // zprávy pro hostitele
  startedAt: 0,   // kdy hostitel naposledy spustil kolo (ms)
  myDone: [],     // úkoly, které jsem splnil (než to potvrdí hostitel)
  deathAnim: null,   // { t, killer } – animace, když mě zabijí
  slash: null,       // { x, y, t } – záblesk nože u záškodníka
};
state.amongTask = null;   // otevřený úkol (37_among_ukoly.js)
state.amongPick = null;   // otevřený seznam her na úvodu { sel }
state.amongSet = null;    // otevřené nastavení v čekárně { sel }
const amongOn = () => state.mode === 'among';
const amongGameId = () => (amongOn() ? among.game : '');
function amongNote(text) { among.note = text; among.noteT = performance.now(); }
const amongSet = () => Object.assign({}, AMONG_DEFAULTS, among.S && among.S.set);
const amongMap = () => AMONG_MAPS[amongSet().map] || AMONG_MAPS.A;
const amongInRound = () => !!among.S && among.round === among.S.k && among.phase !== 'lobby';
const amongIsDead = (id) => !!among.S && (among.S.dead || []).includes(id);
const amongIsImp = (id) => !!among.S && (among.S.im || []).includes(id);
const amongName = (id) => (id === mp.id ? mp.name : (among.S && among.S.names && among.S.names[id]) || (mp.others[id] && mp.others[id].n) || '?');

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
    if (!o.g || !amongAlive(o) || o.g.startsWith('lada')) continue;   // lada… = hry Bacha na Láďu (40_horor_online.js)
    (games[o.g] = games[o.g] || { id: o.g, players: [] }).players.push({ id: o.id, n: o.n, gj: o.gj || 0, gp: o.gp });
  }
  if (amongOn() && among.game) (games[among.game] = games[among.game] || { id: among.game, players: [] }).players.push({ id: mp.id, n: mp.name, gj: among.joined, gp: among.phase !== 'lobby', me: true });
  for (const g of Object.values(games)) {
    g.players.sort((a, b) => a.gj - b.gj || (a.id < b.id ? -1 : 1));
    g.playing = g.players.some((p) => p.gp);   // rozehrané kolo – nejde se připojit
  }
  return Object.values(games).sort((a, b) => a.players[0].gj - b.players[0].gj);
}
const amongMyGame = () => amongGames().find((g) => g.id === among.game) || null;
const amongIsHost = () => { const g = amongMyGame(); return !!g && g.players[0].me; };

// --- Seznam her na úvodu ---
const amongRows = (n) => Array.from({ length: n }, (_, i) => ({ x: 220, y: 200 + i * 50, w: 360, h: 44 }));
const AMONG_CREATE = { x: 220, y: 456, w: 360, h: 44 };
const AMONG_BACK = { x: 220, y: 508, w: 360, h: 44 };
function amongOpenPick() {
  if (!mp.on) { setOnline(true); if (!mp.on) return; }   // poprvé se zeptá na jméno
  state.amongPick = { sel: 0 };
  amongPurge();
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
    if (it.g.playing) { amongNote('Tahle hra už běží – počkej, až skončí kolo'); continue; }
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
      const names = it.g.players.map((p) => p.n), full = names.length >= AMONG.MAX, off = full || it.g.playing;
      const label = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}  ·  ${names.length}/${AMONG.MAX}${full ? ' (plná)' : it.g.playing ? ' (hraje se)' : ''}`;
      drawChessButton(r, label, sel && !off, off ? '#4a4a4a' : '#2f5a7a');
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
  Object.assign(among, { phase: 'lobby', S: null, round: 0, role: '', dead: false, inbox: [], vote: null, voted: false, myDone: [], deathAnim: null });
  state.amongTask = null;
  state.mode = 'among';
  state.speedrun = null;
  state.modePick = null;
  resetGame(null);   // jen ve hře (paměť) – uložený postup hlavní hry zůstane, saveProgress tu nic nedělá
  amongEnterLobby();
  setScreen('playing');
  amongOpenState();
  mp.last = '';      // hned dát vědět ostatním (pole g)
  playSound([[523, 0, 0.06], [659, 0.07, 0.06], [784, 0.14, 0.1]]);
}
// Čekárna: Hlavní chodba, každý na trochu jiném místě, ať nestojí na sobě
const amongPart = (roomId, partId) => (ROOMS[roomId].parts || []).find((pt) => pt.id === partId);
function amongLobbyRect() {
  const f = amongPart('chodba', AMONG.LOBBY_PART).frame, W = AMONG.WALL;
  return { x: f.x + W, y: f.y + W, w: f.w - 2 * W, h: f.h - 2 * W };
}
function amongEnterLobby() {
  const L = amongLobbyRect();
  amongPlace('chodba', L.x + L.w / 2 + (Math.random() - 0.5) * 160, L.y + L.h / 2 + (Math.random() - 0.5) * 60);
}
// Postaví hráče do místnosti co nejblíž k bodu (střed hráče), mimo nábytek
function amongPlace(roomId, cx, cy) {
  const p = state.player;
  if (state.room !== ROOMS[roomId]) enterRoom(roomId, { x: cx - p.w / 2, y: cy - p.h / 2 });
  for (let r = 0; r <= 320; r += 16) {
    for (let a = 0; a < (r ? 12 : 1); a++) {
      const x = cx + Math.cos(a / 12 * Math.PI * 2) * r - p.w / 2, y = cy + Math.sin(a / 12 * Math.PI * 2) * r - p.h / 2;
      const box = { x, y, w: p.w, h: p.h };
      if (state.solids.some((s) => rectsOverlap(box, s))) continue;
      p.x = x; p.y = y;
      return;
    }
  }
  p.x = cx - p.w / 2; p.y = cy - p.h / 2;
}
// Bod na mapě (start, tlačítko porady) ve světových souřadnicích
function amongSpot(spot) {
  const f = amongPart(spot.room, spot.part).frame;
  return { room: spot.room, x: f.x + spot.x, y: f.y + spot.y };
}
// Na start mapy, každý na svém místě kolem tlačítka (pořadí podle seznamu hráčů kola)
function amongToSpawn() {
  const sp = amongSpot(amongMap().button), ids = (among.S && among.S.p) || [mp.id];
  const i = Math.max(0, ids.indexOf(mp.id)), n = Math.max(1, ids.length);
  amongPlace(sp.room, sp.x + Math.cos(i / n * Math.PI * 2 - Math.PI / 2) * 110, sp.y + Math.sin(i / n * Math.PI * 2 - Math.PI / 2) * 80 + 20);
}
// Na úvod (☰ → Hlavní menu, nebo když databáze režim nedovolí)
{
  const _goToTitle = goToTitle;
  goToTitle = function () {
    among.game = '';
    among.phase = 'lobby';
    among.S = null;
    state.amongSet = null;
    state.amongTask = null;
    if (among.es) { among.es.close(); among.es = null; }
    if (among.esE) { among.esE.close(); among.esE = null; }
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

// --- V režimu: žádní učitelé, žádné úkoly, žádné ukládání; mrtví a těla ---
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
  // živí nevidí (ani neslyší – hlas jde podle mpHere) duchy; duch vidí všechny
  const _mpHere = mpHere;
  mpHere = function () {
    const list = _mpHere();
    return amongOn() && amongInRound() && !among.dead ? list.filter((o) => !amongIsDead(o.id)) : list;
  };
  // těla a tlačítko porady pod hráči
  const _drawRemote = drawRemotePlayers;
  drawRemotePlayers = function () {
    if (amongOn() && amongInRound()) drawAmongWorld();
    _drawRemote();
  };
  // já jako duch: průhledně
  const _drawPlayer = drawPlayer;
  drawPlayer = function (p) {
    if (!(amongOn() && among.dead)) { _drawPlayer(p); return; }
    ctx.save(); ctx.globalAlpha = 0.45; _drawPlayer(p); ctx.restore();
  };
  // úvod: Among Us je v nabídce „🎮 Módy“ (10_obrazovky.js, modesItems)
  const _pressButton = pressButton;
  pressButton = function (id) { if (id === 'among') amongOpenPick(); else _pressButton(id); };
  const _updateMenu = updateMenu;
  updateMenu = function () {
    if (state.amongPick && state.screen === 'title') { amongPickEvents(input.events.splice(0)); return; }
    _updateMenu();
  };
}

// --- Mapy: kam se smí ---
// Díl spojené chodby pod bodem (u překryvů platí pozdější díl – stejně jako název oblasti)
function amongPartAt(room, x, y) {
  let id = null;
  for (const pt of room.parts || []) if (pointInRect(x, y, pt.frame, 0)) id = pt.id;
  return id;
}
function amongAllowed(room, x, y) {
  const rule = amongMap().rooms[room.id];
  if (rule === undefined) return false;
  return rule === null || rule.includes(amongPartAt(room, x, y));
}
const amongPosOk = (p) => among.phase === 'lobby' || amongAllowed(state.room, p.x + p.w / 2, p.y + p.h / 2);
function amongDoorOk(door) {
  const rules = amongMap().rooms, here = rules[state.room.id];
  if (!(door.to in rules) || ROOMS[door.to].front || here === undefined) return false;
  return here === null || !door.part || here.includes(door.part);   // dveře musí být v povoleném dílu chodby
}

// --- Krok hry v režimu (místo updatePlaying) ---
const amongActions = [];   // stisknuté Q / R / E
window.addEventListener('keydown', (e) => {
  if (!amongOn() || state.screen !== 'playing' || e.repeat) return;
  const act = Object.keys(AMONG.KEYS).find((k) => AMONG.KEYS[k] === e.code);
  if (act) { amongActions.push(act); e.stopImmediatePropagation(); return; }
  if (state.amongSet) { amongSetKey(e.code); e.stopImmediatePropagation(); return; }
  if (among.phase === 'meet') { amongMeetKey(e.code); if (e.code !== 'Escape') e.stopImmediatePropagation(); }
}, true);

function updateAmong(dt) {
  updateTimers(dt);
  if (!mp.on) { goToTitle(); return; }   // vypnutý Online (☰) = konec hry
  state.catalog = null; state.map = null; state.inventory = null; state.musicMenu = null; state.dialog = null;
  amongHostTick();   // hostitel řídí stav hry
  const events = input.events.splice(0), acts = amongActions.splice(0);
  if (state.transition) { updateTransition(dt); return; }
  if (state.pauseMenu) { pauseMenuEvents(events); return; }
  if (state.amongSet) { amongSetEvents(events); return; }
  if (state.amongSab) { amongSabEvents(events); return; }   // výběr sabotáže (38_among_extra.js)
  if (among.killCd > 0 && among.phase === 'play') among.killCd = Math.max(0, among.killCd - dt);
  if (among.slash) { among.slash.t += dt; if (among.slash.t > 0.6) among.slash = null; }
  if (among.deathAnim) {   // zabili mě: animace, pak „ZABILI TĚ!“
    among.deathAnim.t += dt;
    if (among.deathAnim.t > 2.6) { among.deathAnim = null; among.deathT = 3; }
    return;
  }
  if (state.amongTask) { amongTaskUpdate(dt, events); return; }   // otevřený úkol (37_among_ukoly.js)
  if (among.deathT > 0) among.deathT -= dt;
  if (among.phase === 'reveal') {   // obrazovka s rolí: chvíli se stojí
    among.revealT -= dt;
    if (among.revealT <= 0 || (among.revealT < AMONG.REVEAL - 1.5 && events.length)) among.phase = among.S && among.S.st === 'meet' ? 'meet' : 'play';
    return;
  }
  if (among.phase === 'meet') { amongMeetEvents(events); return; }
  if (among.phase === 'eject' || among.phase === 'end') return;
  if (among.phase === 'lobby') {
    for (const ev of events) {
      if (ev.x != null && pointInRect(ev.x, ev.y, amongSetBtn(), 4)) { state.amongSet = { sel: 0 }; return; }
      if (ev.x != null && pointInRect(ev.x, ev.y, amongDressBtn(), 4)) { openSkins(); return; }   // převléct se (33_skiny.js)
      if (amongIsHost() && (ev.type === 'action' || (ev.x != null && pointInRect(ev.x, ev.y, AMONG.START_BTN, 4)))) amongStartRound();
    }
  } else {   // kolo: zabíjení, hlášení, porada, úkoly
    for (const ev of events) {
      if (ev.x == null) continue;
      for (const k of Object.keys(AMONG.ACT)) if (pointInRect(ev.x, ev.y, AMONG.ACT[k], 4)) acts.push(k);
    }
    if (amongVentUpdate(dt, events, acts)) return;   // ve ventu (38_among_extra.js)
    for (const a of acts) {
      if (a === 'kill') amongTryKill();
      else if (a === 'report') amongTryReport();
      else if (a === 'emer') amongUse();        // E = úkol / vent / vypínač / porada (38_among_extra.js)
      else if (a === 'sab') amongSabOpen();     // F = sabotáž
    }
  }
  amongMove(dt);
}
function amongMove(dt) {
  const p = state.player, dir = getMoveVector(), ox = p.x, oy = p.y;
  const sp = p.speed * (among.phase === 'lobby' ? 1 : amongSet().sp);
  moveWithCollisions(p, dir.x * sp * dt, dir.y * sp * dt, state.solids);
  if (among.phase === 'lobby') {   // z čekárny se neodchází
    const L = amongLobbyRect();
    p.x = Math.max(L.x, Math.min(L.x + L.w - p.w, p.x));
    p.y = Math.max(L.y, Math.min(L.y + L.h - p.h, p.y));
  } else if (!amongPosOk(p)) {   // mimo mapu: posun zpět (zkusit aspoň po jedné ose)
    const nx = p.x, ny = p.y;
    p.x = nx; p.y = oy;
    if (!amongPosOk(p)) { p.x = ox; p.y = ny; if (!amongPosOk(p)) { p.x = ox; p.y = oy; } }
  }
  updateWalkAnimation(p, Math.hypot(p.x - ox, p.y - oy) > 0.05, dt);
  const area = currentAreaName(state.room);   // název části nahoře
  if (area !== state.areaName) { state.areaName = area; state.titleTimer = CONFIG.TITLE_HIGHLIGHT_TIME; }
  if (among.phase !== 'play') return;
  const door = findTouchedDoor(p);   // schody do pater / Céčka – jen v rámci mapy
  if (door && amongDoorOk(door)) state.transition = { door, t: 0, switched: false };
}

// --- Co je kolem mě: koho zabít, které tělo, tlačítko porady ---
const amongMyPos = () => ({ x: state.player.x - state.room.x + state.player.w / 2, y: state.player.y - state.room.y + state.player.h / 2 });
function amongKillTarget() {
  if (among.role !== 'zaskodnik' || among.dead || among.phase !== 'play') return null;
  const me = amongMyPos(), s = CONFIG.PLAYER_SIZE / 2, max = AMONG.KILL_DIST[amongSet().kd] || 85;
  let best = null, bd = Infinity;
  for (const o of mpHere()) {
    if (amongIsDead(o.id) || amongIsImp(o.id) || !(among.S.p || []).includes(o.id)) continue;
    const d = Math.hypot(o.x + s - me.x, o.y + s - me.y);
    if (d <= max && d < bd) { bd = d; best = o; }
  }
  return best;
}
function amongBodyNear() {
  if (among.dead || among.phase !== 'play') return null;
  const me = amongMyPos();
  return (among.S.bodies || []).find((b) => b.r === state.room.id && Math.hypot(b.x - me.x, b.y - me.y) <= AMONG.REPORT_DIST) || null;
}
function amongEmergencyState() {
  const S = among.S, set = amongSet();
  if (among.dead || among.phase !== 'play' || !S) return { near: false };
  const b = amongSpot(amongMap().button), p = state.player;
  const near = state.room.id === b.room && Math.hypot(b.x - (p.x + p.w / 2), b.y - (p.y + p.h / 2)) <= AMONG.BUTTON_DIST;
  const left = set.em - ((S.em && S.em[mp.id]) || 0);
  const wait = Math.max(0, Math.ceil((S.lme + set.ec * 1000 - mpServerNow()) / 1000));
  return { near, left, wait, ok: near && left > 0 && wait <= 0 };
}
function amongTryKill() {
  const o = amongKillTarget();
  if (!o || among.killCd > 0) return;
  const s = CONFIG.PLAYER_SIZE / 2;
  amongSend({ k: 'kill', v: o.id, x: Math.round(o.x + s), y: Math.round(o.y + s), rm: o.r });
  among.killCd = amongSet().kc;
  among.slash = { x: state.room.x + o.x + s, y: state.room.y + o.y + s, t: 0 };
  const p = state.player;   // jako ve hře: záškodník skočí na místo oběti
  p.x = state.room.x + o.x; p.y = state.room.y + o.y;
  playSound([[140, 0, 0.12], [90, 0.1, 0.2]], 'sawtooth');
}
function amongTryReport() {
  const b = amongBodyNear();
  if (b) amongSend({ k: 'rep', b: b.id });
}
function amongTryEmergency() {
  if (amongEmergencyState().ok) amongSend({ k: 'emer' });
}

// --- Síť: stav od hostitele, zprávy hostiteli ---
const amongUrl = (sub) => `${MP.DB_URL.replace(/\/+$/, '')}/${AMONG.PATH}/${sub}.json`;
function amongStream(url, onData) {
  if (typeof EventSource === 'undefined') return null;
  const es = new EventSource(url);
  const take = (patch) => (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (msg && typeof msg.path === 'string') onData(msg.path, msg.data, patch);
  };
  es.addEventListener('put', take(false));
  es.addEventListener('patch', take(true));
  return es;
}
function amongOpenState() {
  if (among.es) return;
  let raw = {};
  among.es = amongStream(amongUrl(`${among.game}/s`), (path, data, patch) => {
    if (path === '/') raw = patch ? Object.assign(raw, data) : (data || {});
    else raw[path.split('/').filter(Boolean)[0]] = data;
    if (typeof raw.d !== 'string') return;
    try { amongApplyS(JSON.parse(raw.d)); } catch (err) { /* poškozený stav */ }
  });
}
function amongSend(d) {
  fetch(amongUrl(`${among.game}/e`), { method: 'POST', body: JSON.stringify({ f: mp.id, d: JSON.stringify({ ...d, r: among.round }), t: { '.sv': 'timestamp' } }) })
    .then((r) => { if (r.status === 401 || r.status === 403) amongBlocked(); })
    .catch(() => {});
}
function amongWriteS(S) {
  S.v = ((among.S && among.S.v) || 0) + 1;   // pořadí stavu: starší ozvěna z proudu se zahodí
  fetch(amongUrl(`${among.game}/s`), { method: 'PUT', body: JSON.stringify({ d: JSON.stringify(S), t: { '.sv': 'timestamp' } }) })
    .then((r) => { if (r.status === 401 || r.status === 403) amongBlocked(); })
    .catch(() => {});
  amongApplyS(S);   // u sebe hned (z proudu se pak vrátí totéž)
}
// Staré hry v databázi (všichni dávno odešli) uklidí kdokoli, kdo otevře seznam
function amongPurge() {
  fetch(amongUrl('').replace(/\/\.json$/, '.json')).then((r) => r.json()).then((all) => {
    for (const [g, v] of Object.entries(all || {})) {
      const t = v && v.s && v.s.t;
      if (!Number.isFinite(t) || amongNow() - t > 3600000) fetch(amongUrl(g), { method: 'DELETE' }).catch(() => {});
    }
  }).catch(() => {});
}

// Nový stav od hostitele → co se změnilo u mě
function amongApplyS(S) {
  if (!amongOn() || !S || typeof S !== 'object') return;
  if (among.S && Number.isFinite(among.S.v) && Number.isFinite(S.v) && S.v < among.S.v) return;   // starší stav (přišel pozdě)
  const prev = among.S;
  among.S = S;
  const inRound = Array.isArray(S.p) && S.p.includes(mp.id);
  if (S.st === 'lobby') {
    if (among.phase !== 'lobby') {   // kolo skončilo – zpět do čekárny
      Object.assign(among, { phase: 'lobby', role: '', dead: false, vote: null, voted: false, deathAnim: null, deathT: 0 });
      state.amongTask = null;
      amongEnterLobby();
      mp.last = '';
    }
    return;
  }
  if (!inRound) return;   // připojil jsem se až během kola – čekám v čekárně
  if (S.k !== among.round) {   // nové kolo
    among.round = S.k;
    among.role = (S.im || []).includes(mp.id) ? 'zaskodnik' : 'nevinny';
    among.dead = false;
    among.phase = 'reveal';
    among.revealT = AMONG.REVEAL;
    among.killCd = Math.min(AMONG.FIRST_KILL, amongSet().kc);
    among.myDone = []; among.deathAnim = null; among.deathT = 0;
    state.pauseMenu = null; state.emotePick = false; state.amongSet = null; state.amongTask = null;
    if (state.screen === 'skins') skinsLeave();   // převlékal se v čekárně
    amongToSpawn();
    mp.last = '';   // gp: 1
    playSound(among.role === 'zaskodnik' ? [[196, 0, 0.25], [147, 0.28, 0.4]] : [[523, 0, 0.1], [659, 0.12, 0.1], [784, 0.24, 0.2]]);
    return;
  }
  // zemřel jsem (zabil mě záškodník – vyhození ukáže obrazovka vyhození)
  if (!among.dead && (S.dead || []).includes(mp.id)) {
    among.dead = true;
    state.amongTask = null;
    const body = (S.bodies || []).find((b) => b.id === mp.id);
    if (body) {   // zabili mě: animace útoku
      among.deathAnim = { t: 0, killer: body.k || '' };
      state.pauseMenu = null; state.transition = null;
      playSound([[110, 0, 0.3], [82, 0.3, 0.5]], 'sawtooth');
    }
  }
  const was = prev && prev.k === S.k ? prev.st : 'play';
  if (S.st === 'meet' && was !== 'meet') {   // porada: všichni ke stolu (hlas tam funguje)
    Object.assign(among, { phase: among.phase === 'reveal' ? 'reveal' : 'meet', vote: null, voted: false, deathAnim: null });
    state.pauseMenu = null; state.emotePick = false; state.amongTask = null;
    state.transition = null;
    amongToSpawn();
    playSound([[880, 0, 0.12], [660, 0.14, 0.12], [880, 0.28, 0.2]], 'square');
  } else if (S.st === 'eject' && was !== 'eject') {
    among.phase = 'eject';
  } else if (S.st === 'play' && (was === 'eject' || was === 'meet')) {   // po poradě znovu na start
    among.phase = 'play';
    among.killCd = amongSet().kc;
    amongToSpawn();
  } else if (S.st === 'end' && was !== 'end') {
    among.phase = 'end';
    state.amongTask = null; among.deathAnim = null;
    const won = (S.win === 'imp') === (among.role === 'zaskodnik');
    playSound(won ? CONFIG.SOUND_COMPLETE : CONFIG.SOUND_MISS);
  }
}

// --- Hostitel: kontroluje zprávy a čas, zapisuje stav ---
function amongOpenInbox() {
  if (among.esE) return;
  among.esE = amongStream(amongUrl(`${among.game}/e`), (path, data) => {
    const key = path.split('/').filter(Boolean)[0];
    const add = (k, v) => { if (v && typeof v.f === 'string' && typeof v.d === 'string') among.inbox.push({ key: k, f: v.f, d: v.d }); };
    if (key) add(key, data);
    else for (const [k, v] of Object.entries(data || {})) add(k, v);
  });
}
function amongHostTick() {
  if (!amongIsHost()) {
    if (among.esE) { among.esE.close(); among.esE = null; among.inbox = []; }
    return;
  }
  amongOpenInbox();
  const S0 = among.S;
  if (!S0 || S0.st === 'lobby') { among.inbox = []; return; }
  const S = JSON.parse(JSON.stringify(S0)), now = mpServerNow();
  let changed = false;
  for (const m of among.inbox.splice(0)) {
    fetch(amongUrl(`${among.game}/e/${m.key}`), { method: 'DELETE' }).catch(() => {});   // přečteno
    let d;
    try { d = JSON.parse(m.d); } catch (err) { continue; }
    if (d && d.r === S.k && amongHostEvent(S, m.f, d, now)) changed = true;
  }
  // kdo z kola odešel (zavřel hru), počítá se jako mrtvý (bez těla)
  if (S.st === 'play' || S.st === 'meet') {
    const g = amongMyGame(), here = new Set(g ? g.players.map((p) => p.id) : []);
    for (const id of S.p) if (!here.has(id) && !S.dead.includes(id)) { S.dead.push(id); (S.gone = S.gone || []).push(id); changed = true; }   // úkoly odešlých se nepočítají
  }
  const set = Object.assign({}, AMONG_DEFAULTS, S.set);
  if (S.st === 'meet') {
    const voteFrom = S.meet.t0 + (AMONG.MEET_INTRO + set.dt) * 1000, voteTo = voteFrom + set.vt * 1000;
    const alive = S.p.filter((id) => !S.dead.includes(id));
    if (now >= voteTo || (now >= voteFrom && alive.every((id) => S.meet.votes[id]))) { amongTally(S, now); changed = true; }
  } else if (S.st === 'eject' && now - S.ts >= AMONG.EJECT_TIME * 1000) {
    if (!amongCheckWin(S, now)) Object.assign(S, { st: 'play', bodies: [], lme: now, ts: now });
    changed = true;
  } else if (S.st === 'end' && now - S.ts >= AMONG.END_TIME * 1000) {
    Object.assign(S, { st: 'lobby', ts: now });
    changed = true;
  }
  if (S.st === 'play' && amongCheckWin(S, now)) changed = true;
  if (changed) amongWriteS(S);
}
// Jedna zpráva od hráče f – platí jen, když to pravidla dovolí
function amongHostEvent(S, f, d, now) {
  const alive = (id) => S.p.includes(id) && !S.dead.includes(id);
  const set = Object.assign({}, AMONG_DEFAULTS, S.set);
  if (d.k === 'kill' && S.st === 'play' && S.im.includes(f) && alive(f) && alive(d.v) && !S.im.includes(d.v)) {
    S.dead.push(d.v);
    S.bodies.push({ id: d.v, r: String(d.rm || ''), x: Number(d.x) || 0, y: Number(d.y) || 0, k: f, at: now });
    return true;
  }
  if (d.k === 'task' && (S.st === 'play' || S.st === 'meet') && S.p.includes(f) && !S.im.includes(f) && (S.tk[f] || []).includes(d.i)) {
    const done = S.td[f] = S.td[f] || [];
    if (!done.includes(d.i)) { done.push(d.i); return true; }
  }
  if (d.k === 'rep' && S.st === 'play' && alive(f) && S.bodies.some((b) => b.id === d.b)) {
    amongStartMeet(S, f, d.b, now);
    return true;
  }
  if (d.k === 'emer' && S.st === 'play' && alive(f) && (S.em[f] || 0) < set.em && now - S.lme >= set.ec * 1000 - 1500) {
    S.em[f] = (S.em[f] || 0) + 1;
    amongStartMeet(S, f, '', now);
    return true;
  }
  if (d.k === 'vote' && S.st === 'meet' && alive(f) && !S.meet.votes[f] && now >= S.meet.t0 + (AMONG.MEET_INTRO + set.dt) * 1000 - 1500
      && (d.t === 'skip' || alive(d.t))) {
    S.meet.votes[f] = d.t;
    return true;
  }
  return false;
}
function amongStartMeet(S, by, body, now) {
  Object.assign(S, { st: 'meet', meet: { by, body, t0: now, votes: {} }, ts: now });
}
// Konec hlasování: nejvíc hlasů = vyhozen, nerozhodně nebo nejvíc „přeskočit“ = nikdo
function amongTally(S, now) {
  const count = {};
  for (const t of Object.values(S.meet.votes)) count[t] = (count[t] || 0) + 1;
  let top = null, max = 0, tie = false;
  for (const [t, c] of Object.entries(count)) {
    if (c > max) { top = t; max = c; tie = false; } else if (c === max) tie = true;
  }
  const id = !tie && top && top !== 'skip' ? top : '';
  if (id) S.dead.push(id);
  Object.assign(S, { st: 'eject', ej: { id, imp: !!id && S.im.includes(id), tie, skip: !tie && top === 'skip', votes: S.meet.votes }, ts: now });
}
// Kdo vyhrál? záškodníci pryč = nevinní, záškodníků stejně jako nevinných = záškodníci
function amongCheckWin(S, now) {
  const imp = S.im.filter((id) => !S.dead.includes(id)).length;
  const crew = S.p.filter((id) => !S.im.includes(id) && !S.dead.includes(id)).length;
  // úkoly: všechny úkoly nevinných (i mrtvých, bez odešlých) splněné
  let all = 0, done = 0;
  for (const id of S.p) {
    if (S.im.includes(id) || (S.gone || []).includes(id)) continue;
    all += (S.tk[id] || []).length;
    done += ((S.td && S.td[id]) || []).length;
  }
  const tasks = all > 0 && done >= all;
  const win = imp === 0 || tasks ? 'crew' : imp >= crew ? 'imp' : '';
  if (win) Object.assign(S, { st: 'end', win, how: tasks && imp > 0 ? 'tasks' : '', ts: now });
  return !!win;
}
// Hostitel spustí kolo: náhodně vybere záškodníky
function amongStartRound() {
  const g = amongMyGame();
  if (!g || !g.players[0].me || (among.S && among.S.st && among.S.st !== 'lobby')) return;   // stav hry zná hostitel sám (gp ostatních se může opozdit)
  if (performance.now() - (among.startedAt || 0) < 3000) return;   // dvojí stisk: role se nesmí rozdat dvakrát
  const n = g.players.length;
  if (n < AMONG.MIN) { state.toast = { text: `Na hru jsou potřeba aspoň ${AMONG.MIN} hráči (teď ${n})`, t: CONFIG.TOAST_TIME }; return; }
  const ids = g.players.map((p) => p.id), pool = ids.slice(), im = [];
  for (let i = 0; i < AMONG.IMPOSTORS(n); i++) im.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  const names = {};
  for (const p of g.players) names[p.id] = p.n;
  const now = mpServerNow(), set = amongSet(), stations = (amongMap().tasks || []).length, tk = {};
  for (const id of ids) {   // každému náhodně set.tc různých míst s úkolem
    const pool = Array.from({ length: stations }, (_, i) => i), mine = [];
    for (let i = 0; i < Math.min(set.tc, stations); i++) mine.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    tk[id] = mine;
  }
  among.startedAt = performance.now();
  amongWriteS({ k: ((among.S && among.S.k) || 0) + 1, st: 'play', set, im, p: ids, names, dead: [], gone: [], bodies: [], em: {}, tk, td: {}, lme: now, ts: now });
}
// Hostitel ukončí kolo (☰) – všichni zpět do čekárny
function amongEndRound() {
  if (!amongIsHost() || among.phase === 'lobby' || !among.S) return;
  amongWriteS({ k: among.S.k, st: 'lobby', set: amongSet(), ts: mpServerNow() });
}
// Položky v ☰ (31_menu.js)
const amongPauseItems = () => (amongOn() && among.phase !== 'lobby' && amongIsHost() ? [{ id: 'amongEnd', label: '⏹ Ukončit kolo' }] : []);
function amongPauseAction(id) {
  if (id !== 'amongEnd') return false;
  amongEndRound();
  state.pauseMenu = null;
  return true;
}
const amongRoleName = (role) => (role === 'zaskodnik' ? 'Záškodník' : 'Nevinný');
const amongRoleColor = (role) => (role === 'zaskodnik' ? '#ff4d4d' : '#4fc3f7');

// --- Nastavení v čekárně (⚙) ---
const amongSetBtn = () => (amongIsHost() ? AMONG.SET_BTN : { x: 325, y: 524, w: 150, h: 48 });
const amongDressBtn = () => (amongIsHost() ? { x: 130, y: 524, w: 150, h: 48 } : { x: 165, y: 524, w: 150, h: 48 });   // 👕 převléct
const AMONG_SET_PANEL = { x: 140, y: 56, w: 520, h: 536 };
const amongSetRow = (i) => ({ x: 160, y: 100 + i * 37, w: 480, h: 33 });
const AMONG_SET_CLOSE = { x: 300, y: 512, w: 200, h: 42 };
function amongSetChange(i, d) {
  if (!amongIsHost() || i >= AMONG_SETTINGS.length) return;
  const def = AMONG_SETTINGS[i], set = amongSet(), vals = def.values;
  const k = (Math.max(0, vals.indexOf(set[def.id])) + d + vals.length) % vals.length;
  set[def.id] = vals[k];
  amongWriteS({ k: (among.S && among.S.k) || 0, st: 'lobby', set, ts: mpServerNow() });
  playSound([[700, 0, 0.03]]);
}
function amongSetKey(code) {
  const S = state.amongSet, n = AMONG_SETTINGS.length + 1;
  if (code === 'Escape') state.amongSet = null;
  else if (KEYMAP.up.includes(code)) S.sel = (S.sel + n - 1) % n;
  else if (KEYMAP.down.includes(code)) S.sel = (S.sel + 1) % n;
  else if (KEYMAP.left.includes(code)) amongSetChange(S.sel, -1);
  else if (KEYMAP.right.includes(code)) amongSetChange(S.sel, 1);
}
function amongSetEvents(events) {
  const S = state.amongSet;
  for (const ev of events) {
    if (ev.type === 'action') { if (S.sel >= AMONG_SETTINGS.length) state.amongSet = null; else amongSetChange(S.sel, 1); continue; }
    if (ev.x == null) continue;
    if (pointInRect(ev.x, ev.y, AMONG_SET_CLOSE, 2) || !pointInRect(ev.x, ev.y, AMONG_SET_PANEL, 0)) { state.amongSet = null; return; }
    const i = AMONG_SETTINGS.findIndex((_, k) => pointInRect(ev.x, ev.y, amongSetRow(k), 0));
    if (i < 0) continue;
    S.sel = i;
    const r = amongSetRow(i);
    amongSetChange(i, ev.x >= r.x + r.w - 180 && ev.x < r.x + r.w - 90 ? -1 : 1);   // ◀ vlevo od hodnoty = zpět, jinak dál
  }
}
function drawAmongSettings() {
  const S = state.amongSet;
  if (!S) return;
  const P = AMONG_SET_PANEL, set = amongSet(), host = amongIsHost();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 16);
  ctx.fillStyle = '#1d2333'; ctx.fill();
  ctx.strokeStyle = '#c51111'; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText('⚙ Nastavení hry', 400, P.y + 24, 'bold 22px sans-serif', '#ff5a4a', 'middle');
  AMONG_SETTINGS.forEach((def, i) => {
    const r = amongSetRow(i);
    roundRectPath(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = i === S.sel && host ? 'rgba(255, 213, 74, 0.25)' : 'rgba(255, 255, 255, 0.06)'; ctx.fill();
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e0e6f2';
    ctx.fillText(def.label, r.x + 12, r.y + r.h / 2 + 1);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd54a';
    ctx.fillText(def.show(set[def.id]), r.x + r.w - 90, r.y + r.h / 2 + 1, 120);
    if (host) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('◀', r.x + r.w - 160, r.y + r.h / 2 + 1);
      ctx.fillText('▶', r.x + r.w - 20, r.y + r.h / 2 + 1);
    }
  });
  drawChessButton(AMONG_SET_CLOSE, 'Zavřít', S.sel >= AMONG_SETTINGS.length, '#5a4636');
  drawOutlinedText(host ? (isTouchHint() ? 'Ťukni na hodnotu – změní se' : '↑ ↓ vybrat · ← → změnit · Esc zavřít') : 'Nastavení mění hostitel', 400, P.y + P.h - 8, '12px sans-serif', '#c9d3e8', 'middle');
}

// --- Svět: těla a tlačítko porady (pod hráči) ---
function drawAmongWorld() {
  const room = state.room, b = amongSpot(amongMap().button);
  drawAmongStations();   // místa s úkoly (37_among_ukoly.js)
  if (b.room === room.id) {   // stojan s červeným tlačítkem
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 6, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6d7b8c';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 24, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b3bcc7';
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 4, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 7, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath(); ctx.ellipse(b.x - 3, b.y - 9, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const body of among.S.bodies || []) {
    if (body.r !== room.id) continue;
    const x = room.x + body.x, y = room.y + body.y;
    const age = Number.isFinite(body.at) ? Math.max(0, (mpServerNow() - body.at) / 1000) : 9;   // čerstvé tělo padá
    const fall = Math.min(1, age / 0.45), pool = Math.min(1, age / 1.2);
    ctx.fillStyle = 'rgba(150, 0, 0, 0.75)';   // kaluž se rozlévá
    ctx.beginPath(); ctx.ellipse(x, y + 8, 30 * pool, 12 * pool, 0, 0, Math.PI * 2); ctx.fill();
    if (age < 0.9) {   // stříkající krev
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2 + body.x, r = 10 + age * 70 * (0.6 + (k % 3) * 0.2);
        ctx.fillStyle = `rgba(190, 0, 0, ${1 - age / 0.9})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y - 10 + Math.sin(a) * r * 0.6 + age * age * 60, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(x + 26 * fall, y + 6);
    ctx.rotate(-Math.PI / 2 * fall);   // padá na bok
    if (body.id === mp.id) drawPlayerFigure(0, 0, 0, 0);
    else {
      const o = mp.others[body.id];
      drawFigure(0, 0, 0, 0, o ? remoteLook(o) : remoteLook({ color: '#777777' }));
    }
    ctx.restore();
  }
  if (among.slash) {   // záblesk nože u záškodníka
    const k = among.slash.t / 0.6, sl = among.slash;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(sl.x - 20, sl.y - 30, 46, -0.9 + k, 0.6 + k); ctx.stroke();
    ctx.restore();
  }
}
// Animace, když mě zabijí: záškodník přiběhne, nůž, padám (přes celou obrazovku)
function drawAmongDeathAnim() {
  const A = among.deathAnim, W = CONFIG.WIDTH, H = CONFIG.HEIGHT, t = A.t;
  ctx.fillStyle = '#1a0003';
  ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  const g = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 380);
  g.addColorStop(0, 'rgba(160, 0, 0, 0.55)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  ctx.fillStyle = '#2b0a0d'; ctx.fillRect(-VIEW.offX, 430, W + 2 * VIEW.offX, H - 430);   // podlaha
  const killer = mp.others[A.killer];
  const kx = 120 + Math.min(1, t / 0.8) * 230;   // záškodník přiběhne zleva
  ctx.save(); ctx.translate(kx, 430); ctx.scale(2.6, 2.6);
  drawFigure(0, 0, t < 0.8 ? t * 14 : 0, t < 0.8 ? 1 : 0, killer ? remoteLook(killer) : remoteLook({ color: '#222222' }));
  ctx.restore();
  if (t > 0.8 && t < 1.2) {   // nůž
    const k = (t - 0.8) / 0.4;
    ctx.save(); ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(470, 300, 90, -1.6 + k * 2, -0.4 + k * 2); ctx.stroke();
    ctx.restore();
  }
  const fall = Math.max(0, Math.min(1, (t - 1) / 0.45));   // já padám
  ctx.save(); ctx.translate(500 + fall * 60, 430); ctx.rotate(Math.PI / 2 * fall); ctx.scale(2.6, 2.6);
  drawPlayerFigure(0, 0, 0, 0);
  ctx.restore();
  if (t > 1) {   // krev
    const a = t - 1;
    for (let k = 0; k < 18; k++) {
      const ang = k / 18 * Math.PI * 2, r = 20 + a * 220 * (0.5 + (k % 4) * 0.15);
      ctx.fillStyle = `rgba(200, 0, 0, ${Math.max(0, 1 - a / 1.4)})`;
      ctx.beginPath(); ctx.arc(510 + Math.cos(ang) * r, 330 + Math.sin(ang) * r * 0.7 + a * a * 120, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(150, 0, 0, 0.8)';
    ctx.beginPath(); ctx.ellipse(540, 440, 120 * Math.min(1, a / 1), 22 * Math.min(1, a / 1), 0, 0, Math.PI * 2); ctx.fill();
  }
  if (t > 0.8 && t < 0.95) { ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H); }   // záblesk
  if (t > 1.4) drawOutlinedText(killer ? `Zabil tě ${killer.n}` : 'Zabili tě', W / 2, 140, 'bold 34px sans-serif', '#ff4d4d', 'middle');
}

// --- Porada: úvod, diskuze, hlasování ---
const amongMeetCard = (i) => ({ x: i % 2 ? 410 : 110, y: 150 + Math.floor(i / 2) * 58, w: 280, h: 52 });
const AMONG_SKIP = { x: 300, y: 456, w: 200, h: 44 };
function amongMeetTimes() {
  const S = among.S, set = amongSet(), now = mpServerNow();
  const voteFrom = S.meet.t0 + (AMONG.MEET_INTRO + set.dt) * 1000, voteTo = voteFrom + set.vt * 1000;
  return { intro: now < S.meet.t0 + AMONG.MEET_INTRO * 1000, voting: now >= voteFrom, left: Math.max(0, Math.ceil(((now < voteFrom ? voteFrom : voteTo) - now) / 1000)) };
}
function amongVoteFor(target) {
  if (among.dead || among.voted || !amongMeetTimes().voting) return;
  if (among.vote !== target) { among.vote = target; playSound([[700, 0, 0.03]]); return; }   // 1. ťuknutí vybere, 2. potvrdí
  among.voted = true;
  amongSend({ k: 'vote', t: target });
  playSound([[523, 0, 0.06], [784, 0.07, 0.08]]);
}
function amongMeetEvents(events) {
  if (!among.S || !among.S.meet) return;
  for (const ev of events) {
    if (ev.type === 'action') { if (among.vote) amongVoteFor(among.vote); continue; }
    if (ev.x == null) continue;
    if (pointInRect(ev.x, ev.y, AMONG_SKIP, 2)) { amongVoteFor('skip'); continue; }
    const i = among.S.p.findIndex((_, k) => pointInRect(ev.x, ev.y, amongMeetCard(k), 0));
    if (i >= 0 && !amongIsDead(among.S.p[i])) amongVoteFor(among.S.p[i]);
  }
}
function amongMeetKey(code) {   // šipky = výběr, Enter = potvrdit (přes action)
  if (!among.S || !among.S.meet || among.voted || among.dead) return;
  const opts = [...among.S.p.filter((id) => !amongIsDead(id)), 'skip'];
  const i = opts.indexOf(among.vote), d = KEYMAP.down.includes(code) || KEYMAP.right.includes(code) ? 1 : KEYMAP.up.includes(code) || KEYMAP.left.includes(code) ? -1 : 0;
  if (d) among.vote = opts[(i + d + opts.length) % opts.length];
}
function drawAmongMeeting() {
  const S = among.S, W = CONFIG.WIDTH, H = CONFIG.HEIGHT, T = amongMeetTimes(), set = amongSet();
  ctx.fillStyle = 'rgba(10, 14, 28, 0.96)';
  ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  const by = amongName(S.meet.by);
  if (T.intro) {   // úvod porady
    drawOutlinedText(S.meet.body ? '📢 NALEZENO TĚLO!' : '🚨 MIMOŘÁDNÁ PORADA!', W / 2, 250, 'bold 46px sans-serif', S.meet.body ? '#ff4d4d' : '#ffd54a', 'middle');
    drawOutlinedText(S.meet.body ? `${by} našel tělo hráče ${amongName(S.meet.body)}` : `Poradu svolal ${by}`, W / 2, 316, 'bold 20px sans-serif', '#ffffff', 'middle');
    return;
  }
  drawOutlinedText('Kdo je záškodník?', W / 2, 96, 'bold 28px sans-serif', '#ffffff', 'middle');
  drawOutlinedText(T.voting ? `Hlasování: ${T.left} s` : `Diskuze: ${T.left} s – hlasovat se ještě nedá`, W / 2, 126, 'bold 16px sans-serif', T.voting ? '#ffd54a' : '#c9d3e8', 'middle');
  S.p.forEach((id, i) => {
    const r = amongMeetCard(i), dead = amongIsDead(id), sel = among.vote === id, voted = !!S.meet.votes[id];
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = dead ? '#3a3f4a' : sel ? (among.voted ? '#2e7d32' : '#6b5a1e') : '#26324d'; ctx.fill();
    ctx.strokeStyle = sel ? '#ffd54a' : 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = sel ? 3 : 1.5; ctx.stroke();
    ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = dead ? '#8a8f99' : '#ffffff';
    const tag = (id === S.meet.by ? '📢 ' : '') + (dead ? '✝ ' : '') + amongName(id) + (id === mp.id ? ' (ty)' : '');
    amongColorDot(id, r.x + 18, r.y + r.h / 2, 9);
    ctx.fillStyle = dead ? '#8a8f99' : '#ffffff';
    ctx.fillText(tag, r.x + 34, r.y + r.h / 2 + 1, r.w - 100);
    if (dead) {   // přeškrtnutý
      ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r.x + 10, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 10, r.y + r.h / 2); ctx.stroke();
    } else if (voted) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#7ee08a'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText('✔ hlasoval', r.x + r.w - 12, r.y + r.h / 2 + 1);
    }
  });
  const skipSel = among.vote === 'skip';
  drawChessButton(AMONG_SKIP, `⏭ Přeskočit${skipSel && !among.voted ? ' – znovu = potvrdit' : ''}`, skipSel, '#4a4a4a');
  const hint = among.dead ? 'Jsi duch – nehlasuješ' : among.voted ? 'Odhlasováno – čeká se na ostatní'
    : !T.voting ? 'Domluvte se (hlas 🎤 funguje), pak hlasujte'
    : among.vote ? (isTouchHint() ? 'Ťukni znovu = potvrdit hlas' : 'Enter / znovu kliknout = potvrdit hlas') : 'Vyber, koho vyhodit, nebo přeskoč';
  drawOutlinedText(hint, W / 2, 522, 'bold 16px sans-serif', among.voted ? '#7ee08a' : '#ffffff', 'middle');
  if (set.an) drawOutlinedText('Anonymní hlasování', W / 2, 550, '12px sans-serif', '#c9d3e8', 'middle');
}
// Obrazovka s vyhozeným
function drawAmongEject() {
  const S = among.S, W = CONFIG.WIDTH, H = CONFIG.HEIGHT, ej = S.ej || {}, set = amongSet();
  ctx.fillStyle = '#05070f';
  ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  for (let i = 0; i < 70; i++) {   // hvězdy
    const x = (i * 137.5) % (W + 2 * VIEW.offX) - VIEW.offX, y = (i * 89.3) % H;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + (i % 5) * 0.12})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const age = (mpServerNow() - S.ts) / 1000;
  if (ej.id) {   // postava odlétá vesmírem
    const x = -60 + age * 150;
    ctx.save(); ctx.translate(x, 330); ctx.rotate(age * 2);
    if (ej.id === mp.id) drawPlayerFigure(0, 20, 0, 0);
    else { const o = mp.others[ej.id]; drawFigure(0, 20, 0, 0, o ? remoteLook(o) : remoteLook({ color: '#777777' })); }
    ctx.restore();
  }
  const name = ej.id ? amongName(ej.id) : '';
  const left = S.im.filter((id) => !S.dead.includes(id)).length;
  const line1 = ej.id ? (set.ce ? `${name} ${ej.imp ? 'BYL' : 'NEBYL'} záškodník.` : `${name} byl vyhozen.`) : ej.tie ? 'Nikdo nebyl vyhozen (nerozhodně).' : 'Nikdo nebyl vyhozen (přeskočeno).';
  if (age > 0.8) drawOutlinedText(line1, W / 2, 200, 'bold 30px sans-serif', '#ffffff', 'middle');
  if (age > 2 && set.ce) drawOutlinedText(`${left === 1 ? 'Zbývá 1 záškodník' : left > 1 ? `Zbývají ${left} záškodníci` : 'Nezbývá žádný záškodník'}.`, W / 2, 250, 'bold 20px sans-serif', '#c9d3e8', 'middle');
  // kdo jak hlasoval (bez anonymního hlasování)
  if (age > 2 && !set.an && ej.votes) {
    const rows = Object.entries(ej.votes).map(([v, t]) => `${amongName(v)} → ${t === 'skip' ? 'přeskočit' : amongName(t)}`);
    rows.slice(0, 10).forEach((t, i) => drawOutlinedText(t, W / 2, 420 + i * 18, '13px sans-serif', '#9aa6bd', 'middle'));
  }
}
// Kdo vyhrál
function drawAmongEnd() {
  const S = among.S, W = CONFIG.WIDTH, H = CONFIG.HEIGHT, imp = S.win === 'imp';
  ctx.fillStyle = imp ? 'rgba(40, 0, 0, 0.95)' : 'rgba(0, 18, 40, 0.95)';
  ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  const won = imp === (among.role === 'zaskodnik');
  drawOutlinedText(won ? 'VÝHRA!' : 'PROHRA', W / 2, 190, 'bold 30px sans-serif', won ? '#ffd54a' : '#9aa6bd', 'middle');
  drawOutlinedText(imp ? 'VYHRÁLI ZÁŠKODNÍCI' : 'VYHRÁLI NEVINNÍ', W / 2, 260, 'bold 48px sans-serif', imp ? '#ff4d4d' : '#4fc3f7', 'middle');
  if (S.how === 'tasks') drawOutlinedText('Nevinní splnili všechny úkoly!', W / 2, 296, 'bold 18px sans-serif', '#7ee08a', 'middle');
  drawOutlinedText(`${S.im.length > 1 ? 'Záškodníci byli' : 'Záškodník byl'}: ${S.im.map(amongName).join(', ')}`, W / 2, 330, 'bold 20px sans-serif', '#ffffff', 'middle');
  drawOutlinedText('Za chvíli zpět do čekárny…', W / 2, 400, '15px sans-serif', '#c9d3e8', 'middle');
}

// --- Horní lišta, akční tlačítka a překryvy ---
function drawAmongAction(r, icon, label, ok, extra) {
  ctx.save();
  ctx.globalAlpha = ok ? 1 : 0.4;
  ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(15, 20, 35, 0.8)'; ctx.fill();
  ctx.strokeStyle = ok ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.fillText(icon, r.x + r.w / 2, r.y + r.h / 2 - 8);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 26);
  ctx.restore();
  if (extra) drawOutlinedText(extra, r.x + r.w / 2, r.y + r.h / 2 - 6, 'bold 30px sans-serif', '#ffffff', 'middle');
}
function drawAmongHud() {
  const g = amongMyGame(), players = g ? g.players : [], lobby = among.phase === 'lobby', keys = !isTouchHint();
  drawAmongDark();   // zhasnutá světla (38_among_extra.js)
  ctx.textBaseline = 'middle';
  ctx.font = CONFIG.COUNTER_FONT; ctx.textAlign = 'left';
  ctx.fillStyle = lobby ? '#ff5a4a' : amongRoleColor(among.role);
  ctx.fillText(lobby ? '👾 Among Us · čekárna' : `👾 Jsi ${amongRoleName(among.role)}${among.dead ? ' · 👻 duch' : ''}`, 12, CONFIG.TITLE_Y);
  ctx.font = CONFIG.TASK_FONT; ctx.textAlign = 'center'; ctx.fillStyle = CONFIG.TASK_COLOR;
  const host = players[0], n = players.length, set = amongSet();
  let task;
  if (!lobby) {
    const partners = among.S ? among.S.im.filter((id) => id !== mp.id).map(amongName) : [];
    task = among.dead ? 'Jsi duch – živí tě nevidí ani neslyší'
      : among.role === 'zaskodnik' ? (partners.length ? `Druhý záškodník: ${partners.join(', ')} · ` : '') + `Zabíjej nenápadně${keys ? ' (Q)' : ''}`
      : `Plň úkoly (!)${keys ? ' – E' : ''} · tělo nahlas${keys ? ' (R)' : ''} · porada u tlačítka`;
    if (among.dead && among.role === 'nevinny') task = 'Jsi duch – můžeš dál plnit úkoly';
  } else if (host && host.me) task = n >= AMONG.MIN ? `Jsi hostitel – spusť hru (${n} hráčů, ${AMONG.IMPOSTORS(n)} ${AMONG.IMPOSTORS(n) > 1 ? 'záškodníci' : 'záškodník'})` : `Jsi hostitel – čeká se na hráče (${n}/${AMONG.MIN})`;
  else task = `Čeká se na start hry (hostitel: ${host ? host.n : '?'}) · mapa ${set.map}`;
  ctx.fillText(task, CONFIG.WIDTH / 2, CONFIG.TASK_Y, CONFIG.MUSIC_BUTTON.x - 40);
  if (lobby) {
    if (host && host.me) {   // ▶ Začít hru
      const ok = n >= AMONG.MIN;
      drawChessButton(AMONG.START_BTN, ok ? (keys ? '▶ Začít hru (mezerník)' : '▶ Začít hru') : `Potřeba ${AMONG.MIN} hráči (${n}/${AMONG.MIN})`, false, ok ? '#2e7d32' : '#4a4a4a');
    }
    drawChessButton(amongSetBtn(), `⚙ Nastavení`, false, '#2f5a7a');
    drawChessButton(amongDressBtn(), '👕 Převléct', false, '#6a2c8c');
  } else if (among.phase === 'play') {
    const b = amongBodyNear(), em = amongEmergencyState();
    if (among.role === 'zaskodnik' && !among.dead) {
      const t = amongKillTarget(), cd = Math.ceil(among.killCd);
      drawAmongAction(AMONG.ACT.kill, '🔪', keys ? 'ZABÍT (Q)' : 'ZABÍT', !!t && cd <= 0, cd > 0 ? String(cd) : '');
    }
    if (!among.dead) drawAmongAction(AMONG.ACT.report, '📢', keys ? 'NAHLÁSIT (R)' : 'NAHLÁSIT', !!b);
    const use = amongUseInfo(em, keys);   // úkol / vent / vypínač / porada (38_among_extra.js)
    if (use) drawAmongAction(AMONG.ACT.emer, use.icon, use.label, use.ok, use.extra || '');
    drawAmongSabButton(keys);
  }
  // hráči vpravo pod počtem online (v kole i kdo je mrtvý – vidí jen duch)
  const H = AMONG.HUD, rowH = 20, h = 30 + players.length * rowH;
  if (among.phase === 'lobby' || among.phase === 'play') {
    roundRectPath(H.x, H.y, H.w, h, 8);
    ctx.fillStyle = 'rgba(15, 20, 35, 0.75)'; ctx.fill();
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
    ctx.fillText(`Hráči ${players.length}/${AMONG.MAX}${lobby ? ` · mapa ${set.map}` : ''}`, H.x + 10, H.y + 15);
    players.forEach((pl, i) => {
      const ghost = among.dead && amongIsDead(pl.id);
      ctx.fillStyle = pl.me ? '#ffd54a' : ghost ? '#8a8f99' : '#e0e6f2';
      ctx.fillText(`${i === 0 ? '👑 ' : '   '}${ghost ? '👻 ' : ''}${pl.n}${pl.me ? ' (ty)' : ''}`, H.x + 10, H.y + 34 + i * rowH, H.w - 20);
      if (i > 0) amongColorDot(pl.id, H.x + 16, H.y + 34 + i * rowH, 5);   // barva hráče (38_among_extra.js)
    });
  }
  drawAmongTaskList();   // seznam úkolů vlevo (37_among_ukoly.js)
  drawAmongTask();       // otevřený úkol
  if (among.deathAnim) drawAmongDeathAnim();
  if (among.deathT > 0 && among.phase === 'play') {   // zabili mě
    ctx.save();
    ctx.globalAlpha = Math.min(1, among.deathT / 0.5);
    ctx.fillStyle = 'rgba(120, 0, 0, 0.75)';
    ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
    drawOutlinedText('ZABILI TĚ!', CONFIG.WIDTH / 2, 260, 'bold 56px sans-serif', '#ff4d4d', 'middle');
    drawOutlinedText('Jsi duch – můžeš dál chodit, ale živí tě nevidí.', CONFIG.WIDTH / 2, 320, 'bold 18px sans-serif', '#ffffff', 'middle');
    ctx.restore();
  }
  if (among.phase === 'meet' && among.S && among.S.meet) drawAmongMeeting();
  else if (among.phase === 'eject' && among.S) drawAmongEject();
  else if (among.phase === 'end' && among.S) drawAmongEnd();
  if (among.phase === 'reveal') drawAmongReveal();
  drawAmongSettings();
}

// Obrazovka s rolí na začátku kola (přes celou hru)
function drawAmongReveal() {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT, imp = among.role === 'zaskodnik';
  const a = Math.min(1, (AMONG.REVEAL - among.revealT) / 0.4, among.revealT / 0.4);
  const partners = among.S ? among.S.im.filter((id) => id !== mp.id).map(amongName) : [];
  const n = among.S ? among.S.im.length : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = imp ? 'rgba(40, 0, 0, 0.94)' : 'rgba(0, 18, 40, 0.94)';
  ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, H);
  drawOutlinedText('Tvoje role:', W / 2, 190, 'bold 22px sans-serif', '#ffffff', 'middle');
  drawOutlinedText(amongRoleName(among.role).toUpperCase(), W / 2, 260, 'bold 64px sans-serif', amongRoleColor(among.role), 'middle');
  const lines = imp
    ? ['Nenápadně zabíjej a nenech se odhalit.', partners.length ? `Druhý záškodník: ${partners.join(', ')}` : 'Jsi jediný záškodník.']
    : ['Plň úkoly a najdi záškodníka.', `Mezi vámi ${n > 1 ? `jsou ${n} záškodníci` : 'je 1 záškodník'}.`];
  lines.forEach((t, i) => drawOutlinedText(t, W / 2, 340 + i * 32, 'bold 19px sans-serif', '#ffffff', 'middle'));
  drawOutlinedText(`Mapa ${amongMap().name}`, W / 2, 440, '15px sans-serif', '#c9d3e8', 'middle');
  ctx.restore();
}
