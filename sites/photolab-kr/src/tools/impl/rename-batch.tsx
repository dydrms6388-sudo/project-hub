"use client";

import { useCallback, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveFiles, type DownloadFile } from "@/components/DownloadButton";
import { extOf, uniqueName, yieldToUI } from "@/lib/image-core";
import {
  ManyFilesWarning,
  Notice,
  NumberField,
  PrivacyNote,
  RunButton,
  Select,
} from "./_ui";

type Scanned = {
  file: File;
  date: Date;
  /** 날짜 출처 */
  source: "exif" | "mtime";
  model: string;
};

const pad = (n: number, w: number) => String(n).padStart(w, "0");

const TOKENS: { t: string; d: string }[] = [
  { t: "{YYYY}", d: "연도 4자리" },
  { t: "{YY}", d: "연도 2자리" },
  { t: "{MM}", d: "월" },
  { t: "{DD}", d: "일" },
  { t: "{HH}", d: "시" },
  { t: "{mm}", d: "분" },
  { t: "{ss}", d: "초" },
  { t: "{seq}", d: "일련번호" },
  { t: "{orig}", d: "원래 파일명(확장자 제외)" },
  { t: "{model}", d: "촬영 기기명" },
];

function applyPattern(
  pattern: string,
  s: Scanned,
  seq: number,
  digits: number,
): string {
  const d = s.date;
  const stem = s.file.name.replace(/\.[^.]+$/, "");
  const map: Record<string, string> = {
    "{YYYY}": String(d.getFullYear()),
    "{YY}": pad(d.getFullYear() % 100, 2),
    "{MM}": pad(d.getMonth() + 1, 2),
    "{DD}": pad(d.getDate(), 2),
    "{HH}": pad(d.getHours(), 2),
    "{mm}": pad(d.getMinutes(), 2),
    "{ss}": pad(d.getSeconds(), 2),
    "{seq}": pad(seq, digits),
    "{orig}": stem,
    "{model}": s.model,
  };
  let out = pattern;
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  // 파일명에 쓸 수 없는 문자 제거
  out = out.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!out) out = stem;
  return out;
}

export default function RenameBatch() {
  const [files, setFiles] = useState<File[]>([]);
  const [scanned, setScanned] = useState<Scanned[] | null>(null);
  const [pattern, setPattern] = useState("{YYYY}{MM}{DD}_{seq}");
  const [digits, setDigits] = useState(3);
  const [start, setStart] = useState(1);
  const [sort, setSort] = useState<"date" | "name" | "picked">("date");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setScanned(null);
    setFatal(null);
  }, []);

  async function scan() {
    if (files.length === 0) return;
    setBusy(true);
    setFatal(null);
    setPct(0);
    try {
      const exifr = await import("exifr");
      const out: Scanned[] = [];
      for (let i = 0; i < files.length; i++) {
        setPct((i / files.length) * 100);
        const f = files[i];
        let date = new Date(f.lastModified);
        let source: Scanned["source"] = "mtime";
        let model = "";
        try {
          const d = (await exifr.parse(f, {
            pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "Model"],
          })) as Record<string, unknown> | undefined;
          const cand = d?.DateTimeOriginal ?? d?.CreateDate ?? d?.ModifyDate;
          if (cand instanceof Date && !Number.isNaN(cand.getTime())) {
            date = cand;
            source = "exif";
          }
          if (typeof d?.Model === "string") model = d.Model.trim();
        } catch {
          /* EXIF 없음 — 파일 수정일 사용 */
        }
        out.push({ file: f, date, source, model });
        await yieldToUI();
      }
      setPct(100);
      setScanned(out);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ordered = useMemo(() => {
    if (!scanned) return [];
    const arr = [...scanned];
    if (sort === "date") arr.sort((a, b) => a.date.getTime() - b.date.getTime());
    else if (sort === "name") arr.sort((a, b) => a.file.name.localeCompare(b.file.name, "ko"));
    return arr;
  }, [scanned, sort]);

  const renamed = useMemo(() => {
    const taken = new Set<string>();
    return ordered.map((s, i) => {
      const ext = extOf(s.file.name);
      const stem = applyPattern(pattern, s, start + i, Math.max(1, Math.min(6, digits)));
      const name = uniqueName(taken, ext ? `${stem}.${ext}` : stem);
      return { s, name };
    });
  }, [ordered, pattern, start, digits]);

  const outputs: DownloadFile[] = useMemo(
    () => renamed.map((r) => ({ name: r.name, blob: r.s.file })),
    [renamed],
  );

  const noExifCount = ordered.filter((s) => s.source === "mtime").length;

  return (
    <div className="space-y-5">
      <FileDrop
        accept="image/*,.heic,.heif"
        extensions={["jpg", "jpeg", "png", "webp", "heic", "heif", "hif", "gif", "bmp", "tif", "tiff", "avif", "dng", "mov", "mp4"]}
        multiple
        maxSizeMB={500}
        onFiles={onFiles}
        hint="사진(또는 동영상) 여러 개를 한 번에"
      />
      <ManyFilesWarning count={files.length} />

      <Notice tone="ok">
        이름만 바꾸는 작업이라 사진을 다시 저장하지 않습니다. 원본 파일이 그대로 ZIP 에 담기므로
        화질·메타데이터 변화가 전혀 없습니다.
      </Notice>

      <RunButton onClick={scan} busy={busy} disabled={files.length === 0}>
        촬영일 읽기
      </RunButton>
      {busy ? <Progress value={pct} label="촬영일(EXIF) 읽는 중" /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {scanned ? (
        <>
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="pattern" className="block text-sm font-medium text-slate-700">
                이름 규칙
              </label>
              <input
                id="pattern"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                aria-label="이름 규칙"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="{YYYY}{MM}{DD}_{seq}"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TOKENS.map((t) => (
                  <button
                    key={t.t}
                    type="button"
                    onClick={() => setPattern((p) => p + t.t)}
                    aria-label={`${t.t} 추가 — ${t.d}`}
                    title={t.d}
                    className="rounded-full border border-slate-300 px-2.5 py-1 font-mono text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t.t}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                확장자는 원본 그대로 자동으로 붙습니다. 이름이 겹치면 뒤에 -1, -2 가 붙습니다.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="일련번호 자릿수"
                value={digits}
                onChange={setDigits}
                min={1}
                max={6}
              />
              <NumberField label="시작 번호" value={start} onChange={setStart} min={0} />
              <Select
                label="정렬 기준"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "date", label: "촬영일 오름차순" },
                  { value: "name", label: "원래 파일명" },
                  { value: "picked", label: "선택한 순서" },
                ]}
              />
            </div>
          </div>

          {noExifCount > 0 ? (
            <Notice tone="warn">
              {noExifCount}개 파일에는 촬영일(EXIF)이 없어 <b>파일 수정 날짜</b>를 대신 사용했습니다.
              카카오톡·인스타그램을 거친 사진이나 스크린샷은 촬영일이 지워져 있는 경우가 많습니다.
            </Notice>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">새 이름</th>
                  <th className="px-3 py-2 font-medium">원본 · 촬영일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {renamed.map((r) => (
                  <tr key={r.name}>
                    <td className="max-w-[45vw] px-3 py-2 align-top">
                      <span className="block truncate font-mono text-slate-800">{r.name}</span>
                    </td>
                    <td className="max-w-[45vw] px-3 py-2 align-top text-xs text-slate-500">
                      <span className="block truncate">{r.s.file.name}</span>
                      <span className="block">
                        {r.s.date.toLocaleString("ko-KR")}
                        <span className="ml-1 text-slate-400">
                          ({r.s.source === "exif" ? "EXIF 촬영일" : "파일 수정일"})
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => saveFiles(outputs, "renamed.zip")}
              disabled={outputs.length === 0}
              aria-label="이름 변경된 파일 다운로드"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300"
            >
              {outputs.length > 1 ? `ZIP 으로 ${outputs.length}개 저장` : "저장"}
            </button>
            <CopyButton
              label="변경 목록 복사"
              value={() => renamed.map((r) => `${r.s.file.name} -> ${r.name}`).join("\n")}
            />
          </div>
        </>
      ) : null}

      <PrivacyNote />
    </div>
  );
}
