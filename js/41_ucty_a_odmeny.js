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
const mainMoneyLive = () => !state.mode && (state.screen === 'playing' || state.screen === 'skins');   // rozehraná hlavní hra (i u Lockeru)
function mainMoneyGet() {
  if (mainMoneyLive()) return state.money;
  try { const d = JSON.parse(storageGet(CONFIG.SAVE_KEY) || 'null'); return d && Number.isFinite(d.money) ? d.money : 0; } catch (e) { return 0; }
}
function mainMoneyAdd(n) {
  if (mainMoneyLive()) { state.money += n; saveProgress(); return; }
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
// Věci na jedno použití (kupují se v ⭐ Vylepšení, berou se do další hry): kolik kusů je uloženo v HOROR_ITEM_KEY
const HOROR_ITEM_KEY = 'hra_darek_horor_veci_v1';
const HOROR_ITEMS = [
  { id: 'sance', icon: '🛡', name: 'Druhá šance', text: 'když tě Láďa chytí, vytrhneš se', price: 100 },
  { id: 'tycinka', icon: '🍫', name: 'Tyčinka', text: 'klávesa 1: 10 s sprint bez únavy', price: 100 },
  { id: 'ocka', icon: '👁', name: 'Očka', text: 'klávesa 2: 5 s vidíš Láďovýma očima', price: 50 },
  { id: 'lekarnicka', icon: '⛑', name: 'Lékárnička', text: 'klávesa 3: oživí kamaráda (online)', price: 110 },
];
const HOROR_ITEM_MAX = 9;
function hororItemsGet() {
  try { const d = JSON.parse(storageGet(HOROR_ITEM_KEY) || '{}'); return d && typeof d === 'object' ? { ...d } : {}; } catch (e) { return {}; }
}
function hororItemAdd(id, n) {
  const d = hororItemsGet();
  d[id] = Math.max(0, Math.min(HOROR_ITEM_MAX, (d[id] | 0) + n));
  storageSet(HOROR_ITEM_KEY, JSON.stringify(d));
  acctDirty();
}
function hororBuyItem(id) {
  const it = HOROR_ITEMS.find((q) => q.id === id), have = hororItemsGet()[id] | 0, money = mainMoneyGet();
  if (!it) return '';
  if (have >= HOROR_ITEM_MAX) return `Víc než ${HOROR_ITEM_MAX} kusů unést nejde.`;
  if (money < it.price) return `Chybí ti ${it.price - money} Kč (máš ${money} Kč).`;
  mainMoneyAdd(-it.price);
  hororItemAdd(id, 1);
  playSound([[523, 0, 0.06], [659, 0.07, 0.1]]);
  return `${it.icon} ${it.name} – máš ${have + 1} ks.`;
}
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
// obchod: vlevo vylepšení (trvalá), vpravo věci (na jedno použití)
const HOROR_SHOP_N = () => HOROR_UPS.length + HOROR_ITEMS.length;
const HOROR_SHOP_ROW = (i) => (i < HOROR_UPS.length ? { x: 34, y: 140 + i * 56, w: 362, h: 50 } : { x: 404, y: 140 + (i - HOROR_UPS.length) * 56, w: 362, h: 50 });
const HOROR_SHOP_BACK = { x: 300, y: 488, w: 200, h: 44 };
function hororShopInput(H, keys, events) {
  const n = HOROR_SHOP_N() + 1;
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
      if (pointInRect(e.x, e.y, HOROR_SHOP_BACK, 4)) i = HOROR_SHOP_N();
      else { i = -1; for (let k = 0; k < HOROR_SHOP_N(); k++) if (pointInRect(e.x, e.y, HOROR_SHOP_ROW(k), 2)) i = k; }
    }
    if (i < 0) continue;
    if (i === HOROR_SHOP_N()) { H.phase = 'intro'; return; }
    H.shopSel = i;
    H.shopMsg = i < HOROR_UPS.length ? hororBuyUp(HOROR_UPS[i].id) : hororBuyItem(HOROR_ITEMS[i - HOROR_UPS.length].id); H.shopMsgT = 3;
  }
}
function drawHororShop(H) {
  const W = CONFIG.WIDTH;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, CONFIG.HEIGHT);
  drawOutlinedText('⭐ Vylepšení postavy', W / 2, 52, 'bold 32px sans-serif', '#ffd54a', 'middle');
  drawOutlinedText(`💰 ${mainMoneyGet()} Kč  ·  vyděláš ve hře, za výhru v hororu (250), ve Vrahovi (50) a v Among Us (25)`, W / 2, 92, 'bold 13px sans-serif', '#cfcfcf', 'middle', W - 40);
  drawOutlinedText('Vylepšení (napořád)', 215, 122, 'bold 14px sans-serif', '#ffd54a', 'middle');
  drawOutlinedText('Věci do hry (na 1 použití)', 585, 122, 'bold 14px sans-serif', '#80deea', 'middle');
  const have = hororItemsGet();
  HOROR_ITEMS.forEach((it, k) => {
    const i = HOROR_UPS.length + k, r = HOROR_SHOP_ROW(i), sel = i === H.shopSel, n = have[it.id] | 0;
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = sel ? 'rgba(128, 222, 234, 0.2)' : 'rgba(255, 255, 255, 0.07)'; ctx.fill();
    if (sel) { ctx.strokeStyle = '#80deea'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(it.icon, r.x + 10, r.y + r.h / 2 + 1);
    ctx.font = 'bold 15px sans-serif'; ctx.fillText(`${it.name}${n ? `  ×${n}` : ''}`, r.x + 44, r.y + 17);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#cfcfcf'; ctx.fillText(it.text, r.x + 44, r.y + 36, r.w - 120);
    ctx.textAlign = 'right'; ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = mainMoneyGet() >= it.price ? '#ffd54a' : '#ff8a80';
    ctx.fillText(`${it.price} Kč`, r.x + r.w - 12, r.y + r.h / 2 + 1);
  });
  HOROR_UPS.forEach((u, i) => {
    const r = HOROR_SHOP_ROW(i), lv = hororUp(u.id), max = lv >= u.cost.length, sel = i === H.shopSel;
    roundRectPath(r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = sel ? 'rgba(255, 213, 74, 0.22)' : 'rgba(255, 255, 255, 0.07)'; ctx.fill();
    if (sel) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(u.icon, r.x + 10, r.y + r.h / 2 + 1);
    ctx.font = 'bold 15px sans-serif'; ctx.fillText(u.name, r.x + 44, r.y + 17);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#cfcfcf'; ctx.fillText(u.text, r.x + 44, r.y + 36, 170);
    for (let k = 0; k < u.cost.length; k++) {   // úrovně
      ctx.fillStyle = k < lv ? '#ffd54a' : 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath(); ctx.arc(r.x + 226 + k * 12, r.y + 17, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'right'; ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = max ? '#7ee08a' : mainMoneyGet() >= u.cost[lv] ? '#ffd54a' : '#ff8a80';
    ctx.fillText(max ? 'MAX' : `${u.cost[lv]} Kč`, r.x + r.w - 14, r.y + r.h / 2 + 1);
  });
  drawChessButton(HOROR_SHOP_BACK, 'Zpět', H.shopSel === HOROR_SHOP_N(), '#5a4636');
  if (H.shopMsgT > 0) drawOutlinedText(H.shopMsg, W / 2, 560, 'bold 17px sans-serif', /Chybí|Už|Víc/.test(H.shopMsg) ? '#ff8a80' : '#7ee08a', 'middle');
}

// =====================================================================
// ÚČTY
// =====================================================================
const ACCT = { KEY: 'hra_darek_ucet_v1', SYNC: 'hra_darek_ucet_cas_v1', LOGIN: 'hra_darek_ucet_login_v1', EVERY: 5, SKIP: ['hra_darek_ucet_login_v1', 'hra_darek_online_v1', 'hra_darek_kvalita_v1', 'hra_darek_zvuk_vypnuty'] };   // přezdívka (jmeno_v1) se ukládá i do účtu
const acct = { user: null, dirty: false, sendT: 5, busy: false, msg: '', msgT: 0, panel: null, checked: false, form: null };
try { const u = JSON.parse(storageGet(ACCT.KEY) || 'null'); if (u && u.n && u.k && u.h) acct.user = u; } catch (e) { acct.user = null; }
function acctDirty() { acct.dirty = true; }
{
  const _save = saveProgress;
  saveProgress = function () { _save(); acctDirty(); };
}
const acctNameKey = (full) => 'u' + acctSha256(`jmeno|${full.toLowerCase()}`).slice(0, 23);   // klíč účtu = otisk jména a příjmení (v databázi nejsou čitelně)
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
// Účet = jméno a příjmení (v databázi jen jako otisk SHA-256, ne čitelně) + heslo; ve hře se ukazuje přezdívka
const acctFullName = (jmeno, prijmeni) => `${jmeno} ${prijmeni}`.normalize('NFC').trim().replace(/\s+/g, ' ');
function acctLogin(full, pass, opts) {
  const key = acctNameKey(full), h = acctHash(key, pass);
  acctNote('Přihlašuji…');
  return fetch(acctUrl(`ucty/${key}/${h}`)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((data) => {
    if (!data || typeof data.d !== 'string') { acctNote('❌ Špatné jméno, příjmení nebo heslo.'); return false; }
    acctApply(data);
    const nick = cleanPlayerName(storageGet(SPEEDRUN.NAME_KEY) || '') || full.split(' ')[0];
    acct.user = { n: full, nick, k: key, h };
    storageSet(ACCT.KEY, JSON.stringify(acct.user));
    acctSetName(nick);
    acct.panel = null;
    acctRemember(full, pass, nick, opts);
    acctNote(`✅ Ahoj, ${nick}! Přihlášen – postup načten.`);
    return true;
  }).catch(() => { acctNote('❌ Nejde se připojit (nebo nejsou nastavená pravidla databáze).'); return false; });
}
function acctRegister(full, pass, nick, opts) {
  const key = acctNameKey(full), h = acctHash(key, pass);
  acctNote('Zakládám účet…');
  return fetch(acctUrl(`jmena/${key}`)).then((r) => r.json()).then((taken) => {
    if (taken) { acctNote('❌ Účet s tímhle jménem a příjmením už existuje – přihlas se.'); return false; }
    return fetch(acctUrl(`jmena/${key}`), { method: 'PUT', body: JSON.stringify({ t: { '.sv': 'timestamp' } }) }).then((r) => {
      if (!r.ok) throw new Error(r.status);
      acct.user = { n: full, nick, k: key, h };
      storageSet(ACCT.KEY, JSON.stringify(acct.user));
      acctSetName(nick);
      acct.panel = null;
      acctUpload();   // současný postup (i přezdívka) se nahraje do účtu
      acctRemember(full, pass, nick, opts);
      acctNote(`✅ Účet založen – vítej, ${nick}! Postup se bude ukládat.`);
      return true;
    });
  }).catch(() => { acctNote('❌ Nejde se připojit (nebo nejsou nastavená pravidla databáze).'); return false; });
}
// Zapamatovat přihlašovací jméno (jen na tomhle zařízení) a nabídnout prohlížeči uložení hesla
function acctRemember(full, pass, nick, opts) {
  if (opts && opts.remember === false) storageRemove(ACCT.LOGIN);
  else storageSet(ACCT.LOGIN, full);
  try {
    if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) navigator.credentials.store(new window.PasswordCredential({ id: full, password: pass, name: nick })).catch(() => {});
  } catch (e) { /* prohlížeč to neumí – uloží si to z formuláře sám */ }
}
function acctSetName(name) {
  const n = cleanPlayerName(name);
  if (!n) return;
  mp.name = n;
  storageSet(SPEEDRUN.NAME_KEY, n);
  if (acct.user) { acct.user.nick = n; storageSet(ACCT.KEY, JSON.stringify(acct.user)); acctDirty(); }
}
function acctLogout() {
  if (acct.dirty) acctUpload();
  acct.user = null;
  storageRemove(ACCT.KEY);
  acct.panel = null;
  try { if (navigator.credentials && navigator.credentials.preventSilentAccess) navigator.credentials.preventSilentAccess(); } catch (e) { /* nevadí */ }
  acctNote('Odhlášeno – hraješ bez účtu (postup zůstal i na tomhle zařízení).');
}

// --- Formulář (HTML nad hrou): přihlášení / nový účet / přezdívka ---
// Skutečný <form> s autocomplete, ať si prohlížeč umí jméno a heslo uložit a příště vyplnit.
const ACCT_CSS = `
#ucetForm{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:50;font-family:sans-serif}
#ucetForm form{background:#1d2333;border:3px solid #4fc3f7;border-radius:16px;padding:18px 20px;width:min(360px,92vw);color:#fff;box-sizing:border-box;max-height:96vh;overflow:auto}
#ucetForm h2{margin:0 0 4px;text-align:center;color:#4fc3f7;font-size:22px}
#ucetForm p{margin:0 0 10px;text-align:center;color:#c9d3e8;font-size:13px}
#ucetForm label{display:block;font-size:13px;color:#c9d3e8;margin:8px 0 3px}
#ucetForm input[type=text],#ucetForm input[type=password]{width:100%;box-sizing:border-box;font-size:16px;padding:9px 10px;border-radius:8px;border:2px solid #3a4560;background:#0f1422;color:#fff}
#ucetForm input:focus{outline:none;border-color:#4fc3f7}
#ucetForm .pw{position:relative}#ucetForm .pw input{padding-right:44px}
#ucetForm .eye{position:absolute;right:4px;top:4px;width:36px;height:34px;border:0;background:none;font-size:18px;cursor:pointer;color:#c9d3e8}
#ucetForm .row{display:flex;gap:8px}#ucetForm .row>div{flex:1}
#ucetForm .chk{display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-size:14px;color:#e0e6f5}
#ucetForm .chk input{width:18px;height:18px}
#ucetForm .err{color:#ff8a80;font-size:13px;min-height:18px;margin-top:8px;text-align:center}
#ucetForm .btns{display:flex;gap:8px;margin-top:10px}
#ucetForm button.go,#ucetForm button.back{flex:1;font-size:16px;font-weight:bold;padding:10px;border-radius:10px;border:0;cursor:pointer}
#ucetForm button.go{background:#ffd54a;color:#222}#ucetForm button.back{background:#5a4636;color:#fff}
#ucetForm a{color:#4fc3f7;cursor:pointer;text-decoration:underline}
#ucetForm .switch{text-align:center;font-size:13px;margin-top:10px;color:#c9d3e8}
#ucetForm .hide{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}`;
function acctFormClose() {
  const el = document.getElementById('ucetForm');
  if (el) el.remove();
  acct.form = null;
}
// mode: 'login' | 'register' | 'nick'
function acctFormOpen(mode) {
  acctFormClose();
  acct.panel = null;
  if (!document.getElementById('ucetCss')) { const st = document.createElement('style'); st.id = 'ucetCss'; st.textContent = ACCT_CSS; document.head.appendChild(st); }
  const last = storageGet(ACCT.LOGIN) || '', sp = last.indexOf(' '), lj = sp > 0 ? last.slice(0, sp) : last, lp = sp > 0 ? last.slice(sp + 1) : '';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pw = (id, ac, label) => `<label for="${id}">${label}</label><div class="pw"><input type="password" id="${id}" name="${id === 'uHeslo' ? 'password' : id}" autocomplete="${ac}" required minlength="6"><button type="button" class="eye" data-for="${id}" title="Ukázat heslo">👁</button></div>`;
  const names = `<div class="row"><div><label for="uJmeno">Jméno</label><input type="text" id="uJmeno" name="given-name" autocomplete="given-name" required value="${esc(lj)}"></div>
    <div><label for="uPrijmeni">Příjmení</label><input type="text" id="uPrijmeni" name="family-name" autocomplete="family-name" required value="${esc(lp)}"></div></div>
    <input type="text" class="hide" id="uLogin" name="username" autocomplete="username" tabindex="-1" value="${esc(last)}">`;
  const remember = `<label class="chk"><input type="checkbox" id="uPamatuj" ${storageGet(ACCT.LOGIN) !== null || !last ? 'checked' : ''}> Zapamatovat přihlašovací jméno</label>`;
  let html;
  if (mode === 'login') {
    html = `<h2>🔑 Přihlášení</h2><p>Přihlas se svým jménem, příjmením a heslem</p>${names}${pw('uHeslo', 'current-password', 'Heslo')}${remember}
      <div class="err" id="uErr"></div><div class="btns"><button type="button" class="back">Zpět</button><button type="submit" class="go">Přihlásit</button></div>
      <div class="switch">Nemáš účet? <a data-go="register">Založ si ho</a></div>`;
  } else if (mode === 'register') {
    html = `<h2>➕ Nový účet</h2><p>Postup se ti bude ukládat a načte se i na jiném zařízení</p>${names}
      <label for="uNick">Přezdívka (uvidí ji ostatní hráči)</label><input type="text" id="uNick" name="nickname" autocomplete="nickname" required maxlength="${SPEEDRUN.NAME_MAX}" value="${esc(mp.name || '')}">
      ${pw('uHeslo', 'new-password', 'Heslo (aspoň 6 znaků, nepoužívej heslo odjinud)')}${pw('uHeslo2', 'new-password', 'Heslo znovu')}${remember}
      <div class="err" id="uErr"></div><div class="btns"><button type="button" class="back">Zpět</button><button type="submit" class="go">Založit účet</button></div>
      <div class="switch">Už máš účet? <a data-go="login">Přihlas se</a></div>`;
  } else {
    html = `<h2>✏ Přezdívka</h2><p>${acct.user ? 'Jak tě uvidí ostatní hráči' : 'Hraješ bez účtu – postup se pamatuje jen na tomhle zařízení'}</p>
      <label for="uNick">Přezdívka</label><input type="text" id="uNick" name="nickname" autocomplete="nickname" required maxlength="${SPEEDRUN.NAME_MAX}" value="${esc(mp.name || '')}">
      <div class="err" id="uErr"></div><div class="btns"><button type="button" class="back">Zpět</button><button type="submit" class="go">Uložit</button></div>`;
  }
  const wrap = document.createElement('div');
  wrap.id = 'ucetForm';
  wrap.innerHTML = `<form autocomplete="on" novalidate>${html}</form>`;
  document.body.appendChild(wrap);
  acct.form = mode;
  input.keys.clear(); input.events.length = 0;
  const $ = (id) => wrap.querySelector(`#${id}`), err = (t) => { $('uErr').textContent = t; };
  // ať hra nereaguje na psaní a klikání ve formuláři
  for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel']) wrap.addEventListener(ev, (e) => e.stopPropagation());
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); acctFormClose(); } });
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) acctFormClose(); });
  wrap.querySelector('.back').addEventListener('click', () => { acctFormClose(); acctOpen(); });
  wrap.querySelectorAll('a[data-go]').forEach((a) => a.addEventListener('click', () => acctFormOpen(a.dataset.go)));
  wrap.querySelectorAll('.eye').forEach((b) => b.addEventListener('click', () => { const i = $(b.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '👁' : '🙈'; }));
  // skryté pole „username“ pro správce hesel: jméno + příjmení dohromady (a naopak, když ho prohlížeč vyplní)
  const login = $('uLogin');
  if (login) {
    const sync = () => { login.value = acctFullName($('uJmeno').value, $('uPrijmeni').value); };
    $('uJmeno').addEventListener('input', sync); $('uPrijmeni').addEventListener('input', sync);
    login.addEventListener('change', () => { const v = login.value.trim(), k = v.indexOf(' '); if (v) { $('uJmeno').value = k > 0 ? v.slice(0, k) : v; $('uPrijmeni').value = k > 0 ? v.slice(k + 1) : ''; } });
  }
  // přihlášení uložené v prohlížeči (Chrome a další): rovnou vyplnit
  if (mode === 'login' && window.PasswordCredential && navigator.credentials && navigator.credentials.get) {
    navigator.credentials.get({ password: true, mediation: 'optional' }).then((c) => {
      if (!c || !c.password || acct.form !== 'login') return;
      const v = c.id, k = v.indexOf(' ');
      $('uJmeno').value = k > 0 ? v.slice(0, k) : v; $('uPrijmeni').value = k > 0 ? v.slice(k + 1) : ''; $('uHeslo').value = c.password; login.value = v;
    }).catch(() => {});
  }
  setTimeout(() => { const f = mode === 'nick' ? $('uNick') : (!$('uJmeno').value ? $('uJmeno') : !$('uPrijmeni').value ? $('uPrijmeni') : mode === 'register' ? $('uNick') : $('uHeslo')); if (f) f.focus(); }, 30);
  wrap.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (mode === 'nick') {
      const n = cleanPlayerName($('uNick').value);
      if (!n) { err('Napiš přezdívku.'); return; }
      acctSetName(n); acctFormClose(); acctNote(`✏ Přezdívka: ${n}`);
      return;
    }
    const j = $('uJmeno').value.trim(), pr = $('uPrijmeni').value.trim(), pass = $('uHeslo').value;
    if (!j || !pr) { err('Vyplň jméno i příjmení.'); return; }
    if (pass.length < 6) { err('Heslo musí mít aspoň 6 znaků.'); return; }
    const full = acctFullName(j, pr), opts = { remember: $('uPamatuj').checked };
    login.value = full;
    let job;
    if (mode === 'register') {
      const nick = cleanPlayerName($('uNick').value);
      if (!nick) { err('Vymysli si přezdívku.'); return; }
      if (pass !== $('uHeslo2').value) { err('Hesla se neshodují.'); return; }
      job = acctRegister(full, pass, nick, opts);
    } else job = acctLogin(full, pass, opts);
    const go = wrap.querySelector('.go');
    go.disabled = true; err('');
    job.then((ok) => {
      if (ok) acctFormClose();   // formulář zmizí = prohlížeč nabídne uložení hesla
      else { go.disabled = false; err(acct.msg.replace(/^❌ /, '')); }
    });
  });
}
// Dokud je formulář otevřený, hra nedostane klávesy ani ťuknutí mimo něj (psaní do políček funguje normálně)
for (const ev of ['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart']) {
  window.addEventListener(ev, (e) => {
    if (!acct.form) return;
    if (!(e.target && e.target.closest && e.target.closest('#ucetForm'))) e.stopImmediatePropagation();
  }, true);
}
// --- Okno účtu na úvodu (tlačítko 👤 se jménem) ---
const ACCT_PANEL = { x: 200, y: 120, w: 400, h: 360 };
const acctItems = () => (acct.user
  ? [{ id: 'nick', label: '✏ Změnit přezdívku' }, { id: 'out', label: 'Odhlásit se' }, { id: 'close', label: 'Zavřít' }]
  : [{ id: 'login', label: '🔑 Přihlásit se' }, { id: 'new', label: '➕ Založit účet' }, { id: 'nick', label: '✏ Hrát bez účtu – jen přezdívka' }, { id: 'close', label: 'Zavřít' }]);
const acctRow = (i) => ({ x: 240, y: 222 + i * 52, w: 320, h: 44 });
function acctOpen() { acct.panel = { sel: 0 }; }
function acctAction(id) {
  if (id === 'login') acctFormOpen('login');
  else if (id === 'new') acctFormOpen('register');
  else if (id === 'nick') acctFormOpen('nick');
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
  drawOutlinedText(acct.user ? `Přihlášen: ${acct.user.nick || acct.user.n} (${acct.user.n})` : 'Bez účtu se postup pamatuje jen na tomhle zařízení', 400, A.y + 66, 'bold 13px sans-serif', '#c9d3e8', 'middle', A.w - 30);
  if (acct.user) drawOutlinedText('☁ Postup se ukládá automaticky', 400, A.y + 86, '12px sans-serif', '#9fb3c8', 'middle');
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
    ctx.fillText(acct.user ? `👤 ${acct.user.nick || mp.name} ✔ účet` : mp.name ? `👤 ${mp.name} · přihlásit` : '👤 Přihlásit / účet', nb.x + 8, nb.y + nb.h / 2 + 1, nb.w - 14);
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
