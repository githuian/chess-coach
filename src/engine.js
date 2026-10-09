// Thin UCI wrapper around the Stockfish web worker. One search at a time:
// starting a new search stops the current one, and the stopped search resolves to null.

export function parseInfo(line) {
  const t = line.trim().split(/\s+/);
  if (t[0] !== 'info') return null;
  const si = t.indexOf('score');
  const pvi = t.indexOf('pv');
  if (si < 0 || pvi < 0) return null;
  if (t[si + 3] === 'lowerbound' || t[si + 3] === 'upperbound') return null;
  const get = (k) => {
    const i = t.indexOf(k);
    return i >= 0 ? t[i + 1] : undefined;
  };
  return {
    depth: +get('depth'),
    multipv: +(get('multipv') || 1),
    score: { type: t[si + 1], value: +t[si + 2] },
    pv: t.slice(pvi + 1),
  };
}

export class Engine {
  constructor(workerUrl) {
    this.worker = new Worker(workerUrl);
    this.worker.onmessage = (e) => this.onLine(String(e.data));
    this.job = null;
    this.next = null;
    this.send('uci');
    this.send('setoption name Hash value 32');
    this.send('isready');
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  analyze(fen, { depth = 18, multipv = 1, movetime = 5000, onUpdate } = {}) {
    return new Promise((resolve) => {
      const job = { fen, depth, multipv, movetime, onUpdate, resolve, lines: [] };
      if (!this.job) return this.start(job);
      if (this.next) this.next.resolve(null);
      this.next = job;
      this.stopCurrent();
    });
  }

  cancel() {
    if (this.next) {
      this.next.resolve(null);
      this.next = null;
    }
    if (this.job) this.stopCurrent();
  }

  stopCurrent() {
    if (this.job.stopping) return;
    this.job.stopping = true;
    this.send('stop');
  }

  start(job) {
    this.job = job;
    this.send(`setoption name MultiPV value ${job.multipv}`);
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${job.depth} movetime ${job.movetime}`);
  }

  onLine(line) {
    const job = this.job;
    if (!job) return;
    if (line.startsWith('info')) {
      const info = parseInfo(line);
      if (!info || job.stopping) return;
      job.lines[info.multipv - 1] = info;
      if (info.multipv === 1) job.onUpdate?.(job.lines.filter(Boolean), info.depth);
    } else if (line.startsWith('bestmove')) {
      this.job = null;
      job.resolve(job.stopping ? null : job.lines.filter(Boolean));
      if (this.next) {
        const n = this.next;
        this.next = null;
        this.start(n);
      }
    }
  }
}
