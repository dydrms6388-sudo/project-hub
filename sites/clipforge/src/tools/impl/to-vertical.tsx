"use client";

import { useEffect, useRef, useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  selectClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, captureFrame } from "@/lib/media";
import { MediaMeta, Notice, SourcePicker, VIDEO_EXT, exec, h264Args, useSourceFile } from "./_shared";

type Mode = "crop" | "blur" | "color";

const SIZES = [
  { label: "1080 × 1920 (인스타 릴스·틱톡·쇼츠 권장)", w: 1080, h: 1920 },
  { label: "720 × 1280 (가벼움·빠름)", w: 720, h: 1280 },
  { label: "1440 × 2560 (고화질)", w: 1440, h: 2560 },
];

/** 선택한 방식의 필터 그래프를 만든다 */
export function buildVerticalFilter(mode: Mode, w: number, h: number, color: string): string {
  if (mode === "crop") {
    // 화면을 꽉 채우도록 확대한 뒤 가운데를 잘라낸다(좌우가 잘림)
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
  }
  if (mode === "color") {
    return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${color},setsar=1`;
  }
  // 블러 배경: 배경은 1/8 로 줄여 흐린 뒤 다시 키운다(같은 결과를 훨씬 빠르게)
  const bw = Math.round(w / 8);
  const bh = Math.round(h / 8);
  return (
    `split[bgsrc][fgsrc];` +
    `[bgsrc]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=luma_radius=6:luma_power=2:chroma_radius=6:chroma_power=2,scale=${w}:${h}[bg];` +
    `[fgsrc]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`
  );
}

export default function ToVertical() {
  const { file, info, probeError, onFiles } = useSourceFile(VIDEO_EXT);
  const [mode, setMode] = useState<Mode>("blur");
  const [sizeIdx, setSizeIdx] = useState(0);
  const [color, setColor] = useState("#000000");
  const [crf, setCrf] = useState(23);
  const job = useMediaJob();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const size = SIZES[sizeIdx];

  // 미리보기: 브라우저 디코더로 첫 프레임을 떠서 캔버스에 같은 규칙으로 그린다
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setPreviewError(null);
    captureFrame(file, Math.min(1, (info?.duration ?? 2) / 2), 720)
      .then((frame) => {
        if (!alive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = 270;
        const H = 480;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const s = frame.width / frame.height;
        const target = W / H;
        ctx.clearRect(0, 0, W, H);
        if (mode === "crop") {
          const scale = s > target ? H / frame.height : W / frame.width;
          const dw = frame.width * scale;
          const dh = frame.height * scale;
          ctx.drawImage(frame, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else {
          if (mode === "blur") {
            ctx.filter = "blur(10px)";
            const scale = s > target ? H / frame.height : W / frame.width;
            const dw = frame.width * scale * 1.15;
            const dh = frame.height * scale * 1.15;
            ctx.drawImage(frame, (W - dw) / 2, (H - dh) / 2, dw, dh);
            ctx.filter = "none";
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, W, H);
          }
          const scale = Math.min(W / frame.width, H / frame.height);
          const dw = frame.width * scale;
          const dh = frame.height * scale;
          ctx.drawImage(frame, (W - dw) / 2, (H - dh) / 2, dw, dh);
        }
      })
      .catch((e: Error) => alive && setPreviewError(e.message));
    return () => {
      alive = false;
    };
  }, [file, mode, color, info?.duration]);

  function start() {
    if (!file) return;
    const vf = buildVerticalFilter(mode, size.w, size.h, color);
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage("세로(9:16)로 다시 인코딩 중", 0, 100);
        const out = "vertical.mp4";
        await exec(ctx.ff, ["-i", paths[0], "-vf", vf, ...h264Args({ crf }), out]);
        const blob = await readOutput(ctx.ff, out, "video/mp4");
        return [{ name: `${baseName(file.name)}_세로.mp4`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={VIDEO_EXT} onFiles={onFiles} />
      <MediaMeta file={file} info={info} error={probeError} />

      {file && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-4">
            <Field label="배경 처리 방식">
              <div className="space-y-2">
                {(
                  [
                    ["blur", "블러 배경 (원본 전체가 보임 · 릴스에서 가장 무난)"],
                    ["crop", "가운데 크롭 (여백 없음 · 좌우가 잘림)"],
                    ["color", "단색 여백 (위아래 단색 띠)"],
                  ] as [Mode, string][]
                ).map(([v, label]) => (
                  <label key={v} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="vertical-mode"
                      value={v}
                      checked={mode === v}
                      onChange={() => setMode(v)}
                      className="mt-1"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </Field>

            {mode === "color" && (
              <Field label="여백 색">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="여백 색 선택"
                  className="h-10 w-20 rounded border border-slate-300"
                />
              </Field>
            )}

            <Field label="출력 해상도">
              <select
                value={sizeIdx}
                onChange={(e) => setSizeIdx(Number(e.target.value))}
                className={selectClass}
                aria-label="출력 해상도"
              >
                {SIZES.map((s, i) => (
                  <option key={s.label} value={i}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`화질 (CRF ${crf}) — 숫자가 작을수록 고화질·큰 용량`}>
              <input
                type="range"
                min={16}
                max={32}
                value={crf}
                onChange={(e) => setCrf(Number(e.target.value))}
                className="w-full"
                aria-label="CRF 값"
              />
            </Field>
          </div>

          <div className="justify-self-center">
            <canvas
              ref={canvasRef}
              width={270}
              height={480}
              className="h-[300px] w-[169px] rounded-lg border border-slate-300 bg-slate-900 sm:h-[480px] sm:w-[270px]"
              aria-label="세로 변환 미리보기"
            />
            <p className="mt-1 text-center text-xs text-slate-500">
              {previewError ? "미리보기 불가" : "미리보기 (첫 프레임)"}
            </p>
          </div>
        </div>
      )}

      {file && (
        <>
          <RunButton onClick={start} busy={job.busy}>
            세로 영상으로 변환
          </RunButton>
          <EngineNotice />
          <Notice tone="warn">
            원본이 이미 9:16 이면 다시 인코딩만 되고 화면은 그대로입니다. 가로 영상을 크롭하면 양옆이
            잘리므로 자막·자잘한 정보가 있는 영상은 블러 배경을 권합니다.
          </Notice>
        </>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} note="다운로드한 뒤 인스타그램 릴스·유튜브 쇼츠·틱톡에 그대로 올릴 수 있습니다." />
    </div>
  );
}
