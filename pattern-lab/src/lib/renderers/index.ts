import { Shape, drawShapes, shapesToSvg } from "./shapes";
import * as cv from "./curves";
import * as sf from "./spiralsFractals";
import * as tf from "./tilingsFields";
import * as cn from "./chaosNumber";

export type P = Record<string, number>;

export interface PatternRenderer {
  /** 벡터 기하 — canvas·SVG 다운로드 공용. 있으면 SVG 다운로드 제공 */
  geo?: (p: P, w: number, h: number) => Shape[];
  /** canvas 직접 드로잉(픽셀·점 축적형) */
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number, p: P) => void;
  /** true면 Web Worker(rasterRegistry)로 계산 */
  raster?: boolean;
  bg?: string;
}

const geoRenderer = (
  geo: (p: P, w: number, h: number) => Shape[],
  bg = "#0b0f19"
): PatternRenderer => ({
  geo,
  bg,
  draw: (ctx, w, h, p) => drawShapes(ctx, geo(p, w, h), bg),
});

export const renderers: Record<string, PatternRenderer> = {
  lissajous: geoRenderer(cv.lissajousGeo),
  "rose-curve": geoRenderer(cv.roseGeo),
  trochoid: geoRenderer(cv.trochoidGeo),
  harmonograph: geoRenderer(cv.harmonographGeo),
  superformula: geoRenderer(cv.superformulaGeo),
  phyllotaxis: geoRenderer(sf.phyllotaxisGeo),
  "classic-spirals": geoRenderer(sf.classicSpiralsGeo),
  "ulam-spiral": { draw: sf.ulamDraw },
  mandelbrot: { raster: true },
  julia: { raster: true },
  "newton-fractal": { raster: true },
  "koch-curve": geoRenderer(sf.kochGeo),
  "sierpinski-chaos": { draw: sf.sierpinskiDraw },
  "barnsley-fern": { draw: sf.barnsleyDraw },
  "dragon-curve": geoRenderer(sf.dragonGeo),
  "l-system-plant": geoRenderer(sf.lsystemGeo),
  "pythagoras-tree": geoRenderer(sf.pythagorasGeo),
  "apollonian-gasket": geoRenderer(sf.apollonianGeo),
  "penrose-tiling": geoRenderer(tf.penroseGeo),
  "truchet-tiles": geoRenderer(tf.truchetGeo, "#0f172a"),
  voronoi: { draw: tf.voronoiDraw },
  "hilbert-curve": geoRenderer(sf.hilbertGeo),
  "wallpaper-symmetry": geoRenderer(tf.wallpaperGeo),
  "chladni-figures": { draw: tf.chladniDraw },
  "wave-interference": { draw: tf.interferenceDraw },
  moire: geoRenderer(tf.moireGeo, "#f8fafc"),
  "perlin-flow": { draw: tf.perlinFlowDraw },
  "gyroid-slice": { draw: tf.gyroidDraw },
  "lorenz-attractor": { draw: cn.lorenzDraw },
  "sincos-attractor": { raster: true },
  "gumowski-mira": { draw: cn.gumowskiMiraDraw },
  "logistic-bifurcation": { draw: cn.logisticDraw },
  "langtons-ant": { raster: true },
  "elementary-ca": { draw: cn.elementaryCaDraw },
  "reaction-diffusion": { raster: true },
  dla: { raster: true },
  sandpile: { raster: true },
  "pascal-mod": { draw: cn.pascalDraw },
  "times-table-cardioid": geoRenderer(cn.timesTableGeo),
  "collatz-tree": geoRenderer(cn.collatzGeo),
};

export function svgForPattern(slug: string, p: P, w: number, h: number): string | null {
  const r = renderers[slug];
  if (!r?.geo) return null;
  return shapesToSvg(r.geo(p, w, h), w, h, r.bg ?? "#0b0f19");
}

export { drawShapes, shapesToSvg };
export type { Shape };
