// Among Us navíc: třídy na mapách, venty, sabotáže (světla, dveře), barvy hráčů
// Část hry Dárek – načítá se v index.html po 37_among_ukoly.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// 5. KROK AMONG US
// - Třídy: na mapu patří i místnosti, do kterých vedou dveře z chodeb mapy (kabinety,
//   učebny, šatny, tělocvična…), ne však ven, parkoviště a schody do laborek.
// - Venty: záškodník u mřížky (🕳 VENT / E) vleze dovnitř – nikdo ho nevidí (pole a: 'vent'),
//   šipkami / ťuknutím nebo 1–2 se přesune k jinému ventu stejné sítě, E = vylézt.
// - Sabotáže (⚡ / F, jen záškodník, 30 s čekání): 💡 zhasnout světla – nevinní vidí jen kolem
//   sebe, dokud někdo u rozvodny nenahodí jističe; 🚪 zamknout dveře – 10 s nejde projít.
//   Během zhasnutých světel nejde svolat poradu, porada sabotáž zruší.
//   Řídí hostitel: zprávy { k: 'sab', t: 'lights' | 'doors' } a { k: 'fix' }, stav S.sab, S.sabCd.
// - Barvy: každý hráč má barvu jako v Among Us (podle pořadí ve hře), jmenovka i kroužek
//   pod nohama, tečka v seznamu hráčů a na poradě.
// =====================================================================
const AMONG_X = {
  SAB_COOLDOWN: 30000,   // ms mezi sabotážemi
  DOORS_TIME: 10000,     // ms zamčené dveře
  VENT_DIST: 60, SWITCH_DIST: 75,
  LIGHT_R: [70, 170],    // px – kolik vidí nevinný při zhasnutých světlech (od / do)
};
// Třídy a kabinety u chodeb map (vypočítané z dveří chodeb mapy)
for (const id of ['a113', 'kabinet', 'a114', 'kabinet2', 'wcKluci0', 'a107', 'kabinet3', 'a211', 'a212', 'kabinetA213', 'sborovna', 'a209',
  'predsinKabinetu', 'kancelar', 'kabinetA216', 'a210', 'a310', 'a311', 'kabinetA312', 'a302', 'aula', 'a309', 'a305', 'kabinetA302']) AMONG_MAPS.A.rooms[id] = null;
for (const id of ['satny', 'kabinet6', 'telocvicna', 'satnaHolky', 'satnaKluci', 'satnyDole', 'c101', 'kabinet4', 'wcKluci', 'wcHolky', 'c109', 'kabinet5',
  'c202', 'c203', 'c301', 'kabinet7', 'wcKluci3', 'wcHolky3', 'c308', 'kabinet8']) AMONG_MAPS.C.rooms[id] = null;
// Venty: sítě po 3 (souřadnice od rohu místnosti, volná místa u zdi daleko od úkolů a dveří)
AMONG_MAPS.A.vents = [
  [{ room: 'chodba', x: 600, y: 1740 }, { room: 'patroA', x: 420, y: 1640 }, { room: 'patroA2', x: 420, y: 1640 }],     // západní šachta
  [{ room: 'chodba', x: 1780, y: 1740 }, { room: 'patroA', x: 1940, y: 1620 }, { room: 'patroA2', x: 1940, y: 1620 }],  // východní šachta
  [{ room: 'a113', x: 60, y: 120 }, { room: 'a107', x: 100, y: 120 }, { room: 'sborovna', x: 200, y: 60 }],               // třídy
];
AMONG_MAPS.C.vents = [
  [{ room: 'chodba', x: 1360, y: 200 }, { room: 'cecko', x: 300, y: 200 }, { room: 'telocvicna', x: 60, y: 60 }],
  [{ room: 'chodba', x: 460, y: 1640 }, { room: 'cecko2', x: 360, y: 440 }, { room: 'cecko3', x: 360, y: 80 }],
  [{ room: 'c109', x: 400, y: 260 }, { room: 'c202', x: 60, y: 340 }, { room: 'c301', x: 60, y: 100 }],
];
AMONG_MAPS.A.lightSwitch = { room: 'chodba', x: 1120, y: 1460 };   // rozvodna: horní kus Hlavní chodby
AMONG_MAPS.C.lightSwitch = { room: 'chodba', x: 1300, y: 700 };    // rozvodna: Spojovačka
AMONG_TASK_TYPES.lights = { name: 'Nahoď jističe (světla)', icon: '💡' };

// --- Barvy hráčů ---
const AMONG_COLORS = [['#d71e22', 'Červená'], ['#1d3ce9', 'Modrá'], ['#1b913e', 'Zelená'], ['#ff63d4', 'Růžová'], ['#ff8d1c', 'Oranžová'],
  ['#f5f557', 'Žlutá'], ['#3f474e', 'Černá'], ['#e9f7ff', 'Bílá'], ['#783dd2', 'Fialová'], ['#80582d', 'Hnědá']];
function amongColorOf(id) {
  const list = among.S && Array.isArray(among.S.p) && among.round === among.S.k && among.phase !== 'lobby'
    ? among.S.p : (amongMyGame() ? amongMyGame().players.map((p) => p.id) : []);
  const i = list.indexOf(id);
  return AMONG_COLORS[(i < 0 ? 0 : i) % AMONG_COLORS.length];
}
const amongLight = (hex) => ['#f5f557', '#e9f7ff', '#ff63d4', '#ff8d1c'].includes(hex);
function amongColorDot(id, x, y, r) {
  const [c] = amongColorOf(id);
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
}
// Jmenovka v barvě hráče a kroužek pod nohama (cx = střed, feet = nohy)
function amongTag(id, name, cx, feet, prefix) {
  const [c] = amongColorOf(id);
  ctx.strokeStyle = c; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, feet - 2, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
  const label = (prefix || '') + name;
  ctx.font = 'bold 12px sans-serif';
  const w = Math.min(160, ctx.measureText(label).width + 14), ly = feet - 80;
  roundRectPath(cx - w / 2, ly - 9, w, 18, 9);
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = amongLight(c) ? '#111111' : '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, ly + 1, w - 8);
}
{
  const _label = drawRemoteLabel;
  drawRemoteLabel = function (o, lx, ly) {
    if (!amongOn()) { _label(o, lx, ly); return; }
    amongTag(o.id, o.n, lx, ly + 80, voiceLabel(o.id));
    if (o.emote) drawEmoteBubble(o.emote, lx, ly - 12, state.time - o.emoteT);
  };
  const _drawPlayer = drawPlayer;
  drawPlayer = function (p) {
    if (!amongOn()) { _drawPlayer(p); return; }
    if (among.vent) return;   // ve ventu nejsem vidět
    _drawPlayer(p);
    if (!among.dead) amongTag(mp.id, mp.name, p.x + p.w / 2, p.y + p.h);
  };
  // ve ventu není nikdo vidět; záškodník ve ventu nezabíjí ani nehlásí
  const _mpHere = mpHere;
  mpHere = function () { const l = _mpHere(); return amongOn() ? l.filter((o) => o.a !== 'vent') : l; };
  const _activity = mpActivity;
  mpActivity = function () { return amongOn() && among.vent ? 'vent' : _activity(); };
  const _kt = amongKillTarget;
  amongKillTarget = function () { return among.vent ? null : _kt(); };
  const _bn = amongBodyNear;
  amongBodyNear = function () { return among.vent ? null : _bn(); };
  // zamčené dveře
  const _door = amongDoorOk;
  amongDoorOk = function (door) { return !amongSabOn('doors') && _door(door); };
  // změna stavu: z ventu ven, zavřít výběr sabotáže
  const _apply = amongApplyS;
  amongApplyS = function (S) {
    _apply(S);
    if (among.phase !== 'play') { if (among.vent) { among.vent = null; mp.last = ''; } state.amongSab = null; }
  };
  // hostitel: sabotáže a oprava světel
  const _event = amongHostEvent;
  amongHostEvent = function (S, f, d, now) {
    const alive = (id) => S.p.includes(id) && !S.dead.includes(id);
    if (d.k === 'sab') {
      if (S.st !== 'play' || !S.im.includes(f) || !alive(f) || now < (S.sabCd || 0)) return false;
      if (S.sab && (S.sab.t === 'lights' || now < S.sab.until)) return false;   // sabotáž ještě běží
      if (d.t !== 'lights' && d.t !== 'doors') return false;
      S.sab = { t: d.t, at: now, until: d.t === 'doors' ? now + AMONG_X.DOORS_TIME : 0 };
      S.sabCd = now + AMONG_X.SAB_COOLDOWN;
      return true;
    }
    if (d.k === 'fix') {
      if (!S.sab || S.sab.t !== 'lights' || !alive(f)) return false;
      S.sab = null;
      return true;
    }
    if (d.k === 'emer' && S.sab && S.sab.t === 'lights') return false;   // při tmě porada nejde
    const ok = _event(S, f, d, now);
    if (ok && S.st === 'meet') S.sab = null;   // porada sabotáž ukončí
    return ok;
  };
  // venty a vypínač ve světě (pod hráči)
  const _world = drawAmongWorld;
  drawAmongWorld = function () {
    const room = state.room;
    (amongMap().vents || []).forEach((net) => net.forEach((v) => { if (v.room === room.id) drawAmongVent(room.x + v.x, room.y + v.y, among.vent && among.vent.v === v); }));
    const sw = amongMap().lightSwitch;
    if (sw && sw.room === room.id) drawAmongSwitch(room.x + sw.x, room.y + sw.y, amongSabOn('lights'));
    _world();
  };
}
function drawAmongVent(x, y, inside) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; ctx.fillRect(x - 22, y - 12, 48, 30);
  drawRect({ x: x - 24, y: y - 16, w: 48, h: 30 }, inside ? '#5a6472' : '#7b8794');
  ctx.fillStyle = '#2f353d';
  for (let k = 0; k < 5; k++) ctx.fillRect(x - 20, y - 12 + k * 5.5, 40, 3);
  ctx.strokeStyle = '#3d4550'; ctx.lineWidth = 2; ctx.strokeRect(x - 24, y - 16, 48, 30);
}
function drawAmongSwitch(x, y, dark) {
  drawRect({ x: x - 18, y: y - 26, w: 36, h: 44 }, '#b0b8c2');
  ctx.strokeStyle = '#4a525c'; ctx.lineWidth = 2; ctx.strokeRect(x - 18, y - 26, 36, 44);
  ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000000';
  ctx.fillText('⚡', x, y - 4);
  if (dark) drawOutlinedText('!', x, y - 44 + Math.sin(state.time * 6) * 3, 'bold 24px sans-serif', '#ff5a4a', 'middle');
}

// --- Sabotáže ---
function amongSabOn(t) {
  const S = among.S;
  if (!S || !S.sab || S.sab.t !== t || !amongInRound() || S.st !== 'play') return false;
  return t !== 'doors' || mpServerNow() < S.sab.until;
}
function amongSabWait() {   // s do další sabotáže (0 = jde)
  const S = among.S;
  if (!S) return 0;
  if (amongSabOn('lights') || amongSabOn('doors')) return -1;   // běží
  return Math.max(0, Math.ceil(((S.sabCd || 0) - mpServerNow()) / 1000));
}
const amongCanSab = () => among.role === 'zaskodnik' && !among.dead && among.phase === 'play' && !among.vent;
function amongSabOpen() {
  if (!amongCanSab()) return;
  if (amongSabWait() !== 0) { playSound([[220, 0, 0.1]]); return; }
  state.amongSab = { open: true };
}
const AMONG_SAB_ROWS = [{ t: 'lights', label: '💡 Zhasnout světla' }, { t: 'doors', label: '🚪 Zamknout dveře (10 s)' }];
const amongSabRect = (i) => ({ x: 470, y: 330 + i * 58, w: 310, h: 50 });
function amongSabEvents(events) {
  for (const ev of events) {
    if (ev.x == null) continue;
    const i = AMONG_SAB_ROWS.findIndex((_, k) => pointInRect(ev.x, ev.y, amongSabRect(k), 2));
    if (i >= 0) amongSabDo(i); else state.amongSab = null;
    return;
  }
}
function amongSabDo(i) {
  state.amongSab = null;
  if (!amongCanSab() || amongSabWait() !== 0) return;
  amongSend({ k: 'sab', t: AMONG_SAB_ROWS[i].t });
  playSound([[150, 0, 0.15], [110, 0.15, 0.25]], 'sawtooth');
}
window.addEventListener('keydown', (e) => {
  if (!amongOn() || state.screen !== 'playing' || e.repeat) return;
  if (state.amongSab) {
    const m = /^(?:Digit|Numpad)([12])$/.exec(e.code);
    if (m) amongSabDo(Number(m[1]) - 1);
    else if (e.code === 'Escape' || e.code === 'KeyF') state.amongSab = null;
    e.stopImmediatePropagation();
    return;
  }
  if (among.vent) {   // ve ventu: 1 / 2 nebo šipky = jiný vent
    const m = /^(?:Digit|Numpad)([12])$/.exec(e.code);
    const d = KEYMAP.left.includes(e.code) || KEYMAP.up.includes(e.code) ? 0 : KEYMAP.right.includes(e.code) || KEYMAP.down.includes(e.code) ? 1 : -1;
    if (m) among.ventGo = Number(m[1]) - 1; else if (d >= 0) among.ventGo = d;
  }
}, true);

// --- Venty ---
function amongVentNear() {
  if (among.role !== 'zaskodnik' || among.dead || among.phase !== 'play' || among.vent) return null;
  const me = amongMyPos(), nets = amongMap().vents || [];
  for (let n = 0; n < nets.length; n++) for (const v of nets[n]) {
    if (v.room === state.room.id && Math.hypot(v.x - me.x, v.y - me.y) <= AMONG_X.VENT_DIST) return { net: n, v };
  }
  return null;
}
function amongVentPlace(v) {
  const p = state.player;
  if (state.room.id !== v.room) enterRoom(v.room, { x: ROOMS[v.room].x + v.x - p.w / 2, y: ROOMS[v.room].y + v.y - p.h / 2 });
  p.x = ROOMS[v.room].x + v.x - p.w / 2; p.y = ROOMS[v.room].y + v.y - p.h / 2;
}
function amongVentEnter(near) {
  among.vent = near;
  among.ventGo = -1;
  amongVentPlace(near.v);
  mp.last = '';   // ostatní mě přestanou vidět
  playSound([[200, 0, 0.06], [140, 0.07, 0.08]], 'square');
}
function amongVentExit() {
  among.vent = null;
  mp.last = '';
  playSound([[140, 0, 0.06], [200, 0.07, 0.08]], 'square');
}
const amongVentOthers = () => (amongMap().vents[among.vent.net] || []).filter((v) => v !== among.vent.v);
const amongVentBtn = (i) => ({ x: 200 + i * 210, y: 400, w: 190, h: 52 });
// Krok hry ve ventu (místo chůze); true = ve ventu jsem
function amongVentUpdate(dt, events, acts) {
  if (!among.vent) return false;
  if (acts.includes('emer')) { amongVentExit(); return true; }
  const others = amongVentOthers();
  for (const ev of events) {
    if (ev.x == null) continue;
    const i = others.findIndex((_, k) => pointInRect(ev.x, ev.y, amongVentBtn(k), 2));
    if (i >= 0) among.ventGo = i;
  }
  if (among.ventGo >= 0 && others[among.ventGo]) {
    among.vent = { net: among.vent.net, v: others[among.ventGo] };
    amongVentPlace(among.vent.v);
    mp.last = '';
    playSound([[260, 0, 0.05]], 'square');
  }
  among.ventGo = -1;
  return true;
}
const amongPlaceName = (v) => {
  const room = ROOMS[v.room], part = room.parts ? amongPart(v.room, amongPartAt(room, room.x + v.x, room.y + v.y)) : null;
  return (part && part.name) || room.name;
};

// --- Tlačítko POUŽÍT: úkol / vypínač / vent / porada ---
function amongSwitchNear() {
  const sw = amongMap().lightSwitch;
  if (!sw || among.dead || among.phase !== 'play' || !amongSabOn('lights') || sw.room !== state.room.id) return false;
  const me = amongMyPos();
  return Math.hypot(sw.x - me.x, sw.y - me.y) <= AMONG_X.SWITCH_DIST;
}
function amongUse() {
  if (among.vent) { amongVentExit(); return; }
  const ti = amongTaskNear();
  if (ti >= 0) { amongOpenTask(ti); return; }
  if (amongSwitchNear()) { amongOpenLights(); return; }
  const vn = amongVentNear();
  if (vn) { amongVentEnter(vn); return; }
  if (!amongSabOn('lights')) amongTryEmergency();
}
function amongUseInfo(em, keys) {
  const k = (s) => (keys ? `${s} (E)` : s);
  if (among.vent) return { icon: '🕳', label: k('VYLÉZT'), ok: true };
  if (amongTaskNear() >= 0) return { icon: '🛠', label: k('POUŽÍT'), ok: true };
  if (amongSwitchNear()) return { icon: '💡', label: k('OPRAVIT'), ok: true };
  if (amongVentNear()) return { icon: '🕳', label: k('VENT'), ok: true };
  if (!among.dead && em.near) {
    if (amongSabOn('lights')) return { icon: '🚨', label: k('PORADA'), ok: false, extra: '💡' };
    return { icon: '🚨', label: k('PORADA'), ok: em.ok, extra: em.left <= 0 ? '✕' : em.wait > 0 ? String(em.wait) : '' };
  }
  return null;
}

// --- Oprava světel (úkol u rozvodny): nahodit 5 jističů ---
function amongOpenLights() {
  const sw = [0, 1, 2, 3, 4].map(() => Math.random() < 0.5);
  if (sw.every(Boolean)) sw[amongRand(0, 4)] = false;
  state.amongTask = { i: -1, type: 'lights', t: 0, doneT: 0, sw };
  playSound([[600, 0, 0.05]]);
}
const amongBreaker = (k) => ({ x: 215 + k * 78, y: 220, w: 60, h: 150 });
{
  const _upd = amongTaskUpdate;
  amongTaskUpdate = function (dt, events) {
    const T = state.amongTask;
    if (!T || T.type !== 'lights') { _upd(dt, events); return; }
    const keys = amongTaskKeys.splice(0);
    T.t += dt;
    if (T.doneT) { T.doneT -= dt; if (T.doneT <= 0) amongCloseTask(); return; }
    if (!amongSabOn('lights')) { amongCloseTask(); return; }   // opravil už někdo jiný
    if (keys.includes('Escape') || events.some((ev) => ev.x != null && (pointInRect(ev.x, ev.y, AMONG_TASK_CLOSE, 4) || !pointInRect(ev.x, ev.y, AMONG_TASK_PANEL, 0)))) { amongCloseTask(); return; }
    const flip = (k) => { T.sw[k] = !T.sw[k]; playSound([[T.sw[k] ? 700 : 400, 0, 0.04]], 'square'); };
    for (const c of keys) { const m = /^(?:Digit|Numpad)([1-5])$/.exec(c); if (m) flip(Number(m[1]) - 1); }
    for (const ev of events) if (ev.x != null) for (let k = 0; k < 5; k++) if (pointInRect(ev.x, ev.y, amongBreaker(k), 4)) flip(k);
    if (T.sw.every(Boolean)) {
      T.doneT = 0.8;
      amongSend({ k: 'fix' });
      playSound([[523, 0, 0.08], [784, 0.09, 0.14]]);
    }
  };
  const _draw = drawAmongTask;
  drawAmongTask = function () {
    const T = state.amongTask;
    _draw();
    if (!T || T.type !== 'lights' || T.doneT) return;
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#546e7a';
    ctx.fillText(isTouchHint() ? 'Ťukni na jističe, ať jsou všechny nahoře (zelené)' : 'Nahoď všechny jističe nahoru (klik nebo 1–5)', 400, 160);
    for (let k = 0; k < 5; k++) {
      const r = amongBreaker(k), on = T.sw[k];
      drawRect(r, '#37474f');
      drawRect({ x: r.x + 18, y: on ? r.y + 14 : r.y + 76, w: 24, h: 60 }, on ? '#43a047' : '#c62828');
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(on ? 'ZAP' : 'VYP', r.x + r.w / 2, r.y + r.h + 16);
    }
  };
}

// --- Kreslení: tma, tlačítko sabotáže, výběr sabotáže, ventové šipky, nápisy ---
function drawAmongDark() {
  const S = among.S;
  if (!amongOn() || !S || among.phase !== 'play') return;
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT, wide = VIEW.offX;
  if (amongSabOn('lights') && !among.dead && among.role !== 'zaskodnik' && state.cam && !state.room.front) {
    const cam = state.cam, z = cam.zoom || 1, p = state.player;
    const sx = (p.x + p.w / 2 - cam.x) * z - (z !== 1 ? wide : 0), sy = (p.y + p.h / 2 - cam.y) * z;
    const g = ctx.createRadialGradient(sx, sy, AMONG_X.LIGHT_R[0] * z, sx, sy, AMONG_X.LIGHT_R[1] * z);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, 'rgba(0, 0, 0, 0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(-wide, 0, W + 2 * wide, H);
  }
  if (among.vent) {   // ve ventu: tmavé okraje
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(-wide, 0, W + 2 * wide, H);
  }
}
function drawAmongSabButton(keys) {
  const S = among.S;
  if (!S || among.phase !== 'play') return;
  // nápis o sabotáži (vidí všichni)
  if (amongSabOn('lights')) drawOutlinedText(`💡 Světla zhasnutá! Nahoď jističe u rozvodny${among.role === 'zaskodnik' ? '' : ' (⚡)'}`, 400, 456, 'bold 15px sans-serif', '#ffd54a', 'middle');
  else if (amongSabOn('doors')) drawOutlinedText(`🚪 Dveře jsou zamčené (${Math.ceil((S.sab.until - mpServerNow()) / 1000)} s)`, 400, 456, 'bold 15px sans-serif', '#ff8a80', 'middle');
  if (among.vent) {   // šipky k ostatním ventům
    drawOutlinedText('Jsi ve ventu – nikdo tě nevidí', 400, 360, 'bold 18px sans-serif', '#ffffff', 'middle');
    amongVentOthers().forEach((v, i) => drawChessButton(amongVentBtn(i), `${keys ? `${i + 1}) ` : ''}➜ ${amongPlaceName(v)}`, false, '#455a64'));
    return;
  }
  if (!amongCanSab()) return;
  const wait = amongSabWait();
  drawAmongAction(AMONG.ACT.sab, '⚡', keys ? 'SABOTÁŽ (F)' : 'SABOTÁŽ', wait === 0, wait > 0 ? String(wait) : '');
  if (!state.amongSab) return;
  roundRectPath(460, 300, 330, 160, 12);
  ctx.fillStyle = 'rgba(30, 10, 10, 0.92)'; ctx.fill();
  ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.stroke();
  drawOutlinedText('Sabotáž', 625, 316, 'bold 14px sans-serif', '#ff8a80', 'middle');
  AMONG_SAB_ROWS.forEach((r, i) => drawChessButton(amongSabRect(i), `${keys ? `${i + 1}) ` : ''}${r.label}`, false, '#7a2a20'));
}
