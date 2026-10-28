// Zvuky hororu: hudba na pozadí, Kabát při honičce, kroky, dech, věci, online
// Část hry Dárek – načítá se v index.html po 41_ucty_a_odmeny.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// - Pozadí: zvuky/horor/horor pozadí.mp3 (dokola) místo syntetického hučení.
// - Kabát (Rumcajs miloval Manku) hraje od začátku hry pořád dokola, ale potichu (hlasitost 0);
//   slyšet je, jen když tě Láďa honí (vidí tě) – čím blíž, tím hlasitěji; když tě ztratí, ztiší se.
//   Nezačíná tak pokaždé od začátku.
// - Hráč: kroky podle podlahy (teraco, parkety, dlaždice, kámen, prkna, schody), chůze potichu,
//   sprint nahlas; při honičce rychlý dech; ve skříni vrznutí dvířek a tlumený dech.
// - Věci: šuplík (dřevo), baterka (cvaknutí, bzučení, když dochází), klíč (cinknutí, fanfára
//   při posledním), klíč od Křiváčka, pistole (výstřel s ozvěnou, cvaknutí naprázdno, nabití),
//   tyčinka (šustění), očka (zvonění), lékárnička (zip).
// - Online: kroky kamarádů (podle toho, kde jsou), výkřik a sténání kamaráda, který leží.
// =====================================================================
const HOROR_SFX = {
  BG: 'zvuky/horor/horor pozadí.mp3',
  CHASE: 'zvuky/horor/Kabát - RUMCAJS MILOVAL MANKU (Official Video).mp3',
  BG_VOL: 0.45, CHASE_MAX: 0.95, CHASE_NEAR: 120, CHASE_FAR: 700,
};
const hsfx = { bg: null, chase: null, chaseVol: 0, bgVol: 0, stepI: 0, hid: null, breathT: 0, buzzT: 0, got: 0, bat: 100, ammo: null, mates: {}, down: {}, moanT: {} };
function hsfxAudio(src) {
  try { const a = new Audio(src); a.loop = true; a.preload = 'auto'; a.volume = 0; a.setAttribute('playsinline', ''); return a; } catch (e) { return null; }
}
// Hlasitost přes Web Audio (GainNode) – na iPhonu / iPadu nejde měnit audio.volume (je pořád 100 %)
function hsfxGain(a) {
  if (!a) return null;
  if (a.gainNode !== undefined) return a.gainNode;
  a.gainNode = null;
  const c = audio.ctx;
  // ze souboru na disku (file://) by zesilovač hrál ticho (cizí původ) – tam jen obyčejná hlasitost
  if (!c || !c.createMediaElementSource || (location.protocol === 'file:' && !/^data:/.test(a.src))) return null;
  try {
    const src = c.createMediaElementSource(a), g = c.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(c.destination);
    a.volume = 1;   // hlasitost teď řídí zesilovač
    a.gainNode = g;
  } catch (e) { a.gainNode = null; }
  return a.gainNode;
}
function hsfxSetVol(a, v) {
  if (!a) return;
  v = Math.max(0, Math.min(1, v));
  const g = hsfxGain(a);
  if (g) g.gain.value = v;
  else {   // bez Web Audio: hlasitost, a kde nejde (iPhone), aspoň pauza při tichu – pak pokračuje, kde přestala
    a.volume = v;
    if (v < 0.01 && !a.paused && a === hsfx.chase) a.pause();
    else if (v >= 0.01 && a.paused && hsfx.on) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  }
}
function hsfxStart() {
  if (!hsfx.bg) hsfx.bg = hsfxAudio(HOROR_SFX.BG);
  if (!hsfx.chase) hsfx.chase = hsfxAudio(HOROR_SFX.CHASE);
  hsfx.on = true;
  if (audio.ctx && audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume().catch(() => {});
  for (const a of [hsfx.bg, hsfx.chase]) {
    if (!a) continue;
    hsfxSetVol(a, 0);   // nejdřív ticho (na mobilu i Kabát potichu)
    if (a.paused && (a.gainNode || a === hsfx.bg)) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  }
}
function hsfxStop() {
  hsfx.on = false;
  for (const a of [hsfx.bg, hsfx.chase]) if (a) { hsfxSetVol(a, 0); a.pause(); }
  if (hsfx.chase) hsfx.chase.currentTime = 0;   // nová hra = Kabát zase od začátku
  hsfx.chaseVol = 0; hsfx.bgVol = 0;
}

// --- syntetické zvuky (Web Audio) ---
function hsfxNoise(dur, freq, gain, pan, delay, type, q) {   // šum přes filtr (type: bandpass / lowpass / highpass)
  const c = hororAC();
  if (!c) return;
  try {
    const t0 = c.currentTime + (delay || 0), n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 0.9;
    g.gain.value = gain;
    s.connect(f); f.connect(g); hororPan(c, pan, g).connect(c.destination);
    s.start(t0);
  } catch (e) { /* bez zvuku */ }
}
// Kroky podle podlahy: [frekvence, Q, hlasitost, délka]
const HSFX_STEP = {
  1: [900, 1.2, 1, 0.07],    // teraco (tvrdé, cvaknutí)
  2: [420, 1.0, 0.9, 0.09],  // parkety (dřevo, dutější)
  3: [1300, 1.5, 0.9, 0.06], // dlaždice na WC
  4: [700, 1.0, 1, 0.08],    // kámen
  5: [300, 0.9, 1, 0.1],     // prkna v aule (duní)
  st: [550, 1.0, 1.15, 0.09], // schody
};
function hsfxStep(code, loud, pan, delay) {
  const s = HSFX_STEP[code] || HSFX_STEP[1];
  hsfxNoise(s[3], s[0] * (0.9 + Math.random() * 0.2), 0.11 * s[2] * loud, pan || 0, delay, 'bandpass', s[1]);
  hsfxNoise(s[3] * 0.6, 120, 0.06 * s[2] * loud, pan || 0, delay, 'lowpass');   // dopad paty
}
function hsfxFloorAt(M, x, y) {
  const i = Math.floor((x - M.room.x) / M.C), j = Math.floor((y - M.room.y) / M.C);
  if (i < 0 || j < 0 || i >= M.W || j >= M.H) return 1;
  const c = j * M.W + i;
  return M.fh && Math.abs(M.fh[c]) > 0.5 ? 'st' : M.fl[c];
}
const hsfxBreath = (gain, fast) => {   // nádech / výdech
  hsfxNoise(fast ? 0.22 : 0.4, 900, gain, 0, 0, 'bandpass', 0.6);
  hsfxNoise(fast ? 0.26 : 0.5, 600, gain * 0.8, 0, fast ? 0.26 : 0.55, 'bandpass', 0.6);
};
const HSFX = {
  creak: () => { hororTone(220, 0.45, 'sawtooth', 0.05, 0, 330); hororTone(180, 0.3, 'triangle', 0.04, 0, 260, 0.2); hsfxNoise(0.25, 400, 0.15, 0, 0, 'bandpass', 3); },
  drawerOpen: () => { hsfxNoise(0.35, 350, 0.35, 0, 0, 'bandpass', 1.4); hsfxNoise(0.08, 900, 0.2, 0, 0.33); },
  drawerClose: () => { hsfxNoise(0.25, 380, 0.3, 0, 0, 'bandpass', 1.4); hsfxNoise(0.1, 200, 0.45, 0, 0.22, 'lowpass'); },
  batteryIn: () => { hsfxNoise(0.04, 2500, 0.3, 0, 0, 'highpass'); hsfxNoise(0.05, 1800, 0.35, 0, 0.12, 'highpass'); hororTone(1400, 0.05, 'square', 0.05, 0, 0, 0.2); },   // vytáhnout, zasunout, cvak baterky
  batteryTake: () => { hsfxNoise(0.06, 1600, 0.25, 0, 0); hororTone(900, 0.06, 'triangle', 0.08, 0, 0, 0.05); },
  buzz: () => hororTone(118, 0.25, 'sawtooth', 0.025),
  key: () => { hororTone(2637, 0.08, 'triangle', 0.12); hororTone(3136, 0.12, 'triangle', 0.1, 0, 0, 0.06); hororTone(2349, 0.1, 'triangle', 0.08, 0, 0, 0.14); },
  allKeys: () => [523, 659, 784, 1047].forEach((f, i) => hororTone(f, 0.35, 'triangle', 0.18, 0, 0, i * 0.12)),
  bigKey: () => { HSFX.key(); hororTone(196, 0.5, 'sawtooth', 0.08, 0, 0, 0.1); hororTone(294, 0.6, 'triangle', 0.1, 0, 0, 0.2); },
  gunPick: () => { hsfxNoise(0.05, 2200, 0.35, 0, 0, 'highpass'); hsfxNoise(0.06, 1500, 0.4, 0, 0.15, 'highpass'); },   // nabití (cvak-cvak)
  shot: () => {
    hsfxNoise(0.35, 2000, 1, 0, 0, 'lowpass'); hororTone(70, 0.35, 'sine', 0.5, 0, 35);
    for (let k = 1; k <= 3; k++) hsfxNoise(0.35, 900, 0.3 / k, (k % 2 ? 0.5 : -0.5), 0.12 * k + 0.05, 'lowpass');   // ozvěna po chodbě
  },
  dry: () => hsfxNoise(0.04, 3000, 0.35, 0, 0, 'highpass'),
  wrapper: () => { for (let i = 0; i < 6; i++) hsfxNoise(0.05, 3500 + Math.random() * 2000, 0.12, 0, i * 0.06, 'highpass'); hsfxNoise(0.12, 300, 0.15, 0, 0.45, 'lowpass'); },
  eyes: () => { [1568, 2093, 2637].forEach((f, i) => hororTone(f, 1.2, 'sine', 0.07, 0, f * 0.98, i * 0.08)); hororTone(98, 1.4, 'sine', 0.12, 0, 73); },
  zip: () => { for (let i = 0; i < 10; i++) hsfxNoise(0.025, 4000, 0.18, 0, i * 0.03, 'highpass', 2); },
  scream: (pan) => { hororTone(620, 0.7, 'sawtooth', 0.12, pan, 300); hsfxNoise(0.6, 1200, 0.25, pan); },
  moan: (pan, gain) => { hororTone(180, 0.9, 'sine', gain, pan, 140); hororTone(184, 0.9, 'triangle', gain * 0.5, pan, 150); },
};

// --- hudba: start / stop podle hororu ---
{
  const _begin = hororBegin, _leave = hororLeave, _drone = hororDrone;
  hororBegin = function () { _begin(); hsfxStart(); };
  hororLeave = function () { hsfxStop(); _leave(); };
  hororDrone = function () { _drone(false); };   // syntetické hučení nahradila nahrávka na pozadí
}

// --- každý krok hororu ---
{
  const _update = updateHoror;
  updateHoror = function (dt) {
    _update(dt);
    const H = state.horor;
    if (H && state.screen === 'horor') hsfxTick(H, dt);
    else if (hsfx.bg && !hsfx.bg.paused) hsfxStop();
  };
}
function hsfxTick(H, dt) {
  const playing = H.phase === 'play' || H.phase === 'pause' || (H.phase === 'caught' && H.net);
  if (playing && (!hsfx.on || (hsfx.bg && hsfx.bg.paused)) && !audio.muted) hsfxStart();   // online: kolo spustil hostitel
  const k = 1 - Math.exp(-dt * 3), me = hororMe(), L = H.lada, p = H.p;
  // pozadí
  const bgWant = !audio.muted && playing && H.phase !== 'pause' ? HOROR_SFX.BG_VOL : !audio.muted && H.phase === 'pause' ? HOROR_SFX.BG_VOL * 0.4 : 0;
  hsfx.bgVol += (bgWant - hsfx.bgVol) * k;
  hsfxSetVol(hsfx.bg, hsfx.bgVol);
  // Kabát: jen když mě Láďa honí, hlasitost podle vzdálenosti
  let chaseWant = 0;
  if (!audio.muted && H.phase === 'play' && L && p && L.mode === 'chase' && L.tg === me && !H.ghost) {
    const d = L.room === p.room ? hororDist(L, p) : HOROR_SFX.CHASE_FAR;
    chaseWant = HOROR_SFX.CHASE_MAX * Math.max(0.2, Math.min(1, 1 - (d - HOROR_SFX.CHASE_NEAR) / (HOROR_SFX.CHASE_FAR - HOROR_SFX.CHASE_NEAR)));
  }
  hsfx.chaseVol += (chaseWant - hsfx.chaseVol) * (chaseWant > hsfx.chaseVol ? 1 - Math.exp(-dt * 6) : 1 - Math.exp(-dt * 1.2));   // nahoru rychle, dolů pomalu
  hsfxSetVol(hsfx.chase, hsfx.chaseVol);
  if (H.phase !== 'play' || !p) return;
  const M = hororMap(p.room);
  // vlastní kroky (podle fáze chůze z hororu – H.walk roste při pohybu)
  const step = Math.floor(H.walk / Math.PI);
  if (step !== hsfx.stepI) {
    hsfx.stepI = step;
    if (!H.hidden && !H.downed) hsfxStep(hsfxFloorAt(M, p.x, p.y), H.running ? 1.6 : 0.55, step % 2 ? 0.15 : -0.15);
  }
  // dech: při honičce rychlý, ve skříni tlumený
  hsfx.breathT -= dt;
  const chased = L && L.mode === 'chase' && L.tg === me;
  if (hsfx.breathT <= 0) {
    if (H.hidden) { hsfx.breathT = 2.2; hsfxNoise(0.5, 350, 0.08, 0, 0, 'lowpass'); }
    else if (chased && !H.ghost) { hsfx.breathT = 0.55; hsfxBreath(0.09, true); }
    else hsfx.breathT = 0.5;
  }
  // skříň: vrznutí při zalezení / vylezení
  if (!!H.hidden !== !!hsfx.hid) { if (HOROR_HIDE_IN.includes((H.hidden || hsfx.hid).kind)) HSFX.creak(); hsfx.hid = H.hidden; }
  // baterka: výměna (skok nahoru), bzučení, když dochází
  if (H.bat > hsfx.bat + 5) HSFX.batteryIn();
  hsfx.bat = H.bat;
  hsfx.buzzT -= dt;
  if (H.bat > 0 && H.bat < 12 && !H.ghost && hsfx.buzzT <= 0) { hsfx.buzzT = 1.3 + Math.random(); HSFX.buzz(); }
  // klíče: poslední = fanfára
  if (H.got !== hsfx.got) { if (H.got > hsfx.got && H.got >= HOROR.KEYS) HSFX.allKeys(); hsfx.got = H.got; }
  // online: kroky kamarádů, ležící kamarádi
  if (H.net && typeof hororOthers === 'function') {
    for (const o of hororOthers()) {
      const prev = hsfx.mates[o.id] || { x: o.x, y: o.y, acc: 0, r: o.r };
      if (prev.r !== o.r) { prev.x = o.x; prev.y = o.y; prev.r = o.r; }
      prev.acc += Math.hypot(o.x - prev.x, o.y - prev.y); prev.x = o.x; prev.y = o.y;
      const gap = o.hr ? 55 : 42;
      if (prev.acc >= gap) {
        prev.acc = 0;
        if (o.r === p.room && !o.gh) {
          const d = Math.hypot(o.x - p.x, o.y - p.y);
          if (d < 650) hsfxStep(hsfxFloorAt(M, o.x, o.y), (o.hr ? 1.4 : 0.6) * Math.min(1, 80 / Math.max(40, d)) * 1.5, Math.sin(hororAngle(Math.atan2(o.y - p.y, o.x - p.x) - p.a)));
        }
      }
      hsfx.mates[o.id] = prev;
      const down = !!(H.down && o.id in H.down);
      const pan = Math.sin(hororAngle(Math.atan2(o.y - p.y, o.x - p.x) - p.a)), near = o.r === p.room ? Math.min(1, 150 / Math.max(60, Math.hypot(o.x - p.x, o.y - p.y))) : 0.15;
      if (down && !hsfx.down[o.id]) HSFX.scream(pan);   // právě ho chytil
      if (down) {
        hsfx.moanT[o.id] = (hsfx.moanT[o.id] || 3) - dt;
        if (hsfx.moanT[o.id] <= 0) { hsfx.moanT[o.id] = 3 + Math.random() * 2; HSFX.moan(pan, 0.12 * near); }
      }
      hsfx.down[o.id] = down;
    }
  }
}

// --- moje akce s věcmi ---
{
  const _do = hororDo;
  hororDo = function (d) {
    const H = state.horor;
    if (d.k === 'drw') (H.open.has(d.id) ? HSFX.drawerClose : HSFX.drawerOpen)();
    else if (d.k === 'take') HSFX.batteryTake();
    else if (d.k === 'key') HSFX.key();
    else if (d.k === 'kk') HSFX.bigKey();
    else if (d.k === 'gun') HSFX.gunPick();
    else if (d.k === 'give') HSFX.batteryTake();
    _do(d);
  };
  const _item = hororItemKey;
  hororItemKey = function (H, which) {
    const before = H.items ? { ...H.items } : {};
    _item(H, which);
    if (!H.items || (H.items[which] | 0) >= (before[which] | 0)) return;   // nepoužilo se
    if (which === 'tycinka') HSFX.wrapper();
    else if (which === 'ocka') HSFX.eyes();
    else if (which === 'lekarnicka') HSFX.zip();
  };
  const _shoot = hororShoot;
  hororShoot = function (H) {
    const g = H.gun;
    if (g && g.by === hororMe() && !H.ghost && !H.downed) (g.ammo > 0 ? HSFX.shot : HSFX.dry)();
    _shoot(H);
  };
}
