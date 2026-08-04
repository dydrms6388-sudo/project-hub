import { Renderer, REVEAL_COLOR, revealLabel } from "./types";

const gray = (v: number) => {
  const g = Math.round(Math.max(0, Math.min(255, v)));
  return `rgb(${g},${g},${g})`;
};

export const hermannGrid: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const s = p.squareSize;
    const g = p.gapWidth;
    const dark = Math.round(255 * (1 - p.contrast / 100));
    ctx.fillStyle = gray(dark);
    const period = s + g;
    for (let y = g; y < h; y += period) {
      for (let x = g; x < w; x += period) {
        ctx.fillRect(x, y, s, s);
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.6;
      let count = 0;
      for (let y = g + s; y < h - period && count < 6; y += period) {
        for (let x = g + s; x < w - period && count < 6; x += period * 2) {
          ctx.beginPath();
          ctx.arc(x + g / 2, y + g / 2, g * 1.4, 0, Math.PI * 2);
          ctx.stroke();
          count++;
        }
      }
      revealLabel(ctx, "교차점도 통로와 같은 순수한 흰색 — 회색 점은 그려져 있지 않다", w / 2, h - 12);
    }
  },
};

export const simultaneousContrast: Renderer = {
  draw(ctx, w, h, p, o) {
    const target = (p.targetGray / 100) * 255;
    if (p.colorMode < 0.5) {
      ctx.fillStyle = gray((p.bgLeft / 100) * 255);
      ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = gray((p.bgRight / 100) * 255);
      ctx.fillRect(w / 2, 0, w / 2, h);
    } else {
      ctx.fillStyle = `hsl(220, 60%, ${20 + p.bgLeft * 0.5}%)`;
      ctx.fillRect(0, 0, w / 2, h);
      ctx.fillStyle = `hsl(45, 70%, ${20 + p.bgRight * 0.5}%)`;
      ctx.fillRect(w / 2, 0, w / 2, h);
    }
    const S = Math.min(w, h) * 0.22;
    ctx.fillStyle = gray(target);
    ctx.fillRect(w * 0.25 - S / 2, h / 2 - S / 2, S, S);
    ctx.fillRect(w * 0.75 - S / 2, h / 2 - S / 2, S, S);
    if (o.reveal) {
      // 두 표적을 같은 회색 다리로 잇는다 — 같은 밝기의 증명
      ctx.fillStyle = gray(target);
      ctx.fillRect(w * 0.25, h / 2 - S / 8, w * 0.5, S / 4);
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w * 0.25 - S / 2, h / 2 - S / 2, S, S);
      ctx.strokeRect(w * 0.75 - S / 2, h / 2 - S / 2, S, S);
      revealLabel(
        ctx,
        `두 사각형 RGB 동일: ${Math.round(target)} — 이어 보면 한 덩어리`,
        w / 2,
        h * 0.85
      );
    }
  },
};

export const machBands: Renderer = {
  draw(ctx, w, h, p, o) {
    const lo = (p.lowLum / 100) * 255;
    const hi = (p.highLum / 100) * 255;
    const rampW = p.rampWidth;
    const x1 = w / 2 - rampW / 2;
    const x2 = w / 2 + rampW / 2;
    for (let x = 0; x < w; x++) {
      let v: number;
      if (x < x1) v = lo;
      else if (x > x2) v = hi;
      else v = lo + ((x - x1) / rampW) * (hi - lo);
      ctx.fillStyle = gray(v);
      ctx.fillRect(x, 0, 1, h);
    }
    if (o.reveal) {
      // 실제 휘도 프로파일 곡선을 겹쳐 그린다: 경계에 돌출(밴드)은 없다
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        let v: number;
        if (x < x1) v = lo;
        else if (x > x2) v = hi;
        else v = lo + ((x - x1) / rampW) * (hi - lo);
        const y = h * 0.85 - (v / 255) * h * 0.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      revealLabel(ctx, "실제 휘도 곡선(빨강)에는 경계의 밝은 띠·어두운 띠가 없다", w / 2, h * 0.95);
    }
  },
};

export const whitesIllusion: Renderer = {
  draw(ctx, w, h, p, o) {
    const sw = p.stripeWidth;
    const targetLen = p.targetLength;
    const target = "rgb(128,128,128)";
    const colA = p.colorMode < 0.5 ? "#0b0f19" : "#1e3a8a";
    const colB = p.colorMode < 0.5 ? "#f8fafc" : "#fde68a";
    const n = Math.ceil(h / sw);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? colA : colB;
      ctx.fillRect(0, i * sw, w, sw);
    }
    // 왼쪽 표적: 어두운 줄 위에 얹힘 / 오른쪽 표적: 밝은 줄 위에 얹힘
    ctx.fillStyle = target;
    const midRow = Math.floor(n / 2);
    for (let k = -2; k <= 2; k++) {
      const i = midRow + k * 2;
      if (i % 2 === 0) ctx.fillRect(w * 0.18, i * sw, targetLen, sw);
      else ctx.fillRect(w * 0.62, i * sw, targetLen, sw);
      const j = midRow + k * 2 + 1;
      if (j % 2 !== 0) ctx.fillRect(w * 0.62, j * sw, targetLen, sw);
      else ctx.fillRect(w * 0.18, j * sw, targetLen, sw);
    }
    if (o.reveal) {
      ctx.fillStyle = target;
      ctx.fillRect(w * 0.18, h - 34, w * 0.44 + targetLen, 16);
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w * 0.18, h - 34, w * 0.44 + targetLen, 16);
      revealLabel(ctx, "좌우 회색 조각의 RGB 동일: 128 — 아래 띠와 같은 색", w / 2, h - 44);
    }
  },
};

export const cornsweet: Renderer = {
  draw(ctx, w, h, p, o) {
    const base = (p.baseLum / 100) * 255;
    const depth = (p.gradientDepth / 100) * 255;
    const gw = p.gradientWidth;
    const cx = w / 2;
    for (let x = 0; x < w; x++) {
      let v = base;
      if (x > cx - gw && x < cx) {
        // 왼쪽: 경계로 갈수록 밝아진다
        v = base + depth * (1 - (cx - x) / gw);
      } else if (x >= cx && x < cx + gw) {
        // 오른쪽: 경계에서 어두웠다가 회복된다
        v = base - depth * (1 - (x - cx) / gw);
      }
      ctx.fillStyle = gray(v);
      ctx.fillRect(x, 0, 1, h);
    }
    if (o.reveal) {
      // 경계를 가리는 막대 — 가리면 양쪽이 같은 밝기로 보인다
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(cx - gw - 6, 0, gw * 2 + 12, h * 0.45);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("경계 가림", cx, h * 0.22);
      revealLabel(
        ctx,
        `경계에서 먼 곳의 양쪽 밝기는 동일: ${Math.round(base)}`,
        w / 2,
        h * 0.94
      );
    }
  },
};

export const checkerShadow: Renderer = {
  draw(ctx, w, h, p, o) {
    const L = 120 + p.checkContrast; // 밝은 칸
    const D = 120 - p.checkContrast / 2; // 어두운 칸
    const f = 1 - p.shadowOpacity / 100; // 그림자 투과율
    const cols = 6;
    const rows = 5;
    const cw = Math.min(w / cols, 74);
    const chh = cw * 0.72;
    const ox = (w - cols * cw) / 2;
    const oy = (h - rows * chh) / 2;
    // 그림자 영역: 중앙 대각 띠 (soft edge)
    const inShadow = (c: number, r: number) => r >= 2 && r <= 3 && c >= 2 && c <= 4;
    let A: [number, number] | null = null;
    let B: [number, number] | null = null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isDark = (r + c) % 2 === 0;
        let v = isDark ? D : L;
        if (inShadow(c, r)) v *= f;
        ctx.fillStyle = gray(v);
        ctx.fillRect(ox + c * cw, oy + r * chh, cw, chh);
        if (isDark && r === 1 && c === 2) A = [c, r];
        if (!isDark && r === 2 && c === 3) B = [c, r];
      }
    }
    // 부드러운 그림자 가장자리 연출
    const gEdge = ctx.createLinearGradient(0, oy + 2 * chh - p.shadowSoftness, 0, oy + 2 * chh);
    gEdge.addColorStop(0, "rgba(0,0,0,0)");
    gEdge.addColorStop(1, `rgba(0,0,0,${(1 - f) * 0.25})`);
    ctx.fillStyle = gEdge;
    ctx.fillRect(ox + 2 * cw, oy + 2 * chh - p.shadowSoftness, 3 * cw, p.shadowSoftness);
    // 라벨 A/B
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    if (A) {
      ctx.fillStyle = "#fff";
      ctx.fillText("A", ox + A[0] * cw + cw / 2, oy + A[1] * chh + chh / 2 + 5);
    }
    if (B) {
      ctx.fillStyle = "#000";
      ctx.fillText("B", ox + B[0] * cw + cw / 2, oy + B[1] * chh + chh / 2 + 5);
    }
    if (o.reveal && A && B) {
      const vA = D;
      const vB = L * f;
      // A와 B를 같은 색 기둥으로 잇는다
      ctx.fillStyle = gray(vB);
      const ax = ox + A[0] * cw + cw / 2;
      const ay = oy + A[1] * chh + chh / 2;
      const bx = ox + B[0] * cw + cw / 2;
      const by = oy + B[1] * chh + chh / 2;
      ctx.save();
      ctx.strokeStyle = gray(vB);
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.restore();
      revealLabel(
        ctx,
        `A 밝기 ${Math.round(vA)} / B 밝기 ${Math.round(vB)} — 다리로 이으면 구분 불가`,
        w / 2,
        h - 10
      );
    }
  },
};

export const ehrenstein: Renderer = {
  draw(ctx, w, h, p, o) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const n = Math.round(p.lineCount);
    const gapR = p.gapRadius;
    const len = p.lineLength;
    const centers: [number, number][] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        centers.push([w * (0.22 + c * 0.28), h * (0.3 + r * 0.42)]);
      }
    }
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    for (const [cx, cy] of centers) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * gapR, cy + Math.sin(a) * gapR);
        ctx.lineTo(cx + Math.cos(a) * (gapR + len), cy + Math.sin(a) * (gapR + len));
        ctx.stroke();
      }
    }
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      for (const [cx, cy] of centers) {
        ctx.beginPath();
        ctx.arc(cx, cy, gapR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      revealLabel(ctx, "밝은 원판은 없다 — 중심부는 배경과 같은 흰색", w / 2, h - 12);
    }
  },
};
