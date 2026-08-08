"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Sound } from "@/lib/sounds";
import { defaultParams, isLogParam, paramLabel } from "@/lib/sounds";
import type { Preset } from "@/lib/content/types";
import { SoundEngine } from "@/lib/audio/engine";

const BANNER_KEY = "soundlab-volume-ack";

function fmt(v: number, step: number): string {
  const dec = step < 0.01 ? 2 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return v.toFixed(dec);
}

/** 로그 슬라이더: 슬라이더 위치(0..1000) ↔ 실값 매핑 */
function toLogPos(v: number, min: number, max: number): number {
  return (Math.log(v / min) / Math.log(max / min)) * 1000;
}
function fromLogPos(pos: number, min: number, max: number, step: number): number {
  const v = min * Math.pow(max / min, pos / 1000);
  return Math.round(v / step) * step;
}

export default function SoundLab({
  sound,
  presets,
}: {
  sound: Sound;
  presets: Preset[];
}) {
  const defaults = useMemo(() => defaultParams(sound), [sound]);
  const [params, setParams] = useState<Record<string, number>>(defaults);
  const [playing, setPlaying] = useState(false);
  const [banner, setBanner] = useState(false);
  const [starting, setStarting] = useState(false);
  const engineRef = useRef<SoundEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // URL → 초기 파라미터 복원 (?파라미터명=값)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const next: Record<string, number> = { ...defaults };
    let touched = false;
    for (const spec of sound.params) {
      const raw = q.get(spec.name);
      if (raw === null) continue;
      const v = Number(raw);
      if (Number.isFinite(v) && v >= spec.min && v <= spec.max) {
        next[spec.name] = v;
        touched = true;
      }
    }
    if (touched) setParams(next);
    setBanner(!window.localStorage.getItem(BANNER_KEY));
  }, [sound, defaults]);

  // 파라미터 → URL (재현 가능한 공유 링크)
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      for (const spec of sound.params) {
        if (params[spec.name] !== spec.default)
          q.set(spec.name, String(params[spec.name]));
      }
      const qs = q.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (qs ? `?${qs}` : "")
      );
    }, 250);
    return () => clearTimeout(t);
  }, [params, sound]);

  // 파라미터 변경 즉시 반영
  useEffect(() => {
    engineRef.current?.update(params);
  }, [params]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, W, H);

    // 위 60%: 스펙트럼, 아래 40%: 파형
    const spec = engine.getSpectrum();
    if (spec) {
      const specH = H * 0.58;
      const usable = Math.floor(spec.length * 0.75);
      const bars = 96;
      ctx.fillStyle = "#4f8cff";
      for (let i = 0; i < bars; i++) {
        // 로그 주파수축
        const idx = Math.min(
          usable - 1,
          Math.floor(Math.pow(usable, i / bars))
        );
        const v = spec[idx] / 255;
        const bw = W / bars;
        const bh = v * (specH - 8);
        ctx.globalAlpha = 0.55 + v * 0.45;
        ctx.fillRect(i * bw + 1, specH - bh, bw - 2, bh);
      }
      ctx.globalAlpha = 1;
    }
    const wave = engine.getWaveform();
    if (wave) {
      const y0 = H * 0.62;
      const wh = H * 0.36;
      ctx.strokeStyle = "#7ee2a8";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * W;
        const y = y0 + wh / 2 + ((wave[i] - 128) / 128) * (wh / 2) * 0.95;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.6);
    ctx.lineTo(W, H * 0.6);
    ctx.stroke();
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      if (!engineRef.current) engineRef.current = new SoundEngine();
      await engineRef.current.start(sound.slug, paramsRef.current);
      setPlaying(true);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
      // 레벨 실측 스크립트용 훅 (프로덕션 UI에는 영향 없음)
      (window as unknown as Record<string, unknown>).__soundlab = {
        setParams: (p: Record<string, number>) => {
          setParams((prev) => ({ ...prev, ...p }));
          engineRef.current?.update({ ...paramsRef.current, ...p });
        },
        getPeak: () => engineRef.current?.getPeak() ?? 0,
      };
    } finally {
      setStarting(false);
    }
  };

  const stop = useCallback(() => {
    engineRef.current?.stopSound();
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

  // 페이지 이탈 시 오디오 완전 정리 — 소리 잔류 금지
  useEffect(() => {
    const dispose = () => {
      cancelAnimationFrame(rafRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    window.addEventListener("pagehide", dispose);
    return () => {
      window.removeEventListener("pagehide", dispose);
      dispose();
    };
  }, []);

  const ackBanner = () => {
    window.localStorage.setItem(BANNER_KEY, "1");
    setBanner(false);
  };

  const applyPreset = (pr: Preset) => {
    setParams((prev) => ({ ...prev, ...pr.params }));
  };

  return (
    <section className="lab" aria-label={`${sound.name} 실험 영역`}>
      {banner && (
        <div className="volume-banner" role="alert">
          <strong>볼륨 주의</strong>
          <p>
            재생 전에 기기 볼륨을 중간 이하로 낮춰 주세요. 모든 소리는
            리미터로 상한이 고정되어 있지만, 체감 크기는 재생 장비에 따라
            다릅니다. 귀에 불편이 느껴지면 바로 정지하세요.
          </p>
          <button type="button" className="btn btn-primary" onClick={ackBanner}>
            확인했습니다
          </button>
        </div>
      )}
      {sound.hearingRisk === "주의" && (
        <p className="risk-note" role="note">
          ⚠️ 이 실험은 비교적 큰 레벨 또는 극단 주파수를 사용합니다. 청취
          시간을 짧게 하고, 이명이나 불편이 느껴지면 즉시 정지하세요.
        </p>
      )}
      <div className="lab-top">
        <button
          type="button"
          className={playing ? "btn btn-stop" : "btn btn-primary btn-play"}
          onClick={playing ? stop : start}
          disabled={starting || banner}
        >
          {playing ? "■ 정지" : "▶ 재생"}
        </button>
        <div className="lab-badges">
          {sound.needsHeadphones && (
            <span className="badge badge-hp">🎧 이어폰 필수</span>
          )}
          <span className="badge">합성: {sound.synthesis}</span>
          <span className="badge">CPU {sound.cpuCost}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="scope"
        aria-label="위쪽은 주파수 스펙트럼, 아래쪽은 시간 파형"
      />
      {presets.length > 0 && (
        <div className="presets" aria-label="프리셋">
          {presets.map((pr) => (
            <button
              key={pr.name}
              type="button"
              className="btn btn-preset"
              title={pr.note}
              onClick={() => applyPreset(pr)}
            >
              {pr.name}
            </button>
          ))}
        </div>
      )}
      <div className="sliders">
        {sound.params.map((spec) => {
          const log = isLogParam(sound.slug, spec.name);
          const v = params[spec.name];
          return (
            <div key={spec.name} className="slider-row">
              <div className="slider-head">
                <span className="slider-label">{paramLabel(spec.name)}</span>
                <span className="slider-value">
                  {fmt(v, spec.step)}
                  {spec.unit && <em> {spec.unit}</em>}
                </span>
              </div>
              <input
                type="range"
                min={log ? 0 : spec.min}
                max={log ? 1000 : spec.max}
                step={log ? 1 : spec.step}
                value={log ? toLogPos(v, spec.min, spec.max) : v}
                aria-label={paramLabel(spec.name)}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const nv = log
                    ? Math.min(
                        spec.max,
                        Math.max(spec.min, fromLogPos(raw, spec.min, spec.max, spec.step))
                      )
                    : raw;
                  setParams((prev) => ({ ...prev, [spec.name]: nv }));
                }}
              />
              <p className="slider-meaning">{spec.meaning}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
