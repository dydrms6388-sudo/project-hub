"use client";

import { useCallback, useMemo, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import { baseName, fileBytes, formatBytes, openPdfLib, pdfBlob } from "@/lib/pdf";
import { usePageThumbs } from "@/tools/thumbs";
import { Btn, ErrorBox, Notice, ResultBox } from "@/tools/ui";

export default function Rotate() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [angles, setAngles] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const { thumbs, total, progress, loading, error: thumbError } = usePageThumbs(bytes);

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0] ?? null;
    setFile(f);
    setResult(null);
    setError("");
    setAngles({});
    setBytes(f ? await fileBytes(f) : null);
  }, []);

  const changed = useMemo(
    () => Object.values(angles).filter((v) => v % 360 !== 0).length,
    [angles],
  );

  function turn(i: number, delta: number) {
    setResult(null);
    setAngles((prev) => ({ ...prev, [i]: (((prev[i] ?? 0) + delta) % 360 + 360) % 360 }));
  }

  function turnAll(delta: number) {
    setResult(null);
    setAngles((prev) => {
      const next: Record<number, number> = {};
      for (let i = 0; i < total; i++) next[i] = (((prev[i] ?? 0) + delta) % 360 + 360) % 360;
      return next;
    });
  }

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { degrees } = await import("pdf-lib");
      const doc = await openPdfLib(bytes);
      doc.getPages().forEach((page, i) => {
        const add = angles[i] ?? 0;
        if (add % 360 === 0) return;
        const base = page.getRotation().angle;
        page.setRotation(degrees((((base + add) % 360) + 360) % 360));
      });
      const saved = await doc.save({ useObjectStreams: true });
      setResult(pdfBlob(saved));
    } catch (e) {
      setError((e as Error)?.message ?? "회전 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={200}
        onFiles={(f) => void onFiles(f)}
        hint="회전할 PDF 1개를 선택하세요"
      />

      {loading && <Progress value={progress} label="페이지 미리보기 만드는 중" />}
      <ErrorBox>{thumbError || error}</ErrorBox>

      {thumbs.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">전체:</span>
            <Btn variant="ghost" onClick={() => turnAll(-90)} ariaLabel="전체 왼쪽으로 90도 회전">
              ↺ 왼쪽 90°
            </Btn>
            <Btn variant="ghost" onClick={() => turnAll(90)} ariaLabel="전체 오른쪽으로 90도 회전">
              ↻ 오른쪽 90°
            </Btn>
            <Btn variant="ghost" onClick={() => turnAll(180)} ariaLabel="전체 180도 회전">
              ↕ 180°
            </Btn>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {thumbs.map((t) => {
              const a = angles[t.index] ?? 0;
              return (
                <li
                  key={t.index}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex h-32 items-center justify-center overflow-hidden bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.url}
                      alt={`${t.index + 1}쪽 미리보기`}
                      className="max-h-28 max-w-full object-contain transition-transform"
                      style={{ transform: `rotate(${a}deg)` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
                    <span className="min-w-0 truncate text-xs text-slate-500">
                      {t.index + 1}쪽{a % 360 !== 0 ? ` · ${a}°` : ""}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`${t.index + 1}쪽 왼쪽으로 90도 회전`}
                        onClick={() => turn(t.index, -90)}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                      >
                        ↺
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.index + 1}쪽 오른쪽으로 90도 회전`}
                        onClick={() => turn(t.index, 90)}
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                      >
                        ↻
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={run} disabled={busy || changed === 0}>
              {busy ? "저장 중…" : "회전 적용해서 저장"}
            </Btn>
            <span className="text-xs text-slate-500">{changed}쪽 회전 예정</span>
          </div>
        </>
      )}

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <Btn onClick={() => saveBlob(result, `${baseName(file?.name ?? "rotated")}_회전.pdf`)}>
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice>
        PDF 의 회전은 픽셀을 돌리는 것이 아니라 페이지 사전(dictionary)의 <code>/Rotate</code> 값을
        90의 배수로 바꾸는 것입니다. 그래서 재인코딩이 없고 화질 손실도 파일 크기 증가도 없습니다.
      </Notice>
    </div>
  );
}
