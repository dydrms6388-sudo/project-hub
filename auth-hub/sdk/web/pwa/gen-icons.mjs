#!/usr/bin/env node
// gen-icons.mjs — 의존성 없는 PWA 아이콘 PNG 생성기(Node 내장 zlib만 사용).
// 브랜드 색 라운드 사각형 + 중앙 원 글리프의 단색 아이콘을 192/512/maskable 로 출력.
// 사용: node gen-icons.mjs "#7C3AED" ./public
//   인자1: 배경 hex(기본 #7C3AED), 인자2: 출력 디렉터리(기본 ./public)
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const bg = process.argv[2] || "#7C3AED";
const outDir = resolve(process.argv[3] || "./public");
mkdirSync(outDir, { recursive: true });

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [124, 58, 237];
}
const lighten = ([r, g, b], f) => [
  Math.round(r + (255 - r) * f),
  Math.round(g + (255 - g) * f),
  Math.round(b + (255 - b) * f),
];

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(CRC(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePng(size, { maskable = false } = {}) {
  const [br, bgc, bb] = hexToRgb(bg);
  const glyph = lighten([br, bgc, bb], 0.85);
  const radius = maskable ? size : size * 0.22; // maskable=꽉 채움, 일반=라운드
  const cx = size / 2, cy = size / 2, gr = size * (maskable ? 0.3 : 0.34);

  // RGBA 픽셀, 각 행 앞 필터바이트(0)
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const inRounded = (x, y) => {
    // 모서리 라운딩(maskable이면 전체 채움)
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = y * stride + 1 + x * 4;
      const inBg = inRounded(x, y);
      const inGlyph = (x - cx) ** 2 + (y - cy) ** 2 <= gr * gr;
      if (!inBg) {
        raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0; // 투명
      } else if (inGlyph) {
        raw[o] = glyph[0]; raw[o + 1] = glyph[1]; raw[o + 2] = glyph[2]; raw[o + 3] = 255;
      } else {
        raw[o] = br; raw[o + 1] = bgc; raw[o + 2] = bb; raw[o + 3] = 255;
      }
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const files = [
  ["icon-192.png", makePng(192)],
  ["icon-512.png", makePng(512)],
  ["icon-maskable-512.png", makePng(512, { maskable: true })],
  ["apple-touch-icon.png", makePng(180, { maskable: true })],
];
for (const [name, buf] of files) {
  writeFileSync(resolve(outDir, name), buf);
  console.log("wrote", name, buf.length, "bytes");
}
