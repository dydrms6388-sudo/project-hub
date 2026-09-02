"use client";

import { useCallback, useMemo, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import { removeGpsFromJpeg } from "@/lib/exif-gps";
import { uniqueName, yieldToUI } from "@/lib/image-core";
import { isJpeg, isPng, isWebp, stripMetadata } from "@/lib/meta-strip";
import {
  Check,
  ManyFilesWarning,
  Notice,
  PrivacyNote,
  Radios,
  ResultTable,
  RunButton,
  type ResultRow,
} from "./_ui";

type Mode = "gps" | "all";

type Item = {
  name: string;
  blob: Blob | null;
  before: number;
  after: number;
  note: string;
  error: string | null;
};

export default function ExifRemove() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("gps");
  const [keepIcc, setKeepIcc] = useState(true);
  const [suffix, setSuffix] = useState(false);
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
      const exifr = await import("exifr");
      const out: Item[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setPct((i / files.length) * 100);
        setLabel(f.name);
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          let result: Uint8Array = buf;
          const notes: string[] = [];

          if (mode === "gps" && isJpeg(buf)) {
            const r = await removeGpsFromJpeg(buf);
            if (r.handled) {
              result = r.out;
              notes.push(
                r.hadGps
                  ? `GPS 제거${r.removed.includes("XMP") ? " + XMP 제거" : ""}`
                  : "원래 GPS 없음",
              );
            } else {
              // EXIF 구조가 특이해 부분 편집이 불가능 → 안전하게 전체 제거
              const s = stripMetadata(buf, { keepIcc });
              result = s.out;
              notes.push("EXIF 구조를 부분 수정할 수 없어 전체 메타데이터를 제거했습니다");
            }
          } else {
            const s = stripMetadata(buf, { keepIcc });
            if (!s.handled) {
              out.push({
                name: f.name,
                blob: null,
                before: f.size,
                after: 0,
                note: "",
                error:
                  "JPG · PNG · WEBP 만 원본 화질 그대로 메타데이터를 지울 수 있습니다. HEIC 은 먼저 JPG 로 변환해 주세요.",
              });
              await yieldToUI();
              continue;
            }
            result = s.out;
            notes.push(s.removed.length ? `제거: ${s.removed.join(", ")}` : "제거할 메타데이터 없음");
            if (mode === "gps" && !isJpeg(buf)) {
              notes.push("이 형식은 GPS만 분리 제거가 불가능해 메타데이터 전체를 제거했습니다");
            }
          }

          const blob = new Blob([result.slice().buffer as ArrayBuffer], {
            type: isJpeg(buf)
              ? "image/jpeg"
              : isPng(buf)
                ? "image/png"
                : isWebp(buf)
                  ? "image/webp"
                  : f.type || "application/octet-stream",
          });

          // 검증: 결과물에 좌표가 남아 있는지 다시 읽어본다
          try {
            const gps = await exifr.gps(blob);
            if (gps && typeof gps.latitude === "number") {
              notes.push("⚠ 결과에서 좌표가 다시 발견되었습니다 — 전체 제거 모드를 사용하세요");
            } else {
              notes.push("검증 완료: 좌표 없음");
            }
          } catch {
            notes.push("검증 완료: 좌표 없음");
          }

          out.push({
            name: f.name,
            blob,
            before: f.size,
            after: blob.size,
            note: notes.join(" · "),
            error: null,
          });
        } catch (e) {
          out.push({
            name: f.name,
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

  const outName = useCallback(
    (name: string) => {
      if (!suffix) return name;
      const i = name.lastIndexOf(".");
      return i > 0 ? `${name.slice(0, i)}_clean${name.slice(i)}` : `${name}_clean`;
    },
    [suffix],
  );

  const outputs: DownloadFile[] = useMemo(() => {
    if (!items) return [];
    const taken = new Set<string>();
    return items
      .filter((it): it is Item & { blob: Blob } => Boolean(it.blob))
      .map((it) => ({ name: uniqueName(taken, outName(it.name)), blob: it.blob }));
  }, [items, outName]);

  const rows: ResultRow[] = useMemo(() => {
    if (!items) return [];
    return items.map((it) => ({
      name: it.name,
      outName: outName(it.name),
      before: it.before,
      after: it.blob ? it.after : undefined,
      note: it.note,
      error: it.error,
    }));
  }, [items, outName]);

  const okCount = items?.filter((i) => i.blob).length ?? 0;
  const failCount = items ? items.length - okCount : 0;

  return (
    <div className="space-y-5">
      <FileDrop
        accept="image/jpeg,image/png,image/webp"
        extensions={["jpg", "jpeg", "png", "webp"]}
        multiple
        maxSizeMB={200}
        onFiles={onFiles}
        hint="JPG · PNG · WEBP (여러 개 한 번에 가능)"
      />
      <ManyFilesWarning count={files.length} />

      <Notice tone="ok">
        이 도구는 사진을 다시 저장(재인코딩)하지 않습니다. JPEG 의 메타데이터 세그먼트(APP1 등)와 PNG
        · WEBP 의 메타데이터 청크만 잘라내기 때문에 <b>화소 데이터는 한 바이트도 바뀌지 않고</b>{" "}
        화질이 그대로 유지됩니다.
      </Notice>

      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <Radios
          label="지울 범위"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setItems(null);
          }}
          options={[
            {
              value: "gps",
              label: "위치정보(GPS)만 삭제",
              hint: "촬영일·기기·렌즈·ISO 같은 정보는 남기고 좌표와 XMP 만 제거합니다. (JPG 전용, PNG·WEBP 는 전체 제거로 처리)",
            },
            {
              value: "all",
              label: "모든 메타데이터 삭제",
              hint: "EXIF · GPS · XMP · IPTC · 주석까지 전부 제거합니다. 촬영일도 사라집니다.",
            },
          ]}
        />
        <Check
          label="컬러 프로파일(ICC)은 남기기"
          checked={keepIcc}
          onChange={(v) => {
            setKeepIcc(v);
            setItems(null);
          }}
          hint="ICC 를 지우면 색이 흐리거나 채도가 달라 보일 수 있습니다. 특별한 이유가 없다면 켜 두세요."
        />
        <Check
          label="파일 이름 뒤에 _clean 붙이기"
          checked={suffix}
          onChange={setSuffix}
          hint="원본과 구분해서 보관하고 싶을 때 사용합니다."
        />
      </div>

      <RunButton onClick={run} busy={busy} disabled={files.length === 0}>
        메타데이터 지우기
      </RunButton>

      {busy ? <Progress value={pct} label={label || "처리 중"} /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {items ? (
        <div className="space-y-3">
          <Notice tone={failCount > 0 ? "warn" : "ok"}>
            {okCount}개 처리 완료{failCount > 0 ? ` · ${failCount}개 실패` : ""}
          </Notice>
          <ResultTable rows={rows} />
          <button
            type="button"
            onClick={() => saveFiles(outputs, "metadata-removed.zip")}
            disabled={outputs.length === 0}
            aria-label="메타데이터 제거된 사진 다운로드"
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
