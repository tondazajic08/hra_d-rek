// Stav hry a ovládání (klávesnice, joystick, ťuknutí)
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// STAV HRY
// =====================================================================
const state = {
  room: null,     // aktuální místnost (objekt z ROOMS)
  solids: [],     // pevné obdélníky, kterými nelze projít
  transition: null, // probíhající přechod: { door, t, switched }
  titleTimer: 0,    // zbývající doba zvýraznění názvu místnosti
  teachers: [],     // učitelé v aktuální místnosti
  quests: {},       // stav úkolů podle id: 'none' (nezadán) | 'assigned' (hledá se) | 'carrying' (nese se) | 'done'
  tracked: null,    // id úkolu, který se naposledy posunul (ukazuje se nahoře na liště)
  catalog: null,    // otevřený katalog úkolů { sel }
  map: null,        // otevřená mapa školy {}
  money: 0,           // peníze v Kč (za ně se nakupuje v bufetu)
  bag: [],            // co si hráč koupil (názvy)
  shopSel: 0,         // vybraná řádka na tabuli v bufetu
  dialog: null,     // otevřený dialog: { name, color, text }
  pendingMinigame: null, // minihra, která se spustí po zavření dialogu
  pendingSongs: null,    // písničky na výběr po zavření dialogu (Myky)
  songMenu: null,        // otevřený výběr písničky { sel, songs }
  musicMenu: null,       // otevřený seznam hudby na pozadí { sel } (P / tlačítko s hudbou)
  basket: null,     // stav minihry hod na koš (obrazovka 'basket')
  toast: null,      // krátká hláška: { text, t }
  effects: [],      // efekty sebrání: { x, y, t, color }
  time: 0,          // herní čas pro animace (s)
  screen: 'title',  // 'title' (úvod) | 'playing' (hra) | 'basket' / 'chess' / 'foosball' / 'pingpong' (minihry) | 'end' (závěr)
  chess: null,      // stav šachů (obrazovka 'chess')
  foos: null,       // stav fotbálku (obrazovka 'foosball')
  savedGame: null,  // uložený postup nabízený na úvodní obrazovce
  confetti: [],     // částice konfet na závěrečné obrazovce
  endTime: 0,       // jak dlouho je zobrazená závěrečná obrazovka (s)
  player: {
    x: 0, y: 0,   // levý horní roh
    w: CONFIG.PLAYER_SIZE,
    h: CONFIG.PLAYER_SIZE,
    speed: CONFIG.PLAYER_SPEED,
    color: CONFIG.PLAYER_COLOR,
    walkPhase: 0,   // fáze kroku (pro kolébání a střídání nohou)
    walkBlend: 0,   // 0 = stojí, 1 = jde (plynulý přechod)
  },
};

// Načte místnost a postaví hráče na místo spawn (bez něj doprostřed)
function enterRoom(roomId, spawn) {
  const room = ROOMS[roomId];
  state.room = room;
  state.teachers = Object.values(TEACHERS).filter((t) => t.room === roomId && t.rect);
  // stojící učitelé jsou pevní stejně jako zdi – hráč jimi neprojde (pohyblivý ne)
  state.solids = roomWalls(room)
    .concat(room.obstacles.map((o) => o.rect))
    .concat(state.teachers.filter((t) => !t.route && !t.companion).map((t) => t.rect));   // společník (Terka) chodí – není pevný
  // bez spawn: room.start (střed hráče, px od rohu místnosti), jinak střed místnosti
  const start = room.start || { x: room.w / 2, y: room.h / 2 };
  state.player.x = spawn ? spawn.x : room.x + start.x - state.player.w / 2;
  state.player.y = spawn ? spawn.y : room.y + start.y - state.player.h / 2;
  state.titleTimer = CONFIG.TITLE_HIGHLIGHT_TIME;
  state.areaName = currentAreaName(room);
  state.frontEnter = null;
  state.frontWantEnter = false;
}

// =====================================================================
// VSTUPY – klávesnice + dotykový joystick
// =====================================================================
const input = {
  keys: new Set(),   // stisknuté klávesy (KeyboardEvent.code)
  joy: {
    active: false,
    pointerId: null,
    baseX: 0, baseY: 0,  // střed základny (CSS px obrazovky)
    dx: 0, dy: 0,        // výchylka -1..1
  },
};

// e.code = fyzická klávesa, takže WASD funguje i na české klávesnici
const KEYMAP = {
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
};
const GAME_KEYS = new Set(Object.values(KEYMAP).flat());

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault(); // šipky nescrollují stránku
  input.keys.add(e.code);
  // katalog úkolů: Q / Tab otevře a zavře, Esc zavře, šipky posouvají výběr
  // seznam hudby na pozadí: P otevře a zavře (ve hře i na úvodu), Esc zavře, šipky posouvají
  if ((state.screen === 'playing' || state.screen === 'title') && !e.repeat) {
    if (CONFIG.MUSIC_MENU_KEYS.includes(e.code)) toggleMusicMenu();
    // výběr alba: podle písmene Z (na české klávesnici je Z tam, kde je na anglické Y)
    else if ((e.key || '').toLowerCase() === 'z' || (!e.key && CONFIG.MUSIC_ALBUM_KEYS.includes(e.code))) toggleMusicMenu(true);
    else if (state.musicMenu && e.code === 'Escape') state.musicMenu = null;
    else if (state.musicMenu && KEYMAP.up.includes(e.code)) musicMenuMove(-1);
    else if (state.musicMenu && KEYMAP.down.includes(e.code)) musicMenuMove(1);
  }
  if (state.screen === 'playing' && !e.repeat && !state.musicMenu) {
    if (CONFIG.CATALOG_KEYS.includes(e.code)) { e.preventDefault(); toggleCatalog(); }
    else if (CONFIG.MAP_KEYS.includes(e.code)) toggleMap();
    else if (state.map && e.code === 'Escape') toggleMap();
    else if (state.songMenu && e.code === 'Escape') state.songMenu = null;
    else if (state.songMenu && KEYMAP.up.includes(e.code)) songMenuMove(-1);
    else if (state.songMenu && KEYMAP.down.includes(e.code)) songMenuMove(1);
    else if (state.catalog && e.code === 'Escape') toggleCatalog();
    else if (state.catalog && KEYMAP.up.includes(e.code)) catalogMove(-1);
    else if (state.catalog && KEYMAP.down.includes(e.code)) catalogMove(1);
  }
  // šachy: šipky (i držené) a Esc jdou do fronty kláves šachovnice
  if (state.screen === 'chess' && state.chess && (!e.repeat || GAME_KEYS.has(e.code))) state.chess.keys.push(e.code);
  // fotbálek: kop a menu přes frontu kláves (posun tyčí se čte z držených kláves)
  if (state.screen === 'foosball' && state.foos && !e.repeat) state.foos.keys.push(e.code);
  // před školou: stisk šipky nahoru = vejít do brány (i krátké ťuknutí na klávesu)
  if (KEYMAP.up.includes(e.code) && !e.repeat && state.room && state.room.front && !state.room.shop) state.frontWantEnter = true;
  // bufet: šipky vybírají na tabuli, Esc odejde
  if (state.screen === 'playing' && state.room && state.room.shop && !state.transition) {
    if (KEYMAP.up.includes(e.code)) shopMove(-1);
    if (KEYMAP.down.includes(e.code)) shopMove(1);
    if (e.code === 'Escape') shopLeave();
  }
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
// Když okno ztratí fokus, keyup nepřijde – pustíme všechno, ať hráč neujíždí
window.addEventListener('blur', () => { input.keys.clear(); joyRelease(); });

function isDown(action) {
  return KEYMAP[action].some((code) => input.keys.has(code));
}

// --- Joystick ---
const joyBaseEl = document.getElementById('joyBase');
const joyKnobEl = document.getElementById('joyKnob');
joyBaseEl.style.width = joyBaseEl.style.height = CONFIG.JOY_RADIUS * 2 + 'px';
joyKnobEl.style.width = joyKnobEl.style.height = CONFIG.JOY_KNOB_RADIUS * 2 + 'px';

function joyShow(show) {
  joyBaseEl.style.display = joyKnobEl.style.display = show ? 'block' : 'none';
}
function joyPlace(el, x, y) {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}
function joyRelease() {
  const j = input.joy;
  j.active = false;
  j.pointerId = null;
  j.dx = j.dy = 0;
  joyShow(false);
}

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;      // joystick jen pro dotyk
  if (state.screen !== 'playing' && state.screen !== 'horor') return;     // v minihrách a menu se ťuká, nechodí (horor: 39_horor.js)
  const j = input.joy;
  if (j.active) return;                        // už jeden prst joystick drží
  if (e.clientX > window.innerWidth * CONFIG.JOY_ZONE_WIDTH) return; // pravá část volná pro budoucí tlačítka
  j.active = true;
  j.pointerId = e.pointerId;
  j.baseX = e.clientX;                         // joystick se objeví pod prstem
  j.baseY = e.clientY;
  j.dx = j.dy = 0;
  joyPlace(joyBaseEl, j.baseX, j.baseY);
  joyPlace(joyKnobEl, j.baseX, j.baseY);
  joyShow(true);
  e.preventDefault();
});

window.addEventListener('pointermove', (e) => {
  const j = input.joy;
  if (!j.active || e.pointerId !== j.pointerId) return;
  let ox = e.clientX - j.baseX;
  let oy = e.clientY - j.baseY;
  const dist = Math.hypot(ox, oy);
  const r = CONFIG.JOY_RADIUS;
  if (dist > r) { ox = ox / dist * r; oy = oy / dist * r; } // knoflík nevyjede ze základny
  j.dx = ox / r;
  j.dy = oy / r;
  joyPlace(joyKnobEl, j.baseX + ox, j.baseY + oy);
  e.preventDefault();
});

function onPointerEnd(e) {
  if (e.pointerId === input.joy.pointerId) joyRelease();
}
window.addEventListener('pointerup', onPointerEnd);
window.addEventListener('pointercancel', onPointerEnd);

// Pojistky proti scrollu a zoomu (hlavně iOS Safari, který ignoruje user-scalable=no)
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Akce: mluvení, sbírání, zavírání dialogu ---
// Události se jen zařadí do fronty a zpracují se v update().
input.events = [];  // { type: 'action' } | { type: 'tap', x, y, touch, inJoyZone }
input.lastDevice = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard'; // kvůli textu nápovědy

window.addEventListener('keydown', (e) => {
  input.lastDevice = 'keyboard';
  if (!CONFIG.ACTION_KEYS.includes(e.code)) return;
  e.preventDefault();
  if (!e.repeat) input.events.push({ type: 'action' }); // držení klávesy se nepočítá jako další stisky
});

window.addEventListener('pointerdown', (e) => {
  const touch = e.pointerType !== 'mouse';
  if (!touch && e.button !== 0) return;  // jen levé tlačítko myši
  input.lastDevice = touch ? 'touch' : 'keyboard';
  const g = screenToGame(e.clientX, e.clientY);
  input.events.push({
    type: 'tap',
    x: g ? g.x : null,
    y: g ? g.y : null,
    touch,
    // dotyk v levé části ovládá joystick, takže nemá spouštět rozhovor „naslepo“
    inJoyZone: touch && e.clientX <= window.innerWidth * CONFIG.JOY_ZONE_WIDTH,
  });
});

// Držení prstu/myši (minihra: síla hodu). Ťuknutí na tlačítko zvuku se nepočítá.
input.pointerHeld = false;
window.addEventListener('pointerdown', (e) => {
  const g = screenToGame(e.clientX, e.clientY);
  if (g && pointInRect(g.x, g.y, CONFIG.MUTE_BUTTON, 4)) return;
  input.pointerHeld = true;
});
window.addEventListener('pointerup', () => { input.pointerHeld = false; });
window.addEventListener('pointercancel', () => { input.pointerHeld = false; });

// Mobil: při prvním dotyku přes celou obrazovku a na šířku (Android; iPhone to neumí – nevadí)
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || document.fullscreenElement) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  } catch (err) { /* bez celé obrazovky */ }
}, { once: false });

// Převod souřadnic obrazovky na herní (800x600); mimo plátno vrací null
function screenToGame(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) / r.width * VIEW.w - VIEW.offX;   // souřadnice rozhraní (800 px uprostřed; na mobilu i vlevo/vpravo mimo)
  const y = (clientY - r.top) / r.height * CONFIG.HEIGHT;
  if (x < -VIEW.offX || y < 0 || x > CONFIG.WIDTH + VIEW.offX || y > CONFIG.HEIGHT) return null;
  return { x, y };
}

// Výsledný směr pohybu: vektor o délce 0..1
function getMoveVector() {
  // Joystick má přednost (umí i pomalejší pohyb podle výchylky)
  const j = input.joy;
  if (j.active) {
    const len = Math.hypot(j.dx, j.dy);
    if (len < CONFIG.JOY_DEADZONE) return { x: 0, y: 0 };
    const k = Math.min(len, 1) / len;
    return { x: j.dx * k, y: j.dy * k };
  }
  let x = 0, y = 0;
  if (isDown('left'))  x -= 1;
  if (isDown('right')) x += 1;
  if (isDown('up'))    y -= 1;
  if (isDown('down'))  y += 1;
  const len = Math.hypot(x, y);
  if (len > 0) { x /= len; y /= len; } // diagonála není rychlejší
  return { x, y };
}
