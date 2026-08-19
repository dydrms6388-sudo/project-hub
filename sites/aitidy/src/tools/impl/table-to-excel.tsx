"use client";

import { useMemo, useState } from "react";
import { saveBlob } from "@/components/DownloadButton";
import TextToolLayout, { Check, OptionRow, Radio } from "@/components/TextToolLayout";
import { coerceCell, detectTables, stripInline, type Table } from "@/lib/md";

const SAMPLE = `| 분기 | 매출(억) | 성장률 |
|---|---|---|
| 1Q | 1,200 | 12.5 |
| 2Q | 1,430 | 19.2 |`;

function clean(t: Table, strip: boolean): { header: string[]; rows: string[][] } {
  const f = (s: string) => (strip ? stripInline(s) : s).trim();
  const width = Math.max(t.header.length, ...t.rows.map((r) => r.length), 1);
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => f(r[i] ?? ""));
  return { header: pad(t.header), rows: t.rows.map(pad) };
}

function toAoa(t: Table, strip: boolean, numeric: boolean): (string | number)[][] {
  const c = clean(t, strip);
  const body = c.rows.map((r) => r.map((v) => (numeric ? coerceCell(v) : v)));
  return [c.header, ...body];
}

function toCsv(aoa: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return aoa.map((r) => r.map(esc).join(",")).join("\r\n");
}

export default function TableToExcel() {
  const [src, setSrc] = useState("");
  const [strip, setStrip] = useState(true);
  const [numeric, setNumeric] = useState(true);
  const [mode, setMode] = useState<"sheets" | "single">("sheets");
  const [busy, setBusy] = useState(false);

  const tables = useMemo(() => (src.trim() ? detectTables(src) : []), [src]);
  const aoas = useMemo(() => tables.map((t) => toAoa(t, strip, numeric)), [tables, strip, numeric]);

  const csvAll = useMemo(
    () => aoas.map((a, i) => (aoas.length > 1 ? `# 표 ${i + 1}\r\n${toCsv(a)}` : toCsv(a))).join("\r\n\r\n"),
    [aoas],
  );

  async function downloadXlsx() {
    if (!aoas.length) return;
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      if (mode === "single" || aoas.length === 1) {
        const merged: (string | number)[][] = [];
        aoas.forEach((a, i) => {
          if (i > 0) merged.push([]);
          merged.push(...a);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(merged), "표");
      } else {
        aoas.forEach((a, i) => {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), `표${i + 1}`);
        });
      }
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      saveBlob(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "table.xlsx",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!csvAll) return;
    // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인다.
    saveBlob(new Blob(["﻿" + csvAll], { type: "text/csv;charset=utf-8" }), "table.csv");
  }

  return (
    <TextToolLayout
      storageKey="table-to-excel"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      inputLabel="표가 포함된 답변을 붙여넣으세요 (마크다운 표 / HTML 표 / 탭 구분)"
      outputLabel={tables.length ? `미리보기 — 표 ${tables.length}개 감지` : "미리보기"}
      downloadName="table.csv"
      downloadMime="text/csv;charset=utf-8"
      outputText={csvAll}
      extraActions={
        <>
          <button
            type="button"
            onClick={downloadXlsx}
            disabled={!aoas.length || busy}
            aria-label="엑셀 xlsx 파일로 다운로드"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "생성 중…" : "XLSX 다운로드"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!csvAll}
            aria-label="CSV 파일로 다운로드"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            CSV 다운로드
          </button>
        </>
      }
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <Check checked={numeric} onChange={setNumeric} label="숫자 셀 자동 숫자형(1,200 → 1200)" />
            <Check checked={strip} onChange={setStrip} label="셀 안 마크다운 기호 제거(**굵게** 등)" />
          </OptionRow>
          <OptionRow>
            <span className="w-full shrink-0 font-medium sm:w-24">표 여러 개</span>
            <Radio
              name="tx-mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "sheets", label: "시트 분리" },
                { value: "single", label: "한 시트에 이어붙이기" },
              ]}
            />
          </OptionRow>
        </div>
      }
      output={
        aoas.length === 0 ? (
          <p className="text-sm text-slate-400">
            표를 찾지 못했습니다. 마크다운 표(| 구분), HTML &lt;table&gt;, 탭 구분 텍스트를 인식합니다.
          </p>
        ) : (
          <div className="space-y-5">
            {aoas.map((a, i) => (
              <div key={i} className="min-w-0">
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  표 {i + 1} · {tables[i].kind === "markdown" ? "마크다운" : tables[i].kind === "html" ? "HTML" : "탭 구분"} ·{" "}
                  {a.length - 1}행 × {a[0].length}열
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-slate-100">
                        {a[0].map((h, k) => (
                          <th key={k} className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">
                            {String(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.slice(1, 51).map((r, ri) => (
                        <tr key={ri} className="odd:bg-slate-50/60">
                          {r.map((c, ci) => (
                            <td
                              key={ci}
                              className={`border-b border-slate-100 px-2 py-1 ${
                                typeof c === "number" ? "text-right tabular-nums text-blue-700" : "text-slate-700"
                              }`}
                            >
                              {String(c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {a.length > 51 ? (
                  <p className="mt-1 text-xs text-slate-500">미리보기는 50행까지만 표시됩니다(다운로드는 전체 포함).</p>
                ) : null}
              </div>
            ))}
          </div>
        )
      }
    />
  );
}
