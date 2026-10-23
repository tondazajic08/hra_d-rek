// Minihra pingpong (stoly v hale s pingpongem)
// Část hry Dárek – načítá se v index.html před 15_hlavni.js.
'use strict';

// =====================================================================
// MINIHRA: PINGPONG – pohled shora na stůl, ty dole, počítač nahoře.
// Pádlo jde za myší / prstem (na mobilu kousek nad prstem, ať je vidět), nebo šipkami.
// Odpaluje se samo, když míček po odskoku na tvé straně narazí do pádla:
//   – kde ho pádlo trefí (střed / kraj) = kam míček letí do stran,
//   – švih dopředu = síla (hlubší a rychlejší míček, moc = zámezí),
//   – švih do strany = faleš (míček se stáčí a po odskoku uhýbá).
// Podání: švih dopředu (nebo mezerník); samo po pár sekundách.
// Pravidla: míček musí jednou odskočit na soupeřově půlce; dvakrát odskočit
// nebo spadnout mimo stůl = bod. Hraje se do PP.WIN s rozdílem 2, podání se střídá po 2.
// Míček má i výšku (z): kreslí se výš a větší, stín ukazuje, kde je nad stolem.
// =====================================================================
const PP = {
  TABLE: { x: 290, y: 110, w: 220, h: 380 },   // stůl na plátně (síť uprostřed výšky)
  PADDLE_R: 26,          // poloměr pádla (zásah = míček blíž než PADDLE_R + BALL_R)
  BALL_R: 6,
  REACH_Z: 150,          // výš už pádlo míček nechytí
  LIFT: 0.7,             // o kolik px výš se kreslí míček na každý px výšky (z)
  G: 1300,               // gravitace (px/s²)
  BOUNCE: 0.82,          // kolik svislé rychlosti zbude po odskoku
  ME_ZONE: { x: 150, y: 380, w: 500, h: 200 },   // kam smí moje pádlo
  AI_ZONE: { x: 150, y: 14, w: 500, h: 190 },
  ME_HOME: { x: 400, y: 530 },
  AI_HOME: { x: 400, y: 70 },
  KEY_SPEED: 560,        // pádlo na šipkách (px/s)
  TOUCH_LIFT: 55,        // na mobilu je pádlo o tolik nad prstem
  WIN: 7,
  SERVE_AUTO: 4,         // s – pak se podá samo
  LEVELS: [
    // speed = rychlost pádla, react = za jak dlouho po úderu se rozběhne, err = jak moc se netrefí (px),
    // power = síla úderů [min, max], aim = jak moc míří do stran (podíl šířky), spin = faleš, miss = šance pokazit úder
    { id: 'easy',   name: 'Počítač – lehký',   reward: 5,  speed: 290, react: 0.28, err: 16, power: [0.35, 0.6],  aim: 0.22, spin: 100, miss: 0.09 },
    { id: 'medium', name: 'Počítač – střední', reward: 15, speed: 380, react: 0.2,  err: 11, power: [0.42, 0.72], aim: 0.32, spin: 220, miss: 0.065 },
    { id: 'hard',   name: 'Počítač – těžký',   reward: 30, speed: 560, react: 0.12, err: 7,  power: [0.58, 0.9],  aim: 0.42, spin: 400, miss: 0.04 },
  ],
};
const PP_NET_Y = PP.TABLE.y + PP.TABLE.h / 2;
const PP_QUIT_BTN = { x: 12, y: 14, w: 56, h: 44 };   // vlevo nahoře (vpravo je zvuk), jako u fotbálku
// menu: obtížnosti, online soupeř (jen s databází, 35_online_hry.js) a Odejít (null)
const ppMenuItems = () => [...PP.LEVELS, ...(mpReady() ? [DUEL.ROW] : []), null];
const ppMenuRows = () => ppMenuItems().map((_, i) => ({ x: 210, y: 186 + i * 56, w: 380, h: 48 }));

// Stůl, u kterého hráč stojí (v hale jsou dva)
function pingpongTableRect() {
  if (!state.room || state.room.id !== 'chodba') return null;
  const p = state.player, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  let best = null, bestD = Infinity;
  for (const o of state.room.obstacles) {
    if (o.kind !== 'pingpong') continue;
    const d = Math.hypot(o.rect.x + o.rect.w / 2 - cx, o.rect.y + o.rect.h / 2 - cy);
    if (d < bestD) { bestD = d; best = o.rect; }
  }
  return best;
}
SPOTS.push({ rect: pingpongTableRect, act: () => openPingpong(), hintDx: 0 });

// --- průběh ---
function openPingpong() {
  state.pp = { phase: 'menu', menuSel: 0, keys: [], level: null, pointer: null, texts: [] };
  input.events.length = 0;
  playSound([[523, 0, 0.05], [784, 0.06, 0.07]]);
  setScreen('pingpong');
}
function ppLeave() {
  const g = state.pp;
  if (g && g.online) duelQuit(g);   // online zápas skončí i u soupeře (35_online_hry.js)
  if (duel.ask) duelCancelAsk();
  state.pp = null;
  setScreen('playing');
  input.events.length = 0;
  if (g && g.reward) state.toast = { text: `Výhra v pingpongu! +${g.reward} Kč`, t: CONFIG.TOAST_TIME + 1 };
}
function ppNewGame(level) {
  const g = state.pp;
  Object.assign(g, {
    level, phase: 'play', score: { me: 0, ai: 0 }, server: Math.random() < 0.5 ? 'me' : 'ai',
    me: { x: PP.ME_HOME.x, y: PP.ME_HOME.y, vx: 0, vy: 0 },
    ai: { x: PP.AI_HOME.x, y: PP.AI_HOME.y, vx: 0, vy: 0, tx: PP.AI_HOME.x, ty: PP.AI_HOME.y, wait: 0, errX: 0 },
    confirmQuit: false, reward: 0, msg: '', overSel: 0, rally: 0, texts: [],
  });
  ppServe(g);
}
// Míček do ruky podávajícího
function ppServe(g) {
  g.ball = { x: 0, y: 0, z: 30, vx: 0, vy: 0, vz: 0, ax: 0, held: g.server, lastHit: null, bounces: 0, trail: [] };
  g.serveT = 0;
  g.aiServeAt = 0.9 + Math.random() * 0.6;
  g.rally = 0;
  ppHoldBall(g);
}
function ppHoldBall(g) {
  const b = g.ball, p = b.held === 'me' ? g.me : g.ai;
  b.x = p.x + (b.held === 'me' ? 14 : -14);
  b.y = p.y + (b.held === 'me' ? -16 : 16);
  b.z = 34 + Math.sin(g.serveT * 5) * 6;   // nadhazuje si
}

// Úder: kam má míček dopadnout a jak rychle tam letí (z toho se spočítá rychlost a oblouk)
// side = kdo odpaluje, aimX = −1…1 (kam do stran), power 0…1.2 (>1 = zámezí), spin = faleš (px/s²)
function ppShoot(g, side, aimX, power, spin) {
  const T = PP.TABLE, b = g.ball;
  const dir = side === 'me' ? -1 : 1;
  const depth = 0.3 + 0.62 * power;                 // 1 = až na koncovou čáru
  const landX = T.x + T.w / 2 + aimX * T.w * 0.5;
  const landY = PP_NET_Y + dir * depth * T.h / 2;
  const flight = 1.05 - 0.63 * Math.min(1, power);  // s do dopadu (silný úder letí rychle)
  const ax = Math.max(-700, Math.min(700, spin));
  b.held = null;
  b.vx = (landX - b.x - 0.5 * ax * flight * flight) / flight;
  b.vy = (landY - b.y) / flight;
  b.vz = (0.5 * PP.G * flight * flight - b.z) / flight;
  b.ax = ax;
  b.lastHit = side;
  b.bounces = 0;
  g.rally++;
  playSound([[side === 'me' ? 620 : 520, 0, 0.035]], 'square');
  if (g.online && side === 'me') ppOnlineShot(g);   // pošle úder soupeři (35_online_hry.js)
}

// Moje pádlo trefilo míček: směr podle místa zásahu a švihu, síla podle švihu dopředu
function ppHitMe(g) {
  const b = g.ball, p = g.me;
  const offset = Math.max(-1.3, Math.min(1.3, (b.x - p.x) / PP.PADDLE_R));
  const fwd = Math.max(0, -p.vy);
  const incoming = Math.hypot(b.vx, b.vy);
  // švih přidá sílu pozvolna (nejvýš 0,8) – do zámezí jen prudký švih proti rychlému míčku
  const power = Math.max(0.2, Math.min(1.25, 0.16 + incoming / 2400 + 0.8 * (1 - Math.exp(-fwd / 650))));
  const aimX = Math.max(-1.2, Math.min(1.2, offset * 0.84 + p.vx / 2600));   // směr hlavně podle místa zásahu, švih do strany jen trochu
  ppShoot(g, 'me', aimX, power, p.vx * 0.8);
  const text = power > 1.13 ? 'Moc silně!' : Math.abs(aimX) > 1 ? 'Moc do strany!' : power > 0.85 ? 'Smeč! 💥' : Math.abs(offset) < 0.25 && power > 0.55 ? 'Super!' : '';
  if (text) ppText(g, text, p.x, p.y - 40, power > 1.13 || Math.abs(aimX) > 1 ? '#ff8a80' : '#ffd54a');
}
// Počítač: míří do stran podle obtížnosti, občas úder pokazí (zámezí / do autu)
function ppHitAi(g) {
  const L = g.level, r = Math.random;
  let aimX = (r() * 2 - 1) * L.aim * 2;
  let power = L.power[0] + r() * (L.power[1] - L.power[0]);
  if (r() < L.miss) { if (r() < 0.5) power = 1.25; else aimX = (r() < 0.5 ? -1 : 1) * (1.08 + r() * 0.2); }
  if (g.rally > 6) power = Math.min(1, power + 0.05);   // dlouhá výměna: přitlačí
  ppShoot(g, 'ai', aimX, power, (r() * 2 - 1) * L.spin);
}

function ppText(g, text, x, y, color) { g.texts.push({ text, x, y, color, t: 0 }); }

function ppPoint(g, winner, why) {
  // online bod určuje ten, ke komu míček letěl – já jen počkám na jeho zprávu (35_online_hry.js)
  if (g.online && g.ball.lastHit === 'me') { g.ball.frozen = true; return; }
  g.score[winner]++;
  const { me, ai } = g.score, total = me + ai;
  // podání se střídá po 2 bodech, za stavu (WIN−1):(WIN−1) po každém
  const deuce = me >= PP.WIN - 1 && ai >= PP.WIN - 1;
  if (deuce || total % 2 === 0) g.server = g.server === 'me' ? 'ai' : 'me';
  if (g.online) why = ppOnlinePoint(g, winner, why);   // pošle bod soupeři
  ppShowPoint(g, winner, why);
}
function ppShowPoint(g, winner, why) {
  g.phase = 'point';
  g.pointT = 1.2;
  g.pointMsg = why;
  g.pointWinner = winner;
  playSound(winner === 'me' ? [[659, 0, 0.07], [880, 0.08, 0.1]] : [[330, 0, 0.1], [262, 0.11, 0.12]]);
  const { me, ai } = g.score;
  if ((me >= PP.WIN || ai >= PP.WIN) && Math.abs(me - ai) >= 2) ppFinish(g);
}
function ppFinish(g) {
  g.phase = 'over';
  g.overSel = 0;
  const s = `${g.score.me}:${g.score.ai}`;
  if (g.score.me > g.score.ai) {
    g.reward = g.level.reward;
    if (g.reward) { state.money += g.reward; saveProgress(); }
    g.msg = g.online ? `Vyhrál jsi ${s} proti ${duelOppName()}!` : `Vyhrál jsi ${s} a dostal ${g.reward} Kč`;
    playSound(CONFIG.SOUND_COMPLETE);
  } else {
    g.msg = `Prohrál jsi ${s}`;
    playSound(CONFIG.SOUND_MISS);
  }
}

// --- fyzika míčku a pravidla ---
const ppOnTable = (x, y) => x >= PP.TABLE.x && x <= PP.TABLE.x + PP.TABLE.w && y >= PP.TABLE.y && y <= PP.TABLE.y + PP.TABLE.h;
const ppSideOf = (y) => (y < PP_NET_Y ? 'ai' : 'me');
const ppOther = (s) => (s === 'me' ? 'ai' : 'me');

function ppPhysics(g, dt) {
  const b = g.ball, steps = 4, h = dt / steps;
  for (let s = 0; s < steps && g.phase === 'play' && !b.frozen; s++) {
    b.x += b.vx * h + 0.5 * b.ax * h * h;
    b.vx += b.ax * h;
    b.y += b.vy * h;
    b.vz -= PP.G * h;
    b.z += b.vz * h;
    // zásah pádlem: jen po jednom odskoku na vlastní straně (míček letí k tobě)
    for (const side of ['me', 'ai']) {
      const p = g[side];
      if (b.lastHit !== ppOther(side) || b.bounces !== 1 || ppSideOf(b.bounceY) !== side) continue;
      // trefuje se míček tam, kde je vidět (nad stínem), ne jeho stín
      if (b.z > PP.REACH_Z || Math.hypot(b.x - p.x, b.y - b.z * PP.LIFT - p.y) > PP.PADDLE_R + PP.BALL_R) continue;
      if (side === 'me') ppHitMe(g);
      else if (g.online) { b.frozen = true; return; }   // soupeř míček trefil – počká se na jeho úder (35_online_hry.js)
      else ppHitAi(g);
    }
    if (b.z <= 0 && b.vz < 0) {
      const hitter = b.lastHit, receiver = ppOther(hitter);
      if (ppOnTable(b.x, b.y)) {
        const side = ppSideOf(b.y);
        if (side === hitter) { ppPoint(g, receiver, hitter === 'me' ? 'Odskok na tvé straně' : 'Počítač si to odrazil na svou stranu'); return; }
        b.bounces++;
        b.bounceY = b.y;
        if (b.bounces >= 2) { ppPoint(g, hitter, hitter === 'me' ? 'Počítač to nevrátil' : 'Nevrátil jsi to'); return; }
        b.z = 0;
        b.vz = -b.vz * PP.BOUNCE;
        b.vx *= 0.97; b.vy *= 0.97;
        b.vx += b.ax * 0.12;   // faleš po odskoku uhne
        playSound([[side === 'me' ? 880 : 780, 0, 0.025]], 'square');
      } else {   // na zem
        if (b.bounces >= 1) ppPoint(g, hitter, hitter === 'me' ? 'Počítač to nechytil' : 'Nechytil jsi to');
        else ppPoint(g, receiver, hitter === 'me' ? 'Mimo stůl' : 'Počítač trefil mimo stůl');
        return;
      }
    }
  }
}

// Počítač: odhadne, kde míček bude na jeho úderové čáře, a jde tam (se zpožděním a chybou)
function ppPredictX(g, lineY) {
  const b = g.ball;
  let { x, y, z, vx, vy, vz, ax } = b, bounces = b.bounces;
  const h = 1 / 120;
  for (let i = 0; i < 360; i++) {
    x += vx * h; vx += ax * h; y += vy * h; vz -= PP.G * h; z += vz * h;
    if (z <= 0 && vz < 0) { z = 0; vz = -vz * PP.BOUNCE; vx = vx * 0.97 + ax * 0.12; vy *= 0.97; bounces++; }
    const sy = y - z * PP.LIFT;   // tam, kde míček bude vidět
    if (vy < 0 ? sy <= lineY : sy >= lineY) return { x, z };
  }
  return { x, z };
}
function ppAi(g, dt) {
  const L = g.level, p = g.ai, b = g.ball;
  if (b.held === 'ai') {   // podání
    p.tx = PP.AI_HOME.x + Math.sin(g.serveT * 1.3) * 30; p.ty = PP.AI_HOME.y;
  } else if (b.lastHit === 'me' && b.vy < 0) {
    p.wait += dt;
    if (p.wait >= L.react) {
      const line = PP.TABLE.y - 22;
      const pr = ppPredictX(g, line);
      p.tx = pr.x + p.errX;
      p.ty = line;
    }
  } else {   // míček letí ode mě: vrátit se doprostřed
    p.wait = 0;
    p.errX = (Math.random() * 2 - 1) * L.err;
    p.tx = PP.AI_HOME.x; p.ty = PP.AI_HOME.y;
  }
  const ox = p.x, oy = p.y;
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = L.speed * dt;
  if (d > step) { p.x += dx / d * step; p.y += dy / d * step; } else { p.x = p.tx; p.y = p.ty; }
  ppClamp(p, PP.AI_ZONE);
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
}
function ppClamp(p, Z) {
  p.x = Math.max(Z.x, Math.min(Z.x + Z.w, p.x));
  p.y = Math.max(Z.y, Math.min(Z.y + Z.h, p.y));
}

// --- ovládání: myš / prst (pádlo jde za ukazatelem), šipky ---
function ppPointer(e) {
  const g = state.pp;
  if (state.screen !== 'pingpong' || !g) return;
  const pt = screenToGame(e.clientX, e.clientY);
  if (!pt) return;
  const touch = e.pointerType !== 'mouse';
  g.pointer = { x: pt.x, y: pt.y - (touch ? PP.TOUCH_LIFT : 0), touch };
}
window.addEventListener('pointerdown', ppPointer);
window.addEventListener('pointermove', ppPointer);
window.addEventListener('keydown', (e) => {
  if (state.screen === 'pingpong' && state.pp && !e.repeat) state.pp.keys.push(e.code);
});

function ppMoveMe(g, dt) {
  const p = g.me, ox = p.x, oy = p.y;
  const kx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
  const ky = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
  if (kx || ky) {
    g.pointer = null;   // šipky mají přednost, dokud se nepohne myš
    const k = kx && ky ? Math.SQRT1_2 : 1;
    p.x += kx * k * PP.KEY_SPEED * dt; p.y += ky * k * PP.KEY_SPEED * dt;
  } else if (g.pointer) {
    const f = 1 - Math.exp(-32 * dt);   // rychle, ale bez skoků
    p.x += (g.pointer.x - p.x) * f; p.y += (g.pointer.y - p.y) * f;
  }
  ppClamp(p, PP.ME_ZONE);
  // rychlost pádla (vyhlazená) = švih
  const k = Math.min(1, dt * 25);
  p.vx += ((p.x - ox) / dt - p.vx) * k;
  p.vy += ((p.y - oy) / dt - p.vy) * k;
}

function updatePingpong(dt) {
  const g = state.pp;
  const events = input.events.splice(0);
  const keys = g.keys.splice(0);
  const has = (list, k) => KEYMAP[list].includes(k);
  for (const t of g.texts) t.t += dt;
  g.texts = g.texts.filter((t) => t.t < 1);

  if (g.phase === 'pick' || g.phase === 'wait') { duelPickUpdate(g, 'pp', events, keys); return; }   // online výzva (35_online_hry.js)
  if (g.phase === 'menu') {
    const items = ppMenuItems(), n = items.length;
    for (const k of keys) {
      if (has('up', k)) g.menuSel = (g.menuSel + n - 1) % n;
      if (has('down', k)) g.menuSel = (g.menuSel + 1) % n;
      if (k === 'Escape') { ppLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? g.menuSel : chessHit(ppMenuRows(), ev);
      if (i < 0) continue;
      const item = items[i];
      if (!item) ppLeave();
      else if (item === DUEL.ROW) duelOpenPick(g);
      else ppNewGame(item);
      return;
    }
    return;
  }
  if (g.online) duelPoll(g);   // zprávy od soupeře (35_online_hry.js)
  if (g.phase === 'over') {
    for (const k of keys) {
      if (has('up', k) || has('down', k)) g.overSel = 1 - g.overSel;
      if (k === 'Escape') { ppLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? g.overSel : chessHit(chessOverButtons(), ev);
      if (i === 0 && g.online) { duelOverAgain(g); return; }   // odveta / zpět do menu
      if (i === 0) { g.phase = 'menu'; g.menuSel = Math.max(0, PP.LEVELS.indexOf(g.level)); return; }
      if (i === 1) { ppLeave(); return; }
    }
    return;
  }
  if (g.confirmQuit) {   // „Ukončit zápas?“
    let close = keys.includes('Escape');
    for (const ev of events) {
      const i = ev.type === 'action' ? 0 : chessHit(chessConfirmButtons(), ev);
      if (i === 0) { if (g.online) duelQuit(g); g.phase = 'menu'; g.confirmQuit = false; return; }
      if (i === 1) close = true;
    }
    if (close) g.confirmQuit = false;
    if (!g.online) return;   // online se zápas nedá pozastavit – běží dál
  } else {
    if (keys.includes('Escape')) { g.confirmQuit = true; return; }
    if (events.some((ev) => ev.x != null && pointInRect(ev.x, ev.y, PP_QUIT_BTN, 6))) { g.confirmQuit = true; return; }
  }

  ppMoveMe(g, dt);
  if (g.online) ppOnlineOpp(g, dt); else ppAi(g, dt);

  if (g.phase === 'point') {
    g.pointT -= dt;
    if (g.pointT <= 0) { g.phase = 'play'; ppServe(g); }
    return;
  }
  const b = g.ball;
  if (b.held) {   // podání
    g.serveT += dt;
    ppHoldBall(g);
    if (b.held === 'me') {
      const swing = -g.me.vy > 380;
      const pressed = events.some((ev) => ev.type === 'action');
      if (swing || pressed || g.serveT > PP.SERVE_AUTO) {
        const power = Math.max(0.35, Math.min(0.95, 0.2 + Math.max(0, -g.me.vy) / 1300));
        const aimX = Math.max(-0.8, Math.min(0.8, (g.me.x - PP.TABLE.x - PP.TABLE.w / 2) / PP.TABLE.w + g.me.vx / 1200));
        ppShoot(g, 'me', aimX, power, g.me.vx * 0.6);
      }
    } else if (!g.online && g.serveT > g.aiServeAt) ppHitAi(g);   // online podá soupeř sám
    return;
  }
  if (b.frozen) return;   // online: čeká se, co na to soupeř
  b.trail.push({ x: b.x, y: b.y - b.z * PP.LIFT });
  if (b.trail.length > 7) b.trail.shift();
  ppPhysics(g, dt);
}

// --- kreslení ---
function drawPpPaddle(p, mine) {
  const R = PP.PADDLE_R, dir = mine ? 1 : -1;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 6, R, R * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  drawRect({ x: p.x - 5, y: mine ? p.y + R - 6 : p.y - R - 24, w: 10, h: 30 }, '#8d5a2b');   // držadlo
  drawRect({ x: p.x - 5, y: mine ? p.y + R + 14 : p.y - R - 24, w: 10, h: 10 }, '#6b3f1a');
  ctx.fillStyle = mine ? '#d32f2f' : '#1e1e1e';
  ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c99a62'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath(); ctx.arc(p.x - 7, p.y - 8 * dir, R * 0.45, 0, Math.PI * 2); ctx.fill();
}

function renderPingpong() {
  const g = state.pp, T = PP.TABLE, W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  // podlaha haly: béžové a vínové dlaždice
  ctx.fillStyle = '#e2b8a2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(143, 62, 62, 0.35)';
  for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);
  // stůl: nohy, deska, čáry, síť
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(T.x + 10, T.y + 12, T.w, T.h);
  drawRect({ x: T.x - 4, y: T.y - 4, w: T.w + 8, h: T.h + 8 }, '#123354');
  drawRect(T, '#1f4e79');
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.strokeRect(T.x + 2, T.y + 2, T.w - 4, T.h - 4);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(T.x + T.w / 2, T.y + 2); ctx.lineTo(T.x + T.w / 2, T.y + T.h - 2); ctx.stroke();
  drawRect({ x: T.x - 14, y: PP_NET_Y - 3, w: T.w + 28, h: 6 }, '#f2f2f2');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let x = T.x - 12; x < T.x + T.w + 12; x += 6) ctx.fillRect(x, PP_NET_Y - 3, 1, 6);
  drawRect({ x: T.x - 18, y: PP_NET_Y - 6, w: 6, h: 12 }, '#555');
  drawRect({ x: T.x + T.w + 12, y: PP_NET_Y - 6, w: 6, h: 12 }, '#555');

  if (g.level) {
    const b = g.ball, opp = g.online ? duelOppName() : 'Počítač';
    drawPpPaddle(g.ai, false);
    if (b) {
      // stín míčku na stole / zemi, pak míček (výš = výš na obrazovce a větší)
      const r = PP.BALL_R;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 2, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      b.trail.forEach((t, i) => {
        ctx.fillStyle = `rgba(255, 170, 60, ${0.08 + i * 0.04})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, r * 0.8, 0, Math.PI * 2); ctx.fill();
      });
      const sy = b.y - b.z * PP.LIFT, sr = r + Math.min(5, b.z * 0.04);
      ctx.fillStyle = '#ff9a2e';
      ctx.beginPath(); ctx.arc(b.x, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b85c00'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath(); ctx.arc(b.x - sr * 0.35, sy - sr * 0.35, sr * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    drawPpPaddle(g.me, true);
    for (const t of g.texts) drawOutlinedText(t.text, t.x, t.y - t.t * 30, 'bold 18px sans-serif', t.color, 'middle');

    // skóre vlevo a vpravo od stolu
    roundRectPath(30, 230, 220, 140, 14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; ctx.fill();
    drawOutlinedText(opp, 140, 258, 'bold 16px sans-serif', '#c7c7c7', 'middle');
    drawOutlinedText(`${g.score.ai}`, 140, 290, 'bold 30px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(`${g.score.me}`, 140, 322, 'bold 30px sans-serif', '#ffffff', 'middle');
    drawOutlinedText('Ty', 140, 352, 'bold 16px sans-serif', '#ff7a6e', 'middle');
    drawOutlinedText(g.server === 'me' ? '🏓 podáváš ty' : g.online ? `🏓 podává ${opp}` : '🏓 podává počítač', 140, 392, 'bold 13px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(`${g.level.name}`, 660, 258, 'bold 13px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(`do ${PP.WIN}, rozdíl 2`, 660, 280, 'bold 12px sans-serif', '#e8e0d0', 'middle');

    const hint = isTouchHint() ? 'Táhni prstem – pádlo je nad prstem · švih dopředu = silný úder'
      : 'Myš nebo šipky = pádlo · švih dopředu = síla, do strany = faleš · Esc = konec';
    drawOutlinedText(hint, W / 2, 590, 'bold 12px sans-serif', '#ffffff', 'middle');
    if (b && b.held === 'me' && g.phase === 'play') {
      drawOutlinedText(isTouchHint() ? 'Podání: švihni prstem nahoru' : 'Podání: švihni pádlem dopředu nebo mezerník', W / 2, PP_NET_Y + 60, 'bold 17px sans-serif', '#ffd54a', 'middle');
    }
    if (g.phase === 'point') {
      drawOutlinedText(g.pointWinner === 'me' ? 'Bod pro tebe!' : `Bod pro ${g.online ? opp : 'počítač'}`, W / 2, PP_NET_Y - 30, 'bold 34px sans-serif', g.pointWinner === 'me' ? '#ffd54a' : '#ffffff', 'middle');
      drawOutlinedText(g.pointMsg, W / 2, PP_NET_Y + 12, 'bold 16px sans-serif', '#ffffff', 'middle');
    }
    if (g.phase === 'play' || g.phase === 'point') {   // ✕ = ukončit zápas (hlavně pro mobil)
      const q = PP_QUIT_BTN;
      roundRectPath(q.x, q.y, q.w, q.h, 10);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      drawOutlinedText('✕', q.x + q.w / 2, q.y + q.h / 2 + 1, 'bold 24px sans-serif', '#ffffff', 'middle');
    }
  }

  if (g.phase === 'menu') {
    drawChessBox(180, 120, 440, 380);
    drawOutlinedText('🏓 Pingpong – vyber soupeře', 400, 162, 'bold 24px sans-serif', '#ffd54a', 'middle');
    const rows = ppMenuRows();
    ppMenuItems().forEach((l, i) => {
      const label = !l ? 'Odejít' : l === DUEL.ROW ? l.name : `${l.name}  ·  výhra +${l.reward} Kč`;
      drawChessButton(rows[i], label, i === g.menuSel, !l ? '#5a4636' : l === DUEL.ROW ? '#2f5a7a' : '#3d5f3a');
    });
    drawOutlinedText(`Hraje se do ${PP.WIN} bodů s rozdílem 2`, 400, 478, 'bold 13px sans-serif', '#e8d3a8', 'middle');
    drawDuelNote(100);   // „Bob neodpovídá“ (35_online_hry.js)
  } else if (g.phase === 'pick' || g.phase === 'wait') {
    drawDuelPick(g, 'pp');   // výběr soupeře online (35_online_hry.js)
  } else if (g.phase === 'over') {
    drawChessBox(200, 200, 400, 250);
    drawOutlinedText(g.msg, 400, 262, 'bold 22px sans-serif', g.reward ? '#ffd54a' : '#ffffff', 'middle');
    chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? (g.online ? duelOverLabel(g) : 'Hrát znovu') : 'Odejít', i === g.overSel));
  } else if (g.confirmQuit) {
    drawChessBox(200, 220, 400, 170);
    drawOutlinedText('Ukončit zápas?', 400, 270, 'bold 24px sans-serif', '#ffffff', 'middle');
    const [yes, no] = chessConfirmButtons();
    drawChessButton(yes, 'Ano, ukončit', !isTouchHint(), '#7a2a20');
    drawChessButton(no, 'Ne, hrát dál', false);
  }
}
