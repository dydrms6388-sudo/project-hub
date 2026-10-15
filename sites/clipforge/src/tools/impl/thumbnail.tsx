"use client";

import { useEffect, useState } from "react";
import DownloadButton from "@/components/DownloadButton";
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
import { mimeOf, mountInputs, readOutput, removeQuiet } from "@/lib/ffmpeg/fs";
import { baseName, parseClock, toClock, toFfTime } from "@/lib/media";
import { MediaMeta, Notice, SourcePicker, VIDEO_EXT, exec, useSourceFile } from "./_shared";

type Mode = "even" | "manual" | "scene";

export default function Thumbnail() {
  const { file, info, probeError, onFiles } = useSourceFile(VIDEO_EXT);
  const [mode, setMode] = useState<Mode>("even");
  const [count, setCount] = useState(6);
  const [times, setTimes] = useState("00:03, 00:10, 01:00");
  const [scene, setScene] = useState(0.4);
  const [fmt, setFmt] = useState<"jpg" | "png">("jpg");
  const [width, setWidth] = useState(1280);
  const job = useMediaJob();

  useEffect(() => {
    if (info?.width) setWidth(Math.min(1920, info.width));
  }, [info?.width]);

  const duration = info?.duration ?? 0;

  const manualTimes = times
    .split(/[,\n]/)
    .map((t) => parseClock(t))
    .filter((t): t is number => t !== null && t >= 0);

  function run() {
    if (!file) return;
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      const vf = `scale=${width}:-2:flags=lanczos`;
      const q = fmt === "jpg" ? ["-q:v", "2"] : [];
      try {
        if (mode === "scene") {
          ctx.stage("장면이 바뀌는 지점을 찾는 중", 0, 100);
          await exec(ctx.ff, [
            "-i", paths[0],
            "-vf", `select='gt(scene,${scene})',${vf}`,
            "-fps_mode", "vfr",
            "-frames:v", String(Math.min(40, count)),
            ...q,
            `scene_%03d.${fmt}`,
          ]);
          const entries = await ctx.ff.listDir("/");
          const names = entries
            .filter((e) => !e.isDir && new RegExp(`^scene_\\d+\\.${fmt}$`).test(e.name))
            .map((e) => e.name)
            .sort();
          if (names.length === 0) {
            throw new Error("장면 전환을 찾지 못했습니다. 민감도를 낮춰(0.2 등) 다시 시도해 보세요.");
          }
          const out = [];
          for (const n of names) {
            const blob = await readOutput(ctx.ff, n, mimeOf(fmt));
            out.push({ name: `${baseName(file.name)}_${n}`, blob });
          }
          return out;
        }

        const list = mode === "even"
          ? Array.from({ length: count }, (_, i) => (duration * (i + 0.5)) / count)
          : manualTimes;
        if (list.length === 0) throw new Error("추출할 시각이 없습니다.");

        const out = [];
        for (let i = 0; i < list.length; i++) {
          if (ctx.cancelled()) break;
          const t = Math.max(0, Math.min(list[i], Math.max(0, duration - 0.05)));
          ctx.stage(`${i + 1}/${list.length}번째 프레임 추출 중 (${toClock(t)})`, (i / list.length) * 100, ((i + 1) / list.length) * 100);
          const name = `shot_${String(i + 1).padStart(2, "0")}.${fmt}`;
          await exec(ctx.ff, ["-ss", toFfTime(t), "-i", paths[0], "-frames:v", "1", "-vf", vf, ...q, name]);
          const blob = await readOutput(ctx.ff, name, mimeOf(fmt));
          out.push({ name: `${baseName(file.name)}_${toClock(t).replace(":", "m")}s.${fmt}`, blob });
          await removeQuiet(ctx.ff, name);
        }
        return out;
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
          <Field label="추출 방식">
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="thumb-mode" checked={mode === "even"} onChange={() => setMode("even")} className="mt-1" />
                <span><b>균등 간격</b> — 영상 전체를 일정 간격으로 나눠 여러 장</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="thumb-mode" checked={mode === "manual"} onChange={() => setMode("manual")} className="mt-1" />
                <span><b>시각 직접 지정</b> — 원하는 순간만 콕 집어서</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="thumb-mode" checked={mode === "scene"} onChange={() => setMode("scene")} className="mt-1" />
                <span><b>장면 전환 자동 감지</b> — 화면이 크게 바뀌는 지점만</span>
              </label>
            </div>
          </Field>

          {mode === "even" && (
            <Field label={`장 수 ${count}장`}>
              <input type="range" min={1} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full" aria-label="장 수" />
            </Field>
          )}

          {mode === "manual" && (
            <Field label="시각 목록 (쉼표 또는 줄바꿈으로 구분 · mm:ss 또는 초)" hint={`인식된 시각 ${manualTimes.length}개`}>
              <textarea
                value={times}
                onChange={(e) => setTimes(e.target.value)}
                className="h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
                aria-label="시각 목록"
              />
            </Field>
          )}

          {mode === "scene" && (
            <>
              <Field label={`민감도 ${scene.toFixed(2)}`} hint="낮출수록 더 많이 잡힙니다(0.2 ~ 0.5 권장).">
                <input type="range" min={0.1} max={0.8} step={0.05} value={scene} onChange={(e) => setScene(Number(e.target.value))} className="w-full" aria-label="장면 전환 민감도" />
              </Field>
              <Field label={`최대 ${Math.min(40, count)}장`}>
                <input type="range" min={1} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full" aria-label="최대 장 수" />
              </Field>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="이미지 형식">
              <select value={fmt} onChange={(e) => setFmt(e.target.value as "jpg" | "png")} className={selectClass} aria-label="이미지 형식">
                <option value="jpg">JPG — 용량 작음 (썸네일용)</option>
                <option value="png">PNG — 무손실 (자막·글자 선명)</option>
              </select>
            </Field>
            <Field label="가로 폭 (px)">
              <input
                type="number"
                min={100}
                max={3840}
                step={20}
                value={width}
                onChange={(e) => setWidth(Math.max(100, Number(e.target.value) || 1280))}
                className={inputClass}
                aria-label="가로 폭"
              />
            </Field>
          </div>

          <RunButton onClick={run} busy={job.busy}>
            썸네일 추출
          </RunButton>
          <EngineNotice />
          <Notice>
            유튜브 썸네일은 1280×720 이상, 2MB 이하 JPG/PNG 를 권장합니다. 추출한 이미지를 그대로 올려도 되고,
            글자를 얹어 쓰셔도 됩니다.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      {job.files.length > 1 && (
        <DownloadButton files={job.files} zipName={`${file ? baseName(file.name) : "thumbnails"}.zip`} label="전체 ZIP 으로 저장" />
      )}
      <ResultFiles files={job.files} />
    </div>
  );
}
