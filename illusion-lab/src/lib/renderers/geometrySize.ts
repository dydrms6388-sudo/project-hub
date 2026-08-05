import { Renderer, REVEAL_COLOR, REVEAL_COLOR_2, revealLabel } from "./types";

const INK = "#1f2430";

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export const mullerLyer: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const L = p.lineLength;
    const fl = p.finLength;
    const a = (p.finAngle * Math.PI) / 180;
    const y1 = h * 0.35;
    const y2 = h * 0.65;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [y, dir] of [
      [y1, 1],
      [y2, -1],
    ] as const) {
      line(ctx, cx - L / 2, y, cx + L / 2, y);
      for (const sx of [-1, 1]) {
        const ex = cx + (sx * L) / 2;
        // dir=1: 바깥 화살깃(>—<), dir=-1: 안쪽 화살깃(<—>)
        const spread = dir * sx;
        line(
          ctx,
          ex,
          y,
          ex + spread * Math.cos(a) * fl,
          y - Math.sin(a) * fl
        );
        line(
          ctx,
          ex,
          y,
          ex + spread * Math.cos(a) * fl,
          y + Math.sin(a) * fl
        );
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      line(ctx, cx - L / 2, y1 - 30, cx - L / 2, y2 + 30);
      line(ctx, cx + L / 2, y1 - 30, cx + L / 2, y2 + 30);
      ctx.setLineDash([]);
      revealLabel(ctx, `두 선분의 실제 길이 동일: ${Math.round(L)}px`, cx, h * 0.5 + 5);
    }
  },
};

export const ponzo: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const conv = (p.convergence / 100) * (w * 0.32);
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2.5;
    line(ctx, cx - w * 0.36, h * 0.94, cx - w * 0.36 + conv, h * 0.06);
    line(ctx, cx + w * 0.36, h * 0.94, cx + w * 0.36 - conv, h * 0.06);
    const yTop = h / 2 - p.barGap / 2;
    const yBot = h / 2 + p.barGap / 2;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    line(ctx, cx - p.barLength / 2, yTop, cx + p.barLength / 2, yTop);
    line(ctx, cx - p.barLength / 2, yBot, cx + p.barLength / 2, yBot);
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR_2;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      line(ctx, cx - p.barLength / 2, yTop - 20, cx - p.barLength / 2, yBot + 20);
      line(ctx, cx + p.barLength / 2, yTop - 20, cx + p.barLength / 2, yBot + 20);
      ctx.setLineDash([]);
      revealLabel(ctx, `두 막대의 실제 길이 동일: ${Math.round(p.barLength)}px`, cx, h * 0.5);
    }
  },
};

export const ebbinghaus: Renderer = {
  draw(ctx, w, h, p, o) {
    const R = 24; // 두 표적 원의 실제 반지름(동일)
    const cxL = w * 0.3;
    const cxR = w * 0.72;
    const cy = h / 2;
    const n = Math.round(p.surroundCount);
    const drawSet = (cx: number, surroundR: number) => {
      ctx.fillStyle = "#64748b";
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * p.surroundDist,
          cy + Math.sin(a) * p.surroundDist,
          surroundR,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    };
    drawSet(cxL, p.surroundSize);
    drawSet(cxR, 9);
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      for (const cx of [cxL, cxR]) {
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        line(ctx, cx - R, cy + R + 12, cx + R, cy + R + 12);
      }
      revealLabel(ctx, `주황 원 지름 동일: ${R * 2}px`, w / 2, h * 0.12);
    }
  },
};

export const delboeuf: Renderer = {
  draw(ctx, w, h, p, o) {
    const r = p.targetSize / 2;
    const cy = h / 2;
    const cxL = w * 0.32;
    const cxR = w * 0.68;
    ctx.fillStyle = "#0f766e";
    for (const cx of [cxL, cxR]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = p.ringWidth;
    ctx.beginPath();
    ctx.arc(cxL, cy, r * p.annulusRatio, 0, Math.PI * 2);
    ctx.stroke();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      line(ctx, cxL, cy - r, cxR, cy - r);
      line(ctx, cxL, cy + r, cxR, cy + r);
      ctx.setLineDash([]);
      revealLabel(ctx, `두 원판 지름 동일: ${Math.round(r * 2)}px`, w / 2, h * 0.15);
    }
  },
};

export const verticalHorizontal: Renderer = {
  draw(ctx, w, h, p, o) {
    const L = p.lineLength;
    const cx = w / 2;
    const cy = h / 2 + L * 0.2;
    const jx = cx - L / 2 + (p.junction / 50) * (L / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((p.tilt * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    line(ctx, cx - L / 2, cy, cx + L / 2, cy);
    line(ctx, jx, cy, jx, cy - L);
    ctx.restore();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      // 수직선을 눕혀 수평선 위에 겹쳐 보여준다
      line(ctx, cx - L / 2, cy + 16, cx + L / 2, cy + 16);
      ctx.setLineDash([]);
      revealLabel(ctx, `두 선분의 실제 길이 동일: ${Math.round(L)}px`, cx, cy + 40);
    }
  },
};

export const oppelKundt: Renderer = {
  draw(ctx, w, h, p, o) {
    const cy = h / 2;
    const E = p.extent;
    const x0 = w / 2 - E;
    const n = Math.round(p.dividerCount);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    // 왼쪽: 빈 구간(양 끝만), 오른쪽: 같은 길이의 채워진 구간
    for (const x of [x0, x0 + E, x0 + 2 * E]) {
      line(ctx, x, cy - p.dividerHeight, x, cy + p.dividerHeight);
    }
    for (let i = 1; i <= n; i++) {
      const x = x0 + E + (E * i) / (n + 1);
      line(ctx, x, cy - p.dividerHeight, x, cy + p.dividerHeight);
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      const yb = cy + p.dividerHeight + 18;
      for (const [a, b] of [
        [x0, x0 + E],
        [x0 + E, x0 + 2 * E],
      ]) {
        line(ctx, a, yb, b, yb);
        line(ctx, a, yb - 5, a, yb + 5);
        line(ctx, b, yb - 5, b, yb + 5);
      }
      revealLabel(ctx, `두 구간의 실제 폭 동일: ${Math.round(E)}px`, w / 2, yb + 24);
    }
  },
};

export const sander: Renderer = {
  draw(ctx, w, h, p, o) {
    const W = p.width;
    const H = p.height;
    const s = H * Math.tan((p.skew * Math.PI) / 180) * 0.55;
    const ox = (w - W - s) / 2;
    const oy = h / 2 + H / 2;
    // 꼭짓점: 아래 왼(A)-아래 오(B), 위는 s만큼 오른쪽으로 밀림
    const A = [ox, oy];
    const B = [ox + W, oy];
    const C = [ox + W + s, oy - H];
    const D = [ox + s, oy - H];
    // 분할선 발: 두 대각선이 같은 길이가 되는 위치
    const M = [ox + W / 2 + s, oy];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(D[0], D[1]);
    ctx.closePath();
    ctx.stroke();
    line(ctx, M[0], M[1], M[0], oy - H);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#dc2626";
    line(ctx, D[0], D[1], M[0], M[1]); // 왼쪽 대각선
    line(ctx, M[0], M[1], C[0], C[1]); // 오른쪽 대각선
    if (o.reveal) {
      const d1 = Math.hypot(M[0] - D[0], M[1] - D[1]);
      const d2 = Math.hypot(C[0] - M[0], C[1] - M[1]);
      ctx.strokeStyle = REVEAL_COLOR_2;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(M[0], M[1], d1, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      revealLabel(
        ctx,
        `왼쪽 대각선 ${Math.round(d1)}px = 오른쪽 대각선 ${Math.round(d2)}px`,
        w / 2,
        oy + 28
      );
    }
  },
};

export const jastrow: Renderer = {
  draw(ctx, w, h, p, o) {
    const Rout = 150;
    const Rin = Rout - p.ringWidth;
    const half = ((p.arcAngle / 2) * Math.PI) / 180;
    const drawPiece = (cx: number, cy: number, fill: string) => {
      ctx.beginPath();
      ctx.arc(cx, cy, Rout, Math.PI / 2 - half, Math.PI / 2 + half);
      ctx.arc(cx, cy, Rin, Math.PI / 2 + half, Math.PI / 2 - half, true);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    // 동일한 고리 조각 두 개를 위아래로: 아래 것이 더 커 보인다
    const cy1 = h * 0.28 - Rout + p.ringWidth;
    const cy2 = h * 0.6 - Rout + p.ringWidth;
    drawPiece(w / 2 + p.offset / 2, cy1, "#f59e0b");
    drawPiece(w / 2 - p.offset / 2, cy2, "#3b82f6");
    if (o.reveal) {
      // 위 조각의 윤곽을 아래 조각 위에 겹쳐 그린다
      const cx = w / 2 - p.offset / 2;
      ctx.save();
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy2, Rout, Math.PI / 2 - half, Math.PI / 2 + half);
      ctx.arc(cx, cy2, Rin, Math.PI / 2 + half, Math.PI / 2 - half, true);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      revealLabel(ctx, "두 조각은 완전히 같은 도형", w / 2, h * 0.9);
    }
  },
};

export const helmholtzSquares: Renderer = {
  draw(ctx, w, h, p, o) {
    const S = Math.min(p.squareSize, h * 0.7);
    const n = Math.round(p.stripeCount);
    const duty = p.duty / 100;
    const y0 = (h - S) / 2;
    const cxL = w * 0.28 - S / 2;
    const cxR = w * 0.72 - S / 2;
    ctx.fillStyle = INK;
    const period = S / n;
    // 왼쪽: 가로 줄무늬(세로로 커 보임), 오른쪽: 세로 줄무늬(가로로 커 보임)
    for (let i = 0; i < n; i++) {
      ctx.fillRect(cxL, y0 + i * period, S, period * duty);
      ctx.fillRect(cxR + i * period, y0, period * duty, S);
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(cxL, y0, S, S);
      ctx.strokeRect(cxR, y0, S, S);
      ctx.setLineDash([]);
      revealLabel(
        ctx,
        `두 정사각형의 실제 크기 동일: ${Math.round(S)}px`,
        w / 2,
        y0 + S + 24
      );
    }
  },
};
