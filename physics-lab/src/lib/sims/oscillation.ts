import { P, Sim, SimSpec, Metric, DrawOpts, INK, ACCENT, TWIN, GRID, line, dot, clearBg } from "./types";
import { rk4, velocityVerlet, diverged, energyDrift } from "../core/integrators";

const g = 9.81;
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");

/* 단진자(비선형) + 진자 파도 */
export const simplePendulum: SimSpec = {
  dt: 1 / 240,
  stepsPerFrame: 4,
  conservative: true,
  create(p, twin) {
    const n = Math.max(1, Math.round(p.count));
    const L0 = p.length;
    const b = p.damping;
    const th0 = ((p.theta0 + (twin ?? 0)) * Math.PI) / 180;
    const angles: number[] = [];
    const vels: number[] = [];
    const lens: number[] = [];
    for (let i = 0; i < n; i++) {
      // 진자 파도: 길이를 등차로 배열
      lens.push(n === 1 ? L0 : L0 * Math.pow(1 + 0.06 * i, 2) / Math.pow(1, 2) * (0.5 + 0.5));
      angles.push(th0);
      vels.push(0);
    }
    let time = 0;
    let E0 = NaN;
    let div = false;
    const energyOf = () => {
      let E = 0;
      for (let i = 0; i < n; i++) {
        const L = lens[i];
        E += 0.5 * L * L * vels[i] * vels[i] + g * L * (1 - Math.cos(angles[i]));
      }
      return E / n;
    };
    return {
      get time() { return time; },
      step(dt: number) {
        for (let i = 0; i < n; i++) {
          const L = lens[i];
          const s = rk4([angles[i], vels[i]], time, dt, ([th, w]) => [
            w,
            -(g / L) * Math.sin(th) - b * w,
          ]);
          angles[i] = s[0];
          vels[i] = s[1];
        }
        time += dt;
        if (Number.isNaN(E0) && b === 0) E0 = energyOf();
        if (diverged(angles) || diverged(vels)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2;
        const oy = h * 0.14;
        const scale = (h * 0.7) / Math.max(...lens);
        const drawSet = (ang: number[], col: string, alpha = 1) => {
          ctx.globalAlpha = alpha;
          for (let i = 0; i < n; i++) {
            const L = lens[i] * scale;
            const x = ox + (n === 1 ? 0 : (i - (n - 1) / 2) * (w * 0.8) / n);
            const bx = x + L * Math.sin(ang[i]);
            const by = oy + L * Math.cos(ang[i]);
            ctx.strokeStyle = GRID;
            ctx.lineWidth = 1;
            line(ctx, x, oy, bx, by);
            dot(ctx, bx, by, n > 6 ? 5 : 9, col);
          }
          ctx.globalAlpha = 1;
        };
        if (o.twin) drawSet((o.twin as unknown as { _a(): number[] })._a(), TWIN, 0.6);
        drawSet(angles, ACCENT);
      },
      metrics(): Metric[] {
        const m: Metric[] = [
          { label: "각도 θ₁", value: fmt((angles[0] * 180) / Math.PI, 1), unit: "°" },
          { label: "주기 근사", value: fmt(2 * Math.PI * Math.sqrt(lens[0] / g), 2), unit: "s" },
        ];
        if (b === 0 && Number.isFinite(E0)) {
          m.push({ label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" });
        }
        return m;
      },
      energy() { return b === 0 ? energyOf() : null; },
      diverged() { return div; },
      // 쌍둥이 상태 노출(내부용)
      _a: () => angles,
    } as unknown as Sim;
  },
};

/* 강제 감쇠 진동자(공명) + RLC */
export const drivenOscillator: SimSpec = {
  dt: 1 / 240,
  stepsPerFrame: 4,
  create(p, twin) {
    const w0 = p.omega0;
    const zeta = p.zeta;
    const F = p.driveAmp;
    const wd = p.driveFreq;
    let x = 0.001 + (twin ?? 0);
    let v = 0;
    let time = 0;
    let div = false;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x, v], time, dt, ([xx, vv], t) => [
          vv,
          F * Math.cos(wd * t) - 2 * zeta * w0 * vv - w0 * w0 * xx,
        ]);
        x = s[0];
        v = s[1];
        time += dt;
        trail.push([time, x]);
        if (trail.length > 600) trail.shift();
        if (diverged([x, v])) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 위: 진동자 질점, 아래: x(t) 시계열
        const cy = h * 0.28;
        const amp = h * 0.16;
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 1;
        line(ctx, w * 0.1, cy, w * 0.9, cy);
        const px = w / 2 + x * (w * 0.14);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 3;
        line(ctx, w / 2, cy, px, cy);
        dot(ctx, px, cy, 12, ACCENT);
        // 시계열
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        trail.forEach(([t, xx], i) => {
          const gx = w * 0.1 + ((t - trail[0][0]) / (trail[trail.length - 1][0] - trail[0][0] || 1)) * w * 0.8;
          const gy = h * 0.72 - xx * amp;
          i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy);
        });
        ctx.stroke();
      },
      metrics(): Metric[] {
        const ratio = wd / w0;
        const amp = F / Math.sqrt((w0 * w0 - wd * wd) ** 2 + (2 * zeta * w0 * wd) ** 2);
        return [
          { label: "진폭 x", value: fmt(x, 3), unit: "m" },
          { label: "구동/고유 비", value: fmt(ratio, 2) },
          { label: "정상상태 진폭", value: fmt(amp, 3), unit: "m" },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
    } as Sim;
  },
};

/* 결합 진동자(정규모드·맥놀이) */
export const coupledOscillators: SimSpec = {
  dt: 1 / 240,
  stepsPerFrame: 4,
  conservative: true,
  create(p) {
    const k = p.springK;
    const kc = p.couplingK;
    const m1 = 1;
    const m2 = p.massRatio;
    const mode = Math.round(p.initMode);
    let x1 = mode === 0 ? 1 : mode === 1 ? 1 : 1;
    let x2 = mode === 0 ? 0 : mode === 1 ? 1 : -1;
    let v1 = 0, v2 = 0, time = 0, div = false;
    const energyOf = () =>
      0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2 + 0.5 * k * x1 * x1 + 0.5 * k * x2 * x2 + 0.5 * kc * (x1 - x2) ** 2;
    const E0 = energyOf();
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x1, v1, x2, v2], time, dt, ([a, va, b, vb]) => [
          va,
          (-k * a - kc * (a - b)) / m1,
          vb,
          (-k * b - kc * (b - a)) / m2,
        ]);
        [x1, v1, x2, v2] = s;
        time += dt;
        if (diverged(s)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const cy = h / 2;
        const c1 = w * 0.35 + x1 * w * 0.1;
        const c2 = w * 0.65 + x2 * w * 0.1;
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 2;
        line(ctx, 0, cy, c1, cy);
        line(ctx, c1, cy, c2, cy);
        line(ctx, c2, cy, w, cy);
        dot(ctx, c1, cy, 16, ACCENT);
        dot(ctx, c2, cy, 16 * Math.sqrt(m2), TWIN);
      },
      metrics(): Metric[] {
        return [
          { label: "질점1 변위", value: fmt(x1, 3), unit: "m" },
          { label: "질점2 변위", value: fmt(x2, 3), unit: "m" },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
    } as Sim;
  },
};

/* 용수철 진자(카오스) */
export const elasticPendulum: SimSpec = {
  dt: 1 / 400,
  stepsPerFrame: 7,
  conservative: true,
  create(p, twin) {
    const k = p.springK, L0 = p.restLength, m = 1;
    let r = L0 + p.stretch0;
    let th = ((p.theta0 + (twin ?? 0)) * Math.PI) / 180;
    let vr = 0, vth = 0, time = 0, div = false;
    const energyOf = () =>
      0.5 * m * (vr * vr + r * r * vth * vth) + 0.5 * k * (r - L0) ** 2 - m * g * r * Math.cos(th);
    const E0 = energyOf();
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([r, vr, th, vth], time, dt, ([R, VR, TH, VTH]) => [
          VR,
          R * VTH * VTH - g * Math.cos(TH) - (k / m) * (R - L0),
          VTH,
          (-2 * VR * VTH - g * Math.sin(TH)) / R,
        ]);
        [r, vr, th, vth] = s;
        time += dt;
        const bx = r * Math.sin(th), by = r * Math.cos(th);
        trail.push([bx, by]);
        if (trail.length > 400) trail.shift();
        if (diverged(s) || r < 0.01) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h * 0.18;
        const scale = (h * 0.6) / (L0 + p.stretch0 + 0.6);
        ctx.strokeStyle = ACCENT + "55";
        ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([bx, by], i) => {
          const x = ox + bx * scale, y = oy + by * scale;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        const drawBob = (R: number, TH: number, col: string, a = 1) => {
          ctx.globalAlpha = a;
          const x = ox + R * Math.sin(TH) * scale, y = oy + R * Math.cos(TH) * scale;
          ctx.strokeStyle = GRID; ctx.lineWidth = 2;
          line(ctx, ox, oy, x, y);
          dot(ctx, x, y, 11, col);
          ctx.globalAlpha = 1;
        };
        if (o.twin) { const t = o.twin as unknown as { _s(): number[] }; const st = t._s(); drawBob(st[0], st[2], TWIN, 0.6); }
        drawBob(r, th, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "줄 길이 r", value: fmt(r, 3), unit: "m" },
          { label: "흔들림각", value: fmt((th * 180) / Math.PI, 1), unit: "°" },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
      _s: () => [r, vr, th, vth],
    } as unknown as Sim;
  },
};

/* 파라메트릭 진자(그네·카피차) */
export const parametricPendulum: SimSpec = {
  dt: 1 / 600,
  stepsPerFrame: 10,
  create(p, twin) {
    const a = p.driveAmp, wd = p.driveFreq, L = p.length, b = 0.05;
    let th = ((p.theta0 + (twin ?? 0)) * Math.PI) / 180;
    let w = 0, time = 0, div = false;
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([th, w], time, dt, ([TH, W], t) => [
          W,
          -((g + a * wd * wd * Math.cos(wd * t)) / L) * Math.sin(TH) - b * W,
        ]);
        [th, w] = s;
        time += dt;
        if (diverged(s)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, wd2: number, h: number, o: DrawOpts) {
        clearBg(ctx, wd2, h);
        const ox = wd2 / 2;
        const oy = h / 2 + a * Math.cos(wd * time) * 400;
        const scale = h * 0.34;
        const drawB = (TH: number, col: string, al = 1) => {
          ctx.globalAlpha = al;
          const x = ox + Math.sin(TH) * scale, y = oy + Math.cos(TH) * scale;
          ctx.strokeStyle = GRID; ctx.lineWidth = 2; line(ctx, ox, oy, x, y);
          dot(ctx, x, y, 12, col); ctx.globalAlpha = 1;
        };
        dot(ctx, ox, oy, 4, INK);
        if (o.twin) { const t = o.twin as unknown as { _th(): number }; drawB(t._th(), TWIN, 0.6); }
        drawB(th, ACCENT);
      },
      metrics(): Metric[] {
        let a2 = ((th % (2 * Math.PI)) * 180) / Math.PI;
        if (a2 > 180) a2 -= 360; if (a2 < -180) a2 += 360;
        return [
          { label: "각도 θ", value: fmt(a2, 1), unit: "°" },
          { label: "각속도", value: fmt(w, 2), unit: "rad/s" },
          { label: "구동/공명비", value: fmt(wd / (2 * Math.sqrt(g / L)), 2) },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
      _th: () => th,
    } as unknown as Sim;
  },
};

/* 푸코 진자 */
export const foucaultPendulum: SimSpec = {
  dt: 1 / 120,
  stepsPerFrame: 2,
  create(p) {
    const lat = (p.latitude * Math.PI) / 180;
    const L = p.length;
    const w0 = Math.sqrt(g / L);
    const Omega = ((2 * Math.PI) / 86400) * p.timeScale * Math.sin(lat);
    const A = p.amplitude / L;
    let x = A, y = 0, vx = 0, vy = w0 * 0; // 시작: x축 진동
    let time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x, y, vx, vy], time, dt, ([X, Y, VX, VY]) => [
          VX, VY,
          -w0 * w0 * X + 2 * Omega * VY,
          -w0 * w0 * Y - 2 * Omega * VX,
        ]);
        [x, y, vx, vy] = s;
        time += dt;
        trail.push([x, y]);
        if (trail.length > 2000) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, scale = (Math.min(w, h) * 0.42);
        ctx.strokeStyle = ACCENT + "44";
        ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([X, Y], i) => {
          const px = ox + X * scale, py = oy + Y * scale;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.stroke();
        dot(ctx, ox + x * scale, oy + y * scale, 7, ACCENT);
      },
      metrics(): Metric[] {
        const precPeriod = Math.abs(p.latitude) < 0.5 ? Infinity : 24 / Math.sin(lat);
        return [
          { label: "위도", value: fmt(p.latitude, 0), unit: "°" },
          { label: "세차 주기", value: Number.isFinite(precPeriod) ? fmt(precPeriod, 1) : "∞", unit: "h" },
          { label: "진동면 회전", value: fmt(((Omega * time) % (2 * Math.PI)) * 180 / Math.PI, 1), unit: "°" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 스틱-슬립 마찰 진동 */
export const stickSlip: SimSpec = {
  dt: 1 / 240,
  stepsPerFrame: 4,
  create(p) {
    const vBelt = p.beltSpeed / 100; // cm/s → m/s
    const mus = p.muStatic, muk = p.muKinetic, k = p.springK, m = 1;
    const N = m * g;
    let x = 0, v = 0, time = 0;
    let stuck = true;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        // 벨트 위 질점: 용수철이 끌고 마찰이 저항
        const relV = v - vBelt;
        const springF = -k * (x - vBelt * 0); // 스프링 고정단은 정지
        // 실제로는 스프링이 x를 당김: F_spring = k*(target - x), target 정지벽 위치 0에서 늘어남 계산 단순화
        const fSpring = -k * x + k * vBelt * time; // 벨트가 끌고가는 기준
        if (stuck && Math.abs(fSpring) < mus * N) {
          v = vBelt;
          x += vBelt * dt;
        } else {
          stuck = false;
          const fric = -Math.sign(relV || 1) * muk * N;
          const a = (fSpring + fric) / m;
          v += a * dt;
          x += v * dt;
          if (Math.abs(v - vBelt) < 1e-3 && Math.abs(fSpring) < mus * N) stuck = true;
        }
        time += dt;
        trail.push([time, fSpring]);
        if (trail.length > 500) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 벨트+블록
        ctx.fillStyle = GRID;
        ctx.fillRect(0, h * 0.36, w, 6);
        const bx = w * 0.2 + (x * 30) % (w * 0.6);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(bx - 20, h * 0.3, 40, 26);
        // 힘 시계열(톱니 파형)
        ctx.strokeStyle = TWIN;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const t0 = trail[0]?.[0] ?? 0;
        const span = (trail[trail.length - 1]?.[0] ?? 1) - t0 || 1;
        trail.forEach(([t, f], i) => {
          const gx = w * 0.1 + ((t - t0) / span) * w * 0.8;
          const gy = h * 0.72 - f * 6;
          i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy);
        });
        ctx.stroke();
      },
      metrics(): Metric[] {
        return [
          { label: "블록 속도", value: fmt(v, 3), unit: "m/s" },
          { label: "상태", value: stuck ? "고착" : "미끄러짐" },
          { label: "μs−μk", value: fmt(mus - muk, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* FPUT 비선형 사슬 */
export const fputChain: SimSpec = {
  dt: 1 / 60,
  stepsPerFrame: 8,
  conservative: true,
  create(p) {
    const N = Math.round(p.particles);
    const alpha = p.alpha;
    const amp = p.amplitude;
    const mode = Math.round(p.initMode);
    const q = new Array(N + 2).fill(0);
    const v = new Array(N + 2).fill(0);
    for (let i = 1; i <= N; i++) q[i] = amp * Math.sin((mode * Math.PI * i) / (N + 1));
    let time = 0;
    const accel = (Q: number[]) => {
      const a = new Array(N + 2).fill(0);
      for (let i = 1; i <= N; i++) {
        const dR = Q[i + 1] - Q[i], dL = Q[i] - Q[i - 1];
        a[i] = (Q[i + 1] - 2 * Q[i] + Q[i - 1]) * (1 + alpha * (Q[i + 1] - Q[i - 1]));
      }
      return a;
    };
    const energyOf = () => {
      let E = 0;
      for (let i = 1; i <= N; i++) {
        E += 0.5 * v[i] * v[i];
        const d = q[i + 1] - q[i];
        E += 0.5 * d * d + (alpha / 3) * d * d * d;
      }
      return E;
    };
    const E0 = energyOf();
    // 모드별 에너지
    const modeEnergy = (mm: number) => {
      let Q = 0, Pm = 0;
      for (let i = 1; i <= N; i++) {
        const s = Math.sin((mm * Math.PI * i) / (N + 1)) * Math.sqrt(2 / (N + 1));
        Q += q[i] * s;
        Pm += v[i] * s;
      }
      const wk = 2 * Math.sin((mm * Math.PI) / (2 * (N + 1)));
      return 0.5 * (Pm * Pm + wk * wk * Q * Q);
    };
    let div = false;
    return {
      get time() { return time; },
      step(dt: number) {
        const a0 = accel(q);
        for (let i = 1; i <= N; i++) q[i] += v[i] * dt + 0.5 * a0[i] * dt * dt;
        const a1 = accel(q);
        for (let i = 1; i <= N; i++) v[i] += 0.5 * (a0[i] + a1[i]) * dt;
        time += dt;
        if (diverged(q)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 사슬 변위
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i <= N + 1; i++) {
          const x = (i / (N + 1)) * w;
          const y = h * 0.32 - q[i] * (h * 0.14) / amp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        // 모드 에너지 막대(1~5)
        const bars = 5;
        for (let mm = 1; mm <= bars; mm++) {
          const e = modeEnergy(mm) / (E0 || 1);
          ctx.fillStyle = mm === Math.round(p.initMode) ? TWIN : ACCENT;
          const bw = w / bars * 0.6;
          const bx = (mm - 1) * (w / bars) + w / bars * 0.2;
          ctx.fillRect(bx, h * 0.92 - e * h * 0.4, bw, e * h * 0.4);
        }
      },
      metrics(): Metric[] {
        return [
          { label: "모드1 에너지비", value: fmt(modeEnergy(1) / (E0 || 1), 3) },
          { label: "비선형 α", value: fmt(alpha, 2) },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
    } as Sim;
  },
};
