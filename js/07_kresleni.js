// Vykreslování, pohled Před školou, bufet a kávovar
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// VYKRESLOVÁNÍ
// =====================================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Canvas se proporčně vejde do okna; vnitřně kreslíme v 800x600.
// Na mobilu na šířku je plátno širší (VIEW.w = 600 × poměr stran): svět se kreslí přes celou
// šířku, rozhraní (lišta, tlačítka, dialogy, minihry) zůstává v 800 px uprostřed (VIEW.offX).
// Backing store násobíme devicePixelRatio, aby byl obraz ostrý.
const VIEW = { w: 800, offX: 0, sx: 1, sy: 1 };
function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  VIEW.w = isMobileView() && aspect > CONFIG.WIDTH / CONFIG.HEIGHT ? Math.round(CONFIG.HEIGHT * aspect) : CONFIG.WIDTH;
  VIEW.offX = (VIEW.w - CONFIG.WIDTH) / 2;
  applyUiSize();
  const scale = Math.min(window.innerWidth / VIEW.w, window.innerHeight / CONFIG.HEIGHT);
  const cssW = Math.floor(VIEW.w * scale);
  const cssH = Math.floor(CONFIG.HEIGHT * scale);
  const dpr = renderScale();   // výchozí: devicePixelRatio, nízká kvalita: poloviční (30_kvalita.js)
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  VIEW.sx = canvas.width / VIEW.w; VIEW.sy = canvas.height / CONFIG.HEIGHT;
  ctx.setTransform(VIEW.sx, 0, 0, VIEW.sy, VIEW.offX * VIEW.sx, 0);   // 800 px rozhraní uprostřed
  ctx.imageSmoothingEnabled = false;
}
// Mobil: rozhraní se kreslí menší (plátno 600 px vysoké na ~390 px displeje), proto větší písmo
const UI_DESKTOP = {};
const UI_MOBILE = {
  TASK_FONT: '19px sans-serif', COUNTER_FONT: 'bold 18px sans-serif', TITLE_FONT_SIZE: 27,
  TOAST_FONT: 'bold 21px sans-serif', HINT_FONT: 'bold 16px sans-serif',
  DIALOG_NAME_FONT: 'bold 23px sans-serif', DIALOG_TEXT_FONT: '23px sans-serif', DIALOG_CONTINUE_FONT: '16px sans-serif',
  DIALOG_LINE_HEIGHT: 30, DIALOG_HEIGHT: 182, MENU_SMALL_FONT: '16px sans-serif', BUTTON_FONT: 'bold 26px sans-serif',
  BUTTON_H: 62,
};
function applyUiSize() {
  for (const k of Object.keys(UI_MOBILE)) if (!(k in UI_DESKTOP)) UI_DESKTOP[k] = CONFIG[k];
  Object.assign(CONFIG, isMobileView() ? UI_MOBILE : UI_DESKTOP);
}
// Každý snímek: smazat celé plátno (i okraje mimo 800 px uprostřed)
function clearCanvas() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

function drawRect(r, color) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

// Vykreslení samotné hry (místnost, postavy, rozhraní)
// =====================================================================
// PŘED ŠKOLOU – pohled zepředu
// =====================================================================
const FRONT = {
  FEET_Y: 484,        // kde stojí hráč na chodníku (px v místnosti)
  GATE_Y: 432,        // kam dojde při vstupu do brány
  SCALE: 1.5,         // postavička je v tomhle pohledu větší
  ENTER_TIME: 0.6,    // animace vstupu do brány (s)
};

// Budova gymnázia zepředu (podle fotky „budova školy.jpg“): žlutá fasáda, bílé
// římsy, nárožní bosáž, šedý ornamentální vlys pod římsou, okna se štítky,
// střední rizalit se stupňovitým štítem, obeliskovými ozdobami a věžičkou
// s hodinami a zelenou měděnou bání. Souřadnice jsou px v místnosti.
const SCHOOL = {
  x: 300, w: 1000,          // celá budova (hráč dál do stran nedojde)
  rizX: 650, rizW: 300,     // střední rizalit
  cornice: 112,             // hlavní římsa křídel
  rizCornice: 84,           // římsa rizalitu
  base: 350,                // začátek kamenného soklu
  yellow: '#e9cf7a', yellowDark: '#dcbc62', white: '#f6f2e6', shade: '#c9b98f',
  glass: '#55687a', glassLight: '#7d93a6', ornament: '#8f9696', roof: '#5a4f47',
};

// wings = false: jen střední rizalit bez křídel (úvodní obrazovka)
function drawSchoolFront(room, { wings: withWings = true } = {}) {
  const S = SCHOOL;
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  const R = (x, y, w, h, c) => drawRect({ x: X(x), y: Y(y), w, h }, c);
  const poly = (pts, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
  };
  const right = S.x + S.w, rizR = S.rizX + S.rizW;

  // obeliskové ozdoby na štítech
  const finial = (x, y) => {
    R(x - 4, y - 6, 8, 6, S.white);
    poly([[x - 3, y - 6], [x + 3, y - 6], [x, y - 20]], '#8d8a83');
    ctx.fillStyle = '#8d8a83'; ctx.beginPath(); ctx.arc(X(x), Y(y - 21), 2, 0, Math.PI * 2); ctx.fill();
  };
  // stupňovitý štít (atika) s ozdobami
  const steppedGable = (cx, w, y, h, topFinial = true) => {
    const steps = 3, sw = w / 2 / (steps + 1), l = cx - w / 2, r = cx + w / 2;
    const lv = (i) => y - h * (i + 1) / (steps + 1);   // výška i-tého stupně
    const left = [[l, y]], rightPts = [[r, y]];
    for (let i = 0; i <= steps; i++) {
      left.push([l + sw * i, lv(i)], [l + sw * (i + 1), lv(i)]);
      rightPts.push([r - sw * i, lv(i)], [r - sw * (i + 1), lv(i)]);
    }
    left.pop(); rightPts.pop();
    const pts = left.concat(rightPts.reverse());
    poly(pts, S.yellow);
    ctx.strokeStyle = S.white; ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach(([x, yy], i) => (i ? ctx.lineTo(X(x), Y(yy)) : ctx.moveTo(X(x), Y(yy))));
    ctx.stroke();
    // kulaté okénko ve štítu
    ctx.fillStyle = S.white; ctx.beginPath(); ctx.arc(X(cx), Y(y - h * 0.42), 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = S.glass; ctx.beginPath(); ctx.arc(X(cx), Y(y - h * 0.42), 6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < steps; i++) { finial(l + sw * i + 3, lv(i)); finial(r - sw * i - 3, lv(i)); }
    if (topFinial) finial(cx, y - h);
  };
  // šedý ornamentální vlys (sgrafito) pod římsou
  const frieze = (x, y, w, h) => {
    R(x, y, w, h, S.ornament);
    ctx.fillStyle = S.white;
    for (let i = x + 8; i < x + w - 4; i += 16) {
      ctx.beginPath(); ctx.arc(X(i), Y(y + h / 2), h * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = x; i < x + w; i += 16) { ctx.moveTo(X(i), Y(y + h)); ctx.quadraticCurveTo(X(i + 8), Y(y), X(i + 16), Y(y + h)); }
    ctx.stroke();
  };
  // římsa se zubořezem
  const cornice = (x, y, w) => {
    R(x - 6, y - 8, w + 12, 9, S.white);
    R(x - 3, y + 1, w + 6, 3, S.shade);
    for (let i = x; i < x + w; i += 7) R(i, y + 4, 4, 4, S.white);
  };
  // nárožní bosáž (střídavé bílé kvádry)
  const quoins = (x, y0, y1, side) => {
    for (let y = y0, i = 0; y < y1; y += 16, i++) {
      const w = i % 2 ? 12 : 20;
      R(side < 0 ? x : x - w, y, w, 13, S.white);
    }
  };
  // okno: rám, příčle, typ hlavice: 'arch' | 'pediment' | 'cap' | 'segment'
  const win = (cx, y, w, h, top) => {
    const x = cx - w / 2;
    R(x - 4, y - 3, w + 8, h + 7, S.white);
    if (top === 'arch' || top === 'segment') {
      const r = top === 'arch' ? w / 2 + 4 : w / 2 + 6;
      ctx.fillStyle = S.white; ctx.beginPath();
      if (top === 'arch') ctx.arc(X(cx), Y(y), r, Math.PI, 0);
      else ctx.ellipse(X(cx), Y(y), r, 7, 0, Math.PI, 0);
      ctx.fill();
      R(cx - 3, y - (top === 'arch' ? r : 9), 6, 7, S.shade);   // klenák
    }
    R(x, y, w, h, S.glass);
    if (top === 'arch') { ctx.fillStyle = S.glass; ctx.beginPath(); ctx.arc(X(cx), Y(y), w / 2, Math.PI, 0); ctx.fill(); }
    R(x + 2, y + 2, w / 2 - 3, h * 0.42, S.glassLight);
    R(cx - 1, y - (top === 'arch' ? w / 2 : 0), 2, h + (top === 'arch' ? w / 2 : 0), S.white);
    R(x, y + h * 0.45, w, 2, S.white);
    R(x - 6, y + h + 3, w + 12, 4, S.white);   // parapet
    if (top === 'pediment') poly([[x - 7, y - 4], [cx, y - 16], [x + w + 7, y - 4]], S.white);
    if (top === 'cap') { R(x - 7, y - 9, w + 14, 5, S.white); R(x - 3, y - 4, w + 6, 2, S.shade); }
  };

  const wings = [[S.x, S.rizX], [rizR, right]];
  if (withWings) {
    // střecha křídel
    poly([[S.x - 4, S.cornice - 8], [S.x + 24, S.cornice - 36], [right - 24, S.cornice - 36], [right + 4, S.cornice - 8]], S.roof);
    for (const cx of [S.x + 70, right - 70]) {   // komíny
      R(cx - 8, S.cornice - 56, 16, 24, '#b9a98a'); R(cx - 10, S.cornice - 58, 20, 4, S.white);
    }
    // atiky uprostřed křídel
    for (const [a, b] of wings) steppedGable((a + b) / 2, 96, S.cornice - 6, 30);

    // fasáda křídel
    for (const [a, b] of wings) {
      R(a, S.cornice, b - a, S.base - S.cornice, S.yellow);
      frieze(a, S.cornice + 4, b - a, 14);
      cornice(a, S.cornice, b - a);
      // patrové římsy
      R(a, 198, b - a, 6, S.white); R(a, 204, b - a, 2, S.shade);
      R(a, 274, b - a, 7, S.white); R(a, 281, b - a, 2, S.shade);
      // přízemí s bílými pásy (bosáž)
      for (let y = 290; y < S.base; y += 12) R(a, y, b - a, 3, S.white);
      // okna: 4 v každém křídle
      for (let i = 0; i < 4; i++) {
        const cx = a + 50 + i * 83;
        win(cx, 142, 34, 46, 'cap');
        win(cx, 222, 34, 42, 'pediment');
        R(cx - 14, 270, 28, 3, S.shade);                // podokenní ozdobný pás
        win(cx, 300, 32, 38, 'segment');
      }
      // ozdobné panely mezi okny ve 2. patře (medailony)
      for (let i = 0; i < 3; i++) {
        const px = a + 91 + i * 83;
        R(px - 6, 150, 12, 34, S.yellowDark);
        ctx.fillStyle = S.ornament; ctx.beginPath(); ctx.ellipse(X(px), Y(167), 4, 9, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    quoins(S.x, S.cornice + 2, S.base, -1);
    quoins(right, S.cornice + 2, S.base, 1);
  }

  // --- střední rizalit ---
  const rx = S.rizX, rw = S.rizW, rc = S.rizX + S.rizW / 2;
  // věžička s hodinami a zelenou bání (za štítem)
  R(rc - 20, 14, 40, 36, S.yellow);
  R(rc - 22, 12, 44, 5, S.white);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X(rc), Y(32), 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#333333'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(rc), Y(32)); ctx.lineTo(X(rc), Y(24)); ctx.moveTo(X(rc), Y(32)); ctx.lineTo(X(rc + 6), Y(32)); ctx.stroke();
  for (const fx of [rc - 22, rc + 22]) finial(fx, 14);
  ctx.fillStyle = '#5f9e86';   // cibulová báň
  ctx.beginPath();
  ctx.moveTo(X(rc - 20), Y(12));
  ctx.bezierCurveTo(X(rc - 24), Y(-2), X(rc - 6), Y(-4), X(rc - 3), Y(-14));
  ctx.lineTo(X(rc + 3), Y(-14));
  ctx.bezierCurveTo(X(rc + 6), Y(-4), X(rc + 24), Y(-2), X(rc + 20), Y(12));
  ctx.closePath(); ctx.fill();
  R(rc - 8, -2, 3, 12, 'rgba(255, 255, 255, 0.25)');
  R(rc - 1, -30, 2, 16, '#3f6f5d');
  ctx.fillStyle = '#c9a646'; ctx.beginPath(); ctx.arc(X(rc), Y(-30), 2.5, 0, Math.PI * 2); ctx.fill();

  steppedGable(rc, rw - 40, S.rizCornice - 6, 36, false);
  R(rx, S.rizCornice, rw, S.base - S.rizCornice, S.yellow);
  frieze(rx, S.rizCornice + 4, rw, 16);
  cornice(rx, S.rizCornice, rw);
  // 5 obloukových oken nahoře
  for (let i = 0; i < 5; i++) win(rx + 46 + i * 52, 132, 30, 50, 'arch');
  // pás s nápisem
  R(rx + 14, 194, rw - 28, 22, S.white);
  R(rx + 18, 197, rw - 36, 16, '#efe9d6');
  ctx.font = 'bold 15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a6d1f'; ctx.fillText('G Y M N A S I U M', X(rc), Y(206));
  // 1. patro a přízemí
  for (let i = 0; i < 5; i++) win(rx + 46 + i * 52, 230, 30, 36, i === 2 ? 'pediment' : 'cap');
  R(rx, 274, rw, 7, S.white); R(rx, 281, rw, 2, S.shade);
  for (let y = 290; y < S.base; y += 12) R(rx, y, rw, 3, S.white);
  for (let i = 0; i < 5; i++) if (i !== 2) win(rx + 46 + i * 52, 300, 28, 38, 'segment');
  // hlavní vchod uprostřed rizalitu
  R(rc - 22, 292, 44, 58, S.white);
  ctx.fillStyle = S.white; ctx.beginPath(); ctx.arc(X(rc), Y(296), 22, Math.PI, 0); ctx.fill();
  R(rc - 16, 296, 32, 54, '#6b4a2b');
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(X(rc), Y(296), 16, Math.PI, 0); ctx.fill();
  R(rc - 1, 286, 2, 64, '#4f3520');
  poly([[rc - 30, 282], [rc, 266], [rc + 30, 282]], S.white);
  // nárožní bosáž rizalitu
  quoins(rx, S.rizCornice + 2, S.base, -1);
  quoins(rx + rw, S.rizCornice + 2, S.base, 1);
  if (withWings) {   // stín rizalitu na křídlech (vystupuje dopředu)
    R(rx - 6, S.cornice + 6, 6, S.base - S.cornice - 6, 'rgba(0, 0, 0, 0.08)');
    R(rx + rw, S.cornice + 6, 6, S.base - S.cornice - 6, 'rgba(0, 0, 0, 0.08)');
  }

  // kamenný sokl
  const [sx, sw] = withWings ? [S.x, S.w] : [rx, rw];
  R(sx, S.base, sw, 40, '#a8a194');
  for (let x = sx; x < sx + sw; x += 34) R(x, S.base, 1, 40, 'rgba(0, 0, 0, 0.15)');
  R(sx, S.base, sw, 3, '#c4beb1');
  if (withWings) for (const [a, b] of wings) for (let i = 0; i < 4; i++) R(a + 50 + i * 83 - 10, S.base + 10, 20, 12, '#5d5a55');   // sklepní okénka
}

// ---------------------------------------------------------------------
// BUFET – nákup: řádky tabule = nabídka + „Odejít“
// ---------------------------------------------------------------------
// Každý obchod: nabídka a tabule / ceník, na který se dá ťuknout (px v místnosti)
const SHOPS = {
  bufet:   { menu: BUFET_MENU,   board: { x: 40,  y: 250, w: 270, h: 268, row: 24, top: 52 } },
  kavovar: { menu: KAVOVAR_MENU, board: { x: 572, y: 120, w: 200, h: 290, row: 32, top: 64 } },
};
const shopMenu = () => SHOPS[state.room.id].menu;
const SHOP_ROWS = () => shopMenu().length + 1;

function shopMove(d) {
  state.shopSel = (state.shopSel + d + SHOP_ROWS()) % SHOP_ROWS();
  playSound([[660, 0, 0.04]]);
}

function shopLeave() {
  if (!state.transition) state.transition = { door: state.room.doors[0], t: 0, switched: false };
}

function shopBuy(i) {
  if (i >= shopMenu().length) { shopLeave(); return; }
  const item = shopMenu()[i];
  const cash = state.money + walletCash();   // s Chánovou peněženkou se dá doplatit z ní (17_pribehy.js)
  if (cash < item.price) {
    state.toast = { text: `Na ${item.name.toLowerCase()} nemáš – chybí ${item.price - cash} Kč`, t: CONFIG.TOAST_TIME };
    playSound(CONFIG.SOUND_MISS);
    return;
  }
  const fromWallet = Math.max(0, item.price - state.money);   // nejdřív vlastní peníze, zbytek z peněženky
  state.money -= item.price - fromWallet;
  state.story.wallet -= fromWallet;
  const paid = fromWallet ? ` – ${fromWallet} Kč z Chánovy peněženky` : '';
  playSound(CONFIG.SOUND_PICKUP);
  const q = buyQuestFor(item);
  if (state.room.id === 'kavovar') state.cupTime = state.time;   // v okénku se objeví kelímek
  if (q) {
    setQuestStage(q, 'carrying');   // nese věc učiteli
    const t = TEACHERS[q.teacher];
    state.toast = { text: `Koupil jsi ${q.itemName || item.name.toLowerCase()} pro ${t.pro || t.name} (−${item.price} Kč${paid})`, t: CONFIG.TOAST_TIME };
  } else {
    state.bag.push(item.name);
    state.toast = { text: `Koupil sis: ${item.name} (−${item.price} Kč${paid})`, t: CONFIG.TOAST_TIME };
  }
  storySpent(item.price, fromWallet);   // utrácí Chánovy peníze? (17_pribehy.js)
  saveProgress();
}

function shopEvent(ev) {
  if (state.transition) return;
  if (ev.type === 'action') { shopBuy(state.shopSel); return; }
  if (ev.type === 'tap' && ev.x != null) {   // ťuknutí na řádku tabule = vybrat a koupit
    const room = state.room, b = SHOPS[room.id].board;
    const lx = ev.x - room.x, ly = ev.y - room.y;
    if (lx < b.x || lx > b.x + b.w) return;
    const i = Math.floor((ly - (b.y + b.top - b.row * 0.7)) / b.row);
    if (i >= 0 && i < SHOP_ROWS()) { state.shopSel = i; shopBuy(i); }
  }
}

// Bufet zepředu (podle fotky): světle modrá zeď, bílý rám dveří, dole pultík (spodní
// polovina dveří), nad ním okénko do kantýny s regály, lednicí, kávovarem a paní z bufetu;
// pootevřené křídlo dveří, radiátor, cedulka „A111 KANTÝNA“, vlevo tabule s nabídkou.
function renderShop(room) {
  if (room.id === 'kavovar') { renderKavovar(room); return; }
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  const R = (x, y, w, h, c) => drawRect({ x: X(x), y: Y(y), w, h }, c);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, CONFIG.ROOM_AREA_TOP - 14, CONFIG.WIDTH, CONFIG.HEIGHT); ctx.clip();
  // zeď a podlaha z teraca
  const wall = ctx.createLinearGradient(0, Y(0), 0, Y(440));
  wall.addColorStop(0, '#cfd9e2'); wall.addColorStop(1, '#e4eaef');
  ctx.fillStyle = wall; ctx.fillRect(X(0), Y(-20), room.w, 460);
  fillOldBuildingFloor({ x: X(0), y: Y(440), w: room.w, h: 88 });
  R(0, 436, room.w, 6, '#1d1f21');                                   // tmavý sokl
  // vlevo bílý sloup a kus okna
  R(0, 0, 70, 440, '#f2f4f5'); R(10, 60, 50, 230, '#9fb6c4'); R(10, 60, 50, 6, '#f2f4f5'); R(10, 175, 50, 4, '#f2f4f5');
  R(150, 0, 80, 440, '#f6f7f8'); R(226, 0, 8, 440, 'rgba(0, 0, 0, 0.08)');
  // cedulka A111 KANTÝNA
  R(244, 196, 64, 24, '#7a1f2b'); R(246, 198, 60, 20, '#8e2a37');
  ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3e6c4';
  ctx.fillText('A 111   KANTÝNA', X(276), Y(211));
  // rám dveří a pohled do kantýny
  R(318, 110, 236, 334, '#f7f8f8');
  R(330, 122, 212, 316, '#f1f3f5');                                  // zadní zeď kantýny
  R(400, 128, 76, 104, '#ffffff'); R(406, 134, 64, 92, '#cfe6f2');   // okno vzadu
  R(436, 134, 3, 92, '#ffffff'); R(406, 176, 64, 3, '#ffffff');
  // lednice s pitím
  R(334, 160, 44, 200, '#2c3e66'); R(338, 172, 36, 180, '#9ec7dd');
  const bottle = ['#e53935', '#43a047', '#fdd835', '#fb8c00', '#1e88e5'];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) R(341 + k * 8, 180 + r * 42, 6, 30, bottle[(r * 4 + k) % 5]);
  // regály se svačinami
  const snack = ['#f4511e', '#fbc02d', '#7cb342', '#d81b60', '#5e35b1', '#00897b', '#ef6c00', '#c0ca33'];
  for (let r = 0; r < 4; r++) {
    R(382, 236 + r * 30, 70, 3, '#b0a89a');
    for (let k = 0; k < 6; k++) R(384 + k * 11, 236 + r * 30 - 16 - (k % 2) * 3, 9, 16 + (k % 2) * 3, snack[(r * 6 + k) % snack.length]);
  }
  // paní z bufetu za pultem
  ctx.fillStyle = '#e9edf0'; ctx.beginPath(); ctx.ellipse(X(492), Y(330), 34, 46, 0, Math.PI, 0); ctx.fill();   // halena
  R(474, 300, 36, 40, '#ffffff');                                                                              // zástěra
  ctx.fillStyle = '#f0c8a8'; ctx.beginPath(); ctx.arc(X(492), Y(262), 20, 0, Math.PI * 2); ctx.fill();      // hlava
  ctx.fillStyle = '#6b4a2b'; ctx.beginPath(); ctx.arc(X(492), Y(256), 21, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(X(484), Y(262), 3, 3); ctx.fillRect(X(497), Y(262), 3, 3);
  ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(492), Y(268), 6, 0.2, Math.PI - 0.2); ctx.stroke();
  // kávovar a hrnky na pultu vpravo
  R(512, 252, 24, 50, '#8d949a'); R(516, 258, 16, 14, '#30353a'); R(520, 286, 8, 10, '#ffffff');
  // pultík: deska a spodní polovina dveří s ceníky
  R(326, 332, 220, 12, '#2f3236');
  R(336, 344, 200, 92, '#fbfbfa'); R(336, 344, 200, 3, '#d9dcdf');
  R(352, 356, 46, 62, '#ffffff'); R(352, 356, 46, 62, 'rgba(0, 0, 0, 0)');
  ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 1; ctx.strokeRect(X(352) + 0.5, Y(356) + 0.5, 46, 62); ctx.strokeRect(X(414) + 0.5, Y(352) + 0.5, 54, 40);
  ctx.fillStyle = '#c0392b'; for (let k = 0; k < 7; k++) ctx.fillRect(X(356), Y(362 + k * 8), 3, 3);
  ctx.fillStyle = '#9aa0a6'; for (let k = 0; k < 7; k++) ctx.fillRect(X(362), Y(362 + k * 8), 30, 2);
  for (let k = 0; k < 4; k++) ctx.fillRect(X(418), Y(358 + k * 8), 44, 2);
  R(337, 360, 5, 14, '#8d949a'); R(337, 410, 5, 14, '#8d949a');      // panty
  // pootevřené křídlo dveří vpravo
  ctx.fillStyle = '#f9fafa';
  ctx.beginPath(); ctx.moveTo(X(556), Y(112)); ctx.lineTo(X(640), Y(84)); ctx.lineTo(X(640), Y(470)); ctx.lineTo(X(556), Y(440)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#d5d9dc'; ctx.lineWidth = 2; ctx.stroke();
  R(612, 268, 8, 26, '#8d949a'); R(598, 270, 22, 5, '#9aa1a7');      // klika
  // radiátor
  R(664, 292, 136, 140, '#efe6c8');
  ctx.fillStyle = '#d8ccA6'; for (let x = 670; x < 800; x += 9) ctx.fillRect(X(x), Y(298), 3, 128);
  // tabule s nabídkou (na stojanu)
  const b = SHOPS.bufet.board;
  R(b.x - 8, b.y - 8, b.w + 16, b.h + 16, '#5d4630');
  R(b.x, b.y, b.w, b.h, '#22272a');
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillStyle = '#f4f1e8';
  ctx.fillText('BUFET – NABÍDKA', X(b.x + 14), Y(b.y + 22));
  ctx.font = 'bold 14px "Comic Sans MS", "Segoe Print", cursive';
  const rows = [...BUFET_MENU.map((m) => [m.name, m.price + ',-']), ['Odejít', '']];
  rows.forEach(([name, price], i) => {
    const y = b.y + b.top + i * b.row;
    const sel = i === state.shopSel;
    if (sel) { ctx.fillStyle = 'rgba(255, 213, 74, 0.18)'; ctx.fillRect(X(b.x + 4), Y(y - b.row / 2 + 1), b.w - 8, b.row - 2); }
    ctx.fillStyle = sel ? '#ffd54a' : (name === 'Odejít' ? '#b9c3c8' : '#f4f1e8');
    ctx.textAlign = 'left';
    ctx.fillText((sel ? '▸ ' : '  ') + name, X(b.x + 10), Y(y));
    ctx.textAlign = 'right';
    ctx.fillText(price, X(b.x + b.w - 12), Y(y));
  });
  drawShopInfo(room, 560);
  ctx.restore();
}

// Peníze, taška a nápověda (společné pro bufet i kávovar)
function drawShopInfo(room, hintX, hintY = 500) {
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  drawOutlinedText(`Peníze: ${state.money} Kč`, X(700), Y(24), 'bold 15px sans-serif', '#ffd54a', 'middle');
  if (state.bag.length) {
    const last = state.bag.slice(-3).join(', ');
    drawOutlinedText(`V tašce: ${last}${state.bag.length > 3 ? '…' : ''}`, X(640), Y(46), '12px sans-serif', '#ffffff', 'middle');
  }
  const hint = isTouchHint() ? 'Ťukni na položku v nabídce – koupíš ji' : '↑ ↓ vyber  ·  mezerník koupit  ·  Esc odejít';
  drawOutlinedText(hint, X(hintX), Y(hintY), 'bold 13px sans-serif', '#ffffff', 'middle');
}

// Kávovar café+co zepředu (podle fotky): černá skříň, nahoře reklama se slečnou
// a logem, pruh s příchutěmi, bílá tlačítka, displej, výdejní okénko,
// dole zelená reklama „My perfect break“; vpravo na zdi ceník
function renderKavovar(room) {
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  const R = (x, y, w, h, c) => drawRect({ x: X(x), y: Y(y), w, h }, c);
  const circle = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, Math.PI * 2); ctx.fill(); };
  const text = (t, x, y, font, c, align = 'center') => {
    ctx.font = font; ctx.fillStyle = c; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(t, X(x), Y(y));
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(0, CONFIG.ROOM_AREA_TOP - 14, CONFIG.WIDTH, CONFIG.HEIGHT); ctx.clip();
  // bílá zeď, dřevěná lišta, béžová dlažba
  R(0, -20, room.w, 460, '#f1efea');
  R(0, 0, 70, 440, '#e6e3dc'); R(66, 0, 6, 440, '#d2cdc3');            // rám dveří vlevo
  R(110, 150, 40, 14, '#c9a64a'); R(112, 152, 36, 10, '#e0c46a');      // mosazná cedulka
  R(180, 210, 20, 30, '#ffffff'); R(182, 212, 16, 26, '#eef0f0');      // vypínač
  for (let x = 0; x < room.w; x += 64) for (let y = 440; y < 528; y += 32) {
    R(x, y, 64, 32, ((x / 64 + (y - 440) / 32) % 2) ? '#e2b8a2' : '#e9c5b0');
  }
  R(0, 432, room.w, 10, '#c98a4e');
  // stín za kávovarem
  R(262, 16, 280, 486, 'rgba(0, 0, 0, 0.12)');
  // skříň
  R(240, 6, 290, 494, '#111113');
  R(240, 6, 10, 494, '#2b2b2f');                                        // levá hrana (panty)
  R(256, 120, 6, 60, '#8a8f95');                                        // zámek
  // reklama nahoře: světlé pozadí, logo café+co, slečna v oranžovém
  const ad = ctx.createLinearGradient(0, Y(20), 0, Y(178));
  ad.addColorStop(0, '#dbe8d8'); ad.addColorStop(1, '#f5f2e8');
  ctx.fillStyle = ad; ctx.fillRect(X(266), Y(20), 248, 158);
  circle(312, 64, 30, '#5a3420');
  text('café+co', 312, 62, 'bold 14px sans-serif', '#f6ead2');
  text('coffee', 312, 78, '8px sans-serif', '#e0c9a4');
  R(286, 108, 34, 62, '#f3efe6'); R(292, 118, 22, 44, '#c58a52');      // kelímek na reklamě
  R(292, 114, 22, 6, '#ffffff');
  ctx.fillStyle = '#e8722c';                                            // slečna: oranžové tričko
  ctx.beginPath(); ctx.ellipse(X(430), Y(178), 58, 40, 0, Math.PI, 0); ctx.fill();
  circle(430, 92, 32, '#f1c3a0');                                       // obličej
  ctx.fillStyle = '#2a1c16';                                            // tmavé mikádo s ofinou
  ctx.beginPath(); ctx.arc(X(430), Y(88), 37, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  R(393, 88, 12, 44, '#2a1c16'); R(455, 88, 12, 44, '#2a1c16');
  R(404, 66, 52, 12, '#2a1c16');
  circle(419, 96, 3, '#2a1c16'); circle(441, 96, 3, '#2a1c16');
  ctx.strokeStyle = '#b4423a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X(430), Y(106), 9, 0.25, Math.PI - 0.25); ctx.stroke();
  R(426, 124, 8, 14, '#f1c3a0');                                        // krk
  R(470, 120, 40, 26, '#1e1e20'); text('NOVINKA', 490, 133, 'bold 7px sans-serif', '#ffd54a');
  // pruh s příchutěmi
  R(266, 182, 248, 26, '#f3efe6');
  for (let k = 0; k < 5; k++) { circle(290 + k * 30, 195, 10, ['#6b3b22', '#9a5a32', '#d9b07a', '#3a2418', '#7a8a3a'][k]); }
  circle(470, 195, 11, '#ffffff'); circle(470, 195, 8, '#3fbf6a');     // kolečko výběru
  // tlačítka: 6 sloupců × 5 řad, vybraný nápoj svítí
  const sel = state.shopSel;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
    const i = r * 6 + c;
    const lit = i === sel && sel < KAVOVAR_MENU.length;
    R(274 + c * 26, 218 + r * 22, 22, 16, lit ? '#ffd54a' : '#f4f4f2');
    R(277 + c * 26, 221 + r * 22, 16, 3, lit ? '#b8860b' : '#b9bcc0');
    R(277 + c * 26, 227 + r * 22, 10, 2, lit ? '#b8860b' : '#d0d3d6');
  }
  // vpravo: displej s penězi, otvor na mince, karta
  R(440, 216, 66, 128, '#1a1a1c');
  circle(472, 236, 14, '#2a2a2e'); circle(472, 236, 10, '#9aa0a6'); circle(472, 236, 4, '#2a2a2e');
  R(448, 260, 50, 18, '#0d2a12');
  text(`${state.money} Kč`, 473, 270, 'bold 11px monospace', '#5cff7a');
  R(452, 286, 42, 8, '#c9ccd0'); R(456, 289, 34, 2, '#1a1a1c');       // otvor na mince
  R(452, 302, 42, 30, '#e8eaec'); R(456, 306, 34, 6, '#3d6fb5');       // čtečka karet
  // výdejní okénko s mřížkou (po nákupu v něm stojí kelímek a kouří se z něj)
  R(286, 352, 120, 82, '#2a2a2e');
  R(292, 358, 108, 70, '#0e0e10');
  const cup = state.cupTime != null && state.time - state.cupTime < 3;
  if (cup) {
    const t = state.time - state.cupTime;
    R(334, 380, 24, 36, '#ffffff'); R(334, 380, 24, 4, '#d9d9d9'); R(338, 392, 16, 10, '#c58a52');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      const sx = X(342 + k * 8), sy = Y(376);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + 6 * Math.sin(t * 5 + k), sy - 10, sx, sy - 20);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#5a5a60';
  for (let x = 294; x < 400; x += 8) ctx.fillRect(X(x), Y(418), 4, 10);
  circle(430, 392, 14, '#f0c419'); text('☕', 430, 393, '14px sans-serif', '#5a3420');
  R(452, 352, 50, 20, '#0d2a12'); text('54304', 477, 362, 'bold 10px monospace', '#5cff7a');
  // reklama dole: zelená a bílá, „My perfect break“, hrnek
  R(266, 440, 248, 54, '#ffffff');
  ctx.fillStyle = '#3fa86a';
  ctx.beginPath(); ctx.moveTo(X(266), Y(440)); ctx.lineTo(X(514), Y(440)); ctx.lineTo(X(514), Y(458)); ctx.lineTo(X(266), Y(482)); ctx.closePath(); ctx.fill();
  text('My perfect break.', 326, 452, 'italic bold 13px sans-serif', '#ffffff');
  circle(468, 470, 20, '#f3efe6'); circle(468, 470, 15, '#b07a46');
  text('DELIKOMAT', 320, 484, 'bold 9px sans-serif', '#3fa86a');
  // ceník na zdi vpravo (dá se na něj ťuknout)
  const b = SHOPS.kavovar.board;
  R(b.x - 4, b.y - 4, b.w + 8, b.h + 8, '#c8c3b8');
  R(b.x, b.y, b.w, b.h, '#fdfcf8');
  R(b.x, b.y, b.w, 40, '#5a3420');
  text('KÁVOVAR – NABÍDKA', b.x + b.w / 2, b.y + 20, 'bold 14px sans-serif', '#f6ead2');
  const rows = [...KAVOVAR_MENU.map((m) => [m.name, m.price + ' Kč']), ['Odejít', '']];
  rows.forEach(([name, price], i) => {
    const y = b.y + b.top + i * b.row;
    const on = i === state.shopSel;
    if (on) R(b.x + 4, y - b.row / 2 + 2, b.w - 8, b.row - 4, '#ffe9a8');
    text((on ? '▸ ' : '  ') + name, b.x + 10, y, 'bold 14px sans-serif', name === 'Odejít' ? '#6a6f73' : '#2b1d14', 'left');
    text(price, b.x + b.w - 10, y, 'bold 14px sans-serif', '#5a3420', 'right');
  });
  drawShopInfo(room, 400, 514);
  ctx.restore();
}

function updateFront(dt) {
  const p = state.player, room = state.room;
  const gate = room.doors[0];
  const gateCx = gate.x + gate.w / 2;
  if (state.frontEnter) {   // jde do brány – posune se nahoru a zmenší, pak přechod
    state.frontEnter.t += dt;
    const k = Math.min(1, state.frontEnter.t / FRONT.ENTER_TIME);
    p.x += (gateCx - p.w / 2 - p.x) * Math.min(1, dt * 10);
    p.walkPhase += dt * CONFIG.PLAYER_STEP_SPEED * 0.6;
    p.walkBlend = 1;
    state.frontEnter.k = k;
    if (k >= 1 && !state.transition) state.transition = { door: gate, t: 0, switched: false };
    return;
  }
  const dir = getMoveVector();
  const oldX = p.x;
  p.x += dir.x * p.speed * 0.8 * dt;
  // chodí se jen podél budovy gymnázia, ne dál do stran
  p.x = Math.max(room.x + SCHOOL.x + 10, Math.min(room.x + SCHOOL.x + SCHOOL.w - 10 - p.w, p.x));
  p.y = room.y + FRONT.FEET_Y - p.h;
  updateWalkAnimation(p, Math.abs(p.x - oldX) > 0.05, dt);
  const near = Math.abs(p.x + p.w / 2 - gateCx) < 50;
  if (near && (dir.y < -0.5 || state.frontWantEnter)) state.frontEnter = { t: 0, k: 0 };
  state.frontWantEnter = false;
}

// Scéna před školou bez hráče: nebe, stromy, budova, zídka s branou, chodník a lampy
// (kreslí ji pohled Před školou i úvodní obrazovka). label = popisek u brány, sky = nebe,
// wings = křídla budovy (úvod kreslí jen střed).
function drawFrontScene(room, { label = true, sky = true, wings = true } = {}) {
  const X = (x) => room.x + x, Y = (y) => room.y + y;
  const R = (x, y, w, h, c) => drawRect({ x: X(x), y: Y(y), w, h }, c);

  // nebe a stromy v dálce
  if (sky) {
    const grad = ctx.createLinearGradient(0, Y(0), 0, Y(380));
    grad.addColorStop(0, '#cfdbe6'); grad.addColorStop(1, '#eef1f2');
    ctx.fillStyle = grad;
    ctx.fillRect(X(0), Y(-20), room.w, 420);
  }
  ctx.fillStyle = '#6f8a62';
  for (const [tx, tr] of [[90, 60], [180, 45], [1420, 55], [1520, 65], [250, 40], [1350, 40]]) {
    ctx.beginPath(); ctx.arc(X(tx), Y(330), tr, 0, Math.PI * 2); ctx.fill();
  }

  drawSchoolFront(room, { wings });

  // zídka s živým plotem a branou
  const gate = room.doors[0];
  const gx = gate.x - room.x, gw = gate.w;
  ctx.fillStyle = '#3f6b37';
  for (let x = 0; x < room.w; x += 26) {
    if (x + 26 > gx - 12 && x < gx + gw + 12) continue;
    ctx.beginPath(); ctx.arc(X(x + 13), Y(386), 18, Math.PI, 0); ctx.fill();
  }
  R(0, 386, gx - 10, 22, '#3f6b37');
  R(gx + gw + 10, 386, room.w - gx - gw - 10, 22, '#3f6b37');
  R(0, 406, gx - 10, 34, '#9b958a');                             // kamenná zídka
  R(gx + gw + 10, 406, room.w - gx - gw - 10, 34, '#9b958a');
  R(0, 404, gx - 10, 4, '#b7b1a5');
  R(gx + gw + 10, 404, room.w - gx - gw - 10, 4, '#b7b1a5');
  // za branou cesta do dvora
  ctx.fillStyle = '#cfcac0';
  ctx.beginPath(); ctx.moveTo(X(gx), Y(440)); ctx.lineTo(X(gx + gw), Y(440)); ctx.lineTo(X(gx + gw - 14), Y(380)); ctx.lineTo(X(gx + 14), Y(380)); ctx.closePath(); ctx.fill();
  // sloupky a otevřená kovaná brána
  R(gx - 12, 360, 12, 80, '#8c867b'); R(gx - 14, 354, 16, 8, '#b7b1a5');
  R(gx + gw, 360, 12, 80, '#8c867b'); R(gx + gw - 2, 354, 16, 8, '#b7b1a5');
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 2;
  for (const [x0, dir] of [[gx, 1], [gx + gw, -1]]) {   // křídla otevřená dovnitř (zúžená perspektivou)
    for (let i = 0; i <= 4; i++) {
      const x = X(x0 + dir * i * 4);
      ctx.beginPath(); ctx.moveTo(x, Y(372 + i * 2)); ctx.lineTo(x, Y(438)); ctx.stroke();
    }
  }
  if (label) drawOutlinedText('Venkovní učebna', X(gx + gw / 2), Y(346), CONFIG.DOOR_LABEL_FONT, '#ffffff', 'bottom');

  // chodník
  R(0, 440, room.w, 88, '#c9c7c2');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let x = 0; x < room.w; x += 40) ctx.fillRect(X(x), Y(440), 1, 88);
  ctx.fillRect(X(0), Y(484), room.w, 1);
  R(0, 518, room.w, 10, '#8f8c86');                               // obrubník
  // lampy
  for (const lx of [245, 1355]) {
    R(lx - 2, 300, 4, 140, '#2f3336');
    R(lx - 8, 292, 16, 10, '#2f3336');
    ctx.fillStyle = 'rgba(255, 244, 200, 0.8)'; ctx.fillRect(X(lx - 6), Y(301), 12, 4);
  }
}

function renderFront(room) {
  const cam = { ...getCamera(room, 1) };   // pohled zepředu se nepřibližuje
  // kamera ukáže kolem budovy jen kousek okolí (100 px na každé straně)
  cam.x = Math.max(room.x + SCHOOL.x - 100, Math.min(room.x + SCHOOL.x + SCHOOL.w + 100 - CONFIG.WIDTH, cam.x));
  state.cam = cam;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CONFIG.ROOM_AREA_TOP - 14, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.clip();
  ctx.translate(-cam.x, 0);
  drawFrontScene(room);
  const Y = (y) => room.y + y;
  const gate = room.doors[0];
  drawRemotePlayersFront(room);   // ostatní online hráči na chodníku (29_multiplayer.js)

  // hráč – při vstupu do brány jde nahoru a zmenšuje se
  const p = state.player;
  const k = state.frontEnter ? state.frontEnter.k : 0;
  const feet = Y(FRONT.FEET_Y + (FRONT.GATE_Y - FRONT.FEET_Y) * k);
  const scale = FRONT.SCALE * (1 - 0.45 * k);
  const cx = p.x + p.w / 2;
  ctx.fillStyle = CONFIG.CHARACTER_SHADOW;
  ctx.beginPath(); ctx.ellipse(cx + 3, feet, 18 * scale, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(cx, feet);
  ctx.scale(scale, scale);
  drawPlayerFigure(0, 0, p.walkPhase, p.walkBlend);
  ctx.restore();
  if (mp.on) drawMyEmote(cx, feet - 82 * scale);   // můj smajlík (29_multiplayer.js)
  // nápověda u brány
  if (!state.frontEnter && Math.abs(cx - (gate.x + gate.w / 2)) < 50 && !state.transition) {
    const text = isTouchHint() ? 'Ťukni – vejít' : 'Šipka nahoru – vejít';
    ctx.font = CONFIG.HINT_FONT;
    const w = Math.ceil(ctx.measureText(text).width) + 14;
    const hy = feet - 110 * scale / FRONT.SCALE - 26;
    roundRectPath(cx - w / 2, hy, w, 20, 6);
    ctx.fillStyle = CONFIG.HINT_BG; ctx.fill();
    ctx.fillStyle = CONFIG.HINT_COLOR; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, hy + 11);
  }
  ctx.restore();
}

// Kamera: u místnosti větší než obrazovka jede za hráčem (ale ne za okraj místnosti)
// Mobil (dotyková obrazovka, nebo ?mobil v adrese pro zkoušení na počítači): svět se přiblíží
// (CONFIG.MOBILE_ZOOM) a na šířku jde přes celé plátno
const isMobileView = () => /[?&]mobil/.test(location.search)
  || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const worldZoom = () => (isMobileView() ? CONFIG.MOBILE_ZOOM : 1);
// Kamera: obrazovka = (svět − cam) × zoom; svět se kreslí od ROOM_AREA_TOP dolů.
// Místnost větší než výhled jede za hráčem (ale ne za okraj), menší je uprostřed.
function getCamera(room, zoom = worldZoom()) {
  const p = state.player;
  // přiblížený svět (mobil) jde přes celou šířku plátna
  const vw = (zoom === 1 ? CONFIG.WIDTH : VIEW.w) / zoom, top = CONFIG.ROOM_AREA_TOP / zoom, vh = (CONFIG.HEIGHT - CONFIG.ROOM_AREA_TOP) / zoom;
  const cam = { x: 0, y: 0, zoom, vw, vh: CONFIG.HEIGHT / zoom };
  cam.x = room.w > vw
    ? Math.max(room.x, Math.min(room.x + room.w - vw, p.x + p.w / 2 - vw / 2))
    : room.x + room.w / 2 - vw / 2;
  cam.y = room.h > vh
    ? Math.max(room.y - top, Math.min(room.y + room.h - CONFIG.HEIGHT / zoom, p.y + p.h / 2 - top - vh / 2))
    : room.y + room.h / 2 - top - vh / 2;
  cam.x = Math.round(cam.x * zoom) / zoom; cam.y = Math.round(cam.y * zoom) / zoom;
  return cam;
}

// Název části složené místnosti, ve které hráč stojí (jinak název místnosti)
function currentAreaName(room) {
  if (!room.parts) return room.name;
  const p = state.player, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  // ruční výjimky (areas = [{ x, y, w, h, name }] v px místnosti)
  const area = (room.areas || []).find((a) => pointInRect(cx - room.x, cy - room.y, a, 0));
  if (area) return area.name;
  // díly se můžou překrývat (chodba před schody nad západní) – platí ten kreslený později
  const part = [...room.parts].reverse().find((pt) => pointInRect(cx, cy, pt.frame, 0));
  return part ? part.name : room.name;
}

function renderGame() {
  // pozadí mimo místnost
  ctx.fillStyle = CONFIG.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  if (state.room.front) {   // pohled zepředu (před školou, bufet)
    if (state.room.shop) renderShop(state.room);
    else renderFront(state.room);
    drawRoomTitle(state.room);
    drawHud();
    drawToast();
    drawDialog();
    drawTransition();
    return;
  }

  // svět se kreslí posunutý o kameru, rozhraní (název, úkol, dialog) až potom bez posunu
  const room = state.room;
  const cam = getCamera(room);
  state.cam = cam;
  cullBegin(cam);   // co je mimo záběr, se nekreslí (30_kvalita.js)
  ctx.save();
  const wide = cam.zoom !== 1 ? VIEW.offX : 0;   // mobil: svět od levého okraje plátna
  if (cam.x || cam.y || room.parts || cam.zoom !== 1) {   // posouvaná místnost nesmí zajet pod horní lištu s názvem
    ctx.beginPath();
    ctx.rect(-wide, CONFIG.ROOM_AREA_TOP - 14, CONFIG.WIDTH + 2 * wide, CONFIG.HEIGHT);
    ctx.clip();
  }
  ctx.translate(-wide, 0);
  ctx.scale(cam.zoom, cam.zoom);   // mobil: přiblížený svět
  ctx.translate(-cam.x, -cam.y);

  // podlaha a zdi – nakreslená místnost (ROOM_ART), jinak jednobarevná
  const art = ROOM_ART[room.id];
  if (room.parts) {
    for (const part of room.parts) {
      if (!inView(part.frame, 0)) continue;
      ROOM_ART[part.art].draw({
        ...part.frame, id: part.id,
        obstacles: room.obstacles.filter((o) => o.part === part.id),
        doors: room.doors.filter((d) => d.part === part.id),
      });
    }
    // otevřené průchody mezi díly: místo zdi podlaha (každá polovina podlahou svého dílu)
    for (const o of room.openings) {
      if (!inView(o, 0)) continue;
      const [a, b] = o.fill || ['old', 'old'];
      const vertical = o.h > o.w;   // svislá zeď → poloviny vlevo/vpravo, jinak nahoře/dole
      const halves = vertical
        ? [[a, { x: o.x - 6, y: o.y, w: o.w / 2 + 6, h: o.h }], [b, { x: o.x + o.w / 2, y: o.y, w: o.w / 2 + 6, h: o.h }]]
        : [[a, { x: o.x, y: o.y - 6, w: o.w, h: o.h / 2 + 6 }], [b, { x: o.x, y: o.y + o.h / 2, w: o.w, h: o.h / 2 + 6 }]];
      for (const [kind, r] of halves) {
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        FLOOR_FILLS[kind](r);
        ctx.restore();
      }
    }
  } else if (art) {
    art.draw(room);
  } else {
    drawRect(room, room.floorColor);
    for (const wall of buildRoomWalls(room)) drawRect(wall, room.wallColor);
  }
  // nábytek před dveřmi, ať nápisy nad dveřmi nic nepřekryje
  for (const o of room.obstacles) if (inView(o.rect)) (OBSTACLE_ART[o.kind] || drawPlainObstacle)(o.rect, o, room);
  // nápisy, které nesmí překrýt nábytek (drawOver u kresby dílu)
  for (const part of room.parts || []) if (ROOM_ART[part.art].drawOver && inView(part.frame, 0)) ROOM_ART[part.art].drawOver(part.frame);
  if (!room.parts && art && art.drawOver) art.drawOver(room);
  drawDoors(room, art && art.door);

  for (const item of visibleItems()) if (inView(item.rect)) drawItem(item);
  drawPrankWorld();
  drawMotorkaWorld();
  drawVrahWorld();
  drawPivoWorld();
  drawStrunyWorld();
  drawLockerWorld();   // Locker na skiny v Dolních šatnách (33_skiny.js)
  drawSmokeLeak();   // kouř z kabinetu Chválové (20_skola.js)
  drawTeachers();

  drawRemotePlayers();   // ostatní online hráči ve stejné místnosti (29_multiplayer.js)
  if (!vrahHidden()) drawPlayer(state.player);   // schovaný v laborce: jen obrys (18_vrah.js)
  drawGossipBubble();   // Terka a Rauscher pomlouvají Holuba (20_skola.js) – nad hráčem, ať je bublina čitelná
  drawMicheleChat();  // Michele a Švecová si povídají (24_damien.js)

  drawEffects();
  drawTalkHint();
  ctx.restore();
  cullReset();   // rozhraní a ostatní obrazovky se nevynechává

  drawRoomTitle(room);
  drawHud();
  drawToast();
  drawDialog();
  drawTransition();
}
