import { Shape } from "./shapes";

type P = Record<string, number>;
type Geo = (p: P, w: number, h: number) => Shape[];

const TAU = Math.PI * 2;

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export const lissajousGeo: Geo = (p, w, h) => {
  const A = Math.min(w, h) * 0.42;
  const n = Math.round(p.samples);
  const a = Math.round(p.freqA);
  const b = Math.round(p.freqB);
  const delta = (p.phase * Math.PI) / 180;
  const period = TAU / gcd(a, b);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * period;
    pts.push([w / 2 + A * Math.sin(a * t + delta), h / 2 + A * Math.sin(b * t)]);
  }
  return [{ kind: "poly", pts, stroke: "#7dd3fc", width: 1.8 }];
};

export const roseGeo: Geo = (p, w, h) => {
  const A = Math.min(w, h) * 0.44;
  const n = Math.round(p.n);
  const d = Math.round(p.d);
  const k = n / d;
  const rot = (p.rotation * Math.PI) / 180;
  const shapes: Shape[] = [];
  const step = Math.round(p.maurerStep);
  if (step > 0) {
    // 마우러 로즈: 각도 보폭으로 걸으며 현 연결
    const pts: [number, number][] = [];
    for (let i = 0; i <= 360; i++) {
      const th = (i * step * Math.PI) / 180;
      const r = A * Math.cos(k * th);
      pts.push([w / 2 + r * Math.cos(th + rot), h / 2 + r * Math.sin(th + rot)]);
    }
    shapes.push({ kind: "poly", pts, stroke: "#f9a8d4", width: 0.8, alpha: 0.85 });
  }
  const pts: [number, number][] = [];
  const span = TAU * d;
  for (let i = 0; i <= 2400; i++) {
    const th = (i / 2400) * span;
    const r = A * Math.cos(k * th);
    pts.push([w / 2 + r * Math.cos(th + rot), h / 2 + r * Math.sin(th + rot)]);
  }
  shapes.push({ kind: "poly", pts, stroke: "#fbbf24", width: step > 0 ? 1.2 : 1.8 });
  return shapes;
};

export const trochoidGeo: Geo = (p, w, h) => {
  const epi = Math.round(p.mode) === 1;
  const R = p.R;
  const r = Math.max(1, p.r);
  const d = p.d;
  const k = epi ? R + r : R - r;
  const turns = r / gcd(Math.round(R), Math.round(r));
  const maxTh = TAU * Math.min(turns, 120);
  const raw: [number, number][] = [];
  let maxRad = 1;
  const steps = Math.min(14000, Math.round(600 * Math.min(turns, 120)));
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * maxTh;
    const x = k * Math.cos(th) + (epi ? -1 : 1) * d * Math.cos((k / r) * th);
    const y = k * Math.sin(th) - d * Math.sin((k / r) * th);
    raw.push([x, y]);
    const rad = Math.hypot(x, y);
    if (rad > maxRad) maxRad = rad;
  }
  const S = (Math.min(w, h) * 0.46) / maxRad;
  return [
    {
      kind: "poly",
      pts: raw.map(([x, y]) => [w / 2 + x * S, h / 2 + y * S]),
      stroke: "#a5b4fc",
      width: 1.2,
    },
  ];
};

export const harmonographGeo: Geo = (p, w, h) => {
  const A = Math.min(w, h) * 0.4;
  const phase = (p.phase * Math.PI) / 180;
  const steps = Math.round(p.duration * 220);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / 220) * 1;
    const decay = Math.exp(-p.damping * i);
    pts.push([
      w / 2 + A * Math.sin(p.f1 * t + phase) * decay,
      h / 2 + A * Math.sin(p.f2 * t) * decay,
    ]);
  }
  return [{ kind: "poly", pts, stroke: "#6ee7b7", width: 1 }];
};

export const superformulaGeo: Geo = (p, w, h) => {
  const m = Math.round(p.m);
  const { n1, n2, n3 } = p;
  const raw: [number, number][] = [];
  let maxR = 0;
  for (let i = 0; i <= 1440; i++) {
    const phi = (i / 1440) * TAU;
    const t1 = Math.pow(Math.abs(Math.cos((m * phi) / 4)), n2);
    const t2 = Math.pow(Math.abs(Math.sin((m * phi) / 4)), n3);
    const r = Math.pow(t1 + t2, -1 / n1);
    if (!Number.isFinite(r)) continue;
    raw.push([r * Math.cos(phi), r * Math.sin(phi)]);
    if (r > maxR) maxR = r;
  }
  const S = (Math.min(w, h) * 0.44) / (maxR || 1);
  return [
    {
      kind: "poly",
      pts: raw.map(([x, y]) => [w / 2 + x * S, h / 2 + y * S]),
      stroke: "#fda4af",
      width: 2,
      fill: "rgba(253,164,175,0.12)",
      close: true,
    },
  ];
};
