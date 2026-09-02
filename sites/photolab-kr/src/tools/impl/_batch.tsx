"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import { convertBatch, type ConvertResult } from "@/lib/convert-batch";
import {
  extFor,
  replaceExt,
  uniqueName,
  type EncodeOpts,
  type OutFormat,
  type ResizeOp,
} from "@/lib/image-core";
import {
  Check,
  ManyFilesWarning,
  Notice,
  PrivacyNote,
  Radios,
  ResultTable,
  RunButton,
  Select,
  Slider,
  NumberField,
  type ResultRow,
} from "./_ui";

const FORMAT_LABEL: Record<OutFormat, string> = {
  "image/jpeg": "JPG (사진에 적합, 용량 작음)",
  "image/png": "PNG (무손실, 투명 지원, 용량 큼)",
  "image/webp": "WEBP (같은 화질에 용량 최소)",
};

export type BatchConfig = {
  /** FileDrop 확장자 화이트리스트 */
  extensions: string[];
  accept: string;
  hint: string;
  /** 고를 수 있는 출력 포맷 */
  formats: OutFormat[];
  defaultFormat: OutFormat;
  /** none: 리사이즈 없음 / simple: 긴 변 제한만 / full: 전체 옵션 */
  resizeMode: "none" | "simple" | "full";
  /** 투명 배경 채우기 색 선택 UI */
  showBackground?: boolean;
  defaultQuality?: number;
  zipName: string;
  notice?: ReactNode;
  runLabel?: string;
  /** 처음 선택되어 있을 크기 조절 방식 */
  defaultResize?: "none" | "maxSide" | "scale" | "fixed";
};

type ResizeKind = "none" | "maxSide" | "scale" | "fixed";

export default function BatchConvert(cfg: BatchConfig) {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<OutFormat>(cfg.defaultFormat);
  const [quality, setQuality] = useState(cfg.defaultQuality ?? 85);
  const [resizeKind, setResizeKind] = useState<ResizeKind>(cfg.defaultResize ?? "none");
  const [maxSide, setMaxSide] = useState(1920);
  const [percent, setPercent] = useState(50);
  const [fixedW, setFixedW] = useState(1080);
  const [fixedH, setFixedH] = useState(1080);
  const [fit, setFit] = useState<"contain" | "cover" | "stretch">("contain");
  const [bg, setBg] = useState("#ffffff");
  const [keepTransparent, setKeepTransparent] = useState(true);

  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [results, setResults] = useState<ConvertResult[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setResults(null);
    setFatal(null);
  }, []);

  const resize: ResizeOp = useMemo(() => {
    if (cfg.resizeMode === "none" || resizeKind === "none") return { kind: "none" };
    if (resizeKind === "maxSide") return { kind: "maxSide", value: Math.max(1, maxSide) };
    if (resizeKind === "scale") return { kind: "scale", percent: Math.max(1, percent) };
    return { kind: "fixed", width: Math.max(1, fixedW), height: Math.max(1, fixedH), fit };
  }, [cfg.resizeMode, resizeKind, maxSide, percent, fixedW, fixedH, fit]);

  const outputs: DownloadFile[] = useMemo(() => {
    if (!results) return [];
    const taken = new Set<string>();
    const ext = extFor(format);
    const list: DownloadFile[] = [];
    for (const r of results) {
      if (!r.blob) continue;
      list.push({ name: uniqueName(taken, replaceExt(r.name, ext)), blob: r.blob });
    }
    return list;
  }, [results, format]);

  const rows: ResultRow[] = useMemo(() => {
    if (!results) return [];
    const taken = new Set<string>();
    const ext = extFor(format);
    return results.map((r) => ({
      name: r.name,
      outName: r.blob ? uniqueName(taken, replaceExt(r.name, ext)) : r.name,
      before: r.inputSize,
      after: r.blob?.size,
      error: r.error,
    }));
  }, [results, format]);

  async function run() {
    if (files.length === 0) return;
    setBusy(true);
    setFatal(null);
    setResults(null);
    setPct(0);
    try {
      const opts: EncodeOpts = {
        resize,
        format,
        quality: Math.min(1, Math.max(0.05, quality / 100)),
        background:
          cfg.showBackground && keepTransparent && format !== "image/jpeg" ? "transparent" : bg,
      };
      const out = await convertBatch(files, opts, (p, l) => {
        setPct(p);
        if (l) setLabel(l);
      });
      setResults(out);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setLabel("");
    }
  }

  const okCount = results?.filter((r) => r.blob).length ?? 0;
  const failCount = results ? results.length - okCount : 0;
  const lossy = format !== "image/png";

  return (
    <div className="space-y-5">
      <FileDrop
        accept={cfg.accept}
        extensions={cfg.extensions}
        multiple
        maxSizeMB={200}
        onFiles={onFiles}
        hint={cfg.hint}
      />

      <ManyFilesWarning count={files.length} />
      {cfg.notice ? <Notice tone="info">{cfg.notice}</Notice> : null}

      <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        {cfg.formats.length > 1 ? (
          <Select
            label="출력 형식"
            value={format}
            onChange={(v) => {
              setFormat(v);
              setResults(null);
            }}
            options={cfg.formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
          />
        ) : null}

        {lossy ? (
          <Slider
            label="품질"
            value={quality}
            min={40}
            max={100}
            onChange={setQuality}
            format={(v) => `${v}`}
            hint="85 전후가 눈으로 구분이 어려우면서 용량이 크게 줄어드는 구간입니다."
          />
        ) : (
          <div className="text-sm text-slate-500">PNG 은 무손실이라 품질 설정이 없습니다.</div>
        )}

        {cfg.showBackground ? (
          <div className="min-w-0 space-y-2 sm:col-span-2">
            <div className="text-sm font-medium text-slate-700">투명 배경 처리</div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                aria-label="배경색 선택"
                disabled={keepTransparent && format !== "image/jpeg"}
                className="h-9 w-14 cursor-pointer rounded border border-slate-300 disabled:opacity-40"
              />
              <input
                type="text"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                aria-label="배경색 코드"
                disabled={keepTransparent && format !== "image/jpeg"}
                className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm disabled:opacity-40"
              />
              {format !== "image/jpeg" ? (
                <Check
                  label="투명 그대로 두기"
                  checked={keepTransparent}
                  onChange={setKeepTransparent}
                />
              ) : null}
            </div>
            {format === "image/jpeg" ? (
              <p className="text-xs text-slate-500">
                JPG 은 투명도를 저장할 수 없어 투명 부분이 위 색으로 채워집니다.
              </p>
            ) : null}
          </div>
        ) : null}

        {cfg.resizeMode !== "none" ? (
          <div className="min-w-0 space-y-3 sm:col-span-2">
            {cfg.resizeMode === "full" ? (
              <Radios
                label="크기 조절 방식"
                value={resizeKind}
                onChange={setResizeKind}
                options={[
                  { value: "none", label: "원본 크기 유지" },
                  { value: "maxSide", label: "긴 변 길이 제한", hint: "가로·세로 중 긴 쪽을 기준으로 비율을 유지하며 줄입니다." },
                  { value: "scale", label: "비율(%)로 축소" },
                  { value: "fixed", label: "가로×세로 지정" },
                ]}
              />
            ) : (
              <Check
                label="긴 변 길이 제한도 함께 적용"
                checked={resizeKind === "maxSide"}
                onChange={(v) => setResizeKind(v ? "maxSide" : "none")}
              />
            )}

            {resizeKind === "maxSide" ? (
              <NumberField
                label="긴 변 최대 길이"
                value={maxSide}
                onChange={setMaxSide}
                min={16}
                max={12000}
                suffix="px"
                hint="원본이 이 값보다 작으면 확대하지 않고 그대로 둡니다."
              />
            ) : null}
            {resizeKind === "scale" ? (
              <Slider
                label="배율"
                value={percent}
                min={5}
                max={200}
                onChange={setPercent}
                format={(v) => `${v}%`}
              />
            ) : null}
            {resizeKind === "fixed" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="가로" value={fixedW} onChange={setFixedW} min={1} suffix="px" />
                <NumberField label="세로" value={fixedH} onChange={setFixedH} min={1} suffix="px" />
                <Select
                  label="맞춤 방식"
                  value={fit}
                  onChange={setFit}
                  options={[
                    { value: "contain", label: "박스 안에 맞춤(여백 없음)" },
                    { value: "cover", label: "박스 채우고 잘라내기" },
                    { value: "stretch", label: "비율 무시하고 늘리기" },
                  ]}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RunButton onClick={run} busy={busy} disabled={files.length === 0}>
          {cfg.runLabel ?? "변환하기"}
        </RunButton>
        {files.length > 0 && !busy ? (
          <span className="text-sm text-slate-500">{files.length}개 대기 중</span>
        ) : null}
      </div>

      {busy ? <Progress value={pct} label={label || "변환 중"} /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {results ? (
        <div className="space-y-3">
          <Notice tone={failCount > 0 ? "warn" : "ok"}>
            {okCount}개 변환 완료
            {failCount > 0 ? ` · ${failCount}개 실패 (아래 표에서 사유를 확인하세요)` : ""}
          </Notice>
          <ResultTable rows={rows} />
          <button
            type="button"
            onClick={() => saveFiles(outputs, cfg.zipName)}
            disabled={outputs.length === 0}
            aria-label="변환 결과 다운로드"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300 sm:w-auto"
          >
            {outputs.length > 1 ? `ZIP 으로 ${outputs.length}개 저장` : "저장"}
          </button>
        </div>
      ) : null}

      <PrivacyNote />
    </div>
  );
}
