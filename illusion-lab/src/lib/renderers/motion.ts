import { Renderer, REVEAL_COLOR, REVEAL_COLOR_2, revealLabel } from "./types";

export const motionAftereffect: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    const adapting = o.running && o.t < p.adaptSeconds;
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    if (p.mode < 0.5) {
      // 선형 격자: 아래로 표류 → 정지 후 위로 흐르는 잔효
      const period = 44;
      const phase = adapting ? (o.t * p.driftSpeed * period) % period : 0;
      ctx.fillStyle = "#e5e7eb";
      for (let y = -period; y < h + period; y += period) {
        ctx.fillRect(0, y + phase, w, period / 2);
      }
    } else {
      // 회전 나선: 시계방향 회전 → 정지 후 반대 방향 잔효
      const rot = adapting ? o.t * p.driftSpeed * 1.2 : 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 10;
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let r = 8; r < Math.min(w, h) * 0.46; r += 3) {
          const a = (arm * Math.PI) / 2 + r * 0.045;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (r === 8) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 고정점
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    if (adapting) {
      ctx.fillText(
        `빨간 점을 응시하세요 (${Math.ceil(p.adaptSeconds - o.t)}초 후 정지)`,
        cx,
        h - 14
      );
    } else if (o.running) {
      ctx.fillText("지금 무늬는 완전히 정지 상태입니다", cx, h - 14);
    }
    if (o.reveal && o.running && !adapting) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 60, cy - 40, 120, 80);
      revealLabel(ctx, "빨간 틀 안 무늬는 픽셀 하나 움직이지 않는다", cx, 24);
    }
  },
};

export const phiBeta: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const cy = h / 2;
    const xL = w / 2 - p.dotDistance / 2;
    const xR = w / 2 + p.dotDistance / 2;
    const period = 1 / p.alternationHz;
    const showLeft = o.t % period < period / 2;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(showLeft ? xL : xR, cy, p.dotSize / 2, 0, Math.PI * 2);
    ctx.fill();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      for (const x of [xL, xR]) {
        ctx.beginPath();
        ctx.arc(x, cy, p.dotSize / 2 + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      revealLabel(
        ctx,
        "두 위치의 점이 제자리에서 번갈아 켜질 뿐 — 이동은 없다",
        w / 2,
        h - 14
      );
    }
  },
};

export const ternus: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const cy = h / 2;
    const s = p.elementSpacing;
    const baseX = w / 2 - s * 1.5;
    const cycle = p.cycleMs / 1000;
    const isi = p.isi / 1000;
    const frameDur = cycle / 2 - isi;
    const tt = o.t % cycle;
    let frame: 0 | 1 | null = null;
    if (tt < frameDur) frame = 0;
    else if (tt >= cycle / 2 && tt < cycle / 2 + frameDur) frame = 1;
    ctx.fillStyle = "#e5e7eb";
    if (frame !== null) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(baseX + (i + frame) * s, cy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(baseX + i * s, cy, 19, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = REVEAL_COLOR;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < 4; i++) {
        ctx.fillText(String(i + 1), baseX + i * s, cy - 28);
      }
      revealLabel(
        ctx,
        "프레임A=1·2·3, 프레임B=2·3·4 — 공백이 짧으면 요소이동, 길면 집단이동으로 보인다",
        w / 2,
        h - 14
      );
    }
  },
};

export const inducedMotion: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const osc = Math.sin((o.t * p.frameSpeed) / 30) * p.frameAmplitude;
    const dotX = cx + Math.sin(o.t * 0.7) * p.dotJitter;
    // 움직이는 틀
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 130 + osc, cy - 90, 260, 180);
    // 점 (기본값에선 완전 고정)
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(dotX, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, 10);
      ctx.lineTo(cx, h - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      revealLabel(
        ctx,
        p.dotJitter === 0
          ? "점은 기준선 위에 고정 — 움직이는 것은 틀뿐"
          : `점의 실제 이동폭은 ${Math.round(p.dotJitter)}px뿐`,
        w / 2,
        h - 14
      );
    }
  },
};

export const barberpole: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const baseH = Math.min(h * 0.7, 300);
    const apH = p.apertureRatio >= 1 ? baseH / p.apertureRatio : baseH;
    const apW = p.apertureRatio >= 1 ? baseH : baseH * p.apertureRatio;
    const a = (p.stripeAngle * Math.PI) / 180;
    const period = 36;
    const shift = (o.t * p.stripeSpeed) % period;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - apW / 2, cy - apH / 2, apW, apH);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = "#dc2626";
    const span = Math.max(w, h);
    for (let d = -span; d < span; d += period) {
      ctx.fillRect(-span, d + shift, span * 2, period / 2);
    }
    ctx.restore();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - apW / 2, cy - apH / 2, apW, apH);
    if (o.reveal) {
      // 실제 이동 방향(줄무늬 수직) vs 지각 방향(긴 축)
      const trueDir = a + Math.PI / 2;
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(trueDir) * 60, cy + Math.sin(trueDir) * 60);
      ctx.stroke();
      const percDir = apH > apW ? Math.PI / 2 : 0;
      ctx.strokeStyle = REVEAL_COLOR_2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(percDir) * 60, cy + Math.sin(percDir) * 60);
      ctx.stroke();
      revealLabel(
        ctx,
        "빨강 = 실제 이동 방향, 파랑 = 지각되는 방향(창의 긴 축)",
        w / 2,
        h - 14
      );
    }
  },
};

export const kineticDepth: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.36;
    const n = Math.round(p.dotCount);
    const rot = (o.t * p.rotationSpeed * Math.PI) / 180;
    const persp = p.perspective / 100;
    // 결정적 유사난수로 구면 점 배치(프레임 간 일관)
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < n; i++) {
      const theta = Math.acos(2 * rand() - 1);
      const phi = rand() * Math.PI * 2 + rot;
      const x3 = Math.sin(theta) * Math.cos(phi);
      const z3 = Math.sin(theta) * Math.sin(phi);
      const y3 = Math.cos(theta);
      const scale = 1 + persp * z3 * 0.4;
      const x = cx + x3 * R * scale;
      const y = cy + y3 * R * scale;
      if (o.reveal) {
        ctx.fillStyle = z3 > 0 ? "#f87171" : "#60a5fa";
      } else {
        ctx.fillStyle = "#e5e7eb";
      }
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (o.reveal) {
      revealLabel(
        ctx,
        "빨강 = 앞 반구, 파랑 = 뒤 반구 — 평행투영에선 이 구분이 사라져 방향이 모호해진다",
        w / 2,
        h - 14
      );
    }
  },
};

export const stereokinetic: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const rot = (o.t * p.rotationSpeed * Math.PI) / 180;
    const n = Math.round(p.ringCount);
    const maxR = Math.min(w, h) * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      const frac = i / n;
      const r = maxR * (1 - frac * 0.82);
      const off = p.eccentricOffset * frac;
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(off, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (o.reveal) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = REVEAL_COLOR;
      for (let i = 0; i < n; i++) {
        const off = p.eccentricOffset * (i / n);
        ctx.beginPath();
        ctx.arc(off, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      revealLabel(
        ctx,
        "중심이 조금씩 어긋난 평면 원들이 통째로 돌 뿐 — 원뿔은 없다",
        w / 2,
        h - 14
      );
    }
  },
};
