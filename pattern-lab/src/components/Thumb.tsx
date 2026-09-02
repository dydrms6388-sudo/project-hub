"use client";

import { useEffect, useRef } from "react";
import { getPattern, defaultParams } from "@/lib/patterns";
import { renderers } from "@/lib/renderers";
import { rasterRegistry } from "@/lib/core/raster";

const TW = 200;
const TH = 140;

/** 허브·카테고리 썸네일 — 경량 파라미터로 실시간 렌더링 (이미지 파일 없음) */
const CHEAP: Record<string, Record<string, number>> = {
  mandelbrot: { maxIter: 80 },
  julia: { maxIter: 80 },
  "newton-fractal": { maxIter: 30 },
  "sincos-attractor": {},
  "langtons-ant": { steps: 60000, cellSize: 1 },
  "reaction-diffusion": { iterations: 1500 },
  dla: { particles: 1500 },
  sandpile: { grains: 40000 },
  "sierpinski-chaos": { points: 15000 },
  "barnsley-fern": { points: 25000 },
  "penrose-tiling": { subdivisions: 4 },
  "l-system-plant": { iterations: 4 },
  "perlin-flow": { lineCount: 250 },
  voronoi: { seeds: 20, relax: 0 },
  "ulam-spiral": { size: 151 },
  "logistic-bifurcation": { iterations: 250, transient: 100 },
  "lorenz-attractor": { steps: 9000 },
  "gumowski-mira": { points: 30000 },
  "collatz-tree": { sequences: 200 },
  "dragon-curve": { iterations: 11 },
  "hilbert-curve": { order: 5 },
  "pascal-mod": { rows: 128 },
  "times-table-cardioid": { modulus: 120 },
  lissajous: { samples: 600 },
};

export default function Thumb({ slug }: { slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const pat = getPattern(slug);
    const r = renderers[slug];
    if (!canvas || !pat || !r) return;
    const params = { ...defaultParams(pat), ...(CHEAP[slug] ?? {}) };
    canvas.width = TW;
    canvas.height = TH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // 지연 렌더: 화면에 들어올 때 한 번만
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      if (r.raster) {
        const fn = rasterRegistry[slug];
        if (fn) ctx.putImageData(new ImageData(new Uint8ClampedArray(fn(params, TW, TH)), TW, TH), 0, 0);
      } else if (r.draw) {
        r.draw(ctx, TW, TH, params);
      }
    });
    io.observe(canvas);
    return () => io.disconnect();
  }, [slug]);

  return (
    <canvas
      ref={ref}
      className="thumb-canvas"
      style={{ width: "100%", aspectRatio: `${TW}/${TH}`, display: "block" }}
      aria-hidden="true"
    />
  );
}
