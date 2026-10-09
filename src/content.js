// Runs on chess.com: reads the board, hosts the coach panel and draws arrows.
import { buildFen, isAllowedPath, pieceFromClass, squareFromClass } from './board.js';

const PANEL_URL = chrome.runtime.getURL('panel.html');
const EXT_ORIGIN = new URL(PANEL_URL).origin;
const SVG_NS = 'http://www.w3.org/2000/svg';

let ui = null;
let lastSent = '';
let arrows = [];

function findBoard() {
  return document.querySelector('wc-chess-board') || document.querySelector('chess-board');
}

function readBoard(board) {
  const pieces = [];
  for (const el of board.querySelectorAll('.piece')) {
    // A piece being dragged is in limbo; wait until it lands.
    if (el.classList.contains('dragging')) return null;
    const code = pieceFromClass(el.className);
    const square = squareFromClass(el.className);
    if (code && square) pieces.push({ code, square });
  }
  if (!pieces.length) return null;
  const highlights = [...board.querySelectorAll('.highlight')]
    .map((el) => squareFromClass(el.className))
    .filter(Boolean);
  return { ...buildFen(pieces, highlights), flipped: board.classList.contains('flipped') };
}

function post(msg) {
  ui?.iframe.contentWindow?.postMessage({ source: 'chess-coach-content', ...msg }, EXT_ORIGIN);
}

// --- panel ---
function createUI() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:80px;right:16px;z-index:2147483646;width:340px;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .frame { background:#262421; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.45); overflow:hidden; border:1px solid #45413c; }
      .bar { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:#1f1d1b; color:#ece9e4;
             font:600 13px system-ui, sans-serif; cursor:move; user-select:none; }
      .bar button { background:none; border:0; color:#a8a49e; font-size:16px; cursor:pointer; padding:0 4px; }
      iframe { display:block; width:100%; height:600px; border:0; }
      .min iframe { display:none; }
    </style>
    <div class="frame">
      <div class="bar"><span>♞ ${chrome.i18n.getMessage("extName") || "Chess Coach"}</span><button title="${chrome.i18n.getMessage("minimize") || "Minimize"}">–</button></div>
      <iframe src="${PANEL_URL}" allow=""></iframe>
    </div>`;
  const frame = shadow.querySelector('.frame');
  const bar = shadow.querySelector('.bar');
  const iframe = shadow.querySelector('iframe');
  const minBtn = shadow.querySelector('button');

  minBtn.addEventListener('click', () => {
    frame.classList.toggle('min');
    minBtn.textContent = frame.classList.contains('min') ? '+' : '–';
    save();
  });

  // Drag by the title bar. The iframe would swallow mouse events, so mute it while dragging.
  bar.addEventListener('mousedown', (e) => {
    if (e.target === minBtn) return;
    const r = host.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    iframe.style.pointerEvents = 'none';
    const move = (ev) => {
      host.style.left = `${Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx))}px`;
      host.style.top = `${Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy))}px`;
      host.style.right = 'auto';
    };
    const up = () => {
      iframe.style.pointerEvents = '';
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', up);
      save();
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    e.preventDefault();
  });

  function save() {
    const pos = { left: host.style.left, top: host.style.top, min: frame.classList.contains('min') };
    try { chrome.storage.local.set({ coachPanel: pos }); } catch { /* extension was reloaded */ }
  }
  chrome.storage.local.get('coachPanel').then(({ coachPanel: p }) => {
    if (!p) return;
    if (p.left) Object.assign(host.style, { left: p.left, top: p.top, right: 'auto' });
    if (p.min) { frame.classList.add('min'); minBtn.textContent = '+'; }
  }).catch(() => {});

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;display:none;';
  svg.innerHTML = `<defs>
    <marker id="cc-best" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="rgba(129,182,76,.9)"/></marker>
    <marker id="cc-threat" markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="rgba(229,88,79,.85)"/></marker>
  </defs><g></g>`;

  document.documentElement.append(host, svg);
  return { host, iframe, svg };
}

window.addEventListener('message', (e) => {
  if (!ui || e.origin !== EXT_ORIGIN || e.source !== ui.iframe.contentWindow) return;
  const msg = e.data;
  if (msg?.source !== 'chess-coach-panel') return;
  if (msg.type === 'ready') lastSent = '';
  if (msg.type === 'arrows') {
    arrows = Array.isArray(msg.arrows) ? msg.arrows : [];
    drawArrows();
  }
});

// --- arrows ---
function squareCenter(sq, flipped) {
  const f = sq.charCodeAt(0) - 97;
  const r = +sq[1] - 1;
  return flipped ? [7 - f + 0.5, r + 0.5] : [f + 0.5, 7 - r + 0.5];
}

function drawArrows() {
  if (!ui) return;
  const board = findBoard();
  const g = ui.svg.querySelector('g');
  g.replaceChildren();
  if (!board || !arrows.length) {
    ui.svg.style.display = 'none';
    return;
  }
  const flipped = board.classList.contains('flipped');
  for (const a of arrows) {
    if (!/^[a-h][1-8]$/.test(a.from) || !/^[a-h][1-8]$/.test(a.to)) continue;
    const [x1, y1] = squareCenter(a.from, flipped);
    const [x2, y2] = squareCenter(a.to, flipped);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const shorten = 0.45 / len; // stop before the centre so the arrowhead sits inside the target square
    const line = document.createElementNS(SVG_NS, 'line');
    const threat = a.color === 'threat';
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2 - (x2 - x1) * shorten);
    line.setAttribute('y2', y2 - (y2 - y1) * shorten);
    line.setAttribute('stroke', threat ? 'rgba(229,88,79,.85)' : 'rgba(129,182,76,.9)');
    line.setAttribute('stroke-width', threat ? '0.13' : '0.18');
    line.setAttribute('stroke-linecap', 'round');
    if (threat) line.setAttribute('stroke-dasharray', '0.25 0.15');
    line.setAttribute('marker-end', `url(#${threat ? 'cc-threat' : 'cc-best'})`);
    g.append(line);
  }
  positionArrows(board);
}

function positionArrows(board) {
  if (!ui || !arrows.length) return;
  const r = board.getBoundingClientRect();
  Object.assign(ui.svg.style, {
    display: r.width ? 'block' : 'none',
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
  });
}

// --- main loop ---
function tick() {
  const board = findBoard();
  if (!board) {
    if (ui && lastSent !== 'noboard') {
      lastSent = 'noboard';
      post({ type: 'paused', reason: 'noboard' });
    }
    return;
  }
  if (!ui) ui = createUI();

  if (!isAllowedPath(location.pathname)) {
    if (lastSent !== 'live') {
      lastSent = 'live';
      arrows = [];
      drawArrows();
      post({ type: 'paused', reason: 'live' });
    }
    return;
  }

  const pos = readBoard(board);
  if (pos) {
    const key = `${pos.fen}|${pos.flipped}`;
    if (key !== lastSent) {
      lastSent = key;
      post({ type: 'position', ...pos });
      arrows = []; // old arrows belong to the previous position
      drawArrows();
    }
  }
  positionArrows(board);
}

setInterval(tick, 350);
tick();
