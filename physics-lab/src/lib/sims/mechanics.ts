import { P, Sim, SimSpec, Metric, DrawOpts, INK, ACCENT, TWIN, GRID, line, dot, clearBg } from "./types";
import { rk4, diverged } from "../core/integrators";

const g = 9.81;
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");

/* 공기저항 발사체(마그누스) */
export const projectileDrag: SimSpec = {
  dt: 1 / 240, stepsPerFrame: 3,
  create(p) {
    const ang = (p.angle * Math.PI) / 180;
    let x = 0, y = 0, vx = p.v0 * Math.cos(ang), vy = p.v0 * Math.sin(ang);
    const cd = p.dragCoef, spin = p.spin;
    // 진공 비교
    let vx0 = vx, vy0 = vy, x0 = 0, y0 = 0;
    let time = 0, landed = false;
    const trail: [number, number][] = [], trailVac: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        if (landed) return;
        const s = rk4([x, y, vx, vy], time, dt, ([X, Y, VX, VY]) => {
          const v = Math.hypot(VX, VY);
          return [VX, VY, -cd * v * VX - spin * VY, -g - cd * v * VY + spin * VX];
        });
        [x, y, vx, vy] = s;
        // 진공
        vy0 -= g * dt; x0 += vx0 * dt; y0 += vy0 * dt;
        time += dt;
        trail.push([x, y]); trailVac.push([x0, y0]);
        if (y < 0 && time > 0.1) landed = true;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const maxX = Math.max(50, x, x0) * 1.1;
        const sc = w * 0.9 / maxX, oy = h * 0.9;
        ctx.strokeStyle = GRID; ctx.lineWidth = 1; line(ctx, 0, oy, w, oy);
        ctx.strokeStyle = "#64748b"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); trailVac.forEach(([tx, ty], i) => { const px = tx * sc + w * 0.05, py = oy - ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
        ctx.beginPath(); trail.forEach(([tx, ty], i) => { const px = tx * sc + w * 0.05, py = oy - ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }); ctx.stroke();
        dot(ctx, x * sc + w * 0.05, oy - y * sc, 6, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "수평거리", value: fmt(x, 1), unit: "m" },
          { label: "높이", value: fmt(y, 1), unit: "m" },
          { label: "진공 대비", value: fmt(x0 > 0 ? (x / x0) * 100 : 100, 0), unit: "%" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 로켓 방정식 */
export const rocketEquation: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2,
  create(p) {
    const ve = p.exhaustV * 1000, burn = p.burnRate / 100, stages = Math.round(p.stages);
    const mRatio = p.massRatio;
    let m = 1, v = 0, alt = 0, time = 0, stage = 0, burned = 0;
    const mFinal = 1 / mRatio;
    const perStage = (1 - mFinal) / stages;
    return {
      get time() { return time; },
      step(dt: number) {
        const mdot = burn;
        if (m > mFinal + 1e-4) {
          const dm = mdot * dt;
          v += (ve * dm) / m - g * dt;
          m -= dm; alt += v * dt; time += dt; burned += dm;
        } else if (stage < stages - 1) {
          // 단 분리: 빈 단 질량 버림(간단화)
          stage++;
        }
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const groundY = h * 0.92;
        ctx.strokeStyle = GRID; line(ctx, 0, groundY, w, groundY);
        const py = groundY - Math.min(h * 0.8, alt * 0.01);
        ctx.fillStyle = ACCENT; ctx.fillRect(w / 2 - 6, py - 24, 12, 24);
        ctx.fillStyle = "#fb923c";
        if (m > mFinal + 1e-4) { ctx.beginPath(); ctx.moveTo(w / 2 - 5, py); ctx.lineTo(w / 2 + 5, py); ctx.lineTo(w / 2, py + 18); ctx.fill(); }
      },
      metrics(): Metric[] {
        const dvIdeal = ve * Math.log(mRatio) / 1000;
        return [
          { label: "속도", value: fmt(v / 1000, 2), unit: "km/s" },
          { label: "고도", value: fmt(alt / 1000, 1), unit: "km" },
          { label: "이론 Δv", value: fmt(dvIdeal, 2), unit: "km/s" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 1D 탄성충돌(π 세기) */
export const elasticCollisions1d: SimSpec = {
  dt: 1 / 4000, stepsPerFrame: 400,
  create(p) {
    const M = p.massRatio, m = 1, e = p.restitution, hasWall = Math.round(p.wall) === 1;
    let x1 = 4, v1 = -p.v0, x2 = 2, v2 = 0;
    let time = 0, collisions = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        x1 += v1 * dt; x2 += v2 * dt;
        // 블록 충돌
        if (x1 <= x2 + 0.3 && v1 < v2) {
          const nv1 = ((M - e * m) * v1 + (1 + e) * m * v2) / (M + m);
          const nv2 = ((1 + e) * M * v1 + (m - e * M) * v2) / (M + m);
          v1 = nv1; v2 = nv2; collisions++;
        }
        // 벽 충돌
        if (hasWall && x2 <= 0.3 && v2 < 0) { v2 = -e * v2; collisions++; }
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const cy = h * 0.6, sc = w / 8;
        if (hasWall) { ctx.fillStyle = GRID; ctx.fillRect(0, cy - 60, 8, 80); }
        ctx.fillStyle = TWIN; const s1 = 20 + Math.log10(M) * 10; ctx.fillRect(x1 * sc, cy - s1, s1, s1);
        ctx.fillStyle = ACCENT; ctx.fillRect(x2 * sc, cy - 20, 20, 20);
      },
      metrics(): Metric[] {
        const piDigits = Math.round(Math.sqrt(M));
        return [
          { label: "충돌 횟수", value: String(collisions) },
          { label: "질량비", value: `${M}:1` },
          { label: "π 근사", value: M >= 100 ? `${collisions}회 ≈ π×${piDigits}` : "—" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 튀는 공(진동 바닥) */
export const bouncingBall: SimSpec = {
  dt: 1 / 600, stepsPerFrame: 10,
  create(p, twin) {
    const e = p.restitution, A = p.floorAmp / 1000, fHz = p.floorFreq;
    let y = p.h0 + (twin ?? 0), v = 0, time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        v -= g * dt; y += v * dt;
        const floor = A * Math.sin(2 * Math.PI * fHz * time);
        const floorV = A * 2 * Math.PI * fHz * Math.cos(2 * Math.PI * fHz * time);
        if (y <= floor) { y = floor; v = -e * (v - floorV) + floorV; }
        time += dt;
        trail.push([time, y]); if (trail.length > 700) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, o: DrawOpts) {
        clearBg(ctx, w, h);
        const oy = h * 0.9, sc = h * 0.7 / (p.h0 + 0.3);
        const floor = A * Math.sin(2 * Math.PI * fHz * time);
        ctx.strokeStyle = GRID; ctx.lineWidth = 2; line(ctx, w * 0.3, oy - floor * sc, w * 0.7, oy - floor * sc);
        dot(ctx, w * 0.5, oy - y * sc, 12, ACCENT);
        if (o.twin) { const t = o.twin as unknown as { _y(): number }; dot(ctx, w * 0.5 + 20, oy - t._y() * sc, 9, TWIN); }
        // 시계열
        ctx.strokeStyle = ACCENT + "88"; ctx.lineWidth = 1;
        const t0 = trail[0]?.[0] ?? 0, span = (trail[trail.length - 1]?.[0] ?? 1) - t0 || 1;
        ctx.beginPath(); trail.forEach(([t, yy], i) => { const gx = w * 0.05 + ((t - t0) / span) * w * 0.2, gy = oy - yy * sc; i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy); }); ctx.stroke();
      },
      metrics(): Metric[] {
        return [
          { label: "높이", value: fmt(y, 3), unit: "m" },
          { label: "속도", value: fmt(v, 2), unit: "m/s" },
          { label: "반발계수", value: fmt(e, 2) },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
      _y: () => y,
    } as unknown as Sim;
  },
};

/* 갈톤 보드 */
export const galtonBoard: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2, autoplay: true,
  create(p) {
    const rows = Math.round(p.rows), total = Math.round(p.balls), e = p.restitution;
    const bins = new Array(rows + 1).fill(0);
    let dropped = 0, time = 0;
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const active: { x: number; y: number; vx: number; vy: number; row: number; pos: number }[] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        if (dropped < total && active.length < 60 && rnd() < 0.5) { active.push({ x: 0, y: 0, vx: 0, vy: 0, row: 0, pos: 0 }); dropped++; }
        for (let i = active.length - 1; i >= 0; i--) {
          const b = active[i];
          b.row += 1;
          if (rnd() < 0.5 + (p.dropSpread ? (rnd() - 0.5) * 0.0 : 0)) b.pos += 0.5; else b.pos -= 0.5;
          if (b.row >= rows) { const bin = Math.round(b.pos + rows / 2); if (bin >= 0 && bin <= rows) bins[bin]++; active.splice(i, 1); }
        }
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        // 말뚝
        ctx.fillStyle = GRID;
        for (let r = 0; r < rows; r++) for (let c = 0; c <= r; c++) {
          const px = w / 2 + (c - r / 2) * (w * 0.5 / rows), py = h * 0.08 + r * (h * 0.4 / rows);
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
        // 활성 공
        ctx.fillStyle = ACCENT;
        active.forEach((b) => { const px = w / 2 + b.pos * (w * 0.5 / rows), py = h * 0.08 + b.row * (h * 0.4 / rows); ctx.beginPath(); ctx.arc(px, py, 3, 0, 2 * Math.PI); ctx.fill(); });
        // 히스토그램
        const maxB = Math.max(1, ...bins);
        for (let i = 0; i <= rows; i++) {
          const bx = w / 2 + (i - rows / 2) * (w * 0.5 / rows);
          const bh = (bins[i] / maxB) * h * 0.35;
          ctx.fillStyle = TWIN; ctx.fillRect(bx - w * 0.24 / rows, h * 0.9 - bh, w * 0.48 / rows, bh);
        }
      },
      metrics(): Metric[] {
        return [
          { label: "떨어뜨린 공", value: `${dropped}/${total}` },
          { label: "말뚝 줄", value: String(rows) },
          { label: "분포", value: "이항 → 정규" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 최속강하선 경주 */
export const brachistochroneRace: SimSpec = {
  dt: 1 / 240, stepsPerFrame: 3,
  create(p) {
    const drop = p.drop, tracks = Math.round(p.tracks), tauto = Math.round(p.tautochrone) === 1;
    // 트랙: 0=직선, 1=원호, 2=사이클로이드
    const W = 3;
    const curves = [
      (t: number) => [t * W, (drop * t)], // 직선
      (t: number) => { const a = Math.acos(1 - 2 * t) / Math.PI; return [t * W, drop * (1 - Math.cos(Math.PI * t)) / 2]; }, // 원호 근사
      (t: number) => { const th = t * Math.PI; return [(th - Math.sin(th)) / Math.PI * W, drop * (1 - Math.cos(th)) / 2]; }, // 사이클로이드
    ];
    const balls = Array.from({ length: tracks }, (_, i) => ({ s: tauto ? i / tracks * 0.5 : 0, v: 0, done: false, curve: i % 3 }));
    let time = 0;
    return {
      get time() { return time; },
      step(dt: number) {
        balls.forEach((b) => {
          if (b.done) return;
          const [, yNow] = curves[b.curve](Math.min(1, b.s));
          const v = Math.sqrt(Math.max(0, 2 * g * yNow));
          // 호 길이 매개변수 근사 진행
          b.s += (v / (W * 1.5)) * dt + 0.02 * dt;
          if (b.s >= 1) { b.s = 1; b.done = true; }
        });
        time += dt;
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w * 0.1, oy = h * 0.15, sc = Math.min(w * 0.8 / W, h * 0.7 / drop);
        const cols = [ACCENT, TWIN, "#fbbf24"];
        for (let c = 0; c < tracks; c++) {
          ctx.strokeStyle = cols[c % 3] + "88"; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let t = 0; t <= 1.001; t += 0.02) { const [cx, cy] = curves[c % 3](t); const px = ox + cx * sc, py = oy + cy * sc; t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
          ctx.stroke();
          const b = balls[c]; const [bx, by] = curves[b.curve](Math.min(1, b.s));
          dot(ctx, ox + bx * sc, oy + by * sc, 7, cols[c % 3]);
        }
      },
      metrics(): Metric[] {
        const done = balls.map((b, i) => b.done ? ["직선", "원호", "사이클로이드"][b.curve] : null).filter(Boolean);
        return [
          { label: "도착", value: done.length ? done.join(", ") : "경주 중" },
          { label: "낙차", value: fmt(drop, 1), unit: "m" },
          { label: "모드", value: tauto ? "등시성" : "최속강하" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 회전 좌표계(코리올리) */
export const rotatingFrame: SimSpec = {
  dt: 1 / 120, stepsPerFrame: 2,
  create(p) {
    const Om = p.omega, both = Math.round(p.showBoth) === 1;
    const dir = (p.launchDir * Math.PI) / 180;
    let x = 0, y = 0, vx = p.v0 * Math.cos(dir), vy = p.v0 * Math.sin(dir);
    let time = 0;
    const trailI: [number, number][] = [], trailR: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        // 관성계: 직선 운동
        x += vx * dt; y += vy * dt; time += dt;
        trailI.push([x, y]);
        // 회전계 좌표로 변환
        const c = Math.cos(-Om * time), s = Math.sin(-Om * time);
        trailR.push([x * c - y * s, x * s + y * c]);
        if (trailI.length > 800) { trailI.shift(); trailR.shift(); }
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const R = Math.min(w, h) * 0.42, sc = R / 3;
        const panels = both ? [[w * 0.27, "관성계", trailI], [w * 0.73, "회전계", trailR]] as const : [[w / 2, "회전계", trailR]] as const;
        panels.forEach(([ox, label, trail]) => {
          ctx.strokeStyle = GRID; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(ox as number, h / 2, R * 0.7, 0, 2 * Math.PI); ctx.stroke();
          ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.6;
          ctx.beginPath();
          (trail as [number, number][]).forEach(([tx, ty], i) => { const px = (ox as number) + tx * sc, py = h / 2 + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
          ctx.stroke();
          ctx.fillStyle = INK; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label as string, ox as number, h * 0.95);
        });
      },
      metrics(): Metric[] {
        return [
          { label: "각속도 Ω", value: fmt(Om, 2), unit: "rad/s" },
          { label: "코리올리 힘", value: fmt(2 * Om * p.v0, 2), unit: "m/s²" },
          { label: "관측", value: both ? "양 좌표계" : "회전계" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};

/* 팽이 세차와 장동 */
export const spinningTop: SimSpec = {
  dt: 1 / 400, stepsPerFrame: 6, conservative: true,
  create(p) {
    const spin = p.spinRate, beta0 = (p.tilt * Math.PI) / 180, Iratio = p.inertiaRatio;
    const I1 = 1, I3 = Iratio, mgd = 1;
    let beta = beta0, dbeta = p.nutationKick, alpha = 0, dalpha = 0;
    const psiDot = spin;
    // 각운동량 보존 근사: 세차 방정식
    let time = 0;
    const trail: [number, number][] = [];
    return {
      get time() { return time; },
      step(dt: number) {
        const s = rk4([beta, dbeta, alpha], time, dt, ([B, DB, A]) => {
          const precRate = mgd / (I3 * psiDot); // 근사 세차율
          const ddB = (I3 * psiDot * DB * 0 + mgd * Math.sin(B) - I3 * psiDot * precRate * Math.sin(B)) / I1;
          return [DB, ddB * 0.3, precRate];
        });
        [beta, dbeta, alpha] = s; time += dt;
        const tipX = Math.sin(beta) * Math.cos(alpha), tipY = Math.sin(beta) * Math.sin(alpha);
        trail.push([tipX, tipY]); if (trail.length > 600) trail.shift();
      },
      draw(ctx: CanvasRenderingContext2D, w: number, h: number, _o: DrawOpts) {
        clearBg(ctx, w, h);
        const ox = w / 2, oy = h / 2, sc = Math.min(w, h) * 0.35;
        // 위에서 본 팁 궤적(세차+장동)
        ctx.strokeStyle = ACCENT + "77"; ctx.lineWidth = 1;
        ctx.beginPath();
        trail.forEach(([tx, ty], i) => { const px = ox + tx * sc, py = oy + ty * sc; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
        ctx.stroke();
        const tx = Math.sin(beta) * Math.cos(alpha), ty = Math.sin(beta) * Math.sin(alpha);
        ctx.strokeStyle = GRID; ctx.lineWidth = 3; line(ctx, ox, oy, ox + tx * sc, oy + ty * sc);
        dot(ctx, ox, oy, 5, INK);
        dot(ctx, ox + tx * sc, oy + ty * sc, 10, ACCENT);
      },
      metrics(): Metric[] {
        return [
          { label: "기울기 β", value: fmt((beta * 180) / Math.PI, 1), unit: "°" },
          { label: "세차각", value: fmt(((alpha % (2 * Math.PI)) * 180) / Math.PI, 0), unit: "°" },
          { label: "세차율 근사", value: fmt(mgd / (I3 * spin), 3), unit: "rad/s" },
        ];
      },
      energy() { return null; },
      diverged() { return false; },
    } as Sim;
  },
};
