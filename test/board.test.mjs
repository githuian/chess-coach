import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFen, isAllowedPath, pieceFromClass, squareFromClass } from '../src/board.js';

const START = [
  ...'rnbqkbnr'.split('').map((t, i) => ({ code: 'b' + t, square: 'abcdefgh'[i] + '8' })),
  ...'abcdefgh'.split('').map((f) => ({ code: 'bp', square: f + '7' })),
  ...'abcdefgh'.split('').map((f) => ({ code: 'wp', square: f + '2' })),
  ...'rnbqkbnr'.split('').map((t, i) => ({ code: 'w' + t, square: 'abcdefgh'[i] + '1' })),
];

test('parses chess.com piece classes', () => {
  assert.equal(pieceFromClass('piece wp square-52'), 'wp');
  assert.equal(pieceFromClass('piece square-18 bk'), 'bk');
  assert.equal(squareFromClass('piece wp square-52'), 'e2');
  assert.equal(squareFromClass('highlight square-88'), 'h8');
  assert.equal(squareFromClass('piece wp'), null);
});

test('start position with no highlights assumes white to move', () => {
  const r = buildFen(START);
  assert.equal(r.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(r.turnKnown, false);
});

test('last-move highlight sets side to move and en passant', () => {
  const pieces = START.filter((p) => p.square !== 'e2').concat({ code: 'wp', square: 'e4' });
  const r = buildFen(pieces, ['e4', 'e2']);
  assert.equal(r.fen, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  assert.equal(r.turnKnown, true);
});

test('castling rights drop when the rook has left', () => {
  const pieces = START.filter((p) => p.square !== 'h1');
  assert.match(buildFen(pieces).fen, / w Qkq /);
});

test('learning mode only allows non-live pages', () => {
  for (const p of ['/analysis', '/analysis/game/live/123', '/puzzles/rated', '/play/computer', '/lessons/x', '/es/analysis']) {
    assert.ok(isAllowedPath(p), p);
  }
  for (const p of ['/play/online', '/game/live/123', '/game/daily/5', '/game/123', '/live', '/', '/home']) {
    assert.ok(!isAllowedPath(p), p);
  }
});
