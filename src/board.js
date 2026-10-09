// Turns what we can see on the chess.com board into a FEN string.
// Kept free of DOM access so it can be tested in Node.

const FILES = 'abcdefgh';

// chess.com encodes squares as "square-XY": X = file 1-8 (a-h), Y = rank 1-8.
export function squareFromClass(className) {
  const m = /\bsquare-(\d)(\d)\b/.exec(className);
  if (!m) return null;
  const file = +m[1], rank = +m[2];
  if (file < 1 || file > 8 || rank < 1 || rank > 8) return null;
  return FILES[file - 1] + rank;
}

export function pieceFromClass(className) {
  const m = /(?:^|\s)([wb][pnbrqk])(?:\s|$)/.exec(className);
  return m ? m[1] : null;
}

// pieces: [{ code: 'wp', square: 'e4' }], highlights: ['e2', 'e4']
export function buildFen(pieces, highlights = []) {
  const at = new Map();
  for (const p of pieces) at.set(p.square, p.code);

  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '', empty = 0;
    for (const file of FILES) {
      const code = at.get(file + rank);
      if (!code) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += code[0] === 'w' ? code[1].toUpperCase() : code[1];
    }
    if (empty) row += empty;
    rows.push(row);
  }

  // Last move = the two highlighted squares: the empty one is where the piece
  // came from, the occupied one is where it landed. Whoever moved last is not to move.
  let lastMove = null;
  const hs = [...new Set(highlights)];
  if (hs.length === 2) {
    const [a, b] = hs;
    if (at.has(a) && !at.has(b)) lastMove = { from: b, to: a };
    else if (at.has(b) && !at.has(a)) lastMove = { from: a, to: b };
  }
  const turnKnown = !!lastMove;
  const turn = lastMove ? (at.get(lastMove.to)[0] === 'w' ? 'b' : 'w') : 'w';

  // Castling rights can't be seen, so assume they exist whenever king and rook are home.
  let castling = '';
  if (at.get('e1') === 'wk') {
    if (at.get('h1') === 'wr') castling += 'K';
    if (at.get('a1') === 'wr') castling += 'Q';
  }
  if (at.get('e8') === 'bk') {
    if (at.get('h8') === 'br') castling += 'k';
    if (at.get('a8') === 'br') castling += 'q';
  }

  let ep = '-';
  if (lastMove && at.get(lastMove.to)?.[1] === 'p' && lastMove.from[0] === lastMove.to[0]) {
    const r1 = +lastMove.from[1], r2 = +lastMove.to[1];
    if (Math.abs(r1 - r2) === 2) ep = lastMove.to[0] + (r1 + r2) / 2;
  }

  const fen = `${rows.join('/')} ${turn} ${castling || '-'} ${ep} 0 1`;
  return { fen, turnKnown, lastMove };
}

// Learning mode: only pages where engine help is allowed (analysis, review,
// puzzles, lessons, games vs. the computer). Everything else, including live
// and daily games against people, is off.
const ALLOWED = [
  /^\/analysis(\/|$)/,
  /^\/puzzles?(\/|$)/,
  /^\/lessons?(\/|$)/,
  /^\/practice(\/|$)/,
  /^\/drills(\/|$)/,
  /^\/play\/computer(\/|$)/,
  /^\/game\/computer(\/|$)/,
  /^\/explorer(\/|$)/,
  /^\/openings?(\/|$)/,
  /^\/solo-chess(\/|$)/,
  /^\/learn(\/|$)/,
];

export function isAllowedPath(pathname) {
  // chess.com sometimes prefixes a language code, e.g. /es/analysis
  const path = pathname.replace(/^\/[a-z]{2}(-[A-Za-z]{2})?(?=\/)/, '');
  return ALLOWED.some((re) => re.test(path));
}
