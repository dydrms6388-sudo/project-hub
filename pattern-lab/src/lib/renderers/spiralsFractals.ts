import { Shape } from "./shapes";
import { mulberry32, hslToRgb } from "../core/prng";

type P = Record<string, number>;
type Geo = (p: P, w: number, h: number) => Shape[];
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: P) => void;

const TAU = Math.PI * 2;
const css = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r},${g},${b})`;
};

/* ── 나선 ── */

export const phyllotaxisGeo: Geo = (p, w, h) => {
  const n = Math.round(p.count);
  const alpha = (p.angle * Math.PI) / 180;
  const c = (Math.min(w, h) * 0.48) / Math.sqrt(n);
  const shapes: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const r = c * Math.sqrt(i);
    const th = i * alpha;
    const size = p.dotScale * (0.5 + (1.6 * i) / n);
    shapes.push({
      kind: "circle",
      cx: w / 2 + r * Math.cos(th),
      cy: h / 2 + r * Math.sin(th),
      r: size,
      fill: css(35 + (i / n) * p.hueSpread, 0.85, 0.55),
    });
  }
  return shapes;
};

export const classicSpiralsGeo: Geo = (p, w, h) => {
  const type = Math.round(p.type);
  const maxTh = TAU * p.turns;
  const strands = Math.round(p.strands);
  const shapes: Shape[] = [];
  // 스케일: 끝점 반지름이 화면 안에 들도록
  const endR = type === 0 ? maxTh : type === 1 ? Math.exp(p.growth * maxTh) : Math.sqrt(maxTh);
  const S = (Math.min(w, h) * 0.46) / endR;
  for (let s = 0; s < strands; s++) {
    const off = (s / strands) * TAU;
    const pts: [number, number][] = [];
    const steps = Math.round(p.turns * 160);
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * maxTh;
      const r = type === 0 ? th : type === 1 ? Math.exp(p.growth * th) : Math.sqrt(th);
      pts.push([w / 2 + S * r * Math.cos(th + off), h / 2 + S * r * Math.sin(th + off)]);
    }
    shapes.push({ kind: "poly", pts, stroke: css(200 + s * (140 / strands), 0.7, 0.6), width: 1.6 });
  }
  return shapes;
};

export const ulamDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const size = Math.round(p.size);
  const start = Math.round(p.start);
  const limit = size * size + start;
  // 에라토스테네스 체
  const sieve = new Uint8Array(limit + 1);
  sieve[0] = sieve[1] = 1;
  for (let i = 2; i * i <= limit; i++) {
    if (!sieve[i]) for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
  }
  const dot = p.dotSize;
  ctx.fillStyle = "#93c5fd";
  if (Math.round(p.layout) === 0) {
    // 울람 사각 나선 걷기
    const scale = Math.min(w, h) / size;
    let x = 0, y = 0, dx = 1, dy = 0, stepLen = 1, stepsDone = 0, turns = 0;
    for (let i = 0; i < size * size; i++) {
      const val = start + i;
      if (val <= limit && !sieve[val]) {
        ctx.fillRect(w / 2 + x * scale - dot / 2, h / 2 + y * scale - dot / 2, dot, dot);
      }
      x += dx;
      y += dy;
      stepsDone++;
      if (stepsDone === stepLen) {
        stepsDone = 0;
        [dx, dy] = [-dy, dx];
        turns++;
        if (turns % 2 === 0) stepLen++;
      }
    }
  } else {
    // 색스 원형 나선: r=√n, θ=2π√n
    const maxN = size * size;
    const S = (Math.min(w, h) * 0.48) / Math.sqrt(maxN);
    for (let i = 1; i < maxN; i++) {
      const val = start + i;
      if (val > limit || sieve[val]) continue;
      const sq = Math.sqrt(i);
      ctx.fillRect(
        w / 2 + S * sq * Math.cos(TAU * sq) - dot / 2,
        h / 2 + S * sq * Math.sin(TAU * sq) - dot / 2,
        dot,
        dot
      );
    }
  }
};

/* ── 프랙탈 (벡터·점) ── */

export const kochGeo: Geo = (p, w, h) => {
  const depth = Math.round(p.depth);
  const ang = (p.angle * Math.PI) / 180;
  const subdivide = (a: [number, number], b: [number, number], d: number, out: [number, number][]) => {
    if (d === 0) {
      out.push(b);
      return;
    }
    const dx = (b[0] - a[0]) / 3;
    const dy = (b[1] - a[1]) / 3;
    const p1: [number, number] = [a[0] + dx, a[1] + dy];
    const p3: [number, number] = [a[0] + 2 * dx, a[1] + 2 * dy];
    const px = p1[0] + dx * Math.cos(ang) + dy * Math.sin(ang);
    const py = p1[1] - dx * Math.sin(ang) + dy * Math.cos(ang);
    const p2: [number, number] = [px, py];
    subdivide(a, p1, d - 1, out);
    subdivide(p1, p2, d - 1, out);
    subdivide(p2, p3, d - 1, out);
    subdivide(p3, b, d - 1, out);
  };
  const closed = Math.round(p.closed) === 1;
  const L = Math.min(w, h) * (closed ? 0.78 : 0.9);
  const shapes: Shape[] = [];
  if (closed) {
    const cx = w / 2;
    const cy = h / 2 + L * 0.1;
    const R = L / Math.sqrt(3);
    const v: [number, number][] = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    const pts: [number, number][] = [v[0]];
    subdivide(v[0], v[1], depth, pts);
    subdivide(v[1], v[2], depth, pts);
    subdivide(v[2], v[0], depth, pts);
    shapes.push({ kind: "poly", pts, stroke: "#a7f3d0", width: depth > 5 ? 0.7 : 1.4, close: true, fill: "rgba(110,231,183,0.08)" });
  } else {
    const a: [number, number] = [(w - L) / 2, h * 0.62];
    const b: [number, number] = [(w + L) / 2, h * 0.62];
    const pts: [number, number][] = [a];
    subdivide(a, b, depth, pts);
    shapes.push({ kind: "poly", pts, stroke: "#a7f3d0", width: depth > 5 ? 0.7 : 1.4 });
  }
  return shapes;
};

export const dragonGeo: Geo = (p, w, h) => {
  const n = Math.round(p.iterations);
  const ang = (p.angle * Math.PI) / 180;
  const copies = Math.round(p.copies);
  // 접기 수열: k번째 꺾임 방향
  const turns: number[] = [];
  for (let i = 1; i < 1 << n; i++) {
    turns.push(((i & -i) << 1) & i ? -1 : 1);
  }
  const raw: [number, number][] = [[0, 0]];
  let x = 0, y = 0, dir = 0;
  const step = 1;
  x += step;
  raw.push([x, y]);
  for (const t of turns) {
    dir += t * ang;
    x += step * Math.cos(dir);
    y += step * Math.sin(dir);
    raw.push([x, y]);
  }
  // 정규화
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [px, py] of raw) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const S = Math.min((w * 0.82) / (maxX - minX || 1), (h * 0.82) / (maxY - minY || 1));
  const ox = w / 2 - ((minX + maxX) / 2) * S;
  const oy = h / 2 - ((minY + maxY) / 2) * S;
  const shapes: Shape[] = [];
  for (let c = 0; c < copies; c++) {
    const rot = (c * TAU) / copies;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    shapes.push({
      kind: "poly",
      pts: raw.map(([px, py]) => {
        const sx = px * S + ox - w / 2;
        const sy = py * S + oy - h / 2;
        return [w / 2 + sx * cos - sy * sin, h / 2 + sx * sin + sy * cos];
      }),
      stroke: css(30 + c * 70, 0.8, 0.6),
      width: n > 14 ? 0.5 : 1.1,
    });
  }
  return shapes;
};

export const lsystemGeo: Geo = (p, w, h) => {
  const iters = Math.round(p.iterations);
  let s = "X";
  for (let i = 0; i < iters; i++) {
    let next = "";
    for (const ch of s) {
      if (ch === "X") next += "F+[[X]-X]-F[-FX]+X";
      else if (ch === "F") next += "FF";
      else next += ch;
      if (next.length > 400000) break;
    }
    s = next;
  }
  const ang0 = (p.branchAngle * Math.PI) / 180;
  const decay = p.lengthDecay / 100;
  const rand = mulberry32(11);
  const jitter = (p.jitter * Math.PI) / 180;
  const segs: [number, number, number, number, number][] = []; // x1 y1 x2 y2 depth
  let x = 0, y = 0, dir = -Math.PI / 2;
  let len = 1;
  let depth = 0;
  const stack: [number, number, number, number, number][] = [];
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (const ch of s) {
    if (ch === "F") {
      const nx = x + len * Math.cos(dir);
      const ny = y + len * Math.sin(dir);
      segs.push([x, y, nx, ny, depth]);
      x = nx;
      y = ny;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (ch === "+") dir += ang0 + (rand() - 0.5) * 2 * jitter;
    else if (ch === "-") dir -= ang0 + (rand() - 0.5) * 2 * jitter;
    else if (ch === "[") {
      stack.push([x, y, dir, len, depth]);
      len *= decay;
      depth++;
    } else if (ch === "]") {
      const st = stack.pop();
      if (st) [x, y, dir, len, depth] = st;
    }
  }
  const S = Math.min((w * 0.85) / (maxX - minX || 1), (h * 0.85) / (maxY - minY || 1));
  const ox = w / 2 - ((minX + maxX) / 2) * S;
  const oy = h * 0.94 - maxY * S;
  return segs.map(([x1, y1, x2, y2, d]) => ({
    kind: "poly" as const,
    pts: [
      [x1 * S + ox, y1 * S + oy],
      [x2 * S + ox, y2 * S + oy],
    ] as [number, number][],
    stroke: css(100 + d * 8, 0.55, 0.35 + Math.min(0.35, d * 0.04)),
    width: Math.max(0.5, 2.2 - d * 0.25),
  }));
};

export const pythagorasGeo: Geo = (p, w, h) => {
  const depth = Math.round(p.depth);
  const alpha = (p.angle * Math.PI) / 180;
  const hueShift = p.hueShift;
  const shapes: Shape[] = [];
  const size = Math.min(w, h) * 0.16;
  // 사각형: 밑변 (x1,y1)→(x2,y2) 위에 세운 정사각형
  const rec = (x1: number, y1: number, x2: number, y2: number, d: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    // 정사각형 네 꼭짓점
    const x3 = x2 - dy;
    const y3 = y2 + dx;
    const x4 = x1 - dy;
    const y4 = y1 + dx;
    shapes.push({
      kind: "poly",
      pts: [
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x4, y4],
      ],
      close: true,
      fill: css(20 + d * hueShift, 0.65, 0.5 - d * 0.02),
      stroke: "#0b0f19",
      width: 0.5,
    });
    if (d >= depth) return;
    // 위 변(x4,y4)-(x3,y3) 위에 직각삼각형 꼭짓점
    const ux = x3 - x4;
    const uy = y3 - y4;
    const px = x4 + (ux * Math.cos(alpha) - uy * Math.sin(alpha)) * Math.cos(alpha);
    const py = y4 + (ux * Math.sin(alpha) + uy * Math.cos(alpha)) * Math.cos(alpha);
    rec(x4, y4, px, py, d + 1);
    rec(px, py, x3, y3, d + 1);
  };
  // 화면 좌표계: 위쪽으로 자라도록 밑변을 뒤집는다
  rec(w / 2 + size / 2, h * 0.96, w / 2 - size / 2, h * 0.96, 0);
  return shapes;
};

export const hilbertGeo: Geo = (p, w, h) => {
  const order = Math.round(p.order);
  const n = 1 << order;
  const total = n * n;
  const pts: [number, number][] = [];
  // d2xy 변환
  for (let d = 0; d < total; d++) {
    let rx = 0, ry = 0, t = d, x = 0, y = 0;
    for (let s = 1; s < n; s *= 2) {
      rx = 1 & (t / 2);
      ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    pts.push([x, y]);
  }
  const S = (Math.min(w, h) * 0.9) / n;
  const ox = (w - n * S) / 2 + S / 2;
  const oy = (h - n * S) / 2 + S / 2;
  const mode = Math.round(p.strokeMode);
  if (mode === 2) {
    // 거리 그라데이션: 구간별 색
    const shapes: Shape[] = [];
    const chunk = Math.max(1, Math.floor(total / 48));
    for (let i = 0; i < total - 1; i += chunk) {
      const seg = pts.slice(i, Math.min(total, i + chunk + 1));
      shapes.push({
        kind: "poly",
        pts: seg.map(([x, y]) => [x * S + ox, y * S + oy]),
        stroke: css(250 - (i / total) * 220, 0.75, 0.55),
        width: p.thickness,
      });
    }
    return shapes;
  }
  return [
    {
      kind: "poly",
      pts: pts.map(([x, y]) => [x * S + ox, y * S + oy]),
      stroke: "#c4b5fd",
      width: p.thickness,
    },
  ];
};

export const apollonianGeo: Geo = (p, w, h) => {
  // 데카르트 원 정리 (복소 중심 확장) 기반 재귀 충전
  interface C {
    k: number; // 곡률
    x: number;
    y: number; // 중심 × 곡률이 아님 — 실좌표
  }
  const shapes: Shape[] = [];
  const R = Math.min(w, h) * 0.46;
  const cx = w / 2;
  const cy = h / 2;
  const config = Math.round(p.config);
  // 초기: 바깥 원(곡률 음수) + 안쪽 접원들
  const outer: C = { k: -1 / R, x: cx, y: cy };
  let inner: C[];
  if (config === 0) {
    const r = R * (2 * Math.sqrt(3) - 3);
    const d = R - r;
    inner = [0, 1, 2].map((i) => ({
      k: 1 / r,
      x: cx + d * Math.cos((i * TAU) / 3 - Math.PI / 2),
      y: cy + d * Math.sin((i * TAU) / 3 - Math.PI / 2),
    }));
  } else if (config === 1) {
    const r1 = R / 2;
    const r2 = R / 3;
    const r3 = R / 6 * (r1 + r2 > R ? 1 : 1);
    inner = [
      { k: 1 / r1, x: cx - (R - r1), y: cy },
      { k: 1 / r2, x: cx + (R - r2), y: cy },
      { k: 1 / (R - r1 < R - r2 ? r3 : r3), x: cx + r1 - r2, y: cy - Math.sqrt(Math.max(1, (r1 + r3) ** 2 - (r1 - r2 + (R - r3) - (R - r1)) ** 2)) },
    ];
    // 비대칭 초기값이 정확히 접하지 않으면 대칭으로 대체
    inner[2] = { k: inner[2].k, x: cx, y: cy - (R - r3) };
  } else {
    const r = R / 2;
    inner = [
      { k: 1 / r, x: cx, y: cy - r },
      { k: 1 / r, x: cx, y: cy + r },
    ];
  }
  const all: C[] = [outer, ...inner];
  const minR = p.minRadius;
  const depth = Math.round(p.depth);
  const solve = (c1: C, c2: C, c3: C): C[] => {
    // 곡률
    const k4a = c1.k + c2.k + c3.k + 2 * Math.sqrt(Math.max(0, c1.k * c2.k + c2.k * c3.k + c3.k * c1.k));
    // 복소 데카르트: z4 = (z1k1+z2k2+z3k3 ± 2√(k1k2z1z2+...)) / k4
    const z = (c: C): [number, number] => [c.x * c.k, c.y * c.k];
    const [x1, y1] = z(c1);
    const [x2, y2] = z(c2);
    const [x3, y3] = z(c3);
    const mul = (ax: number, ay: number, bx: number, by: number): [number, number] => [ax * bx - ay * by, ax * by + ay * bx];
    const s1 = mul(x1, y1, x2, y2);
    const s2 = mul(x2, y2, x3, y3);
    const s3 = mul(x3, y3, x1, y1);
    const sx = s1[0] + s2[0] + s3[0];
    const sy = s1[1] + s2[1] + s3[1];
    // 복소 제곱근
    const mag = Math.hypot(sx, sy);
    const rx = Math.sqrt(Math.max(0, (mag + sx) / 2));
    const ry = Math.sign(sy || 1) * Math.sqrt(Math.max(0, (mag - sx) / 2));
    const out: C[] = [];
    for (const sign of [1, -1]) {
      const zx = x1 + x2 + x3 + sign * 2 * rx;
      const zy = y1 + y2 + y3 + sign * 2 * ry;
      if (k4a > 1e-9) out.push({ k: k4a, x: zx / k4a, y: zy / k4a });
    }
    return out;
  };
  const seen = new Set<string>();
  const key = (c: C) => `${Math.round(c.x * 4)},${Math.round(c.y * 4)},${Math.round(1 / c.k)}`;
  let frontier: [C, C, C][] = [];
  if (inner.length === 3) {
    frontier = [
      [outer, inner[0], inner[1]],
      [outer, inner[1], inner[2]],
      [outer, inner[0], inner[2]],
      [inner[0], inner[1], inner[2]],
    ];
  } else {
    frontier = [[outer, inner[0], inner[1]]];
  }
  for (let d = 0; d < depth; d++) {
    const next: [C, C, C][] = [];
    for (const [a, b, c] of frontier) {
      for (const nc of solve(a, b, c)) {
        const r = 1 / nc.k;
        if (r < minR || r > R) continue;
        const kk = key(nc);
        if (seen.has(kk)) continue;
        // 기존 원과 겹침 검사(근사)
        let ok = true;
        for (const e of all) {
          if (e.k <= 0) continue;
          const dist = Math.hypot(nc.x - e.x, nc.y - e.y);
          if (dist < 1 / e.k + r - 0.5) {
            if (Math.abs(dist - Math.abs(1 / e.k - r)) > 0.5 && Math.abs(dist - (1 / e.k + r)) > 0.5) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) continue;
        seen.add(kk);
        all.push(nc);
        next.push([a, b, nc], [a, c, nc], [b, c, nc]);
        if (all.length > 4000) break;
      }
      if (all.length > 4000) break;
    }
    frontier = next;
    if (all.length > 4000) break;
  }
  shapes.push({ kind: "circle", cx, cy, r: R, stroke: "#94a3b8", width: 1.5 });
  for (const c of all) {
    if (c.k <= 0) continue;
    shapes.push({
      kind: "circle",
      cx: c.x,
      cy: c.y,
      r: 1 / c.k,
      stroke: css(180 + Math.log(1 / c.k + 1) * 40, 0.7, 0.6),
      width: 1,
    });
  }
  return shapes;
};

/* ── 점 축적형 프랙탈 (canvas 직접) ── */

export const sierpinskiDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const vcount = Math.round(p.vertices);
  const R = Math.min(w, h) * 0.46;
  const verts = Array.from({ length: vcount }, (_, i) => {
    const a = -Math.PI / 2 + (i * TAU) / vcount;
    return [w / 2 + R * Math.cos(a), h / 2 + R * Math.sin(a)];
  });
  const rand = mulberry32(5);
  const noRepeat = Math.round(p.noRepeat) === 1;
  let x = w / 2;
  let y = h / 2;
  let last = -1;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const n = Math.round(p.points);
  for (let i = 0; i < n; i++) {
    let vi = Math.floor(rand() * vcount);
    if (noRepeat) while (vi === last) vi = Math.floor(rand() * vcount);
    last = vi;
    x = x + (verts[vi][0] - x) * p.ratio;
    y = y + (verts[vi][1] - y) * p.ratio;
    if (i < 20) continue;
    const idx = ((y | 0) * w + (x | 0)) * 4;
    const [r, g, b] = hslToRgb(180 + (vi * 360) / vcount, 0.7, 0.62);
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

export const barnsleyDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const rand = mulberry32(9);
  const bend = (p.bend * Math.PI) / 180;
  const spread = p.leafSpread / 100;
  const cb = Math.cos(bend);
  const sb = Math.sin(bend);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  let x = 0;
  let y = 0;
  const n = Math.round(p.points);
  const S = h / 10.6;
  const hue = p.hue;
  for (let i = 0; i < n; i++) {
    const r = rand();
    let nx: number, ny: number;
    if (r < 0.01) {
      nx = 0;
      ny = 0.16 * y;
    } else if (r < 0.86) {
      // 주 사상 + 굽힘 회전
      const ax = 0.85 * x + 0.04 * y;
      const ay = -0.04 * x + 0.85 * y + 1.6;
      nx = ax * cb - ay * sb + 1.6 * sb * 0.1;
      ny = ax * sb + ay * cb;
    } else if (r < 0.93) {
      nx = (0.2 * x - 0.26 * y) * spread * 1.15;
      ny = 0.23 * x + 0.22 * y + 1.6;
    } else {
      nx = (-0.15 * x + 0.28 * y) * spread * 1.15;
      ny = 0.26 * x + 0.24 * y + 0.44;
    }
    x = nx;
    y = ny;
    if (i < 20) continue;
    const px = Math.round(w / 2 + x * S);
    const py = Math.round(h * 0.98 - y * S);
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    const idx = (py * w + px) * 4;
    const t = y / 10;
    const [r2, g2, b2] = hslToRgb(hue - t * 30, 0.75, 0.35 + t * 0.3);
    data[idx] = Math.max(data[idx], r2);
    data[idx + 1] = Math.max(data[idx + 1], g2);
    data[idx + 2] = Math.max(data[idx + 2], b2);
    data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};
