"use client";

import { useEffect, useRef, useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  inputClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mimeOf, mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, parseClock, toClock, toFfTime } from "@/lib/media";
import { MediaMeta, MEDIA_EXT, Notice, SourcePicker, exec, h264Args, useSourceFile } from "./_shared";

export default function Trim() {
  const { file, info, probeError, onFiles } = useSourceFile(MEDIA_EXT);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [lossless, setLossless] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const job = useMediaJob();

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (info) {
      setStart(0);
      setEnd(Math.round(info.duration * 10) / 10);
    }
  }, [info]);

  const duration = info?.duration ?? 0;
  const cut = Math.max(0, end - start);
  const ext = (file?.name.split(".").pop() ?? "mp4").toLowerCase();
  const outExt = lossless ? ext : "mp4";

  function seek(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t;
  }

  function start_() {
    if (!file || cut <= 0) return;
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage(lossless ? "잘라내는 중 (재인코딩 없음)" : "구간을 다시 인코딩하는 중", 0, 100);
        const out = `trim.${outExt}`;
        const args = lossless
          ? [
              "-ss", toFfTime(start),
              "-i", paths[0],
              "-t", toFfTime(cut),
              "-c", "copy",
              "-avoid_negative_ts", "make_zero",
              "-map", "0",
              "-map_metadata", "0",
              out,
            ]
          : ["-ss", toFfTime(start), "-i", paths[0], "-t", toFfTime(cut), ...h264Args({ crf: 20 }), out];
        await exec(ctx.ff, args);
        const blob = await readOutput(ctx.ff, out, mimeOf(outExt));
        return [{ name: `${baseName(file.name)}_${Math.round(start)}s-${Math.round(end)}s.${outExt}`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={MEDIA_EXT} onFiles={onFiles} />
      <MediaMeta file={file} info={info} error={probeError} />

      {url && info?.hasVideo && (
        <video ref={videoRef} src={url} controls playsInline className="max-h-72 w-full rounded-lg bg-black" />
      )}
      {url && info && !info.hasVideo && <audio src={url} controls className="w-full" />}

      {file && duration > 0 && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label={`시작 ${toClock(start)}`}>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={start}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), end - 0.1);
                setStart(Math.max(0, v));
                seek(Math.max(0, v));
              }}
              className="w-full"
              aria-label="시작 위치"
            />
          </Field>
          <Field label={`끝 ${toClock(end)}`}>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={end}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), start + 0.1);
                setEnd(Math.min(duration, v));
                seek(Math.min(duration, v));
              }}
              className="w-full"
              aria-label="끝 위치"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="시작 시각 직접 입력 (mm:ss)">
              <input
                type="text"
                defaultValue={toClock(start)}
                onBlur={(e) => {
                  const v = parseClock(e.target.value);
                  if (v !== null) setStart(Math.max(0, Math.min(v, end - 0.1)));
                }}
                className={inputClass}
                aria-label="시작 시각"
              />
            </Field>
            <Field label="끝 시각 직접 입력 (mm:ss)">
              <input
                type="text"
                defaultValue={toClock(end)}
                onBlur={(e) => {
                  const v = parseClock(e.target.value);
                  if (v !== null) setEnd(Math.min(duration, Math.max(v, start + 0.1)));
                }}
                className={inputClass}
                aria-label="끝 시각"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStart(videoRef.current?.currentTime ?? start)}
              aria-label="현재 재생 위치를 시작으로"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              현재 위치를 시작으로
            </button>
            <button
              type="button"
              onClick={() => setEnd(videoRef.current?.currentTime ?? end)}
              aria-label="현재 재생 위치를 끝으로"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              현재 위치를 끝으로
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={lossless} onChange={(e) => setLossless(e.target.checked)} className="mt-1" />
            <span>
              <b>무손실로 자르기</b> (-c copy) — 다시 인코딩하지 않아 화질 손실이 없고 몇 초면 끝납니다. 대신
              시작점이 가장 가까운 <b>키프레임</b>으로 당겨져 최대 몇 초 어긋날 수 있습니다.
            </span>
          </label>

          <p className="text-sm text-slate-600">
            잘라낼 길이: <b>{toClock(cut)}</b> · 출력 형식 {outExt.toUpperCase()}
          </p>

          <RunButton onClick={start_} busy={job.busy} disabled={cut <= 0}>
            {lossless ? "무손실로 자르기" : "정확하게 잘라 인코딩"}
          </RunButton>
          <EngineNotice />
          <Notice tone="warn">
            정확한 프레임에서 잘라야 하면 무손실 옵션을 끄세요. 재인코딩은 시간이 걸리지만 지정한 시각에서
            정확히 시작합니다.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
