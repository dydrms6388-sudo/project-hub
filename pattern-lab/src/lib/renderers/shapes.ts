/**
 * 벡터 표현 가능한 패턴의 공용 기하 표현.
 * geometry(p,w,h) → Shape[] 를 canvas와 SVG 직렬화가 함께 사용한다.
 */
export type Shape =
  | {
      kind: "poly";
      pts: [number, number][];
      stroke?: string;
      width?: number;
      fill?: string;
      close?: boolean;
      alpha?: number;
    }
  | { kind: "circle"; cx: number; cy: number; r: number; stroke?: string; width?: number; fill?: string; alpha?: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; width?: number; alpha?: number };

export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  bg = "#0b0f19"
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const s of shapes) {
    ctx.globalAlpha = s.alpha ?? 1;
    if (s.kind === "poly") {
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (s.close) ctx.closePath();
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.width ?? 1.5;
        ctx.stroke();
      }
    } else if (s.kind === "circle") {
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.width ?? 1.5;
        ctx.stroke();
      }
    } else {
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fillRect(s.x, s.y, s.w, s.h);
      }
      if (s.stroke) {
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.width ?? 1;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      }
    }
  }
  ctx.globalAlpha = 1;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function shapesToSvg(
  shapes: Shape[],
  w: number,
  h: number,
  bg = "#0b0f19"
): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<rect width="${w}" height="${h}" fill="${bg}"/>`,
  ];
  for (const s of shapes) {
    const alpha = s.alpha !== undefined && s.alpha < 1 ? ` opacity="${f(s.alpha)}"` : "";
    if (s.kind === "poly") {
      const d =
        s.pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`).join("") +
        (s.close ? "Z" : "");
      parts.push(
        `<path d="${d}" fill="${s.fill ?? "none"}"${
          s.stroke
            ? ` stroke="${s.stroke}" stroke-width="${f(s.width ?? 1.5)}" stroke-linejoin="round" stroke-linecap="round"`
            : ""
        }${alpha}/>`
      );
    } else if (s.kind === "circle") {
      parts.push(
        `<circle cx="${f(s.cx)}" cy="${f(s.cy)}" r="${f(s.r)}" fill="${s.fill ?? "none"}"${
          s.stroke ? ` stroke="${s.stroke}" stroke-width="${f(s.width ?? 1.5)}"` : ""
        }${alpha}/>`
      );
    } else {
      parts.push(
        `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}" fill="${
          s.fill ?? "none"
        }"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${f(s.width ?? 1)}"` : ""}${alpha}/>`
      );
    }
  }
  parts.push("</svg>");
  return parts.join("");
}
