// Generates the PWA icons (no image libraries needed): a pink rounded tile with a white envelope.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (size, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

// coverage of a rounded rect at (px,py) in unit coordinates
const inRRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r),
    cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const distToSeg = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
};

function icon(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3;
  const s = maskable ? 0.74 : 1; // maskable icons keep the art inside the safe zone
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size,
            v = (y + (sy + 0.5) / SS) / size;
          let px = [0, 0, 0, 0];
          const tile = maskable ? true : inRRect(u, v, 0, 0, 1, 1, 0.22);
          if (tile) {
            const k = (u + v) / 2;
            px = [Math.round(209 + (240 - 209) * k * 0.6), Math.round(36 + (90 - 36) * k * 0.6), Math.round(94 + (140 - 94) * k * 0.6), 255];
            // envelope, centred, scaled by s
            const ex = (u - 0.5) / s + 0.5,
              ey = (v - 0.5) / s + 0.5;
            if (inRRect(ex, ey, 0.2, 0.3, 0.8, 0.7, 0.05)) {
              px = [255, 255, 255, 255];
              const d = Math.min(distToSeg(ex, ey, 0.2, 0.32, 0.5, 0.54), distToSeg(ex, ey, 0.8, 0.32, 0.5, 0.54));
              if (d < 0.012) px = [209, 36, 94, 255];
            }
          }
          r += px[0] * px[3];
          g += px[1] * px[3];
          b += px[2] * px[3];
          a += px[3];
        }
      const i = (y * size + x) * 4;
      if (a > 0) {
        buf[i] = r / a;
        buf[i + 1] = g / a;
        buf[i + 2] = b / a;
      }
      buf[i + 3] = a / (SS * SS);
    }
  return png(size, buf);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", icon(192, { maskable: false }));
writeFileSync("public/icons/icon-512.png", icon(512, { maskable: false }));
writeFileSync("public/icons/maskable-512.png", icon(512, { maskable: true }));
writeFileSync("public/icons/apple-touch-icon.png", icon(180, { maskable: true }));
console.log("icons written");
