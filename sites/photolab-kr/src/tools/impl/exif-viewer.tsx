"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { formatBytes, yieldToUI } from "@/lib/image-core";
import { Check, ManyFilesWarning, Notice, PrivacyNote, RunButton } from "./_ui";

type Raw = Record<string, unknown>;

type Parsed = {
  file: File;
  data: Raw | null;
  error: string | null;
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const str = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
};

function fmtDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(
      v.getMinutes(),
    )}:${p(v.getSeconds())}`;
  }
  return str(v);
}

function fmtShutter(v: unknown): string | null {
  const n = num(v);
  if (n === null) return null;
  if (n >= 1) return `${n.toFixed(1)}초`;
  return `1/${Math.round(1 / n)}초`;
}

const ORIENTATION: Record<number, string> = {
  1: "정상",
  2: "좌우 반전",
  3: "180도 회전",
  4: "상하 반전",
  5: "시계 90도 + 반전",
  6: "시계 방향 90도 회전",
  7: "반시계 90도 + 반전",
  8: "반시계 방향 90도 회전",
};

const COLORSPACE: Record<number, string> = { 1: "sRGB", 2: "Adobe RGB", 65535: "Uncalibrated" };

type Row = { k: string; v: string };

function buildGroups(f: File, d: Raw | null): { title: string; rows: Row[] }[] {
  const g: { title: string; rows: Row[] }[] = [];
  const push = (title: string, rows: (Row | null)[]) => {
    const ok = rows.filter((r): r is Row => Boolean(r && r.v));
    if (ok.length) g.push({ title, rows: ok });
  };
  const row = (k: string, v: string | null | undefined): Row | null =>
    v ? { k, v } : null;

  push("파일", [
    row("파일 이름", f.name),
    row("파일 크기", formatBytes(f.size)),
    row("형식", f.type || "알 수 없음"),
    row("수정한 날짜", fmtDate(new Date(f.lastModified))),
  ]);

  if (!d) return g;

  const orientation = num(d.Orientation);
  const colorSpace = num(d.ColorSpace);

  push("촬영 일시", [
    row("촬영일(원본)", fmtDate(d.DateTimeOriginal)),
    row("디지털화 일시", fmtDate(d.CreateDate)),
    row("파일 수정 일시", fmtDate(d.ModifyDate)),
    row("시간대", str(d.OffsetTimeOriginal) ?? str(d.OffsetTime)),
  ]);

  push("기기 · 렌즈", [
    row("제조사", str(d.Make)),
    row("모델", str(d.Model)),
    row("렌즈", str(d.LensModel) ?? str(d.LensMake)),
    row("소프트웨어", str(d.Software)),
  ]);

  const fnum = num(d.FNumber);
  const focal = num(d.FocalLength);
  const focal35 = num(d.FocalLengthIn35mmFormat);
  const ev = num(d.ExposureCompensation) ?? num(d.ExposureBiasValue);
  push("노출", [
    row("ISO", str(d.ISO) ?? str(d.ISOSpeedRatings)),
    row("셔터 속도", fmtShutter(d.ExposureTime)),
    row("조리개", fnum !== null ? `f/${fnum}` : null),
    row("초점거리", focal !== null ? `${focal}mm` : null),
    row("35mm 환산 초점거리", focal35 !== null ? `${focal35}mm` : null),
    row("노출 보정", ev !== null ? `${ev > 0 ? "+" : ""}${ev} EV` : null),
    row("플래시", str(d.Flash)),
    row("측광 방식", str(d.MeteringMode)),
    row("화이트밸런스", str(d.WhiteBalance)),
  ]);

  const w = num(d.ExifImageWidth) ?? num(d.ImageWidth);
  const h = num(d.ExifImageHeight) ?? num(d.ImageHeight);
  push("이미지", [
    row("해상도", w && h ? `${w} × ${h} px (${((w * h) / 1_000_000).toFixed(1)}MP)` : null),
    row(
      "회전 정보(Orientation)",
      orientation !== null ? `${orientation} — ${ORIENTATION[orientation] ?? "알 수 없음"}` : null,
    ),
    row(
      "색공간",
      colorSpace !== null ? (COLORSPACE[colorSpace] ?? `코드 ${colorSpace}`) : str(d.ColorSpace),
    ),
    row("인쇄 해상도", num(d.XResolution) ? `${num(d.XResolution)} dpi` : null),
  ]);

  return g;
}

function summaryText(f: File, groups: { title: string; rows: Row[] }[]) {
  const lines = [`[${f.name}]`];
  for (const g of groups) {
    lines.push(`■ ${g.title}`);
    for (const r of g.rows) lines.push(`  ${r.k}: ${r.v}`);
  }
  return lines.join("\n");
}

export default function ExifViewer() {
  const [files, setFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setParsed(null);
    setIndex(0);
    setFatal(null);
  }, []);

  async function run() {
    if (files.length === 0) return;
    setBusy(true);
    setFatal(null);
    setPct(0);
    try {
      const exifr = await import("exifr");
      const out: Parsed[] = [];
      for (let i = 0; i < files.length; i++) {
        setPct((i / files.length) * 100);
        const f = files[i];
        try {
          const data = (await exifr.parse(f, {
            tiff: true,
            exif: true,
            gps: true,
            interop: true,
            translateKeys: true,
            translateValues: true,
            reviveValues: true,
            mergeOutput: true,
          })) as Raw | undefined;
          out.push({ file: f, data: data ?? null, error: null });
        } catch (e) {
          out.push({ file: f, data: null, error: e instanceof Error ? e.message : String(e) });
        }
        await yieldToUI();
      }
      setPct(100);
      setParsed(out);
      setIndex(0);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const current = parsed?.[index] ?? null;
  const groups = useMemo(
    () => (current ? buildGroups(current.file, current.data) : []),
    [current],
  );

  const lat = num(current?.data?.latitude);
  const lon = num(current?.data?.longitude);
  const alt = num(current?.data?.GPSAltitude);
  const hasGps = lat !== null && lon !== null;

  const rawEntries = useMemo(() => {
    const d = current?.data;
    if (!d) return [] as [string, string][];
    return Object.entries(d)
      .map(([k, v]) => {
        let s: string;
        if (v instanceof Date) s = fmtDate(v) ?? "";
        else if (v instanceof Uint8Array || Array.isArray(v)) s = `[${v.length}개 값]`;
        else if (v && typeof v === "object") s = JSON.stringify(v).slice(0, 120);
        else s = String(v);
        return [k, s] as [string, string];
      })
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [current]);

  return (
    <div className="space-y-5">
      <FileDrop
        accept="image/*,.heic,.heif"
        extensions={["jpg", "jpeg", "png", "webp", "heic", "heif", "hif", "tif", "tiff", "avif", "dng"]}
        multiple
        maxSizeMB={200}
        onFiles={onFiles}
        hint="JPG · HEIC · PNG · WEBP · DNG 등"
      />
      <ManyFilesWarning count={files.length} />

      <RunButton onClick={run} busy={busy} disabled={files.length === 0}>
        사진 정보 읽기
      </RunButton>

      {busy ? <Progress value={pct} label="EXIF 읽는 중" /> : null}
      {fatal ? <Notice tone="error">{fatal}</Notice> : null}

      {parsed && parsed.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {parsed.map((p, i) => (
            <button
              key={`${p.file.name}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${p.file.name} 정보 보기`}
              aria-pressed={i === index}
              className={`max-w-full truncate rounded-full border px-3 py-1.5 text-xs ${
                i === index
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.file.name}
            </button>
          ))}
        </div>
      ) : null}

      {current ? (
        <div className="space-y-4">
          {current.error ? (
            <Notice tone="error">EXIF 를 읽지 못했습니다: {current.error}</Notice>
          ) : null}
          {!current.error && !current.data ? (
            <Notice tone="warn">
              이 파일에는 EXIF 정보가 없습니다. 스크린샷, 카카오톡·인스타그램에서 내려받은 사진,
              이미 메타데이터가 제거된 사진은 촬영 정보가 남아 있지 않은 것이 정상입니다.
            </Notice>
          ) : null}

          {hasGps ? (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                📍 이 사진에는 촬영 위치(GPS)가 들어 있습니다
              </p>
              <p className="font-mono text-sm text-amber-900">
                {lat.toFixed(6)}, {lon.toFixed(6)}
                {alt !== null ? ` · 고도 ${alt.toFixed(0)}m` : ""}
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <a
                  className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
                  href={`https://www.google.com/maps?q=${lat},${lon}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  구글 지도에서 열기 ↗
                </a>
                <a
                  className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
                  href={`https://map.kakao.com/link/map/촬영위치,${lat},${lon}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  카카오맵에서 열기 ↗
                </a>
                <a
                  className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  OpenStreetMap ↗
                </a>
              </div>
              <p className="text-xs leading-relaxed text-amber-800">
                좌표는 이 페이지 안에서만 계산되며 어디에도 전송되지 않습니다. 지도 링크를 누르면 그때
                해당 지도 서비스로 좌표가 전달됩니다. 사진을 공유하기 전에 위치를 지우려면{" "}
                <Link href="/tools/exif-remove/" className="underline">
                  사진 위치정보 삭제
                </Link>{" "}
                도구를 쓰세요.
              </p>
            </div>
          ) : current.data ? (
            <Notice tone="ok">이 사진에는 GPS 좌표가 들어 있지 않습니다.</Notice>
          ) : null}

          {groups.map((g) => (
            <section key={g.title} className="overflow-hidden rounded-xl border border-slate-200">
              <h3 className="bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {g.title}
              </h3>
              <dl className="divide-y divide-slate-100">
                {g.rows.map((r) => (
                  <div key={r.k} className="flex flex-wrap gap-x-3 px-3 py-2 text-sm">
                    <dt className="w-28 shrink-0 text-slate-500 sm:w-40">{r.k}</dt>
                    <dd className="min-w-0 flex-1 break-words text-slate-800">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <CopyButton
              value={() => summaryText(current.file, groups)}
              label="정보 텍스트로 복사"
            />
            {current.data ? (
              <Check label="원본 태그 전부 보기" checked={showRaw} onChange={setShowRaw} />
            ) : null}
          </div>

          {showRaw && rawEntries.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[300px] text-left text-xs">
                <tbody className="divide-y divide-slate-100">
                  {rawEntries.map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-3 py-1.5 font-mono text-slate-500">{k}</td>
                      <td className="px-3 py-1.5 break-all text-slate-800">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      <PrivacyNote />
    </div>
  );
}
