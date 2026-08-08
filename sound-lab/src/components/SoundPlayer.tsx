"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ParamSpec, Sound } from "@/lib/sounds";
import type { Preset } from "@/lib/content/types";
import { clampValue, readValuesFromLocation, writeValuesToLocation } from "@/lib/urlState";
import type { MasterChain, EngineHandle } from "@/lib/audio/core";
import { createMasterChain } from "@/lib/audio/core";
import { getEngine } from "@/lib/audio/engines";

/** 범위가 넓은 주파수형 파라미터는 슬라이더를 로그 스케일로 움직인다 */
function isLog(p: ParamSpec): boolean {
  return p.min > 0 && p.max / p.min >= 50;
}
function toSlider(p: ParamSpec, v: number): number {
  if (!isLog(p)) return v;
  return Math.log(v / p.min) / Math.log(p.max / p.min);
}
function fromSlider(p: ParamSpec, s: number): number {
  if (!isLog(p)) return s;
  return clampValue(p.min * Math.pow(p.max / p.min, s), p.min, p.max, p.step);
}

export default function SoundPlayer({
  sound,
  presets,
}: {
  sound: Sound;
  presets: Preset[];
}) {
  const [values, setValues] = useState<number[]>(() =>
    sound.params.map((p) => p.default)
  );
  const [playing, setPlaying] = useState(false);
  const [showVolumeNotice, setShowVolumeNotice] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const chainRef = useRef<MasterChain | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // 공유 URL(?p=)이 있으면 그 상태를 복원
  useEffect(() => {
    const fromUrl = readValuesFromLocation(sound);
    if (fromUrl) setValues(fromUrl);
    try {
      if (!localStorage.getItem("sl-volume-notice")) setShowVolumeNotice(true);
    } catch {
      setShowVolumeNotice(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.slug]);

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    try {
      engineRef.current?.stop();
    } catch {
      /* 이미 정지된 노드 무시 */
    }
    engineRef.current = null;
    chainRef.current?.dispose();
    chainRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
    setPlaying(false);
  }, []);

  // 페이지 이탈·언마운트 시 오디오 컨텍스트 정리 (소리 잔류 금지)
  useEffect(() => {
    const onHide = () => stopAll();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stopAll();
    };
  }, [stopAll]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const chain = chainRef.current;
    if (!canvas || !chain) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    const W = canvas.width;
    const H = canvas.height;
    const analyser = chain.analyser;
    const wave = new Uint8Array(analyser.fftSize);
    const spec = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(wave);
      analyser.getByteFrequencyData(spec);
      g.fillStyle = "#0d1220";
      g.fillRect(0, 0, W, H);
      // 위: 파형
      const half = H * 0.55;
      g.strokeStyle = "#5eead4";
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * W;
        const y = half * 0.5 + ((wave[i] - 128) / 128) * half * 0.46;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      // 아래: 스펙트럼 (로그 주파수 축)
      const bins = spec.length;
      const bars = 96;
      const sr = ctxRef.current?.sampleRate ?? 48000;
      const fMin = 30;
      const fMax = Math.min(18000, sr / 2);
      for (let b = 0; b < bars; b++) {
        const f0 = fMin * Math.pow(fMax / fMin, b / bars);
        const f1 = fMin * Math.pow(fMax / fMin, (b + 1) / bars);
        const i0 = Math.floor((f0 / (sr / 2)) * bins);
        const i1 = Math.max(i0 + 1, Math.floor((f1 / (sr / 2)) * bins));
        let m = 0;
        for (let i = i0; i < i1 && i < bins; i++) m = Math.max(m, spec[i]);
        const h = (m / 255) * (H - half - 8);
        const x = (b / bars) * W;
        g.fillStyle = "#818cf8";
        g.fillRect(x + 1, H - h, W / bars - 2, h);
      }
      g.fillStyle = "#64748b";
      g.font = "11px sans-serif";
      g.fillText("파형", 8, 16);
      g.fillText("스펙트럼 (로그 주파수)", 8, half + 16);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    if (playing) {
      stopAll();
      return;
    }
    const builder = getEngine(sound.slug);
    if (!builder) return;
    const ctx = new AudioContext();
    await ctx.resume();
    const chain = createMasterChain(ctx);
    ctxRef.current = ctx;
    chainRef.current = chain;
    engineRef.current = builder({ ctx, out: chain.input, values: valuesRef.current });
    setPlaying(true);
    draw();
  }, [playing, sound.slug, stopAll, draw]);

  const setValue = useCallback((idx: number, raw: number) => {
    setValues((prev) => {
      const p = sound.params[idx];
      const next = [...prev];
      next[idx] = clampValue(raw, p.min, p.max, p.step);
      engineRef.current?.update(next);
      writeValuesToLocation(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.slug]);

  const applyPreset = useCallback((preset: Preset) => {
    const next = preset.values.map((v, i) => {
      const p = sound.params[i];
      return clampValue(v, p.min, p.max, p.step);
    });
    setValues(next);
    engineRef.current?.update(next);
    writeValuesToLocation(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.slug]);

  const dismissNotice = () => {
    setShowVolumeNotice(false);
    try {
      localStorage.setItem("sl-volume-notice", "1");
    } catch {
      /* 저장 실패 무시 */
    }
  };

  const fmt = (p: ParamSpec, v: number) =>
    p.step >= 1 ? String(Math.round(v)) : String(Number(v.toFixed(3)));

  return (
    <div className="player">
      {showVolumeNotice && (
        <div className="notice notice-volume" role="alert">
          <strong>볼륨 주의</strong> — 기기 볼륨을 낮춘 상태에서 재생을 시작한 뒤
          천천히 올리세요. 모든 소리에는 리미터가 걸려 있지만, 시작 볼륨은 기기
          설정을 따릅니다.
          <button type="button" onClick={dismissNotice}>확인</button>
        </div>
      )}
      {sound.hearingRisk === "주의" && (
        <div className="notice notice-risk">
          <strong>청력 주의 항목</strong> — 잘 들리지 않는다고 기기 볼륨을 크게
          올리지 마세요. 가청 경계 대역에서는 소리가 들리지 않아도 출력은 계속되고
          있을 수 있습니다.
        </div>
      )}
      <div className="player-head">
        <button
          type="button"
          className={`play-btn ${playing ? "on" : ""}`}
          onClick={start}
          aria-pressed={playing}
        >
          {playing ? "■ 정지" : "▶ 재생"}
        </button>
        {sound.needsHeadphones && (
          <span className="badge badge-phones">🎧 이어폰 필수</span>
        )}
        <span className="badge">합성: {sound.synthesis}</span>
        <span className="badge">CPU {sound.cpuCost}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={880}
        height={260}
        className="scope"
        aria-label="파형과 스펙트럼 시각화"
      />
      <div className="sliders">
        {sound.params.map((p, i) => (
          <label key={p.name} className="slider-row">
            <span className="slider-name">
              {p.name}
              <em>
                {fmt(p, values[i])}
                {p.unit && ` ${p.unit}`}
              </em>
            </span>
            <input
              type="range"
              min={isLog(p) ? 0 : p.min}
              max={isLog(p) ? 1 : p.max}
              step={isLog(p) ? 0.001 : p.step}
              value={toSlider(p, values[i])}
              onChange={(e) => setValue(i, fromSlider(p, Number(e.target.value)))}
            />
            <span className="slider-meaning">{p.meaning}</span>
          </label>
        ))}
      </div>
      <div className="presets">
        <span className="presets-label">프리셋</span>
        {presets.map((pr) => (
          <button key={pr.name} type="button" onClick={() => applyPreset(pr)}>
            {pr.name}
          </button>
        ))}
      </div>
      <p className="share-hint">
        슬라이더 상태는 주소창 URL에 저장됩니다. 지금 주소를 복사해 보내면 같은
        설정이 재현됩니다.
      </p>
    </div>
  );
}
