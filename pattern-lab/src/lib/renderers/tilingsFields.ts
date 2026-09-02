import { Shape } from "./shapes";
import { mulberry32, makeNoise2D, hslToRgb } from "../core/prng";

type P = Record<string, number>;
type Geo = (p: P, w: number, h: number) => Shape[];
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: P) => void;

const TAU = Math.PI * 2;
const css = (h: number, s: number, l: number) => {
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r},${g},${b})`;
};

/* ── 타일링 ── */

export const penroseGeo: Geo = (p, w, h) => {
  // P3 로빈슨 삼각형 세분 (황금비)
  const PHI = (1 + Math.sqrt(5)) / 2;
  type Tri = { thin: boolean; a: [number, number]; b: [number, number]; c: [number, number] };
  let tris: Tri[] = [];
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.66;
  for (let i = 0; i < 10; i++) {
    const a1 = ((2 * i - 1) * Math.PI) / 10;
    const a2 = ((2 * i + 1) * Math.PI) / 10;
    let b: [number, number] = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
    let c: [number, number] = [cx + R * Math.cos(a2), cy + R * Math.sin(a2)];
    if (i % 2 === 0) [b, c] = [c, b];
    tris.push({ thin: true, a: [cx, cy], b, c });
  }
  const gens = Math.round(p.subdivisions);
  const mix = (u: [number, number], v: [number, number], t: number): [number, number] => [
    u[0] + (v[0] - u[0]) * t,
    u[1] + (v[1] - u[1]) * t,
  ];
  for (let g = 0; g < gens; g++) {
    const next: Tri[] = [];
    for (const t of tris) {
      if (t.thin) {
        const ppt = mix(t.a, t.b, 1 / PHI);
        next.push({ thin: true, a: t.c, b: ppt, c: t.b });
        next.push({ thin: false, a: ppt, b: t.c, c: t.a });
      } else {
        const q = mix(t.b, t.a, 1 / PHI);
        const r = mix(t.b, t.c, 1 / PHI);
        next.push({ thin: false, a: r, b: t.c, c: t.a });
        next.push({ thin: false, a: q, b: r, c: t.b });
        next.push({ thin: true, a: r, b: q, c: t.a });
      }
      if (next.length > 60000) break;
    }
    tris = next;
    if (tris.length > 60000) break;
  }
  return tris.map((t) => ({
    kind: "poly" as const,
    pts: [t.a, t.b, t.c],
    close: true,
    fill: t.thin ? css(p.hueThin, 0.55, 0.55) : css(p.hueThick, 0.6, 0.5),
    stroke: p.edgeWidth > 0 ? "#0b0f19" : undefined,
    width: p.edgeWidth,
  }));
};

export const truchetGeo: Geo = (p, w, h) => {
  const n = Math.round(p.grid);
  const cell = Math.min(w, h) / n;
  const ox = (w - n * cell) / 2;
  const oy = (h - n * cell) / 2;
  const rand = mulberry32(Math.round(p.seed));
  const bias = p.bias / 100;
  const type = Math.round(p.tileType);
  const shapes: Shape[] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x = ox + gx * cell;
      const y = oy + gy * cell;
      const flip = rand() < bias;
      const useArc = type === 1 || (type === 2 && rand() < 0.5);
      if (useArc) {
        if (flip) {
          shapes.push({ kind: "poly", pts: arc(x, y, cell / 2, 0, Math.PI / 2), stroke: "#fcd34d", width: cell * 0.16 });
          shapes.push({ kind: "poly", pts: arc(x + cell, y + cell, cell / 2, Math.PI, Math.PI * 1.5), stroke: "#fcd34d", width: cell * 0.16 });
        } else {
          shapes.push({ kind: "poly", pts: arc(x + cell, y, cell / 2, Math.PI / 2, Math.PI), stroke: "#fcd34d", width: cell * 0.16 });
          shapes.push({ kind: "poly", pts: arc(x, y + cell, cell / 2, -Math.PI / 2, 0), stroke: "#fcd34d", width: cell * 0.16 });
        }
      } else {
        const tri: [number, number][] = flip
          ? [
              [x, y],
              [x + cell, y],
              [x, y + cell],
            ]
          : [
              [x + cell, y],
              [x + cell, y + cell],
              [x, y],
            ];
        shapes.push({ kind: "poly", pts: tri, close: true, fill: "#334155" });
      }
    }
  }
  return shapes;
};

export const voronoiDraw: Draw = (ctx, w, h, p) => {
  const rand = mulberry32(Math.round(p.seed));
  const n = Math.round(p.seeds);
  let seeds = Array.from({ length: n }, () => [rand() * w, rand() * h]);
  const metric = Math.round(p.metric);
  const dist = (dx: number, dy: number) => {
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    if (metric === 0) return dx * dx + dy * dy;
    if (metric === 1) return dx + dy;
    return Math.max(dx, dy);
  };
  // 로이드 완화
  for (let it = 0; it < Math.round(p.relax); it++) {
    const sx = new Float64Array(n);
    const sy = new Float64Array(n);
    const cnt = new Int32Array(n);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < n; i++) {
          const d = dist(x - seeds[i][0], y - seeds[i][1]);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        sx[best] += x;
        sy[best] += y;
        cnt[best]++;
      }
    }
    seeds = seeds.map((s, i) => (cnt[i] ? [sx[i] / cnt[i], sy[i] / cnt[i]] : s));
  }
  const mode = Math.round(p.mode);
  // 절반 해상도 계산 후 확대
  const cw = Math.ceil(w / 2);
  const ch = Math.ceil(h / 2);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cellColor: [number, number, number][] = seeds.map((_, i) =>
    hslToRgb((i * 137.5) % 360, 0.55, 0.55)
  );
  let maxF1 = 1;
  const f1cache = new Float32Array(cw * ch);
  const idcache = new Int16Array(cw * ch);
  const f2cache = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      let id = 0;
      for (let i = 0; i < n; i++) {
        const d = dist(x * 2 - seeds[i][0], y * 2 - seeds[i][1]);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = i;
        } else if (d < d2) d2 = d;
      }
      const ci = y * cw + x;
      f1cache[ci] = d1;
      f2cache[ci] = d2;
      idcache[ci] = id;
      if (d1 > maxF1) maxF1 = d1;
    }
  }
  for (let y = 0; y < h; y++) {
    const cy0 = Math.min(ch - 1, y >> 1) * cw;
    for (let x = 0; x < w; x++) {
      const ci = cy0 + Math.min(cw - 1, x >> 1);
      const idx = (y * w + x) * 4;
      if (mode === 0) {
        const col = cellColor[idcache[ci]];
        const edge = Math.sqrt(f2cache[ci]) - Math.sqrt(f1cache[ci]) < 1.6;
        data[idx] = edge ? 15 : col[0];
        data[idx + 1] = edge ? 18 : col[1];
        data[idx + 2] = edge ? 32 : col[2];
      } else if (mode === 1) {
        const edge = Math.sqrt(f2cache[ci]) - Math.sqrt(f1cache[ci]) < 1.6;
        const v = edge ? 235 : 15;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = edge ? 240 : 20;
      } else {
        const t = Math.sqrt(f1cache[ci] / maxF1);
        const [r, g, b] = hslToRgb(220 - t * 200, 0.7, 0.12 + t * 0.6);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (mode !== 2) {
    ctx.fillStyle = "#0b0f19";
    for (const [sx, sy] of seeds) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, TAU);
      ctx.fill();
    }
  }
};

export const wallpaperGeo: Geo = (p, w, h) => {
  const cell = p.cellSize;
  const rand = mulberry32(Math.round(p.seed));
  const nSeg = Math.round(p.motifComplexity);
  // 모티프: 셀 내 무작위 선분들
  const motif: [number, number, number, number][] = Array.from({ length: nSeg }, () => [
    rand() * cell * 0.5,
    rand() * cell * 0.5,
    rand() * cell * 0.5,
    rand() * cell * 0.5,
  ]);
  const group = Math.round(p.group);
  // 셀 내 대칭 사본 생성
  type M = (x: number, y: number) => [number, number];
  const ident: M = (x, y) => [x, y];
  const mirX: M = (x, y) => [cell - x, y];
  const mirY: M = (x, y) => [x, cell - y];
  const rot180: M = (x, y) => [cell - x, cell - y];
  const rot90: M = (x, y) => [cell - y, x];
  const rot270: M = (x, y) => [y, cell - x];
  const diag: M = (x, y) => [y, x];
  let ops: M[];
  switch (group) {
    case 0: ops = [ident, rot180]; break; // p2
    case 1: ops = [ident, rot90, rot180, rot270]; break; // p4
    case 2: ops = [ident, rot90, rot180, rot270, mirX, mirY, diag, (x, y) => [cell - y, cell - x]]; break; // p4m
    case 3: ops = [ident, rot180, (x, y) => rot90(...rot180(x, y)), rot90]; break; // p6 근사(정사각 격자 투영)
    case 4: ops = [ident, rot90, rot180, rot270, mirX, mirY]; break; // p6m 근사
    case 5: ops = [ident, mirX, mirY, rot180]; break; // pmm
    default: ops = [ident, mirY]; break; // cm
  }
  const shapes: Shape[] = [];
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const ox = gx * cell;
      const oy = gy * cell;
      ops.forEach((op, oi) => {
        for (const [x1, y1, x2, y2] of motif) {
          const [a1, b1] = op(x1, y1);
          const [a2, b2] = op(x2, y2);
          shapes.push({
            kind: "poly",
            pts: [
              [ox + a1, oy + b1],
              [ox + a2, oy + b2],
            ],
            stroke: css(200 + oi * 18, 0.6, 0.6),
            width: 1.4,
          });
        }
      });
    }
  }
  return shapes;
};

/* ── 장·간섭 ── */

function fieldDraw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  value: (x: number, y: number) => [number, number, number]
) {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = value(x, y);
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export const chladniDraw: Draw = (ctx, w, h, p) => {
  const n = Math.round(p.n);
  const m = Math.round(p.m);
  const mix = p.mix;
  const t = p.lineWidth * 0.045;
  fieldDraw(ctx, w, h, (x, y) => {
    const u = x / w;
    const v = y / h;
    const val =
      Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) +
      mix * Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
    if (Math.abs(val) < t) {
      return [244, 214, 118];
    }
    const bgt = Math.min(1, Math.abs(val) / 2);
    return [12 + bgt * 24, 15 + bgt * 20, 30 + bgt * 34];
  });
};

export const interferenceDraw: Draw = (ctx, w, h, p) => {
  const nSrc = Math.round(p.sources);
  const arrangement = Math.round(p.arrangement);
  const rand = mulberry32(3);
  const srcs: [number, number][] = [];
  for (let i = 0; i < nSrc; i++) {
    if (arrangement === 0) srcs.push([w / 2 + (i - (nSrc - 1) / 2) * (w / (nSrc + 1)) * 0.5, h / 2]);
    else if (arrangement === 1) {
      const a = (i / nSrc) * TAU;
      srcs.push([w / 2 + Math.cos(a) * w * 0.22, h / 2 + Math.sin(a) * h * 0.22]);
    } else srcs.push([w * (0.2 + rand() * 0.6), h * (0.2 + rand() * 0.6)]);
  }
  const k = TAU / p.wavelength;
  const gamma = p.contrast;
  fieldDraw(ctx, w, h, (x, y) => {
    let sum = 0;
    for (const [sx, sy] of srcs) {
      sum += Math.sin(k * Math.hypot(x - sx, y - sy));
    }
    const t = Math.pow(Math.abs(sum) / nSrc, 1 / gamma) * Math.sign(sum);
    const v = (t + 1) / 2;
    return hslToRgb(210 - v * 40, 0.5, 0.08 + v * 0.7);
  });
};

export const moireGeo: Geo = (p, w, h) => {
  const type = Math.round(p.gratingType);
  const spacing = p.spacing;
  const rot = (p.rotation * Math.PI) / 180;
  const scale2 = 1 + p.scaleDiff / 100;
  const shapes: Shape[] = [];
  const layer = (angle: number, sc: number, color: string) => {
    const cx = w / 2;
    const cy = h / 2;
    if (type === 0) {
      const diag = Math.hypot(w, h);
      const count = Math.ceil(diag / (spacing * sc));
      for (let i = -count; i <= count; i++) {
        const off = i * spacing * sc;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        shapes.push({
          kind: "poly",
          pts: [
            [cx - dy * off - dx * diag, cy + dx * off - dy * diag],
            [cx - dy * off + dx * diag, cy + dx * off + dy * diag],
          ],
          stroke: color,
          width: spacing * 0.35,
          alpha: 0.85,
        });
      }
    } else if (type === 1) {
      const maxR = Math.hypot(w, h) / 2;
      const ox = Math.cos(angle) * spacing * 2;
      const oy = Math.sin(angle) * spacing * 2;
      for (let r = spacing * sc; r < maxR; r += spacing * sc) {
        shapes.push({ kind: "circle", cx: cx + ox, cy: cy + oy, r, stroke: color, width: spacing * 0.3, alpha: 0.85 });
      }
    } else {
      const count = 72;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + angle;
        shapes.push({
          kind: "poly",
          pts: [
            [cx, cy],
            [cx + Math.cos(a) * w, cy + Math.sin(a) * w],
          ],
          stroke: color,
          width: 1.2,
          alpha: 0.85,
        });
      }
    }
  };
  layer(0, 1, "#93c5fd");
  layer(rot, scale2, "#fca5a5");
  return shapes;
};

export const perlinFlowDraw: Draw = (ctx, w, h, p) => {
  ctx.fillStyle = "#0b0f19";
  ctx.fillRect(0, 0, w, h);
  const { fbm } = makeNoise2D(Math.round(p.seed));
  const oct = Math.round(p.octaves);
  const sc = p.noiseScale / Math.min(w, h);
  const rand = mulberry32(Math.round(p.seed) + 1);
  const lines = Math.round(p.lineCount);
  ctx.lineWidth = 1;
  for (let l = 0; l < lines; l++) {
    let x = rand() * w;
    let y = rand() * h;
    const hue = 180 + fbm(x * sc * 2, y * sc * 2, 2) * 120;
    ctx.strokeStyle = css(hue, 0.7, 0.55);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 48; s++) {
      const a = fbm(x * sc, y * sc, oct) * Math.PI * 3;
      x += Math.cos(a) * p.stepLength;
      y += Math.sin(a) * p.stepLength;
      if (x < 0 || x >= w || y < 0 || y >= h) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

export const gyroidDraw: Draw = (ctx, w, h, p) => {
  const s = (p.scale * TAU) / Math.min(w, h);
  const z = p.sliceZ;
  const th = p.threshold;
  const bands = Math.round(p.bandCount);
  fieldDraw(ctx, w, h, (x, y) => {
    const X = x * s;
    const Y = y * s;
    const g =
      Math.sin(X) * Math.cos(Y) + Math.sin(Y) * Math.cos(z) + Math.sin(z) * Math.cos(X) - th;
    if (bands <= 1) {
      return g > 0 ? [56, 189, 248] as [number, number, number] : [15, 18, 32];
    }
    const t = (Math.sin(g * bands * 2) + 1) / 2;
    return hslToRgb(190 + g * 30, 0.7, 0.15 + t * 0.55);
  });
};
