"use client";

import { useEffect, useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  selectClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mimeOf, mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, toClock, toFfTime } from "@/lib/media";
import { MEDIA_EXT, MediaMeta, Notice, SourcePicker, exec, useSourceFile } from "./_shared";

type Fmt = "mp3" | "m4a" | "wav" | "copy";

export function audioArgs(fmt: Fmt, kbps: number): { args: string[]; ext: string } {
  switch (fmt) {
    case "mp3":
      return { args: ["-vn", "-c:a", "libmp3lame", "-b:a", `${kbps}k`, "-ar", "44100"], ext: "mp3" };
    case "m4a":
      return { args: ["-vn", "-c:a", "aac", "-b:a", `${kbps}k`, "-ar", "48000"], ext: "m4a" };
    case "wav":
      return { args: ["-vn", "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2"], ext: "wav" };
    case "copy":
      // 재인코딩 없이 오디오 트랙만 꺼낸다. mp4/mov 는 대부분 AAC 라 .m4a 로 담긴다.
      return { args: ["-vn", "-c:a", "copy"], ext: "m4a" };
  }
}

export default function ExtractAudio() {
  const { file, info, probeError, onFiles } = useSourceFile(MEDIA_EXT);
  const [fmt, setFmt] = useState<Fmt>("mp3");
  const [kbps, setKbps] = useState(192);
  const [whole, setWhole] = useState(true);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const job = useMediaJob();

  useEffect(() => {
    if (info) {
      setStart(0);
      setEnd(Math.round(info.duration));
    }
  }, [info]);

  function run() {
    if (!file) return;
    const { args, ext } = audioArgs(fmt, kbps);
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage("오디오를 뽑는 중", 0, 100);
        const out = `audio.${ext}`;
        const range = whole ? [] : ["-ss", toFfTime(start), "-t", toFfTime(Math.max(0.1, end - start))];
        await exec(ctx.ff, [...range, "-i", paths[0], ...args, out]);
        const blob = await readOutput(ctx.ff, out, mimeOf(ext));
        return [{ name: `${baseName(file.name)}.${ext}`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={MEDIA_EXT} onFiles={onFiles} />
      <MediaMeta file={file} info={info} error={probeError} />

      {file && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label="저장 형식">
            <select value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)} className={selectClass} aria-label="저장 형식">
              <option value="mp3">MP3 — 어디서나 재생됨 (libmp3lame)</option>
              <option value="m4a">M4A(AAC) — 같은 용량에서 MP3 보다 음질이 좋음</option>
              <option value="wav">WAV — 무압축 PCM, 편집·업로드용 (용량 큼)</option>
              <option value="copy">원본 그대로 추출 — 재인코딩 없음 (mp4/mov 권장)</option>
            </select>
          </Field>

          {(fmt === "mp3" || fmt === "m4a") && (
            <Field label="비트레이트">
              <select value={kbps} onChange={(e) => setKbps(Number(e.target.value))} className={selectClass} aria-label="비트레이트">
                {[96, 128, 160, 192, 256, 320].map((v) => (
                  <option key={v} value={v}>
                    {v} kbps{v === 192 ? " (권장)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
            전체 구간 추출
          </label>

          {!whole && info && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`시작 ${toClock(start)}`}>
                <input
                  type="range"
                  min={0}
                  max={info.duration}
                  step={0.5}
                  value={start}
                  onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.5))}
                  className="w-full"
                  aria-label="시작 위치"
                />
              </Field>
              <Field label={`끝 ${toClock(end)}`}>
                <input
                  type="range"
                  min={0}
                  max={info.duration}
                  step={0.5}
                  value={end}
                  onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.5))}
                  className="w-full"
                  aria-label="끝 위치"
                />
              </Field>
            </div>
          )}

          <RunButton onClick={run} busy={job.busy}>
            오디오 추출
          </RunButton>
          <EngineNotice />
          <Notice>
            “원본 그대로 추출”은 오디오 트랙을 손대지 않고 컨테이너만 바꾸므로 몇 초면 끝나고 음질 손실이
            전혀 없습니다. 다만 원본 코덱이 M4A 컨테이너에 담기지 않으면 실패합니다 — 그럴 땐 MP3/M4A 를 고르세요.
          </Notice>
          <Notice tone="warn">
            저작권이 있는 음원·영상의 오디오를 추출해 배포하면 저작권 침해가 될 수 있습니다. 개인적 이용
            범위에서만 사용하세요.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
