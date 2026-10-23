// Multiplayer: hráči z různých zařízení se vidí ve stejné místnosti
// Část hry Dárek – načítá se v index.html před 15_hlavni.js.
'use strict';

// =====================================================================
// MULTIPLAYER – 1. krok: kdo má na úvodu zapnuté „Online“, vidí ostatní online
// hráče, když jsou ve stejné místnosti (postavička se jménem nad hlavou).
// Každý dál hraje svou hru – úkoly, peníze a věci zůstávají jeho, sdílí se jen,
// kde kdo stojí a co dělá (šachy, fotbálek, koš, rozhovor).
// Firebase Realtime Database přes REST, bez knihoven: vlastní poloha se posílá
// PUTem do hraci/<id>, změny ostatních chodí proudem (EventSource).
// Dokud není vyplněné DB_URL, tlačítko Online se ve hře neukáže.
// Na zkoušení jde adresa přepsat v adrese stránky: index.html?mpdb=http://localhost:8001
// =====================================================================
const MP = {
  DB_URL: 'https://darek-online-default-rtdb.europe-west1.firebasedatabase.app',   // Firebase konzole → Realtime Database → adresa nahoře (https://…firebasedatabase.app)
  PATH: 'hraci',
  ON_KEY: 'hra_darek_online_v1',
  SEND_EVERY: 0.15,   // s – nejčastěji takhle se posílá vlastní poloha
  HEARTBEAT: 3,       // s – i když hráč stojí, ať ho ostatní nepovažují za odpojeného
  STALE: 12000,       // ms – kdo se tak dlouho neozval, není vidět (zavřený mobil, spadlé spojení)
  PURGE: 120000,      // ms – takhle staré záznamy se z databáze smažou
  LERP: 12,           // jak rychle cizí postavička dojede na poslední známou polohu
  COLORS: ['#8e2424', '#1f6b3a', '#6a2c8c', '#a65e12', '#0f6c7a', '#7a6a12', '#8c2c63', '#3b4a8c'],   // vesty ostatních
  ACTIVITY: { sachy: '♟', fotbalek: '⚽', kos: '🏀', pingpong: '🏓', satna: '👕', mluvi: '💬', obchod: '🛒' },
  BUTTON: { x: 8, y: 38, w: 170, h: 26 },   // na úvodu pod hudbou
  NAME_BUTTON: { x: 8, y: 66, w: 170, h: 26 },   // pod ním jméno (pod ním Kvalita, 30_kvalita.js)
  BADGE: { x: 600, y: 86, w: 190, h: 18 },  // ve hře pod energií (pod časovačem speedrunu)
  // Smajlíky (2. krok): bublina nad hlavou na EMOTE_TIME s, vidí ji všichni ve stejné místnosti
  EMOTES: ['👋', '😂', '👍', '😮', '❤️', '💀', '😡', '😎', '🤔', '🔥'],
  EMOTE_TIME: 3,
  EMOTE_KEYS: ['KeyT'],
  EMOTE_BUTTON: { x: 556, y: 6, w: 34, h: 30 },      // ve hře vlevo od ☰ (jen když je Online)
  EMOTE_PANEL: { x: 440, y: 404, w: 350, h: 150 },   // vpravo dole – levá půlka mobilu patří joysticku
};
{
  const db = new URLSearchParams(location.search).get('mpdb');
  if (db) MP.DB_URL = db;
}
const mpReady = () => /^https?:\/\//.test(MP.DB_URL);
const mpUrl = (sub) => `${MP.DB_URL.replace(/\/+$/, '')}/${MP.PATH}${sub ? '/' + sub : ''}.json`;

const mp = {
  on: false,
  id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),   // jedno otevření hry = jeden hráč
  name: '',
  es: null,          // EventSource (proud změn z databáze)
  raw: {},           // kopie větve hraci/ z databáze
  others: {},        // id → { n, r, x, y, a, t, dx, dy (kreslená poloha), phase, blend, color }
  offset: null,      // čas serveru − místní čas (z vlastního záznamu, který se vrátí proudem)
  status: '',        // '' | 'connecting' | 'ok' | 'error'
  sendT: 0, beatT: 0, purgeT: 5, last: '', sending: false,
  emote: null,       // můj smajlík { i, k, t } (t = kdy, herní čas)
  emoteSeq: 0,       // pořadí smajlíku – ostatní poznají nový, i když je stejný
};
state.emotePick = false;   // otevřený výběr smajlíků
mp.name = cleanPlayerName(storageGet(SPEEDRUN.NAME_KEY) || '');   // stejné jméno jako do žebříčku
mp.on = mpReady() && !!mp.name && storageGet(MP.ON_KEY) === '1';

// --- Zapnutí a vypnutí (tlačítko na úvodu) ---
function setOnline(on) {
  if (on && !mp.name) {   // jméno se ptá jednou, pamatuje se (i pro žebříček)
    const name = cleanPlayerName(window.prompt(`Tvoje jméno pro ostatní hráče (max ${SPEEDRUN.NAME_MAX} znaků):`, ''));
    if (!name) return;
    mp.name = name;
    storageSet(SPEEDRUN.NAME_KEY, name);
  }
  mp.on = on;
  storageSet(MP.ON_KEY, on ? '1' : '0');
  if (on) mpConnect();
  else mpDisconnect();
}

function mpConnect() {
  if (mp.es || !mpReady() || typeof EventSource === 'undefined') return;
  mp.status = 'connecting';
  mp.raw = {};
  const es = mp.es = new EventSource(mpUrl());
  const handle = (patch) => (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg.path !== 'string') return;
    mp.status = 'ok';
    const parts = msg.path.split('/').filter(Boolean);
    if (patch) for (const [k, v] of Object.entries(msg.data || {})) mpSetAt(parts.concat(k), v);
    else mpSetAt(parts, msg.data);
    mpSync();
  };
  es.addEventListener('put', handle(false));
  es.addEventListener('patch', handle(true));
  es.addEventListener('cancel', () => { mp.status = 'error'; });   // pravidla databáze čtení nedovolí
  es.onerror = () => { mp.status = 'error'; };                      // EventSource se sám znovu připojí
  mp.last = '';   // hned poslat vlastní polohu
}

function mpDisconnect() {
  if (mp.es) mp.es.close();
  mp.es = null;
  mp.raw = {};
  mp.others = {};
  mp.status = '';
  mpRemoveMe();
}

// Změna v kopii databáze podle cesty z proudu ('/', '/<id>', '/<id>/x' …)
function mpSetAt(parts, value) {
  if (!parts.length) { mp.raw = value && typeof value === 'object' ? value : {}; return; }
  let o = mp.raw;
  for (const k of parts.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  const last = parts[parts.length - 1];
  if (value === null) delete o[last];
  else o[last] = value;
}

// Z kopie databáze udělá seznam ostatních hráčů (kreslená poloha zůstane, ať neskáčou)
function mpSync() {
  const mine = mp.raw[mp.id];
  if (mine && Number.isFinite(mine.t) && mp.offset === null) mp.offset = mine.t - Date.now();
  const next = {};
  for (const [id, v] of Object.entries(mp.raw)) {
    if (id === mp.id || !v || typeof v !== 'object') continue;
    if (typeof v.r !== 'string' || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.t)) continue;
    const o = mp.others[id] || { dx: v.x, dy: v.y, phase: 0, blend: 0, color: mpColor(id) };
    if (o.r !== v.r) { o.dx = v.x; o.dy = v.y; }   // přešel do jiné místnosti: neklouzat přes celou mapu
    Object.assign(o, { id, v: v.v === 1, n: cleanPlayerName(v.n) || '?', r: v.r, x: v.x, y: v.y, a: typeof v.a === 'string' ? v.a : '', s: typeof v.s === 'string' ? v.s : '', z: typeof v.z === 'string' ? v.z : '', t: v.t });
    if (Number.isInteger(v.e) && MP.EMOTES[v.e] && v.ek !== o.ek) { o.ek = v.ek; o.emote = MP.EMOTES[v.e]; o.emoteT = state.time; }   // nový smajlík
    next[id] = o;
  }
  mp.others = next;
}

function mpColor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MP.COLORS[h % MP.COLORS.length];
}

const mpServerNow = () => Date.now() + (mp.offset || 0);
const mpAlive = (o) => mp.offset !== null && mpServerNow() - o.t < MP.STALE;
const mpOnlineCount = () => Object.values(mp.others).filter(mpAlive).length;
function mpHere() {   // ostatní ve stejné místnosti jako hráč
  if (!state.room) return [];
  return Object.values(mp.others).filter((o) => o.r === state.room.id && mpAlive(o));
}

// --- Odesílání vlastní polohy ---
function mpActivity() {
  if (state.screen === 'chess') return 'sachy';
  if (state.screen === 'foosball') return 'fotbalek';
  if (state.screen === 'basket') return 'kos';
  if (state.screen === 'pingpong') return 'pingpong';
  if (state.screen === 'skins') return 'satna';
  if (state.room && state.room.shop) return 'obchod';
  if (state.dialog || state.scene) return 'mluvi';
  return '';
}
function mpMyRecord() {
  const room = state.room, p = state.player;
  const rec = { n: mp.name, r: room.id, x: Math.round(p.x - room.x), y: Math.round(p.y - room.y) };
  const a = mpActivity();
  if (a) rec.a = a;
  if (mp.emote && state.time - mp.emote.t < MP.EMOTE_TIME) { rec.e = mp.emote.i; rec.ek = mp.emote.k; }
  if (mySkin !== SKINS[0]) rec.s = mySkin.id;   // skin z Lockeru (33_skiny.js)
  if (voice.on) rec.v = 1;   // má zapnutý hlas (34_hlas.js)
  const z = duelZ();
  if (z) rec.z = z;          // výzva / zápas v pingpong nebo fotbálek (35_online_hry.js)
  return rec;
}
function mpSend(rec) {
  mp.sending = true;
  fetch(mpUrl(mp.id), { method: 'PUT', body: JSON.stringify({ ...rec, t: { '.sv': 'timestamp' } }) })
    .then((r) => {
      if (rec.z && (r.status === 401 || r.status === 403)) duelBlocked();   // databáze bez nových pravidel odmítne pole z (35_online_hry.js)
      if (!r.ok) throw new Error(r.status);
    })
    .catch(() => { mp.status = 'error'; mp.last = ''; })
    .finally(() => { mp.sending = false; });
}
function mpRemoveMe() {
  if (!mpReady() || !mp.last) return;
  mp.last = '';
  try { fetch(mpUrl(mp.id), { method: 'DELETE', keepalive: true }).catch(() => {}); } catch (e) { /* nevadí */ }
}
// zavřená stránka: hned zmizet (jinak zmizí až po MP.STALE)
window.addEventListener('pagehide', () => { if (mp.on) mpRemoveMe(); });

// Volá se v každém kroku hry (15_hlavni.js)
function updateMultiplayer(dt) {
  if (!mp.on || !mpReady()) return;
  if (!mp.es) mpConnect();
  const inGame = state.room && ['playing', 'chess', 'foosball', 'basket', 'pingpong', 'skins'].includes(state.screen);
  mp.sendT -= dt;
  mp.beatT -= dt;
  if (inGame) {
    const rec = mpMyRecord(), key = JSON.stringify(rec);
    if (!mp.sending && mp.sendT <= 0 && (key !== mp.last || mp.beatT <= 0)) {
      mp.sendT = MP.SEND_EVERY;
      mp.beatT = MP.HEARTBEAT;
      mp.last = key;
      mpSend(rec);
    }
  } else if (mp.last && !mp.sending) mpRemoveMe();   // úvod nebo závěr: ve škole nikdo není

  // ostatní plynule dojedou na poslední polohu a u toho jdou (nohy, ruce)
  const k = 1 - Math.exp(-MP.LERP * dt);
  for (const o of Object.values(mp.others)) {
    const ddx = o.x - o.dx, ddy = o.y - o.dy, dist = Math.hypot(ddx, ddy);
    if (dist > 300) { o.dx = o.x; o.dy = o.y; }
    else { o.dx += ddx * k; o.dy += ddy * k; }
    const moving = dist > 1.5;
    o.blend += ((moving ? 1 : 0) - o.blend) * Math.min(1, dt * 10);
    if (moving) o.phase += dt * CONFIG.PLAYER_STEP_SPEED;
    else if (o.blend < 0.02) o.phase = 0;
  }

  // staré záznamy (spadlý prohlížeč bez pagehide) uklidí kdokoli, kdo je online
  mp.purgeT -= dt;
  if (mp.purgeT <= 0 && mp.offset !== null) {
    mp.purgeT = 30;
    for (const [id, v] of Object.entries(mp.raw)) {
      if (id !== mp.id && v && (!Number.isFinite(v.t) || mpServerNow() - v.t > MP.PURGE)) {
        fetch(mpUrl(id), { method: 'DELETE' }).catch(() => {});
      }
    }
  }
}

// --- Kreslení ---
// Ostatní hráči ve stejné místnosti (renderGame, před vlastním hráčem)
function drawRemotePlayers() {
  if (!mp.on || state.room.front) return;
  const room = state.room, s = CONFIG.PLAYER_SIZE;
  for (const o of mpHere().sort((a, b) => a.dy - b.dy)) {
    const x = Math.round(room.x + o.dx), y = Math.round(room.y + o.dy);
    if (!inView({ x, y, w: s, h: s }, 80)) continue;   // mimo záběr (30_kvalita.js)
    drawCharacterShadow({ x, y, w: s, h: s });
    const skin = o.s && skinById(o.s);   // vlastní skin z Lockeru, jinak Roman s barevnou vestou
    drawFigure(x + s / 2, y + s, o.phase, o.blend, skin ? skinLook(skin) : {
      face: playerFaceImg, fallback: CONFIG.PLAYER_COLOR,
      body: o.color, check: 'rgba(255, 255, 255, 0.12)',
      collar: CONFIG.PLAYER_SHIRT, arms: CONFIG.PLAYER_SHIRT,
      pants: CONFIG.PLAYER_PANTS, shoes: CONFIG.PLAYER_SHOES,
    });
    // jméno (a co zrovna dělá) nad hlavou
    const label = voiceLabel(o.id) + (MP.ACTIVITY[o.a] ? MP.ACTIVITY[o.a] + ' ' : '') + o.n;   // 🔊 mluví / 🔇 ztlumený (34_hlas.js)
    ctx.font = 'bold 12px sans-serif';
    const w = Math.min(150, ctx.measureText(label).width + 12), lx = x + s / 2, ly = y + s - 80;
    roundRectPath(lx - w / 2, ly - 9, w, 18, 9);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly + 1, w - 8);
    if (o.emote) drawEmoteBubble(o.emote, lx, ly - 12, state.time - o.emoteT);
  }
  // můj smajlík nad mou hlavou (ať vidím, co jsem poslal)
  const me = mp.emote, p = state.player;
  if (me && !vrahHidden()) drawEmoteBubble(MP.EMOTES[me.i], Math.round(p.x + p.w / 2), Math.round(p.y + p.h) - 82, state.time - me.t);
}

// Bublina se smajlíkem: vyskočí, chvíli drží a zmizí (age = kolik s je stará)
function drawEmoteBubble(emoji, x, bottomY, age) {
  if (age < 0 || age > MP.EMOTE_TIME) return;
  const pop = Math.min(1, age / 0.15), fade = Math.min(1, (MP.EMOTE_TIME - age) / 0.4);
  const s = 0.6 + 0.4 * pop + (age < 0.3 ? Math.sin(age / 0.3 * Math.PI) * 0.15 : 0);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, bottomY);
  ctx.scale(s, s);
  roundRectPath(-21, -44, 42, 38, 12);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(0, 0); ctx.lineTo(6, -7); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.fillText(emoji, 0, -24);
  ctx.restore();
}

// --- Výběr smajlíků (tlačítko vlevo od ☰ nebo T, čísla 1–0 pošlou rovnou) ---
const emoteButtonShown = () => mp.on && state.screen === 'playing' && !state.pauseMenu;
const emoteCells = () => MP.EMOTES.map((_, i) => {
  const P = MP.EMOTE_PANEL, cw = (P.w - 20) / 5, ch = (P.h - 34) / 2;
  return { x: P.x + 10 + (i % 5) * cw, y: P.y + 26 + Math.floor(i / 5) * ch, w: cw - 6, h: ch - 6 };
});
function sendEmote(i) {
  mp.emote = { i, k: ++mp.emoteSeq, t: state.time };
  mp.sendT = 0; mp.last = '';   // poslat hned
  state.emotePick = false;
  playSound([[880, 0, 0.04], [1175, 0.05, 0.05]]);
}
function takeEmoteTaps() {
  if (!emoteButtonShown()) { state.emotePick = false; return; }
  input.events = input.events.filter((ev) => {
    if (ev.type !== 'tap' || ev.x === null) return true;
    if (pointInRect(ev.x, ev.y, MP.EMOTE_BUTTON, 4)) { state.emotePick = !state.emotePick; return false; }
    if (!state.emotePick) return true;
    const i = emoteCells().findIndex((c) => pointInRect(ev.x, ev.y, c, 2));
    if (i >= 0) { sendEmote(i); return false; }
    if (pointInRect(ev.x, ev.y, MP.EMOTE_PANEL, 0)) return false;
    state.emotePick = false;   // ťuknutí mimo zavře (a jde dál do hry)
    return true;
  });
}
window.addEventListener('keydown', (e) => {
  if (!emoteButtonShown() || e.repeat || state.dialog || state.catalog || state.map || state.inventory || state.musicMenu || state.board) return;
  if (MP.EMOTE_KEYS.includes(e.code)) { state.emotePick = !state.emotePick; return; }
  if (!state.emotePick) return;
  const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (d) { sendEmote((Number(d[1]) + 9) % 10); return; }   // 1 = první … 0 = desátý
  if (e.code === 'Escape') { state.emotePick = false; e.stopImmediatePropagation(); }   // ať se neotevře menu ☰
}, true);
function drawEmoteUi() {
  if (!emoteButtonShown()) return;
  const b = MP.EMOTE_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = state.emotePick ? 'rgba(255, 213, 74, 0.9)' : 'rgba(0, 0, 0, 0.45)'; ctx.fill();
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.fillText('😊', b.x + b.w / 2, b.y + b.h / 2 + 1);
  if (!state.emotePick) return;
  const P = MP.EMOTE_PANEL;
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = 'rgba(20, 22, 34, 0.9)'; ctx.fill();
  ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#e8d3a8';
  ctx.fillText(isTouchHint() ? 'Ťukni na smajlík – uvidí ho všichni tady' : 'Klikni nebo zmáčkni 1–0 · T / Esc = zavřít', P.x + P.w / 2, P.y + 14);
  emoteCells().forEach((c, i) => {
    roundRectPath(c.x, c.y, c.w, c.h, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fill();
    ctx.font = '30px sans-serif'; ctx.fillStyle = '#000000';
    ctx.fillText(MP.EMOTES[i], c.x + c.w / 2, c.y + c.h / 2 + 2);
    if (!isTouchHint()) { ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e8d3a8'; ctx.fillText(String((i + 1) % 10), c.x + 8, c.y + 9); }
  });
}

// Ve hře: kolik hráčů je online (pod energií, se speedrunem pod časovačem)
function drawOnlineBadge() {
  if (!mp.on || state.screen !== 'playing') return;
  const b = MP.BADGE, y = b.y + (state.speedrun ? 26 : 0);
  roundRectPath(b.x, y, b.w, b.h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fill();
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = mp.status === 'error' ? '#ff8a80' : '#ffffff';
  const n = mpOnlineCount(), here = mpHere().length;
  const text = mp.status === 'error' ? '👥 Online: bez spojení'
    : mp.status !== 'ok' ? '👥 Online: připojuji…'
    : n ? `👥 Online: ${n + 1} ${n + 1 < 5 ? 'hráči' : 'hráčů'}${here ? ` (${here} tady)` : ''}` : '👥 Online: jsi tu sám';
  ctx.fillText(text, b.x + 6, y + b.h / 2 + 1, b.w - 10);
}

// --- Tlačítka Online a jméno na úvodu (vlevo nahoře pod hudbou) ---
const titleControlsActive = () => state.screen === 'title' && !state.modePick && !state.spawnPick && !state.lb && !state.musicMenu;   // i Kvalita (30_kvalita.js)
const onlineButtonShown = () => mpReady() && titleControlsActive();
function changePlayerName() {
  const name = cleanPlayerName(window.prompt(`Tvoje jméno (max ${SPEEDRUN.NAME_MAX} znaků – uvidí ho ostatní hráči i žebříček):`, mp.name));
  if (!name) return;
  mp.name = name;
  storageSet(SPEEDRUN.NAME_KEY, name);
}
function takeOnlineTaps() {
  if (!titleControlsActive()) return;
  input.events = input.events.filter((ev) => {
    if (ev.type !== 'tap' || ev.x === null) return true;
    if (onlineButtonShown() && pointInRect(ev.x, ev.y, MP.BUTTON, 4)) { setOnline(!mp.on); playSound([[660, 0, 0.05]]); return false; }
    if (pointInRect(ev.x, ev.y, MP.NAME_BUTTON, 4)) { changePlayerName(); return false; }
    return true;
  });
}
function drawOnlineButton() {
  if (!titleControlsActive()) return;
  const nb = MP.NAME_BUTTON;
  roundRectPath(nb.x, nb.y, nb.w, nb.h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; ctx.fill();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.fillText(mp.name ? `👤 ${mp.name}` : '👤 Nastavit jméno', nb.x + 8, nb.y + nb.h / 2 + 1, nb.w - 14);
  if (!onlineButtonShown()) return;
  const b = MP.BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = mp.on ? 'rgba(46, 125, 50, 0.85)' : 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const n = mpOnlineCount();
  const text = !mp.on ? '👥 Online: VYP' : `👥 Online: ZAP${n ? ` (${n} ve hře)` : ''}`;
  ctx.fillText(text, b.x + 8, b.y + b.h / 2 + 1, b.w - 14);
}

if (mp.on) mpConnect();
