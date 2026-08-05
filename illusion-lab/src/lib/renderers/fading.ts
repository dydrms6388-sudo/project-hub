import { Renderer, REVEAL_COLOR, revealLabel } from "./types";

export const troxler: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#d7dae0";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const hues = [10, 70, 140, 200, 260, 320];
    hues.forEach((hue, i) => {
      const a = (i / hues.length) * Math.PI * 2;
      const x = cx + Math.cos(a) * p.eccentricity;
      const y = cy + Math.sin(a) * p.eccentricity * 0.72;
      const R = 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R + p.blobBlur);
      g.addColorStop(0, `hsla(${hue}, ${p.blobSaturation}%, 62%, 0.9)`);
      g.addColorStop(1, "hsla(0, 0%, 85%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R + p.blobBlur, 0, Math.PI * 2);
      ctx.fill();
    });
    // 고정점
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      hues.forEach((_, i) => {
        const a = (i / hues.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * p.eccentricity;
        const y = cy + Math.sin(a) * p.eccentricity * 0.72;
        ctx.beginPath();
        ctx.arc(x, y, 46, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      revealLabel(ctx, "얼룩은 계속 그 자리에 있다 — 사라지는 것은 지각뿐", cx, h - 12);
    }
  },
};

export const blindSpot: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const cy = h / 2;
    const crossX = w * 0.18;
    const dotX = crossX + p.targetDistance;
    if (p.fillPattern >= 0.5) {
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(crossX - 12, cy);
    ctx.lineTo(crossX + 12, cy);
    ctx.moveTo(crossX, cy - 12);
    ctx.lineTo(crossX, cy + 12);
    ctx.stroke();
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(dotX, cy, p.targetSize / 2, 0, Math.PI * 2);
    ctx.fill();
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(crossX, cy + 30);
      ctx.lineTo(dotX, cy + 30);
      ctx.stroke();
      ctx.setLineDash([]);
      revealLabel(
        ctx,
        `+와 점 사이 ${Math.round(p.targetDistance)}px — 오른눈 감고 +를 보며 거리를 조절`,
        w / 2,
        cy + 58
      );
    }
  },
};
