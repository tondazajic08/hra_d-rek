// Příběhy: inventář (E), peněženka pro Chána, Chánova motorka, Tomáš Klus a Lili
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// STAV PŘÍBĚHŮ – ukládá se s postupem (saveProgress → story)
//   wallet       – kolik je v Chánově peněžence (náhodně 50–300 Kč, určí se při sebrání)
//   chanKept     – kolik si hráč z peněženky nechal
//   chanSpent    – kolik pak utratil; prvním nákupem se objeví motorka
//   motorka      – úkol s motorkou je odemčený (motorka stojí na parkovišti)
//   headphones   – hráč má sluchátka od Mykyho (ukazuje se v inventáři)
//   energy       – hlad: 100 = najedený, 0 = hladový (pomalu klesá, jídlo ji doplní)
//   coffee       – kolik sekund ještě působí káva (rychlejší chůze)
// =====================================================================
function newStory() {
  return { wallet: 0, chanKept: 0, chanSpent: 0, motorka: false, headphones: false, energy: 100, coffee: 0, wc: 0 };
}
state.story = newStory();
state.inventory = null;   // otevřený inventář (E)
state.giveMenu = null;    // výběr, kolik peněz dát Chánovi { give }
state.wires = null;       // minihra s dráty u motorky

const questById = (id) => QUESTS.find((q) => q.id === id);
const storyDialog = (who, text) => { state.dialog = { name: who.name, color: who.color, text }; };

// Po načtení / nové hře: postavy tam, kde podle postupu mají být
const LILI_HOME = { room: TEACHERS.lili.room, at: { ...TEACHERS.lili.at } };
const LILI_END = { room: 'kabinetA312', at: { x: 115 / 360, y: 0.55 } };   // vedle Bečváře
const LILI_END_LINE = 'Všude dobře, u Bečváře nejlíp!';
function applyStory() {
  const lili = TEACHERS.lili, stage = questStage(questById('klus'));
  Object.assign(lili, { route: null, arrived: false, running: null });
  const at = stage === 'carrying' || stage === 'done' ? LILI_END : LILI_HOME;
  lili.room = at.room;
  lili.at = { ...at.at };
  lili.rect = rectInRoom(ROOMS[lili.room], lili.at, CONFIG.TEACHER_W, CONFIG.TEACHER_H);
  lili.texts.idle = at === LILI_END ? LILI_END_LINE : lili.homeIdle;
  state.story.lili = at === LILI_END ? 'arrived' : 'home';
  state.inventory = state.giveMenu = state.wires = null;
}

// =====================================================================
// IKONY VĚCÍ – kreslí se v inventáři i na zemi (item.icon u předmětu úkolu)
// (cx, cy) = střed, s = velikost (zhruba čtverec s × s)
// =====================================================================
const ICONS = {
  money(cx, cy, s) {   // bankovka a mince
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.15);
    roundRectPath(-s * 0.45, -s * 0.25, s * 0.8, s * 0.45, 3);
    ctx.fillStyle = '#7cb342'; ctx.fill(); ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c5e1a5'; ctx.beginPath(); ctx.arc(-s * 0.05, -s * 0.03, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f9a825'; ctx.beginPath(); ctx.arc(cx + s * 0.25, cy + s * 0.2, s * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a66f00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#a66f00'; ctx.font = `bold ${Math.round(s * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Kč', cx + s * 0.25, cy + s * 0.21);
  },
  wallet(cx, cy, s) {   // hnědá kožená peněženka, z ní kouká bankovka
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#9ccc65'; ctx.fillRect(-s * 0.3, -s * 0.38, s * 0.5, s * 0.3);   // bankovka
    roundRectPath(-s * 0.45, -s * 0.22, s * 0.9, s * 0.56, 6);
    ctx.fillStyle = '#6d4c2f'; ctx.fill(); ctx.strokeStyle = '#3e2a19'; ctx.lineWidth = 2; ctx.stroke();
    roundRectPath(-s * 0.45, -s * 0.22, s * 0.9, s * 0.2, 6);   // klopa
    ctx.fillStyle = '#7d5a3a'; ctx.fill();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#c9a77a'; ctx.lineWidth = 1;   // prošití
    roundRectPath(-s * 0.4, -s * 0.17, s * 0.8, s * 0.46, 4); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.03, s * 0.06, 0, Math.PI * 2); ctx.fill();   // cvoček
    ctx.restore();
  },
  knife(cx, cy, s) {   // zavírací nožík: čepel a hnědá střenka s nýty
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.6);
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.07); ctx.lineTo(s * 0.48, -s * 0.07); ctx.lineTo(s * 0.32, s * 0.08); ctx.lineTo(-s * 0.05, s * 0.08); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.5; ctx.stroke();
    roundRectPath(-s * 0.48, -s * 0.1, s * 0.46, s * 0.2, s * 0.08);
    ctx.fillStyle = '#8d5524'; ctx.fill(); ctx.strokeStyle = '#4e2c10'; ctx.stroke();
    ctx.fillStyle = '#e0e0e0';
    for (const x of [-0.38, -0.12]) { ctx.beginPath(); ctx.arc(x * s, 0, s * 0.03, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  kanystr(cx, cy, s) {   // červený kanystr na benzín s držadlem a hubičkou
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#9e9e9e'; ctx.fillRect(s * 0.18, -s * 0.48, s * 0.1, s * 0.18);   // hubička
    roundRectPath(-s * 0.36, -s * 0.34, s * 0.72, s * 0.8, 6);
    ctx.fillStyle = '#d32f2f'; ctx.fill(); ctx.strokeStyle = '#7f1010'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#7f1010'; roundRectPath(-s * 0.28, -s * 0.3, s * 0.32, s * 0.1, 3); ctx.fill();   // držadlo
    ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = 3;   // prolis do X
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.12); ctx.lineTo(s * 0.24, s * 0.36); ctx.moveTo(s * 0.24, -s * 0.12); ctx.lineTo(-s * 0.24, s * 0.36); ctx.stroke();
    ctx.restore();
  },
  headphones(cx, cy, s) {   // sluchátka přes hlavu
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = '#263238'; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.arc(0, s * 0.05, s * 0.34, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    for (const x of [-1, 1]) {
      roundRectPath(x * s * 0.34 - s * 0.11, -s * 0.02, s * 0.22, s * 0.36, 5);
      ctx.fillStyle = '#e53935'; ctx.fill(); ctx.strokeStyle = '#263238'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  },
  coffee(cx, cy, s, color = '#8d6e63') {   // kelímek s víčkem a párou
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#fafafa';
    ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.2); ctx.lineTo(s * 0.26, -s * 0.2); ctx.lineTo(s * 0.2, s * 0.42); ctx.lineTo(-s * 0.2, s * 0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-s * 0.23, s * 0.02, s * 0.46, s * 0.14);   // pásek
    roundRectPath(-s * 0.3, -s * 0.28, s * 0.6, s * 0.1, 3); ctx.fillStyle = '#5d4037'; ctx.fill();   // víčko
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.7)'; ctx.lineWidth = 2;
    for (const x of [-0.08, 0.08]) { ctx.beginPath(); ctx.moveTo(x * s, -s * 0.34); ctx.quadraticCurveTo(x * s + s * 0.08, -s * 0.42, x * s, -s * 0.5); ctx.stroke(); }
    ctx.restore();
  },
  tea(cx, cy, s) { ICONS.coffee(cx, cy, s, '#43a047'); },
  cocoa(cx, cy, s) { ICONS.coffee(cx, cy, s, '#4e342e'); },
  hotdog(cx, cy, s) {   // rohlík s párkem a hořčicí
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.3);
    roundRectPath(-s * 0.45, -s * 0.14, s * 0.9, s * 0.3, s * 0.14); ctx.fillStyle = '#d7a35b'; ctx.fill();
    roundRectPath(-s * 0.48, -s * 0.07, s * 0.96, s * 0.15, s * 0.07); ctx.fillStyle = '#c0392b'; ctx.fill();
    ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(-s * 0.36 + i * s * 0.12, (i % 2 ? -1 : 1) * s * 0.03);
    ctx.stroke();
    ctx.restore();
  },
  burger(cx, cy, s) {   // houska se sekanou
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#d7a35b'; ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.42, s * 0.22, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-s * 0.42, -s * 0.1, s * 0.84, s * 0.04);
    ctx.fillStyle = '#7cb342'; ctx.fillRect(-s * 0.44, -s * 0.06, s * 0.88, s * 0.06);
    ctx.fillStyle = '#6d3b1f'; ctx.fillRect(-s * 0.42, 0, s * 0.84, s * 0.12);
    roundRectPath(-s * 0.42, s * 0.12, s * 0.84, s * 0.14, 5); ctx.fillStyle = '#c98f45'; ctx.fill();
    ctx.restore();
  },
  pancake(cx, cy, s) {   // komínek lívanců se sirupem
    ctx.save(); ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#e0a95b' : '#d4994a'; ctx.beginPath(); ctx.ellipse(0, s * (0.22 - i * 0.14), s * 0.42, s * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#8d4f12'; ctx.beginPath(); ctx.ellipse(0, -s * 0.08, s * 0.24, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  toast(cx, cy, s) {   // trojúhelníkový toast
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#c98f45'; ctx.beginPath(); ctx.moveTo(-s * 0.42, s * 0.34); ctx.lineTo(s * 0.42, s * 0.34); ctx.lineTo(0, -s * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3d9a4'; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.27); ctx.lineTo(s * 0.3, s * 0.27); ctx.lineTo(0, -s * 0.24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e57373'; ctx.fillRect(-s * 0.2, s * 0.12, s * 0.4, s * 0.06);
    ctx.restore();
  },
  quesadilla(cx, cy, s) {   // půlkruh tortilly se sýrem
    ctx.save(); ctx.translate(cx, cy + s * 0.12);
    ctx.fillStyle = '#e9c46a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b5852d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffeb3b'; ctx.fillRect(-s * 0.36, -s * 0.03, s * 0.72, s * 0.05);
    ctx.restore();
  },
};
function drawIcon(kind, cx, cy, s) { (ICONS[kind] || ICONS.money)(cx, cy, s); }
// Věc z bufetu / kávovaru → ikona podle názvu
function shopItemIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('párek')) return 'hotdog';
  if (n.includes('sekaná')) return 'burger';
  if (n.includes('lívance')) return 'pancake';
  if (n.includes('toast')) return 'toast';
  if (n.includes('quesadilla')) return 'quesadilla';
  if (n.includes('čaj')) return 'tea';
  if (n.includes('čokoláda')) return 'cocoa';
  return 'coffee';
}

// =====================================================================
// INVENTÁŘ – E nebo tlačítko s batohem vpravo nahoře; karty s ikonami věcí
// =====================================================================
const INVENTORY_PANEL = { x: 60, y: 64, w: 680, h: 500 };
function inventoryItems() {
  const list = [{ icon: 'money', name: 'Peníze', note: `${state.money} Kč` }];
  const st = (id) => questStage(questById(id));
  if (state.story.headphones) list.push({ icon: 'headphones', name: 'Sluchátka od Mykyho', note: 'Písničky: klávesa P' });
  if (st('penezenka') === 'carrying') list.push({ icon: 'wallet', name: 'Chánova peněženka', note: `Je v ní ${state.story.wallet} Kč (dá se z ní platit)` });
  if (state.prank) list.push({ icon: 'knife', name: 'Nůž od Davida', note: 'Na gumy na parkovišti' });
  if (st('motorka') === 'carrying') list.push({ icon: 'kanystr', name: 'Kanystr s benzínem', note: 'Pro Chánovu motorku' });
  const counts = new Map();
  for (const name of state.bag) counts.set(name, (counts.get(name) || 0) + 1);
  list.push(...vrahInventory());
  list.push(...pivoInventory());   // recept na pivo (21_pivo.js)
  list.push(...strunyInventory());   // kleště a struny (22_struny.js)
  list.push(...tabakInventory());    // tabák pro Křiváčka a sáčky (23_tabak.js)
  list.push(...teplotaInventory());  // teploměr pro Láďu (26_teplota.js)   // klíč, stopy, samolepka, lektvar… (18_vrah.js)
  for (const [name, n] of counts) {
    const f = foodOf(name);
    list.push({ icon: shopItemIcon(name), name, food: name,
      note: `${n > 1 ? n + '× · ' : ''}${f.coffee ? '+' + f.energy + ' a zrychlí' : '+' + f.energy + ' energie'}` });
  }
  return list;
}
function toggleInventory() {
  if (state.inventory) { state.inventory = null; return; }
  if (state.dialog || state.transition || state.giveMenu || state.wires) return;
  state.catalog = state.map = state.musicMenu = null;
  state.inventory = { sel: 0 };
  playSound([[523, 0, 0.04], [784, 0.05, 0.05]]);
}
function takeInventoryTaps() {
  input.events = input.events.filter((ev) => {
    const hit = ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, CONFIG.INVENTORY_BUTTON, 4);
    if (hit) toggleInventory();
    return !hit;
  });
}
function drawInventoryButton() {
  const b = CONFIG.INVENTORY_BUTTON;
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = state.inventory ? 'rgba(255, 213, 74, 0.9)' : 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  // batoh
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 1, c = state.inventory ? '#2b1d14' : '#ffffff';
  ctx.strokeStyle = c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - 7, 4, Math.PI, 0); ctx.stroke();
  roundRectPath(cx - 8, cy - 7, 16, 17, 4); ctx.fillStyle = c; ctx.fill();
  ctx.fillStyle = state.inventory ? '#ffd54a' : '#2b2b2b';
  ctx.fillRect(cx - 5, cy + 1, 10, 5);
}
function drawInventory() {
  if (!state.inventory) return;
  const P = INVENTORY_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText('🎒 Inventář', P.x + 24, P.y + 32);
  ctx.fillStyle = 'rgba(59, 42, 28, 0.25)';
  ctx.fillRect(P.x + 20, P.y + 56, P.w - 40, 2);
  const items = inventoryItems(), cw = INV_CARD.w, ch = INV_CARD.h;
  items.slice(0, 12).forEach((it, i) => {
    const { x, y } = inventoryCard(i);
    const sel = i === state.inventory.sel && !isTouchHint();
    roundRectPath(x, y, cw, ch, 10);
    ctx.fillStyle = sel ? '#ffe9a8' : it.food ? '#f1f8e9' : '#fffaf0'; ctx.fill();
    ctx.strokeStyle = 'rgba(59, 42, 28, 0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawIcon(it.icon, x + cw / 2, y + 44, 54);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#2b1d14';
    ctx.fillText(it.name, x + cw / 2, y + 92, cw - 10);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#6b5a48';
    ctx.fillText(it.note, x + cw / 2, y + 111, cw - 10);
  });
  if (items.length === 1) {
    ctx.font = '15px sans-serif'; ctx.fillStyle = '#6b5a48'; ctx.textAlign = 'center';
    ctx.fillText('Kromě peněz u sebe zatím nic nemáš.', P.x + P.w / 2, P.y + 260);
  }
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b5a48'; ctx.textAlign = 'center';
  ctx.fillText(isTouchHint() ? 'Ťukni na jídlo = sníst · mimo = zavřít' : '← → ↑ ↓ vyber · mezerník = sníst · E / Esc = zavřít', P.x + P.w / 2, P.y + P.h - 14);
  // energie v inventáři
  ctx.textAlign = 'right'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText(`🍔 Energie ${Math.round(state.story.energy)} %`, P.x + P.w - 24, P.y + 32);
}
// Mřížka karet v inventáři (4 sloupce)
const INV_CARD = { w: 150, h: 128, gap: 10, cols: 4 };
function inventoryCard(i) {
  const P = INVENTORY_PANEL, c = INV_CARD;
  const x0 = P.x + (P.w - c.cols * c.w - (c.cols - 1) * c.gap) / 2;
  return { x: x0 + (i % c.cols) * (c.w + c.gap), y: P.y + 70 + Math.floor(i / c.cols) * (c.h + c.gap), w: c.w, h: c.h };
}
// Mezerník = sníst vybrané jídlo (u jiné věci zavřít), ťuknutí na jídlo = sníst, mimo panel = zavřít
function inventoryEvents(events) {
  const items = inventoryItems().slice(0, 12);
  for (const ev of events) {
    if (ev.type === 'action') {
      const it = items[state.inventory.sel];
      if (it && it.food) eatFood(it.food); else if (it && it.use) it.use(); else state.inventory = null;
      return;
    }
    if (ev.x == null) continue;
    if (!pointInRect(ev.x, ev.y, INVENTORY_PANEL, 0)) { state.inventory = null; return; }
    const i = items.findIndex((_, k) => pointInRect(ev.x, ev.y, inventoryCard(k), 0));
    if (i >= 0) { state.inventory.sel = i; if (items[i].food) eatFood(items[i].food); else if (items[i].use) items[i].use(); }
  }
}

// =====================================================================
// HLAD – energie pomalu klesá (z plna na nulu asi za 25 minut hraní). Hladový Roman
// chodí pomaleji, jídlo z inventáře energii doplní, káva na chvíli zrychlí.
// =====================================================================
const HUNGER = { DRAIN: 100 / 600,   // z plna na nulu za 10 minut hraní (dřív 25)
  LOW: 30, SLOW: 0.75, STARVING: 0.55, COFFEE_TIME: 45, COFFEE_SPEED: 1.3 };
// Kolik jídlo doplní (podle ceny) a co Roman řekne
function foodOf(name) {
  const n = name.toLowerCase();
  // wc = o kolik se naplní záchodový ukazatel (💩, max 100)
  if (n.includes('párek')) return { energy: 35, wc: 22, line: 'Párek v rohlíku – klasika, co nikdy nezklame.' };
  if (n.includes('sekaná')) return { energy: 55, wc: 32, line: 'Sekaná v housce. Teď vydržím do večera!' };
  if (n.includes('lívance')) return { energy: 45, wc: 26, line: 'Americké lívance. Sladký život.' };
  if (n.includes('slaninou')) return { energy: 35, wc: 24, line: 'Toast se slaninou. Křupe to!' };
  if (n.includes('toast')) return { energy: 40, wc: 22, line: 'Toast se šunkou. Poctivá svačina.' };
  if (n.includes('quesadilla')) return { energy: 45, wc: 28, line: 'Quesadilla. ¡Muy bien!' };
  if (n.includes('čokoláda')) return { energy: 20, wc: 18, line: 'Horká čokoláda. Hned je líp.' };
  if (n.includes('čaj')) return { energy: 15, wc: 20, line: 'Čaj. Zahřeje, ale moc nezasytí.' };
  return { energy: 10, wc: 16, coffee: true, line: 'Káva! Teď to pofrčí.' };
}
function eatFood(name) {
  const i = state.bag.indexOf(name);
  if (i < 0) return;
  state.bag.splice(i, 1);
  const f = foodOf(name), s = state.story;
  s.energy = Math.min(100, s.energy + f.energy);
  if (f.coffee) s.coffee = HUNGER.COFFEE_TIME;
  s.hungryToast = 0;
  playSound([[392, 0, 0.06], [523, 0.07, 0.06], [659, 0.14, 0.1]]);
  const line = f.line, wcBefore = s.wc || 0;
  s.wc = wcBefore + (f.wc || 0);
  state.toast = { text: `😋 ${line} (+${f.energy} energie${f.coffee ? ', zrychlení' : ''}, 💩 +${f.wc || 0})`, t: CONFIG.TOAST_TIME + 1 };
  if (s.wc >= WC.MAX) { toiletDeath(); return; }
  if (wcBefore < WC.WARN && s.wc >= WC.WARN) state.toast = { text: `😣 ${line} …ale Romanovi se chce na záchod! Najdi WC (💩 ${Math.round(s.wc)} / ${WC.MAX}).`, t: CONFIG.TOAST_TIME + 3 };
  const left = inventoryItems().length;
  if (state.inventory) state.inventory.sel = Math.min(state.inventory.sel, Math.max(0, left - 1));
  saveProgress();
}
// ZÁCHOD (💩): jídlo a pití ukazatel plní (podle toho, co Roman sní – foodOf wc), na WC se vyprázdní.
// Když dojde na MAX, Roman to nevydrží: objeví se na začátku a zaplatí 250 Kč (peníze můžou do mínusu).
const WC = { MAX: 100, WARN: 70, EMPTY: 45, FINE: 250 };
function toiletDeath() {
  const s = state.story;
  s.wc = 0;
  state.money -= WC.FINE;
  state.inventory = null; state.dialog = null;
  playSound([[220, 0, 0.2], [165, 0.22, 0.3], [110, 0.55, 0.5]], 'sawtooth');
  enterStartRoom();   // zpátky na začátek (33_skiny.js)
  state.toast = { text: `💩 Roman to nevydržel… Je zpátky na začátku a stálo ho to ${WC.FINE} Kč (má ${state.money} Kč).`, t: CONFIG.TOAST_TIME + 4 };
  saveProgress();
}
function updateHunger(dt) {
  const s = state.story, before = s.energy;
  s.wc = s.wc || 0;
  if (s.wc > 0 && state.room && state.room.id.startsWith('wc')) {   // na záchodě se uleví
    s.wc = Math.max(0, s.wc - WC.EMPTY * dt);
    if (!s.wcToast) { s.wcToast = 1; state.toast = { text: '🚽 Uf… ulevilo se.', t: CONFIG.TOAST_TIME }; }
    if (!s.wc) saveProgress();
  } else s.wcToast = 0;
  s.energy = Math.max(0, s.energy - HUNGER.DRAIN * dt);
  s.coffee = Math.max(0, s.coffee - dt);
  updateTabak(dt);
  if (s.high > 0) { s.high = Math.max(0, s.high - dt); if (!s.high) state.toast = { text: '🌿 Hlava se vyčistila – Roman už chodí rovně.', t: CONFIG.TOAST_TIME }; }
  s.hungryToast = (s.hungryToast || 0) - dt;
  if (before >= HUNGER.LOW && s.energy < HUNGER.LOW) {
    state.toast = { text: '🍔 Romanovi kručí v břiše – chodí pomaleji. Kup si něco a sněz to (E).', t: CONFIG.TOAST_TIME + 2 };
  } else if (s.energy <= 0 && s.hungryToast <= 0) {
    s.hungryToast = 60;
    state.toast = { text: '🍔 Roman už sotva leze hlady! Kup si něco v bufetu.', t: CONFIG.TOAST_TIME + 2 };
  }
}
// Násobek rychlosti chůze (06_logika.js): hlad zpomalí, káva zrychlí
function walkSpeedFactor() {
  const s = state.story;
  let k = s.energy <= 0 ? HUNGER.STARVING : s.energy < HUNGER.LOW ? HUNGER.SLOW : 1;
  if (s.coffee > 0) k *= HUNGER.COFFEE_SPEED;
  if (s.high > 0) k *= HIGH.SPEED;
  k *= tabakSpeed();   // sáček od Křiváčka (23_tabak.js)
  return k;
}
// Ukazatel energie pod tlačítkem s hudbou
function drawEnergyBar() {
  const s = state.story, b = CONFIG.MUSIC_BUTTON, x = b.x, y = b.y + b.h + 4, w = b.w, h = 16;
  roundRectPath(x, y, w, h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fill();
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(s.high > 0 ? '🌿' : s.nabito > 0 ? '⚡' : s.coffee > 0 ? '☕' : '🍔', x + 5, y + h / 2 + 1);
  const bx = x + 24, bw = w - 30, k = s.energy / 100;
  roundRectPath(bx, y + 4, bw, h - 8, 4); ctx.fillStyle = '#263238'; ctx.fill();
  if (k > 0) {
    roundRectPath(bx, y + 4, Math.max(6, bw * k), h - 8, 4);
    ctx.fillStyle = s.energy < HUNGER.LOW ? (Math.sin(state.time * 6) > 0 ? '#e53935' : '#b71c1c') : s.energy < 60 ? '#fbc02d' : '#43a047';
    ctx.fill();
  }
  // záchod (💩): pod hladem, hnědý, u konce bliká
  const y2 = y + h + 3, wc = Math.min(1, (s.wc || 0) / WC.MAX);
  roundRectPath(x, y2, w, h, 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillText('💩', x + 5, y2 + h / 2 + 1);
  roundRectPath(bx, y2 + 4, bw, h - 8, 4); ctx.fillStyle = '#263238'; ctx.fill();
  if (wc > 0) {
    roundRectPath(bx, y2 + 4, Math.max(6, bw * wc), h - 8, 4);
    ctx.fillStyle = wc >= 0.9 ? (Math.sin(state.time * 8) > 0 ? '#e53935' : '#6d4c41') : wc >= WC.WARN / WC.MAX ? '#a1662f' : '#8d6e63';
    ctx.fill();
  }
}

// =====================================================================
// PENĚŽENKA PRO CHÁNA – v peněžence je náhodně 50–300 Kč; hráč u Chána vybere,
// kolik mu dá, zbytek si nechá. Když nechané peníze utratí, objeví se motorka.
// =====================================================================
const GIVE_PANEL = { x: 180, y: 150, w: 440, h: 270 };
const giveButtons = () => {
  const P = GIVE_PANEL, y = P.y + 150;
  return [
    { id: -50, label: '−50', rect: { x: P.x + 24, y, w: 70, h: 40 } },
    { id: -10, label: '−10', rect: { x: P.x + 102, y, w: 70, h: 40 } },
    { id: 10, label: '+10', rect: { x: P.x + 268, y, w: 70, h: 40 } },
    { id: 50, label: '+50', rect: { x: P.x + 346, y, w: 70, h: 40 } },
    { id: 'ok', label: 'Dát Chánovi', rect: { x: P.x + 120, y: P.y + 206, w: 200, h: 44 } },
  ];
};
questById('penezenka').item.onPick = () => {
  state.story.wallet = 10 * (5 + Math.floor(Math.random() * 26));   // 50, 60 … 300 Kč
  state.toast = { text: `Sebral jsi Chánovu peněženku – je v ní ${state.story.wallet} Kč`, t: CONFIG.TOAST_TIME + 1 };
};
function giveMove(d) {
  const g = state.giveMenu;
  g.give = Math.max(0, Math.min(state.story.wallet, g.give + d));
  playSound([[600 + g.give, 0, 0.04]]);
}
function giveConfirm() {
  const total = state.story.wallet, give = state.giveMenu.give, kept = total - give;
  state.giveMenu = null;
  state.money += kept;
  Object.assign(state.story, { wallet: 0, chanKept: kept, chanSpent: 0 });
  setQuestStage(questById('penezenka'), 'done');
  const chan = TEACHERS.chan;
  if (give === total) storyDialog(chan, 'Díky, Romane! Ani korunu jsi nevzal – poctivec. Jdu si dát kafe.');
  else if (give >= 40) storyDialog(chan, `Hm… ${give} Kč? Myslel jsem, že tam toho bylo víc. No, na kafe to stačí. Díky.`);
  else if (give > 0) storyDialog(chan, `Cože, jen ${give} Kč? Za to si ani kafe nekoupím!`);
  else storyDialog(chan, 'Prázdná?! Romane… no nic. Asi jsem ji vybral sám. Asi.');
  if (kept) state.toast = { text: `Nechal sis ${kept} Kč`, t: CONFIG.TOAST_TIME };
  saveProgress();
}
function giveMenuEvents(events) {
  for (const ev of events) {
    if (ev.type === 'action') { giveConfirm(); return; }
    if (ev.x == null) continue;
    const b = giveButtons().find((bb) => pointInRect(ev.x, ev.y, bb.rect, 4));
    if (!b) continue;
    if (b.id === 'ok') { giveConfirm(); return; }
    giveMove(b.id);
  }
}
function drawGiveMenu() {
  const g = state.giveMenu;
  if (!g) return;
  const P = GIVE_PANEL, total = state.story.wallet;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.stroke();
  drawIcon('wallet', P.x + 44, P.y + 40, 44);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#3b2a1c';
  ctx.fillText('Kolik dáš Chánovi?', P.x + 80, P.y + 32);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#6b5a48';
  ctx.fillText(`V peněžence je ${total} Kč – co nedáš, necháš si.`, P.x + 80, P.y + 56);
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif'; ctx.fillStyle = '#2e7d32';
  ctx.fillText(`${g.give} Kč`, P.x + P.w / 2, P.y + 110);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#6b5a48';
  ctx.fillText(`necháš si ${total - g.give} Kč`, P.x + P.w / 2, P.y + 140);
  for (const b of giveButtons()) {
    const ok = b.id === 'ok';
    roundRectPath(b.rect.x, b.rect.y, b.rect.w, b.rect.h, 10);
    ctx.fillStyle = ok ? '#2e7d32' : '#8a5a2e'; ctx.fill();
    ctx.font = ok ? 'bold 18px sans-serif' : 'bold 16px sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText(b.label, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2 + 1);
  }
  if (!isTouchHint()) {
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText('← → po 10 Kč  ·  ↑ ↓ po 50 Kč  ·  mezerník = dát', P.x + P.w / 2, P.y + P.h + 18);
  }
}
// Kolik je v nesené peněžence (jen dokud ji hráč nese Chánovi) – dá se z ní platit
const walletCash = () => (questStage(questById('penezenka')) === 'carrying' ? state.story.wallet : 0);
// Nákup v bufetu / kávovaru (07_kresleni.js): první nákup po tom, co si hráč z peněženky
// něco nechal = utrácí Chánovy peníze (všechny by často nešly utratit – na nic už nezbude)
// Placení přímo z peněženky (když vlastní peníze nestačí) je taky utrácení Chánových peněz.
function storySpent(price, fromWallet = 0) {
  const s = state.story;
  if ((!s.chanKept && !fromWallet) || s.motorka) return;
  s.chanSpent += price;
  s.motorka = true;   // utratil Chánovy peníze → Chán chce opravit motorku
  state.toast = { text: '📣 Utratil jsi Chánovy peníze… Chán tě shání! (nový úkol)', t: CONFIG.TOAST_TIME + 2 };
}

// =====================================================================
// MOTORKA – na volném stání dole na parkovišti; kanystr je v kabinetu 4 v Céčku.
// U motorky (s kanystrem) se pospojují dráty a dolije benzín.
// =====================================================================
const MOTORKA = { room: 'parkoviste', at: { x: 225 / 640, y: 432 / 480 }, w: 99, h: 39, scale: 1.5 };   // kreslí se 66 × 26 a zvětší
const motorkaShown = () => state.story.motorka;
function motorkaRect() {
  const room = ROOMS[MOTORKA.room];
  return rectInRoom(room, MOTORKA.at, MOTORKA.w, MOTORKA.h);
}
function motorkaSpot() {
  if (!motorkaShown() || state.room.id !== MOTORKA.room) return null;
  return motorkaRect();
}
function motorkaAct() {
  const q = questById('motorka'), st = questStage(q);
  const who = { name: '🏍️ Chánova motorka', color: '#c62828' };
  if (st === 'done') { storyDialog(who, 'Motorka je jako nová. Chán na ní jezdí s úsměvem.'); return; }
  if (st === 'none') { storyDialog(who, 'Tohle je Chánova motorka. Nejede. Zeptej se Chána, co s ní.'); return; }
  if (st === 'assigned') { storyDialog(who, 'Dráty pod sedlem jsou vytržené a nádrž je prázdná. Nejdřív sežeň benzín – kanystr je v Kabinetu Chána.'); return; }
  startWires();
}
SPOTS.push({ rect: motorkaSpot, act: motorkaAct, hintDx: 0 });

// Motorka shora, předek vpravo: kola, rám, nádrž, sedlo, řídítka; rozbitá kouří
function drawMotorkaWorld() {
  if (!motorkaShown() || state.room.id !== MOTORKA.room) return;
  const R = motorkaRect(), fixed = questStage(questById('motorka')) === 'done';
  ctx.save();
  ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
  ctx.scale(MOTORKA.scale, MOTORKA.scale);
  const r = { x: -33, y: -13, w: 66, h: 26 }, cx = 0, cy = 0;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(cx + 3, cy + 4, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  roundRectPath(r.x, cy - 6, 18, 12, 5); ctx.fill();               // zadní kolo
  roundRectPath(r.x + r.w - 18, cy - 5, 18, 10, 5); ctx.fill();    // přední kolo
  ctx.fillStyle = '#9e9e9e'; ctx.fillRect(r.x + 10, cy - 2, r.w - 20, 4);   // rám
  roundRectPath(r.x + 16, cy - 7, 22, 14, 6); ctx.fillStyle = '#212121'; ctx.fill();          // sedlo
  roundRectPath(r.x + 34, cy - 8, 18, 16, 7); ctx.fillStyle = fixed ? '#e53935' : '#a83a2e'; ctx.fill();   // nádrž
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.fillRect(r.x + 37, cy - 6, 10, 3);
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 3;                  // řídítka
  ctx.beginPath(); ctx.moveTo(r.x + r.w - 14, cy - 13); ctx.lineTo(r.x + r.w - 14, cy + 13); ctx.stroke();
  ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(r.x + r.w - 2, cy, 3, 0, Math.PI * 2); ctx.fill();   // světlo
  if (!fixed) {   // kouř a vytržené dráty
    ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r.x + 26, cy + 7); ctx.quadraticCurveTo(r.x + 22, cy + 18, r.x + 30, cy + 20); ctx.stroke();
    ctx.strokeStyle = '#1e88e5';
    ctx.beginPath(); ctx.moveTo(r.x + 30, cy + 7); ctx.quadraticCurveTo(r.x + 36, cy + 17, r.x + 40, cy + 15); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const k = (state.time * 0.6 + i / 3) % 1;
      ctx.fillStyle = `rgba(150, 150, 150, ${0.5 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(r.x + 10 - k * 6, cy - 8 - k * 30, 5 + k * 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// --- minihra Dráty: každý barevný drát vlevo spojit se stejnou barvou vpravo, pak dolít benzín
const WIRE_PANEL = { x: 150, y: 110, w: 500, h: 400 };
const WIRE_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
const wireNode = (side, i) => ({ x: WIRE_PANEL.x + (side === 'L' ? 110 : WIRE_PANEL.w - 110), y: WIRE_PANEL.y + 110 + i * 60 });
function startWires() {
  const right = [0, 1, 2, 3];
  do { right.sort(() => Math.random() - 0.5); } while (right.every((c, i) => c === i));   // ať to není hned popořadě
  state.wires = { right, side: 'L', cur: 0, picked: null, done: [], phase: 'wires', t: 0, buzz: 0 };
}
function wiresPick(side, i) {
  const w = state.wires;
  if (w.phase !== 'wires') return;
  if (side === 'L') {
    if (w.done.includes(i)) return;
    w.picked = i; w.side = 'R';
    playSound([[700, 0, 0.04]]);
    return;
  }
  if (w.picked === null) return;
  if (w.right[i] === w.picked) {
    w.done.push(w.picked);
    playSound([[880, 0, 0.06], [1175, 0.07, 0.08]]);
    if (w.done.length === WIRE_COLORS.length) { w.phase = 'fuel'; w.t = 0; }
  } else {
    w.buzz = 0.4;
    playSound([[110, 0, 0.18]], 'sawtooth');
  }
  w.picked = null; w.side = 'L';
  w.cur = [0, 1, 2, 3].find((k) => !w.done.includes(k)) ?? 0;
}
function wiresEvents(events) {
  const w = state.wires;
  for (const ev of events) {
    if (ev.type === 'action') { wiresPick(w.side, w.cur); continue; }
    if (ev.x == null) continue;
    for (const side of ['L', 'R']) {
      for (let i = 0; i < 4; i++) {
        const n = wireNode(side, i);
        if (Math.hypot(ev.x - n.x, ev.y - n.y) < 28) { w.side = side; w.cur = i; wiresPick(side, i); }
      }
    }
  }
}
function updateWires(dt) {
  const w = state.wires;
  w.t += dt;
  w.buzz = Math.max(0, w.buzz - dt);
  if (w.phase === 'fuel' && w.t > 1.6) {
    state.wires = null;
    setQuestStage(questById('motorka'), 'done');
    playSound([[90, 0, 0.15], [110, 0.15, 0.15], [140, 0.3, 0.2], [180, 0.5, 0.35]], 'sawtooth');   // vrrrm
    storyDialog({ name: '🏍️ Chánova motorka', color: '#c62828' }, 'Vrrrrm! Dráty drží, nádrž je plná a motorka naskočila. Chán bude koukat – dluh je splacený.');
  }
}
function drawWires() {
  const w = state.wires;
  if (!w) return;
  const P = WIRE_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(P.x, P.y, P.w, P.h, 14);
  ctx.fillStyle = '#37474f'; ctx.fill();
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 4; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(w.phase === 'fuel' ? '⛽ Lévám benzín…' : '🔧 Pospojuj dráty pod sedlem', P.x + P.w / 2, P.y + 34);
  if (w.phase === 'fuel') {
    drawIcon('kanystr', P.x + P.w / 2 - 60, P.y + 200, 90);
    const k = Math.min(1, w.t / 1.4);
    roundRectPath(P.x + 80, P.y + 300, P.w - 160, 24, 8); ctx.fillStyle = '#263238'; ctx.fill();
    roundRectPath(P.x + 80, P.y + 300, (P.w - 160) * k, 24, 8); ctx.fillStyle = '#fbc02d'; ctx.fill();
    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText('Nádrž', P.x + P.w / 2 + 80, P.y + 200);
    return;
  }
  // hotové spoje
  for (const c of w.done) {
    const a = wireNode('L', c), b = wireNode('R', w.right.indexOf(c));
    ctx.strokeStyle = WIRE_COLORS[c]; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x + 120, a.y, b.x - 120, b.y, b.x, b.y); ctx.stroke();
  }
  // koncovky drátů
  for (const side of ['L', 'R']) {
    for (let i = 0; i < 4; i++) {
      const n = wireNode(side, i), color = WIRE_COLORS[side === 'L' ? i : w.right[i]];
      const stub = side === 'L' ? -1 : 1;
      ctx.strokeStyle = color; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(n.x + stub * 80, n.y); ctx.lineTo(n.x, n.y); ctx.stroke();
      const picked = side === 'L' && w.picked === i;
      const cursor = !isTouchHint() && w.side === side && w.cur === i;
      ctx.fillStyle = picked ? '#ffffff' : '#cfd8dc';
      ctx.beginPath(); ctx.arc(n.x, n.y, picked ? 15 : 12, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = cursor ? '#ffd54a' : '#263238';
      ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (w.buzz > 0) {   // špatně – jiskra
    ctx.fillStyle = `rgba(255, 82, 82, ${w.buzz})`;
    ctx.fillRect(P.x, P.y, P.w, P.h);
  }
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#cfd8dc';
  ctx.fillText(isTouchHint() ? 'Ťukni na drát vlevo a pak na stejnou barvu vpravo' : '↑ ↓ vyber, mezerník = vzít drát vlevo / připojit vpravo  ·  Esc = nechat být',
    P.x + P.w / 2, P.y + P.h - 20);
}

// =====================================================================
// TOMÁŠ KLUS A LILI – v C202 hraje Treplev (při každém vstupu od začátku). Lili prosí,
// ať hráč Kluse zabaví. Když s ním hráč začne mluvit, Lili vyběhne ze třídy; až hráč
// vyjde ven, rozejde se přes celou školu k Bečvářovi (kabinet A312) a tam zůstane.
// =====================================================================
const KLUS_ROOM = 'c202';
TEACHERS.lili.homeIdle = TEACHERS.lili.texts.idle;

TEACHERS.klus.talk = () => {
  const q = questById('klus');
  if (questStage(q) !== 'assigned' || TEACHERS.lili.running || TEACHERS.lili.room !== KLUS_ROOM) return false;
  storyDialog(TEACHERS.klus, 'Ahoj, já jsem Tomáš! Víš, jak vznikl Treplev? To jsem tenkrát seděl v divadle na Rackovi a říkám si… počkej, já ti to zahraju celé od začátku…');
  liliRunOut();
  return true;
};
TEACHERS.lili.talk = () => {
  if (state.story.lili === 'walking') {
    storyDialog(TEACHERS.lili, 'Psst, díky moc! Teď mě nezdržuj, mizím!');
    return true;
  }
  return false;   // jinak běžný úkol (zadání, čekání, poděkování u Bečváře)
};
// Chán: u něj se vybírá, kolik peněz z peněženky dostane; s kanystrem posílá k motorce
TEACHERS.chan.talk = () => {
  if (questStage(questById('penezenka')) === 'carrying') { state.giveMenu = { give: state.story.wallet }; return true; }
  const m = questById('motorka');
  if (!m.locked(state.story) && questStage(m) === 'carrying') {
    storyDialog(TEACHERS.chan, 'Benzín máš? Tak šup k motorce na parkoviště – a pospojuj tam ty dráty!');
    return true;
  }
  return false;
};
// Chválová nabízí trávu: Roman je pak 30 s pomalejší a motá se (chůze rovně lehce zatáčí)
const HIGH = { TIME: 30, SPEED: 0.6, TURN: 0.45 };
function highWobble(dir) {
  const s = state.story;
  if (!(s.high > 0) || (!dir.x && !dir.y)) return dir;
  const a = HIGH.TURN * (Math.sin(state.time * 1.1) * 0.75 + Math.sin(state.time * 2.6) * 0.35);   // pomalé houpání do stran
  const c = Math.cos(a), n = Math.sin(a);
  return { x: dir.x * c - dir.y * n, y: dir.x * n + dir.y * c };
}
TEACHERS.chvalova.talk = () => {
  const C = TEACHERS.chvalova;
  if (state.story.high > 0) {
    playScene([{ who: C, text: 'Hihi, tobě to ještě jede, co? Sedni si, ať nám neupadneš.' }]);
    return true;
  }
  playScene([
    { who: C, text: C.texts.idle },
    { who: C, text: 'Nedáš si? Je z vlastní zahrádky… teda z kabinetu. Úplně bio.' },
    { act: () => openChoice('🌿 Dáš si od Chválové?', [{ label: '🌿 Jo, dám si', note: '30 s motání' }, { label: 'Ne, díky' }], (i) => {
      if (i === 0) {
        state.story.high = HIGH.TIME;
        playScene([
          { text: '*šluk* … Ty jo. Ty stěny se nějak… vlní.' },
          { who: C, text: 'Hihi, vidíš? Teď jdi pomalu a hlavně rovně. Teda… zkus to.' },
        ], () => { state.toast = { text: '🌿 Roman se 30 sekund motá a chodí pomaleji', t: CONFIG.TOAST_TIME + 1 }; });
      } else playScene([{ who: C, text: 'Tak nic. Víc zbyde pro mě. Hihi.' }]);
    }) },
  ]);
  return true;
};
TEACHERS.myky.talk = () => {   // dal hráči sluchátka – jeho písničky jsou od teď i v albu Mix
  if (!state.story.headphones) state.toast = { text: '🎧 Máš sluchátka od Mykyho – jeho písničky jsou teď v albu Mix (P / Z)', t: CONFIG.TOAST_TIME + 2 };
  state.story.headphones = true;
  return false;
};

// Lili běží ke dveřím C202 (i během Klusova vyprávění) a zmizí
function liliRunOut() {
  const lili = TEACHERS.lili, room = ROOMS[KLUS_ROOM];
  const door = room.doors[0];
  state.solids = state.solids.filter((s) => s !== lili.rect);   // stála na místě = byla pevná
  lili.running = { x: lili.rect.x - room.x + lili.rect.w / 2, y: lili.rect.y - room.y + lili.rect.h / 2,
    tx: door.x - room.x + door.w / 2, ty: door.y - room.y + door.h + 10 };
  state.story.lili = 'running';
}
function updateLiliRun(dt) {
  const lili = TEACHERS.lili, r = lili.running;
  if (!r) return;
  const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy), step = 170 * dt;
  lili.walkBlend = 1;
  lili.walkPhase = (lili.walkPhase || 0) + dt * CONFIG.PLAYER_STEP_SPEED;
  if (d <= step) {   // je venku – zatím schovaná, rozejde se, až vyjde i hráč
    lili.running = null;
    lili.room = null;
    lili.rect = null;
    state.teachers = state.teachers.filter((t) => t !== lili);
    state.story.lili = 'escaped';
    setQuestStage(questById('klus'), 'carrying');
    return;
  }
  r.x += dx / d * step; r.y += dy / d * step;
  const room = ROOMS[KLUS_ROOM];
  lili.rect = { x: Math.round(room.x + r.x - CONFIG.TEACHER_W / 2), y: Math.round(room.y + r.y - CONFIG.TEACHER_H / 2), w: CONFIG.TEACHER_W, h: CONFIG.TEACHER_H };
}

// Hráč vyšel z C202 → Lili se rozejde z chodby před C202 k Bečvářovi
function liliStartWalk() {
  const lili = TEACHERS.lili;
  const door = ROOMS[KLUS_ROOM].doors[0];   // dveře C202 → chodba Céčka
  const from = ROOMS[door.to], ps = CONFIG.PLAYER_SIZE;
  const start = { x: door.spawn.x + ps / 2 - from.x, y: door.spawn.y + ps / 2 - from.y - 30 };
  const end = ROOMS[LILI_END.room];
  const route = buildRoute(door.to, start, LILI_END.room, { x: end.w * LILI_END.at.x, y: end.h * LILI_END.at.y });
  Object.assign(lili, { route, once: true, arrived: false, speed: 115, pause: 0,
    seg: 0, pt: 1, dirStep: 1, wait: 0, walkPhase: 0, walkBlend: 0,
    pos: { x: route[0].path[0][0], y: route[0].path[0][1] } });
  lili.onArrive = liliArrived;
  placeMovingTeacher(lili);
  state.story.lili = 'walking';
}
function liliArrived(lili) {
  lili.texts.idle = LILI_END_LINE;
  state.story.lili = 'arrived';
  if (state.room.id === LILI_END.room) state.toast = { text: `Lili: „${LILI_END_LINE}“`, t: CONFIG.TOAST_TIME + 2 };
}

// --- hledání cesty mezi zdmi a nábytkem (mřížka 10 px) – pro Lilinu trasu přes školu
function roomsPath(from, to) {   // nejkratší řada místností přes dveře
  const prev = { [from]: null }, queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) break;
    for (const d of ROOMS[id].doors) {
      if (d.to in prev || ROOMS[d.to].front || ROOMS[d.to].shop) continue;
      prev[d.to] = id; queue.push(d.to);
    }
  }
  const out = [];
  for (let id = to; id; id = prev[id]) out.unshift(id);
  return out;
}
function gridPath(room, a, b) {   // body v px od rohu místnosti
  const C = 10, half = 14, cols = Math.ceil(room.w / C), rows = Math.ceil(room.h / C);
  const solids = roomWalls(room).concat(room.obstacles.map((o) => o.rect))
    .map((s) => ({ x: s.x - room.x, y: s.y - room.y, w: s.w, h: s.h }));
  const freeAt = (x, y) => !solids.some((s) => x + half > s.x && x - half < s.x + s.w && y + half > s.y && y - half < s.y + s.h);
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free[r * cols + c] = freeAt(c * C + C / 2, r * C + C / 2) ? 1 : 0;
  const cell = (p) => Math.min(rows - 1, Math.max(0, Math.round((p.y - C / 2) / C))) * cols + Math.min(cols - 1, Math.max(0, Math.round((p.x - C / 2) / C)));
  const nearestFree = (i) => {   // start/cíl kousek ve zdi → nejbližší volná buňka
    if (free[i]) return i;
    let best = -1, bd = Infinity;
    const r0 = Math.floor(i / cols), c0 = i % cols;
    for (let r = Math.max(0, r0 - 6); r <= Math.min(rows - 1, r0 + 6); r++) {
      for (let c = Math.max(0, c0 - 6); c <= Math.min(cols - 1, c0 + 6); c++) {
        const d = (r - r0) ** 2 + (c - c0) ** 2;
        if (free[r * cols + c] && d < bd) { bd = d; best = r * cols + c; }
      }
    }
    return best;
  };
  const s = nearestFree(cell(a)), t = nearestFree(cell(b));
  if (s < 0 || t < 0) return [[a.x, a.y], [b.x, b.y]];
  const prev = new Int32Array(cols * rows).fill(-1);
  prev[s] = s;
  const queue = [s];
  for (let qi = 0; qi < queue.length && prev[t] < 0; qi++) {
    const i = queue[qi], r = Math.floor(i / cols), c = i % cols;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const j = nr * cols + nc;
      if (!free[j] || prev[j] >= 0) continue;
      if (dr && dc && (!free[r * cols + nc] || !free[nr * cols + c])) continue;   // šikmo jen kolem volných rohů
      prev[j] = i; queue.push(j);
    }
  }
  if (prev[t] < 0) return [[a.x, a.y], [b.x, b.y]];
  const cells = [];
  for (let i = t; ; i = prev[i]) { cells.unshift(i); if (i === s) break; }
  const pts = cells.map((i) => [(i % cols) * C + C / 2, Math.floor(i / cols) * C + C / 2]);
  // zjednodušení: z bodu rovnou k nejvzdálenějšímu, na který je volný výhled
  const clear = (p, q) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let k = 0; k <= d; k += 4) if (!freeAt(p[0] + (q[0] - p[0]) * k / d, p[1] + (q[1] - p[1]) * k / d)) return false;
    return true;
  };
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1;) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}
// Trasa přes víc místností: v každé od příchodu ke dveřím do další (kousek před nimi)
function buildRoute(fromRoom, fromPt, toRoom, toPt) {
  const ids = roomsPath(fromRoom, toRoom), route = [];
  let start = fromPt;
  ids.forEach((id, k) => {
    const room = ROOMS[id];
    let end = toPt, door = null;
    if (k < ids.length - 1) {
      door = room.doors.find((d) => d.to === ids[k + 1]);
      const inward = { top: [0, 26], bottom: [0, -26], left: [26, 0], right: [-26, 0] }[door.side];
      end = { x: door.x - room.x + door.w / 2 + inward[0], y: door.y - room.y + door.h / 2 + inward[1] };
    }
    route.push({ room: id, path: gridPath(room, start, end) });
    if (door) {
      const next = ROOMS[ids[k + 1]], ps = CONFIG.PLAYER_SIZE;
      start = { x: door.spawn.x + ps / 2 - next.x, y: door.spawn.y + ps / 2 - next.y };
    }
  });
  return route;
}

// =====================================================================
// KAŽDÝ SNÍMEK HRY (06_logika.js) a překryvná okna
// =====================================================================
function updateStory(dt) {
  updateLiliRun(dt);
  updatePivo(dt);   // Kuba odlákává Soumara, Soumar hlídá předsíň (21_pivo.js)
  updateStruny(dt);   // čas na vrácení kleští, Binková hlídá (22_struny.js)
  updateDamien(dt);   // šatna zavřená, po minutě vyjdou a jdou zpátky (24_damien.js)
  if (state.wires) updateWires(dt);
  // změna místnosti: Treplev v C202, Lili se rozejde, až hráč vyjde z C202
  const id = state.room.id;
  if (id !== state.story.lastRoom) {
    const was = state.story.lastRoom;
    state.story.lastRoom = id;
    if (id === KLUS_ROOM && TEACHERS.klus.room === KLUS_ROOM) setMusicTrack('klus', true);
    else if (was === KLUS_ROOM && audio.track === 'klus') setMusicTrack('main');
    if (was === KLUS_ROOM && state.story.lili === 'escaped') liliStartWalk();
  }
}
// Otevřené okno příběhu spotřebuje vstupy (hra stojí); true = něco bylo otevřené
function storyOverlayEvents(events) {
  if (state.board) return true;   // psaní na tabuli (24_damien.js) – hra stojí
  if (state.inventory) { inventoryEvents(events); return true; }
  if (state.choice && !vrahOn()) { choiceEvents(events); return true; }   // volba v hlavní hře (Chválová)
  if (state.giveMenu) { giveMenuEvents(events); return true; }
  if (state.wires) { wiresEvents(events); return true; }
  return false;
}
function drawStoryOverlays() {
  drawInventory();
  drawGiveMenu();
  drawWires();
  drawStrunyHud();
  if (!vrahOn()) drawChoice();
}

window.addEventListener('keydown', (e) => {
  if (state.screen !== 'playing') return;
  if (CONFIG.INVENTORY_KEYS.includes(e.code) && !e.repeat && !state.giveMenu && !state.wires) { toggleInventory(); return; }
  if (state.inventory && e.code === 'Escape') { state.inventory = null; return; }
  if (state.inventory) {   // šipky = výběr karty
    const n = Math.min(12, inventoryItems().length), c = INV_CARD.cols, inv = state.inventory;
    if (KEYMAP.left.includes(e.code)) inv.sel = Math.max(0, inv.sel - 1);
    else if (KEYMAP.right.includes(e.code)) inv.sel = Math.min(n - 1, inv.sel + 1);
    else if (KEYMAP.up.includes(e.code)) inv.sel = Math.max(0, inv.sel - c);
    else if (KEYMAP.down.includes(e.code)) inv.sel = Math.min(n - 1, inv.sel + c);
    return;
  }
  const up = KEYMAP.up.includes(e.code), down = KEYMAP.down.includes(e.code);
  const left = KEYMAP.left.includes(e.code), right = KEYMAP.right.includes(e.code);
  if (state.giveMenu) {
    if (left) giveMove(-10); else if (right) giveMove(10);
    else if (up) giveMove(50); else if (down) giveMove(-50);
  }
  if (state.wires && state.wires.phase === 'wires') {
    const w = state.wires;
    if (e.code === 'Escape') { state.wires = null; return; }
    if (up) w.cur = (w.cur + 3) % 4;
    else if (down) w.cur = (w.cur + 1) % 4;
    else if (left) w.side = 'L';
    else if (right && w.picked !== null) w.side = 'R';
  }
});
