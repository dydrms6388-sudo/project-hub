"use client";

import { useCallback, useMemo, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import { convertFile, heicToBlob } from "@/lib/image";
import {
  extFor,
  formatBytes,
  isHeicName,
  replaceExt,
  uniqueName,
  yieldToUI,
  type OutFormat,
} from "@/lib/image-core";
import {
  Check,
  ManyFilesWarning,
  Notice,
  NumberField,
  PrivacyNote,
  Radios,
  ResultTable,
  RunButton,
  Select,
  Slider,
  type ResultRow,
} from "./_ui";

type Mode = "target" | "quality";

type Item = {
  name: string;
  outName: string;
  blob: Blob | null;
  before: number;
  after: number;
  note: string;
  error: string | null;
};

export default function ImageCompress() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("target");
  const [targetKB, setTargetKB] = useState(1024);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<OutFormat>("image/jpeg");
  const [limitSize, setLimitSize] = useState(false);
  const [maxSide, setMaxSide] = useState(2048);

  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setItems(null);
    setFatal(null);
  }, []);

  async function run() {
    if (files.length === 0) return;
    setBusy(true);
    setFatal(null);
    setItems(null);
    setPct(0);
    try {
      const out: Item[] = [];
      const taken = new Set<string>();
      const ext = extFor(format);
      const compressMod = mode === "target" ? await import("browser-image-compression") : null;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setLabel(f.name);
        const base = (i / files.length) * 100;
        const span = 100 / files.length;
        setPct(base);
        const name = uniqueName(taken, replaceExt(f.name, ext));
        try {
          let blob: Blob;
          let note = "";

          if (mode === "quality") {
            blob = await convertFile(f, {
              resize: limitSize ? { kind: "maxSide", value: maxSide } : { kind: "none" },
              format,
              quality: quality / 100,
              background: "#ffffff",
            });
            note = `품질 ${quality}`;
          } else {
            // 목표 용량 모드 — 라이브러리가 품질을 이분 탐색한다
            let input: File = f;
            if (isHeicName(f.name)) {
              const jpg = await heicToBlob(f, "image/jpeg", 0.95);
              input = new File([jpg], replaceExt(f.name, "jpg"), { type: "image/jpeg" });
            }
            const imageCompression = compressMod!.default;
            const result = await imageCompression(input, {
              maxSizeMB: Math.max(0.01, targetKB / 1024),
              maxWidthOrHeight: limitSize ? maxSide : undefined,
              alwaysKeepResolution: !limitSize,
              useWebWorker: true,
              fileType: format,
              initialQuality: 0.9,
              onProgress: (p: number) => setPct(base + (Math.min(100, p) / 100) * span),
            });
            blob = result;
            note =
              result.size <= targetKB * 1024
                ? `목표 ${formatBytes(targetKB * 1024)} 이하 달성`
                : `목표까지 못 줄임 — 해상도도 함께 줄이면 더 작아집니다`;
          }

          out.push({
            name: f.name,
            outName: name,
            blob,
            before: f.size,
            after: blob.size,
            note,
            error: null,
          });
        } catch (e) {
          out.push({
            name: f.name,
            outName: name,
            blob: null,
            before: f.size,
            after: 0,
            note: "",
            error: e instanceof Error ? e.message : String(e),
          });
        }
        await yieldToUI();
      }
      setPct(100);
      setItems(out);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setLabel("");
    }
  }

  const outputs: DownloadFile[] = useMemo(
    () =>
      (items ?? [])
        .filter((it): it is Item & { blob: Blob } => Boolean(it.blob))
        .map((it) => ({ name: it.outName, blob: it.blob })),
    [items],
  );

  const rows: ResultRow[] = useMemo(
    () =>
      (items ?? []).map((it) => ({
        name: it.name,
        outName: it.outName,
        before: it.before,
        after: it.blob ? it.after : undefined,
        note: it.note,
        error: it.error,
      })),
    [items],
  );

  const totals = useMemo(() => {
    const ok = (items ?? []).filter((i) => i.blob);
    const before = ok.reduce((s, i) => s + i.before, 0);
    const after = ok.reduce((s, i) => s + i.after, 0);
    return { count: ok.length, before, after };
  }, [items]);

  return (
    <div className="space-y-5">
      <FileDrop
        accept="image/*,.heic,.heif"
        extensions={["jpg", "jpeg", "png", "webp", "heic", "heif", "hif", "bmp", "avif"]}
        multiple
        maxSizeMB={200}
        onFiles={onFiles}
        hint="JPG · PNG · WEBP · HEIC (여러 개 한 번에 가능)"
      />
      <ManyFilesWarning count={files.length} />

      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <Radios
          label="줄이는 방식"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setItems(null);
          }}
          options={[
            {
              value: "target",
              label: "목표 용량 지정",
              hint: "지정한 용량 이하로 떨어질 때까지 품질을 자동으로 낮춰 가며 여러 번 인코딩합니다.",
            },
            {
              value: "quality",
              label: "품질 직접 지정",
              hint: "품질 값을 그대로 적용합니다. 결과 용량은 사진마다 달라집니다.",
            },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {mode === "target" ? (
            <NumberField
              label="목표 용량"
              value={targetKB}
              onChange={setTargetKB}
              min={20}
              max={20480}
              step={64}
              suffix="KB"
              hint="1MB = 1024KB. 이메일 첨부는 1024KB, 카카오톡 프로필은 500KB 정도가 무난합니다."
            />
          ) : (
            <Slider
              label="품질"
              value={quality}
              min={30}
              max={95}
              onChange={setQuality}
              hint="70~85 구간이 용량 대비 화질이 가장 좋습니다."
            />
          )}
          <Select
            label="출력 형식"
            value={format}
            onChange={setFormat}
            options={[
              { value: "image/jpeg", label: "JPG (호환성 최고)" },
              { value: "image/webp", label: "WEBP (같은 화질에 더 작음)" },
            ]}
          />
        </div>

        <Check
          label="해상도도 함께 줄이기"
          checked={limitSize}
          onChange={setLimitSize}
          hint="품질만 낮춰서는 목표 용량에 도달하지 못할 때 켜세요. 용량이 훨씬 크게 줄어듭니다."
        />
        {limitSize ? (
          <NumberField
            label="긴 변 최대 길이"
            value={maxSide}
            onChange={setMaxSide}
            min={100}
            max={8000}
            suffix="px"
          />
        ) : null}
      </div>

      <RunButton onClick={run} busy={busy} disabled={files.length === 0}>
        용량 줄이기
      </RunButton>

      {busy ? <Progress value={pct} label={label || "압축 중"} /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {items ? (
        <div className="space-y-3">
          <Notice tone="ok">
            {totals.count}개 완료 — 전체 {formatBytes(totals.before)} →{" "}
            {formatBytes(totals.after)}
            {totals.before > 0
              ? ` (${Math.round((1 - totals.after / totals.before) * 100)}% 감소)`
              : ""}
          </Notice>
          <ResultTable rows={rows} />
          <button
            type="button"
            onClick={() => saveFiles(outputs, "compressed.zip")}
            disabled={outputs.length === 0}
            aria-label="압축된 사진 다운로드"
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
