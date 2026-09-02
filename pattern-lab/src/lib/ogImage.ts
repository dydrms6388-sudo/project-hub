import { getPattern, defaultParams } from "@/lib/patterns";
import { renderers, svgForPattern } from "@/lib/renderers";
import { rasterRegistry } from "@/lib/core/raster";
import { rgbaToPngDataUri } from "@/lib/core/png";

/** 빌드 타임 OG용: 패턴을 계산해 data URI(img src)로 반환 */
export function patternPreviewUri(slug: string, w: number, h: number): string {
  const pat = getPattern(slug);
  const r = renderers[slug];
  if (!pat || !r) return "";
  const params = defaultParams(pat);
  if (r.geo) {
    const svg = svgForPattern(slug, params, w, h);
    if (svg) return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
  if (r.raster) {
    const fn = rasterRegistry[slug];
    if (fn) return rgbaToPngDataUri(fn(params, w, h), w, h);
  }
  return "";
}
