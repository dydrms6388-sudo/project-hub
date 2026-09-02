import { Renderer, REVEAL_COLOR, revealLabel } from "./types";

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

export const zollner: Renderer = {
  draw(ctx, w, h, p, o) {
    const n = Math.round(p.lineCount);
    const a = (p.hatchAngle * Math.PI) / 180;
    const gap = h / (n + 1);
    const hatchLen = Math.min(gap * 0.85, 34);
    const x0 = w * 0.08;
    const x1 = w * 0.92;
    for (let i = 1; i <= n; i++) {
      const y = gap * i;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      line(ctx, x0, y, x1, y);
      const dir = i % 2 === 0 ? 1 : -1;
      ctx.lineWidth = 1.8;
      for (let x = x0 + 8; x < x1 - 8; x += p.hatchSpacing) {
        line(
          ctx,
          x - Math.cos(a * dir) * hatchLen * 0.5,
          y - Math.sin(a * dir) * hatchLen * 0.5,
          x + Math.cos(a * dir) * hatchLen * 0.5,
          y + Math.sin(a * dir) * hatchLen * 0.5
        );
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 5]);
      for (let i = 1; i <= n; i++) line(ctx, x0, gap * i, x1, gap * i);
      ctx.setLineDash([]);
      revealLabel(ctx, "굵은 주선은 모두 평행", w / 2, h - 10);
    }
  },
};

export const heringWundt: Renderer = {
  draw(ctx, w, h, p, o) {
    const n = Math.round(p.radialCount);
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    if (p.variant < 0.5) {
      // 헤링: 중앙에서 뻗는 방사선
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        line(ctx, cx, cy, cx + Math.cos(a) * w, cy + Math.sin(a) * w);
      }
    } else {
      // 분트: 좌우 두 점으로 모이는 선다발
      for (const px of [-w * 0.1, w * 1.1]) {
        for (let i = 0; i <= n; i++) {
          const y = (i / n) * h * 1.6 - h * 0.3;
          line(ctx, px, cy, px < cx ? w : 0, y);
        }
      }
    }
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 3;
    const xL = cx - p.lineGap / 2;
    const xR = cx + p.lineGap / 2;
    line(ctx, xL, h * 0.06, xL, h * 0.94);
    line(ctx, xR, h * 0.06, xR, h * 0.94);
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 5]);
      line(ctx, xL - 8, h * 0.06, xL - 8, h * 0.94);
      line(ctx, xR + 8, h * 0.06, xR + 8, h * 0.94);
      ctx.setLineDash([]);
      revealLabel(ctx, "빨간 두 선은 곧은 평행선 (점선 자와 비교)", cx, h * 0.5);
    }
  },
};

export const poggendorff: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const ow = p.occluderWidth;
    const a = (p.lineAngle * Math.PI) / 180;
    const slope = Math.tan(a);
    const cy = h / 2;
    const xEnterEnd = cx - ow / 2;
    const enterLen = w * 0.3;
    // 왼쪽 진입 선분: 오른쪽 위로 향한다
    const y_at = (x: number) => cy - (x - xEnterEnd) * slope;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    line(ctx, xEnterEnd - enterLen, y_at(xEnterEnd - enterLen), xEnterEnd, cy);
    // 가림막
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(cx - ow / 2, h * 0.05, ow, h * 0.9);
    // 오른쪽 탈출 선분: 기하학적 연장 + 사용자 추정 오프셋
    const xExit = cx + ow / 2;
    const yTrue = y_at(xExit);
    const yUser = yTrue + p.userOffset;
    ctx.strokeStyle = INK;
    line(
      ctx,
      xExit,
      yUser,
      xExit + enterLen,
      yUser - enterLen * slope
    );
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      line(
        ctx,
        xEnterEnd - enterLen,
        y_at(xEnterEnd - enterLen),
        xExit + enterLen,
        y_at(xExit + enterLen)
      );
      ctx.setLineDash([]);
      const off = Math.round(p.userOffset);
      revealLabel(
        ctx,
        off === 0
          ? "점선이 참 연장선 — 지금 두 선분은 일직선"
          : `점선이 참 연장선 — 현재 ${Math.abs(off)}px 어긋남`,
        w / 2,
        h * 0.92
      );
    }
  },
};

export const orbison: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const cy = h / 2;
    const n = Math.round(p.patternDensity);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    if (p.patternType < 0.5) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w);
        ctx.stroke();
      }
    } else {
      for (let i = 1; i <= n; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (i / n) * w * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const S = Math.min(w, h) * 0.42;
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 3;
    if (p.shape < 0.5) {
      ctx.strokeRect(cx - S / 2, cy - S / 2 + h * 0.08, S, S);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy + h * 0.08, S / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (o.reveal) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 2;
      if (p.shape < 0.5) {
        ctx.strokeRect(cx - S / 2, cy - S / 2 + h * 0.08, S, S);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy + h * 0.08, S / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      revealLabel(ctx, "배경을 걷어내면 변형 없는 정확한 도형", cx, h * 0.1);
    }
  },
};

export const cafeWall: Renderer = {
  draw(ctx, w, h, p, o) {
    const tile = 46;
    const mortar = p.mortarWidth;
    const rows = Math.floor(h / (tile / 2 + mortar));
    const g = Math.round((p.mortarGray / 100) * 255);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(0, 0, w, h);
    const th = tile / 2;
    for (let r = 0; r < rows; r++) {
      const y = r * (th + mortar);
      const off = (r % 2 === 0 ? 1 : -1) * (p.rowOffset / 100) * tile;
      for (let c = -2; c < w / tile + 2; c++) {
        ctx.fillStyle = c % 2 === 0 ? "#111827" : "#f8fafc";
        ctx.fillRect(c * tile + off, y, tile, th);
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 5]);
      for (let r = 1; r < rows; r++) {
        const y = r * (th + mortar) - mortar / 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      revealLabel(ctx, "모든 줄눈은 수평 · 평행", w / 2, h - 12);
    }
  },
};

export const fraserSpiral: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.46;
    // 배경 체크(방사 섹터)
    const sectors = Math.round(p.checkerDensity) * 2;
    for (let s = 0; s < sectors; s++) {
      ctx.fillStyle = s % 2 === 0 ? "#9ca3af" : "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        maxR * 1.15,
        (s / sectors) * Math.PI * 2,
        ((s + 1) / sectors) * Math.PI * 2
      );
      ctx.closePath();
      ctx.fill();
    }
    // 동심원 고리를 '꼬인 끈'(흑백 사선 대시)으로 그린다
    const rings = Math.round(p.ringCount);
    const twist = (p.cordTwist * Math.PI) / 180;
    for (let k = 1; k <= rings; k++) {
      const r = (k / (rings + 0.4)) * maxR;
      const segs = Math.max(24, Math.round(r * 0.55));
      const segLen = ((Math.PI * 2) / segs) * r;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const tangent = a + Math.PI / 2 + twist;
        ctx.strokeStyle = s % 2 === 0 ? "#0b0f19" : "#ffffff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(
          x - (Math.cos(tangent) * segLen) / 1.6,
          y - (Math.sin(tangent) * segLen) / 1.6
        );
        ctx.lineTo(
          x + (Math.cos(tangent) * segLen) / 1.6,
          y + (Math.sin(tangent) * segLen) / 1.6
        );
        ctx.stroke();
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.6;
      for (let k = 1; k <= rings; k++) {
        const r = (k / (rings + 0.4)) * maxR;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      revealLabel(ctx, "나선이 아니라 완전한 동심원", cx, h - 12);
    }
  },
};
