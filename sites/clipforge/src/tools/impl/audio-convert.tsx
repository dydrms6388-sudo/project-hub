"use client";

import { useState } from "react";
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
import { baseName } from "@/lib/media";
import { AUDIO_EXT, MEDIA_EXT, MediaMeta, Notice, SourcePicker, exec, useSourceFile } from "./_shared";

type Fmt = "mp3" | "m4a" | "wav" | "ogg";

const FMT_INFO: Record<Fmt, { label: string; codec: string; note: string }> = {
  mp3: { label: "MP3", codec: "libmp3lame", note: "1993년 규격. 호환성 1위, 같은 용량이면 음질은 가장 뒤." },
  m4a: { label: "M4A (AAC)", codec: "aac", note: "아이폰·유튜브 기본. MP3 보다 같은 비트레이트에서 음질이 좋음." },
  wav: { label: "WAV", codec: "pcm_s16le", note: "무압축 PCM. 편집·자막 작업용. 1분에 약 10MB." },
  ogg: { label: "OGG (Vorbis)", codec: "libvorbis", note: "오픈 포맷. 게임·웹에서 많이 쓰지만 애플 기기 호환성이 낮음." },
};

export function buildAudioArgs(fmt: Fmt, kbps: number, rate: number, mono: boolean, gainDb: number, norm: boolean) {
  const args: string[] = ["-vn"];
  const filters: string[] = [];
  if (norm) filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  if (gainDb !== 0) filters.push(`volume=${gainDb}dB`);
  if (filters.length) args.push("-af", filters.join(","));
  if (fmt === "mp3") args.push("-c:a", "libmp3lame", "-b:a", `${kbps}k`);
  else if (fmt === "m4a") args.push("-c:a", "aac", "-b:a", `${kbps}k`);
  else if (fmt === "ogg") args.push("-c:a", "libvorbis", "-b:a", `${kbps}k`);
  else args.push("-c:a", "pcm_s16le");
  if (rate) args.push("-ar", String(rate));
  args.push("-ac", mono ? "1" : "2");
  return args;
}

export default function AudioConvert() {
  const { file, info, probeError, onFiles } = useSourceFile([...AUDIO_EXT, ...MEDIA_EXT]);
  const [fmt, setFmt] = useState<Fmt>("mp3");
  const [kbps, setKbps] = useState(192);
  const [rate, setRate] = useState(44100);
  const [mono, setMono] = useState(false);
  const [gainDb, setGainDb] = useState(0);
  const [norm, setNorm] = useState(false);
  const job = useMediaJob();

  function run() {
    if (!file) return;
    const args = buildAudioArgs(fmt, kbps, rate, mono, gainDb, norm);
    void job.run(async (ctx) => {
      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage("오디오 변환 중", 0, 100);
        const out = `converted.${fmt}`;
        await exec(ctx.ff, ["-i", paths[0], ...args, out]);
        const blob = await readOutput(ctx.ff, out, mimeOf(fmt));
        return [{ name: `${baseName(file.name)}.${fmt}`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={[...AUDIO_EXT, ...MEDIA_EXT]} onFiles={onFiles} hint="mp3, m4a, wav, flac, ogg, opus, 영상 파일도 가능 · 최대 500MB" />
      <MediaMeta file={file} info={info} error={probeError} />

      {file && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label="변환할 형식" hint={FMT_INFO[fmt].note}>
            <select value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)} className={selectClass} aria-label="변환할 형식">
              {(Object.keys(FMT_INFO) as Fmt[]).map((k) => (
                <option key={k} value={k}>
                  {FMT_INFO[k].label} — {FMT_INFO[k].codec}
                </option>
              ))}
            </select>
          </Field>

          {fmt !== "wav" && (
            <Field label="비트레이트">
              <select value={kbps} onChange={(e) => setKbps(Number(e.target.value))} className={selectClass} aria-label="비트레이트">
                {[64, 96, 128, 160, 192, 256, 320].map((v) => (
                  <option key={v} value={v}>
                    {v} kbps{v === 192 ? " (권장)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="샘플레이트">
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className={selectClass} aria-label="샘플레이트">
              <option value={0}>원본 유지</option>
              <option value={48000}>48,000Hz (영상 표준)</option>
              <option value={44100}>44,100Hz (CD·음악 표준)</option>
              <option value={22050}>22,050Hz (용량 절약)</option>
              <option value={16000}>16,000Hz (음성 인식·받아쓰기용)</option>
            </select>
          </Field>

          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} />
              모노로 합치기 (용량 절반)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={norm} onChange={(e) => setNorm(e.target.checked)} />
              음량 표준화 (EBU R128, −16 LUFS)
            </label>
          </div>

          <Field label={`음량 조정 ${gainDb > 0 ? "+" : ""}${gainDb}dB`}>
            <input
              type="range"
              min={-20}
              max={20}
              value={gainDb}
              onChange={(e) => setGainDb(Number(e.target.value))}
              className="w-full"
              aria-label="음량 조정"
            />
          </Field>

          <RunButton onClick={run} busy={job.busy}>
            오디오 변환
          </RunButton>
          <EngineNotice />
          <Notice tone="warn">
            손실 압축(MP3·AAC·OGG)에서 다른 손실 압축으로 바꾸면 음질이 한 번 더 깎입니다. 원본이 WAV·FLAC 이면
            원본에서 바로 변환하세요.
          </Notice>
        </div>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
