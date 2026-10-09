import { Chess, validateFen } from 'chess.js';
import { Engine } from './engine.js';
import { explain, formatEval, nullMoveFen, playLine } from './explain.js';
import { t, setLang, resolveLang, getLang, colorName } from './i18n.js';

const $ = (id) => document.getElementById(id);
const engine = new Engine(chrome.runtime.getURL('engine/stockfish-19-lite-single.js'));

const settings = { turn: 'auto', depth: 16, arrows: true, lang: 'auto' };
let parentOrigin = null;
let lastPosition = null;
let generation = 0;

function toParent(msg) {
  if (parentOrigin) window.parent.postMessage({ source: 'chess-coach-panel', ...msg }, parentOrigin);
}

function setArrows(arrows) {
  toParent({ type: 'arrows', arrows: settings.arrows ? arrows : [] });
}

// Status messages are kept as keys so they can be re-translated when the language changes.
let statusKey = 'waiting';
let statusOff = false;
function setStatus(key, off = false) {
  statusKey = key;
  statusOff = off;
  $('status').textContent = key ? t(key) : '';
  $('status').classList.toggle('off', off);
}

// Translate the fixed labels in panel.html.
function applyLang() {
  setLang(resolveLang(settings.lang, navigator.language));
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  setStatus(statusKey, statusOff);
}

function fill(list, items, render) {
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    render(li, item);
    return li;
  }));
}

// When the board shows no last-move highlight, work out who moved by comparing
// with the previous position: the squares that gained a piece hold the mover's pieces.
let previousBoard = null;
function inferTurnFromChange(placement) {
  const expand = (p) => p.split('/').map((r) => r.replace(/\d/g, (n) => '.'.repeat(+n))).join('');
  const prev = previousBoard && expand(previousBoard);
  const cur = expand(placement);
  if (!prev || prev === cur) return null;
  const movers = new Set();
  for (let i = 0; i < 64; i++) {
    if (cur[i] !== '.' && cur[i] !== prev[i]) movers.add(cur[i] === cur[i].toUpperCase() ? 'w' : 'b');
  }
  return movers.size === 1 ? (movers.has('w') ? 'b' : 'w') : null;
}

// Apply the side-to-move setting and make sure chess.js accepts the position.
function resolveFen(pos) {
  const parts = pos.fen.split(' ');
  const candidates = [];
  if (settings.turn !== 'auto') {
    candidates.push([settings.turn, null]);
  } else {
    let turn = parts[1];
    let note = null;
    if (!pos.turnKnown) {
      turn = pos.inferredTurn || 'w';
      if (!pos.inferredTurn) note = 'assumeWhite';
    }
    candidates.push([turn, note]);
    candidates.push([turn === 'w' ? 'b' : 'w', null]);
  }
  for (const [turn, note] of candidates) {
    const p = [...parts];
    if (turn !== parts[1]) p[3] = '-';
    p[1] = turn;
    const fen = p.join(' ');
    if (!validateFen(fen).ok) continue;
    try {
      new Chess(fen);
      return { fen, note };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function renderEval(evalInfo, turn) {
  $('evaltext').textContent = evalInfo.text;
  $('verdict').textContent = evalInfo.verdict;
  const white = Math.max(-1000, Math.min(1000, evalInfo.white));
  // Map the white-perspective score onto the bar with a soft curve.
  const pct = 50 + 50 * (2 / (1 + Math.exp(-white / 250)) - 1);
  $('evalfill').style.height = `${pct}%`;
  $('bestlabel').textContent = t('bestLabel', { side: colorName(turn) });
}

function renderPreview(fen, lines, depth) {
  const best = lines[0];
  const move = playLine(fen, best.pv.slice(0, 1)).moves[0];
  if (!move) return;
  $('analysis').hidden = false;
  renderEval(formatEval(best.score, move.color), move.color);
  $('bestmove').textContent = move.san;
  $('depth').textContent = t('thinking', { d: depth });
  setArrows([{ from: move.from, to: move.to, color: 'best' }]);
}

function renderExplanation(ex, depth) {
  $('analysis').hidden = false;
  renderEval(ex.eval, ex.turn);
  $('bestmove').textContent = ex.bestSan;
  $('depth').textContent = t('depthN', { d: depth });

  $('warnbox').hidden = !ex.warnings.length;
  fill($('warnings'), ex.warnings, (li, w) => { li.textContent = w; });
  fill($('reasons'), ex.reasons, (li, r) => { li.textContent = r; });

  $('line').replaceChildren(...ex.line.map((m) => {
    const span = document.createElement('span');
    span.textContent = m.san;
    if (m.mine) span.className = 'mine';
    return span;
  }));

  $('altbox').hidden = !ex.alternatives.length;
  fill($('alts'), ex.alternatives, (li, a) => {
    const name = document.createElement('span');
    name.textContent = a.san;
    const ev = document.createElement('span');
    ev.className = 'muted';
    ev.textContent = a.gap <= 25 ? t('justAsGood', { e: a.eval.text }) : t('worseBy', { e: a.eval.text, x: (a.gap / 100).toFixed(1) });
    if (a.gap >= 50000) ev.textContent = t('missesMate', { e: a.eval.text });
    li.append(name, ev);
  });

  const arrows = [{ from: ex.from, to: ex.to, color: 'best' }];
  if (ex.threat) arrows.push({ from: ex.threat.from, to: ex.threat.to, color: 'threat' });
  setArrows(arrows);
}

async function analyze(pos) {
  const gen = ++generation;
  const resolved = resolveFen(pos);
  if (!resolved) {
    engine.cancel();
    $('analysis').hidden = true;
    setStatus('illegal');
    setArrows([]);
    return;
  }
  const { fen, note } = resolved;
  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    engine.cancel();
    $('analysis').hidden = true;
    setStatus(chess.isCheckmate() ? 'gameOverMate' : 'gameOverDraw');
    setArrows([]);
    return;
  }
  setStatus(note || '');

  const depth = settings.depth;
  const lines = await engine.analyze(fen, {
    depth,
    multipv: 3,
    movetime: depth * 400,
    onUpdate: (ls, d) => { if (gen === generation) renderPreview(fen, ls, d); },
  });
  if (gen !== generation || !lines?.length) return;

  // Ask "what would they play if it were their move?" to find the opponent's threat.
  let threat = null;
  const nullFen = nullMoveFen(fen);
  if (nullFen) {
    const tLines = await engine.analyze(nullFen, { depth: Math.min(depth, 14), multipv: 1, movetime: 1500 });
    if (gen !== generation) return;
    if (tLines?.length) threat = { fen: nullFen, line: tLines[0] };
  }

  const ex = explain(fen, lines, threat);
  if (ex) renderExplanation(ex, lines[0].depth);
}

function paused(reason) {
  generation++;
  engine.cancel();
  $('analysis').hidden = true;
  setArrows([]);
  if (reason === 'live') {
    setStatus('liveOff', true);
  } else {
    setStatus('waiting');
  }
}

window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !/^https:\/\/([a-z0-9-]+\.)*chess\.com$/.test(e.origin)) return;
  const msg = e.data;
  if (!msg || msg.source !== 'chess-coach-content') return;
  parentOrigin = e.origin;
  if (msg.type === 'position') {
    const placement = msg.fen.split(' ')[0];
    if (lastPosition && lastPosition.fen.split(' ')[0] !== placement) {
      // A move was made: a manual side-to-move choice no longer applies.
      settings.turn = 'auto';
      syncControls();
    }
    if (!msg.turnKnown) {
      const samePosition = lastPosition && lastPosition.fen.split(' ')[0] === placement;
      msg.inferredTurn = samePosition ? lastPosition.inferredTurn : inferTurnFromChange(placement);
    }
    previousBoard = placement;
    lastPosition = msg;
    analyze(msg);
  } else if (msg.type === 'paused') {
    lastPosition = null;
    paused(msg.reason);
  }
});

// --- settings ---
function syncControls() {
  for (const b of $('turnseg').children) b.classList.toggle('on', b.dataset.turn === settings.turn);
  for (const b of $('depthseg').children) b.classList.toggle('on', +b.dataset.depth === settings.depth);
  for (const b of $('langseg').children) b.classList.toggle('on', b.dataset.lang === settings.lang);
  $('arrows').checked = settings.arrows;
}

function changed() {
  syncControls();
  try { chrome.storage.local.set({ coachSettings: settings }); } catch { /* storage is optional */ }
  if (lastPosition) analyze(lastPosition);
  else setArrows([]);
}

$('turnseg').addEventListener('click', (e) => {
  if (!e.target.dataset.turn) return;
  settings.turn = e.target.dataset.turn;
  changed();
});
$('depthseg').addEventListener('click', (e) => {
  if (!e.target.dataset.depth) return;
  settings.depth = +e.target.dataset.depth;
  changed();
});
$('langseg').addEventListener('click', (e) => {
  if (!e.target.dataset.lang) return;
  settings.lang = e.target.dataset.lang;
  applyLang();
  changed();
});
$('arrows').addEventListener('change', (e) => {
  settings.arrows = e.target.checked;
  changed();
});

// The toolbar popup can change the language while the panel is open.
chrome.storage.onChanged.addListener((changes, area) => {
  const lang = area === 'local' && changes.coachSettings?.newValue?.lang;
  if (!lang || lang === settings.lang) return;
  settings.lang = lang;
  applyLang();
  syncControls();
  if (lastPosition) analyze(lastPosition);
});

chrome.storage.local.get('coachSettings').then((r) => {
  // The side-to-move override is per position, so it always starts on Auto.
  if (r.coachSettings) Object.assign(settings, r.coachSettings, { turn: 'auto' });
}).catch(() => {}).finally(() => {
  applyLang();
  syncControls();
  window.parent.postMessage({ source: 'chess-coach-panel', type: 'ready' }, '*');
});
