// Builds the unpacked extension into ./extension (load it via chrome://extensions → Load unpacked).
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const out = 'extension';
const sf = 'node_modules/stockfish';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/engine`, { recursive: true });

await esbuild.build({
  entryPoints: { content: 'src/content.js', panel: 'src/panel.js', popup: 'src/popup.js' },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir: out,
  logLevel: 'info',
});

fs.cpSync('static', out, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  fs.copyFileSync(`${sf}/bin/${f}`, `${out}/engine/${f}`);
}
fs.copyFileSync(`${sf}/Copying.txt`, `${out}/engine/LICENSE-stockfish.txt`);
console.log(`Built ${out}/`);
