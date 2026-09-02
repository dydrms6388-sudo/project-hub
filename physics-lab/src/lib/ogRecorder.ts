import { getExperiment, defaultParams } from "@/lib/experiments";
import { sims } from "@/lib/sims";

/**
 * 빌드 타임 OG용: Node에는 canvas가 없으므로, draw()가 호출하는 2D 컨텍스트를
 * 흉내 내 벡터 연산(선·원·사각)을 SVG로 녹화한다. 픽셀장(createImageData) 기반
 * 시뮬은 녹화 불가(fieldOnly=true 반환)라 페이지에서 카드로 폴백한다.
 */
interface Rec {
  svg: string[];
  fieldOnly: boolean;
}

function makeRecorder(w: number, h: number) {
  const rec: Rec = { svg: [], fieldOnly: false };
  let fill = "#000", stroke = "#000", lw = 1, alpha = 1, dash = false;
  let path: string[] = [];
  const f = (n: number) => (Math.round(n * 10) / 10).toString();
  const ctx: Record<string, unknown> = {
    canvas: { width: w, height: h },
    set fillStyle(v: string) { fill = v; },
    get fillStyle() { return fill; },
    set strokeStyle(v: string) { stroke = v; },
    get strokeStyle() { return stroke; },
    set lineWidth(v: number) { lw = v; },
    get lineWidth() { return lw; },
    set globalAlpha(v: number) { alpha = v; },
    get globalAlpha() { return alpha; },
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    setTransform() {},
    save() {}, restore() {},
    setLineDash(a: number[]) { dash = a && a.length > 0; },
    fillRect(x: number, y: number, ww: number, hh: number) {
      rec.svg.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="${fill}" opacity="${f(alpha)}"/>`);
    },
    strokeRect(x: number, y: number, ww: number, hh: number) {
      rec.svg.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="none" stroke="${stroke}" stroke-width="${f(lw)}"/>`);
    },
    fillText() {},
    beginPath() { path = []; },
    moveTo(x: number, y: number) { path.push(`M${f(x)} ${f(y)}`); },
    lineTo(x: number, y: number) { path.push(`L${f(x)} ${f(y)}`); },
    arc(x: number, y: number, r: number, a0: number, a1: number) {
      if (Math.abs(a1 - a0) >= Math.PI * 1.999) {
        // 원: 즉시 방출
        rec.svg.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill === "#000" ? "none" : fill}" stroke="${stroke}" stroke-width="${f(lw)}" opacity="${f(alpha)}"/>`);
        path = [];
      } else {
        const x0 = x + r * Math.cos(a0), y0 = y + r * Math.sin(a0);
        const x1 = x + r * Math.cos(a1), y1 = y + r * Math.sin(a1);
        const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
        path.push(`M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(x1)} ${f(y1)}`);
      }
    },
    ellipse(x: number, y: number, rx: number, ry: number) {
      rec.svg.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${stroke}" stroke-width="${f(lw)}"/>`);
    },
    closePath() { path.push("Z"); },
    stroke() { if (path.length) rec.svg.push(`<path d="${path.join("")}" fill="none" stroke="${stroke}" stroke-width="${f(lw)}" opacity="${f(alpha)}" stroke-linecap="round" stroke-linejoin="round"/>`); },
    fill() { if (path.length) rec.svg.push(`<path d="${path.join("")}" fill="${fill}" opacity="${f(alpha)}"/>`); },
    createImageData() { rec.fieldOnly = true; return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
    putImageData() { rec.fieldOnly = true; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rec };
}

export function trajectoryPreview(slug: string, w: number, h: number): string | null {
  const exp = getExperiment(slug);
  const spec = sims[slug];
  if (!exp || !spec) return null;
  try {
    const sim = spec.create(defaultParams(exp));
    const warm = spec.autoplay ? 300 : 500;
    for (let i = 0; i < warm; i++) sim.step(spec.dt);
    const { ctx, rec } = makeRecorder(w, h);
    sim.draw(ctx, w, h, {});
    if (rec.fieldOnly || rec.svg.length < 2) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#0b0f19"/>${rec.svg.join("")}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}
