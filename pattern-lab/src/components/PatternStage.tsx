"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pattern } from "@/lib/patterns";
import { clampParams, defaultParams } from "@/lib/patterns";
import { renderers, svgForPattern } from "@/lib/renderers";
import type { Preset } from "@/lib/content/presets";

const STAGE_W = 640;
const STAGE_H = 440;
const HIRES_W = 2048;
const HIRES_H = 1408;

interface WorkerMsg {
  id: number;
  width?: number;
  height?: number;
  pixels?: Uint8ClampedArray;
  error?: string;
}

export default function PatternStage({
  pattern,
  presets,
}: {
  pattern: Pattern;
  presets: Preset[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = renderers[pattern.slug];
  const defaults = useMemo(() => defaultParams(pattern), [pattern]);
  const [params, setParams] = useState<Record<string, number>>(defaults);
  const [busy, setBusy] = useState(false);
  const [hiresBusy, setHiresBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const rafRef = useRef(0);

  // URL 쿼리 → 초기 파라미터 (공유 재현)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, number> = {};
    let any = false;
    for (const spec of pattern.params) {
      const raw = qs.get(spec.name);
      if (raw !== null) {
        const v = Number(raw);
        if (Number.isFinite(v)) {
          fromUrl[spec.name] = v;
          any = true;
        }
      }
    }
    if (any) setParams(clampParams(pattern, fromUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern.slug]);

  // 파라미터 → URL 쿼리 동기화 (저장소 없이 주소만)
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      for (const spec of pattern.params) {
        if (params[spec.name] !== spec.default) {
          qs.set(spec.name, String(params[spec.name]));
        }
      }
      const url = qs.toString()
        ? `${window.location.pathname}?${qs.toString()}`
        : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(t);
  }, [params, pattern.params]);

  const renderTo = useCallback(
    async (canvas: HTMLCanvasElement, w: number, h: number, p: Record<string, number>) => {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (renderer.raster) {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL("../workers/pattern.worker.ts", import.meta.url)
          );
        }
        const worker = workerRef.current;
        const id = ++reqIdRef.current;
        setBusy(true);
        const pixels = await new Promise<Uint8ClampedArray | null>((resolve) => {
          const onMsg = (e: MessageEvent<WorkerMsg>) => {
            if (e.data.id !== id) return;
            worker.removeEventListener("message", onMsg);
            resolve(e.data.pixels ?? null);
          };
          worker.addEventListener("message", onMsg);
          worker.postMessage({ id, slug: pattern.slug, params: p, width: w, height: h });
        });
        // 최신 요청만 반영
        if (id === reqIdRef.current && pixels) {
          const clamped = new Uint8ClampedArray(pixels);
          ctx.putImageData(new ImageData(clamped, w, h), 0, 0);
        }
        if (id === reqIdRef.current) setBusy(false);
      } else if (renderer.draw) {
        renderer.draw(ctx, w, h, p);
      }
    },
    [renderer, pattern.slug]
  );

  // 메인 렌더 — rAF로 슬라이더 입력을 묶어 60fps 유지
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (canvas) void renderTo(canvas, STAGE_W, STAGE_H, params);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [params, renderTo]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const downloadPng = async (hires: boolean) => {
    const off = document.createElement("canvas");
    if (hires) setHiresBusy(true);
    await renderTo(off, hires ? HIRES_W : STAGE_W, hires ? HIRES_H : STAGE_H, params);
    off.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${pattern.slug}${hires ? "-2048" : ""}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setHiresBusy(false);
    }, "image/png");
  };

  const downloadSvg = () => {
    const svg = svgForPattern(pattern.slug, params, 1200, 825);
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pattern.slug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const hasSvg = Boolean(renderer.geo);

  return (
    <div className="stage">
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className="stage-canvas"
          style={{ width: "100%", aspectRatio: `${STAGE_W}/${STAGE_H}` }}
          aria-label={`${pattern.name} 실시간 렌더링`}
        />
        {busy && <div className="busy-badge">계산 중…</div>}
      </div>

      <div className="preset-row">
        {presets.map((pr) => (
          <button
            key={pr.name}
            type="button"
            className="btn"
            onClick={() => setParams(clampParams(pattern, { ...params, ...pr.params }))}
          >
            {pr.name}
          </button>
        ))}
        <button type="button" className="btn" onClick={() => setParams(defaults)}>
          초기화
        </button>
      </div>

      <div className="sliders">
        {pattern.params.map((spec) => (
          <label key={spec.name} className="slider-row">
            <span className="slider-label">
              <b>{spec.name}</b> = {params[spec.name]}
              <em> — {spec.meaning}</em>
            </span>
            <input
              type="range"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={params[spec.name]}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, [spec.name]: Number(e.target.value) }))
              }
            />
          </label>
        ))}
      </div>

      <div className="download-row">
        <button type="button" className="btn" onClick={() => downloadPng(false)}>
          PNG 저장
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => downloadPng(true)}
          disabled={hiresBusy}
        >
          {hiresBusy ? "고해상도 생성 중…" : "PNG 2048px"}
        </button>
        {hasSvg && (
          <button type="button" className="btn" onClick={downloadSvg}>
            SVG 저장
          </button>
        )}
        <button type="button" className="btn" onClick={copyLink}>
          {copied ? "복사됨 ✓" : "링크 복사"}
        </button>
      </div>
    </div>
  );
}
