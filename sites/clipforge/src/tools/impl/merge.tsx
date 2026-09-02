"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EngineNotice,
  Field,
  JobBar,
  ResultFiles,
  RunButton,
  selectClass,
  useMediaJob,
} from "@/components/MediaJob";
import { mountInputs, readOutput, writeText } from "@/lib/ffmpeg/fs";
import { baseName, formatBytes, probeMedia, toClock, type MediaInfo } from "@/lib/media";
import { Notice, SourcePicker, VIDEO_EXT, exec, h264Args } from "./_shared";

type Mode = "lossless" | "reencode";

const TARGETS = [
  { label: "첫 번째 영상 기준", w: 0, h: 0 },
  { label: "1080 × 1920 (세로 숏폼)", w: 1080, h: 1920 },
  { label: "1920 × 1080 (가로 FHD)", w: 1920, h: 1080 },
  { label: "1280 × 720 (가로 HD)", w: 1280, h: 720 },
];

/** 재인코딩 concat 필터 그래프 */
export function buildConcatFilter(n: number, w: number, h: number, fps: number, withAudio: boolean): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
        `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${i}]`,
    );
    if (withAudio) {
      parts.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
    }
  }
  const inputs = Array.from({ length: n }, (_, i) => (withAudio ? `[v${i}][a${i}]` : `[v${i}]`)).join("");
  parts.push(`${inputs}concat=n=${n}:v=1:a=${withAudio ? 1 : 0}${withAudio ? "[v][a]" : "[v]"}`);
  return parts.join(";");
}

export default function Merge() {
  const [files, setFiles] = useState<File[]>([]);
  const [infos, setInfos] = useState<(MediaInfo | null)[]>([]);
  const [mode, setMode] = useState<Mode>("reencode");
  const [targetIdx, setTargetIdx] = useState(0);
  const [fps, setFps] = useState(30);
  const [withAudio, setWithAudio] = useState(true);
  const job = useMediaJob();

  const onFiles = useCallback((list: File[]) => setFiles(list), []);

  useEffect(() => {
    let alive = true;
    Promise.all(files.map((f) => probeMedia(f).catch(() => null))).then((r) => alive && setInfos(r));
    return () => {
      alive = false;
    };
  }, [files]);

  const first = infos[0];
  const target = TARGETS[targetIdx];
  const W = target.w || first?.width || 1920;
  const H = target.h || first?.height || 1080;

  const mixed =
    infos.length > 1 &&
    infos.some((i) => i && first && (i.width !== first.width || i.height !== first.height));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  }

  function run() {
    if (files.length < 2) return;
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, files);
      try {
        const out = "merged.mp4";
        if (mode === "lossless") {
          ctx.stage("이어 붙이는 중 (재인코딩 없음)", 0, 100);
          const list = paths.map((p) => `file '${p}'`).join("\n") + "\n";
          await writeText(ctx.ff, "list.txt", list);
          await exec(ctx.ff, ["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-movflags", "+faststart", out]);
        } else {
          ctx.stage(`${files.length}개 영상을 ${W}×${H} 로 맞춰 이어 붙이는 중`, 0, 100);
          const inputs = paths.flatMap((p) => ["-i", p]);
          const runWith = async (audio: boolean) => {
            const fc = buildConcatFilter(files.length, W, H, fps, audio);
            const map = audio ? ["-map", "[v]", "-map", "[a]"] : ["-map", "[v]"];
            await exec(ctx.ff, [
              ...inputs,
              "-filter_complex", fc,
              ...map,
              ...h264Args({ crf: 22, audio: audio ? "aac" : "none" }),
              out,
            ]);
          };
          try {
            await runWith(withAudio);
          } catch {
            if (!withAudio) throw new Error("영상을 이어 붙이지 못했습니다. 파일이 손상됐는지 확인해 주세요.");
            // 오디오가 없는 파일이 섞여 있으면 concat 필터가 실패한다 → 무음으로 재시도
            await runWith(false);
          }
        }
        const blob = await readOutput(ctx.ff, out, "video/mp4");
        return [{ name: `${baseName(files[0].name)}_외${files.length - 1}개_합치기.mp4`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={VIDEO_EXT} multiple onFiles={onFiles} hint="2개 이상 · 위에서부터 순서대로 이어집니다 · 파일당 최대 500MB" />

      {files.length > 0 && (
        <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
              <span className="w-5 shrink-0 text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {infos[i] ? `${toClock(infos[i]!.duration)} · ${infos[i]!.width}×${infos[i]!.height}` : formatBytes(f.size)}
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(i, -1)} aria-label={`${f.name} 위로`} className="rounded border border-slate-300 px-2 py-0.5 text-xs">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} aria-label={`${f.name} 아래로`} className="rounded border border-slate-300 px-2 py-0.5 text-xs">
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {files.length >= 2 && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label="합치는 방식">
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="merge-mode" checked={mode === "reencode"} onChange={() => setMode("reencode")} className="mt-1" />
                <span>
                  <b>다시 인코딩해서 합치기</b> — 해상도·프레임레이트·코덱이 달라도 안전하게 합쳐집니다. 느립니다.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="merge-mode" checked={mode === "lossless"} onChange={() => setMode("lossless")} className="mt-1" />
                <span>
                  <b>무손실로 이어 붙이기</b> (concat demuxer, -c copy) — 몇 초면 끝나지만 <b>같은 코덱·해상도·
                  프레임레이트</b>일 때만 정상 동작합니다. 보통 같은 카메라로 연속 촬영해 나뉜 파일에 씁니다.
                </span>
              </label>
            </div>
          </Field>

          {mixed && mode === "lossless" && (
            <Notice tone="warn">
              선택한 파일들의 해상도가 서로 다릅니다. 무손실 합치기는 실패하거나 재생이 깨질 가능성이 큽니다 —
              “다시 인코딩해서 합치기”를 쓰세요.
            </Notice>
          )}

          {mode === "reencode" && (
            <>
              <Field label="출력 규격">
                <select value={targetIdx} onChange={(e) => setTargetIdx(Number(e.target.value))} className={selectClass} aria-label="출력 규격">
                  {TARGETS.map((t, i) => (
                    <option key={t.label} value={i}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="프레임레이트">
                <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className={selectClass} aria-label="프레임레이트">
                  {[24, 25, 30, 60].map((v) => (
                    <option key={v} value={v}>
                      {v} fps
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
                소리 포함 (소리 없는 파일이 섞이면 자동으로 무음 처리로 재시도합니다)
              </label>
              <p className="text-xs text-slate-500">최종 규격: {W} × {H} · {fps}fps</p>
            </>
          )}

          <RunButton onClick={run} busy={job.busy}>
            {files.length}개 영상 합치기
          </RunButton>
          <EngineNotice />
        </div>
      )}

      {files.length === 1 && <Notice>합칠 영상을 하나 더 올려 주세요.</Notice>}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
