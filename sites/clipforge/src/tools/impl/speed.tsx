"use client";

import { useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  inputClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, toClock } from "@/lib/media";
import { MEDIA_EXT, MediaMeta, Notice, SourcePicker, exec, h264Args, useSourceFile } from "./_shared";

/**
 * atempo 는 한 번에 0.5~2.0 배만 안전하게 처리한다.
 * 2배를 넘으면 여러 개를 이어 붙여 곱이 목표 배속이 되게 만든다.
 * 예) 4배 → atempo=2.0,atempo=2.0 / 0.25배 → atempo=0.5,atempo=0.5
 */
export function atempoChain(rate: number): number[] {
  const out: number[] = [];
  let r = rate;
  let guard = 0;
  while (r > 2 && guard++ < 12) {
    out.push(2);
    r /= 2;
  }
  while (r < 0.5 && guard++ < 12) {
    out.push(0.5);
    r *= 2;
  }
  if (Math.abs(r - 1) > 1e-6) out.push(Number(r.toFixed(6)));
  return out.length > 0 ? out : [1];
}

const PRESETS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4];

export default function Speed() {
  const { file, info, probeError, onFiles } = useSourceFile(MEDIA_EXT);
  const [rate, setRate] = useState(2);
  const [keepAudio, setKeepAudio] = useState(true);
  const [keepPitch, setKeepPitch] = useState(true);
  const job = useMediaJob();

  const chain = atempoChain(rate);
  const newDuration = info ? info.duration / rate : 0;

  function run() {
    if (!file || rate <= 0) return;
    const pts = (1 / rate).toFixed(6);
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage(`${rate}배속으로 다시 만드는 중`, 0, 100);
        const out = "speed.mp4";
        const hasVideo = info?.hasVideo ?? true;

        if (!hasVideo) {
          const af = keepPitch
            ? chain.map((c) => `atempo=${c}`).join(",")
            : `asetrate=44100*${rate},aresample=44100`;
          await exec(ctx.ff, ["-i", paths[0], "-af", af, "-c:a", "aac", "-b:a", "160k", "speed.m4a"]);
          const blob = await readOutput(ctx.ff, "speed.m4a", "audio/mp4");
          return [{ name: `${baseName(file.name)}_${rate}배속.m4a`, blob }];
        }

        const videoFilter = `[0:v]setpts=${pts}*PTS[v]`;
        if (keepAudio) {
          const af = keepPitch
            ? chain.map((c) => `atempo=${c}`).join(",")
            : `asetrate=48000*${rate},aresample=48000`;
          const fc = `${videoFilter};[0:a]${af}[a]`;
          try {
            await exec(ctx.ff, [
              "-i", paths[0],
              "-filter_complex", fc,
              "-map", "[v]", "-map", "[a]",
              ...h264Args({ crf: 22 }),
              out,
            ]);
          } catch {
            // 오디오 트랙이 없는 영상 → 영상만 처리
            await exec(ctx.ff, ["-i", paths[0], "-vf", `setpts=${pts}*PTS`, ...h264Args({ crf: 22, audio: "none" }), out]);
          }
        } else {
          await exec(ctx.ff, ["-i", paths[0], "-vf", `setpts=${pts}*PTS`, ...h264Args({ crf: 22, audio: "none" }), out]);
        }
        const blob = await readOutput(ctx.ff, out, "video/mp4");
        return [{ name: `${baseName(file.name)}_${rate}배속.mp4`, blob }];
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
          <Field label={`배속 ${rate}배`}>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRate(p)}
                  aria-label={`${p}배속`}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    rate === p ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700"
                  }`}
                >
                  {p}배
                </button>
              ))}
            </div>
          </Field>

          <Field label="직접 입력 (0.1 ~ 16)">
            <input
              type="number"
              min={0.1}
              max={16}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Math.min(16, Math.max(0.1, Number(e.target.value) || 1)))}
              className={inputClass}
              aria-label="배속 값"
            />
          </Field>

          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
              소리 유지
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={keepPitch}
                onChange={(e) => setKeepPitch(e.target.checked)}
                disabled={!keepAudio}
              />
              음정 유지 (atempo)
            </label>
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            영상: <code>setpts={(1 / rate).toFixed(4)}*PTS</code>
            {keepAudio && (
              <>
                <br />
                오디오: <code>{keepPitch ? chain.map((c) => `atempo=${c}`).join(",") : `asetrate·aresample`}</code>
                {keepPitch && chain.length > 1 && " — 2배를 넘어 여러 단계로 이어 붙였습니다"}
              </>
            )}
            {info && (
              <>
                <br />
                길이 {toClock(info.duration)} → <b>{toClock(newDuration)}</b>
              </>
            )}
          </p>

          <RunButton onClick={run} busy={job.busy}>
            배속 변환
          </RunButton>
          <EngineNotice />
          <Notice>
            “음정 유지”를 끄면 테이프를 빨리 감은 것처럼 목소리가 높아집니다(asetrate). 켜면 속도만 바꾸고
            음정은 그대로 둡니다 — 강의·브이로그에는 켜 두는 쪽이 자연스럽습니다.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
