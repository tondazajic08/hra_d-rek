// Hlasový chat: hráči ve stejné místnosti se slyší, čím blíž, tím hlasitěji
// Část hry Dárek – načítá se v index.html před 15_hlavni.js (po 29_multiplayer.js).
'use strict';

// =====================================================================
// HLAS (multiplayer 3. krok). Zvuk jde napřímo mezi prohlížeči (WebRTC),
// Firebase slouží jen k navázání spojení: nabídka a odpověď (SDP) se pošlou
// do schránky hlas/<id příjemce>/, příjemce si je přečte a hned smaže.
// - Hlas je vypnutý, dokud ho hráč nezapne (tlačítko 🎤 ve hře / ☰ / klávesa V);
//   slyší jen ten, kdo má hlas zapnutý sám.
// - Mluví se jen při držení V nebo tlačítka 🎤 (vysílačka).
// - Spojení jen s hráči ve stejné místnosti, hlasitost podle vzdálenosti.
// - V ☰ jde ztlumit konkrétního hráče.
// Pozn.: některé sítě (školní Wi-Fi, mobilní data) přímé spojení nepustí –
// pak je potřeba TURN server (přeposílá zvuk); stačí ho dopsat do VOICE.ICE.
// =====================================================================
const VOICE = {
  ICE: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    // TURN (např. z metered.ca, účet zdarma): { urls: 'turn:…:443?transport=tcp', username: '…', credential: '…' },
  ],
  PATH: 'hlas',
  KEYS: ['KeyV'],
  BUTTON: { x: 516, y: 6, w: 34, h: 30 },   // ve hře vlevo od 😊
  NEAR: 140,          // px – do takové vzdálenosti plná hlasitost
  FAR: 700,           // px – za NEAR + FAR už jen MIN_GAIN
  MIN_GAIN: 0.12,
  CONNECT_TIMEOUT: 15,   // s – nespojilo se: zavřít a zkusit znovu
  RETRY: 4,              // s
  MSG_MAX_AGE: 30000,    // ms – starší zprávy ve schránce se zahodí
  MAX_MUTE_ROWS: 2,      // kolik hráčů jde ztlumit v ☰
};
const voiceSupported = () => !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

const voice = {
  on: false,
  starting: false,
  stream: null,       // můj mikrofon
  inbox: null,        // EventSource na hlas/<mé id>
  peers: {},          // id → { pc, born, ok, el, src, gain, an, buf, talkT }
  retry: {},          // id → kdy (herní čas) smím znovu nabídnout
  fails: {},          // id → kolikrát se nepodařilo spojit (ukáže se v ☰)
  muted: new Set(),   // ztlumení hráči (jen do zavření hry)
  pttKey: false, pttPointer: null,
};
const voiceUrl = (sub) => `${MP.DB_URL.replace(/\/+$/, '')}/${VOICE.PATH}/${sub}.json`;
const voiceInGame = () => !!state.room && ['playing', 'chess', 'foosball', 'basket', 'pingpong', 'skins'].includes(state.screen);
const voiceTalking = () => voice.on && (voice.pttKey || voice.pttPointer !== null);

// --- Zapnutí a vypnutí ---
async function enableVoice() {
  if (voice.on || voice.starting) return;
  if (!mp.on) { state.toast = { text: 'Hlas jde jen s Online (zapni v ☰)', t: CONFIG.TOAST_TIME }; return; }
  if (!voiceSupported()) { state.toast = { text: 'Tenhle prohlížeč hlasový chat neumí', t: CONFIG.TOAST_TIME }; return; }
  voice.starting = true;
  try {
    voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    voice.starting = false;
    state.toast = { text: 'Bez povolení mikrofonu hlas nejde', t: CONFIG.TOAST_TIME };
    return;
  }
  voice.starting = false;
  if (!mp.on) { voiceStopMic(); return; }
  for (const t of voice.stream.getAudioTracks()) t.enabled = false;   // mluví se jen při držení
  voice.on = true;
  voiceOpenInbox();
  mp.last = '';   // ostatním hned dát vědět (v: 1)
  state.toast = { text: isTouchHint() ? 'Hlas zapnutý – mluvíš, když držíš 🎤' : 'Hlas zapnutý – mluvíš, když držíš V', t: CONFIG.TOAST_TIME };
}
function disableVoice() {
  for (const id of Object.keys(voice.peers)) voiceClosePeer(id);
  if (voice.inbox) voice.inbox.close();
  voice.inbox = null;
  voiceStopMic();
  voice.on = false;
  voice.pttKey = false; voice.pttPointer = null;
  mp.last = '';
}
function voiceStopMic() {
  if (voice.stream) for (const t of voice.stream.getTracks()) t.stop();
  voice.stream = null;
}
function toggleVoice() {
  if (voice.on) disableVoice();
  else enableVoice();
}

// --- Schránka se zprávami pro navázání spojení ---
function voiceOpenInbox() {
  if (voice.inbox || typeof EventSource === 'undefined') return;
  const es = voice.inbox = new EventSource(voiceUrl(mp.id));
  es.addEventListener('put', (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg.path !== 'string' || !msg.data) return;
    const key = msg.path.split('/').filter(Boolean)[0];
    if (key) voiceTakeMsg(key, msg.data);
    else for (const [k, v] of Object.entries(msg.data)) voiceTakeMsg(k, v);
  });
}
function voiceTakeMsg(key, m) {
  voiceDropMsg(mp.id, key);   // přečteno – smazat
  if (!m || typeof m.f !== 'string' || typeof m.d !== 'string') return;
  if (Number.isFinite(m.t) && mpServerNow() - m.t > VOICE.MSG_MAX_AGE) return;
  if (m.k === 'offer') voiceAnswer(m.f, m.d);
  else if (m.k === 'answer') {
    const p = voice.peers[m.f];
    if (p && p.pc.signalingState === 'have-local-offer') p.pc.setRemoteDescription({ type: 'answer', sdp: m.d }).catch(() => voiceClosePeer(m.f));
  }
}
function voiceDropMsg(to, key) { fetch(voiceUrl(`${to}/${key}`), { method: 'DELETE' }).catch(() => {}); }
function voiceSend(to, k, d) {
  return fetch(voiceUrl(to), { method: 'POST', body: JSON.stringify({ f: mp.id, k, d, t: { '.sv': 'timestamp' } }) })
    .then((r) => r.json()).then((r) => r && r.name).catch(() => null);   // klíč zprávy (ať jde nepřečtená smazat)
}

// --- Spojení s jedním hráčem ---
function voiceNewPeer(id) {
  voiceClosePeer(id);
  const pc = new RTCPeerConnection({ iceServers: VOICE.ICE });
  const peer = voice.peers[id] = { pc, born: state.time, ok: false, talkT: -9 };
  for (const t of voice.stream.getAudioTracks()) pc.addTrack(t, voice.stream);
  pc.ontrack = (e) => voiceAttach(peer, e.streams[0] || new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') { peer.ok = true; voice.fails[id] = 0; }
    if (pc.connectionState === 'failed' && voice.peers[id] === peer) { voiceClosePeer(id); voice.retry[id] = state.time + VOICE.RETRY; }
  };
  return peer;
}
// Celé SDP i s adresami najednou (bez posílání každé adresy zvlášť) – stačí 1 zpráva tam a 1 zpět
function voiceIceDone(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => { if (pc.iceGatheringState === 'complete') resolve(); };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, 2500);   // STUN neodpovídá: poslat, co je
  });
}
async function voiceOffer(id) {
  const peer = voiceNewPeer(id), pc = peer.pc;
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await voiceIceDone(pc);
    if (voice.peers[id] === peer) peer.sent = await voiceSend(id, 'offer', pc.localDescription.sdp);
    if (voice.peers[id] !== peer && peer.sent) voiceDropMsg(id, peer.sent);
  } catch (e) { voiceClosePeer(id); }
}
async function voiceAnswer(id, sdp) {
  if (!voice.on || !voice.stream) return;
  const peer = voiceNewPeer(id), pc = peer.pc;
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await voiceIceDone(pc);
    if (voice.peers[id] === peer) voiceSend(id, 'answer', pc.localDescription.sdp);
  } catch (e) { voiceClosePeer(id); }
}
// Příchozí zvuk: přes Web Audio kvůli hlasitosti podle vzdálenosti (jde i na iPhonu)
// a analyzátoru (kdo zrovna mluví). Chrome pustí cizí proud do Web Audio, jen když
// je zároveň v ztlumeném <audio>.
function voiceAttach(peer, stream) {
  if (peer.el) return;
  const el = peer.el = new Audio();
  el.srcObject = stream;
  el.autoplay = true;
  el.playsInline = true;
  const c = audio.ctx;
  if (c && c.createMediaStreamSource) {
    el.muted = true;
    try {
      peer.src = c.createMediaStreamSource(stream);
      peer.gain = c.createGain();
      peer.an = c.createAnalyser();
      peer.an.fftSize = 512;
      peer.buf = new Uint8Array(peer.an.fftSize);
      peer.src.connect(peer.an);
      peer.src.connect(peer.gain);
      peer.gain.connect(c.destination);
    } catch (e) { el.muted = false; }
  }
  el.play().catch(() => {});
}
function voiceClosePeer(id) {
  const p = voice.peers[id];
  if (!p) return;
  delete voice.peers[id];
  if (!p.ok && p.sent) voiceDropMsg(id, p.sent);   // nespojeno: nabídku ze schránky uklidit
  if (!p.ok && state.time - p.born > 5) voice.fails[id] = (voice.fails[id] || 0) + 1;
  try { p.pc.close(); } catch (e) { /* nevadí */ }
  if (p.el) { p.el.pause(); p.el.srcObject = null; }
  try { if (p.gain) p.gain.disconnect(); if (p.src) p.src.disconnect(); } catch (e) { /* nevadí */ }
}

// --- Každý krok hry (volá updateMultiplayer) ---
function updateVoice() {
  if (voice.on && !mp.on) disableVoice();   // vypnutý Online = vypnutý hlas
  if (!voice.on) return;
  for (const t of voice.stream.getAudioTracks()) t.enabled = voiceTalking();
  const here = voiceInGame() ? mpHere().filter((o) => o.v) : [];
  const ids = new Set(here.map((o) => o.id));
  // odešel z místnosti / vypnul hlas / nespojilo se včas → zavřít
  for (const [id, p] of Object.entries(voice.peers)) {
    const age = state.time - p.born;
    if ((!ids.has(id) && age > 3) || (!p.ok && age > VOICE.CONNECT_TIMEOUT)) {
      voiceClosePeer(id);
      voice.retry[id] = state.time + VOICE.RETRY;
    }
  }
  // nabízí vždy ten s menším id (ať si nevolají oba najednou)
  for (const o of here) {
    if (!voice.peers[o.id] && mp.id < o.id && !(voice.retry[o.id] > state.time)) voiceOffer(o.id);
  }
  // hlasitost podle vzdálenosti + kdo mluví
  const p = state.player, room = state.room;
  for (const o of here) {
    const peer = voice.peers[o.id];
    if (!peer || !peer.el) continue;
    const d = Math.hypot(o.dx - (p.x - room.x), o.dy - (p.y - room.y));
    const g = voice.muted.has(o.id) ? 0 : d <= VOICE.NEAR ? 1 : Math.max(VOICE.MIN_GAIN, 1 - (d - VOICE.NEAR) / VOICE.FAR);
    if (peer.gain) peer.gain.gain.setTargetAtTime(g, audio.ctx.currentTime, 0.1);
    else peer.el.volume = g;
    if (peer.an) {
      peer.an.getByteTimeDomainData(peer.buf);
      let sum = 0;
      for (const v of peer.buf) sum += (v - 128) * (v - 128);
      if (Math.sqrt(sum / peer.buf.length) / 128 > 0.03) peer.talkT = state.time;
    }
  }
}
// Před jménem cizího hráče (drawRemotePlayers): 🔇 ztlumený, 🔊 zrovna mluví
function voiceLabel(id) {
  if (!voice.on) return '';
  if (voice.muted.has(id)) return '🔇 ';
  const p = voice.peers[id];
  return p && state.time - p.talkT < 0.5 ? '🔊 ' : '';
}

// --- Ovládání: V / tlačítko 🎤 (podržet = mluvit) ---
const voiceButtonShown = () => mp.on && voiceSupported() && state.screen === 'playing' && !state.pauseMenu;
window.addEventListener('keydown', (e) => {
  if (!VOICE.KEYS.includes(e.code) || e.repeat || !mp.on || state.pauseMenu || !voiceInGame()) return;
  if (!voice.on) { enableVoice(); return; }
  voice.pttKey = true;
});
window.addEventListener('keyup', (e) => { if (VOICE.KEYS.includes(e.code)) voice.pttKey = false; });
window.addEventListener('blur', () => { voice.pttKey = false; voice.pttPointer = null; });
window.addEventListener('pointerdown', (e) => {
  if (!voiceButtonShown()) return;
  const g = screenToGame(e.clientX, e.clientY);
  if (!g || !pointInRect(g.x, g.y, VOICE.BUTTON, 4)) return;
  if (!voice.on) enableVoice();   // první ťuknutí: povolit mikrofon
  else voice.pttPointer = e.pointerId;
});
const voicePointerEnd = (e) => { if (e.pointerId === voice.pttPointer) voice.pttPointer = null; };
window.addEventListener('pointerup', voicePointerEnd);
window.addEventListener('pointercancel', voicePointerEnd);
// ťuknutí na 🎤 nesmí jít dál do hry (obsloužilo ho pointerdown výše)
function takeVoiceTaps() {
  if (!voiceButtonShown()) return;
  input.events = input.events.filter((ev) => !(ev.type === 'tap' && ev.x !== null && pointInRect(ev.x, ev.y, VOICE.BUTTON, 4)));
}

function drawVoiceButton() {
  if (!voiceButtonShown()) return;
  const b = VOICE.BUTTON, talking = voiceTalking();
  roundRectPath(b.x, b.y, b.w, b.h, 6);
  ctx.fillStyle = talking ? 'rgba(229, 57, 53, 0.95)' : voice.on ? 'rgba(46, 125, 50, 0.85)' : 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  if (talking) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.font = '17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = voice.on || voice.starting ? 1 : 0.55;
  ctx.fillText('🎤', b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.globalAlpha = 1;
  if (talking) {   // „vysílám“ pod tlačítkem
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ff8a80';
    ctx.fillText('mluvíš', b.x + b.w / 2, b.y + b.h + 9);
  }
}

// --- Položky v ☰ (31_menu.js): hlas zap/vyp a ztlumení hráčů tady ---
function voicePauseItems() {
  if (!mp.on || !voiceSupported()) return [];
  const items = [{ id: 'voice', label: `🎤 Hlas: ${voice.on ? 'ZAP' : 'VYP'}` }];
  if (voice.on) {
    for (const o of mpHere().filter((o) => o.v).slice(0, VOICE.MAX_MUTE_ROWS)) {
      items.push({ id: 'mute:' + o.id, label: `${voice.muted.has(o.id) ? '🔇 Ztlumený' : '🔊 Slyšíš'}: ${o.n}${voiceStateText(o.id)}` });
    }
  }
  return items;
}
// Stav spojení za jménem v ☰ – ať je vidět, proč hráče neslyším
function voiceStateText(id) {
  const p = voice.peers[id];
  if (p && p.ok) return '';
  if ((voice.fails[id] || 0) >= 2) return ' ✕ nejde spojit';
  return ' ⏳ spojuji…';
}
function voicePauseAction(id) {
  if (id === 'voice') { toggleVoice(); return true; }
  if (id.startsWith('mute:')) {
    const who = id.slice(5);
    if (voice.muted.has(who)) voice.muted.delete(who); else voice.muted.add(who);
    return true;
  }
  return false;
}
