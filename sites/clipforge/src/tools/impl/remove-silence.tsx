"use client";

import { useState } from "react";
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
import { mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, toClock } from "@/lib/media";
import { MEDIA_EXT, MediaMeta, Notice, SourcePicker, exec, h264Args, useSourceFile } from "./_shared";

export type Range = { start: number; end: number };

/** silencedetect 로그에서 무음 구간을 뽑는다 */
export function parseSilenceLog(lines: string[]): Range[] {
  const out: Range[] = [];
  let open: number | null = null;
  for (const line of lines) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) {
      open = Math.max(0, Number(s[1]));
      continue;
    }
    const e = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (e && open !== null) {
      const end = Number(e[1]);
      if (end > open) out.push({ start: open, end });
      open = null;
    }
  }
  return out;
}

/** 무음 구간 → 남길 구간. pad 만큼 앞뒤를 남겨 말이 잘리지 않게 한다 */
export function keepRanges(silences: Range[], duration: number, pad: number, minKeep: number): Range[] {
  const keep: Range[] = [];
  let cursor = 0;
  for (const s of silences) {
    const cut = { start: s.start + pad, end: s.end - pad };
    if (cut.end <= cut.start) continue; // 패딩을 빼면 남는 게 없는 짧은 무음 → 그냥 둔다
    if (cut.start > cursor) keep.push({ start: cursor, end: cut.start });
    cursor = cut.end;
  }
  if (duration > cursor) keep.push({ start: cursor, end: duration });
  // 너무 짧은 조각은 버린다(깜빡임 방지)
  const filtered = keep.filter((k) => k.end - k.start >= minKeep);
  // 이어지는 구간 합치기
  const merged: Range[] = [];
  for (const k of filtered) {
    const prev = merged[merged.length - 1];
    if (prev && k.start - prev.end < 0.05) prev.end = k.end;
    else merged.push({ ...k });
  }
  return merged;
}

export function selectExpr(ranges: Range[]): string {
  return ranges.map((r) => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`).join("+");
}

export default function RemoveSilence() {
  const { file, info, probeError, onFiles } = useSourceFile(MEDIA_EXT);
  const [noise, setNoise] = useState(-30);
  const [minSilence, setMinSilence] = useState(0.6);
  const [pad, setPad] = useState(0.15);
  const [silences, setSilences] = useState<Range[] | null>(null);
  const job = useMediaJob();

  const duration = info?.duration ?? 0;
  const keeps = silences ? keepRanges(silences, duration, pad, 0.2) : null;
  const keptTime = keeps ? keeps.reduce((s, k) => s + (k.end - k.start), 0) : 0;

  function analyze() {
    if (!file) return;
    setSilences(null);
    void job.run(async (ctx) => {
      const lines: string[] = [];
      const off = ctx.collectLogs((l) => lines.push(l));
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage("무음 구간을 찾는 중 (오디오만 읽습니다)", 0, 100);
        await exec(ctx.ff, [
          "-i", paths[0],
          "-vn",
          "-af", `silencedetect=noise=${noise}dB:d=${minSilence}`,
          "-f", "null", "-",
        ]);
        setSilences(parseSilenceLog(lines));
        return [];
      } finally {
        off();
        await cleanup();
      }
    });
  }

  function cut() {
    if (!file || !keeps || keeps.length === 0) return;
    const expr = selectExpr(keeps);
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage(`${keeps.length}개 구간을 이어 붙이는 중`, 0, 100);
        const out = "cut.mp4";
        const hasVideo = info?.hasVideo ?? true;
        const args = hasVideo
          ? [
              "-i", paths[0],
              "-vf", `select='${expr}',setpts=N/FRAME_RATE/TB`,
              "-af", `aselect='${expr}',asetpts=N/SR/TB`,
              ...h264Args({ crf: 22 }),
              out,
            ]
          : [
              "-i", paths[0],
              "-af", `aselect='${expr}',asetpts=N/SR/TB`,
              "-c:a", "aac", "-b:a", "160k",
              "cut.m4a",
            ];
        await exec(ctx.ff, args);
        const name = hasVideo ? out : "cut.m4a";
        const blob = await readOutput(ctx.ff, name, hasVideo ? "video/mp4" : "audio/mp4");
        return [{ name: `${baseName(file.name)}_무음제거.${hasVideo ? "mp4" : "m4a"}`, blob }];
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
          <Field label={`무음 기준 ${noise}dB`} hint="0dB 가 최대 음량입니다. −30dB 이하가 일반적인 '조용함'. 잡음이 많으면 −20dB 쪽으로 올리세요.">
            <input
              type="range"
              min={-60}
              max={-10}
              value={noise}
              onChange={(e) => setNoise(Number(e.target.value))}
              className="w-full"
              aria-label="무음 기준 dB"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="최소 무음 길이 (초)" hint="이보다 짧은 정적은 자르지 않습니다.">
              <select value={minSilence} onChange={(e) => setMinSilence(Number(e.target.value))} className={selectClass} aria-label="최소 무음 길이">
                {[0.3, 0.5, 0.6, 1, 1.5, 2].map((v) => (
                  <option key={v} value={v}>
                    {v}초
                  </option>
                ))}
              </select>
            </Field>
            <Field label="여유 (초)" hint="무음 구간 앞뒤로 이만큼 남겨 말꼬리가 잘리지 않게 합니다.">
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={pad}
                onChange={(e) => setPad(Math.max(0, Number(e.target.value) || 0))}
                className={inputClass}
                aria-label="여유 초"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={analyze} busy={job.busy}>
              1단계 · 무음 구간 분석
            </RunButton>
            {keeps && keeps.length > 0 && (
              <RunButton onClick={cut} busy={job.busy}>
                2단계 · 무음 잘라내고 내보내기
              </RunButton>
            )}
          </div>

          {silences && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                무음 <b>{silences.length}</b>개 발견 · 남길 구간 <b>{keeps?.length ?? 0}</b>개
                <br />
                {toClock(duration)} → <b>{toClock(keptTime)}</b> (약 {duration > 0 ? Math.round((1 - keptTime / duration) * 100) : 0}% 단축)
              </p>
              {silences.length === 0 && (
                <p className="text-amber-700">
                  기준에 맞는 무음이 없습니다. 기준 dB 를 올리거나(−20dB 쪽) 최소 길이를 줄여 보세요.
                </p>
              )}
              {keeps && keeps.length > 60 && (
                <p className="text-amber-700">
                  구간이 {keeps.length}개로 많습니다. 최소 무음 길이를 늘리면 더 자연스럽고 빠르게 처리됩니다.
                </p>
              )}
              {silences.length > 0 && (
                <ul className="max-h-40 overflow-auto text-xs">
                  {silences.slice(0, 50).map((s, i) => (
                    <li key={`${s.start}-${i}`}>
                      무음 {i + 1}: {toClock(s.start)} ~ {toClock(s.end)} ({(s.end - s.start).toFixed(1)}초)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <EngineNotice />
          <Notice tone="warn">
            잘라낸 지점마다 화면·소리가 순간적으로 튑니다. 말하는 영상(브이로그·강의)에는 잘 맞지만 음악이
            들어간 영상에는 적합하지 않습니다. 결과는 반드시 미리 들어 보고 쓰세요.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
