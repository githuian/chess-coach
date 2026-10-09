// Draws the extension icon (white pawn on a green rounded square) into static/icons/.
// Pure Node, no image libraries: shapes are tested per sub-pixel and written as PNG.
// Run with: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const BG = [47, 125, 79]; // same green as the best-move arrow
const FG = [255, 255, 255];
const SS = 4; // supersampling per axis

const roundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

// Pawn in unit coordinates of the artwork square.
function inPawn(x, y) {
  y -= 0.03; // centre it vertically
  if ((x - 0.5) ** 2 + (y - 0.27) ** 2 <= 0.12 ** 2) return true; // head
  if (((x - 0.5) / 0.16) ** 2 + ((y - 0.42) / 0.05) ** 2 <= 1) return true; // collar
  if (y >= 0.42 && y <= 0.72) { // body, flaring towards the base
    const t = (y - 0.42) / 0.3;
    if (Math.abs(x - 0.5) <= 0.07 + 0.14 * t ** 1.6) return true;
  }
  return roundRect(x, y, 0.24, 0.7, 0.76, 0.8, 0.035); // base
}

function render(size) {
  // The store asks for 96x96 artwork with 16px transparent padding at 128px.
  const pad = size >= 48 ? 0.125 : 0;
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxl + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          if (!roundRect(x, y, pad, pad, 1 - pad, 1 - pad, 0.2 * (1 - 2 * pad))) continue;
          const u = (x - pad) / (1 - 2 * pad);
          const v = (y - pad) / (1 - 2 * pad);
          if (inPawn(u, v)) fg++; else bg++;
        }
      }
      const cover = bg + fg;
      const i = (py * size + pxl) * 4;
      if (!cover) continue;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round((BG[c] * bg + FG[c] * fg) / cover);
      px[i + 3] = Math.round((255 * cover) / (SS * SS));
    }
  }
  return encodePng(size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync('static/icons', { recursive: true });
for (const s of SIZES) fs.writeFileSync(`static/icons/icon${s}.png`, render(s));
console.log(`Wrote static/icons/icon{${SIZES.join(',')}}.png`);
