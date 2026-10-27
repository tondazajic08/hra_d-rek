// Bacha na Láďu online – hra pro 2–4 kamarády (seznam her, čekárna, start, síť)
// Část hry Dárek – načítá se v index.html po 39_horor.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// Úvod hororu → „👥 Hrát s kamarády“ → seznam založených her (nebo ➕ Založit hru).
// Max 4 hráči. V čekárně čekají, hostitel (kdo hru založil / je v ní nejdéle) dá ▶ Spustit
// a všichni se objeví na startu dole v Hlavní chodbě.
// - Kdo je ve hře: pole g / gj / gp v záznamu hráče (hraci/<id>), stejně jako Among Us –
//   id hry začíná „lada“, aby se hry nepletly. Poloha (r, x, y) a v poli a: „úhel,baterka,stav“
//   (stav: 1 schovaný, 2 sprintuje, 4 duch). Žádná nová pravidla databáze nejsou potřeba.
// - Stav kola řídí hostitel: among/<hra>/s = { d: JSON, t } – Láďa (simuluje ho jen hostitel),
//   klíče, otevřené šuplíky, sebrané baterky, náhradní baterky hráčů, chycení. Ostatní posílají
//   akce (šuplík, baterka, půjčení, klíč, útěk) jako zprávy among/<hra>/e a hostitel je provede.
// - Láďa honí toho, koho vidí nejblíž. Chycený je duch (chodí dál, Láďa ho nevidí).
//   Klíče jsou společné: stačí, když s nimi uteče jeden. Všichni chycení = prohra.
// - Baterky jde půjčit (G / 🔋 Půjčit), když stojíš u kamaráda.
// =====================================================================
const HOROR_NET = { MAX: 4, PREFIX: 'lada', SEND: 0.12, ROWS: 5, END_BACK: 20 };
const HN_PANEL = { x: 170, y: 90, w: 460, h: 500 };
const hnRows = (n) => Array.from({ length: n }, (_, i) => ({ x: 220, y: 190 + i * 50, w: 360, h: 44 }));
const HN_CREATE = { x: 220, y: 456, w: 360, h: 44 }, HN_BACK = { x: 220, y: 508, w: 360, h: 44 };
const HN_START = { x: 220, y: 456, w: 360, h: 44 };

const hororNetOn = () => !!(state.screen === 'horor' && state.horor && state.horor.net && state.horor.net.game);
function hororOnlinePick(H) {
  if (!mp.on) { setOnline(true); if (!mp.on) return; }   // poprvé se zeptá na jméno
  H.net = { game: '', joined: 0, sel: 0, S: null, round: 0, inbox: [], es: null, esE: null, sendT: 0, dirty: false, note: '', noteT: 0 };
  H.phase = 'pick';
  amongPurge();   // staré hry v databázi (36_among.js)
}
function hnNote(H, t) { H.net.note = t; H.net.noteT = performance.now(); }

// --- Hry a hráči ---
function hororGames() {
  const H = state.horor, games = {};
  for (const o of Object.values(mp.others)) {
    if (!o.g || !o.g.startsWith(HOROR_NET.PREFIX) || !amongAlive(o)) continue;
    (games[o.g] = games[o.g] || { id: o.g, players: [] }).players.push({ id: o.id, n: o.n, gj: o.gj || 0, gp: o.gp });
  }
  if (H && H.net && H.net.game) (games[H.net.game] = games[H.net.game] || { id: H.net.game, players: [] }).players.push({ id: mp.id, n: mp.name, gj: H.net.joined, gp: H.phase !== 'lobby', me: true });
  for (const g of Object.values(games)) {
    g.players.sort((a, b) => a.gj - b.gj || (a.id < b.id ? -1 : 1));
    g.playing = g.players.some((p) => p.gp);
  }
  return Object.values(games).sort((a, b) => a.players[0].gj - b.players[0].gj);
}
const hororMyGame = () => { const H = state.horor; return H && H.net ? hororGames().find((g) => g.id === H.net.game) || null : null; };
function hororIsHost() {
  const H = state.horor;
  if (!H || !H.net) return true;
  const g = hororMyGame();
  return !!g && g.players[0].me;
}
// Ostatní hráči v mé hře (poloha z hraci/<id>, v poli a: úhel, baterka, stav)
function hororOthers() {
  const H = state.horor;
  if (!H || !H.net || !H.net.game) return [];
  return Object.values(mp.others).filter((o) => o.g === H.net.game && amongAlive(o)).map((o) => {
    const [a, b, f] = String(o.a || '').split(','), fl = parseInt(f, 10) || 0;
    o.ang = parseFloat(a) || 0;
    o.hb = b !== undefined && b !== '' ? Math.max(0, parseInt(b, 10) || 0) : undefined;
    o.hh = !!(fl & 1); o.hr = !!(fl & 2); o.gh = !!(fl & 4);
    return o;
  });
}
// Kamarád u mě (půjčit baterku)
function hororMateNear(H) {
  if (!H.net || H.ghost) return null;
  let best = null, bd = 80;
  for (const o of hororOthers()) {
    if (o.r !== H.p.room || o.gh || (H.out || []).includes(o.id)) continue;
    const d = Math.hypot(o.x - H.p.x, o.y - H.p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// Můj záznam v hraci/<id> (29_multiplayer.js, mpMyRecord)
function hororMyRecord() {
  const H = state.horor, p = H.p;
  const rec = { n: mp.name, r: p.room, x: Math.round(p.x), y: Math.round(p.y), g: H.net.game, gj: H.net.joined };
  if (H.phase !== 'lobby') rec.gp = 1;
  const fl = (H.hidden ? 1 : 0) | (H.running ? 2 : 0) | (H.ghost ? 4 : 0);
  rec.a = `${hororAngle(p.a).toFixed(2)},${Math.min(99, Math.round(H.bat))},${fl}`;   // max 12 znaků (pravidla)
  if (mySkin !== SKINS[0]) rec.s = mySkin.id;   // skin z Lockeru (33_skiny.js)
  return rec;
}

// --- Připojení, odchod ---
function hororJoin(H, gameId) {
  Object.assign(H.net, { game: gameId, joined: Math.round(amongNow()), S: null, round: 0, inbox: [] });
  H.phase = 'lobby';
  hororResetPlayer(H, 0);
  hororNetOpen(H);
  mp.last = '';   // hned dát vědět ostatním
  playSound([[523, 0, 0.06], [659, 0.07, 0.06], [784, 0.14, 0.1]]);
}
function hororNetOpen(H) {
  if (H.net.es) return;
  let raw = {};
  H.net.es = amongStream(amongUrl(`${H.net.game}/s`), (path, data, patch) => {
    if (path === '/') raw = patch ? Object.assign(raw, data) : (data || {});
    else raw[path.split('/').filter(Boolean)[0]] = data;
    if (typeof raw.d !== 'string' || state.horor !== H || !H.net) return;
    try { hororApplyS(H, JSON.parse(raw.d)); } catch (err) { /* poškozený stav */ }
  });
}
function hororNetClose(H) {
  if (!H || !H.net) return;
  if (H.net.es) H.net.es.close();
  if (H.net.esE) H.net.esE.close();
  H.net.es = null; H.net.esE = null;
}
function hororNetLeave() {
  const H = state.horor;
  if (!H || !H.net) return;
  hororNetClose(H);
  H.net = null;
}

// --- Stav kola od hostitele ---
const hororLadaFrom = (l) => ({ room: l.room, x: l.x, y: l.y, a: l.a || 0, mode: l.mode || 'patrol', tg: l.tg || '', path: [], via: null, goal: null, pathT: 0, lookT: 3, stepT: 0, seenT: 99, last: { room: l.room, x: l.x, y: l.y } });
function hororApplyS(H, S) {
  if (!S || typeof S !== 'object' || !H.net) return;
  const prev = H.net.S;
  if (prev && prev.k === S.k && Number.isFinite(prev.v) && Number.isFinite(S.v) && S.v < prev.v) return;   // starší (přišel pozdě)
  H.net.S = S;
  if (S.st === 'lobby') {
    if (H.phase !== 'lobby' && H.phase !== 'pick') hororToLobby(H);
    return;
  }
  if (!Array.isArray(S.p) || !S.p.includes(mp.id)) return;   // připojil jsem se až během kola – čekám v čekárně
  if (S.k !== H.net.round) {   // nové kolo: všichni na start
    H.net.round = S.k;
    Object.assign(H, { keys: S.keys.map((k) => ({ ...k })), seed: S.seed, open: new Set(S.open || []), taken: new Set(S.taken || []), sp: { ...(S.sp || {}) }, out: (S.out || []).slice(), hs: {}, hidPrev: {}, st: 'play', lada: hororLadaFrom(S.lada), ladaT: null });
    H.got = H.keys.filter((k) => k.got).length;
    hororResetPlayer(H, S.p.indexOf(mp.id));
    H.scared = !!S.sc; H.scN = S.sc ? S.sc.n : 0;
    H.phase = 'play'; H.t = 0; H.fxRoom = H.lada.room;
    hororDrone(true); hororLock();
    hororSay('Najděte 3 klíče a utečte! Láďa je někde nahoře…', 4);
    return;
  }
  if (!hororIsHost()) {   // hostitel má pravdu u sebe; ostatní přebírají
    const before = H.got;
    H.keys = S.keys.map((k) => ({ ...k }));
    H.got = H.keys.filter((k) => k.got).length;
    if (H.got > before) {
      const k = H.keys.filter((q) => q.got && q.by !== mp.id).pop();
      if (k) { hororTone(988, 0.15, 'triangle', 0.2); hororSay(`🔑 ${amongName(k.by)} našel klíč (${H.got}/${HOROR.KEYS})`, 3); }
    }
    H.open = new Set(S.open || []); H.taken = new Set(S.taken || []); H.sp = { ...(S.sp || {}) }; H.out = (S.out || []).slice();
    H.ladaT = S.lada;
    if (!H.lada || H.lada.room !== S.lada.room) H.lada = hororLadaFrom(S.lada);
    Object.assign(H.lada, { mode: S.lada.mode, tg: S.lada.tg || '' });
    H.st = S.st;
  }
  if ((S.out || []).includes(mp.id) && !H.ghost && H.phase === 'play') hororCaught(H);
  if (S.sc && S.sc.n !== H.scN) { H.scN = S.sc.n; H.scared = true; if (S.sc.id === mp.id && !hororIsHost()) hororScareFx(H); }   // hostitel už to má (hororScare)
  if ((S.st === 'win' || S.st === 'lose') && H.phase !== 'end') {
    H.phase = 'end'; H.endT = 0; H.st = S.st; H.winBy = S.by || '';
    hororDrone(false);
    if (document.pointerLockElement) document.exitPointerLock();
    if (S.st === 'win') { hororTone(523, 0.2, 'triangle', 0.3); hororTone(784, 0.4, 'triangle', 0.3, 0, 0, 0.2); } else hororScream();
  }
}
function hororToLobby(H) {
  H.phase = 'lobby'; H.ghost = false; H.hidden = null;
  hororResetPlayer(H, 0);
  hororDrone(false);
  if (document.pointerLockElement) document.exitPointerLock();
  mp.last = '';
}
// Hostitel: stav kola do databáze
function hororWriteS(H, extra) {
  const S0 = H.net.S || {};
  const S = {
    st: H.st || 'play', k: H.net.round, p: S0.p || [], seed: H.seed, by: H.winBy || '',
    keys: H.keys.map((k) => ({ room: k.room, x: Math.round(k.x), y: Math.round(k.y), got: !!k.got, by: k.by || '' })),
    lada: { room: H.lada.room, x: Math.round(H.lada.x), y: Math.round(H.lada.y), a: +H.lada.a.toFixed(2), mode: H.lada.mode, tg: H.lada.tg || '' },
    open: [...H.open], taken: [...H.taken], sp: H.sp, out: H.out, sc: H.sc || null, ...extra,
  };
  S.v = (S0.v || 0) + 1;
  fetch(amongUrl(`${H.net.game}/s`), { method: 'PUT', body: JSON.stringify({ d: JSON.stringify(S), t: { '.sv': 'timestamp' } }) }).catch(() => {});
  hororApplyS(H, S);   // u sebe hned (konec hry, chycení)
}
// Hostitel spustí kolo: všichni z čekárny (max 4)
function hororNetStart(H) {
  const g = hororMyGame();
  if (!g) return;
  const r = hororMakeRound(), ids = g.players.filter((p) => !p.gp || p.me).slice(0, HOROR_NET.MAX).map((p) => p.id);
  H.net.round = 0;   // hororApplyS pozná nové kolo
  const k = ((H.net.S && H.net.S.k) || 0) + 1;
  Object.assign(H, { keys: r.keys, seed: r.seed, lada: r.lada, open: new Set(), taken: new Set(), sp: {}, out: [], sc: null, st: 'play', winBy: '' });
  H.net.S = { k: H.net.S ? H.net.S.k : 0, v: H.net.S ? H.net.S.v : 0, p: ids };
  const S = {
    st: 'play', k, p: ids, seed: r.seed, by: '', keys: r.keys, lada: { room: r.lada.room, x: Math.round(r.lada.x), y: Math.round(r.lada.y), a: 0, mode: 'patrol', tg: '' },
    open: [], taken: [], sp: {}, out: [], sc: null, v: (H.net.S.v || 0) + 1,
  };
  fetch(amongUrl(`${H.net.game}/s`), { method: 'PUT', body: JSON.stringify({ d: JSON.stringify(S), t: { '.sv': 'timestamp' } }) }).catch(() => {});
  hororApplyS(H, S);
}
// Moje akce: hostitel ji provede hned, ostatní ji pošlou hostiteli
function hororNetDo(H, d) {
  if (hororIsHost()) { hororAct(H, mp.id, d); H.net.dirty = true; return; }
  const me = mp.id;
  if (d.k === 'use' && (H.sp[me] || 0) > 0) { H.sp[me]--; H.bat = 100; hororTone(880, 0.1, 'square', 0.12); hororSay('🔦 Nová baterka', 1.5); }   // hned u sebe
  if (d.k === 'drw') hororNoise(0.22, 900, 0.3, 0);
  fetch(amongUrl(`${H.net.game}/e`), { method: 'POST', body: JSON.stringify({ f: me, d: JSON.stringify({ ...d, r: H.net.round }), t: { '.sv': 'timestamp' } }) }).catch(() => {});
}
function hororHostTick(H, dt) {
  const net = H.net;
  if (!net.esE) {
    net.esE = amongStream(amongUrl(`${net.game}/e`), (path, data) => {
      const key = path.split('/').filter(Boolean)[0];
      const add = (k, v) => { if (v && typeof v.f === 'string' && typeof v.d === 'string') net.inbox.push({ key: k, f: v.f, d: v.d }); };
      if (key) add(key, data); else for (const [k, v] of Object.entries(data || {})) add(k, v);
    });
  }
  for (const m of net.inbox.splice(0)) {
    fetch(amongUrl(`${net.game}/e/${m.key}`), { method: 'DELETE' }).catch(() => {});   // přečteno
    let d;
    try { d = JSON.parse(m.d); } catch (err) { continue; }
    if (!d || d.r !== net.round || !(net.S.p || []).includes(m.f)) continue;
    if (d.k === 'use' && (H.sp[m.f] || 0) <= 0) continue;
    const had = H.got;
    hororAct(H, m.f, d);
    if (d.k === 'key' && H.got > had) { hororTone(988, 0.15, 'triangle', 0.2); hororSay(`🔑 ${amongName(m.f)} našel klíč (${H.got}/${HOROR.KEYS})`, 3); }
    net.dirty = true;
  }
  if (H.st === 'play') {
    // kdo z kola odešel, je jako chycený; všichni chycení = prohra
    const here = new Set((hororMyGame() || { players: [] }).players.map((p) => p.id));
    for (const id of net.S.p || []) if (!here.has(id) && !H.out.includes(id)) { H.out.push(id); net.dirty = true; }
    if ((net.S.p || []).length && (net.S.p || []).every((id) => H.out.includes(id))) { H.st = 'lose'; net.dirty = true; }
    if (H.phase === 'pause' || H.phase === 'caught') hororLada(H, dt);   // Láďa jde dál, i když mám pauzu
  }
  net.sendT -= dt;
  if (net.dirty || (net.sendT <= 0 && H.st === 'play')) { net.sendT = HOROR_NET.SEND; net.dirty = false; hororWriteS(H); }
}

// --- Krok (volá updateHoror v 39_horor.js); false = tenhle snímek už je vyřízený ---
function hororNetTick(H, dt, keys, events) {
  const net = H.net;
  if (net.noteT && performance.now() - net.noteT > 5000) net.note = '';
  if (H.phase === 'pick') { hororPickInput(H, keys, events); return false; }
  if (H.phase === 'lobby') { hororLobbyInput(H, keys, events); return false; }
  if (net.S && net.round === net.S.k && hororIsHost()) hororHostTick(H, dt);
  else if (H.ladaT && H.lada) {   // Láďa od hostitele: plynule dojede
    const L = H.lada, T = H.ladaT, k = 1 - Math.exp(-10 * dt);
    if (Math.hypot(T.x - L.x, T.y - L.y) > 200) { L.x = T.x; L.y = T.y; } else { L.x += (T.x - L.x) * k; L.y += (T.y - L.y) * k; }
    L.a = T.a;
  }
  if (H.phase === 'end') {
    H.endT += dt;
    if (H.endT < 1.2) return false;
    for (const e of events) {
      const i = e.type === 'action' ? H.overSel : chessHit(chessOverButtons(), e);
      if (i === 0) { hororBackToLobby(H); return false; }
      if (i === 1) { hororLeave(); return false; }
    }
    for (const k of keys) {
      if (KEYMAP.up.includes(k) || KEYMAP.down.includes(k)) H.overSel = 1 - H.overSel;
      if (k === 'Escape') { hororLeave(); return false; }
    }
    if (H.endT > HOROR_NET.END_BACK && hororIsHost()) hororBackToLobby(H);
    return false;
  }
  return true;
}
function hororBackToLobby(H) {
  if (hororIsHost() && H.net.S && H.net.S.st !== 'lobby') { H.st = 'lobby'; hororWriteS(H, { st: 'lobby' }); }
  hororToLobby(H);
}

// --- Seznam her ---
function hororPickItems() {
  const games = hororGames().slice(0, HOROR_NET.ROWS);
  return [...games.map((g) => ({ kind: 'game', g })), { kind: 'create' }, { kind: 'back' }];
}
const hororPickRect = (items, i) => (items[i].kind === 'game' ? hnRows(i + 1)[i] : items[i].kind === 'create' ? HN_CREATE : HN_BACK);
function hororPickInput(H, keys, events) {
  const items = hororPickItems(), net = H.net;
  net.sel = Math.min(net.sel, items.length - 1);
  for (const k of keys) {
    if (k === 'Escape') { H.net = null; H.phase = 'intro'; return; }
    if (KEYMAP.up.includes(k)) net.sel = (net.sel + items.length - 1) % items.length;
    if (KEYMAP.down.includes(k)) net.sel = (net.sel + 1) % items.length;
  }
  for (const e of events) {
    const i = e.type === 'action' ? net.sel : e.x != null ? items.findIndex((_, k) => pointInRect(e.x, e.y, hororPickRect(items, k), 0)) : -1;
    if (i < 0) continue;
    const it = items[i];
    if (it.kind === 'back') { H.net = null; H.phase = 'intro'; return; }
    if (it.kind === 'create') { hororJoin(H, HOROR_NET.PREFIX + mp.id.slice(0, 5) + Date.now().toString(36)); return; }
    if (it.g.players.length >= HOROR_NET.MAX) { hnNote(H, 'Hra je plná (max 4)'); continue; }
    if (it.g.playing) { hnNote(H, 'Tahle hra už běží – počkej, až skončí'); continue; }
    hororJoin(H, it.g.id);
    return;
  }
}
// --- Čekárna ---
const HN_LEAVE = { x: 220, y: 508, w: 360, h: 44 };
function hororLobbyInput(H, keys, events) {
  const host = hororIsHost(), g = hororMyGame();
  for (const k of keys) if (k === 'Escape') { hororLeave(); return; }
  for (const e of events) {
    const start = host && (e.type === 'action' || (e.x != null && pointInRect(e.x, e.y, HN_START, 0)));
    if (start) {
      if (g && g.players.length > HOROR_NET.MAX) { hnNote(H, `Max ${HOROR_NET.MAX} hráči`); continue; }
      hororNetStart(H); return;
    }
    if (e.x != null && pointInRect(e.x, e.y, HN_LEAVE, 0)) { hororLeave(); return; }
  }
}

// --- Kreslení ---
function hnPanel(title) {
  const A = HN_PANEL;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(-VIEW.offX, 0, CONFIG.WIDTH + 2 * VIEW.offX, CONFIG.HEIGHT);
  roundRectPath(A.x, A.y, A.w, A.h, 16);
  ctx.fillStyle = '#1a1416'; ctx.fill();
  ctx.strokeStyle = '#a32020'; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText(title, 400, A.y + 36, 'bold 28px sans-serif', '#ff5a4a', 'middle');
}
function drawHororNet(H) {
  if (!H.net) return;
  const net = H.net;
  if (H.phase === 'pick') {
    hnPanel('👻 Bacha na Láďu – online');
    const items = hororPickItems(), games = items.filter((it) => it.kind === 'game');
    const sub = mp.status !== 'ok' ? 'Připojuji se…' : games.length ? 'Připoj se ke hře, nebo založ novou' : 'Zatím žádná hra – založ ji a kamarádi se připojí';
    drawOutlinedText(sub, 400, HN_PANEL.y + 72, 'bold 14px sans-serif', '#e0c9c9', 'middle');
    items.forEach((it, i) => {
      const r = hororPickRect(items, i), sel = i === net.sel;
      if (it.kind === 'game') {
        const names = it.g.players.map((p) => p.n), off = names.length >= HOROR_NET.MAX || it.g.playing;
        const label = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}  ·  ${names.length}/${HOROR_NET.MAX}${names.length >= HOROR_NET.MAX ? ' (plná)' : it.g.playing ? ' (hraje se)' : ''}`;
        drawChessButton(r, label, sel && !off, off ? '#4a4a4a' : '#5a2a2a');
      } else if (it.kind === 'create') drawChessButton(r, '➕ Založit hru', sel, '#2e7d32');
      else drawChessButton(r, 'Zpět', sel, '#5a4636');
    });
  } else if (H.phase === 'lobby') {
    hnPanel('👥 Čekárna');
    const g = hororMyGame(), players = g ? g.players : [], host = hororIsHost();
    drawOutlinedText(`Hráči ${Math.min(players.length, HOROR_NET.MAX)}/${HOROR_NET.MAX}`, 400, HN_PANEL.y + 72, 'bold 15px sans-serif', '#e0c9c9', 'middle');
    players.slice(0, 6).forEach((p, i) => {
      const y = HN_PANEL.y + 120 + i * 40;
      ctx.fillStyle = p.me ? 'rgba(255, 213, 74, 0.15)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(230, y - 16, 340, 32);
      drawOutlinedText(`${i === 0 ? '👑 ' : ''}${p.n}${p.me ? ' (ty)' : ''}${p.gp && !p.me ? ' – ještě hraje' : ''}`, 400, y, 'bold 17px sans-serif', i < HOROR_NET.MAX ? '#ffffff' : '#9e9e9e', 'middle');
    });
    if (host) drawChessButton(HN_START, players.length > 1 ? '▶ Spustit hru' : '▶ Spustit (zatím sám)', true, '#2e7d32');
    else drawOutlinedText('Čekáme, až hostitel 👑 spustí hru…', 400, HN_START.y + 22, 'bold 17px sans-serif', '#ffd54a', 'middle');
    drawChessButton(HN_LEAVE, 'Odejít', false, '#5a4636');
  } else if (H.phase === 'end') {
    const W = CONFIG.WIDTH, win = H.st === 'win';
    ctx.fillStyle = win ? 'rgba(0, 20, 10, 0.9)' : 'rgba(30, 0, 0, 0.92)'; ctx.fillRect(-VIEW.offX, 0, W + 2 * VIEW.offX, CONFIG.HEIGHT);
    drawOutlinedText(win ? 'UTEKLI JSTE! 🎉' : 'LÁĎA VÁS CHYTIL VŠECHNY!', W / 2, 210, 'bold 44px sans-serif', win ? '#7ee08a' : '#ff4d4d', 'middle');
    if (win) drawOutlinedText(`Ven proběhl(a): ${H.winBy === mp.id ? 'ty' : amongName(H.winBy)}`, W / 2, 262, 'bold 18px sans-serif', '#ffffff', 'middle');
    drawOutlinedText(`Klíče: ${H.got}/${HOROR.KEYS}`, W / 2, 290, 'bold 16px sans-serif', '#e0e0e0', 'middle');
    if (H.endT >= 1.2) chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? 'Zpět do čekárny' : 'Odejít', i === H.overSel));
  }
  if (net.note) drawOutlinedText(net.note, 400, HN_PANEL.y + HN_PANEL.h + 18, 'bold 15px sans-serif', '#ff8a80', 'middle');
}
// Vpravo nahoře: kamarádi (jméno, baterka, 👻 chycený)
function drawHororMates(H) {
  if (!H.net) return;
  const list = hororOthers();
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  list.forEach((o, i) => {
    const caught = (H.out || []).includes(o.id) || o.gh;
    ctx.fillStyle = caught ? '#9e9e9e' : '#e0e0e0';
    ctx.fillText(`${caught ? '👻 ' : ''}${o.n}${o.hb !== undefined && !caught ? ` 🔦${o.hb}%` : ''}${H.sp[o.id] ? ` 🔋×${H.sp[o.id]}` : ''}`, CONFIG.WIDTH - 60, 20 + i * 16);
  });
}
// Kreslí se nakonec HUDu (39_horor.js volá drawHororNet, když existuje)
