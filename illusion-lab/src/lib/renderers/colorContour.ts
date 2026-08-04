import { Renderer, REVEAL_COLOR, revealLabel } from "./types";

export const kanizsaTriangle: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2 + 12;
    const R = p.spacing / Math.sqrt(3);
    const verts: [number, number][] = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    });
    const rot = (p.rotation * Math.PI) / 180;
    for (const [vx, vy] of verts) {
      // 팩맨: 입이 무게중심을 향하고, rotation 파라미터로 흐트러뜨릴 수 있다
      const toward = Math.atan2(cy - vy, cx - vx) + rot;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.arc(vx, vy, p.discRadius, toward + Math.PI / 6, toward - Math.PI / 6 + Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(verts[0][0], verts[0][1]);
      ctx.lineTo(verts[1][0], verts[1][1]);
      ctx.lineTo(verts[2][0], verts[2][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      revealLabel(ctx, "삼각형의 변도, 면의 흰색 차이도 그려져 있지 않다", w / 2, h - 12);
    }
  },
};

export const neonColorSpreading: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.28;
    const n = Math.round(p.gridDensity);
    const cell = Math.min(w, h) / n;
    ctx.lineWidth = 2;
    for (let gx = 0; gx <= w; gx += cell) {
      for (let gy = 0; gy <= h; gy += cell) {
        // 십자 조각: 원 내부 구간만 유채색으로
        const drawSeg = (x1: number, y1: number, x2: number, y2: number) => {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const inside = Math.hypot(mx - cx, my - cy) < R;
          ctx.strokeStyle = inside
            ? `hsla(210, ${p.crossSaturation}%, 55%, 1)`
            : "#111827";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        };
        const half = (cell * (p.segmentRatio / 100)) * 1.6;
        drawSeg(gx - half, gy, gx + half, gy);
        drawSeg(gx, gy - half, gx, gy + half);
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 확대경 스와치: 선 사이 배경이 순백임을 보여준다
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(w - 120, h - 58, 104, 40);
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.strokeRect(w - 120, h - 58, 104, 40);
      ctx.fillStyle = REVEAL_COLOR;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("원 안 배경 = 순백", w - 68, h - 34);
      revealLabel(ctx, "푸른 기운은 선분에만 있다 — 면은 칠해지지 않았다", w / 2, h - 12);
    }
  },
};

export const watercolorIllusion: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.34;
    const wav = p.waviness;
    const path = (r: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const rr = r + Math.sin(a * 7) * wav + Math.cos(a * 3) * wav * 0.6;
        const x = cx + Math.cos(a) * rr * 1.25;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // 바깥 진한 윤곽 + 안쪽 밝은 유채색 윤곽(이중선)
    ctx.lineWidth = p.borderWidth;
    ctx.strokeStyle = "#4c1d95";
    path(baseR);
    ctx.stroke();
    ctx.strokeStyle = `hsl(${p.innerHue}, 85%, 62%)`;
    path(baseR - p.borderWidth);
    ctx.stroke();
    if (o.reveal) {
      // 안·밖 스와치 비교
      const sw = 88;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(20, h - 66, sw, 44);
      ctx.fillRect(w - 20 - sw, h - 66, sw, 44);
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, h - 66, sw, 44);
      ctx.strokeRect(w - 20 - sw, h - 66, sw, 44);
      ctx.fillStyle = REVEAL_COLOR;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("안쪽 면 표본", 20 + sw / 2, h - 42);
      ctx.fillText("바깥 면 표본", w - 20 - sw / 2, h - 42);
      revealLabel(ctx, "안쪽 면과 바깥 면 모두 같은 순백 — 색은 윤곽선에만 있다", w / 2, h - 8);
    }
  },
};

export const colorAfterimage: Renderer = {
  animated: true,
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const cy = h / 2;
    const adapting = o.t < p.adaptSeconds;
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, w, h);
    if (adapting && o.running) {
      // 응시 단계: 채도 높은 도형
      ctx.fillStyle = `hsl(${p.hue}, ${p.saturation}%, 50%)`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `가운데 +를 계속 응시하세요 (${Math.ceil(p.adaptSeconds - o.t)}초)`,
        cx,
        h - 16
      );
    } else {
      ctx.fillStyle = "#111827";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        o.running
          ? "계속 +를 응시하세요 — 보색 잔상이 떠오릅니다"
          : "시작을 누르면 응시 단계가 진행됩니다",
        cx,
        h - 16
      );
    }
    // 고정점
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    if (o.reveal) {
      const comp = (p.hue + 180) % 360;
      ctx.fillStyle = `hsl(${p.hue}, ${p.saturation}%, 50%)`;
      ctx.fillRect(20, 20, 44, 24);
      ctx.fillStyle = `hsl(${comp}, ${p.saturation}%, 60%)`;
      ctx.fillRect(20, 52, 44, 24);
      ctx.fillStyle = "#111827";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("자극색", 72, 36);
      ctx.fillText(`예상 잔상색(보색 ${Math.round(comp)}°)`, 72, 68);
      revealLabel(ctx, "잔상 단계의 화면에는 아무 색도 그려지지 않는다", w / 2, 96);
    }
  },
};

export const bezold: Renderer = {
  draw(ctx, w, h, p, o) {
    const base = `hsl(${p.baseHue}, 75%, 48%)`;
    ctx.fillStyle = base;
    ctx.fillRect(w * 0.06, h * 0.12, w * 0.4, h * 0.72);
    ctx.fillRect(w * 0.54, h * 0.12, w * 0.4, h * 0.72);
    const n = Math.round(p.lineDensity);
    const lh = (h * 0.72) / (n * 2);
    const g = Math.round((p.lineLum / 100) * 255);
    // 왼쪽: 흰 줄 삽입, 오른쪽: lineLum 밝기 줄 삽입(기본 검정)
    for (let i = 0; i < n; i++) {
      const y = h * 0.12 + (i * 2 + 0.5) * lh;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(w * 0.06, y, w * 0.4, lh);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(w * 0.54, y, w * 0.4, lh);
    }
    if (o.reveal) {
      // 두 판의 바탕색 표본을 나란히 놓는다
      ctx.fillStyle = base;
      ctx.fillRect(w / 2 - 70, h * 0.88, 60, 22);
      ctx.fillRect(w / 2 + 10, h * 0.88, 60, 22);
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w / 2 - 70, h * 0.88, 140, 22);
      revealLabel(ctx, "두 판의 바탕색은 완전히 동일 — 표본을 붙여 보면 하나", w / 2, h * 0.86);
    }
  },
};
