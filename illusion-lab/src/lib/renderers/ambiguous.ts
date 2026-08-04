import { Renderer, REVEAL_COLOR, revealLabel } from "./types";

const INK = "#1f2430";

export const neckerCube: Renderer = {
  draw(ctx, w, h, p, o) {
    const S = p.size * 0.62;
    const off = S * Math.tan((p.skewAngle * Math.PI) / 180) * 0.6;
    const cx = w / 2 - off / 2;
    const cy = h / 2 + off / 2;
    const front = [
      [cx - S / 2, cy - S / 2],
      [cx + S / 2, cy - S / 2],
      [cx + S / 2, cy + S / 2],
      [cx - S / 2, cy + S / 2],
    ];
    const back = front.map(([x, y]) => [x + off, y - off]);
    const edge = (
      a: number[],
      b: number[],
      color = INK,
      width = 3,
      alpha = 1
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.restore();
    };
    const hint = p.depthHint / 100;
    for (let i = 0; i < 4; i++) {
      edge(back[i], back[(i + 1) % 4], INK, 3, 1 - hint * 0.6);
      edge(front[i], back[i], INK, 3, 1 - hint * 0.3);
      edge(front[i], front[(i + 1) % 4], INK, 3, 1);
    }
    if (o.reveal) {
      // 두 가지 해석을 미니 큐브로 병기 (은선 제거)
      const mini = (mx: number, my: number, frontIsLower: boolean) => {
        const s = 42;
        const d = 16;
        const f = [
          [mx - s / 2, my - s / 2],
          [mx + s / 2, my - s / 2],
          [mx + s / 2, my + s / 2],
          [mx - s / 2, my + s / 2],
        ];
        const sign = frontIsLower ? 1 : -1;
        const b = f.map(([x, y]) => [x + sign * d, y - sign * d]);
        ctx.strokeStyle = REVEAL_COLOR;
        ctx.lineWidth = 2;
        // 앞면 + 보이는 모서리만
        ctx.strokeRect(f[0][0], f[0][1], s, s);
        const visible = frontIsLower ? [0, 1, 3] : [1, 2, 3];
        for (const i of visible) {
          ctx.beginPath();
          ctx.moveTo(f[i][0], f[i][1]);
          ctx.lineTo(b[i][0], b[i][1]);
          ctx.stroke();
        }
      };
      mini(w * 0.14, h * 0.2, true);
      mini(w * 0.86, h * 0.2, false);
      revealLabel(ctx, "선 그림 하나에 두 깊이 해석 — 어느 쪽도 '정답'이 아니다", w / 2, h - 12);
    }
  },
};

export const schroederStairs: Renderer = {
  draw(ctx, w, h, p, o) {
    const n = Math.round(p.stepCount);
    const W = w * 0.56;
    const H = h * 0.5;
    const sk = H * Math.tan((p.skew * Math.PI) / 180) * 0.5;
    const x0 = (w - W - sk) / 2;
    const y0 = (h + H) / 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    // 계단 폴리라인: 좌하 → 우상
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 0; i < n; i++) {
      const fx = x0 + (W * (i + 1)) / n;
      const fy = y0 - (H * i) / n;
      ctx.lineTo(fx, fy);
      ctx.lineTo(fx, y0 - (H * (i + 1)) / n);
    }
    ctx.stroke();
    // 측벽(평행사변형 프레임)
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + sk, y0 - H);
    ctx.lineTo(x0 + sk + W, y0 - H);
    ctx.moveTo(x0 + W, y0);
    ctx.lineTo(x0, y0);
    ctx.stroke();
    if (p.flipAid > 0) {
      ctx.save();
      ctx.globalAlpha = (p.flipAid / 100) * 0.35;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let i = 0; i < n; i++) {
        const fx = x0 + (W * (i + 1)) / n;
        ctx.lineTo(fx, y0 - (H * i) / n);
        ctx.lineTo(fx, y0 - (H * (i + 1)) / n);
      }
      ctx.lineTo(x0 + sk + W, y0 - H);
      ctx.lineTo(x0 + sk, y0 - H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (o.reveal) {
      ctx.fillStyle = REVEAL_COLOR;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("해석 1: 위에서 내려다본 계단", w / 2, h * 0.12);
      ctx.fillText("해석 2: 뒤집혀 밑에서 올려다본 계단", w / 2, h * 0.12 + 18);
      revealLabel(ctx, "그림을 180° 돌려도 같은 그림 — 두 해석이 교대한다", w / 2, h - 12);
    }
  },
};

export const rubinVase: Renderer = {
  draw(ctx, w, h, p, o) {
    const bal = p.colorBalance / 100;
    const contrast = p.contrast / 100;
    const dark = `rgba(17,24,39,${0.35 + contrast * 0.65})`;
    const light = "#f8fafc";
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, w, h);
    // 옆얼굴 프로파일: 위(이마)→코→입→턱 — 좌우 대칭으로 꽃병 실루엣
    const cx = w / 2;
    const half = (w * 0.5 * p.vaseWidth) / 100;
    const prof = (t: number) => {
      // t: 0(위)→1(아래), 반환: 중심선에서의 거리
      const bumps =
        Math.sin(t * Math.PI) * 0.35 +
        Math.sin(t * Math.PI * 3 + 0.4) * 0.18 +
        Math.sin(t * Math.PI * 7 + 1.2) * 0.08;
      return half * (0.55 + bumps);
    };
    ctx.fillStyle = light;
    ctx.beginPath();
    const top = h * 0.08;
    const bot = h * 0.92;
    ctx.moveTo(cx - prof(0), top);
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      ctx.lineTo(cx - prof(t), top + (bot - top) * t);
    }
    for (let i = 60; i >= 0; i--) {
      const t = i / 60;
      ctx.lineTo(cx + prof(t), top + (bot - top) * t);
    }
    ctx.closePath();
    ctx.globalAlpha = 1 - bal * 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (o.reveal) {
      ctx.strokeStyle = REVEAL_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - prof(0), top);
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        ctx.lineTo(cx - prof(t), top + (bot - top) * t);
      }
      ctx.stroke();
      revealLabel(
        ctx,
        "하나의 경계선이 꽃병 테두리이자 얼굴 윤곽 — 소유권이 오갈 뿐",
        w / 2,
        h - 10
      );
    }
  },
};

export const penroseTriangle: Renderer = {
  draw(ctx, w, h, p, o) {
    const cx = w / 2;
    const cy = h / 2 + 10;
    const R = p.size / 2;
    const bw = p.beamWidth;
    const gap = o.reveal ? Math.max(p.breakGap, 34) : p.breakGap;
    // 세 꼭짓점 (정삼각형)
    const V = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as [number, number];
    });
    const shades = ["#94a3b8", "#64748b", "#cbd5e1"];
    // 각 변을 굵은 막대(사다리꼴)로 — 마지막 변은 gap 만큼 끊어 그린다
    for (let i = 0; i < 3; i++) {
      const A = V[i];
      const B = V[(i + 1) % 3];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const cut = i === 2 ? gap : 0;
      // 막대 본체(안쪽으로 두께)
      ctx.fillStyle = shades[i];
      ctx.beginPath();
      ctx.moveTo(A[0] - ux * bw * 0.6, A[1] - uy * bw * 0.6);
      ctx.lineTo(B[0] - ux * cut, B[1] - uy * cut);
      ctx.lineTo(
        B[0] - ux * (cut + bw * 0.9) + nx * bw,
        B[1] - uy * (cut + bw * 0.9) + ny * bw
      );
      ctx.lineTo(A[0] + ux * bw * 0.3 + nx * bw, A[1] + uy * bw * 0.3 + ny * bw);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (o.reveal) {
      revealLabel(
        ctx,
        "한 모서리를 벌리면 성립하는 평범한 도형 — '불가능'은 이음새의 착각",
        w / 2,
        h - 12
      );
    }
  },
};
