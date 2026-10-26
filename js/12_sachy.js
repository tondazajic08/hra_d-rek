// Minihra šachy
// Část hry Dárek – načítá se v index.html v pořadí podle čísla.
'use strict';

// =====================================================================
// MINIHRA: ŠACHY – u šachového stolku v chodbě před schody (mezerník / ťuknutí).
// Úplná pravidla (šach, mat, pat, rošáda, braní mimochodem, proměna pěšce,
// remíza 50 tahy, trojím opakováním a nedostatkem materiálu). Soupeř: počítač
// ve třech obtížnostech (hráč je bílý, dole), nebo dva hráči na jednom zařízení.
// Výhra nad počítačem dává peníze do bufetu a kávovaru.
// Šachovnice: pole 0–63, řada 0 nahoře (černí), sloupec 0 = a. Figurka = 'wP', 'bK' …
// =====================================================================
const CHESS = {
  BOARD: { x: 50, y: 60, sq: 60 },   // šachovnice na plátně (levý horní roh, velikost pole)
  PANEL_X: 578,                      // panel vpravo
  LEVELS: [
    { id: 'easy',   name: 'Počítač – lehký',   reward: 10, depth: 0, noise: 220 },
    { id: 'medium', name: 'Počítač – střední', reward: 25, depth: 2, noise: 30 },
    { id: 'hard',   name: 'Počítač – těžký',   reward: 50, depth: 3, noise: 6 },
    { id: 'two',    name: 'Dva hráči',         reward: 0 },
  ],
  AI_DELAY: 0.45,        // počítač táhne až po chvilce, ať je vidět tah hráče (s)
  NODE_LIMIT: 120000,    // pojistka, ať počítač nepřemýšlí moc dlouho
  VALUE: { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 },
};
const CHESS_DIRS = {
  N: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
  B: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  R: [[-1, 0], [1, 0], [0, -1], [0, 1]],
};
CHESS_DIRS.Q = CHESS_DIRS.K = [...CHESS_DIRS.B, ...CHESS_DIRS.R];

// --- pravidla ---
function chessStartPos() {
  const b = Array(64).fill(null);
  const back = 'RNBQKBNR';
  for (let i = 0; i < 8; i++) { b[i] = 'b' + back[i]; b[8 + i] = 'bP'; b[48 + i] = 'wP'; b[56 + i] = 'w' + back[i]; }
  return { b, turn: 'w', castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, half: 0 };
}

// Je pole sq napadené figurkami barvy by?
function chessAttacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7;
  const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null);
  const pr = by === 'w' ? r + 1 : r - 1;   // bílý pěšec bere nahoru, stojí tedy o řadu níž
  if (at(pr, c - 1) === by + 'P' || at(pr, c + 1) === by + 'P') return true;
  for (const [dr, dc] of CHESS_DIRS.N) if (at(r + dr, c + dc) === by + 'N') return true;
  for (const [dr, dc] of CHESS_DIRS.K) if (at(r + dr, c + dc) === by + 'K') return true;
  for (const [dirs, kinds] of [[CHESS_DIRS.B, 'BQ'], [CHESS_DIRS.R, 'RQ']]) {
    for (const [dr, dc] of dirs) {
      for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; rr += dr, cc += dc) {
        const p = b[rr * 8 + cc];
        if (!p) continue;
        if (p[0] === by && kinds.includes(p[1])) return true;
        break;
      }
    }
  }
  return false;
}

// Tahy bez ohledu na vlastního krále v šachu (rošáda už kontroluje napadená pole)
function chessPseudo(pos, color) {
  const out = [], b = pos.b, opp = color === 'w' ? 'b' : 'w';
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p[0] !== color) continue;
    const r = i >> 3, c = i & 7, t = p[1];
    const add = (to, extra) => out.push({ from: i, to, piece: p, cap: b[to], ...extra });
    if (t === 'P') {
      const d = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1, last = color === 'w' ? 0 : 7;
      const r1 = r + d;
      const push = (to, extra) => {
        if ((to >> 3) === last) for (const promo of 'QRBN') add(to, { ...extra, promo });
        else add(to, extra);
      };
      if (!b[r1 * 8 + c]) {
        push(r1 * 8 + c, {});
        if (r === start && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c, { double: true });
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (cc < 0 || cc > 7) continue;
        const to = r1 * 8 + cc;
        if (b[to] && b[to][0] === opp) push(to, {});
        else if (to === pos.ep) add(to, { ep: true, cap: opp + 'P' });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of CHESS_DIRS[t]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const to = rr * 8 + cc;
        if (!b[to] || b[to][0] === opp) add(to, {});
      }
      if (t === 'K' && c === 4 && r === (color === 'w' ? 7 : 0) && !chessAttacked(b, i, opp)) {
        const row = r * 8;
        if (pos.castle[color + 'K'] && !b[row + 5] && !b[row + 6] && b[row + 7] === color + 'R' &&
            !chessAttacked(b, row + 5, opp) && !chessAttacked(b, row + 6, opp)) add(row + 6, { castle: 'K' });
        if (pos.castle[color + 'Q'] && !b[row + 3] && !b[row + 2] && !b[row + 1] && b[row] === color + 'R' &&
            !chessAttacked(b, row + 3, opp) && !chessAttacked(b, row + 2, opp)) add(row + 2, { castle: 'Q' });
      }
    } else {
      for (const [dr, dc] of CHESS_DIRS[t]) {
        for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; rr += dr, cc += dc) {
          const to = rr * 8 + cc;
          if (!b[to]) { add(to, {}); continue; }
          if (b[to][0] === opp) add(to, {});
          break;
        }
      }
    }
  }
  return out;
}

// Nová pozice po tahu (původní se nemění)
function chessMake(pos, m) {
  const b = pos.b.slice(), color = m.piece[0];
  b[m.to] = m.promo ? color + m.promo : m.piece;
  b[m.from] = null;
  if (m.ep) b[m.to + (color === 'w' ? 8 : -8)] = null;
  if (m.castle) {
    const row = m.to & 56;
    if (m.castle === 'K') { b[row + 5] = b[row + 7]; b[row + 7] = null; } else { b[row + 3] = b[row]; b[row] = null; }
  }
  const castle = { ...pos.castle };
  if (m.piece[1] === 'K') castle[color + 'K'] = castle[color + 'Q'] = false;
  for (const [sq, key] of [[63, 'wK'], [56, 'wQ'], [7, 'bK'], [0, 'bQ']]) if (m.from === sq || m.to === sq) castle[key] = false;
  return {
    b, turn: color === 'w' ? 'b' : 'w', castle,
    ep: m.double ? (m.from + m.to) / 2 : -1,
    half: m.piece[1] === 'P' || m.cap ? 0 : pos.half + 1,
  };
}

function chessInCheck(pos) {
  return chessAttacked(pos.b, pos.b.indexOf(pos.turn + 'K'), pos.turn === 'w' ? 'b' : 'w');
}
function chessLegal(pos) {
  const color = pos.turn, opp = color === 'w' ? 'b' : 'w';
  return chessPseudo(pos, color).filter((m) => {
    const n = chessMake(pos, m);
    return !chessAttacked(n.b, n.b.indexOf(color + 'K'), opp);
  });
}
function chessKey(pos) {
  const c = pos.castle;
  return pos.b.map((p) => p || '..').join('') + pos.turn + (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '') + pos.ep;
}
// Remíza, když nikdo nemůže dát mat (jen králové, případně jeden střelec nebo jezdec)
function chessInsufficient(b) {
  const rest = b.filter((p) => p && p[1] !== 'K');
  return rest.length === 0 || (rest.length === 1 && (rest[0][1] === 'B' || rest[0][1] === 'N'));
}

// --- počítač: materiál + poloha, negamax s ořezáváním alfa-beta a klidovým dohledáním braní ---
let chessNodes = 0;
function chessEval(b) {   // kladné = lepší pro bílého
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const r = i >> 3, c = i & 7, t = p[1];
    const adv = p[0] === 'w' ? 7 - r : r;                               // jak daleko od své první řady
    const center = 7 - (Math.abs(3.5 - r) + Math.abs(3.5 - c));          // 0 v rohu … 6 uprostřed
    let v = CHESS.VALUE[t];
    if (t === 'P') v += adv * 6 + (c >= 2 && c <= 5 ? adv * 3 : 0);
    else if (t === 'N' || t === 'B') v += center * 6 - (adv === 0 ? 10 : 0);   // vyvinout figurky
    else if (t === 'Q') v += center * 2;
    else if (t === 'R') v += adv === 6 ? 20 : 0;
    else if (t === 'K') v += adv === 0 ? (c === 6 || c === 2 ? 25 : 8) : -adv * 10;   // král v bezpečí doma
    s += p[0] === 'w' ? v : -v;
  }
  return s;
}
function chessMoveScore(m) {
  return (m.cap ? 1000 + 10 * CHESS.VALUE[m.cap[1]] - CHESS.VALUE[m.piece[1]] / 10 : 0) + (m.promo === 'Q' ? 800 : 0);
}
function chessOrder(moves) { return moves.sort((a, b) => chessMoveScore(b) - chessMoveScore(a)); }
// skóre z pohledu hráče, který je na tahu
function chessNegamax(pos, depth, alpha, beta, ply) {
  chessNodes++;
  if (depth <= 0 || chessNodes > CHESS.NODE_LIMIT) return chessQuiesce(pos, alpha, beta, 4);
  const color = pos.turn, opp = color === 'w' ? 'b' : 'w';
  let any = false;
  for (const m of chessOrder(chessPseudo(pos, color))) {
    const n = chessMake(pos, m);
    if (chessAttacked(n.b, n.b.indexOf(color + 'K'), opp)) continue;
    any = true;
    const sc = -chessNegamax(n, depth - 1, -beta, -alpha, ply + 1);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  if (!any) return chessInCheck(pos) ? -100000 + ply : 0;   // mat (čím dřív, tím lépe) / pat
  return alpha;
}
function chessQuiesce(pos, alpha, beta, qd) {
  chessNodes++;
  const stand = chessEval(pos.b) * (pos.turn === 'w' ? 1 : -1);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd <= 0) return alpha;
  const color = pos.turn, opp = color === 'w' ? 'b' : 'w';
  for (const m of chessOrder(chessPseudo(pos, color).filter((mv) => mv.cap || mv.promo === 'Q'))) {
    const n = chessMake(pos, m);
    if (chessAttacked(n.b, n.b.indexOf(color + 'K'), opp)) continue;
    const sc = -chessQuiesce(n, -beta, -alpha, qd - 1);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
// Tah počítače; trocha náhody (noise), ať nehraje pokaždé stejně (lehký hodně chybuje)
function chessAiMove(pos, level) {
  chessNodes = 0;
  const sign = pos.turn === 'w' ? 1 : -1;
  let best = null, bestScore = -Infinity;
  for (const m of chessOrder(chessLegal(pos))) {
    const n = chessMake(pos, m);
    // horší tahy než nejlepší − náhoda už se nemusí počítat přesně (ořezání i u kořene)
    const alpha = best ? bestScore - level.noise : -1e9;
    let sc = level.depth > 0 ? -chessNegamax(n, level.depth - 1, -1e9, -alpha, 1) : chessEval(n.b) * sign;
    if (m.promo && m.promo !== 'Q') sc -= 300;
    sc += (Math.random() - 0.5) * level.noise;
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}

// --- průběh hry ---
function openChess() {
  state.chess = { phase: 'menu', menuSel: 0, keys: [], level: null, pos: null };
  input.events.length = 0;
  playSound([[523, 0, 0.06], [659, 0.07, 0.08]]);
  setScreen('chess');
}
function chessNewGame(level) {
  const c = state.chess;
  c.level = level;
  c.pos = chessStartPos();
  c.seen = { [chessKey(c.pos)]: 1 };
  c.phase = 'play';
  c.sel = -1; c.cursor = 52; c.targets = []; c.last = null;
  c.captured = { w: [], b: [] };   // sebrané figurky podle jejich barvy
  c.aiT = 0; c.promo = null; c.confirmQuit = false;
  c.result = null; c.msg = ''; c.msg2 = ''; c.overSel = 0; c.reward = 0;
  c.flip = false;   // otočí jen online černý (35_online_hry.js)
  c.legal = chessLegal(c.pos);
}
function chessHumanTurn(c) { return c.online ? c.pos.turn === c.myColor : c.level.id === 'two' || c.pos.turn === 'w'; }
// Online černý má šachovnici otočenou (je dole): pole na šachovnici ↔ pole na obrazovce
const chessView = (c, i) => (c && c.flip ? 63 - i : i);

function chessApply(c, m, fromNet) {
  if (m.cap) c.captured[m.cap[0]].push(m.cap[1]);
  if (c.online && !fromNet) chessOnlineMoved(c, m);   // můj tah → soupeři (35_online_hry.js)
  c.pos = chessMake(c.pos, m);
  c.last = { from: m.from, to: m.to };
  const key = chessKey(c.pos);
  c.seen[key] = (c.seen[key] || 0) + 1;
  c.sel = -1; c.targets = []; c.aiT = 0;
  c.legal = chessLegal(c.pos);
  playSound(m.cap ? [[330, 0, 0.06], [220, 0.06, 0.1]] : [[520, 0, 0.05]]);
  let how = null;
  if (!c.legal.length) how = chessInCheck(c.pos) ? 'mate' : 'stalemate';
  else if (c.pos.half >= 100) how = 'fifty';
  else if (c.seen[key] >= 3) how = 'repetition';
  else if (chessInsufficient(c.pos.b)) how = 'material';
  if (how) chessFinish(c, how);
  else if (chessInCheck(c.pos)) playSound([[880, 0, 0.08], [660, 0.1, 0.12]]);
}

// Konec partie: how = 'mate' | 'resign' (vzdal se ten, kdo je na tahu) | remíza
function chessFinish(c, how) {
  c.phase = 'over';
  c.overSel = 0;
  c.confirmQuit = false;
  c.promo = null;
  const loser = c.online && how === 'resign' ? c.resignBy
    : c.level.id === 'two' ? c.pos.turn : (how === 'resign' ? 'w' : c.pos.turn);
  const winner = how === 'mate' || how === 'resign' ? (loser === 'w' ? 'b' : 'w') : null;
  c.result = { how, winner };
  c.msg2 = '';
  if (c.online) {   // online: text z mého pohledu a sázka (35_online_hry.js)
    c.msg2 = chessOnlineResult(c, how, winner);
    if (winner) return;
  }
  const draws = {
    stalemate: 'Pat – remíza',
    fifty: 'Remíza – 50 tahů bez braní',
    repetition: 'Remíza – 3× stejná pozice',
    material: 'Remíza – nedá se dát mat',
  };
  if (!winner) { c.msg = draws[how]; playSound([[440, 0, 0.1], [440, 0.15, 0.1]]); return; }
  if (c.level.id === 'two') {
    c.msg = (how === 'mate' ? 'Mat! ' : '') + (winner === 'w' ? 'Vyhrál bílý' : 'Vyhrál černý');
    playSound(CONFIG.SOUND_COMPLETE);
  } else if (winner === 'w') {
    c.reward = c.level.reward;
    state.money += c.reward;
    saveProgress();
    c.msg = `Mat! Vyhrál jsi a dostal ${c.reward} Kč`;
    playSound(CONFIG.SOUND_COMPLETE);
  } else {
    c.msg = how === 'resign' ? 'Vzdal ses – vyhrál počítač' : 'Mat! Vyhrál počítač';
    playSound(CONFIG.SOUND_MISS);
  }
}

function chessLeave() {
  const c = state.chess;
  if (c && c.online) duelQuit(c);   // online partie skončí i u soupeře (35_online_hry.js)
  if (duel.ask) duelCancelAsk();
  state.chess = null;
  setScreen('playing');
  input.events.length = 0;
  if (c && c.reward) state.toast = { text: `Výhra v šachu! +${c.reward} Kč`, t: CONFIG.TOAST_TIME + 1 };
}

// Hráč vybral pole: vzít figurku / táhnout / vybrat jinou
function chessPick(c, sq) {
  if (c.sel >= 0) {
    const ms = c.legal.filter((m) => m.from === c.sel && m.to === sq);
    if (ms.length) {
      if (ms[0].promo) { c.promo = { moves: ms, sel: 0 }; return; }   // proměna – vybere se figurka
      chessApply(c, ms[0]);
      return;
    }
  }
  const p = c.pos.b[sq];
  if (p && p[0] === c.pos.turn && c.legal.some((m) => m.from === sq)) {
    c.sel = sq;
    c.targets = c.legal.filter((m) => m.from === sq).map((m) => m.to);
    playSound([[700, 0, 0.03]]);
  } else {
    c.sel = -1;
    c.targets = [];
  }
}

// --- rozložení tlačítek (stejné pro kreslení i ťukání) ---
function chessSquareAt(x, y) {
  const B = CHESS.BOARD;
  const col = Math.floor((x - B.x) / B.sq), row = Math.floor((y - B.y) / B.sq);
  return col >= 0 && col < 8 && row >= 0 && row < 8 ? chessView(state.chess, row * 8 + col) : -1;
}
// menu: obtížnosti, dva hráči, online soupeř (jen s databází, 35_online_hry.js) a Odejít (null)
const chessMenuItems = () => [...CHESS.LEVELS, ...(mpReady() ? [DUEL.ROW] : []), null];
function chessMenuRows() {
  const n = chessMenuItems().length, step = n > 5 ? 54 : 58;
  return chessMenuItems().map((_, i) => ({ x: 210, y: (n > 5 ? 174 : 186) + i * step, w: 380, h: n > 5 ? 46 : 48 }));
}
function chessOverButtons() { return [0, 1].map((i) => ({ x: 250, y: 318 + i * 60, w: 300, h: 48 })); }
function chessConfirmButtons() { return [{ x: 222, y: 318, w: 170, h: 48 }, { x: 408, y: 318, w: 170, h: 48 }]; }
function chessPromoRects() { return [0, 1, 2, 3].map((i) => ({ x: 170 + i * 120, y: 262, w: 100, h: 100 })); }
function chessResignButton() { return { x: CHESS.PANEL_X, y: 462, w: 196, h: 44 }; }
const chessHit = (rects, ev) => (ev.x == null ? -1 : rects.findIndex((r) => pointInRect(ev.x, ev.y, r, 0)));

function updateChess(dt) {
  const c = state.chess;
  const events = input.events.splice(0);
  const keys = c.keys.splice(0);
  const has = (list, k) => KEYMAP[list].includes(k);

  if (c.phase === 'pick' || c.phase === 'wait') { duelPickUpdate(c, 'chess', events, keys); return; }   // online výzva (35_online_hry.js)
  if (c.phase === 'menu') {
    const items = chessMenuItems(), n = items.length;
    for (const k of keys) {
      if (has('up', k)) c.menuSel = (c.menuSel + n - 1) % n;
      if (has('down', k)) c.menuSel = (c.menuSel + 1) % n;
      if (k === 'Escape') { chessLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? c.menuSel : chessHit(chessMenuRows(), ev);
      if (i < 0) continue;
      const item = items[i];
      if (!item) chessLeave();
      else if (item === DUEL.ROW) duelOpenPick(c);
      else chessNewGame(item);
      return;
    }
    return;
  }
  if (c.online) duelPoll(c);   // tahy soupeře (35_online_hry.js)

  if (c.phase === 'over') {
    for (const k of keys) {
      if (has('up', k) || has('down', k)) c.overSel = 1 - c.overSel;
      if (k === 'Escape') { chessLeave(); return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? c.overSel : chessHit(chessOverButtons(), ev);
      if (i === 0 && c.online) { duelOverAgain(c); return; }   // odveta / zpět do menu
      if (i === 0) { c.phase = 'menu'; c.menuSel = Math.max(0, CHESS.LEVELS.indexOf(c.level)); return; }
      if (i === 1) { chessLeave(); return; }
    }
    return;
  }

  // --- partie ---
  if (c.promo) {   // výběr figurky při proměně pěšce
    for (const k of keys) {
      if (has('left', k)) c.promo.sel = (c.promo.sel + 3) % 4;
      if (has('right', k)) c.promo.sel = (c.promo.sel + 1) % 4;
      if (k === 'Escape') { c.promo = null; return; }
    }
    for (const ev of events) {
      const i = ev.type === 'action' ? c.promo.sel : chessHit(chessPromoRects(), ev);
      if (i < 0) continue;
      const m = c.promo.moves[i];
      c.promo = null;
      chessApply(c, m);
      return;
    }
    return;
  }
  if (c.confirmQuit) {   // „Opravdu se vzdát?“
    for (const k of keys) if (k === 'Escape') { c.confirmQuit = false; return; }
    for (const ev of events) {
      const i = ev.type === 'action' ? 0 : chessHit(chessConfirmButtons(), ev);
      if (i === 0) { if (c.online) { c.resignBy = c.myColor; c.resigned = true; } chessFinish(c, 'resign'); return; }
      if (i === 1) { c.confirmQuit = false; return; }
    }
    return;
  }
  for (const k of keys) {
    if (k === 'Escape') { c.confirmQuit = true; return; }
    let d = has('left', k) ? [0, -1] : has('right', k) ? [0, 1] : has('up', k) ? [-1, 0] : has('down', k) ? [1, 0] : null;
    if (d && c.flip) d = [-d[0], -d[1]];   // otočená šachovnice: šipky podle obrazovky
    if (d) {
      const r = Math.min(7, Math.max(0, (c.cursor >> 3) + d[0]));
      const col = Math.min(7, Math.max(0, (c.cursor & 7) + d[1]));
      c.cursor = r * 8 + col;
    }
  }
  for (const ev of events) {
    if (ev.type === 'tap' && ev.x != null && pointInRect(ev.x, ev.y, chessResignButton(), 0)) { c.confirmQuit = true; return; }
  }
  if (!chessHumanTurn(c)) {   // počítač (online táhne soupeř u sebe)
    if (c.online) return;
    c.aiT += dt;
    if (c.aiT >= CHESS.AI_DELAY) {
      const m = chessAiMove(c.pos, c.level);
      if (m) chessApply(c, m);
    }
    return;
  }
  for (const ev of events) {
    if (ev.type === 'tap') {
      const sq = ev.x == null ? -1 : chessSquareAt(ev.x, ev.y);
      if (sq < 0) continue;
      c.cursor = sq;
    }
    chessPick(c, c.cursor);
    if (c.phase !== 'play' || c.promo) return;
  }
}

// --- kreslení ---
// Figurka (Staunton zjednodušeně): t = 'P'…'K', color = 'w' | 'b', střed pole cx, cy, velikost pole sq
function drawChessPiece(t, color, cx, cy, sq) {
  const fill = color === 'w' ? '#f6efdf' : '#2e2b2a';
  const line = color === 'w' ? '#3b2a1c' : '#d9c59c';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sq / 60, sq / 60);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath(); ctx.ellipse(2, 22, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = line;
  const shape = (draw) => { ctx.beginPath(); draw(); ctx.fill(); ctx.stroke(); };
  const ball = (x, y, r) => shape(() => ctx.arc(x, y, r, 0, Math.PI * 2));
  shape(() => { ctx.moveTo(-16, 22); ctx.lineTo(16, 22); ctx.lineTo(13, 15); ctx.lineTo(-13, 15); ctx.closePath(); });   // podstavec
  if (t === 'P') {
    shape(() => { ctx.moveTo(-9, 15); ctx.quadraticCurveTo(-8, 2, -4, -2); ctx.lineTo(4, -2); ctx.quadraticCurveTo(8, 2, 9, 15); ctx.closePath(); });
    ball(0, -9, 7);
  } else if (t === 'R') {
    shape(() => ctx.rect(-10, -6, 20, 21));
    shape(() => {
      ctx.moveTo(-13, -6); ctx.lineTo(-13, -19); ctx.lineTo(-8, -19); ctx.lineTo(-8, -14); ctx.lineTo(-3, -14); ctx.lineTo(-3, -19);
      ctx.lineTo(3, -19); ctx.lineTo(3, -14); ctx.lineTo(8, -14); ctx.lineTo(8, -19); ctx.lineTo(13, -19); ctx.lineTo(13, -6); ctx.closePath();
    });
  } else if (t === 'N') {
    shape(() => {
      ctx.moveTo(-11, 15); ctx.lineTo(-8, 2); ctx.quadraticCurveTo(-16, -2, -13, -9); ctx.lineTo(-4, -16);
      ctx.lineTo(-2, -23); ctx.lineTo(3, -17); ctx.quadraticCurveTo(14, -12, 12, 15); ctx.closePath();
    });
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.arc(-4, -10, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -15); ctx.quadraticCurveTo(9, -6, 7, 8); ctx.stroke();   // hříva
  } else if (t === 'B') {
    shape(() => { ctx.moveTo(-10, 15); ctx.quadraticCurveTo(-13, -4, 0, -19); ctx.quadraticCurveTo(13, -4, 10, 15); ctx.closePath(); });
    ball(0, -22, 3.5);
    ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(-2, -4); ctx.stroke();   // zářez
  } else if (t === 'Q') {
    shape(() => {
      ctx.moveTo(-11, 15); ctx.lineTo(-15, -12); ctx.lineTo(-8, -3); ctx.lineTo(-7, -17); ctx.lineTo(-2, -4); ctx.lineTo(0, -19);
      ctx.lineTo(2, -4); ctx.lineTo(7, -17); ctx.lineTo(8, -3); ctx.lineTo(15, -12); ctx.lineTo(11, 15); ctx.closePath();
    });
    for (const [x, y] of [[-15, -14], [-7, -19], [0, -21], [7, -19], [15, -14]]) ball(x, y, 2.5);
  } else {   // král
    shape(() => { ctx.moveTo(-11, 15); ctx.quadraticCurveTo(-16, -6, -6, -10); ctx.lineTo(6, -10); ctx.quadraticCurveTo(16, -6, 11, 15); ctx.closePath(); });
    shape(() => ctx.rect(-2, -25, 4, 15));
    shape(() => ctx.rect(-7, -21, 14, 4));
  }
  ctx.restore();
}

function drawChessButton(r, label, active, color = '#3d5f3a') {
  roundRectPath(r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = active ? '#ffd54a' : color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = active ? '#2b1d14' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
}
function drawChessBox(x, y, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  roundRectPath(x, y, w, h, 14);
  ctx.fillStyle = '#3a2616';
  ctx.fill();
  ctx.strokeStyle = '#c99a62';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawChessBoard(c, pos) {
  const { x, y, sq } = CHESS.BOARD;
  drawRect({ x: x - 22, y: y - 22, w: sq * 8 + 44, h: sq * 8 + 44 }, '#24160b');
  drawRect({ x: x - 18, y: y - 18, w: sq * 8 + 36, h: sq * 8 + 36 }, '#6b4426');
  const playing = c.phase === 'play';
  const checkK = playing && chessInCheck(pos) ? pos.b.indexOf(pos.turn + 'K') : -1;
  const V = (i) => chessView(c, i);   // online černý vidí šachovnici otočenou
  for (let i = 0; i < 64; i++) {
    const sx = x + (V(i) & 7) * sq, sy = y + (V(i) >> 3) * sq;
    const cell = { x: sx, y: sy, w: sq, h: sq };
    drawRect(cell, ((i >> 3) + (i & 7)) % 2 ? '#a9794f' : '#ecd9b4');
    if (c.last && (i === c.last.from || i === c.last.to)) drawRect(cell, 'rgba(255, 213, 74, 0.4)');
    if (i === c.sel) drawRect(cell, 'rgba(80, 160, 255, 0.5)');
    if (i === checkK) {
      const g = ctx.createRadialGradient(sx + sq / 2, sy + sq / 2, 4, sx + sq / 2, sy + sq / 2, sq * 0.7);
      g.addColorStop(0, 'rgba(230, 30, 30, 0.85)');
      g.addColorStop(1, 'rgba(230, 30, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx, sy, sq, sq);
    }
  }
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#e8d3a8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    ctx.fillText('abcdefgh'[c.flip ? 7 - i : i], x + i * sq + sq / 2, y + 8 * sq + 10);
    ctx.fillText(String(c.flip ? i + 1 : 8 - i), x - 10, y + i * sq + sq / 2);
  }
  for (let i = 0; i < 64; i++) {
    const p = pos.b[i];
    if (p) drawChessPiece(p[1], p[0], x + (V(i) & 7) * sq + sq / 2, y + (V(i) >> 3) * sq + sq / 2 - 2, sq);
  }
  // kam může vybraná figurka: tečka, u braní kroužek
  for (const tq of c.targets || []) {
    const cx = x + (V(tq) & 7) * sq + sq / 2, cy = y + (V(tq) >> 3) * sq + sq / 2;
    ctx.fillStyle = 'rgba(20, 60, 20, 0.45)';
    ctx.strokeStyle = 'rgba(20, 60, 20, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (pos.b[tq] || tq === pos.ep) { ctx.arc(cx, cy, sq / 2 - 5, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill(); }
  }
  // kurzor pro klávesnici
  if (playing && !isTouchHint() && !c.promo && !c.confirmQuit && chessHumanTurn(c)) {
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + (V(c.cursor) & 7) * sq + 2, y + (V(c.cursor) >> 3) * sq + 2, sq - 4, sq - 4);
  }
}

function drawChessPanel(c) {
  const X = CHESS.PANEL_X, W = 196, mid = X + W / 2;
  drawOutlinedText('ŠACHY', mid, 62, 'bold 28px sans-serif', '#ffd54a', 'middle');
  if (c.level) {
    drawOutlinedText(c.level.name, mid, 98, 'bold 14px sans-serif', '#f4ecd8', 'middle');
    // kdo je na tahu
    roundRectPath(X, 120, W, 58, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    const white = c.pos.turn === 'w';
    ctx.fillStyle = white ? '#f6efdf' : '#2e2b2a';
    ctx.strokeStyle = white ? '#3b2a1c' : '#d9c59c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X + 24, 149, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    let who = white ? 'Na tahu: bílý' : 'Na tahu: černý';
    if (c.online) who = c.pos.turn === c.myColor ? `Hraješ ty (${white ? 'bílý' : 'černý'})` : `Táhne ${duelOppName()}…`;
    else if (c.level.id !== 'two') who = white ? 'Hraješ ty (bílý)' : 'Počítač přemýšlí…';
    if (c.phase === 'over') who = 'Konec partie';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(who, X + 44, 150, W - 50);
    if (c.phase === 'play' && chessInCheck(c.pos)) drawOutlinedText('ŠACH!', mid, 202, 'bold 22px sans-serif', '#ff5a4a', 'middle');
    // sebrané figurky
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#e8d3a8';
    ctx.fillText('Sebráno:', X, 236);
    const order = 'QRBNP';
    [['b', 262], ['w', 340]].forEach(([col, y0]) => {
      const list = [...c.captured[col]].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      list.forEach((t, i) => drawChessPiece(t, col, X + 14 + (i % 7) * 27, y0 + Math.floor(i / 7) * 32, 28));
    });
    if (c.phase === 'play') drawChessButton(chessResignButton(), 'Vzdát se', false, '#7a2a20');
  }
  drawOutlinedText(`Peníze: ${state.money} Kč`, mid, 532, 'bold 15px sans-serif', '#ffd54a', 'middle');
  const hint = isTouchHint() ? 'Ťukni na figurku, pak na pole' : 'Šipky + mezerník · Esc = konec';
  drawOutlinedText(hint, mid, 560, 'bold 12px sans-serif', '#ffffff', 'middle');
}

function renderChess() {
  const c = state.chess;
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;
  // dřevěný stůl
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#4a2f1c');
  bg.addColorStop(1, '#2e1d12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let y = 0; y < H; y += 14) ctx.fillRect(0, y, W, 1);
  drawChessBoard(c, c.pos || chessStartPos());
  drawChessPanel(c);

  if (c.phase === 'menu') {
    drawChessBox(180, 110, 440, 420);
    drawOutlinedText('Šachy – vyber soupeře', 400, 150, 'bold 24px sans-serif', '#ffd54a', 'middle');
    const rows = chessMenuRows();
    chessMenuItems().forEach((l, i) => {
      const label = l ? l.name + (l.reward ? `  ·  výhra +${l.reward} Kč` : '') : 'Odejít';
      drawChessButton(rows[i], label, i === c.menuSel, !l ? '#5a4636' : l === DUEL.ROW ? '#2f5a7a' : '#3d5f3a');
    });
    drawDuelNote(92);   // „Bob neodpovídá“ (35_online_hry.js)
  } else if (c.phase === 'pick' || c.phase === 'wait') {
    drawDuelPick(c, 'chess');   // výběr soupeře online (35_online_hry.js)
  } else if (c.phase === 'over') {
    drawChessBox(200, 200, 400, 250);
    const gold = c.reward || (c.result && c.result.winner && (c.level.id === 'two' || (c.online && c.result.winner === c.myColor)));
    drawOutlinedText(c.msg, 400, 252, 'bold 22px sans-serif', gold ? '#ffd54a' : '#ffffff', 'middle');
    if (c.msg2) drawOutlinedText(c.msg2, 400, 284, 'bold 16px sans-serif', '#ffd54a', 'middle');
    chessOverButtons().forEach((r, i) => drawChessButton(r, i === 0 ? (c.online ? duelOverLabel(c) : 'Hrát znovu') : 'Odejít', i === c.overSel));
  } else if (c.promo) {
    drawChessBox(150, 200, 500, 190);
    drawOutlinedText('Proměna pěšce – vyber figurku', 400, 232, 'bold 20px sans-serif', '#ffd54a', 'middle');
    chessPromoRects().forEach((r, i) => {
      roundRectPath(r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = i === c.promo.sel ? '#ffd54a' : '#ecd9b4';
      ctx.fill();
      drawChessPiece(c.promo.moves[i].promo, c.pos.turn, r.x + r.w / 2, r.y + r.h / 2, 80);
    });
  } else if (c.confirmQuit) {
    drawChessBox(200, 220, 400, 170);
    drawOutlinedText('Opravdu se vzdát?', 400, 270, 'bold 24px sans-serif', '#ffffff', 'middle');
    const [yes, no] = chessConfirmButtons();
    drawChessButton(yes, 'Ano, vzdát', isTouchHint() ? false : true, '#7a2a20');
    drawChessButton(no, 'Ne, hrát dál', false);
  }
}
