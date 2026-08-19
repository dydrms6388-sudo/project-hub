"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { saveBlob, saveFiles } from "@/components/DownloadButton";
import TextToolLayout, { Check, OptionRow } from "@/components/TextToolLayout";
import { extFor, parseCodeBlocks } from "@/lib/md";

const SAMPLE = `설명입니다.

\`\`\`python
def hello():
    print("hi")
\`\`\`

이어서 자바스크립트 예시입니다.

\`\`\`js
console.log("hi");
\`\`\``;

export default function CodeExtract() {
  const [src, setSrc] = useState("");
  const [filter, setFilter] = useState("__all__");
  const [numbered, setNumbered] = useState(false);
  const [withHeader, setWithHeader] = useState(false);

  const blocks = useMemo(() => (src.trim() ? parseCodeBlocks(src) : []), [src]);
  const langs = useMemo(() => {
    const set = new Map<string, number>();
    for (const b of blocks) {
      const k = b.lang || "(언어 없음)";
      set.set(k, (set.get(k) ?? 0) + 1);
    }
    return [...set.entries()];
  }, [blocks]);

  const shown = useMemo(
    () => blocks.filter((b) => filter === "__all__" || (b.lang || "(언어 없음)") === filter),
    [blocks, filter],
  );

  const allText = useMemo(
    () =>
      shown
        .map((b, i) => (withHeader ? `/* ── 코드 ${i + 1}${b.lang ? ` (${b.lang})` : ""} ── */\n${b.code}` : b.code))
        .join("\n\n"),
    [shown, withHeader],
  );

  function nameFor(b: { lang: string; index: number }, i: number) {
    const ext = extFor(b.lang);
    return ext === "Dockerfile" ? `Dockerfile-${i + 1}` : `code-${i + 1}.${ext}`;
  }

  async function saveAll() {
    if (!shown.length) return;
    await saveFiles(
      shown.map((b, i) => ({
        name: nameFor(b, i),
        blob: new Blob([b.code], { type: "text/plain;charset=utf-8" }),
      })),
      "code-blocks.zip",
    );
  }

  return (
    <TextToolLayout
      storageKey="code-extract"
      value={src}
      onChange={setSrc}
      placeholder={SAMPLE}
      inputLabel="코드블록이 포함된 답변을 붙여넣으세요"
      outputLabel={blocks.length ? `코드블록 ${blocks.length}개 (표시 ${shown.length}개)` : "코드블록"}
      downloadName="code.txt"
      outputText={allText}
      extraActions={
        <button
          type="button"
          onClick={saveAll}
          disabled={!shown.length}
          aria-label="코드블록 전체를 파일로 저장"
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          {shown.length > 1 ? "전체 ZIP 저장" : "파일로 저장"}
        </button>
      }
      options={
        <div className="space-y-2.5">
          <OptionRow>
            <span className="w-20 shrink-0 font-medium">언어 필터</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="언어 필터"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="__all__">전체 ({blocks.length})</option>
              {langs.map(([l, n]) => (
                <option key={l} value={l}>
                  {l} ({n})
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow>
            <Check checked={numbered} onChange={setNumbered} label="줄 번호 표시(복사엔 미포함)" />
            <Check checked={withHeader} onChange={setWithHeader} label="전체 복사 시 블록 구분 주석 넣기" />
          </OptionRow>
        </div>
      }
      output={
        shown.length === 0 ? (
          <p className="text-sm text-slate-400">
            ``` 로 감싼 코드블록을 찾지 못했습니다. AI 답변을 그대로 붙여넣어 보세요.
          </p>
        ) : (
          <div className="space-y-4">
            {shown.map((b, i) => (
              <div key={b.index} className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-slate-600">
                    #{i + 1} {b.lang ? `· ${b.lang}` : "· 언어 없음"} · {b.code.split("\n").length}줄
                  </span>
                  <span className="flex gap-1.5">
                    <CopyButton value={b.code} label="복사" className="!px-2 !py-0.5 !text-xs" />
                    <button
                      type="button"
                      onClick={() =>
                        saveBlob(new Blob([b.code], { type: "text/plain;charset=utf-8" }), nameFor(b, i))
                      }
                      aria-label={`코드 ${i + 1} 파일로 저장`}
                      className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      저장
                    </button>
                  </span>
                </div>
                <pre className="overflow-x-auto p-2.5 text-[12px] leading-relaxed text-slate-800">
                  <code>
                    {numbered
                      ? b.code
                          .split("\n")
                          .map((l, k) => `${String(k + 1).padStart(3, " ")} | ${l}`)
                          .join("\n")
                      : b.code}
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )
      }
    />
  );
}
