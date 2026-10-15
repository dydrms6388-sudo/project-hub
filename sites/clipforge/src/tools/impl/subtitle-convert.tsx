"use client";

import { useCallback, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import DownloadButton, { saveBlob } from "@/components/DownloadButton";
import FileDrop from "@/components/FileDrop";
import { Field, inputClass, selectClass } from "@/components/MediaJob";
import {
  decodeSubtitleBytes,
  detectFormat,
  formatTimestamp,
  mergeCues,
  mimeFor,
  normalizeCues,
  parseSubtitle,
  scaleCues,
  serializeSubtitle,
  shiftCues,
  smiClasses,
  totalDuration,
  type Cue,
  type SubFormat,
} from "@/lib/subtitle";
import { baseName } from "@/lib/media";
import { Notice, SUB_EXT } from "./_shared";

type Loaded = {
  name: string;
  encoding: string;
  replacements: number;
  format: SubFormat;
  text: string;
  langs: string[];
  lang: string;
};

const FPS_PAIRS = [
  { label: "변환 안 함", v: 1 },
  { label: "25fps → 23.976fps (자막이 점점 빨라질 때)", v: 25 / 23.976 },
  { label: "23.976fps → 25fps (자막이 점점 느려질 때)", v: 23.976 / 25 },
  { label: "30fps → 29.97fps", v: 30 / 29.97 },
  { label: "29.97fps → 30fps", v: 29.97 / 30 },
];

export default function SubtitleConvert() {
  const [items, setItems] = useState<Loaded[]>([]);
  const [outFmt, setOutFmt] = useState<SubFormat>("srt");
  const [shiftMs, setShiftMs] = useState(0);
  const [fpsIdx, setFpsIdx] = useState(0);
  const [mergeMode, setMergeMode] = useState<"each" | "concat" | "overlay">("each");
  const [gapSec, setGapSec] = useState(0);
  const [bom, setBom] = useState(false);
  const [minDur, setMinDur] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback(async (list: File[]) => {
    setError(null);
    try {
      const loaded: Loaded[] = [];
      for (const f of list) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const d = decodeSubtitleBytes(bytes);
        const format = detectFormat(d.text, f.name);
        const langs = format === "smi" ? smiClasses(d.text) : [];
        loaded.push({
          name: f.name,
          encoding: d.encoding,
          replacements: d.replacements,
          format,
          text: d.text,
          langs,
          lang: langs.includes("KRCC") ? "KRCC" : (langs[0] ?? ""),
        });
      }
      setItems(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자막 파일을 읽지 못했습니다.");
    }
  }, []);

  function setLang(i: number, lang: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, lang } : it)));
  }

  const parsed: { name: string; cues: Cue[] }[] = useMemo(() => {
    const fps = FPS_PAIRS[fpsIdx].v;
    return items.map((it) => {
      let cues = parseSubtitle(it.text, it.format, { lang: it.lang || undefined });
      if (fps !== 1) cues = scaleCues(cues, fps);
      if (shiftMs !== 0) cues = shiftCues(cues, shiftMs);
      cues = normalizeCues(cues, { minDurationMs: minDur });
      return { name: it.name, cues };
    });
  }, [items, shiftMs, fpsIdx, minDur]);

  const outputs: { name: string; text: string }[] = useMemo(() => {
    if (parsed.length === 0) return [];
    if (parsed.length === 1 || mergeMode === "each") {
      return parsed.map((p) => ({
        name: `${baseName(p.name)}.${outFmt}`,
        text: serializeSubtitle(p.cues, outFmt, { title: baseName(p.name) }),
      }));
    }
    const merged = mergeCues(
      parsed.map((p) => p.cues),
      mergeMode === "concat" ? "concat" : "overlay",
      gapSec * 1000,
    );
    return [
      {
        name: `${baseName(parsed[0].name)}_합본.${outFmt}`,
        text: serializeSubtitle(merged, outFmt, { title: `${baseName(parsed[0].name)} 합본` }),
      },
    ];
  }, [parsed, outFmt, mergeMode, gapSec]);

  const preview = outputs[0]?.text ?? "";
  const previewCues = parsed.length === 1 ? parsed[0].cues : mergeMode === "each" ? (parsed[0]?.cues ?? []) : [];

  function download() {
    if (outputs.length === 0) return;
    if (outputs.length === 1) {
      saveBlob(makeBlob(outputs[0].text), outputs[0].name);
      return;
    }
  }

  function makeBlob(text: string): Blob {
    const body = bom ? `﻿${text}` : text;
    return new Blob([body], { type: mimeFor(outFmt) });
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={SUB_EXT}
        multiple
        maxSizeMB={10}
        onFiles={(l) => void onFiles(l)}
        hint="srt, vtt, smi · 여러 개 올리면 합칠 수 있습니다 · 이 도구는 변환 엔진(32MB)을 받지 않습니다"
      />

      <Notice>
        이 도구는 <b>ffmpeg 를 쓰지 않습니다.</b> 자막은 그냥 텍스트라 브라우저 자바스크립트만으로 즉시
        변환됩니다. 파일을 올리는 순간 결과가 나옵니다.
      </Notice>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      {items.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="space-y-1 p-3">
              <p className="truncate font-medium text-slate-800">{it.name}</p>
              <p className="text-xs text-slate-600">
                형식 <b>{it.format.toUpperCase()}</b> · 인코딩 <b>{it.encoding}</b> · 자막{" "}
                <b>{parsed[i]?.cues.length ?? 0}</b>개 · 길이 {formatTimestamp(totalDuration(parsed[i]?.cues ?? []))}
              </p>
              {it.encoding.startsWith("euc-kr") && (
                <p className="text-xs text-emerald-700">
                  ✓ EUC-KR(CP949) 로 저장된 자막을 감지해 한글을 복구했습니다. 저장하면 UTF-8 로 바뀝니다.
                </p>
              )}
              {it.replacements > 0 && (
                <p className="text-xs text-amber-700">
                  ⚠ 복구하지 못한 글자가 {it.replacements}개 있습니다. 원본 파일이 손상됐을 수 있습니다.
                </p>
              )}
              {it.langs.length > 1 && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  언어 선택
                  <select
                    value={it.lang}
                    onChange={(e) => setLang(i, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    aria-label={`${it.name} 언어 클래스`}
                  >
                    {it.langs.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <Field label="변환할 형식">
            <select value={outFmt} onChange={(e) => setOutFmt(e.target.value as SubFormat)} className={selectClass} aria-label="변환할 형식">
              <option value="srt">SRT — 가장 널리 쓰임 (곰플레이어·PotPlayer·유튜브 업로드)</option>
              <option value="vtt">VTT — 웹 &lt;track&gt; 표준, HTML5 플레이어용</option>
              <option value="smi">SMI — 옛 한국 플레이어·일부 TV 에서 필요</option>
            </select>
          </Field>

          <Field label="싱크 조정 (ms)" hint="+ 는 자막을 늦게, − 는 빠르게. 1초 = 1000ms">
            <div className="flex flex-wrap items-center gap-2">
              {[-2000, -1000, -500, -100].map((v) => (
                <button key={v} type="button" onClick={() => setShiftMs((s) => s + v)} aria-label={`${v}ms 이동`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  {v}
                </button>
              ))}
              <input
                type="number"
                step={100}
                value={shiftMs}
                onChange={(e) => setShiftMs(Number(e.target.value) || 0)}
                className={`${inputClass} max-w-32`}
                aria-label="싱크 조정 밀리초"
              />
              {[100, 500, 1000, 2000].map((v) => (
                <button key={v} type="button" onClick={() => setShiftMs((s) => s + v)} aria-label={`+${v}ms 이동`} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  +{v}
                </button>
              ))}
            </div>
          </Field>

          <Field label="프레임레이트 보정" hint="처음엔 맞는데 뒤로 갈수록 어긋나면 프레임레이트가 다른 영상용 자막입니다.">
            <select value={fpsIdx} onChange={(e) => setFpsIdx(Number(e.target.value))} className={selectClass} aria-label="프레임레이트 보정">
              {FPS_PAIRS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          {items.length > 1 && (
            <>
              <Field label="여러 파일 처리">
                <select value={mergeMode} onChange={(e) => setMergeMode(e.target.value as typeof mergeMode)} className={selectClass} aria-label="여러 파일 처리 방식">
                  <option value="each">각각 따로 변환 (ZIP 으로 저장)</option>
                  <option value="concat">이어 붙이기 — CD1/CD2 처럼 나뉜 자막을 한 개로</option>
                  <option value="overlay">시간축 그대로 합치기 — 누락분 보충·다국어 합치기</option>
                </select>
              </Field>
              {mergeMode === "concat" && (
                <Field label="파일 사이 간격 (초)">
                  <input
                    type="number"
                    step={1}
                    min={0}
                    value={gapSec}
                    onChange={(e) => setGapSec(Math.max(0, Number(e.target.value) || 0))}
                    className={inputClass}
                    aria-label="파일 사이 간격 초"
                  />
                </Field>
              )}
            </>
          )}

          <Field label="최소 노출 시간 (ms)" hint="너무 짧게 스쳐가는 자막을 늘려 줍니다. 0 이면 원본 그대로.">
            <input
              type="number"
              step={100}
              min={0}
              value={minDur}
              onChange={(e) => setMinDur(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
              aria-label="최소 노출 시간"
            />
          </Field>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} className="mt-1" />
            <span>
              UTF-8 BOM 붙이기 — 일부 구형 플레이어·스마트TV 는 BOM 이 있어야 한글을 UTF-8 로 인식합니다.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            {outputs.length === 1 ? (
              <button
                type="button"
                onClick={download}
                aria-label="변환한 자막 저장"
                className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
              >
                {outputs[0].name} 저장
              </button>
            ) : (
              <DownloadButton
                files={() => outputs.map((o) => ({ name: o.name, blob: makeBlob(o.text) }))}
                zipName="subtitles.zip"
                label={`${outputs.length}개 파일 ZIP 으로 저장`}
              />
            )}
            <CopyButton value={() => preview} label="변환 결과 복사" />
          </div>
        </div>
      )}

      {previewCues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800">미리보기 (앞 12개)</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th scope="col" className="px-2 py-1.5">시작</th>
                  <th scope="col" className="px-2 py-1.5">끝</th>
                  <th scope="col" className="px-2 py-1.5">자막</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {previewCues.slice(0, 12).map((c, i) => (
                  <tr key={`${c.start}-${i}`}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-500">{formatTimestamp(c.start)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-500">{formatTimestamp(c.end)}</td>
                    <td className="px-2 py-1.5 text-slate-800">{c.text.replace(/\n/g, " / ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview && (
        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">변환 결과 원문 보기</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs text-slate-700">
            {preview.slice(0, 8000)}
            {preview.length > 8000 ? "\n… (생략)" : ""}
          </pre>
        </details>
      )}
    </div>
  );
}
