import { P, Sim, SimSpec, Metric, DrawOpts, INK, ACCENT, TWIN, GRID, line, dot, clearBg } from "./types";
import { rk4, velocityVerlet, diverged, energyDrift } from "../core/integrators";

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");

/* 역제곱 힘 궤도(케플러·러더퍼드) */
export const inverseSquareOrbit: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 5, conservative: true,
  create(p) {
    const sign = Math.round(p.forceSign) === 0 ? -1 : 1; // -1 인력, +1 척력
    const k = 1;
    const b = p.impactParam;
    let x = -3, y = sign > 0 ? b : p.r0 * 0 + b * 0; // 산란: 먼 곳에서 접근
    let vx = p.v0, vy = 0;
    // 인력 케플러: 원궤도 근처 초기조건
    if (sign < 0) { x = p.r0; y = 0; vx = 0; vy = p.v0; }
    else { x = -3; y = b; vx = p.v0; vy = 0; }
    let time = 0, div = false;
    const trail: [number, number][] = [];
    const energyOf = () => 0.5 * (vx * vx + vy * vy) + sign * k / Math.hypot(x, y) * -1 * (sign < 0 ? 1 : -1);
    const E0 = 0.5 * p.v0 * p.v0;
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x, y, vx, vy], time, dt, ([X, Y, VX, VY]) => {
          const r = Math.hypot(X, Y) + 1e-4;
          const f = (sign * -1) * k / (r * r * r); // 인력이면 중심 방향
          return [VX, VY, (sign < 0 ? -k : k) * X / (r * r * r), (sign < 0 ? -k : k) * Y / (r * r * r)];
        });
        [x, y, vx, vy] = s; time += dt;
        trail.push([x, y]); if (trail.length > 1200) trail.shift();
        if (diverged(s) || Math.hypot(x, y) > 12) div = sign < 0 ? div : false;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.13;
        dot(ctx, ox, oy, 8, sign < 0 ? "#fbbf24" : "#f87171");
        ctx.strokeStyle = ACCENT + "88"; ctx.lineWidth = 1.4;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        dot(ctx, ox + x * sc, oy + y * sc, 6, ACCENT);
      },
      metrics(): Metric[] {
        const r = Math.hypot(x, y), speed = Math.hypot(vx, vy);
        const escape = Math.sqrt(2 / p.r0);
        return [
          { label: "힘", value: sign < 0 ? "인력(중력)" : "척력(쿨롱)" },
          { label: "거리 r", value: fmt(r, 2), unit: "AU" },
          { label: sign < 0 ? "탈출속도 비" : "속력", value: sign < 0 ? fmt(p.v0 / escape, 2) : fmt(speed, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 삼체 문제 */
export const threeBody: SimSpec = {
  dt: 1 / 800, stepsPerFrame: 12, conservative: true,
  create(p, twin) {
    const preset = Math.round(p.preset), soft = p.softening;
    type B = { x: number; y: number; vx: number; vy: number; m: number };
    let bodies: B[];
    const mr = p.massRatio;
    if (preset === 0) {
      // 피겨8 (Chenciner-Montgomery)
      const px = 0.97000436, py = -0.24308753;
      bodies = [
        { x: -px, y: -py, vx: 0.4662036850, vy: 0.4323657300, m: 1 },
        { x: px, y: py, vx: 0.4662036850, vy: 0.4323657300, m: 1 },
        { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146, m: 1 },
      ];
      bodies[0].x += (twin ?? 0);
    } else if (preset === 2) {
      bodies = [
        { x: -0.5, y: 0, vx: 0, vy: -0.7, m: 1 },
        { x: 0.5, y: 0, vx: 0, vy: 0.7, m: 1 },
        { x: 1.6, y: 0, vx: 0, vy: 1.3, m: 0.05 },
      ];
    } else if (preset === 3) {
      bodies = [
        { x: 0, y: 0, vx: 0, vy: 0, m: 3 },
        { x: 2, y: 0, vx: 0, vy: 1.2, m: 0.02 },
        { x: -2.5, y: 1, vx: 0.5, vy: 0.2, m: 0.02 },
      ];
    } else {
      bodies = [
        { x: -1, y: 0, vx: 0, vy: -0.5, m: 1 },
        { x: 1, y: 0.3, vx: 0.3, vy: 0.5, m: mr },
        { x: 0, y: 1, vx: -0.4, vy: 0, m: 0.8 },
      ];
      bodies[0].x += (twin ?? 0);
    }
    let time = 0, div = false;
    const trails: [number, number][][] = bodies.map(() => []);
    const accel = (bs: B[]) => bs.map((bi, i) => {
      let ax = 0, ay = 0;
      bs.forEach((bj, j) => { if (i === j) return; const dx = bj.x - bi.x, dy = bj.y - bi.y; const r = Math.pow(dx * dx + dy * dy + soft * soft, 1.5); ax += bj.m * dx / r; ay += bj.m * dy / r; });
      return [ax, ay];
    });
    return {
      get time() { return time; },
      step(dt: number) {
        const a0 = accel(bodies);
        bodies.forEach((b, i) => { b.x += b.vx * dt + 0.5 * a0[i][0] * dt * dt; b.y += b.vy * dt + 0.5 * a0[i][1] * dt * dt; });
        const a1 = accel(bodies);
        bodies.forEach((b, i) => { b.vx += 0.5 * (a0[i][0] + a1[i][0]) * dt; b.vy += 0.5 * (a0[i][1] + a1[i][1]) * dt; });
        time += dt;
        bodies.forEach((b, i) => { trails[i].push([b.x, b.y]); if (trails[i].length > 500) trails[i].shift(); });
        if (bodies.some((b) => diverged([b.x, b.y]))) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.22;
        const cols = ["#38bdf8", "#f472b6", "#fbbf24"];
        trails.forEach((tr, i) => {
          ctx.strokeStyle = cols[i] + "66"; ctx.lineWidth = 1;
          ctx.beginPath();
          tr.forEach(([tx, ty], k) => { const px = ox + tx * sc, py = oy + ty * sc; k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
          ctx.stroke();
        });
        bodies.forEach((b, i) => dot(ctx, ox + b.x * sc, oy + b.y * sc, 4 + 4 * Math.cbrt(b.m), cols[i]));
      },
      metrics(): Metric[] {
        return [
          { label: "배치", value: ["피겨8", "무작위", "쌍성+행성", "슬링샷"][preset] },
          { label: "물체 수", value: "3" },
          { label: "상태", value: div ? "충돌/발산" : "진행 중" },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
    } as Sim;
  },
};

/* N체 성단 (워커 후보지만 중간규모는 메인) */
export const nBodyCluster: SimSpec = {
  dt: 1 / 200, stepsPerFrame: 1,
  create(p) {
    const N = Math.round(p.bodies), soft = p.softening, spin = p.initialSpin;
    const xs = new Float64Array(N), ys = new Float64Array(N), vxs = new Float64Array(N), vys = new Float64Array(N);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(rnd()) * 0.8, a = rnd() * 2 * Math.PI;
      xs[i] = r * Math.cos(a); ys[i] = r * Math.sin(a);
      vxs[i] = -ys[i] * spin + (rnd() - 0.5) * 0.1;
      vys[i] = xs[i] * spin + (rnd() - 0.5) * 0.1;
    }
    const m = 1 / N;
    let time = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        const ax = new Float64Array(N), ay = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const dx = xs[j] - xs[i], dy = ys[j] - ys[i];
            const r2 = dx * dx + dy * dy + soft * soft;
            const inv = 1 / (r2 * Math.sqrt(r2));
            const fx = dx * inv * m, fy = dy * inv * m;
            ax[i] += fx; ay[i] += fy; ax[j] -= fx; ay[j] -= fy;
          }
        }
        for (let i = 0; i < N; i++) { vxs[i] += ax[i] * dt; vys[i] += ay[i] * dt; xs[i] += vxs[i] * dt; ys[i] += vys[i] * dt; }
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.3;
        ctx.fillStyle = ACCENT;
        for (let i = 0; i < N; i++) {
          const speed = Math.hypot(vxs[i], vys[i]);
          ctx.fillStyle = `hsl(${210 - Math.min(120, speed * 60)},70%,${55 + Math.min(30, speed * 20)}%)`;
          ctx.fillRect(ox + xs[i] * sc, oy + ys[i] * sc, 1.6, 1.6);
        }
      },
      metrics(): Metric[] {
        let cx = 0, cy = 0; for (let i = 0; i < N; i++) { cx += xs[i]; cy += ys[i]; }
        return [
          { label: "천체 수 N", value: String(N) },
          { label: "초기 회전", value: fmt(spin, 2) },
          { label: "계산", value: "직접합 O(N²)" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 상대론적 근일점 세차 */
export const relativisticPrecession: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 6,
  create(p) {
    const rp = p.periRadius, e = p.eccentricity, rel = p.relFactor;
    // u=1/r as function of phi: u'' + u = 1/(rp(1+e)... ) — 여기선 시간적분 대신 궤도적분
    const GM = 1;
    const a = rp / (1 - e);
    const L = Math.sqrt(GM * a * (1 - e * e));
    // 극좌표 상태 r, dr, phi
    let r = rp, dr = 0, phi = 0;
    let time = 0;
    const trail: [number, number][] = [];
    const orbits = Math.round(p.orbitCount);
    let lastPeri = phi, precession = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        // 유효 퍼텐셜 운동: r'' = L²/r³ - GM/r² - rel*3GM·L²/(c²r⁴), c=10 스케일
        const c2 = 100;
        const s = rk4([r, dr, phi], time, dt, ([R, DR, PHI]) => {
          const ddr = L * L / (R * R * R) - GM / (R * R) - rel * 3 * GM * L * L / (c2 * R * R * R * R);
          return [DR, ddr, L / (R * R)];
        });
        [r, dr, phi] = s; time += dt;
        trail.push([r * Math.cos(phi), r * Math.sin(phi)]);
        if (trail.length > 4000) trail.shift();
        if (phi > orbits * 2 * Math.PI) { r = rp; dr = 0; phi = 0; trail.length = 0; }
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.4 / (rp / (1 - e));
        dot(ctx, ox, oy, 7, "#fbbf24");
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.2;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        dot(ctx, ox + r * Math.cos(phi) * sc, oy + r * Math.sin(phi) * sc, 5, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "근일점 거리", value: fmt(rp, 1), unit: "GM/c²" },
          { label: "이심률 e", value: fmt(e, 2) },
          { label: "모드", value: rel < 0.05 ? "뉴턴(닫힘)" : "GR(세차)" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 진동 애트우드 머신 */
export const swingingAtwood: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 6, conservative: true,
  create(p, twin) {
    const mu = p.massRatio, g = 9.81;
    let r = p.r0, dr = 0, th = ((p.theta0 + (twin ?? 0)) * Math.PI) / 180, dth = 0;
    let time = 0, div = false;
    const trail: [number, number][] = [];
    const energyOf = () => 0.5 * (mu + 1) * dr * dr + 0.5 * r * r * dth * dth + mu * g * r - g * r * Math.cos(th);
    const E0 = energyOf();
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([r, dr, th, dth], time, dt, ([R, DR, TH, DTH]) => [
          DR,
          (R * DTH * DTH - mu * g + g * Math.cos(TH)) / (mu + 1),
          DTH,
          (-2 * DR * DTH - g * Math.sin(TH)) / R,
        ]);
        [r, dr, th, dth] = s; time += dt;
        trail.push([r * Math.sin(th), r * Math.cos(th)]);
        if (trail.length > 700) trail.shift();
        if (diverged(s) || r < 0.02) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w * 0.5, oy = h * 0.15, sc = (h * 0.7) / (p.r0 + 1);
        // 진자추
        const bx = ox + r * Math.sin(th) * sc, by = oy + r * Math.cos(th) * sc;
        ctx.strokeStyle = ACCENT + "66"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        ctx.strokeStyle = GRID; ctx.lineWidth = 2; line(ctx, ox, oy, bx, by);
        dot(ctx, bx, by, 9, ACCENT);
        // 반대편 추 M
        const My = oy + (p.r0 * 2 - r) * sc * 0.4;
        line(ctx, ox - 40, oy, ox - 40, My);
        dot(ctx, ox - 40, My, 7 + Math.cbrt(mu) * 4, TWIN);
      },
      metrics(): Metric[] {
        return [
          { label: "질량비 μ", value: fmt(mu, 2) },
          { label: "줄 길이 r", value: fmt(r, 3), unit: "m" },
          { label: "에너지 드리프트", value: fmt(energyDrift(energyOf(), E0), 3), unit: "%" },
        ];
      },
      energy() { return energyOf(); },
      diverged() { return div; },
    } as Sim;
  },
};
