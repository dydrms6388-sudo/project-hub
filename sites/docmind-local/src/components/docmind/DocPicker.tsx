"use client";

import { useCallback, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { parseFile, SCANNED_HINT, SUPPORTED_EXTENSIONS, type ParsedDoc } from "@/lib/docmind/parse";

export type DocPickerProps = {
  multiple?: boolean;
  /** 최대 문서 수 */
  max?: number;
  onChange: (docs: ParsedDoc[]) => void;
  hint?: string;
};

export default function DocPicker({ multiple = false, max = 1, onChange, hint }: DocPickerProps) {
  const [docs, setDocs] = useState<ParsedDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const cache = useRef(new Map<string, ParsedDoc>());

  const handle = useCallback(
    async (files: File[]) => {
      setErr(null);
      setBusy(true);
      try {
        const picked = files.slice(0, max);
        const out: ParsedDoc[] = [];
        for (const f of picked) {
          const key = `${f.name}:${f.size}:${f.lastModified}`;
          const hit = cache.current.get(key);
          if (hit) {
            out.push(hit);
            continue;
          }
          setPct(0);
          const doc = await parseFile(f, (done, total) => setPct((done / total) * 100));
          cache.current.set(key, doc);
          out.push(doc);
        }
        setDocs(out);
        onChange(out);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(`문서를 읽지 못했습니다: ${msg}`);
        setDocs([]);
        onChange([]);
      } finally {
        setBusy(false);
        setPct(0);
      }
    },
    [max, onChange],
  );

  return (
    <section className="space-y-3" aria-label="문서 선택">
      <FileDrop
        multiple={multiple}
        maxSizeMB={60}
        extensions={SUPPORTED_EXTENSIONS}
        accept=".pdf,.docx,.txt,.md,.markdown"
        hint={hint ?? `PDF · DOCX · TXT · MD (최대 60MB${multiple ? `, ${max}개까지` : ""})`}
        onFiles={(files) => void handle(files)}
      />

      {busy ? <Progress value={pct} label="문서에서 텍스트 추출 중" /> : null}

      {err ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}

      {docs.map((d) => (
        <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">{d.name}</p>
          {d.empty ? (
            <p className="mt-1 leading-relaxed text-amber-800" role="alert">
              ⚠️ {SCANNED_HINT}
            </p>
          ) : (
            <p className="mt-1 text-slate-600">
              {d.kind === "pdf" ? `${d.pageCount}쪽` : `${d.pageCount}개 구간`} ·{" "}
              {d.chars.toLocaleString()}자 · 청크 {d.chunks.length}개
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
