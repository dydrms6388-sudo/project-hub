"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Illusion } from "@/lib/illusions";
import { renderers } from "@/lib/renderers";

const STAGE_W = 640;
const STAGE_H = 420;

export default function IllusionStage({ illusion }: { illusion: Illusion }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderer = renderers[illusion.slug];

  const defaults = useMemo(() => {
    const o: Record<string, number> = {};
    for (const p of illusion.params) o[p.name] = p.default;
    return o;
  }, [illusion]);

  const [params, setParams] = useState<Record<string, number>>(defaults);
  const [reveal, setReveal] = useState(false);
  const [running, setRunning] = useState(false);
  const [accepted, setAccepted] = useState(false); // 운동 경고 배너 수락 여부
  const [reducedMotion, setReducedMotion] = useState(false);

  const tRef = useRef(0); // 애니메이션 경과 시간(초)
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({ params, reveal, running });
  stateRef.current = { params, reveal, running };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = (cssW * STAGE_H) / STAGE_W;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    const s = stateRef.current;
    renderer.draw(ctx, cssW, cssH, s.params, {
      reveal: s.reveal,
      t: tRef.current,
      running: s.running,
    });
  }, [renderer]);

  // 정적 렌더: 파라미터·토글 변경 시
  useEffect(() => {
    paint();
  }, [paint, params, reveal, running]);

  // 리사이즈 대응
  useEffect(() => {
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  // 애니메이션 루프
  useEffect(() => {
    if (!renderer?.animated || !running) return;
    const loop = (now: number) => {
      if (lastRef.current != null) {
        tRef.current += Math.min((now - lastRef.current) / 1000, 0.1);
      }
      lastRef.current = now;
      paint();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [renderer, running, paint]);

  const start = () => {
    tRef.current = 0;
    lastRef.current = null;
    setAccepted(true);
    setRunning(true);
  };
  const stop = () => setRunning(false);
  const reset = () => {
    setParams(defaults);
    setReveal(false);
    setRunning(false);
    tRef.current = 0;
  };

  if (!renderer) {
    return <p>렌더러를 찾을 수 없습니다: {illusion.slug}</p>;
  }

  const needsWarning = Boolean(illusion.motionWarning);

  return (
    <div className="stage" ref={wrapRef}>
      {needsWarning && !accepted && (
        <div className="motion-warning" role="alert">
          <strong>움직임 주의</strong>
          <p>
            이 체험에는 움직이는 무늬가 포함됩니다. 어지럼이나 눈의 피로를
            느끼면 곧바로 정지 버튼을 누르세요. 깜빡임은 초당 3회 미만으로
            제한되어 있습니다.
            {reducedMotion &&
              " 현재 시스템의 '동작 줄이기' 설정이 감지되어 자동 재생하지 않습니다."}
          </p>
          <button type="button" className="btn btn-primary" onClick={start}>
            이해했습니다 — 시작
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        style={{ width: "100%", aspectRatio: `${STAGE_W}/${STAGE_H}` }}
        aria-label={`${illusion.name} 체험 영역`}
      />
      <div className="stage-controls">
        {renderer.animated && (accepted || !needsWarning) && (
          <button
            type="button"
            className={running ? "btn btn-stop" : "btn btn-primary"}
            onClick={running ? stop : start}
          >
            {running ? "정지" : "시작"}
          </button>
        )}
        <button
          type="button"
          className={reveal ? "btn btn-active" : "btn"}
          onClick={() => setReveal((v) => !v)}
          aria-pressed={reveal}
        >
          {reveal ? "속임수 벗기기 해제" : "속임수 벗기기"}
        </button>
        <button type="button" className="btn" onClick={reset}>
          초기화
        </button>
      </div>
      <div className="sliders">
        {illusion.params.map((spec) => (
          <label key={spec.name} className="slider-row">
            <span className="slider-label">
              {spec.label}
              <b> {params[spec.name]}</b>
            </span>
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step ?? 1}
              value={params[spec.name]}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  [spec.name]: Number(e.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
