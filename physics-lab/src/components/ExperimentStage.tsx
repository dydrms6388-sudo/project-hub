"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Experiment } from "@/lib/experiments";
import { clampParams, defaultParams } from "@/lib/experiments";
import { sims } from "@/lib/sims";
import type { Sim, Metric } from "@/lib/sims";
import type { Preset } from "@/lib/content/presets";

const STAGE_W = 640;
const STAGE_H = 440;

export default function ExperimentStage({
  experiment,
  presets,
}: {
  experiment: Experiment;
  presets: Preset[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = sims[experiment.slug];
  const defaults = useMemo(() => defaultParams(experiment), [experiment]);
  const [params, setParams] = useState<Record<string, number>>(defaults);
  const [running, setRunning] = useState(false);
  const [twinOn, setTwinOn] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [diverged, setDiverged] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [copied, setCopied] = useState(false);

  const simRef = useRef<Sim | null>(null);
  const twinRef = useRef<Sim | null>(null);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const twinDelta = useMemo(() => {
    const spec = experiment.params.find((p) => p.name === "twinDelta");
    return spec ? spec.default : 0.001;
  }, [experiment]);

  const build = useCallback(() => {
    simRef.current = spec.create(paramsRef.current);
    twinRef.current = twinOn && experiment.isChaotic ? spec.create(paramsRef.current, twinDelta) : null;
    accRef.current = 0;
    lastRef.current = null;
    setDiverged(false);
  }, [spec, twinOn, experiment.isChaotic, twinDelta]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // URL → 파라미터
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, number> = {};
    let any = false;
    for (const s of experiment.params) {
      const raw = qs.get(s.name);
      if (raw !== null && Number.isFinite(Number(raw))) { fromUrl[s.name] = Number(raw); any = true; }
    }
    if (any) setParams(clampParams(experiment, fromUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.slug]);

  // 파라미터 → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      for (const s of experiment.params) if (params[s.name] !== s.default) qs.set(s.name, String(params[s.name]));
      const url = qs.toString() ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(t);
  }, [params, experiment.params]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simRef.current) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = (cssW * STAGE_H) / STAGE_W;
    if (canvas.width !== Math.round(cssW * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    simRef.current.draw(ctx, cssW, cssH, { twin: twinRef.current });
    setMetrics(simRef.current.metrics());
  }, []);

  // 파라미터·쌍둥이 바뀌면 재구성 후 1프레임 그림
  useEffect(() => {
    build();
    requestAnimationFrame(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, twinOn]);

  // 시뮬 루프 (고정 타임스텝 누적자)
  useEffect(() => {
    if (!running) return;
    const stepsPerFrame = spec.stepsPerFrame ?? 1;
    const loop = (now: number) => {
      const sim = simRef.current;
      if (!sim) return;
      if (lastRef.current != null) {
        let frameT = Math.min(0.05, (now - lastRef.current) / 1000);
        accRef.current += frameT;
        const dt = spec.dt;
        let steps = 0;
        const maxSteps = stepsPerFrame * 4;
        while (accRef.current >= dt && steps < maxSteps) {
          for (let s = 0; s < stepsPerFrame; s++) { sim.step(dt); twinRef.current?.step(dt); }
          accRef.current -= dt;
          steps++;
        }
        if (sim.diverged()) { setDiverged(true); setRunning(false); return; }
      }
      lastRef.current = now;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); lastRef.current = null; };
  }, [running, spec, draw]);

  const reset = () => { setRunning(false); build(); requestAnimationFrame(draw); };
  const copyLink = async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (!spec) return <p>시뮬레이션을 찾을 수 없습니다: {experiment.slug}</p>;

  return (
    <div className="stage">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} className="stage-canvas" style={{ width: "100%", aspectRatio: `${STAGE_W}/${STAGE_H}` }} aria-label={`${experiment.name} 시뮬레이션`} />
        {diverged && <div className="diverge-badge" role="alert">발산 감지 — 자동 정지됨. 파라미터를 조정하고 리셋하세요.</div>}
        {reduced && !running && <div className="reduced-note">동작 줄이기 설정이 감지되어 자동 재생하지 않습니다. 시작을 눌러 수동 실행하세요.</div>}
      </div>

      <div className="stage-controls">
        <button type="button" className={running ? "btn btn-stop" : "btn btn-primary"} onClick={() => { if (diverged) return; setRunning((r) => !r); }} disabled={diverged}>
          {running ? "정지" : "시작"}
        </button>
        <button type="button" className="btn" onClick={reset}>리셋</button>
        {experiment.isChaotic && (
          <button type="button" className={twinOn ? "btn btn-active" : "btn"} onClick={() => setTwinOn((v) => !v)} aria-pressed={twinOn}>
            쌍둥이 비교 {twinOn ? "끄기" : "켜기"}
          </button>
        )}
        <button type="button" className="btn" onClick={copyLink}>{copied ? "복사됨 ✓" : "링크 복사"}</button>
      </div>

      <div className="metrics-panel">
        {metrics.map((m) => (
          <div key={m.label} className="metric">
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}{m.unit ? <em> {m.unit}</em> : null}</span>
          </div>
        ))}
      </div>

      <div className="preset-row">
        {presets.map((pr) => (
          <button key={pr.name} type="button" className="btn" onClick={() => { setParams(clampParams(experiment, { ...params, ...pr.params })); }}>
            {pr.name}
          </button>
        ))}
        <button type="button" className="btn" onClick={() => setParams(defaults)}>기본값</button>
      </div>

      <div className="sliders">
        {experiment.params.filter((s) => s.name !== "twinDelta").map((s) => (
          <label key={s.name} className="slider-row">
            <span className="slider-label">
              <b>{s.name}</b> = {params[s.name]}{s.unit ? ` ${s.unit}` : ""}
              <em> — {s.meaning}</em>
            </span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={params[s.name]}
              onChange={(e) => setParams((prev) => ({ ...prev, [s.name]: Number(e.target.value) }))} />
          </label>
        ))}
      </div>
    </div>
  );
}
