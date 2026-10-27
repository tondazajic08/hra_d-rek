// Účty (přihlášení, postup na serveru), peníze za výhry v módech a vylepšení do hororu
// Část hry Dárek – načítá se v index.html po 40_horor_online.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// 1) PENÍZE MIMO HLAVNÍ HRU – odměny z módů jdou do peněz hlavní hry (uložení CONFIG.SAVE_KEY):
//    výhra v hororu 250 Kč, Vrah z C109 50 Kč, Among Us 25 Kč. Z nich se kupují vylepšení do hororu.
//    Peníze můžou být i v mínusu (záchod, 17_pribehy.js).
// 2) VYLEPŠENÍ DO HORORU (úvod hororu → ⭐ Vylepšení): rychlost, výdrž, baterka, světlo, tichý krok,
//    náhradní baterka na start. Uložené v HOROR_UP_KEY (s účtem i na serveru).
// 3) ÚČTY: hrát se dá bez účtu (jako dřív), nebo si na úvodu (tlačítko 👤) založit účet / přihlásit se.
//    Přihlášenému se postup (hlavní hra, Vrah, skin, start, rekordy, vylepšení) ukládá na server a po
//    přihlášení na jiném zařízení se načte. Databáze (stejná jako online): jmena/<jméno> = { t } (obsazená
//    jména), ucty/<jméno>/<klíč> = { d: JSON uložení, t }, kde klíč = SHA-256 ze jména a hesla – bez hesla
//    se k uložení nedá dostat (pravidla nedovolí vypsat ucty/<jméno>). Je to jednoduché, ne jako v bance:
//    heslo nepoužívej stejné jako jinde.
// =====================================================================
function mainMoneyGet() {
  if (!state.mode && state.screen === 'playing') return state.money;
  try { const d = JSON.parse(storageGet(CONFIG.SAVE_KEY) || 'null'); return d && Number.isFinite(d.money) ? d.money : 0; } catch (e) { return 0; }
}
function mainMoneyAdd(n) {
  if (!state.mode && state.screen === 'playing') { state.money += n; saveProgress(); return; }
  let d = null;
  try { d = JSON.parse(storageGet(CONFIG.SAVE_KEY) || 'null'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object') d = { quests: {}, tracked: null, money: 0, bag: [], story: null, vrah: null, speedrun: null };
  d.money = (Number.isFinite(d.money) ? d.money : 0) + n;
  storageSet(CONFIG.SAVE_KEY, JSON.stringify(d));
  state.savedGame = loadProgress();
  acctDirty();
}
// Nová hlavní hra si peníze nechá (vydělané v módech se neztratí)
{
  const _start = startPlaying;
  startPlaying = function (progress, mode = null, speedrun = false) {
    const keep = !progress && !mode ? mainMoneyGet() : null;
    _start(progress, mode, speedrun);
    if (keep !== null && keep !== 0) { state.money = keep; saveProgress(); }
  };
}

// --- Vylepšení do hororu ---
const HOROR_UP_KEY = 'hra_darek_horor_v1';
const HOROR_UPS = [
  { id: 'rychlost', icon: '🏃', name: 'Rychlejší nohy', text: '+8 % chůze i sprint', cost: [150, 300, 500] },
  { id: 'vydrz', icon: '💨', name: 'Stamina', text: '+1 s sprintu a rychlejší oddech', cost: [100, 180, 280, 400, 550] },
  { id: 'baterka', icon: '🔋', name: 'Výdrž baterky', text: 'baterka vydrží o 25 % déle', cost: [80, 150, 250, 380, 520] },
  { id: 'svetlo', icon: '💡', name: 'Silnější světlo', text: '+15 % dosvit', cost: [150, 320] },
  { id: 'tichost', icon: '🤫', name: 'Tichý krok', text: 'Láďa tě slyší o 25 % hůř', cost: [200, 400] },
  { id: 'nahradni', icon: '🎒', name: 'Náhradní baterka', text: 'na startu máš 1 navíc', cost: [300] },
];
function hororUps() {
  try { const d = JSON.parse(storageGet(HOROR_UP_KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; }
}
function hororUp(id) {
  const u = HOROR_UPS.find((q) => q.id === id), v = hororUps()[id] | 0;
  return u ? Math.max(0, Math.min(u.cost.length, v)) : 0;
}
function hororBuyUp(id) {
  const u = HOROR_UPS.find((q) => q.id === id), lv = hororUp(id);
  if (!u || lv >= u.cost.length) return 'Už máš nejvyšší úroveň.';
  const price = u.cost[lv], money = mainMoneyGet();
  if (money < price) return `Chybí ti ${price - money} Kč (máš ${money} Kč).`;
  mainMoneyAdd(-price);
  const d = hororUps();
  d[id] = lv + 1;
  storageSet(HOROR_UP_KEY, JSON.stringify(d));
  acctDirty();
  playSound([[523, 0, 0.06], [784, 0.07, 0.1]]);
  return `${u.icon} ${u.name} – úroveň ${lv + 1}!`;
}
const HOROR_SHOP_ROW = (i) => ({ x: 130, y: 128 + i * 56, w: 540, h: 50 });
const HOROR_SHOP_BACK = { x: 300, y: 474, w: 200, h: 44 };
function hororShopInput(H, keys, events) {
  const n = HOROR_UPS.length + 1;
  H.shopSel = H.shopSel || 0;
  for (const k of keys) {
    if (k === 'Escape') { H.phase = 'intro'; return; }
    if (KEYMAP.up.includes(k)) H.shopSel = (H.shopSel + n - 1) % n;
    if (KEYMAP.down.includes(k)) H.shopSel = (H.shopSel + 1) % n;
  }
  for (const e of events) {
    let i = -1;
    if (e.type === 'action') i = H.shopSel;
    else if (e.x != null) {
      if (pointInRect(e.x, e.y, HOROR_SHOP_BACK, 4)) i = HOROR_UPS.length;
      else i = HOROR_UPS.findIndex((_, k) => pointInRect(e.x, e.y, HOROR_SHOP_ROW(k), 2));
    }
    if (i < 0) continue;
    if (i === HOROR_UPS.length) { H.phase = 'intro'; return; }
    H.shopSel = i;
    H.shopMsg = hororBuyUp(HOROR_UPS[i].id); H.shopMsgT = 3;
  }
}
function drawHororShop(H) {
  const W = CONFIG.WIDTH;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, CONFIG.HEIGHT);
  drawOutlinedText('⭐ Vylepšení postavy', W / 2, 52, 'bold 32px sans-serif', '#ffd54a', 'middle');
  drawOutlinedText(`💰 ${mainMoneyGet()} Kč  ·  vyděláš ve hře, za výhru v hororu (250), ve Vrahovi (50) a v Among Us (25)`, W / 2, 92, 'bold 13px sans-serif', '#cfcfcf', 'middle', W - 40);
  HOROR_UPS.forEach((u, i) => {
    const r = HOROR_SHOP_ROW(i), lv = hororUp(u.id), max = lv >= u.cost.length, sel = i === H.shopSel;
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = sel ? 'rgba(255, 213, 74, 0.22)' : 'rgba(255, 255, 255, 0.07)'; ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(u.icon, r.x + 12, r.y + r.h / 2 + 1);
    ctx.font = 'bold 16px sans-serif'; ctx.fillText(u.name, r.x + 50, r.y + 17);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#cfcfcf'; ctx.fillText(u.text, r.x + 50, r.y + 36);
    for (let k = 0; k < u.cost.length; k++) {   // úrovně
      ctx.fillStyle = k < lv ? '#ffd54a' : 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath(); ctx.arc(r.x + 310 + k * 16, r.y + r.h / 2, 5.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'right'; ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = max ? '#7ee08a' : mainMoneyGet() >= u.cost[lv] ? '#ffd54a' : '#ff8a80';
    ctx.fillText(max ? 'MAX' : `${u.cost[lv]} Kč`, r.x + r.w - 14, r.y + r.h / 2 + 1);
  });
  drawChessButton(HOROR_SHOP_BACK, 'Zpět', H.shopSel === HOROR_UPS.length, '#5a4636');
  if (H.shopMsgT > 0) drawOutlinedText(H.shopMsg, W / 2, 545, 'bold 17px sans-serif', /Chybí|Už/.test(H.shopMsg) ? '#ff8a80' : '#7ee08a', 'middle');
}

// =====================================================================
// ÚČTY
// =====================================================================
const ACCT = { KEY: 'hra_darek_ucet_v1', SYNC: 'hra_darek_ucet_cas_v1', EVERY: 15, SKIP: ['hra_darek_jmeno_v1', 'hra_darek_online_v1', 'hra_darek_kvalita_v1', 'hra_darek_zvuk_vypnuty'] };
const acct = { user: null, dirty: false, sendT: 5, busy: false, msg: '', msgT: 0, panel: null, checked: false };
try { const u = JSON.parse(storageGet(ACCT.KEY) || 'null'); if (u && u.n && u.k && u.h) acct.user = u; } catch (e) { acct.user = null; }
function acctDirty() { acct.dirty = true; }
{
  const _save = saveProgress;
  saveProgress = function () { _save(); acctDirty(); };
}
const acctNameKey = (n) => n.toLowerCase().replace(/[.#$[\]/\s]/g, '_').slice(0, 24);
const acctUrl = (p) => `${MP.DB_URL.replace(/\/+$/, '')}/${p}.json`;
// SHA-256 (hex) – bez crypto.subtle, ať to jde i ze souboru na disku
function acctSha256(str) {
  const bytes = unescape(encodeURIComponent(str)), K = [];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0, c = 2; i < 64; c++) { let p = true; for (let d = 2; d * d <= c; d++) if (c % d === 0) { p = false; break; } if (p) K[i++] = (Math.pow(c, 1 / 3) % 1) * 4294967296 | 0; }
  const Hh = []; for (let i = 0, c = 2; i < 8; c++) { let p = true; for (let d = 2; d * d <= c; d++) if (c % d === 0) { p = false; break; } if (p) Hh[i++] = (Math.pow(c, 1 / 2) % 1) * 4294967296 | 0; }
  const l = bytes.length, words = [];
  for (let i = 0; i < l; i++) words[i >> 2] |= bytes.charCodeAt(i) << (24 - (i % 4) * 8);
  words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
  words[(((l + 8) >> 6) + 1) * 16 - 1] = l * 8;
  for (let j = 0; j < words.length; j += 16) {
    const w = [];
    let [a, b, c, d, e, f, g, h] = Hh;
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = words[j + i] | 0;
      else { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    Hh[0] = (Hh[0] + a) | 0; Hh[1] = (Hh[1] + b) | 0; Hh[2] = (Hh[2] + c) | 0; Hh[3] = (Hh[3] + d) | 0;
    Hh[4] = (Hh[4] + e) | 0; Hh[5] = (Hh[5] + f) | 0; Hh[6] = (Hh[6] + g) | 0; Hh[7] = (Hh[7] + h) | 0;
  }
  return Hh.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const acctHash = (key, pass) => acctSha256(`darek|${key}|${pass}`);
// Co se ukládá: všechno z localStorage hry kromě nastavení zařízení
function acctCollect() {
  const out = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('hra_darek') && k !== ACCT.KEY && k !== ACCT.SYNC && !ACCT.SKIP.includes(k)) out[k] = window.localStorage.getItem(k);
    }
  } catch (e) { /* bez úložiště */ }
  return out;
}
// Načíst postup z účtu do hry (přepíše postup na tomhle zařízení)
function acctApply(data) {
  let saves = {};
  try { saves = JSON.parse(data.d) || {}; } catch (e) { saves = {}; }
  for (const k of Object.keys(acctCollect())) if (!(k in saves)) storageRemove(k);
  for (const [k, v] of Object.entries(saves)) if (typeof v === 'string' && k.startsWith('hra_darek')) storageSet(k, v);
  storageSet(ACCT.SYNC, String(data.t || 0));
  state.savedGame = loadProgress();
  state.savedVrah = loadProgress(CONFIG.SAVE_KEY_VRAH);
  mySkin = skinById(storageGet(SKIN_KEY)) || SKINS[0];
  startPlace = START_PLACES.find((p) => p.id === storageGet(START_KEY)) || START_PLACES[0];
}
function acctUpload() {
  const u = acct.user;
  if (!u || acct.busy || !mpReady()) return;
  acct.busy = true; acct.dirty = false;
  fetch(acctUrl(`ucty/${u.k}/${u.h}`), { method: 'PUT', body: JSON.stringify({ d: JSON.stringify(acctCollect()), t: { '.sv': 'timestamp' } }) })
    .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(r.status); if (j && Number.isFinite(j.t)) storageSet(ACCT.SYNC, String(j.t)); }))
    .catch(() => { acct.dirty = true; acctNote('⚠ Postup se nepodařilo uložit na server (zkusím znovu).'); })
    .finally(() => { acct.busy = false; });
}
function acctNote(t) { acct.msg = t; acct.msgT = 5; }
// Po spuštění: když je na serveru novější postup (hrál jinde), načte se
function acctCheck() {
  const u = acct.user;
  acct.checked = true;
  if (!u || !mpReady()) return;
  fetch(acctUrl(`ucty/${u.k}/${u.h}`)).then((r) => r.json()).then((data) => {
    if (!data || typeof data.d !== 'string') { acctDirty(); return; }
    const local = parseFloat(storageGet(ACCT.SYNC)) || 0;
    if (data.t > local + 1000 && state.screen === 'title') { acctApply(data); acctNote(`☁ Načten postup z účtu ${u.n}`); }
    else acctDirty();
  }).catch(() => {});
}
function acctLogin(name, pass) {
  const key = acctNameKey(name), h = acctHash(key, pass);
  acctNote('Přihlašuji…');
  fetch(acctUrl(`ucty/${key}/${h}`)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
    if (!data || typeof data.d !== 'string') { acctNote('❌ Špatné jméno nebo heslo.'); return; }
    acct.user = { n: name, k: key, h };
    storageSet(ACCT.KEY, JSON.stringify(acct.user));
    acctApply(data);
    acctSetName(name);
    acct.panel = null;
    acctNote(`✅ Přihlášen jako ${name} – postup načten.`);
  }).catch(() => acctNote('❌ Nejde se připojit (nebo nejsou nastavená pravidla databáze).'));
}
function acctRegister(name, pass) {
  const key = acctNameKey(name), h = acctHash(key, pass);
  acctNote('Zakládám účet…');
  fetch(acctUrl(`jmena/${key}`)).then((r) => r.json()).then((taken) => {
    if (taken) { acctNote('❌ Tohle jméno už někdo má. Zkus jiné.'); return null; }
    return fetch(acctUrl(`jmena/${key}`), { method: 'PUT', body: JSON.stringify({ t: { '.sv': 'timestamp' } }) }).then((r) => {
      if (!r.ok) throw new Error(r.status);
      acct.user = { n: name, k: key, h };
      storageSet(ACCT.KEY, JSON.stringify(acct.user));
      acctSetName(name);
      acct.panel = null;
      acctUpload();   // současný postup se nahraje do účtu
      acctNote(`✅ Účet ${name} založen – postup se bude ukládat.`);
    });
  }).catch(() => acctNote('❌ Nejde se připojit (nebo nejsou nastavená pravidla databáze).'));
}
function acctSetName(name) {
  const n = cleanPlayerName(name);
  if (!n) return;
  mp.name = n;
  storageSet(SPEEDRUN.NAME_KEY, n);
}
function acctLogout() {
  if (acct.dirty) acctUpload();
  acct.user = null;
  storageRemove(ACCT.KEY);
  acct.panel = null;
  acctNote('Odhlášeno – hraješ bez účtu (postup zůstal i na tomhle zařízení).');
}
const acctAsk = (text, def) => { const v = window.prompt(text, def || ''); return v === null ? null : v.trim(); };
function acctDoLogin(create) {
  const name = acctAsk(create ? `Jméno nového účtu (max ${SPEEDRUN.NAME_MAX} znaků):` : 'Jméno účtu:', mp.name);
  if (!name) return;
  if (cleanPlayerName(name) !== name.slice(0, SPEEDRUN.NAME_MAX) || name.length > SPEEDRUN.NAME_MAX) { acctNote(`❌ Jméno může mít max ${SPEEDRUN.NAME_MAX} znaků.`); return; }
  const pass = acctAsk(create ? 'Vymysli heslo (aspoň 4 znaky, nepoužívej heslo odjinud):' : 'Heslo:');
  if (!pass) return;
  if (pass.length < 4) { acctNote('❌ Heslo musí mít aspoň 4 znaky.'); return; }
  if (create) {
    const again = acctAsk('Napiš heslo ještě jednou:');
    if (again !== pass) { acctNote('❌ Hesla se neshodují.'); return; }
    acctRegister(name, pass);
  } else acctLogin(name, pass);
}
// --- Okno účtu na úvodu (tlačítko 👤 se jménem) ---
const ACCT_PANEL = { x: 200, y: 130, w: 400, h: 340 };
const acctItems = () => (acct.user
  ? [{ id: 'save', label: '☁ Uložit postup teď' }, { id: 'out', label: 'Odhlásit se' }, { id: 'close', label: 'Zavřít' }]
  : [{ id: 'login', label: '🔑 Přihlásit se' }, { id: 'new', label: '➕ Založit účet' }, { id: 'name', label: '✏ Hrát bez účtu – jen jméno' }, { id: 'close', label: 'Zavřít' }]);
const acctRow = (i) => ({ x: 240, y: 230 + i * 52, w: 320, h: 44 });
function acctOpen() { acct.panel = { sel: 0 }; }
function acctAction(id) {
  if (id === 'login') acctDoLogin(false);
  else if (id === 'new') acctDoLogin(true);
  else if (id === 'name') { changePlayerName(); acct.panel = null; }
  else if (id === 'save') { acctUpload(); acctNote('☁ Ukládám…'); }
  else if (id === 'out') acctLogout();
  else acct.panel = null;
}
function takeAccountTaps() {
  if (!acct.panel) return;
  if (state.screen !== 'title') { acct.panel = null; return; }
  const items = acctItems(), events = input.events.splice(0);
  for (const e of events) {
    if (e.type === 'action') { acctAction(items[acct.panel.sel].id); return; }
    if (e.x == null) continue;
    const i = items.findIndex((_, k) => pointInRect(e.x, e.y, acctRow(k), 2));
    if (i >= 0) { acctAction(items[i].id); return; }
    if (!pointInRect(e.x, e.y, ACCT_PANEL, 0)) { acct.panel = null; return; }
  }
}
window.addEventListener('keydown', (e) => {
  if (!acct.panel || state.screen !== 'title') return;
  const n = acctItems().length;
  if (e.code === 'Escape') acct.panel = null;
  else if (KEYMAP.up.includes(e.code)) acct.panel.sel = (acct.panel.sel + n - 1) % n;
  else if (KEYMAP.down.includes(e.code)) acct.panel.sel = (acct.panel.sel + 1) % n;
  else return;
  e.stopImmediatePropagation();
}, true);
function drawAccountPanel() {
  if (acct.msgT > 0 && (state.screen === 'title' || state.screen === 'horor')) drawOutlinedText(acct.msg, CONFIG.WIDTH / 2, CONFIG.HEIGHT - 16, 'bold 14px sans-serif', /❌|⚠/.test(acct.msg) ? '#ff8a80' : '#c8f7c5', 'middle', CONFIG.WIDTH - 20);
  if (!acct.panel || state.screen !== 'title') return;
  const A = ACCT_PANEL, items = acctItems();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(A.x, A.y, A.w, A.h, 16);
  ctx.fillStyle = '#1d2333'; ctx.fill(); ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText('👤 Účet', 400, A.y + 34, 'bold 26px sans-serif', '#4fc3f7', 'middle');
  drawOutlinedText(acct.user ? `Přihlášen: ${acct.user.n} – postup se ukládá na server` : 'Bez účtu se postup pamatuje jen na tomhle zařízení', 400, A.y + 70, 'bold 13px sans-serif', '#c9d3e8', 'middle', A.w - 30);
  items.forEach((it, i) => drawChessButton(acctRow(i), it.label, i === acct.panel.sel, it.id === 'close' ? '#5a4636' : it.id === 'out' ? '#7a2a2a' : '#2f5a7a'));
}
// Tlačítko se jménem na úvodu otevře okno účtu (29_multiplayer.js) a ukáže, kdo je přihlášený
{
  const _taps = takeOnlineTaps;
  takeOnlineTaps = function () {
    if (titleControlsActive() && !acct.panel) {
      input.events = input.events.filter((ev) => {
        if (ev.type === 'tap' && ev.x != null && pointInRect(ev.x, ev.y, MP.NAME_BUTTON, 4)) { acctOpen(); return false; }
        return true;
      });
    }
    _taps();
  };
  const _draw = drawOnlineButton;
  drawOnlineButton = function () {
    _draw();
    if (!titleControlsActive()) return;
    const nb = MP.NAME_BUTTON;
    roundRectPath(nb.x, nb.y, nb.w, nb.h, 6);
    ctx.fillStyle = acct.user ? 'rgba(21, 101, 192, 0.95)' : 'rgba(40, 40, 40, 0.95)'; ctx.fill();
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText(acct.user ? `👤 ${acct.user.n} ✔ účet` : mp.name ? `👤 ${mp.name} · účet` : '👤 Účet / jméno', nb.x + 8, nb.y + nb.h / 2 + 1, nb.w - 14);
  };
}
// Každý krok (15_hlavni.js): ukládání na server, když se něco změnilo
function updateAccount(dt) {
  if (acct.msgT > 0) acct.msgT -= dt;
  if (!acct.checked) acctCheck();
  if (!acct.user) return;
  acct.sendT -= dt;
  if (acct.dirty && acct.sendT <= 0) { acct.sendT = ACCT.EVERY; acctUpload(); }
}
window.addEventListener('pagehide', () => {
  const u = acct.user;
  if (!u || !acct.dirty || !mpReady()) return;
  try { fetch(acctUrl(`ucty/${u.k}/${u.h}`), { method: 'PUT', keepalive: true, body: JSON.stringify({ d: JSON.stringify(acctCollect()), t: { '.sv': 'timestamp' } }) }); } catch (e) { /* nevadí */ }
});
