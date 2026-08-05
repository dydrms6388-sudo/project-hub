"use client";

import { useEffect, useRef } from "react";
import { getExperiment, defaultParams } from "@/lib/experiments";
import { sims } from "@/lib/sims";

const TW = 220, TH = 150;

/** 허브 썸네일 — 시뮬을 짧게 돌린 스냅샷을 정적으로 그린다 */
const WARM: Record<string, number> = {
  "double-pendulum": 200, "three-body": 400, "lorenz": 300, "billiards": 300,
  "standard-map": 300, "henon-heiles": 400, "point-vortices": 200, "n-body-cluster": 120,
  "gas-in-box": 120, "diffusion-heat": 60, "ripple-tank": 120, "electric-field-lines": 0,
};

export default function Thumb({ slug }: { slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const exp = getExperiment(slug);
    const spec = sims[slug];
    if (!canvas || !exp || !spec) return;
    canvas.width = TW; canvas.height = TH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const sim = spec.create(defaultParams(exp));
      const warm = WARM[slug] ?? 150;
      for (let i = 0; i < warm; i++) sim.step(spec.dt);
      sim.draw(ctx, TW, TH, {});
    });
    io.observe(canvas);
    return () => io.disconnect();
  }, [slug]);
  return <canvas ref={ref} className="thumb-canvas" style={{ width: "100%", aspectRatio: `${TW}/${TH}`, display: "block" }} aria-hidden="true" />;
}
