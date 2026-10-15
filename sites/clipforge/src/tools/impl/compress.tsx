"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  inputClass,
  selectClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mountInputs, readOutput, removeQuiet } from "@/lib/ffmpeg/fs";
import { baseName, formatBytes } from "@/lib/media";
import { MediaMeta, Notice, SourcePicker, VIDEO_EXT, exec, h264Args, useSourceFile } from "./_shared";

type Mode = "size" | "crf";

const CRF_PRESETS = [
  { label: "고화질 (CRF 20) — 눈으로 차이 거의 없음", crf: 20 },
  { label: "권장 (CRF 24) — 용량 절반 수준", crf: 24 },
  { label: "작게 (CRF 28) — SNS 업로드용", crf: 28 },
  { label: "아주 작게 (CRF 32) — 화질 손해 감수", crf: 32 },
];

const SCALES = [
  { label: "원본 해상도 유지", v: 0 },
  { label: "가로/세로 긴 쪽 1080px", v: 1080 },
  { label: "가로/세로 긴 쪽 720px", v: 720 },
  { label: "가로/세로 긴 쪽 480px", v: 480 },
];

/** 목표 용량(MB) + 길이(초) + 오디오 비트레이트(kbps) → 영상 비트레이트(kbps) */
export function targetVideoKbps(targetMB: number, durationSec: number, audioKbps: number): number {
  if (durationSec <= 0) return 0;
  const totalKbit = targetMB * 8 * 1024; // 1MB = 8192kbit
  const videoKbps = totalKbit / durationSec - audioKbps;
  return Math.max(80, Math.round(videoKbps * 0.97)); // 컨테이너 오버헤드 3% 여유
}

export default function Compress() {
  const { file, info, probeError, onFiles } = useSourceFile(VIDEO_EXT);
  const [mode, setMode] = useState<Mode>("crf");
  const [crfIdx, setCrfIdx] = useState(1);
  const [scale, setScale] = useState(0);
  const [targetMB, setTargetMB] = useState(20);
  const [audioKbps, setAudioKbps] = useState(128);
  const [twoPass, setTwoPass] = useState(true);
  const job = useMediaJob();

  useEffect(() => {
    if (file) setTargetMB(Math.max(5, Math.round((file.size / 1024 / 1024) * 0.3)));
  }, [file]);

  const vKbps = useMemo(
    () => targetVideoKbps(targetMB, info?.duration ?? 0, audioKbps),
    [targetMB, info?.duration, audioKbps],
  );

  const scaleFilter =
    scale === 0
      ? null
      : `scale='if(gt(iw,ih),min(${scale},iw),-2)':'if(gt(iw,ih),-2,min(${scale},ih))',setsar=1`;

  function start() {
    if (!file) return;
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      const out = "compressed.mp4";
      try {
        const vf = scaleFilter ? ["-vf", scaleFilter] : [];
        if (mode === "crf") {
          ctx.stage("압축하는 중", 0, 100);
          await exec(ctx.ff, [
            "-i", paths[0],
            ...vf,
            ...h264Args({ crf: CRF_PRESETS[crfIdx].crf, preset: "veryfast", audioKbps }),
            out,
          ]);
        } else if (twoPass) {
          // 2패스: 1패스에서 복잡도를 측정해 로그로 남기고, 2패스에서 목표 비트레이트를 정확히 맞춘다
          ctx.stage(`1/2 단계 — 영상 분석 중 (목표 ${vKbps}kbps)`, 0, 45);
          await exec(ctx.ff, [
            "-i", paths[0],
            ...vf,
            "-c:v", "libx264", "-b:v", `${vKbps}k`, "-preset", "veryfast",
            "-pass", "1", "-passlogfile", "pass",
            "-an", "-f", "null", "/dev/null",
          ]);
          ctx.stage("2/2 단계 — 목표 용량에 맞춰 인코딩 중", 45, 100);
          await exec(ctx.ff, [
            "-i", paths[0],
            ...vf,
            "-c:v", "libx264", "-b:v", `${vKbps}k`, "-preset", "veryfast",
            "-pass", "2", "-passlogfile", "pass",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", `${audioKbps}k`,
            "-movflags", "+faststart",
            out,
          ]);
          await removeQuiet(ctx.ff, "pass-0.log");
          await removeQuiet(ctx.ff, "pass-0.log.mbtree");
        } else {
          ctx.stage(`목표 ${vKbps}kbps 로 인코딩 중`, 0, 100);
          await exec(ctx.ff, [
            "-i", paths[0],
            ...vf,
            "-c:v", "libx264", "-b:v", `${vKbps}k`,
            "-maxrate", `${Math.round(vKbps * 1.5)}k`,
            "-bufsize", `${Math.round(vKbps * 3)}k`,
            "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", `${audioKbps}k`,
            "-movflags", "+faststart",
            out,
          ]);
        }
        const blob = await readOutput(ctx.ff, out, "video/mp4");
        return [{ name: `${baseName(file.name)}_압축.mp4`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  const saved =
    file && job.files[0] ? Math.round((1 - job.files[0].blob.size / file.size) * 100) : null;

  return (
    <div className="space-y-4">
      <SourcePicker extensions={VIDEO_EXT} onFiles={onFiles} />
      <MediaMeta file={file} info={info} error={probeError} />

      {file && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label="압축 방식">
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="cmode" checked={mode === "crf"} onChange={() => setMode("crf")} className="mt-1" />
                <span>
                  <b>화질 기준 (CRF)</b> — 화질을 고정하고 용량은 영상에 따라 달라집니다. 대부분 이쪽이 낫습니다.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="cmode" checked={mode === "size"} onChange={() => setMode("size")} className="mt-1" />
                <span>
                  <b>목표 용량 맞추기</b> — “25MB 이하” 처럼 업로드 제한이 있을 때.
                </span>
              </label>
            </div>
          </Field>

          {mode === "crf" ? (
            <Field label="화질 프리셋">
              <select value={crfIdx} onChange={(e) => setCrfIdx(Number(e.target.value))} className={selectClass} aria-label="화질 프리셋">
                {CRF_PRESETS.map((p, i) => (
                  <option key={p.crf} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="목표 용량 (MB)">
                <input
                  type="number"
                  min={1}
                  value={targetMB}
                  onChange={(e) => setTargetMB(Math.max(1, Number(e.target.value) || 1))}
                  className={inputClass}
                  aria-label="목표 용량 MB"
                />
              </Field>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                계산된 영상 비트레이트: <b>{vKbps.toLocaleString()} kbps</b>
                <br />
                (목표 {targetMB}MB × 8192kbit ÷ {Math.round(info?.duration ?? 0)}초 − 오디오 {audioKbps}kbps, 컨테이너 여유 3%)
                {vKbps <= 200 && (
                  <>
                    <br />
                    <span className="text-amber-700">비트레이트가 너무 낮습니다. 해상도를 함께 줄이세요.</span>
                  </>
                )}
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={twoPass} onChange={(e) => setTwoPass(e.target.checked)} className="mt-1" />
                <span>
                  <b>2패스</b>로 정확히 맞추기 — 시간은 약 2배 걸리지만 목표 용량에 훨씬 근접합니다.
                </span>
              </label>
            </>
          )}

          <Field label="해상도">
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className={selectClass} aria-label="해상도">
              {SCALES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="오디오 비트레이트 (kbps)">
            <select value={audioKbps} onChange={(e) => setAudioKbps(Number(e.target.value))} className={selectClass} aria-label="오디오 비트레이트">
              {[64, 96, 128, 192].map((v) => (
                <option key={v} value={v}>
                  {v} kbps
                </option>
              ))}
            </select>
          </Field>

          <RunButton onClick={start} busy={job.busy}>
            용량 줄이기
          </RunButton>
          <EngineNotice />
          <Notice>
            원본 {formatBytes(file.size)} → 결과는 코덱(H.264)·해상도·움직임 양에 따라 달라집니다. 이미 잘 압축된
            영상은 더 줄지 않거나 오히려 커질 수 있습니다.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles
        files={job.files}
        note={saved !== null ? `원본 대비 ${saved > 0 ? `${saved}% 감소` : `${-saved}% 증가`}` : undefined}
      />
    </div>
  );
}
