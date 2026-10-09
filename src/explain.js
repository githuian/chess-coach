// Rule-based coaching: turns Stockfish's lines into plain-language reasons.
// Engine scores are always from the side to move's point of view.
// All wording lives in i18n.js so the coach can speak English or Chinese.
import { Chess, validateFen } from 'chess.js';
import { t, pieceName as NAME, colorName, listText } from './i18n.js';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const other = (c) => (c === 'w' ? 'b' : 'w');

export function scoreToNumber(score) {
  if (!score) return 0;
  if (score.type === 'mate') {
    return score.value > 0 ? 100000 - score.value * 100 : -100000 - score.value * 100;
  }
  return score.value;
}

// Human-readable evaluation from White's point of view.
export function formatEval(score, turn) {
  const sign = turn === 'w' ? 1 : -1;
  if (score.type === 'mate') {
    const n = Math.abs(score.value);
    const whiteWins = score.value * sign > 0 || (score.value === 0 && turn === 'b');
    const side = colorName(whiteWins ? 'w' : 'b');
    return {
      text: `${whiteWins ? '+' : '-'}M${n}`,
      verdict: n === 0 ? t('hasWon', { side }) : t('mateIn', { side, n }),
      white: whiteWins ? 1000 : -1000,
    };
  }
  const cp = score.value * sign;
  const side = colorName(cp > 0 ? 'w' : 'b');
  const abs = Math.abs(cp);
  let verdict;
  if (abs < 30) verdict = t('equal');
  else if (abs < 100) verdict = t('slightlyBetter', { side });
  else if (abs < 300) verdict = t('clearlyBetter', { side });
  else verdict = t('winning', { side });
  return { text: `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`, verdict, white: cp };
}

function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

// Plays a UCI line from fen and returns the moves chess.js accepted.
export function playLine(fen, uciMoves) {
  const chess = new Chess(fen);
  const moves = [];
  for (const uci of uciMoves) {
    try {
      moves.push(chess.move(uciToMove(uci)));
    } catch {
      break;
    }
  }
  return { moves, chess };
}

function pieces(chess, color) {
  return chess.board().flat().filter((p) => p && p.color === color);
}

function material(chess, color) {
  return pieces(chess, color).reduce((sum, p) => sum + VALUE[p.type], 0);
}

// Is the piece on sq in danger? Undefended and attacked, or attacked by something cheaper.
function danger(chess, sq) {
  const p = chess.get(sq);
  if (!p || p.type === 'k') return null;
  const attackers = chess.attackers(sq, other(p.color));
  if (!attackers.length) return null;
  if (!chess.attackers(sq, p.color).length) return { square: sq, piece: p, reason: 'undefended' };
  const cheapest = attackers
    .map((s) => chess.get(s).type)
    .filter((t) => t !== 'k')
    .sort((a, b) => VALUE[a] - VALUE[b])[0];
  if (cheapest && VALUE[cheapest] < VALUE[p.type]) return { square: sq, piece: p, reason: 'cheaper', by: cheapest };
  return null;
}

function piecesInDanger(chess, color) {
  return pieces(chess, color).map((p) => danger(chess, p.square)).filter(Boolean);
}

function dangerText(d) {
  return d.reason === 'undefended' ? t('undefended') : t('attackedByCheaper', { by: NAME(d.by) });
}

function fileHasPawns(chess, file) {
  for (let r = 1; r <= 8; r++) {
    if (chess.get(file + r)?.type === 'p') return true;
  }
  return false;
}

// Same position with the other side to move: used to ask "what would they do if it were their turn?"
export function nullMoveFen(fen) {
  try {
    if (new Chess(fen).inCheck()) return null;
  } catch {
    return null;
  }
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const flipped = parts.join(' ');
  if (!validateFen(flipped).ok) return null;
  try {
    new Chess(flipped);
    return flipped;
  } catch {
    return null;
  }
}

function gapText(cp) {
  if (cp >= 50000) return t('missesForcedMate');
  return t('pawnsWorse', { x: (cp / 100).toFixed(1) });
}

// lines: Stockfish MultiPV lines for fen ({ score, pv }), best first.
// threat: optional { fen, line } - the engine's best move for the opponent in nullMoveFen(fen).
export function explain(fen, lines, threat) {
  const chess = new Chess(fen);
  const us = chess.turn();
  const them = other(us);
  const best = lines[0];
  const { moves: pv } = playLine(fen, best.pv);
  if (!pv.length) return null;

  const mv = pv[0];
  const after = new Chess(fen);
  after.move(mv);
  const bestN = scoreToNumber(best.score);
  const moverName = NAME(mv.piece);
  const reasons = [];
  const warnings = [];
  let savedPiece = false;

  // --- What is the opponent up to right now? ---
  if (chess.inCheck()) warnings.push(t('inCheck'));
  for (const d of piecesInDanger(chess, us)) {
    warnings.push(t('pieceInDanger', { piece: NAME(d.piece.type), sq: d.square, danger: dangerText(d) }));
  }
  let threatMove = null;
  if (threat?.line?.pv?.length) {
    const tMoves = playLine(threat.fen, threat.line.pv.slice(0, 1)).moves;
    const tN = scoreToNumber(threat.line.score);
    // Compare what a free move would get them against the material balance as it stands,
    // so our own winning move doesn't show up as their threat.
    const baseline = 100 * (material(chess, them) - material(chess, us));
    if (tMoves.length && (threat.line.score.type === 'mate' ? threat.line.score.value > 0 : tN - baseline >= 150)) {
      threatMove = tMoves[0];
      let text = t('theirThreat', { san: threatMove.san });
      if (threat.line.score.type === 'mate' && threat.line.score.value > 0) text += t('threatMate', { n: threat.line.score.value });
      else if (threatMove.captured) text += t('threatWins', { piece: NAME(threatMove.captured) });
      warnings.push(t('threatEnd', { text }));
    }
  }

  // --- Why the best move is good ---
  if (after.isCheckmate()) {
    reasons.push(t('checkmate'));
  } else if (best.score.type === 'mate' && best.score.value > 0) {
    reasons.push(t('forcedMate', { n: best.score.value }));
  }

  const wasInDanger = danger(chess, mv.from);
  if (wasInDanger && !mv.isKingsideCastle() && !mv.isQueensideCastle()) {
    reasons.push(t('rescues', { piece: moverName, sq: mv.from, danger: dangerText(wasInDanger) }));
    savedPiece = true;
  }

  if (mv.captured) {
    const cv = VALUE[mv.captured];
    const mvv = VALUE[mv.piece];
    const captured = NAME(mv.captured);
    const recapture = after.attackers(mv.to, them).length > 0;
    if (!recapture) {
      reasons.push(t('freePiece', { piece: captured, sq: mv.to }));
    } else if (cv > mvv) {
      reasons.push(t('winsMaterial', { piece: moverName, pv: mvv, captured, cv }));
    } else if (cv === mvv) {
      const ahead = material(chess, us) - material(chess, them);
      reasons.push(t(ahead >= 2 ? 'tradeAhead' : 'tradeEven', { piece: moverName, captured }));
    } else if (bestN > -100) {
      reasons.push(t('givesUp', { piece: moverName, captured }));
    }
  }

  if (mv.promotion) reasons.push(t('promotes', { piece: NAME(mv.promotion) }));

  if (mv.isKingsideCastle() || mv.isQueensideCastle()) {
    reasons.push(t('castles'));
  }

  if (!after.isCheckmate() && after.inCheck()) {
    reasons.push(t('givesCheck'));
  }

  // Threats removed: pieces of ours that were in danger and no longer are.
  for (const d of piecesInDanger(chess, us)) {
    if (d.square === mv.from) continue;
    if (after.get(d.square)?.color === us && !danger(after, d.square)) {
      reasons.push(t('handlesThreat', { piece: NAME(d.piece.type), sq: d.square }));
      savedPiece = true;
    }
  }
  if (threatMove && !savedPiece) {
    const stillPossible = after.moves({ verbose: true }).some((m) => m.from === threatMove.from && m.to === threatMove.to);
    const mateThreat = threat.line.score.type === 'mate';
    if (!stillPossible || (threatMove.captured && !danger(after, threatMove.to))) {
      reasons.push(t('stopsIdea', { san: threatMove.san }));
    } else if (mateThreat && bestN > -50000) {
      reasons.push(t('defendsMate', { san: threatMove.san }));
    }
  }

  // New targets for the piece that moved (fork / attack).
  if (!mv.isKingsideCastle() && !mv.isQueensideCastle()) {
    const targets = [];
    for (const p of pieces(after, them)) {
      if (!after.attackers(p.square, us).includes(mv.to)) continue;
      const undefended = after.attackers(p.square, them).length === 0;
      if (p.type === 'k' || VALUE[p.type] > VALUE[mv.piece] || (undefended && p.type !== 'p')) {
        targets.push({ ...p, undefended });
      }
    }
    if (targets.length >= 2) {
      const names = targets.map((x) => (x.type === 'k' ? t('theKing') : t('pieceOn', { piece: NAME(x.type), sq: x.square })));
      reasons.push(t('fork', { piece: moverName, sq: mv.to, targets: listText(names) }));
    } else if (targets.length === 1 && targets[0].type !== 'k') {
      const x = targets[0];
      reasons.push(t('attacks', { piece: NAME(x.type), sq: x.square, undefended: x.undefended }));
    }
  }

  // A piece left where it can be taken is bait, unless the move was a fair trade.
  const leftHanging = danger(after, mv.to);
  if (leftHanging && !mv.captured && bestN > -100 && pv.length >= 3) {
    reasons.push(t('bait', { piece: moverName, reply: pv[1].san, follow: pv[2].san }));
  }

  // Positional ideas when nothing tactical is going on.
  const homeRank = us === 'w' ? '1' : '8';
  if ((mv.piece === 'n' || mv.piece === 'b') && mv.from[1] === homeRank) {
    reasons.push(t('develops', { piece: moverName }));
  }
  if (mv.piece === 'p' && ['c4', 'd4', 'e4', 'f4', 'c5', 'd5', 'e5', 'f5'].includes(mv.to) && !mv.captured) {
    reasons.push(t('center'));
  }
  if (mv.piece === 'r' && mv.from[0] !== mv.to[0] && !fileHasPawns(after, mv.to[0])) {
    reasons.push(t('openFile', { file: mv.to[0] }));
  }

  // What the main line leads to.
  if (pv.length >= 3 && !mv.captured && pv[2].captured && pv[2].color === us) {
    reasons.push(t('prepares', { next: pv[2].san, reply: pv[1].san, piece: NAME(pv[2].captured) }));
  }
  const plies = Math.min(pv.length, 8);
  const endPos = playLine(fen, best.pv.slice(0, plies - (plies % 2))).chess;
  const gain = material(endPos, us) - material(endPos, them) - (material(chess, us) - material(chess, them));
  if (gain >= 2 && best.score.type !== 'mate') {
    reasons.push(t('gains', { n: gain }));
  } else if (gain <= -2 && bestN > -50) {
    reasons.push(t('sacrifice', { n: -gain }));
  }

  // Compare with the alternatives.
  const alternatives = lines.slice(1).map((l) => {
    const m = playLine(fen, l.pv.slice(0, 1)).moves[0];
    return m && { san: m.san, eval: formatEval(l.score, us), gap: bestN - scoreToNumber(l.score) };
  }).filter(Boolean);
  const second = alternatives[0];
  if (second && second.gap >= 150) {
    reasons.push(t('onlyMove', { san: second.san, gap: gapText(second.gap) }));
  }

  if (!reasons.length) {
    reasons.push(t('quiet'));
  }
  if (second && second.gap <= 25) {
    reasons.push(t('alsoGood', { san: second.san }));
  }

  return {
    turn: us,
    turnName: colorName(us),
    bestSan: mv.san,
    from: mv.from,
    to: mv.to,
    eval: formatEval(best.score, us),
    line: pv.map((m) => ({ san: m.san, mine: m.color === us })),
    reasons,
    warnings,
    threat: threatMove && { from: threatMove.from, to: threatMove.to, san: threatMove.san },
    alternatives,
  };
}
