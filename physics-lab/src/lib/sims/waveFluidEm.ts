import { P, Sim, SimSpec, Metric, DrawOpts, INK, ACCENT, TWIN, GRID, line, dot, clearBg } from "./types";
import { rk4, diverged } from "../core/integrators";

const g = 9.81;
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");

/* ── 파동 ── */

export const waveOnString: SimSpec = {
  dt: 1 / 600, stepsPerFrame: 12,
  create(p) {
    const N = 200, c = p.waveSpeed, end = Math.round(p.endType), src = Math.round(p.sourceType), fd = p.driveFreq;
    const y = new Float64Array(N), v = new Float64Array(N);
    const dx = 1 / N;
    let time = 0;
    if (src === 0) for (let i = 0; i < N; i++) y[i] = Math.exp(-((i / N - 0.3) ** 2) / 0.002);
    return {
      get time() { return time; },
      step(dt: number) {
        const a = new Float64Array(N);
        for (let i = 1; i < N - 1; i++) a[i] = (c * c) * (y[i + 1] - 2 * y[i] + y[i - 1]) / (dx * dx) - 0.02 * v[i];
        for (let i = 1; i < N - 1; i++) { v[i] += a[i] * dt; y[i] += v[i] * dt; }
        // 경계
        if (end === 0) { y[0] = 0; y[N - 1] = 0; }
        else if (end === 1) { y[0] = y[1]; y[N - 1] = y[N - 2]; }
        else { y[0] = y[1] * 0.5; y[N - 1] = y[N - 2] * 0.5; }
        if (src === 1) y[0] = 0.3 * Math.sin(2 * Math.PI * fd * time);
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        ctx.strokeStyle = GRID; line(ctx, 0, h / 2, w, h / 2);
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < N; i++) { const px = (i / (N - 1)) * w, py = h / 2 - y[i] * h * 0.35; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      },
      metrics(): Metric[] {
        return [
          { label: "파속 c", value: fmt(p.waveSpeed, 2) },
          { label: "끝 조건", value: ["고정", "자유", "흡수"][end] },
          { label: "구동", value: src === 0 ? "펄스" : "연속 사인" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const rippleTank: SimSpec = {
  dt: 1 / 300, stepsPerFrame: 3,
  create(p) {
    const GW = 160, GH = 110, c = 0.5;
    const u = new Float64Array(GW * GH), un = new Float64Array(GW * GH), uo = new Float64Array(GW * GH);
    const nSrc = Math.round(p.sources), freq = p.frequency, barrier = Math.round(p.barrier), slit = Math.round(p.slitWidth);
    const srcs = Array.from({ length: nSrc }, (_, i) => nSrc === 1 ? [GW * 0.3, GH / 2] : [GW * 0.2, GH * (0.35 + 0.3 * i)]);
    let time = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
          const i = y * GW + x;
          const lap = u[i - 1] + u[i + 1] + u[i - GW] + u[i + GW] - 4 * u[i];
          un[i] = 2 * u[i] - uo[i] + c * c * lap;
          un[i] *= 0.999;
        }
        // 장벽
        if (barrier > 0) {
          const bx = Math.floor(GW * 0.45);
          for (let y = 0; y < GH; y++) {
            let block = true;
            if (barrier === 1 && Math.abs(y - GH / 2) < slit) block = false;
            if (barrier === 2 && (Math.abs(y - GH * 0.4) < slit || Math.abs(y - GH * 0.6) < slit)) block = false;
            if (block) { un[y * GW + bx] = 0; un[y * GW + bx + 1] = 0; }
          }
        }
        srcs.forEach(([sx, sy]) => { un[Math.floor(sy) * GW + Math.floor(sx)] = 0.6 * Math.sin(2 * Math.PI * freq * time); });
        uo.set(u); u.set(un); time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const img = ctx.createImageData(w, h);
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
          const gx = Math.floor((px / w) * GW), gy = Math.floor((py / h) * GH);
          const val = u[gy * GW + gx];
          const c2 = Math.max(0, Math.min(255, 128 + val * 300));
          const idx = (py * w + px) * 4;
          img.data[idx] = c2 * 0.3; img.data[idx + 1] = c2 * 0.6; img.data[idx + 2] = c2; img.data[idx + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      },
      metrics(): Metric[] {
        return [
          { label: "파원 수", value: String(nSrc) },
          { label: "진동수", value: fmt(freq, 1), unit: "Hz" },
          { label: "장애물", value: ["없음", "단일 틈", "이중 틈"][barrier] },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const dopplerEffect: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2,
  create(p) {
    const vs = p.sourceSpeed, freq = p.frequency, path = Math.round(p.path);
    let sx = 0.1, sy = 0.5, time = 0;
    const wavefronts: { x: number; y: number; t: number }[] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        time += dt;
        if (path === 0) { sx += vs * dt * 0.3; if (sx > 1.1) { sx = -0.1; wavefronts.length = 0; } sy = 0.5; }
        else { const a = time * vs * 2; sx = 0.5 + Math.cos(a) * 0.25; sy = 0.5 + Math.sin(a) * 0.25; }
        if (Math.floor(time * freq) > Math.floor((time - dt) * freq)) wavefronts.push({ x: sx, y: sy, t: time });
        while (wavefronts.length > 40) wavefronts.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        wavefronts.forEach((wf) => {
          const r = (time - wf.t) * 0.3 * Math.min(w, h);
          ctx.strokeStyle = ACCENT + "66"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(wf.x * w, wf.y * h, r, 0, 2 * Math.PI); ctx.stroke();
        });
        dot(ctx, sx * w, sy * h, 7, TWIN);
      },
      metrics(): Metric[] {
        return [
          { label: "파원 속도", value: fmt(vs, 2), unit: "마하" },
          { label: "상태", value: vs > 1 ? "초음속(마하 원뿔)" : "아음속" },
          { label: "마하각", value: vs > 1 ? fmt((Math.asin(1 / vs) * 180) / Math.PI, 0) + "°" : "—" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const diffusionHeat: SimSpec = {
  dt: 1 / 60, stepsPerFrame: 2,
  create(p) {
    const D = p.diffusivity, init = Math.round(p.initCondition), view = Math.round(p.viewMode), np = Math.round(p.particles);
    const N = 120;
    const field = new Float64Array(N * N);
    let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const parts = Array.from({ length: np }, () => {
      if (init === 0) return [N / 2 + (rnd() - 0.5) * 4, N / 2 + (rnd() - 0.5) * 4];
      if (init === 1) return [rnd() < 0.5 ? N * 0.3 : N * 0.7, rnd() * N];
      return [rnd() * N, N / 2];
    });
    if (init === 0) for (let dy = -3; dy < 3; dy++) for (let dx = -3; dx < 3; dx++) field[(N / 2 + dy) * N + (N / 2 + dx)] = 1;
    let time = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        // 연속장
        const f2 = new Float64Array(N * N);
        for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
          const i = y * N + x;
          f2[i] = field[i] + D * 0.15 * (field[i - 1] + field[i + 1] + field[i - N] + field[i + N] - 4 * field[i]);
        }
        field.set(f2);
        // 랜덤워크
        parts.forEach((pt) => { pt[0] += (rnd() - 0.5) * Math.sqrt(D) * 2; pt[1] += (rnd() - 0.5) * Math.sqrt(D) * 2; });
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        if (view === 1 || view === 2) {
          const ww = view === 2 ? w / 2 : w;
          const img = ctx.createImageData(Math.floor(ww), h);
          for (let py = 0; py < h; py++) for (let px = 0; px < Math.floor(ww); px++) {
            const v = field[Math.floor((py / h) * N) * N + Math.floor((px / ww) * N)];
            const idx = (py * Math.floor(ww) + px) * 4;
            const c = Math.min(255, v * 255);
            img.data[idx] = c; img.data[idx + 1] = c * 0.4; img.data[idx + 2] = 40 + c * 0.2; img.data[idx + 3] = 255;
          }
          ctx.putImageData(img, view === 2 ? Math.floor(w / 2) : 0, 0);
        }
        if (view === 0 || view === 2) {
          const ww = view === 2 ? w / 2 : w;
          ctx.fillStyle = ACCENT;
          parts.forEach((pt) => ctx.fillRect((pt[0] / N) * ww, (pt[1] / N) * h, 1.6, 1.6));
        }
      },
      metrics(): Metric[] {
        return [
          { label: "확산계수 D", value: fmt(D, 2) },
          { label: "⟨x²⟩ ≈ 2Dt", value: fmt(2 * D * time, 2) },
          { label: "보기", value: ["입자", "연속장", "병렬"][view] },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const hangingChain: SimSpec = {
  dt: 1 / 600, stepsPerFrame: 10,
  create(p) {
    const N = Math.round(p.links), k = p.stiffness, scen = Math.round(p.scenario), damp = p.damping;
    const L = 2 / N;
    const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1), vxs = new Float64Array(N + 1), vys = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { xs[i] = (i / N) * 2 - 1; ys[i] = scen === 1 ? 0 : 0; }
    let time = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        const axs = new Float64Array(N + 1), ays = new Float64Array(N + 1);
        for (let i = 0; i <= N; i++) ays[i] = -g;
        for (let i = 0; i < N; i++) {
          const dx = xs[i + 1] - xs[i], dy = ys[i + 1] - ys[i];
          const d = Math.hypot(dx, dy) || 1e-6;
          const f = k * (d - L);
          const fx = f * dx / d, fy = f * dy / d;
          axs[i] += fx; ays[i] += fy; axs[i + 1] -= fx; ays[i + 1] -= fy;
        }
        for (let i = 0; i <= N; i++) {
          axs[i] -= damp * vxs[i]; ays[i] -= damp * vys[i];
          vxs[i] += axs[i] * dt; vys[i] += ays[i] * dt;
          xs[i] += vxs[i] * dt; ys[i] += vys[i] * dt;
        }
        // 고정단
        if (scen === 0) { xs[0] = -1; ys[0] = 0; vxs[0] = vys[0] = 0; xs[N] = 1; ys[N] = 0; vxs[N] = vys[N] = 0; }
        else if (scen === 2) { xs[0] = -1; ys[0] = 0.3 * Math.sin(6 * time); vxs[0] = vys[0] = 0; }
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h * 0.25, sc = Math.min(w, h) * 0.32;
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) { const px = ox + xs[i] * sc, py = oy + ys[i] * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
        for (let i = 0; i <= N; i += Math.ceil(N / 20)) dot(ctx, ox + xs[i] * sc, oy + ys[i] * sc, 3, TWIN);
      },
      metrics(): Metric[] {
        return [
          { label: "마디 수", value: String(N) },
          { label: "강성", value: fmt(k, 0), unit: "N/m" },
          { label: "상황", value: ["현수선", "슬링키 낙하", "파동 전파"][scen] },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* ── 유체·다체·통계 ── */

export const gasInBox: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2,
  create(p) {
    const N = Math.round(p.particles), T = p.temperature, vol = p.volume, mode = Math.round(p.mode);
    const xs = new Float64Array(N), ys = new Float64Array(N), vxs = new Float64Array(N), vys = new Float64Array(N);
    let seed = 9; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const wall = 1 - (1 - vol) * 0.5;
    for (let i = 0; i < N; i++) {
      xs[i] = mode === 2 && i < N / 2 ? rnd() * 0.4 : rnd() * wall;
      ys[i] = rnd(); const sp = Math.sqrt(T) * (0.5 + rnd()); const a = rnd() * 2 * Math.PI;
      vxs[i] = Math.cos(a) * sp; vys[i] = Math.sin(a) * sp;
    }
    const r = 0.008;
    let time = 0, pressure = 0, pAcc = 0, pCount = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        pAcc = 0;
        for (let i = 0; i < N; i++) {
          xs[i] += vxs[i] * dt; ys[i] += vys[i] * dt;
          if (xs[i] < 0) { xs[i] = 0; vxs[i] = -vxs[i]; pAcc += Math.abs(vxs[i]); }
          if (xs[i] > wall) { xs[i] = wall; vxs[i] = -vxs[i]; pAcc += Math.abs(vxs[i]); }
          if (ys[i] < 0) { ys[i] = 0; vys[i] = -vys[i]; }
          if (ys[i] > 1) { ys[i] = 1; vys[i] = -vys[i]; }
        }
        // 충돌(공간 격자 근사 생략, 표본 쌍)
        for (let s = 0; s < N; s++) {
          const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N);
          if (i === j) continue;
          const dx = xs[j] - xs[i], dy = ys[j] - ys[i], d2 = dx * dx + dy * dy;
          if (d2 < 4 * r * r && d2 > 1e-9) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
            const dvx = vxs[i] - vxs[j], dvy = vys[i] - vys[j];
            const dot2 = dvx * nx + dvy * ny;
            if (dot2 > 0) { vxs[i] -= dot2 * nx; vys[i] -= dot2 * ny; vxs[j] += dot2 * nx; vys[j] += dot2 * ny; xs[i] -= nx * r; xs[j] += nx * r; }
          }
        }
        pressure = 0.9 * pressure + 0.1 * pAcc; time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        ctx.strokeStyle = GRID; ctx.strokeRect(2, 2, wall * (w - 4), h - 4);
        for (let i = 0; i < N; i++) {
          const sp = Math.hypot(vxs[i], vys[i]);
          ctx.fillStyle = mode === 2 && i < N / 2 ? "#f472b6" : `hsl(${210 - Math.min(150, sp * 40)},70%,60%)`;
          ctx.fillRect(xs[i] * (w - 4) + 2, ys[i] * (h - 4) + 2, 2.4, 2.4);
        }
      },
      metrics(): Metric[] {
        let ke = 0; for (let i = 0; i < N; i++) ke += 0.5 * (vxs[i] * vxs[i] + vys[i] * vys[i]);
        return [
          { label: "입자 수", value: String(N) },
          { label: "평균 운동에너지", value: fmt(ke / N, 3) },
          { label: "벽 압력(상대)", value: fmt(pressure, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const pointVortices: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 5,
  create(p, twin) {
    const nv = Math.round(p.vortices), cr = p.circulationRatio, nt = Math.round(p.tracers);
    const vort = Array.from({ length: nv }, (_, i) => {
      const a = (i / nv) * 2 * Math.PI;
      return { x: 0.3 * Math.cos(a) + (i === 0 ? (twin ?? 0) : 0), y: 0.3 * Math.sin(a), G: i % 2 === 0 ? 1 : cr };
    });
    let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const tracers = Array.from({ length: nt }, () => [rnd() * 2 - 1, rnd() * 2 - 1]);
    let time = 0, div = false;
    const vel = (x: number, y: number, skip: number) => {
      let vx = 0, vy = 0;
      vort.forEach((v, i) => { if (i === skip) return; const dx = x - v.x, dy = y - v.y, r2 = dx * dx + dy * dy + 0.001; vx += -v.G * dy / (2 * Math.PI * r2); vy += v.G * dx / (2 * Math.PI * r2); });
      return [vx, vy];
    };
    return {
      get time() { return time; },
      step(dt: number) {
        const nvel = vort.map((v, i) => vel(v.x, v.y, i));
        vort.forEach((v, i) => { v.x += nvel[i][0] * dt; v.y += nvel[i][1] * dt; });
        tracers.forEach((t) => { const [vx, vy] = vel(t[0], t[1], -1); t[0] += vx * dt; t[1] += vy * dt; });
        time += dt;
        if (vort.some((v) => diverged([v.x, v.y]))) div = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.4;
        ctx.fillStyle = ACCENT + "88";
        tracers.forEach((t) => ctx.fillRect(ox + t[0] * sc, oy + t[1] * sc, 1.5, 1.5));
        vort.forEach((v) => dot(ctx, ox + v.x * sc, oy + v.y * sc, 6, v.G > 0 ? "#38bdf8" : "#f87171"));
        if (o.twin) { const t = o.twin as unknown as { _v(): number[] }; const vv = t._v(); dot(ctx, ox + vv[0] * sc, oy + vv[1] * sc, 4, TWIN); }
      },
      metrics(): Metric[] {
        return [
          { label: "소용돌이 수", value: String(nv) },
          { label: "카오스", value: nv >= 4 ? "예 (4개 이상)" : "아니오 (가적분)" },
          { label: "추적 입자", value: String(nt) },
        ];
      },
      energy() { return null; },
      diverged() { return div; },
      _v: () => [vort[0].x, vort[0].y],
    } as unknown as Sim;
  },
};

export const radioactiveDecay: SimSpec = {
  dt: 1 / 30, stepsPerFrame: 1,
  create(p) {
    const N0 = Math.round(p.atoms), halfLife = p.halfLife, chain = Math.round(p.chain) === 1;
    const lambda = Math.LN2 / halfLife;
    let seed = Math.round(p.seed); const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const state = new Uint8Array(N0); // 0=모핵,1=자핵,2=안정
    let time = 0;
    const hist: [number, number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const pDecay = 1 - Math.exp(-lambda * dt);
        for (let i = 0; i < N0; i++) {
          if (state[i] === 0 && rnd() < pDecay) state[i] = chain ? 1 : 2;
          else if (chain && state[i] === 1 && rnd() < pDecay * 1.5) state[i] = 2;
        }
        let n0 = 0, n1 = 0; for (let i = 0; i < N0; i++) { if (state[i] === 0) n0++; else if (state[i] === 1) n1++; }
        hist.push([time, n0, n1]); if (hist.length > 400) hist.shift();
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 원자 격자
        const cols = Math.ceil(Math.sqrt(N0 * w / h)), rows2 = Math.ceil(N0 / cols);
        const cw = w * 0.5 / cols, chh = h / rows2;
        for (let i = 0; i < N0; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          ctx.fillStyle = state[i] === 0 ? "#38bdf8" : state[i] === 1 ? "#fbbf24" : "#334155";
          ctx.fillRect(c * cw + 1, r * chh + 1, cw - 1, chh - 1);
        }
        // 지수 곡선
        const t0 = hist[0]?.[0] ?? 0, span = (hist[hist.length - 1]?.[0] ?? 1) - t0 || 1;
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
        ctx.beginPath(); hist.forEach(([t, n0], i) => { const px = w * 0.55 + ((t - t0) / span) * w * 0.4, py = h * 0.9 - (n0 / N0) * h * 0.8; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }); ctx.stroke();
        if (chain) { ctx.strokeStyle = "#fbbf24"; ctx.beginPath(); hist.forEach(([t, , n1], i) => { const px = w * 0.55 + ((t - t0) / span) * w * 0.4, py = h * 0.9 - (n1 / N0) * h * 0.8; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }); ctx.stroke(); }
      },
      metrics(): Metric[] {
        let n0 = 0; for (let i = 0; i < N0; i++) if (state[i] === 0) n0++;
        return [
          { label: "남은 모핵", value: `${n0}/${N0}` },
          { label: "반감기", value: fmt(halfLife, 1), unit: "s" },
          { label: "경과 시간", value: fmt(time, 1), unit: "s" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* ── 전자기·양자 ── */

export const chargedParticleFields: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 5,
  create(p) {
    const Bz = p.Bz, Ex = p.Ex, gradB = p.gradientB, q = Math.round(p.chargeSign) === 0 ? 1 : -1;
    let x = 0, y = 0, vx = p.v0, vy = 0, time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([x, y, vx, vy], time, dt, ([X, Y, VX, VY]) => {
          const B = Bz * (1 + gradB * X);
          return [VX, VY, q * (Ex + VY * B), q * (-VX * B)];
        });
        [x, y, vx, vy] = s; time += dt;
        trail.push([x, y]); if (trail.length > 1000) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.13;
        ctx.strokeStyle = ACCENT + "88"; ctx.lineWidth = 1.4;
        ctx.beginPath(); trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy - ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }); ctx.stroke();
        dot(ctx, ox + x * sc, oy - y * sc, 6, q > 0 ? "#f87171" : "#38bdf8");
      },
      metrics(): Metric[] {
        const rc = Math.abs(p.v0 / (Bz || 1e-6));
        return [
          { label: "전하", value: q > 0 ? "양(+)" : "음(−)" },
          { label: "사이클로트론 반지름", value: fmt(rc, 2), unit: "m" },
          { label: "E×B 드리프트", value: fmt(Ex / (Bz || 1e-6), 2), unit: "m/s" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const electricFieldLines: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2, autoplay: false,
  create(p) {
    const nc = Math.round(p.charges), ratio = p.chargeRatio, nLines = Math.round(p.lineDensity), nTest = Math.round(p.testCharges);
    const charges = Array.from({ length: nc }, (_, i) => {
      const a = (i / nc) * 2 * Math.PI;
      return { x: 0.4 * Math.cos(a), y: 0.4 * Math.sin(a), q: i === 0 ? 1 : i === 1 ? ratio : (i % 2 ? 1 : -1) };
    });
    let seed = 4; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const tests = Array.from({ length: nTest }, () => ({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, vx: 0, vy: 0 }));
    let time = 0;
    const field = (x: number, y: number) => {
      let ex = 0, ey = 0;
      charges.forEach((c) => { const dx = x - c.x, dy = y - c.y, r = Math.pow(dx * dx + dy * dy + 0.002, 1.5); ex += c.q * dx / r; ey += c.q * dy / r; });
      return [ex, ey];
    };
    return {
      get time() { return time; },
      step(dt: number) {
        tests.forEach((t) => { const [ex, ey] = field(t.x, t.y); t.vx += ex * dt * 0.3; t.vy += ey * dt * 0.3; t.vx *= 0.99; t.vy *= 0.99; t.x += t.vx * dt; t.y += t.vy * dt; });
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.42;
        // 역선
        charges.forEach((c) => {
          if (c.q <= 0) return;
          for (let k = 0; k < nLines; k++) {
            const a = (k / nLines) * 2 * Math.PI;
            let x = c.x + 0.02 * Math.cos(a), y = c.y + 0.02 * Math.sin(a);
            ctx.strokeStyle = GRID; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(ox + x * sc, oy + y * sc);
            for (let s = 0; s < 200; s++) { const [ex, ey] = field(x, y); const m = Math.hypot(ex, ey) || 1e-6; x += (ex / m) * 0.01; y += (ey / m) * 0.01; if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) break; ctx.lineTo(ox + x * sc, oy + y * sc); }
            ctx.stroke();
          }
        });
        charges.forEach((c) => dot(ctx, ox + c.x * sc, oy + c.y * sc, 8, c.q > 0 ? "#f87171" : "#38bdf8"));
        ctx.fillStyle = "#fbbf24"; tests.forEach((t) => ctx.fillRect(ox + t.x * sc - 2, oy + t.y * sc - 2, 4, 4));
      },
      metrics(): Metric[] {
        return [
          { label: "전하 수", value: String(nc) },
          { label: "두 번째 전하", value: fmt(ratio, 1) },
          { label: "역선 개수", value: String(nLines) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

export const quantumTunneling: SimSpec = {
  dt: 1 / 8, stepsPerFrame: 1,
  create(p) {
    const N = 512;
    const E = p.packetEnergy, V0 = p.barrierHeight, bw = p.barrierWidth, pw = p.packetWidth;
    const re = new Float64Array(N), im = new Float64Array(N), V = new Float64Array(N);
    const k0 = Math.sqrt(2 * E) * 6;
    const x0 = 0.28;
    for (let i = 0; i < N; i++) {
      const x = i / N;
      const env = Math.exp(-((x - x0) ** 2) / (2 * pw * pw));
      re[i] = env * Math.cos(k0 * N * (x - x0) / N * 6);
      im[i] = env * Math.sin(k0 * N * (x - x0) / N * 6);
      V[i] = Math.abs(x - 0.5) < bw / 2 ? V0 : 0;
    }
    // 정규화
    let norm = 0; for (let i = 0; i < N; i++) norm += re[i] * re[i] + im[i] * im[i];
    const s = 1 / Math.sqrt(norm); for (let i = 0; i < N; i++) { re[i] *= s; im[i] *= s; }
    const norm0 = 1;
    let time = 0;
    const dx = 1 / N, dt2 = 0.5 * dx * dx;
    return {
      get time() { return time; },
      step() {
        // 유한차분 슈뢰딩거(반음적)
        const lap = (arr: Float64Array, i: number) => arr[(i + 1) % N] - 2 * arr[i] + arr[(i - 1 + N) % N];
        for (let i = 0; i < N; i++) re[i] -= dt2 * (-0.5 * lap(im, i) / (dx * dx) + V[i] * im[i]) * 0;
        // 명시적 진화(안정 위해 작은 스텝)
        for (let sub = 0; sub < 40; sub++) {
          for (let i = 0; i < N; i++) im[i] += dt2 * (-0.5 * lap(re, i) / (dx * dx) + V[i] * re[i]);
          for (let i = 0; i < N; i++) re[i] -= dt2 * (-0.5 * lap(im, i) / (dx * dx) + V[i] * im[i]);
        }
        time += 1;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 장벽
        ctx.fillStyle = GRID;
        for (let i = 0; i < N; i++) if (V[i] > 0) ctx.fillRect((i / N) * w, h * 0.5 - V0 * 40, w / N + 1, V0 * 40);
        // |ψ|²
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < N; i++) { const prob = re[i] * re[i] + im[i] * im[i]; const px = (i / N) * w, py = h * 0.9 - prob * h * 20; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      },
      metrics(): Metric[] {
        let left = 0, right = 0, nrm = 0;
        for (let i = 0; i < N; i++) { const pr = re[i] * re[i] + im[i] * im[i]; nrm += pr; if (i / N < 0.5) left += pr; else right += pr; }
        return [
          { label: "투과 확률", value: fmt(right * 100, 1), unit: "%" },
          { label: "노름 보존", value: fmt(nrm, 4) },
          { label: "에너지/장벽", value: fmt(E / V0, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};
