/**
 * renderCost '고' 8종의 순수 계산 코어.
 * DOM 의존이 없어 (1) Web Worker, (2) 빌드 타임 OG 이미지 생성(Node)에서 공용한다.
 * 모든 함수는 RGBA Uint8ClampedArray(w*h*4)를 반환한다.
 */
import { mulberry32, hslToRgb } from "./prng";

export type P = Record<string, number>;

function buf(w: number, h: number, fill = 255): Uint8ClampedArray {
  const b = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < b.length; i += 4) b[i] = fill;
  return b;
}

function put(b: Uint8ClampedArray, i: number, r: number, g: number, bl: number) {
  b[i] = r;
  b[i + 1] = g;
  b[i + 2] = bl;
  b[i + 3] = 255;
}

/* ── 탈출시간 팔레트 ── */
function escapeColor(t: number): [number, number, number] {
  // t: 0~1 정규화된 매끄러운 반복값
  const h = 240 - t * 280;
  const l = 0.12 + 0.55 * Math.pow(t, 0.7);
  return hslToRgb(h, 0.85, Math.min(0.72, l));
}

export function mandelbrot(p: P, w: number, h: number): Uint8ClampedArray {
  const b = buf(w, h);
  const scale = 3.0 / Math.pow(2, p.zoom) / h;
  const maxIter = Math.round(p.maxIter);
  const variant = Math.round(p.variant);
  for (let py = 0; py < h; py++) {
    const ci = p.centerY + (py - h / 2) * scale;
    for (let px = 0; px < w; px++) {
      const cr = p.centerX + (px - w / 2) * scale;
      let zr = 0;
      let zi = 0;
      let i = 0;
      while (i < maxIter && zr * zr + zi * zi < 16) {
        let xr = zr;
        let xi = zi;
        if (variant === 1) xi = -xi; // 트라이콘: 켤레
        if (variant === 2) {
          xr = Math.abs(xr); // 버닝쉽: 절댓값
          xi = Math.abs(xi);
        }
        const nr = xr * xr - xi * xi + cr;
        zi = 2 * xr * xi + ci;
        zr = nr;
        i++;
      }
      const idx = (py * w + px) * 4;
      if (i >= maxIter) put(b, idx, 8, 10, 22);
      else {
        const mag = Math.sqrt(zr * zr + zi * zi);
        const smooth = i + 1 - Math.log2(Math.max(1e-9, Math.log(Math.max(1.000001, mag))));
        const [r, g, bl] = escapeColor(Math.min(1, smooth / maxIter * 4));
        put(b, idx, r, g, bl);
      }
    }
  }
  return b;
}

export function julia(p: P, w: number, h: number): Uint8ClampedArray {
  const b = buf(w, h);
  const scale = 3.2 / Math.pow(2, p.zoom) / h;
  const maxIter = Math.round(p.maxIter);
  for (let py = 0; py < h; py++) {
    const y0 = (py - h / 2) * scale;
    for (let px = 0; px < w; px++) {
      let zr = (px - w / 2) * scale;
      let zi = y0;
      let i = 0;
      while (i < maxIter && zr * zr + zi * zi < 16) {
        const nr = zr * zr - zi * zi + p.cRe;
        zi = 2 * zr * zi + p.cIm;
        zr = nr;
        i++;
      }
      const idx = (py * w + px) * 4;
      if (i >= maxIter) put(b, idx, 8, 10, 22);
      else {
        const mag = Math.sqrt(zr * zr + zi * zi);
        const smooth = i + 1 - Math.log2(Math.max(1e-9, Math.log(Math.max(1.000001, mag))));
        const [r, g, bl] = escapeColor(Math.min(1, smooth / maxIter * 4));
        put(b, idx, r, g, bl);
      }
    }
  }
  return b;
}

export function newtonFractal(p: P, w: number, h: number): Uint8ClampedArray {
  const b = buf(w, h);
  const k = Math.round(p.degree);
  const a = p.relax;
  const maxIter = Math.round(p.maxIter);
  const scale = 3.4 / Math.pow(2, p.zoom) / h;
  const roots: [number, number][] = Array.from({ length: k }, (_, i) => {
    const ang = (i * 2 * Math.PI) / k;
    return [Math.cos(ang), Math.sin(ang)];
  });
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zr = (px - w / 2) * scale;
      let zi = (py - h / 2) * scale;
      if (zr === 0 && zi === 0) zr = 1e-9;
      let iter = 0;
      let root = -1;
      while (iter < maxIter) {
        // z^(k-1) 계산
        let pr = 1, pi = 0;
        for (let m = 0; m < k - 1; m++) {
          const nr = pr * zr - pi * zi;
          pi = pr * zi + pi * zr;
          pr = nr;
        }
        // z^k
        const fkr = pr * zr - pi * zi;
        const fki = pr * zi + pi * zr;
        // f = z^k - 1, f' = k z^(k-1)
        const fr = fkr - 1;
        const fi = fki;
        const dr = k * pr;
        const di = k * pi;
        const den = dr * dr + di * di;
        if (den < 1e-12) break;
        const qr = (fr * dr + fi * di) / den;
        const qi = (fi * dr - fr * di) / den;
        zr -= a * qr;
        zi -= a * qi;
        iter++;
        for (let r = 0; r < k; r++) {
          const dx = zr - roots[r][0];
          const dy = zi - roots[r][1];
          if (dx * dx + dy * dy < 1e-6) {
            root = r;
            iter = Math.min(iter, maxIter);
            break;
          }
        }
        if (root >= 0) break;
      }
      const idx = (py * w + px) * 4;
      if (root < 0) put(b, idx, 10, 10, 16);
      else {
        const shade = Math.max(0.25, 1 - iter / maxIter);
        const [r, g, bl] = hslToRgb((root * 360) / k + 10, 0.7, 0.28 + 0.32 * shade);
        put(b, idx, r, g, bl);
      }
    }
  }
  return b;
}

export function sincosAttractor(p: P, w: number, h: number): Uint8ClampedArray {
  const density = new Float32Array(w * h);
  const variant = Math.round(p.variant);
  const { a, b: bb, c, d } = { a: p.a, b: p.b, c: p.c, d: p.d };
  let x = 0.1, y = 0.1;
  const iters = Math.min(1200000, w * h * 3);
  const sx = w / 4.4;
  const sy = h / 4.4;
  for (let i = 0; i < iters; i++) {
    let nx: number, ny: number;
    if (variant === 0) {
      nx = Math.sin(a * y) - Math.cos(bb * x);
      ny = Math.sin(c * x) - Math.cos(d * y);
    } else if (variant === 1) {
      nx = Math.sin(a * y) + c * Math.cos(a * x);
      ny = Math.sin(bb * x) + d * Math.cos(bb * y);
    } else {
      nx = y - Math.sign(x) * Math.sqrt(Math.abs(bb * x - c));
      ny = a - x;
    }
    x = nx;
    y = ny;
    if (i < 100) continue;
    let px: number, py: number;
    if (variant === 2) {
      px = Math.floor(w / 2 + x * (w / 24));
      py = Math.floor(h / 2 + y * (h / 24));
    } else {
      px = Math.floor(w / 2 + x * sx * 0.98);
      py = Math.floor(h / 2 + y * sy * 0.98);
    }
    if (px >= 0 && px < w && py >= 0 && py < h) density[py * w + px]++;
  }
  let max = 0;
  for (let i = 0; i < density.length; i++) if (density[i] > max) max = density[i];
  const b = buf(w, h, 255);
  for (let i = 0; i < density.length; i++) {
    const idx = i * 4;
    if (density[i] === 0) {
      put(b, idx, 10, 12, 24);
    } else {
      const t = Math.log(1 + density[i]) / Math.log(1 + max);
      const [r, g, bl] = hslToRgb(200 - t * 160, 0.8, 0.15 + t * 0.6);
      put(b, idx, r, g, bl);
    }
  }
  return b;
}

export function langtonsAnt(p: P, w: number, h: number): Uint8ClampedArray {
  const cell = Math.max(1, Math.round(p.cellSize));
  const gw = Math.floor(w / cell);
  const gh = Math.floor(h / cell);
  const RULES = ["RL", "RLR", "LLRR", "LRRRRRLLR", "RRLLLRLLLRRR", "RLLR"];
  const rule = RULES[Math.round(p.rule)] ?? "RL";
  const states = rule.length;
  const grid = new Uint8Array(gw * gh);
  const nAnts = Math.round(p.ants);
  const ants = Array.from({ length: nAnts }, (_, i) => ({
    x: Math.floor(gw / 2) + (i % 2 === 0 ? i * 3 : -i * 3),
    y: Math.floor(gh / 2) + (i > 1 ? (i - 1) * 3 : 0),
    dir: i % 4,
  }));
  const steps = Math.round(p.steps);
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  for (let s = 0; s < steps; s++) {
    for (const ant of ants) {
      const idx = ant.y * gw + ant.x;
      const st = grid[idx];
      ant.dir = (ant.dir + (rule[st] === "R" ? 1 : 3)) % 4;
      grid[idx] = (st + 1) % states;
      ant.x = (ant.x + DX[ant.dir] + gw) % gw;
      ant.y = (ant.y + DY[ant.dir] + gh) % gh;
    }
  }
  const b = buf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const st = grid[Math.min(gh - 1, Math.floor(y / cell)) * gw + Math.min(gw - 1, Math.floor(x / cell))];
      const idx = (y * w + x) * 4;
      if (st === 0) put(b, idx, 248, 250, 252);
      else {
        const [r, g, bl] = hslToRgb(220 + (st * 90) / states, 0.6, 0.25 + (0.4 * st) / states);
        put(b, idx, r, g, bl);
      }
    }
  }
  return b;
}

export function grayScott(p: P, w: number, h: number): Uint8ClampedArray {
  const gw = Math.min(288, w);
  const gh = Math.min(198, h);
  const U = new Float32Array(gw * gh).fill(1);
  const V = new Float32Array(gw * gh);
  const U2 = new Float32Array(gw * gh);
  const V2 = new Float32Array(gw * gh);
  const rand = mulberry32(7);
  const seedPattern = Math.round(p.seedPattern);
  if (seedPattern === 0) {
    for (let y = gh / 2 - 6; y < gh / 2 + 6; y++)
      for (let x = gw / 2 - 6; x < gw / 2 + 6; x++) V[Math.floor(y) * gw + Math.floor(x)] = 1;
  } else if (seedPattern === 1) {
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rand() * gw);
      const y = Math.floor(rand() * gh);
      V[y * gw + x] = 1;
    }
  } else {
    const R = Math.min(gw, gh) / 4;
    for (let a = 0; a < 200; a++) {
      const x = Math.floor(gw / 2 + Math.cos((a / 200) * 2 * Math.PI) * R);
      const y = Math.floor(gh / 2 + Math.sin((a / 200) * 2 * Math.PI) * R);
      V[y * gw + x] = 1;
    }
  }
  const F = p.feed;
  const K = p.kill;
  const Du = 0.21 * p.diffRatio / 2;
  const Dv = 0.105;
  const steps = Math.round(p.iterations);
  let u = U, v = V, un = U2, vn = V2;
  for (let s = 0; s < steps; s++) {
    for (let y = 0; y < gh; y++) {
      const ym = ((y - 1 + gh) % gh) * gw;
      const yp = ((y + 1) % gh) * gw;
      const y0 = y * gw;
      for (let x = 0; x < gw; x++) {
        const xm = (x - 1 + gw) % gw;
        const xp = (x + 1) % gw;
        const i = y0 + x;
        const lu = u[y0 + xm] + u[y0 + xp] + u[ym + x] + u[yp + x] - 4 * u[i];
        const lv = v[y0 + xm] + v[y0 + xp] + v[ym + x] + v[yp + x] - 4 * v[i];
        const uvv = u[i] * v[i] * v[i];
        un[i] = u[i] + Du * lu - uvv + F * (1 - u[i]);
        vn[i] = v[i] + Dv * lv + uvv - (F + K) * v[i];
      }
    }
    [u, un] = [un, u];
    [v, vn] = [vn, v];
  }
  const b = buf(w, h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.floor((y / h) * gh));
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.floor((x / w) * gw));
      const val = Math.max(0, Math.min(1, v[gy * gw + gx] * 2.4));
      const [r, g, bl] = hslToRgb(190 - val * 150, 0.65, 0.92 - val * 0.72);
      put(b, (y * w + x) * 4, r, g, bl);
    }
  }
  return b;
}

export function dla(p: P, w: number, h: number): Uint8ClampedArray {
  const grid = new Int32Array(w * h).fill(-1); // 부착 순서 기록
  const rand = mulberry32(1337);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const seedShape = Math.round(p.seedShape);
  if (seedShape === 0) grid[cy * w + cx] = 0;
  else if (seedShape === 1) for (let x = 0; x < w; x++) grid[(h - 2) * w + x] = 0;
  else {
    const R = Math.min(w, h) / 2 - 4;
    for (let a = 0; a < 720; a++) {
      const x = Math.floor(cx + Math.cos((a / 720) * 2 * Math.PI) * R);
      const y = Math.floor(cy + Math.sin((a / 720) * 2 * Math.PI) * R);
      grid[y * w + x] = 0;
    }
  }
  const stick = p.stickiness / 100;
  const total = Math.round(p.particles);
  let maxR = 6;
  let attached = 0;
  const maxWalk = w * h * 4;
  for (let n = 1; n <= total; n++) {
    // 스폰: 응집체 반경 밖 원
    let x: number, y: number;
    if (seedShape === 1) {
      x = Math.floor(rand() * w);
      y = 2;
    } else if (seedShape === 2) {
      x = cx; y = cy;
      const ang0 = rand() * 2 * Math.PI;
      x = Math.floor(cx + Math.cos(ang0) * 4);
      y = Math.floor(cy + Math.sin(ang0) * 4);
    } else {
      const ang = rand() * 2 * Math.PI;
      const r = Math.min(maxR + 8, Math.min(w, h) / 2 - 2);
      x = Math.floor(cx + Math.cos(ang) * r);
      y = Math.floor(cy + Math.sin(ang) * r);
    }
    let walked = 0;
    while (walked++ < maxWalk) {
      const dir = Math.floor(rand() * 4);
      x += dir === 0 ? 1 : dir === 1 ? -1 : 0;
      y += dir === 2 ? 1 : dir === 3 ? -1 : 0;
      if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) break; // 이탈 → 폐기
      const i = y * w + x;
      if (grid[i] >= 0) { x -= dir === 0 ? 1 : dir === 1 ? -1 : 0; y -= dir === 2 ? 1 : dir === 3 ? -1 : 0; break; }
      const near =
        grid[i - 1] >= 0 || grid[i + 1] >= 0 || grid[i - w] >= 0 || grid[i + w] >= 0;
      if (near && rand() < stick) {
        grid[i] = n;
        attached++;
        const dr = Math.hypot(x - cx, y - cy);
        if (dr > maxR) maxR = dr;
        break;
      }
    }
  }
  const b = buf(w, h);
  const hueMode = Math.round(p.hueMode);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    if (grid[i] < 0) put(b, idx, 10, 12, 24);
    else if (grid[i] === 0) put(b, idx, 255, 255, 255);
    else {
      const t = grid[i] / total;
      const [r, g, bl] = hueMode === 1 ? hslToRgb(260 - t * 240, 0.75, 0.3 + t * 0.4) : hslToRgb(190, 0.7, 0.6);
      put(b, idx, r, g, bl);
    }
  }
  return b;
}

export function sandpile(p: P, w: number, h: number): Uint8ClampedArray {
  // 격자 크기: 모래알 수에 맞춰 원판이 화면에 들어오도록
  const grains = Math.round(p.grains);
  const N = Math.min(Math.min(w, h), Math.max(64, Math.ceil(Math.sqrt(grains / 2.1)) * 2 + 31));
  const grid = new Int32Array(N * N);
  const c = Math.floor(N / 2);
  const dropMode = Math.round(p.dropMode);
  const drops: [number, number][] =
    dropMode === 0
      ? [[c, c]]
      : dropMode === 1
        ? [[c - Math.floor(N / 6), c], [c + Math.floor(N / 6), c]]
        : Array.from({ length: 9 }, (_, i) => [c - 12 + i * 3, c] as [number, number]);
  const per = Math.floor(grains / drops.length);
  for (const [dx, dy] of drops) grid[dy * N + dx] += per;
  // 안정화: 스택 기반 토플링
  let unstable = true;
  while (unstable) {
    unstable = false;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (grid[i] >= 4) {
          const t = Math.floor(grid[i] / 4);
          grid[i] -= 4 * t;
          grid[i - 1] += t;
          grid[i + 1] += t;
          grid[i - N] += t;
          grid[i + N] += t;
          unstable = true;
        }
      }
    }
  }
  const PALS: [number, number, number][][] = [
    [[15, 18, 32], [66, 135, 245], [250, 204, 21], [239, 68, 68]],
    [[250, 250, 252], [148, 163, 184], [51, 65, 85], [15, 23, 42]],
    [[20, 20, 24], [16, 185, 129], [244, 114, 182], [253, 224, 71]],
  ];
  const pal = PALS[Math.round(p.palette)] ?? PALS[0];
  const b = buf(w, h);
  const scale = Math.min(w, h) / N;
  const ox = (w - N * scale) / 2;
  const oy = (h - N * scale) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.floor((x - ox) / scale);
      const gy = Math.floor((y - oy) / scale);
      const idx = (y * w + x) * 4;
      if (gx < 0 || gy < 0 || gx >= N || gy >= N) {
        put(b, idx, 15, 18, 32);
      } else {
        const v = Math.min(3, grid[gy * N + gx]);
        put(b, idx, pal[v][0], pal[v][1], pal[v][2]);
      }
    }
  }
  return b;
}

export const rasterRegistry: Record<string, (p: P, w: number, h: number) => Uint8ClampedArray> = {
  mandelbrot,
  julia,
  "newton-fractal": newtonFractal,
  "sincos-attractor": sincosAttractor,
  "langtons-ant": langtonsAnt,
  "reaction-diffusion": grayScott,
  dla,
  sandpile,
};
