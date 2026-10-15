"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
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
import { cuesToAss, defaultAssStyle, type AssStyle, type SubPosition } from "@/lib/ass";
import { mountInputs, readOutput } from "@/lib/ffmpeg/fs";
import { baseName, captureFrame } from "@/lib/media";
import {
  decodeSubtitleBytes,
  detectFormat,
  parseSubtitle,
  shiftCues,
  smiClasses,
  type Cue,
} from "@/lib/subtitle";
import { withBase } from "@/site.config";
import { MediaMeta, Notice, SourcePicker, SUB_EXT, VIDEO_EXT, exec, useSourceFile } from "./_shared";

const FONT_PATH = "/fonts/Pretendard-Bold.ttf";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
여기에 자막을 붙여 넣으세요

2
00:00:04,500 --> 00:00:08,000
SRT · VTT · SMI 파일을 올려도 됩니다`;

export default function BurnSubtitle() {
  const { file, info, probeError, onFiles } = useSourceFile(VIDEO_EXT);
  const [subMode, setSubMode] = useState<"file" | "text">("file");
  const [subText, setSubText] = useState("");
  const [subName, setSubName] = useState("");
  const [encoding, setEncoding] = useState<string | null>(null);
  const [langs, setLangs] = useState<string[]>([]);
  const [lang, setLang] = useState<string>("");
  const [shiftMs, setShiftMs] = useState(0);
  const [style, setStyle] = useState<AssStyle>(defaultAssStyle);
  const [parseError, setParseError] = useState<string | null>(null);
  const job = useMediaJob();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const raw = subMode === "text" ? subText : subText;

  const cues: Cue[] = useMemo(() => {
    if (!raw.trim()) return [];
    try {
      const fmt = detectFormat(raw, subName);
      const parsed = parseSubtitle(raw, fmt, { lang: lang || undefined });
      return shiftMs ? shiftCues(parsed, shiftMs) : parsed;
    } catch {
      return [];
    }
  }, [raw, subName, lang, shiftMs]);

  // 영상 해상도에 맞춰 기본 글자 크기/여백을 잡는다
  useEffect(() => {
    if (!info?.hasVideo) return;
    setStyle((s) => ({
      ...s,
      fontSize: Math.max(20, Math.round(info.height * 0.045)),
      marginV: Math.max(20, Math.round(info.height * 0.06)),
      marginH: Math.max(16, Math.round(info.width * 0.05)),
    }));
  }, [info?.hasVideo, info?.width, info?.height]);

  const onSubFiles = useCallback(async (list: File[]) => {
    const f = list[0];
    if (!f) return;
    setParseError(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const decoded = decodeSubtitleBytes(bytes);
      setEncoding(decoded.encoding + (decoded.replacements > 0 ? ` · 깨진 글자 ${decoded.replacements}개` : ""));
      setSubName(f.name);
      setSubText(decoded.text);
      const classes = detectFormat(decoded.text, f.name) === "smi" ? smiClasses(decoded.text) : [];
      setLangs(classes);
      setLang(classes.includes("KRCC") ? "KRCC" : (classes[0] ?? ""));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "자막 파일을 읽지 못했습니다.");
    }
  }, []);

  // 미리보기 — 실제 렌더러(libass)와 완전히 같지는 않지만 위치·크기 감을 잡는 용도
  useEffect(() => {
    if (!file) return;
    let alive = true;
    captureFrame(file, Math.min(1.5, (info?.duration ?? 3) / 2), 480)
      .then((frame) => {
        if (!alive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(frame, 0, 0);
        const srcH = info?.height || frame.height;
        const k = frame.height / srcH;
        const fs = style.fontSize * k;
        const text = cues[0]?.text ?? "자막 미리보기";
        ctx.font = `${style.bold ? "bold " : ""}${fs}px Pretendard, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, style.outline * k * 2);
        ctx.strokeStyle = style.outlineColor;
        ctx.fillStyle = style.primaryColor;
        const lines = text.split("\n");
        const lineH = fs * 1.2;
        let baseY: number;
        if (style.position === "top") baseY = style.marginV * k + fs;
        else if (style.position === "middle") baseY = frame.height / 2 - ((lines.length - 1) * lineH) / 2;
        else baseY = frame.height - style.marginV * k - (lines.length - 1) * lineH;
        lines.forEach((line, i) => {
          const y = baseY + i * lineH;
          if (style.boxed) {
            const w = ctx.measureText(line).width;
            ctx.save();
            ctx.globalAlpha = style.boxOpacity;
            ctx.fillStyle = style.outlineColor;
            ctx.fillRect(frame.width / 2 - w / 2 - 8, y - fs * 0.85, w + 16, fs * 1.15);
            ctx.restore();
            ctx.fillStyle = style.primaryColor;
            ctx.fillText(line, frame.width / 2, y);
          } else {
            if (style.outline > 0) ctx.strokeText(line, frame.width / 2, y);
            ctx.fillText(line, frame.width / 2, y);
          }
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [file, info?.duration, info?.height, cues, style]);

  function start() {
    if (!file || cues.length === 0) return;
    const w = info?.width || 1080;
    const h = info?.height || 1920;
    const ass = cuesToAss(cues, style, w, h);

    void job.run(async (ctx) => {
      ctx.stage("자막 폰트 준비 중", 0, 3);
      const fontRes = await fetch(withBase(FONT_PATH));
      if (!fontRes.ok) throw new Error("자막용 한글 폰트를 불러오지 못했습니다.");
      const fontBytes = new Uint8Array(await fontRes.arrayBuffer());
      try {
        await ctx.ff.createDir("/fonts");
      } catch {
        /* 이미 있음 */
      }
      await ctx.ff.writeFile("/fonts/Pretendard-Bold.ttf", fontBytes);
      await ctx.ff.writeFile("sub.ass", new TextEncoder().encode(ass));

      const { paths, cleanup } = await mountInputs(ctx.ff, [file]);
      try {
        ctx.stage("자막을 영상에 굽는 중", 3, 100);
        const out = "subbed.mp4";
        const vf = "subtitles=sub.ass:fontsdir=/fonts";
        const base = ["-i", paths[0], "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
        try {
          await exec(ctx.ff, [...base, "-c:a", "copy", out]);
        } catch {
          // 원본 오디오를 mp4 로 그대로 담을 수 없는 경우(예: opus in webm) AAC 로 재인코딩
          await exec(ctx.ff, [...base, "-c:a", "aac", "-b:a", "160k", out]);
        }
        const blob = await readOutput(ctx.ff, out, "video/mp4");
        return [{ name: `${baseName(file.name)}_자막.mp4`, blob }];
      } finally {
        await cleanup();
      }
    });
  }

  return (
    <div className="space-y-4">
      <SourcePicker extensions={VIDEO_EXT} onFiles={onFiles} />
      <MediaMeta file={file} info={info} error={probeError} />

      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["file", "자막 파일 올리기 (SRT · VTT · SMI)"],
              ["text", "자막 직접 입력"],
            ] as ["file" | "text", string][]
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="sub-mode" checked={subMode === v} onChange={() => setSubMode(v)} />
              {label}
            </label>
          ))}
        </div>

        {subMode === "file" ? (
          <>
            <FileDrop
              extensions={SUB_EXT}
              multiple={false}
              maxSizeMB={10}
              onFiles={(l) => void onSubFiles(l)}
              hint="srt, vtt, smi · EUC-KR 로 저장된 옛날 자막도 자동 복구합니다"
            />
            {encoding && (
              <p className="text-xs text-slate-600">
                인코딩 감지: <b>{encoding}</b> · 자막 {cues.length}개
                {langs.length > 1 ? " · 여러 언어 포함" : ""}
              </p>
            )}
            {langs.length > 1 && (
              <Field label="SMI 언어 선택">
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass} aria-label="SMI 언어 클래스">
                  {langs.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        ) : (
          <textarea
            value={subText}
            onChange={(e) => {
              setSubText(e.target.value);
              setSubName("input.srt");
            }}
            placeholder={SAMPLE}
            aria-label="자막 직접 입력"
            className="h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
          />
        )}
        {parseError && <p className="text-xs text-red-600">{parseError}</p>}
        {raw.trim() && cues.length === 0 && (
          <p className="text-xs text-red-600">
            자막을 인식하지 못했습니다. SRT/VTT/SMI 형식이 맞는지 확인해 주세요.
          </p>
        )}
      </div>

      {file && cues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label={`글자 크기 ${style.fontSize}px (영상 세로 ${info?.height ?? "?"}px 기준)`}>
              <input
                type="range"
                min={12}
                max={Math.max(40, Math.round((info?.height ?? 1080) * 0.15))}
                value={style.fontSize}
                onChange={(e) => setStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))}
                className="w-full"
                aria-label="글자 크기"
              />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Field label="글자 색">
                <input
                  type="color"
                  value={style.primaryColor}
                  onChange={(e) => setStyle((s) => ({ ...s, primaryColor: e.target.value }))}
                  className="h-9 w-16 rounded border border-slate-300"
                  aria-label="글자 색"
                />
              </Field>
              <Field label="외곽선 색">
                <input
                  type="color"
                  value={style.outlineColor}
                  onChange={(e) => setStyle((s) => ({ ...s, outlineColor: e.target.value }))}
                  className="h-9 w-16 rounded border border-slate-300"
                  aria-label="외곽선 색"
                />
              </Field>
            </div>
            <Field label={`외곽선 두께 ${style.outline}`}>
              <input
                type="range"
                min={0}
                max={8}
                value={style.outline}
                onChange={(e) => setStyle((s) => ({ ...s, outline: Number(e.target.value) }))}
                className="w-full"
                aria-label="외곽선 두께"
              />
            </Field>
            <Field label="위치">
              <select
                value={style.position}
                onChange={(e) => setStyle((s) => ({ ...s, position: e.target.value as SubPosition }))}
                className={selectClass}
                aria-label="자막 위치"
              >
                <option value="bottom">아래</option>
                <option value="middle">가운데</option>
                <option value="top">위</option>
              </select>
            </Field>
            <Field label={`가장자리 여백 ${style.marginV}px`}>
              <input
                type="range"
                min={0}
                max={Math.max(60, Math.round((info?.height ?? 1080) * 0.3))}
                value={style.marginV}
                onChange={(e) => setStyle((s) => ({ ...s, marginV: Number(e.target.value) }))}
                className="w-full"
                aria-label="세로 여백"
              />
            </Field>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={style.bold}
                  onChange={(e) => setStyle((s) => ({ ...s, bold: e.target.checked }))}
                />
                굵게
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={style.boxed}
                  onChange={(e) => setStyle((s) => ({ ...s, boxed: e.target.checked }))}
                />
                배경 박스
              </label>
            </div>
            <Field label="싱크 조정 (ms · +면 자막이 늦게)">
              <input
                type="number"
                step={100}
                value={shiftMs}
                onChange={(e) => setShiftMs(Number(e.target.value) || 0)}
                className={inputClass}
                aria-label="싱크 조정 밀리초"
              />
            </Field>
          </div>

          <div>
            <canvas ref={canvasRef} className="w-full rounded-lg border border-slate-300 bg-slate-900" aria-label="자막 미리보기" />
            <p className="mt-1 text-xs text-slate-500">
              미리보기는 근사치입니다. 실제 렌더링은 libass 가 담당합니다.
            </p>
          </div>
        </div>
      )}

      {file && cues.length > 0 && (
        <>
          <RunButton onClick={start} busy={job.busy}>
            자막 굽기
          </RunButton>
          <EngineNotice />
          <Notice>
            자막이 화면에 그려져 들어가므로(하드섭) 인스타그램·틱톡처럼 자막 파일을 못 올리는 곳에서도 그대로
            보입니다. 한글 폰트는 사이트에 포함된 Pretendard(SIL OFL) 를 씁니다.
          </Notice>
        </>
      )}

      <JobBar job={job} />
      <ResultFiles files={job.files} />
    </div>
  );
}
