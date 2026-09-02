import { Shape } from "./shapes";
import { hslToRgb } from "../core/prng";

type P = Record<string, number>;
type Geo = (p: P, w: number, h: number) => Shape[];
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: P) => void;

const TAU = Math.PI * 2;
const css = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r},${g},${b})`;
};

/* ── 카오스 ── */

export const lorenzDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const { sigma, rho, beta } = p;
  const dt = 0.004;
  let x = 0.1, y = 0, z = 0;
  const f = (x: number, y: number, z: number): [number, number, number] => [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ];
  const proj = Math.round(p.projection);
  const steps = Math.round(p.steps);
  const S = Math.min(w, h) / (rho * 2.2);
  ctx.lineWidth = 0.7;
  let px0 = 0, py0 = 0, started = false;
  for (let i = 0; i < steps; i++) {
    // RK4
    const k1 = f(x, y, z);
    const k2 = f(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2]);
    const k3 = f(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2]);
    const k4 = f(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    const u = proj === 0 ? x : proj === 1 ? x : y;
    const v = proj === 0 ? z : proj === 1 ? y : z;
    const px = w / 2 + u * S;
    const py = proj === 0 ? h * 0.95 - v * S : h / 2 - v * S;
    if (i < 100) continue;
    if (started) {
      ctx.strokeStyle = css(200 + (z / rho) * 120, 0.8, 0.55);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px0, py0);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    px0 = px;
    py0 = py;
    started = true;
  }
  ctx.globalAlpha = 1;
};

export const gumowskiMiraDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const mu = p.mu;
  const a = p.alpha;
  const f = (x: number) => mu * x + (2 * (1 - mu) * x * x) / (1 + x * x);
  let x = p.startX;
  let y = p.startX * 0.5;
  const n = Math.round(p.points);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  // 1차 통과: 범위 추정
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let tx = x, ty = y;
  for (let i = 0; i < 4000; i++) {
    const nx = ty + a * (1 - 0.05 * ty * ty) * ty + f(tx);
    const ny = -tx + f(nx);
    tx = nx;
    ty = ny;
    if (i < 50 || !Number.isFinite(tx) || Math.abs(tx) > 1e4) continue;
    if (tx < minX) minX = tx;
    if (tx > maxX) maxX = tx;
    if (ty < minY) minY = ty;
    if (ty > maxY) maxY = ty;
  }
  if (!Number.isFinite(minX) || maxX - minX < 1e-6) {
    minX = -20; maxX = 20; minY = -20; maxY = 20;
  }
  const S = Math.min((w * 0.9) / (maxX - minX), (h * 0.9) / (maxY - minY));
  const ox = w / 2 - ((minX + maxX) / 2) * S;
  const oy = h / 2 - ((minY + maxY) / 2) * S;
  for (let i = 0; i < n; i++) {
    const nx = y + a * (1 - 0.05 * y * y) * y + f(x);
    const ny = -x + f(nx);
    x = nx;
    y = ny;
    if (i < 50 || !Number.isFinite(x) || Math.abs(x) > 1e4) continue;
    const px = Math.round(x * S + ox);
    const py = Math.round(y * S + oy);
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    const idx = (py * w + px) * 4;
    const [r, g, b] = hslToRgb(160 + (i / n) * 140, 0.7, 0.6);
    data[idx] = Math.max(data[idx], r);
    data[idx + 1] = Math.max(data[idx + 1], g);
    data[idx + 2] = Math.max(data[idx + 2], b);
    data[idx + 3] = Math.min(255, data[idx + 3] + 90);
  }
  ctx.putImageData(img, 0, 0);
};

export const logisticDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const rMin = Math.min(p.rMin, p.rMax - 0.01);
  const rMax = p.rMax;
  const transient = Math.round(p.transient);
  const iters = Math.round(p.iterations);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let col = 0; col < w; col++) {
    const r = rMin + ((rMax - rMin) * col) / w;
    let x = 0.5;
    for (let i = 0; i < transient; i++) x = r * x * (1 - x);
    for (let i = 0; i < iters; i++) {
      x = r * x * (1 - x);
      const py = Math.round(h - x * h);
      if (py < 0 || py >= h) continue;
      const idx = (py * w + col) * 4;
      data[idx] = Math.min(255, data[idx] + 70);
      data[idx + 1] = Math.min(255, data[idx + 1] + 100);
      data[idx + 2] = Math.min(255, data[idx + 2] + 140);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // r 축 라벨선
  ctx.strokeStyle = "rgba(148,163,184,0.4)";
  ctx.setLineDash([4, 4]);
  const marks = [3, 3.449, 3.5699];
  for (const m of marks) {
    if (m < rMin || m > rMax) continue;
    const x = ((m - rMin) / (rMax - rMin)) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

/* ── 오토마타(경량) ── */

export const elementaryCaDraw: Draw = (ctx, w, h, p) => {
  const width = Math.round(p.width);
  const rule = Math.round(p.rule);
  const rows = Math.floor((h / w) * width);
  const cellW = w / width;
  const cellH = h / rows;
  let row = new Uint8Array(width);
  const rand = (() => {
    let a = Math.round(p.seed) >>> 0;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  if (Math.round(p.seedMode) === 0) row[Math.floor(width / 2)] = 1;
  else {
    const density = p.density / 100;
    for (let i = 0; i < width; i++) row[i] = rand() < density ? 1 : 0;
  }
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1e293b";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      if (row[x]) ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
    const next = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      const l = row[(x - 1 + width) % width];
      const c = row[x];
      const r = row[(x + 1) % width];
      next[x] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
    }
    row = next;
  }
};

/* ── 수론 ── */

export const pascalDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const rows = Math.round(p.rows);
  const m = Math.round(p.modulus);
  const multi = Math.round(p.colorMode) === 1;
  const cell = Math.min(w / rows, h / rows);
  const oy = (h - rows * cell) / 2;
  let row = new Int32Array([1]);
  for (let r = 0; r < rows; r++) {
    const ox = w / 2 - ((r + 1) * cell) / 2;
    for (let c = 0; c <= r; c++) {
      const v = row[c] % m;
      if (v === 0) continue;
      if (multi) {
        ctx.fillStyle = css((v * 360) / m, 0.7, 0.55);
      } else {
        ctx.fillStyle = "#fbbf24";
      }
      ctx.fillRect(ox + c * cell, oy + r * cell, Math.max(1, cell - 0.2), Math.max(1, cell - 0.2));
    }
    const next = new Int32Array(r + 2);
    next[0] = 1;
    next[r + 1] = 1;
    for (let c = 1; c <= r; c++) next[c] = (row[c - 1] + row[c]) % m;
    row = next;
  }
};

export const timesTableGeo: Geo = (p, w, h) => {
  const n = Math.round(p.modulus);
  const k = p.multiplier;
  const R = Math.min(w, h) * 0.46;
  const cx = w / 2;
  const cy = h / 2;
  const shapes: Shape[] = [{ kind: "circle", cx, cy, r: R, stroke: "#334155", width: 1 }];
  const alpha = p.opacity / 100;
  const hueOn = Math.round(p.hueByAngle) === 1;
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * TAU - Math.PI / 2;
    const j = (i * k) % n;
    const a2 = (j / n) * TAU - Math.PI / 2;
    shapes.push({
      kind: "poly",
      pts: [
        [cx + R * Math.cos(a1), cy + R * Math.sin(a1)],
        [cx + R * Math.cos(a2), cy + R * Math.sin(a2)],
      ],
      stroke: hueOn ? css(((i / n) * 360 + 180) % 360, 0.7, 0.6) : "#7dd3fc",
      width: 0.7,
      alpha,
    });
  }
  return shapes;
};

export const collatzGeo: Geo = (p, w, h) => {
  const count = Math.round(p.sequences);
  const evenA = (p.evenAngle * Math.PI) / 180;
  const oddA = (p.oddAngle * Math.PI) / 180;
  const L = p.segmentLength;
  const shapes: Shape[] = [];
  for (let s = 2; s < 2 + count; s++) {
    // 수열을 1까지 계산한 뒤 역방향으로 그린다
    const seq: number[] = [];
    let n = s;
    let guard = 0;
    while (n !== 1 && guard++ < 600) {
      seq.push(n);
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    }
    seq.push(1);
    seq.reverse();
    let x = w / 2;
    let y = h * 0.96;
    let dir = -Math.PI / 2;
    const pts: [number, number][] = [[x, y]];
    for (const v of seq) {
      dir += v % 2 === 0 ? evenA : oddA;
      x += L * Math.cos(dir);
      y += L * Math.sin(dir);
      pts.push([x, y]);
    }
    shapes.push({
      kind: "poly",
      pts,
      stroke: css(90 + (s % 60), 0.5, 0.55),
      width: 1,
      alpha: 0.16,
    });
  }
  return shapes;
};
