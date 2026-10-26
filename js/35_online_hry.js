// Online zápasy: pingpong a fotbálek proti kamarádovi (výzva, přijetí a síť během hry)
// Část hry Dárek – načítá se v index.html po 34_hlas.js a před 15_hlavni.js.
'use strict';

// =====================================================================
// MULTIPLAYER – pingpong a fotbálek pro dva online.
// Výzva: v menu pingpongu / fotbálku „👥 Online – vyzvat hráče“ → vybereš hráče
//   ve stejné místnosti. Výzva i odpověď jdou polem z v záznamu hráče (hraci/<id>):
//   'komu|hra|id zápasu|stav', stav = ch (vyzývám) / ok (hrajeme) / no (nechci).
//   Vyzvanému vyskočí nahoře okno: ťuknutí nebo J = přijmout, X = odmítnout.
// Během zápasu posílá každý PUTem svůj stav do zapasy/<id zápasu>/<mé id>
//   = { d: JSON, t } a proudem (EventSource) sleduje celé zapasy/<id zápasu>.
// Souřadnice v síti jsou z pohledu vyzyvatele (hostitel, role 'h'). Druhý (role 'g')
//   má stůl otočený o 180°, takže každý hraje „zdola“ (pingpong) / „zleva“ (fotbálek).
// Kdo rozhoduje: stav nese mou poslední událost (e: q = pořadí, k = druh, sc = skóre).
//   Platí vždy ta s vyšším q a rozhodovat smí jen jeden:
//   – pingpong: ten, ke komu míček letí (své pádlo vidí bez zpoždění) – pošle
//     svůj úder (k: 's') nebo bod (k: 'p');
//   – fotbálek: ten, čí tyč je míčku nejblíž – když se míček dostane k soupeřově
//     tyči, předá mu ho (k: 'h'), gól pošle k: 'g'.
//   Odveta: oba zmáčknou „Odveta“ (rm: 1), hostitel pošle k: 'n' (nová hra).
// =====================================================================
const DUEL = {
  PATH: 'zapasy',
  SEND_EVERY: 0.05,    // s – nejčastěji takhle se posílá stav zápasu
  BEAT: 0.5,           // s – i beze změny, ať soupeř ví, že tu jsem
  ASK_TIME: 30000,     // ms – jak dlouho výzva čeká na odpověď
  GONE: 8000,          // ms bez zprávy od soupeře = odešel (zavřel hru, spadlo spojení)
  PURGE: 600000,       // ms – takhle staré zápasy v databázi (spadlý prohlížeč) se smažou
  MAX_LAG: 0.3,        // s – nejvíc o tolik se míček po předání „dožene“
  ACCEPT_KEYS: ['KeyJ'],
  DECLINE_KEYS: ['KeyX'],
  GAMES: { pp: { name: 'pingpong', icon: '🏓' }, foos: { name: 'fotbálek', icon: '⚽' }, chess: { name: 'šachy', icon: '♟' } },
  BETS: [0, 10, 25, 50, 100],   // sázka: oba zaplatí na začátku, vítěz bere obě, remíza = zpět (nápad od kamaráda)
  ROW: { id: 'online', name: '👥 Online – vyzvat hráče', reward: 0 },   // řádek v menu obou miniher
  INVITE: { x: 170, y: 92, w: 460, h: 118 },   // okno s výzvou nahoře
};
const duel = {
  out: null,       // co mám v poli z: { to, g, m, st }
  outEnd: 0,       // kdy (ms) smazat odmítnutí
  ask: null,       // moje výzva čeká na odpověď: { to, name, g, m, t }
  invite: null,    // výzva pro mě: { from, name, g, m }
  seen: {},        // id zápasů, na které už jsem odpověděl
  note: '', noteT: 0,   // zpráva do menu („Bob neodpovídá“)
  match: null,     // běžící zápas
  blocked: false,  // databáze odmítla výzvu (chybí nová pravidla) – zápasy nejdou, ať hráč nezmizí ostatním
  bet: 0,          // vybraná sázka při výzvě (index do DUEL.BETS)
};
const duelZ = () => (duel.out && !duel.blocked ? [duel.out.to, duel.out.g, duel.out.m, duel.out.st, duel.out.bet || 0].join('|') : '');
function duelParse(z) {
  if (typeof z !== 'string') return null;
  const [to, g, m, st, bet] = z.split('|');
  const b = Number(bet);
  return DUEL.GAMES[g] && to && m ? { to, g, m, st, bet: DUEL.BETS.includes(b) ? b : 0 } : null;
}

// --- Sázka: oba zaplatí na začátku každé hry, vítěz bere obě, remíza = zpět, kdo uteče, prohrál ---
function duelPay() {
  const M = duel.match;
  if (!M || !M.bet || M.paid) return;
  state.money -= M.bet;
  M.paid = true;
  saveProgress();
}
// result = 'win' | 'lose' | 'draw' → text do zprávy na konci
function duelSettle(result) {
  const M = duel.match;
  if (!M || !M.paid) return '';
  M.paid = false;
  if (result === 'win') state.money += 2 * M.bet;
  if (result === 'draw') state.money += M.bet;
  saveProgress();
  return result === 'win' ? `💰 Bereš ${2 * M.bet} Kč` : result === 'draw' ? 'Sázka se vrací' : `Přišel jsi o ${M.bet} Kč`;
}
const duelBetText = (bet) => (bet ? `o ${bet} Kč` : 'bez sázky');
const duelUrl = (sub) => `${MP.DB_URL.replace(/\/+$/, '')}/${DUEL.PATH}${sub ? '/' + sub : ''}.json`;
const duelOppName = () => (duel.match ? duel.match.oppName : 'Soupeř');
function mpKick() { mp.sendT = 0; mp.last = ''; }   // záznam hráče poslat hned
function duelNote(text) { duel.note = text; duel.noteT = performance.now(); }
function duelBlocked() {
  duel.blocked = true;
  duel.ask = null;
  duel.out = null;
  duelEnd('Online zápasy zatím nejdou (databáze nemá nová pravidla)');
  duelNote('Online zápasy zatím nejdou – databáze nemá nová pravidla');
}

// --- Výzva ---
// Koho můžu vyzvat: online hráči ve stejné místnosti, kteří zrovna nehrají s někým jiným (nejbližší první)
function duelCandidates() {
  const room = state.room, p = state.player;
  if (!room) return [];
  const px = p.x - room.x, py = p.y - room.y;
  return mpHere().filter((o) => { const z = duelParse(o.z); return !z || z.st !== 'ok'; })
    .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py)).slice(0, 4);
}
function duelOpenPick(gs) {
  if (duel.blocked) { duelNote('Online zápasy zatím nejdou – databáze nemá nová pravidla'); return; }
  if (!mp.on) { setOnline(true); if (!mp.on) return; }   // poprvé se zeptá na jméno
  gs.phase = 'pick';
  gs.pickSel = 0;
  duel.note = '';
}
const duelBetNow = () => Math.min(DUEL.BETS[duel.bet] || 0, Math.max(0, state.money));
const duelCanAfford = (o, bet) => !bet || (mp.legacy ? false : o.m >= bet);   // má soupeř na sázku? (pole m v jeho záznamu)
function duelAsk(g, o) {
  const m = mp.id.slice(0, 6) + Date.now().toString(36);
  const bet = DUEL.BETS[duel.bet] || 0;
  duel.ask = { to: o.id, name: o.n, g, m, bet, t: performance.now() };
  duel.out = { to: o.id, g, m, st: 'ch', bet };
  mpKick();
  playSound([[660, 0, 0.05], [880, 0.06, 0.06]]);
}
function duelCancelAsk() {
  duel.ask = null;
  if (duel.out && duel.out.st === 'ch') { duel.out = null; mpKick(); }
}
function duelAskDone(text) {
  duelCancelAsk();
  duelNote(text);
  playSound([[330, 0, 0.1], [262, 0.11, 0.12]]);
}
function duelAccept() {
  const inv = duel.invite;
  if (!inv) return;
  if (state.money < inv.bet) { playSound([[220, 0, 0.12]]); return; }   // nemám na sázku – jde jen odmítnout
  duel.invite = null;
  duel.seen[inv.m] = true;
  state.emotePick = false;
  duelStart(inv.g, inv.m, inv.from, inv.name, false, inv.bet);
}
function duelDecline() {
  const inv = duel.invite;
  if (!inv) return;
  duel.invite = null;
  duel.seen[inv.m] = true;
  duel.out = { to: inv.from, g: inv.g, m: inv.m, st: 'no' };   // vyzyvatel uvidí „nechce hrát“
  duel.outEnd = performance.now() + 5000;
  mpKick();
}

// --- Zápas: začátek, konec, posílání stavu ---
function duelStart(g, m, opp, oppName, host, bet) {
  if (duel.match) duelEnd('');
  duel.ask = null;
  duel.out = { to: opp, g, m, st: 'ok', bet };
  mpKick();
  const now = performance.now();
  const M = duel.match = {
    g, m, opp, oppName, host, bet: bet || 0, paid: false, role: host ? 'h' : 'g', raw: {}, es: null, snap: null, snapD: '',
    sendT: 0, beatT: 0, sending: false, lastKey: '', gotT: now, startT: now,
  };
  if (typeof EventSource !== 'undefined') {
    const es = M.es = new EventSource(duelUrl(m));
    const handle = (patch) => (e) => {
      if (duel.match !== M) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (!msg || typeof msg.path !== 'string') return;
      const parts = msg.path.split('/').filter(Boolean);
      if (patch) for (const [k, v] of Object.entries(msg.data || {})) M.raw = duelSetAt(M.raw, parts.concat(k), v);
      else M.raw = duelSetAt(M.raw, parts, msg.data);
      const v = M.raw[opp];
      if (!parts.length || parts[0] === opp) { if (v) M.gotT = performance.now(); }   // soupeř je tu (i beze změny)
      if (v && typeof v.d === 'string' && v.d !== M.snapD) {
        M.snapD = v.d;
        try { M.snap = JSON.parse(v.d); } catch (err) { /* poškozená zpráva */ }
      }
    };
    es.addEventListener('put', handle(false));
    es.addEventListener('patch', handle(true));
  }
  duelPurge();
  playSound([[523, 0, 0.06], [659, 0.07, 0.06], [784, 0.14, 0.1]]);
  if (g === 'pp') ppStartOnline(); else if (g === 'foos') foosStartOnline(); else chessStartOnline();
  duelPay();
}
const duelGameState = (g) => (g === 'pp' ? state.pp : g === 'foos' ? state.foos : state.chess);
// Přejít do obrazovky dané hry (z jiné minihry nejdřív odejít)
function duelOpenScreen(g) {
  const screen = { pp: 'pingpong', foos: 'foosball', chess: 'chess' }[g];
  if (state.screen !== screen) {
    if (state.screen === 'pingpong') ppLeave();
    else if (state.screen === 'foosball') foosLeave();
    else if (state.screen === 'chess') chessLeave();
  }
  if (state.screen !== screen || !duelGameState(g)) ({ pp: openPingpong, foos: openFoosball, chess: openChess })[g]();
  return duelGameState(g);
}
function duelSetAt(root, parts, value) {
  if (!parts.length) return value && typeof value === 'object' ? value : {};
  let o = root;
  for (const k of parts.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  const last = parts[parts.length - 1];
  if (value === null) delete o[last]; else o[last] = value;
  return root;
}
// Konec zápasu (odchod, soupeř zmizel, vypnutý Online). reason = co ukázat (prázdné = nic)
function duelEnd(reason) {
  const M = duel.match;
  if (!M) return;
  duel.match = null;
  if (M.es) M.es.close();
  try { fetch(duelUrl(`${M.m}/${mp.id}`), { method: 'DELETE', keepalive: true }).catch(() => {}); } catch (e) { /* nevadí */ }
  if (duel.out && duel.out.m === M.m) { duel.out = null; mpKick(); }
  const gs = duelGameState(M.g);
  // soupeř utekl uprostřed hry = prohrál, sázku beru já (u sebe ji odečte duelQuit)
  let won = '';
  if (M.paid) { duel.match = M; won = duelSettle('win'); duel.match = null; }
  if (gs && gs.online && reason) { duelShowEnd(gs, reason); gs.msg2 = won; }
}
function duelShowEnd(gs, reason) {
  gs.phase = 'over';
  gs.overSel = 0;
  gs.msg = reason;
  gs.msg2 = '';
  gs.netEnd = true;
  gs.confirmQuit = false;
  if (gs.fingers) gs.fingers = {};
}
// Hráč zápas ukončil sám (✕ / Esc → Ano, Odejít)
function duelQuit(gs) {
  if (duel.match && duel.match.paid) duel.match.paid = false;   // odchod uprostřed hry = sázka propadá
  duelEnd('');
  gs.online = false;
  gs.netEnd = false;
}
// Po konci: „Odveta“ (oba musí chtít), nebo zpět do menu, když soupeř odešel
function duelOverAgain(gs) {
  if (gs.netEnd || !duel.match) { duelQuit(gs); gs.phase = 'menu'; return; }
  if (state.money < duel.match.bet) { playSound([[220, 0, 0.12]]); return; }   // na další sázku nemám
  gs.rematch = true;
}
window.addEventListener('pagehide', () => duelEnd(''));

// Staré zápasy (spadlý prohlížeč bez pagehide) uklidí kdokoli, kdo začíná zápas
function duelPurge() {
  fetch(duelUrl('')).then((r) => r.json()).then((all) => {
    if (!all || typeof all !== 'object') return;
    for (const [m, players] of Object.entries(all)) {
      for (const [id, v] of Object.entries(players || {})) {
        if (!v || !Number.isFinite(v.t) || mpServerNow() - v.t > DUEL.PURGE) fetch(duelUrl(`${m}/${id}`), { method: 'DELETE' }).catch(() => {});
      }
    }
  }).catch(() => {});
}

// Volá se v každém kroku hry (15_hlavni.js)
function updateDuel(dt) {
  const now = performance.now();
  if (!mp.on) {
    if (duel.match) { duel.match.paid = false; duelEnd('Online je vypnutý'); }
    duel.ask = null; duel.invite = null; duel.out = null;
    return;
  }
  if (duel.out && duel.out.st === 'no' && now > duel.outEnd) { duel.out = null; mpKick(); }
  // výzva pro mě (jen když sám nikoho nevyzývám a nehraju)
  let inv = null;
  if (!duel.match && !duel.ask) {
    for (const o of Object.values(mp.others)) {
      const z = mpAlive(o) ? duelParse(o.z) : null;
      if (z && z.to === mp.id && z.st === 'ch' && !duel.seen[z.m]) { inv = { from: o.id, name: o.n, g: z.g, m: z.m, bet: z.bet }; break; }
    }
  }
  if (inv && (!duel.invite || duel.invite.m !== inv.m)) playSound([[784, 0, 0.06], [988, 0.08, 0.06], [1175, 0.16, 0.09]]);
  duel.invite = inv;
  // moje výzva: přijal / odmítl / nic
  const a = duel.ask;
  if (a) {
    const o = mp.others[a.to], z = o && mpAlive(o) ? duelParse(o.z) : null, forMe = z && z.to === mp.id;
    if (forMe && z.m === a.m && z.st === 'ok') duelStart(a.g, a.m, a.to, o.n, true, a.bet);
    else if (forMe && z.m === a.m && z.st === 'no') duelAskDone(`${a.name} teď nechce hrát`);
    else if (forMe && z.st === 'ch' && z.g === a.g && z.bet === a.bet && mp.id > a.to) { duel.seen[z.m] = true; duelStart(z.g, z.m, a.to, o.n, false, z.bet); }   // vyzvali jsme se navzájem
    else if (!o || !mpAlive(o)) duelAskDone(`${a.name} už není online`);
    else if (now - a.t > DUEL.ASK_TIME) duelAskDone(`${a.name} neodpovídá`);
  }
  const M = duel.match;
  if (!M) return;
  // soupeř odešel? (zavřel zápas, nebo se dlouho neozval)
  const o = mp.others[M.opp], z = o ? duelParse(o.z) : null;
  const left = o && mpAlive(o) && now - M.startT > 4000 && !(z && z.m === M.m && z.to === mp.id);
  if (left || now - M.gotT > DUEL.GONE) { duelEnd(`${M.oppName} odešel ze zápasu`); return; }
  // můj stav
  M.sendT -= dt;
  M.beatT -= dt;
  if (M.sending || M.sendT > 0) return;
  const gs = duelGameState(M.g);
  if (!gs || !gs.online) return;
  const d = JSON.stringify(M.g === 'pp' ? ppOnlineOut(gs) : M.g === 'foos' ? foosOnlineOut(gs) : chessOnlineOut(gs));
  if (d === M.lastKey && M.beatT > 0) return;
  M.sending = true;
  M.sendT = DUEL.SEND_EVERY;
  M.beatT = DUEL.BEAT;
  M.lastKey = d;
  fetch(duelUrl(`${M.m}/${mp.id}`), { method: 'PUT', body: JSON.stringify({ d, t: { '.sv': 'timestamp' } }) })
    .then((r) => { if (!r.ok) throw new Error(r.status); })
    .catch(() => { M.lastKey = ''; })
    .finally(() => { M.sending = false; });
}

// Volá minihra na začátku svého kroku: zpracuje novou zprávu od soupeře
function duelPoll(gs) {
  const M = duel.match;
  if (!M) { if (gs.phase !== 'over') duelShowEnd(gs, 'Spojení se soupeřem skončilo'); return; }
  if (M.snap) {
    const s = M.snap;
    M.snap = null;
    if (M.g === 'pp') ppOnlineTake(gs, s); else if (M.g === 'foos') foosOnlineTake(gs, s); else chessOnlineTake(gs, s);
  }
  // odveta: chtějí oba → hostitel začne novou hru
  if (M.host && gs.phase === 'over' && !gs.netEnd && gs.rematch && gs.oppRematch) {
    if (M.g === 'pp') ppOnlineRestart(gs); else if (M.g === 'foos') foosOnlineRestart(gs); else chessOnlineRestart(gs);
  }
}

// --- Pomocníci pro souřadnice ---
const duelFlip = (M, x, y, cx, cy) => (M.host ? [x, y] : [2 * cx - x, 2 * cy - y]);   // otočení o 180° kolem středu
const duelSign = (M) => (M.host ? 1 : -1);
const duelMine = (M, role) => role === M.role;
const duelRoleOf = (M, mine) => (mine === M.host ? 'h' : 'g');
const r1 = (v) => Math.round(v * 10) / 10;
// Jak dávno (s) soupeř zprávu poslal (časy serveru u obou mají stejný posun, takže se odečtou)
function duelLag(ts) {
  if (!Number.isFinite(ts) || mp.offset === null) return 0.08;
  return Math.max(0, Math.min(DUEL.MAX_LAG, (mpServerNow() - ts) / 1000));
}
function duelEvent(gs, ev, sc, sv) {
  gs.seq++;
  gs.myEv = Object.assign({ q: gs.seq, ts: Math.round(mpServerNow()), sc }, sv ? { sv } : {}, ev);
  if (duel.match) duel.match.sendT = 0;   // poslat hned
}

// =====================================================================
// PINGPONG ONLINE – g.me = já (dole), g.ai = soupeř (nahoře)
// =====================================================================
const PP_CX = PP.TABLE.x + PP.TABLE.w / 2;
function ppStartOnline() {
  const M = duel.match;
  const g = duelOpenScreen('pp');
  g.online = true;
  ppNewGame({ id: 'online', name: `Online: ${M.oppName}`, reward: 0 });
  Object.assign(g, { seq: 0, myEv: null, netEnd: false, rematch: false, oppRematch: false, oppTarget: null });
  g.server = M.host ? 'me' : 'ai';   // první podává vyzyvatel
  ppServe(g);
}
const ppScoreWire = (g) => (duel.match.host ? [g.score.me, g.score.ai] : [g.score.ai, g.score.me]);
const ppEvent = (g, ev) => duelEvent(g, ev, ppScoreWire(g), duelRoleOf(duel.match, g.server === 'me'));
function ppOnlineOut(g) {
  const [x, y] = duelFlip(duel.match, g.me.x, g.me.y, PP_CX, PP_NET_Y);
  const out = { p: [Math.round(x), Math.round(y)] };
  if (g.myEv) out.e = g.myEv;
  if (g.rematch) out.rm = 1;
  return out;
}
// Můj úder (i podání) – soupeř si let míčku spočítá u sebe
function ppOnlineShot(g) {
  const M = duel.match, b = g.ball, s = duelSign(M);
  if (!M) return;
  const [x, y] = duelFlip(M, b.x, b.y, PP_CX, PP_NET_Y);
  ppEvent(g, { k: 's', b: [r1(x), r1(y), r1(b.z), r1(s * b.vx), r1(s * b.vy), r1(b.vz), r1(s * b.ax)], r: g.rally });
}
// Bod rozhoduju já (míček letěl ke mně): texty z 32_pingpong.js → [můj, pro soupeře]
const PP_WHY_ONLINE = {
  'Počítač si to odrazil na svou stranu': (opp, me) => [`${opp} si to odrazil na svou stranu`, 'Odskok na tvé straně'],
  'Nevrátil jsi to': (opp, me) => ['Nevrátil jsi to', `${me} to nevrátil`],
  'Nechytil jsi to': (opp, me) => ['Nechytil jsi to', `${me} to nechytil`],
  'Počítač trefil mimo stůl': (opp, me) => [`${opp} trefil mimo stůl`, 'Mimo stůl'],
};
function ppOnlinePoint(g, winner, why) {
  const M = duel.match;
  if (!M) return why;
  const f = PP_WHY_ONLINE[why], [mine, theirs] = f ? f(M.oppName, mp.name) : [why, why];
  ppEvent(g, { k: 'p', w: duelRoleOf(M, winner === 'me'), y: theirs });
  return mine;
}
function ppOnlineTake(g, s) {
  const M = duel.match;
  if (Array.isArray(s.p)) { const [x, y] = duelFlip(M, s.p[0], s.p[1], PP_CX, PP_NET_Y); g.oppTarget = { x, y }; }
  g.oppRematch = s.rm === 1;
  const e = s.e;
  if (!e || !(e.q > g.seq)) return;
  g.seq = e.q;
  if (Array.isArray(e.sc)) g.score = M.host ? { me: e.sc[0], ai: e.sc[1] } : { me: e.sc[1], ai: e.sc[0] };
  if (e.sv) g.server = duelMine(M, e.sv) ? 'me' : 'ai';
  if (e.k === 'n') { ppOnlineReset(g); return; }
  if (e.k === 'p') { ppShowPoint(g, duelMine(M, e.w) ? 'me' : 'ai', String(e.y || '')); return; }
  if (e.k === 's' && Array.isArray(e.b) && g.phase !== 'over') {
    const sg = duelSign(M), [x, y] = duelFlip(M, e.b[0], e.b[1], PP_CX, PP_NET_Y);
    g.phase = 'play';
    g.ball = { x, y, z: e.b[2], vx: sg * e.b[3], vy: sg * e.b[4], vz: e.b[5], ax: sg * e.b[6], held: null, lastHit: 'ai', bounces: 0, trail: [] };
    g.rally = e.r || 0;
    playSound([[520, 0, 0.035]], 'square');
    // míček už chvíli letí – kus zpoždění sítě se dožene (ne celé, ať je čas zareagovat)
    const lag = duelLag(e.ts) * 0.7, h = 1 / 120;
    for (let t = 0; t < lag && g.phase === 'play' && !g.ball.frozen; t += h) ppPhysics(g, Math.min(h, lag - t));
  }
}
function ppOnlineOpp(g, dt) {   // soupeřovo pádlo plynule dojede na poslední známé místo
  if (!g.oppTarget) return;
  const p = g.ai, ox = p.x, oy = p.y, k = 1 - Math.exp(-18 * dt);
  p.x += (g.oppTarget.x - p.x) * k;
  p.y += (g.oppTarget.y - p.y) * k;
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
}
function ppOnlineReset(g) {
  Object.assign(g, { score: { me: 0, ai: 0 }, phase: 'play', rematch: false, oppRematch: false, msg: '', texts: [], confirmQuit: false });
  ppServe(g);
  duelPay();   // odveta: nová sázka
}
function ppOnlineRestart(g) {
  g.score = { me: 0, ai: 0 };
  g.server = Math.random() < 0.5 ? 'me' : 'ai';
  ppEvent(g, { k: 'n' });
  ppOnlineReset(g);
}

// =====================================================================
// FOTBÁLEK ONLINE – červení = já (vlevo, rukojeti dole), modří = soupeř
// f.own = kdo teď řídí míček ('me' / 'opp')
// =====================================================================
const FOOS_CX = FOOS.FIELD.x + FOOS.FIELD.w / 2, FOOS_CY = FOOS.FIELD.y + FOOS.FIELD.h / 2;
function foosStartOnline() {
  const M = duel.match;
  const f = duelOpenScreen('foos');
  f.online = true;
  foosNewGame({ id: 'online', name: `Online: ${M.oppName}`, reward: 0 });
  Object.assign(f, { seq: 0, myEv: null, netEnd: false, rematch: false, oppRematch: false, oppP: 0, oppKick: 0, ballBt: 0 });
  f.own = M.host ? 'me' : 'opp';   // na začátku míček řídí vyzyvatel
}
const foosScoreWire = (f) => (duel.match.host ? [f.score.red, f.score.blue] : [f.score.blue, f.score.red]);
const foosEvent = (f, ev) => duelEvent(f, ev, foosScoreWire(f));
function foosBallWire(f) {
  const M = duel.match, b = f.ball, s = duelSign(M), [x, y] = duelFlip(M, b.x, b.y, FOOS_CX, FOOS_CY);
  return [r1(x), r1(y), r1(s * b.vx), r1(s * b.vy)];
}
function foosSetBall(f, w) {
  const M = duel.match, s = duelSign(M), [x, y] = duelFlip(M, w[0], w[1], FOOS_CX, FOOS_CY);
  f.ball = { x, y, vx: s * w[2], vy: s * w[3] };
}
function foosOnlineOut(f) {
  const out = { p: Math.round(duelSign(duel.match) * f.p.red * 1000) / 1000, kk: f.kickN.red, sq: f.seq };
  if (f.auto.red) out.au = 1;
  if (f.myEv) out.e = f.myEv;
  if (f.rematch) out.rm = 1;
  if (f.own === 'me' && f.phase === 'play' && f.ball) { out.b = foosBallWire(f); out.bt = Math.round(mpServerNow()); }
  return out;
}
// Po kroku fyziky: dostal se míček k soupeřově tyči? → předat mu ho
function foosOnlineAfter(f) {
  if (f.own !== 'me' || f.phase !== 'play' || f.serveT > 0) return;
  const bx = f.ball.x;
  let mine = Infinity, theirs = Infinity;
  for (const r of FOOS_RODS) {
    const d = Math.abs(r.x - bx);
    if (r.team === 'red') mine = Math.min(mine, d); else theirs = Math.min(theirs, d);
  }
  if (theirs < mine - 8) { f.own = 'opp'; foosEvent(f, { k: 'h', b: foosBallWire(f) }); }
}
function foosOnlineGoal(f, team) { foosEvent(f, { k: 'g', w: duelRoleOf(duel.match, team === 'red') }); }
function foosOnlineTake(f, s) {
  const M = duel.match;
  if (Number.isFinite(s.p)) f.oppP = Math.max(-1, Math.min(1, duelSign(M) * s.p));
  if (Number.isFinite(s.kk) && s.kk !== f.oppKick) { if (s.kk > f.oppKick) f.kickT.blue = FOOS.KICK_TIME; f.oppKick = s.kk; }
  f.auto.blue = s.au === 1;
  f.oppRematch = s.rm === 1;
  const e = s.e;
  if (e && e.q > f.seq) {
    f.seq = e.q;
    if (Array.isArray(e.sc)) f.score = M.host ? { red: e.sc[0], blue: e.sc[1] } : { red: e.sc[1], blue: e.sc[0] };
    if (e.k === 'n') { foosOnlineReset(f); f.own = 'opp'; return; }
    if (e.k === 'g') { f.own = 'opp'; foosShowGoal(f, duelMine(M, e.w) ? 'red' : 'blue'); return; }
    if (e.k === 'h' && Array.isArray(e.b) && f.phase === 'play') {
      f.own = 'me';   // míček je teď můj – dopočítám, kam se mezitím dokutálel
      foosSetBall(f, e.b);
      f.serveT = 0;
      const lag = duelLag(e.ts), h = 1 / 120;
      for (let t = 0; t < lag && f.phase === 'play'; t += h) foosPhysics(f, Math.min(h, lag - t));
      foosOnlineAfter(f);
    }
    return;
  }
  // míček řídí soupeř: jeho poloha (posunutá o zpoždění sítě), malé rozdíly napůl, ať neskáče
  if (f.own !== 'me' && f.phase === 'play' && Array.isArray(s.b) && s.sq === f.seq && s.bt !== f.ballBt) {
    f.ballBt = s.bt;
    const old = f.ball;
    foosSetBall(f, s.b);
    const b = f.ball, lag = duelLag(s.bt), F = FOOS.FIELD, r = FOOS.BALL_R;
    b.x += b.vx * lag; b.y += b.vy * lag;
    b.y = Math.max(F.y + r, Math.min(F.y + F.h - r, b.y));
    if (old && Math.hypot(old.x - b.x, old.y - b.y) < 40) { b.x = (old.x + b.x) / 2; b.y = (old.y + b.y) / 2; }
    if (Math.hypot(b.vx, b.vy) > 30) f.serveT = 0;   // výkop u soupeře už proběhl
  }
}
function foosOnlineOpp(f, dt) { f.p.blue += (f.oppP - f.p.blue) * (1 - Math.exp(-20 * dt)); }
function foosOnlineReset(f) {
  Object.assign(f, { score: { red: 0, blue: 0 }, phase: 'play', rematch: false, oppRematch: false, msg: '', confirmQuit: false });
  foosServe(f, Math.random() < 0.5 ? 'red' : 'blue');
  duelPay();   // odveta: nová sázka
}
function foosOnlineRestart(f) {
  f.score = { red: 0, blue: 0 };
  foosEvent(f, { k: 'n' });
  foosOnlineReset(f);
  f.own = 'me';
}

// =====================================================================
// ŠACHY ONLINE – každý posílá celý seznam tahů partie (mv: 3 znaky na tah –
// odkud, kam, proměna) a číslo partie (n). Kdo je na tahu, připíše svůj tah,
// druhý si nové tahy přehraje (jen platné). V první partii je vyzyvatel bílý,
// při odvetě se barvy prohodí. Kdo je černý, má šachovnici otočenou (je dole).
// =====================================================================
const chessSqChar = (sq) => String.fromCharCode(48 + sq);   // pole 0–63 → znak '0'…'o'
const chessMoveCode = (m) => chessSqChar(m.from) + chessSqChar(m.to) + (m.promo || '.');
function chessStartOnline() {
  const c = duelOpenScreen('chess');
  c.online = true;
  Object.assign(c, { gameN: 0, netEnd: false, rematch: false, oppRematch: false });
  chessOnlineNew(c, 0);
}
function chessOnlineNew(c, n) {
  const M = duel.match;
  chessNewGame({ id: 'online', name: `Online: ${M.oppName}`, reward: 0 });
  c.gameN = n;
  c.myColor = (M.host === (n % 2 === 0)) ? 'w' : 'b';
  c.flip = c.myColor === 'b';
  c.cursor = c.myColor === 'w' ? 52 : 12;
  c.moves = '';
  c.resigned = false;
  Object.assign(c, { rematch: false, oppRematch: false });
}
function chessOnlineOut(c) {
  const out = { n: c.gameN, mv: c.moves };
  if (c.resigned) out.rs = 1;
  if (c.rematch) out.rm = 1;
  return out;
}
// Můj tah (chessApply) – připsat do seznamu a poslat hned
function chessOnlineMoved(c, m) {
  c.moves += chessMoveCode(m);
  if (duel.match) duel.match.sendT = 0;
}
function chessOnlineTake(c, s) {
  if (!Number.isInteger(s.n)) return;
  c.oppRematch = s.rm === 1 && s.n === c.gameN;
  if (s.n > c.gameN) { chessOnlineNew(c, s.n); duelPay(); }   // hostitel začal odvetu
  if (s.n !== c.gameN || typeof s.mv !== 'string') return;
  // nové tahy soupeře (seznam musí začínat stejně jako můj)
  if (c.phase === 'play' && s.mv.length > c.moves.length && s.mv.startsWith(c.moves)) {
    const add = s.mv.slice(c.moves.length);
    for (let i = 0; i + 3 <= add.length && c.phase === 'play'; i += 3) {
      if (c.pos.turn === c.myColor) break;   // můj tah už nepřijímám
      const from = add.charCodeAt(i) - 48, to = add.charCodeAt(i + 1) - 48, promo = add[i + 2] === '.' ? undefined : add[i + 2];
      const m = c.legal.find((x) => x.from === from && x.to === to && x.promo === promo);
      if (!m) break;   // neplatný tah (rozjeté partie) – ignorovat
      c.moves += add.slice(i, i + 3);
      c.promo = null;
      chessApply(c, m, true);
    }
  }
  if (s.rs === 1 && c.phase === 'play') { c.resignBy = c.myColor === 'w' ? 'b' : 'w'; chessFinish(c, 'resign'); }   // soupeř se vzdal
}
function chessOnlineRestart(c) {
  chessOnlineNew(c, c.gameN + 1);
  duelPay();
  if (duel.match) duel.match.sendT = 0;
}
// Konec partie online: text z mého pohledu + sázka
function chessOnlineResult(c, how, winner) {
  const opp = duelOppName();
  if (!winner) return duelSettle('draw');
  const won = winner === c.myColor;
  c.msg = how === 'resign' ? (won ? `${opp} se vzdal – vyhrál jsi!` : 'Vzdal ses')
    : won ? `Mat! Vyhrál jsi proti ${opp}` : `Mat! Vyhrál ${opp}`;
  playSound(won ? CONFIG.SOUND_COMPLETE : CONFIG.SOUND_MISS);
  return duelSettle(won ? 'win' : 'lose');
}

// =====================================================================
// OBRAZOVKY: výběr soupeře, čekání na odpověď, okno s výzvou
// =====================================================================
const duelPickRow = (i) => ({ x: 230, y: 240 + i * 48, w: 340, h: 42 });
const DUEL_BACK = { x: 230, y: 440, w: 340, h: 44 };
const DUEL_CANCEL = { x: 280, y: 400, w: 240, h: 48 };
const DUEL_BET_LEFT = { x: 230, y: 186, w: 54, h: 40 }, DUEL_BET_RIGHT = { x: 516, y: 186, w: 54, h: 40 };
// Další / předchozí sázka, na kterou mám peníze
function duelBetStep(d) {
  const n = DUEL.BETS.length;
  for (let k = 1; k <= n; k++) {
    const i = (duel.bet + d * k + n * k) % n;
    if (DUEL.BETS[i] <= state.money) { duel.bet = i; playSound([[700, 0, 0.03]]); return; }
  }
}

// Fáze 'pick' (výběr hráče a sázky) a 'wait' (čekám na odpověď) v menu pingpongu / fotbálku / šachů
function duelPickUpdate(gs, g, events, keys) {
  const has = (list, k) => KEYMAP[list].includes(k);
  if (gs.phase === 'wait') {
    if (!duel.ask) { gs.phase = 'menu'; return; }   // odmítl / neodpovídá (zpráva v duel.note)
    const cancel = keys.includes('Escape') || events.some((ev) => ev.type === 'action' || chessHit([DUEL_CANCEL], ev) === 0);
    if (cancel) { duelCancelAsk(); gs.phase = 'menu'; }
    return;
  }
  if (DUEL.BETS[duel.bet] > state.money) duel.bet = 0;
  const bet = DUEL.BETS[duel.bet];
  const list = duelCandidates(), n = list.length + 1;
  gs.pickSel = Math.min(gs.pickSel, n - 1);
  for (const k of keys) {
    if (has('up', k)) gs.pickSel = (gs.pickSel + n - 1) % n;
    if (has('down', k)) gs.pickSel = (gs.pickSel + 1) % n;
    if (has('left', k)) duelBetStep(-1);
    if (has('right', k)) duelBetStep(1);
    if (k === 'Escape') { gs.phase = 'menu'; return; }
  }
  for (const ev of events) {
    if (chessHit([DUEL_BET_LEFT], ev) === 0) { duelBetStep(-1); continue; }
    if (chessHit([DUEL_BET_RIGHT], ev) === 0) { duelBetStep(1); continue; }
    let i = ev.type === 'action' ? gs.pickSel : chessHit(list.map((_, k) => duelPickRow(k)), ev);
    if (ev.type !== 'action' && i < 0 && chessHit([DUEL_BACK], ev) === 0) i = list.length;
    if (i < 0) continue;
    if (i >= list.length) { gs.phase = 'menu'; return; }
    if (!duelCanAfford(list[i], bet)) { playSound([[220, 0, 0.12]]); continue; }   // soupeř nemá na sázku
    duelAsk(g, list[i]);
    gs.phase = 'wait';
    return;
  }
}
function drawDuelPick(gs, g) {
  const G = DUEL.GAMES[g];
  drawChessBox(200, 116, 400, 384);
  if (gs.phase === 'wait') {
    const a = duel.ask;
    drawOutlinedText(`${G.icon} Výzva odeslána`, 400, 160, 'bold 24px sans-serif', '#ffd54a', 'middle');
    if (a) {
      drawOutlinedText(`Čekám, jestli ${a.name} přijme…`, 400, 230, 'bold 19px sans-serif', '#ffffff', 'middle');
      drawOutlinedText(a.bet ? `Sázka ${a.bet} Kč` : 'Bez sázky', 400, 262, 'bold 15px sans-serif', '#ffd54a', 'middle');
      const left = Math.max(0, Math.ceil((DUEL.ASK_TIME - (performance.now() - a.t)) / 1000));
      drawOutlinedText(`ještě ${left} s`, 400, 292, 'bold 15px sans-serif', '#e8d3a8', 'middle');
      drawOutlinedText('Výzva mu vyskočí nahoře na obrazovce.', 400, 340, '14px sans-serif', '#e8d3a8', 'middle');
    }
    drawChessButton(DUEL_CANCEL, 'Zrušit', true, '#5a4636');
    return;
  }
  drawOutlinedText(`${G.icon} Online – koho vyzveš?`, 400, 156, 'bold 24px sans-serif', '#ffd54a', 'middle');
  // sázka ◀ 25 Kč ▶
  const bet = DUEL.BETS[duel.bet] <= state.money ? DUEL.BETS[duel.bet] : 0;
  roundRectPath(230, 186, 340, 40, 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.fill();
  drawChessButton(DUEL_BET_LEFT, '◀', false, '#5a4636');
  drawChessButton(DUEL_BET_RIGHT, '▶', false, '#5a4636');
  drawOutlinedText(bet ? `Sázka: ${bet} Kč` : 'Sázka: žádná', 400, 207, 'bold 17px sans-serif', bet ? '#ffd54a' : '#ffffff', 'middle');
  const list = duelCandidates();
  if (!list.length) {
    const lines = mp.status !== 'ok' ? ['Připojuji se…'] : ['Nikdo další tu není.', 'Kamarád musí mít zapnutý Online', 'a stát ve stejné části školy jako ty.'];
    lines.forEach((t, i) => drawOutlinedText(t, 400, 270 + i * 30, 'bold 16px sans-serif', i ? '#e8d3a8' : '#ffffff', 'middle'));
  }
  list.forEach((o, i) => {
    const ok = duelCanAfford(o, bet);
    drawChessButton(duelPickRow(i), ok ? `${G.icon} ${o.n}` : `${o.n} – nemá na sázku`, i === gs.pickSel && ok, ok ? '#2f5a7a' : '#4a4a4a');
  });
  drawChessButton(DUEL_BACK, 'Zpět', gs.pickSel === list.length, '#5a4636');
  if (!isTouchHint()) drawOutlinedText('← → sázka · ↑ ↓ hráč · mezerník = vyzvat', 400, 492, '12px sans-serif', '#e8d3a8', 'middle');
}
// Zpráva v menu („Bob neodpovídá“)
function drawDuelNote(y) {
  if (!duel.note || performance.now() - duel.noteT > 6000) return;
  drawOutlinedText(duel.note, 400, y, 'bold 15px sans-serif', '#ff8a80', 'middle');
}
const duelOverLabel = (gs) => (gs.netEnd || !duel.match ? 'Zpět do menu'
  : gs.rematch ? 'Čekám na soupeře…' : gs.oppRematch ? 'Odveta (soupeř chce!)' : 'Odveta');

// --- Okno s výzvou (nahoře): ve hře nebo v menu pingpongu / fotbálku ---
function duelInviteShown() {
  if (!duel.invite) return false;
  const s = state.screen;
  if (s === 'playing') return !state.transition && !state.pauseMenu && !state.dialog && !state.scene;
  const gs = s === 'pingpong' ? state.pp : s === 'foosball' ? state.foos : s === 'chess' ? state.chess : null;
  return !!gs && !gs.online && ['menu', 'over', 'pick'].includes(gs.phase);
}
const duelInviteButtons = () => {
  const I = DUEL.INVITE;
  return [{ x: I.x + 20, y: I.y + 64, w: 200, h: 42 }, { x: I.x + I.w - 220, y: I.y + 64, w: 200, h: 42 }];
};
function takeDuelTaps() {
  if (!duelInviteShown()) return;
  input.events = input.events.filter((ev) => {
    if (ev.type !== 'tap' || ev.x === null) return true;
    const [yes, no] = duelInviteButtons();
    if (pointInRect(ev.x, ev.y, yes, 4)) { duelAccept(); return false; }
    if (pointInRect(ev.x, ev.y, no, 4)) { duelDecline(); return false; }
    return !pointInRect(ev.x, ev.y, DUEL.INVITE, 0);   // ťuknutí do okna nejde do hry
  });
}
window.addEventListener('keydown', (e) => {
  if (e.repeat || !duelInviteShown()) return;
  if (DUEL.ACCEPT_KEYS.includes(e.code)) { duelAccept(); e.stopImmediatePropagation(); }
  else if (DUEL.DECLINE_KEYS.includes(e.code)) { duelDecline(); e.stopImmediatePropagation(); }
}, true);
function drawDuelInvite() {
  if (!duelInviteShown()) return;
  const I = DUEL.INVITE, inv = duel.invite, G = DUEL.GAMES[inv.g];
  const glow = 0.6 + 0.4 * Math.sin(performance.now() / 180);
  roundRectPath(I.x, I.y, I.w, I.h, 14);
  ctx.fillStyle = 'rgba(42, 28, 16, 0.95)'; ctx.fill();
  ctx.strokeStyle = `rgba(255, 213, 74, ${glow})`; ctx.lineWidth = 3; ctx.stroke();
  drawOutlinedText(`${G.icon} ${inv.name} tě vyzývá na ${G.name}!`, I.x + I.w / 2, I.y + 24, 'bold 19px sans-serif', '#ffd54a', 'middle');
  const poor = state.money < inv.bet;
  drawOutlinedText(inv.bet ? `Sázka ${inv.bet} Kč (máš ${state.money} Kč)` : 'Bez sázky', I.x + I.w / 2, I.y + 48, 'bold 14px sans-serif', poor ? '#ff8a80' : '#ffffff', 'middle');
  const [yes, no] = duelInviteButtons(), keys = !isTouchHint();
  if (poor) drawChessButton(yes, 'Nemáš dost peněz', false, '#4a4a4a');
  else drawChessButton(yes, keys ? '✓ Přijmout (J)' : '✓ Přijmout', false, '#2e7d32');
  drawChessButton(no, keys ? '✕ Odmítnout (X)' : '✕ Odmítnout', false, '#7a2a20');
}
