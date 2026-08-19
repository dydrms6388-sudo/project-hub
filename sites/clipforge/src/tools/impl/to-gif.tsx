"use client";

import { useEffect, useState } from "react";
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
import { baseName, toClock, toFfTime } from "@/lib/media";
import { MediaMeta, Notice, SourcePicker, VIDEO_EXT, exec, useSourceFile } from "./_shared";

const DITHERS = [
  { v: "bayer:bayer_scale=3", label: "bayer (용량 작음 · 격자 패턴)" },
  { v: "sierra2_4a", label: "sierra2_4a (자연스러움 · 용량 큼)" },
  { v: "none", label: "없음 (색 띠가 보일 수 있음)" },
];

export default function ToGif() {
  const { file, info, probeError, onFiles } = useSourceFile(VIDEO_EXT);
  const [start, setStart] = useState(0);
  const [dur, setDur] = useState(5);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  const [dither, setDither] = useState(DITHERS[0].v);
  const [loop, setLoop] = useState(true);
  const job = useMediaJob();

  useEffect(() => {
    if (info) {
      setStart(0);
      setDur(Math.min(5, Math.max(0.5, info.duration)));
    }
  }, [info]);

  const frames = Math.round(fps * dur);

  function run() {
    if (!file) return;
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      const filter = `fps=${fps},scale=${width}:-1:flags=lanczos`;
      try {
        // 1패스: 이 구간에 실제로 쓰인 색으로 256색 팔레트를 만든다
        ctx.stage("1/2 단계 — 색 팔레트 만드는 중", 0, 40);
        await exec(ctx.ff, [
          "-ss", toFfTime(start),
          "-t", toFfTime(dur),
          "-i", paths[0],
          "-vf", `${filter},palettegen=stats_mode=diff`,
          "palette.png",
        ]);

        // 2패스: 그 팔레트로 GIF 를 쓴다
        ctx.stage("2/2 단계 — GIF 만드는 중", 40, 100);
        await exec(ctx.ff, [
          "-ss", toFfTime(start),
          "-t", toFfTime(dur),
          "-i", paths[0],
          "-i", "palette.png",
          "-lavfi", `${filter}[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`,
          "-loop", loop ? "0" : "-1",
          "out.gif",
        ]);
        await removeQuiet(ctx.ff, "palette.png");
        const blob = await readOutput(ctx.ff, "out.gif", "image/gif");
        return [{ name: `${baseName(file.name)}.gif`, blob }];
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
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`시작 ${toClock(start)}`}>
              <input
                type="range"
                min={0}
                max={Math.max(0, (info?.duration ?? 0) - 0.5)}
                step={0.1}
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="w-full"
                aria-label="시작 위치"
              />
            </Field>
            <Field label={`길이 ${dur.toFixed(1)}초`} hint="GIF 는 프레임마다 통짜 이미지라 10초를 넘기면 급격히 무거워집니다.">
              <input
                type="range"
                min={0.5}
                max={Math.min(30, Math.max(1, (info?.duration ?? 5) - start))}
                step={0.1}
                value={dur}
                onChange={(e) => setDur(Number(e.target.value))}
                className="w-full"
                aria-label="길이"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="프레임레이트 (fps)">
              <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className={selectClass} aria-label="프레임레이트">
                {[8, 10, 12, 15, 20, 24].map((v) => (
                  <option key={v} value={v}>
                    {v} fps
                  </option>
                ))}
              </select>
            </Field>
            <Field label="가로 폭 (px)">
              <input
                type="number"
                min={80}
                max={1080}
                step={20}
                value={width}
                onChange={(e) => setWidth(Math.max(80, Number(e.target.value) || 480))}
                className={inputClass}
                aria-label="가로 폭"
              />
            </Field>
          </div>

          <Field label="디더링 방식" hint="256색으로 줄일 때 생기는 색 계단을 어떻게 흩뿌릴지 정합니다.">
            <select value={dither} onChange={(e) => setDither(e.target.value)} className={selectClass} aria-label="디더링">
              {DITHERS.map((d) => (
                <option key={d.v} value={d.v}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            무한 반복
          </label>

          <p className="text-xs text-slate-600">
            총 {frames} 프레임 · 예상 크기는 대략 {Math.round((frames * width * width * 0.5625) / 1024 / 12)}KB 안팎
            (내용에 따라 크게 달라집니다)
          </p>

          <RunButton onClick={run} busy={job.busy}>
            GIF 로 변환
          </RunButton>
          <EngineNotice />
          <Notice tone="warn">
            GIF 는 색이 256개뿐이고 압축률이 낮습니다. 같은 길이라면 MP4 가 보통 10배 이상 작습니다. 카카오톡·
            디스코드처럼 GIF 만 되는 곳이 아니라면 MP4 를 그대로 쓰는 편이 낫습니다.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
