import { P, Sim, SimSpec, Metric, DrawOpts, INK, ACCENT, TWIN, GRID, line, dot, clearBg } from "./types";
import { rk4, diverged, energyDrift } from "../core/integrators";

const g = 9.81;
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const wrap = (a: number) => { let d = ((a % (2 * Math.PI)) * 180) / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

/* 이중 진자 */
export const doublePendulum: SimSpec = {
  dt: 1 / 600,
  stepsPerFrame: 10,
  conservative: true,
  create(p, twin) {
    const m1 = 1, m2 = p.massRatio, L1 = 1, L2 = p.lengthRatio;
    let th1 = ((p.theta1 + (twin ?? 0)) * Math.PI) / 180;
    let th2 = (p.theta2 * Math.PI) / 180;
    let w1 = 0, w2 = 0, time = 0, div = false;
    const deriv = ([a1, a2, o1, o2]: number[]) => {
      const d = a1 - a2;
      const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
      const dw1 =
        (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) -
          2 * Math.sin(d) * m2 * (o2 * o2 * L2 + o1 * o1 * L1 * Math.cos(d))) / (L1 * den);
      const dw2 =
        (2 * Math.sin(d) * (o1 * o1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) +
          o2 * o2 * L2 * m2 * Math.cos(d))) / (L2 * den);
      return [o1, o2, dw1, dw2];
    };
    const energyOf = () => {
      const x2v = L1 * w1 * Math.cos(th1) + L2 * w2 * Math.cos(th2);
      const y2v = L1 * w1 * Math.sin(th1) + L2 * w2 * Math.sin(th2);
      const T = 0.5 * m1 * (L1 * w1) ** 2 + 0.5 * m2 * (x2v * x2v + y2v * y2v);
      const V = -(m1 + m2) * g * L1 * Math.cos(th1) - m2 * g * L2 * Math.cos(th2);
      return T + V;
    };
    const E0 = energyOf();
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([th1, th2, w1, w2], time, dt, deriv);
        [th1, th2, w1, w2] = s;
        time += dt;
        trail.push([L1 * Math.sin(th1) + L2 * Math.sin(th2), L1 * Math.cos(th1) + L2 * Math.cos(th2)]);
        if (trail.length > 500) trail.shift();
        if (diverged(s)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h * 0.4, scale = h * 0.22;
        ctx.strokeStyle = ACCENT + "44"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const x = ox + tx * scale, y = oy + ty * scale; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        const drawP = (a1: number, a2: number, col: string, al = 1) => {
          ctx.globalAlpha = al;
          const x1 = ox + L1 * Math.sin(a1) * scale, y1 = oy + L1 * Math.cos(a1) * scale;
          const x2 = x1 + L2 * Math.sin(a2) * scale, y2 = y1 + L2 * Math.cos(a2) * scale;
          ctx.strokeStyle = GRID; ctx.lineWidth = 2;
          line(ctx, ox, oy, x1, y1); line(ctx, x1, y1, x2, y2);
          dot(ctx, x1, y1, 8, col); dot(ctx, x2, y2, 10, col);
          ctx.globalAlpha = 1;
        };
        if (o.twin) { const t = o.twin as unknown as { _s(): number[] }; const st = t._s(); drawP(st[0], st[1], TWIN, 0.6); }
        drawP(th1, th2, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "θ₁", value: fmt(wrap(th1), 1), unit: "°" },
          { label: "θ₂", value: fmt(wrap(th2), 1), unit: "°" },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
      _s: () => [th1, th2, w1, w2],
    } as unknown as Sim;
  },
};

/* 강제 감쇠 진자 (무차원) */
export const drivenDampedPendulum: SimSpec = {
  dt: 1 / 400,
  stepsPerFrame: 6,
  create(p, twin) {
    const A = p.driveAmp, wd = p.driveFreq, b = p.damping;
    let th = 0.1 + (twin ?? 0) * Math.PI / 180, w = 0, time = 0, div = false;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([th, w], time, dt, ([TH, W], t) => [W, -Math.sin(TH) - b * W + A * Math.cos(wd * t)]);
        [th, w] = s; time += dt;
        trail.push([wrap(th) / 180 * Math.PI, w]);
        if (trail.length > 1500) trail.shift();
        if (diverged([w])) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w2: number, h: number, o: DrawOpts) {
        clearBg(ctx, w2, h);
        // 좌: 진자, 우: 위상공간
        const ox = w2 * 0.27, oy = h / 2, scale = h * 0.3;
        const drawB = (TH: number, col: string, al = 1) => {
          ctx.globalAlpha = al;
          const x = ox + Math.sin(TH) * scale, y = oy + Math.cos(TH) * scale;
          ctx.strokeStyle = GRID; ctx.lineWidth = 2; line(ctx, ox, oy, x, y);
          dot(ctx, x, y, 12, col); ctx.globalAlpha = 1;
        };
        if (o.twin) { const t = o.twin as unknown as { _th(): number }; drawB(t._th(), TWIN, 0.6); }
        drawB(th, ACCENT);
        // 위상 초상
        ctx.strokeStyle = ACCENT + "66"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([a, ww], i) => { const x = w2 * 0.72 + a * w2 * 0.14, y = oy - ww * scale * 0.18; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
      },
      metrics(): Metric[] {
        return [
          { label: "각도 θ", value: fmt(wrap(th), 1), unit: "°" },
          { label: "각속도", value: fmt(w, 2) },
          { label: "구동 진폭 A", value: fmt(A, 3) },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
      _th: () => th,
    } as unknown as Sim;
  },
};

/* 더핑 진동자 */
export const duffing: SimSpec = {
  dt: 1 / 400,
  stepsPerFrame: 6,
  create(p, twin) {
    const gm = p.gamma, d = p.delta, om = p.omega;
    let x = 0.1 + (twin ?? 0), v = 0, time = 0, div = false;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x, v], time, dt, ([X, V], t) => [V, -d * V + X - X * X * X + gm * Math.cos(om * t)]);
        [x, v] = s; time += dt;
        trail.push([x, v]);
        if (trail.length > 1500) trail.shift();
        if (diverged(s)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        // 이중우물 퍼텐셜 + 공 + 위상초상
        const ox = w / 2, oy = h * 0.34, sc = w * 0.14;
        ctx.strokeStyle = GRID; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let X = -2; X <= 2; X += 0.05) { const V = -X * X / 2 + X * X * X * X / 4; const px = ox + X * sc, py = oy - V * h * 0.12 + h * 0.08; X === -2 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
        const ballV = -x * x / 2 + x * x * x * x / 4;
        dot(ctx, ox + x * sc, oy - ballV * h * 0.12 + h * 0.08, 9, ACCENT);
        ctx.strokeStyle = ACCENT + "55"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([X, V], i) => { const px = ox + X * sc, py = h * 0.78 - V * h * 0.1; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        if (o.twin) { const t = o.twin as unknown as { _x(): number }; const tx = t._x(); dot(ctx, ox + tx * sc, oy - (-(tx * tx) / 2 + tx * tx * tx * tx / 4) * h * 0.12 + h * 0.08, 7, TWIN); }
      },
      metrics(): Metric[] {
        return [
          { label: "위치 x", value: fmt(x, 3) },
          { label: "속도 v", value: fmt(v, 3) },
          { label: "우물", value: x > 0 ? "오른쪽" : "왼쪽" },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
      _x: () => x,
    } as unknown as Sim;
  },
};

/* 자석 진자 */
export const magneticPendulum: SimSpec = {
  dt: 1 / 200,
  stepsPerFrame: 3,
  create(p, twin) {
    const nm = Math.round(p.magnets), km = p.magStrength, b = p.damping, hh = p.height, kp = 0.5;
    const mags = Array.from({ length: nm }, (_, i) => {
      const a = (i / nm) * 2 * Math.PI - Math.PI / 2;
      return [0.4 * Math.cos(a), 0.4 * Math.sin(a), (i * 360) / nm];
    });
    let x = 0.9 + (twin ?? 0), y = 0.6, vx = 0, vy = 0, time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const acc = ([X, Y, VX, VY]: number[]) => {
          let ax = -kp * X - b * VX, ay = -kp * Y - b * VY;
          for (const [mx, my] of mags) {
            const dx = mx - X, dy = my - Y;
            const r = Math.pow(dx * dx + dy * dy + hh * hh, 1.5);
            ax += (km * dx) / r; ay += (km * dy) / r;
          }
          return [VX, VY, ax, ay];
        };
        const s = rk4([x, y, vx, vy], time, dt, acc);
        [x, y, vx, vy] = s; time += dt;
        trail.push([x, y]); if (trail.length > 600) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.42;
        mags.forEach(([mx, my, hue]) => dot(ctx, ox + mx * sc, oy + my * sc, 10, `hsl(${hue},70%,55%)`));
        ctx.strokeStyle = ACCENT + "55"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([X, Y], i) => { const px = ox + X * sc, py = oy + Y * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        if (o.twin) { const t = o.twin as unknown as { _p(): number[] }; const pp = t._p(); dot(ctx, ox + pp[0] * sc, oy + pp[1] * sc, 6, TWIN); }
        dot(ctx, ox + x * sc, oy + y * sc, 8, ACCENT);
      },
      metrics(): Metric[] {
        let nearest = 0, best = 1e9;
        mags.forEach(([mx, my], i) => { const d = Math.hypot(mx - x, my - y); if (d < best) { best = d; nearest = i; } });
        return [
          { label: "위치", value: `(${fmt(x, 2)}, ${fmt(y, 2)})` },
          { label: "속력", value: fmt(Math.hypot(vx, vy), 3), unit: "m/s" },
          { label: "가장 가까운 자석", value: `#${nearest + 1}` },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
      _p: () => [x, y],
    } as unknown as Sim;
  },
};

/* 표준 사상(킥 로터) */
export const standardMap: SimSpec = {
  dt: 1, stepsPerFrame: 1, autoplay: true,
  create(p, twin) {
    const K = p.K, orbits = Math.round(p.orbits);
    const pts: { th: number; p: number }[] = [];
    for (let i = 0; i < orbits; i++) {
      pts.push({ th: (i / orbits) * 2 * Math.PI, p: (i / orbits) * 2 * Math.PI + (twin ?? 0) });
    }
    let time = 0, iter = 0;
    const all: [number, number][][] = pts.map(() => []);
    return {
      get time() { return time; },
      step() {
        for (let i = 0; i < pts.length; i++) {
          pts[i].p = (pts[i].p + K * Math.sin(pts[i].th));
          pts[i].th = pts[i].th + pts[i].p;
          const th = ((pts[i].th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const pp = ((pts[i].p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          all[i].push([th, pp]);
          if (all[i].length > 400) all[i].shift();
        }
        iter++; time += 1;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        all.forEach((orb, i) => {
          ctx.fillStyle = `hsl(${(i * 360) / pts.length},70%,60%)`;
          orb.forEach(([th, pp]) => ctx.fillRect((th / (2 * Math.PI)) * w, h - (pp / (2 * Math.PI)) * h, 1.4, 1.4));
        });
      },
      metrics(): Metric[] {
        return [
          { label: "킥 세기 K", value: fmt(K, 2) },
          { label: "반복 횟수", value: String(iter) },
          { label: "상태", value: K < 0.97 ? "규칙 곡선 우세" : "전역 카오스" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 동역학 당구 (스타디움) */
export const billiards: SimSpec = {
  dt: 1 / 60, stepsPerFrame: 3,
  create(p, twin) {
    const shape = Math.round(p.shape), asp = p.aspect;
    const ang = ((p.launchAngle + (twin ?? 0)) * Math.PI) / 180;
    let x = 0, y = 0.2, vx = Math.cos(ang), vy = Math.sin(ang);
    let time = 0;
    const trail: [number, number][] = [];
    // 스타디움: 반원(반지름1) + 직선부 길이 2L, L=asp-1
    const L = asp - 1;
    const inside = (px: number, py: number) => {
      if (shape === 0) return px * px + py * py <= 1;
      if (shape === 1) return (px / asp) ** 2 + py * py <= 1;
      if (Math.abs(px) <= L) return Math.abs(py) <= 1;
      const cx = px > 0 ? L : -L;
      return (px - cx) ** 2 + py * py <= 1;
    };
    const normal = (px: number, py: number): [number, number] => {
      if (shape === 0) { const r = Math.hypot(px, py); return [px / r, py / r]; }
      if (shape === 1) { const nx = px / (asp * asp), ny = py; const r = Math.hypot(nx, ny); return [nx / r, ny / r]; }
      if (Math.abs(px) <= L) return [0, Math.sign(py)];
      const cx = px > 0 ? L : -L; const dx = px - cx, dy = py; const r = Math.hypot(dx, dy); return [dx / r, dy / r];
    };
    return {
      get time() { return time; },
      step(dt: number) {
        let nx = x + vx * dt, ny = y + vy * dt;
        if (!inside(nx, ny)) {
          const [nrx, nry] = normal(x, y);
          const dot2 = vx * nrx + vy * nry;
          vx -= 2 * dot2 * nrx; vy -= 2 * dot2 * nry;
          nx = x + vx * dt; ny = y + vy * dt;
        }
        x = nx; y = ny; time += dt;
        trail.push([x, y]); if (trail.length > 900) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w / (2 * asp + 1), h / 2.4);
        ctx.strokeStyle = GRID; ctx.lineWidth = 2;
        ctx.beginPath();
        if (shape === 0) ctx.arc(ox, oy, sc, 0, 2 * Math.PI);
        else if (shape === 1) ctx.ellipse(ox, oy, sc * asp, sc, 0, 0, 2 * Math.PI);
        else {
          ctx.moveTo(ox - L * sc, oy - sc); ctx.lineTo(ox + L * sc, oy - sc);
          ctx.arc(ox + L * sc, oy, sc, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(ox - L * sc, oy + sc);
          ctx.arc(ox - L * sc, oy, sc, Math.PI / 2, (3 * Math.PI) / 2);
        }
        ctx.stroke();
        ctx.strokeStyle = ACCENT + "88"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        if (o.twin) { const t = o.twin as unknown as { _p(): number[] }; const pp = t._p(); dot(ctx, ox + pp[0] * sc, oy + pp[1] * sc, 5, TWIN); }
        dot(ctx, ox + x * sc, oy + y * sc, 5, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "경계", value: shape === 0 ? "원(가적분)" : shape === 1 ? "타원(가적분)" : "스타디움(카오스)" },
          { label: "위치", value: `(${fmt(x, 2)}, ${fmt(y, 2)})` },
          { label: "속력", value: fmt(Math.hypot(vx, vy), 3) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
      _p: () => [x, y],
    } as unknown as Sim;
  },
};

/* 에농-하일레스 */
export const henonHeiles: SimSpec = {
  dt: 1 / 200, stepsPerFrame: 4, conservative: true,
  create(p, twin) {
    const E = p.energy, view = Math.round(p.viewMode);
    let x = 0, y = p.y0 + (twin ?? 0), px = 0;
    // py from energy: E = 0.5(px²+py²)+0.5(x²+y²)+x²y - y³/3
    const V = 0.5 * (x * x + y * y) + x * x * y - (y * y * y) / 3;
    let py2 = 2 * (E - V) - px * px;
    let py = py2 > 0 ? Math.sqrt(py2) : 0;
    let time = 0, div = false;
    const trail: [number, number][] = [];
    const section: [number, number][] = [];
    const energyOf = () => 0.5 * (px * px + py * py) + 0.5 * (x * x + y * y) + x * x * y - (y * y * y) / 3;
    const E0 = energyOf();
    return {
      get time() { return time; },
      step(dt: number) {
        const prevX = x, prevPx = px;
        const s = rk4([x, y, px, py], time, dt, ([X, Y, PX, PY]) => [
          PX, PY, -(X + 2 * X * Y), -(Y + X * X - Y * Y),
        ]);
        [x, y, px, py] = s; time += dt;
        trail.push([x, y]); if (trail.length > 800) trail.shift();
        // 푸앵카레 단면 x=0, px>0
        if (prevX < 0 && x >= 0 && px > 0) section.push([y, py]);
        if (diverged(s)) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.4;
        if (view === 0) {
          ctx.strokeStyle = ACCENT + "66"; ctx.lineWidth = 1;
          ctx.beginPath();
          trail.forEach(([tx, ty], i) => { const gx = ox + tx * sc, gy = oy - ty * sc; i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy); });
          ctx.stroke();
          dot(ctx, ox + x * sc, oy - y * sc, 5, ACCENT);
        } else {
          ctx.fillStyle = TWIN;
          section.forEach(([yy, pp]) => ctx.fillRect(ox + yy * sc, oy - pp * sc, 2, 2));
        }
      },
      metrics(): Metric[] {
        return [
          { label: "총 에너지 E", value: fmt(E, 3) },
          { label: "단면 점 수", value: String(section.length) },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
    } as Sim;
  },
};

/* 혼돈 물레바퀴(말커스) — 로렌츠 등가 */
export const chaoticWaterwheel: SimSpec = {
  dt: 1 / 200, stepsPerFrame: 4,
  create(p, twin) {
    const q = p.inflow, K = p.leak, nu = p.friction, nc = Math.round(p.cups);
    const I = 1, gR = 9.81;
    let omega = 0.1 + (twin ?? 0), a = 0, b = 0.1; // 질량분포 1차 푸리에 계수
    let time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([omega, a, b], time, dt, ([W, A, B]) => [
          (-nu * W + gR * A) / I,
          W * B - K * A,
          -W * A - K * B + q,
        ]);
        [omega, a, b] = s; time += dt;
        trail.push([a, omega]); if (trail.length > 800) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w * 0.3, oy = h / 2, R = Math.min(w, h) * 0.3;
        ctx.strokeStyle = GRID; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ox, oy, R, 0, 2 * Math.PI); ctx.stroke();
        const phase = time * omega;
        for (let i = 0; i < nc; i++) {
          const ang = (i / nc) * 2 * Math.PI + phase;
          const fill = 0.5 + a * Math.cos(ang) + b * Math.sin(ang);
          const cx = ox + Math.cos(ang) * R, cy = oy + Math.sin(ang) * R;
          dot(ctx, cx, cy, 5 + Math.max(0, fill) * 8, ACCENT);
        }
        // 위상초상(a vs omega)
        ctx.strokeStyle = TWIN + "88"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([A, W], i) => { const gx = w * 0.72 + A * w * 0.1, gy = oy - W * 12; i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy); });
        ctx.stroke();
        if (o.twin) { const t = o.twin as unknown as { _w(): number }; }
      },
      metrics(): Metric[] {
        return [
          { label: "각속도 ω", value: fmt(omega, 3), unit: "rad/s" },
          { label: "회전 방향", value: omega > 0.05 ? "정방향" : omega < -0.05 ? "역방향" : "정지 근처" },
          { label: "급수량 q", value: fmt(q, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
      _w: () => omega,
    } as unknown as Sim;
  },
};
