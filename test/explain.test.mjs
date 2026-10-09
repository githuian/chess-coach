// Runs the real Stockfish engine on known positions and checks the coaching text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { explain, nullMoveFen } from '../src/explain.js';
import { parseInfo } from '../src/engine.js';
import { setLang, resolveLang } from '../src/i18n.js';

const require = createRequire(import.meta.url);
const initEngine = require('stockfish');

let engine;
let onLine = () => {};
async function getEngine() {
  if (engine) return engine;
  engine = await initEngine('lite-single');
  engine.listener = (line) => onLine(line);
  return engine;
}

async function analyze(fen, multipv = 3, depth = 14) {
  const sf = await getEngine();
  return new Promise((resolve) => {
    const lines = [];
    onLine = (line) => {
      const info = parseInfo(line);
      if (info) lines[info.multipv - 1] = info;
      if (line.startsWith('bestmove')) resolve(lines.filter(Boolean));
    };
    sf.sendCommand(`setoption name MultiPV value ${multipv}`);
    sf.sendCommand(`position fen ${fen}`);
    sf.sendCommand(`go depth ${depth}`);
  });
}

async function coach(fen) {
  const lines = await analyze(fen);
  const nf = nullMoveFen(fen);
  const threat = nf ? { fen: nf, line: (await analyze(nf, 1, 12))[0] } : null;
  const ex = explain(fen, lines, threat);
  console.log(`\n${fen}\n  best: ${ex.bestSan} (${ex.eval.text}, ${ex.eval.verdict})`);
  for (const w of ex.warnings) console.log(`  ! ${w}`);
  for (const r of ex.reasons) console.log(`  - ${r}`);
  return ex;
}

test('finds and explains a knight fork', async () => {
  // Nc7+ forks the king on e8 and the rook on a8 (the a2 pawn keeps it from being a dead draw).
  const ex = await coach('r3k3/8/8/3N4/8/8/P7/4K3 w - - 0 1');
  assert.equal(ex.bestSan, 'Nc7+');
  assert.ok(ex.reasons.some((r) => r.startsWith('Fork!')));
  assert.ok(ex.reasons.some((r) => r.startsWith('Gives check')));
});

test('takes a free piece', async () => {
  const ex = await coach('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
  assert.equal(ex.bestSan, 'Rxd5');
  assert.ok(ex.reasons.some((r) => r.includes('for free')));
  // Our own winning capture must not be reported as an opponent threat.
  assert.ok(!ex.warnings.some((w) => w.startsWith('Their threat')), ex.warnings.join(' | '));
});

test('spots mate in one', async () => {
  const ex = await coach('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  assert.equal(ex.bestSan, 'Ra8#');
  assert.ok(ex.reasons[0].startsWith('Checkmate'));
});

test('warns about a hanging piece and rescues it', async () => {
  // The black pawn on e5 attacks the undefended knight on d4.
  const ex = await coach('rnbqkbnr/pppp1ppp/8/4p3/3N4/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1');
  assert.ok(ex.warnings.some((w) => w.includes('knight on d4')));
  assert.ok(ex.reasons.some((r) => r.includes('Rescues your knight')) || ex.bestSan.includes('x'));
});

test('warns about a mate threat (back rank)', async () => {
  // Black threatens Re1#; white must make luft or cover e1.
  const ex = await coach('4r1k1/5ppp/8/8/8/R7/5PPP/6K1 w - - 0 1');
  assert.ok(ex.warnings.some((w) => w.includes('checkmate')), ex.warnings.join(' | '));
});

test('opening move gets a positional explanation', async () => {
  const ex = await coach('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.ok(ex.reasons.length > 0);
  assert.equal(ex.warnings.length, 0);
});

test('explains in Chinese when the language is set to zh', async () => {
  setLang('zh');
  try {
    const fork = await coach('r3k3/8/8/3N4/8/8/P7/4K3 w - - 0 1');
    assert.ok(fork.reasons.some((r) => r.startsWith('捉双！')), fork.reasons.join(' | '));
    assert.ok(fork.reasons.some((r) => r.startsWith('将军')));
    const free = await coach('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    assert.ok(free.reasons.some((r) => r.startsWith('白吃一个后')), free.reasons.join(' | '));
    const mate = await coach('4r1k1/5ppp/8/8/8/R7/5PPP/6K1 w - - 0 1');
    assert.ok(mate.warnings.some((w) => w.includes('将杀')), mate.warnings.join(' | '));
  } finally {
    setLang('en');
  }
});

test('auto language follows the browser', () => {
  assert.equal(resolveLang('auto', 'zh-CN'), 'zh');
  assert.equal(resolveLang('auto', 'zh-TW'), 'zh');
  assert.equal(resolveLang('auto', 'en-US'), 'en');
  assert.equal(resolveLang('en', 'zh-CN'), 'en');
  assert.equal(resolveLang('zh', 'en-US'), 'zh');
});

test.after(() => engine?.sendCommand('quit'));
