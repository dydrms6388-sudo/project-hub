"use client";

import { useCallback, useId, useRef, useState } from "react";

export type FileDropProps = {
  accept?: string;
  /** 확장자 화이트리스트 (소문자, 점 없이) */
  extensions?: string[];
  multiple?: boolean;
  /** 파일 1개 최대 용량 (MB) */
  maxSizeMB?: number;
  onFiles: (files: File[]) => void;
  hint?: string;
};

export default function FileDrop({
  accept,
  extensions,
  multiple = true,
  maxSizeMB = 500,
  onFiles,
  hint,
}: FileDropProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const accept_ = accept;

  const validate = useCallback(
    (list: File[]) => {
      const ok: File[] = [];
      const errs: string[] = [];
      for (const f of list) {
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
        if (extensions && !extensions.includes(ext)) {
          errs.push(`${f.name} — 지원하지 않는 형식입니다 (${extensions.join(", ")}만 가능)`);
          continue;
        }
        if (f.size > maxSizeMB * 1024 * 1024) {
          errs.push(`${f.name} — 용량이 너무 큽니다 (최대 ${maxSizeMB}MB)`);
          continue;
        }
        ok.push(f);
      }
      setErrors(errs);
      return ok;
    },
    [extensions, maxSizeMB],
  );

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const ok = validate([...list]);
      if (ok.length === 0) return;
      const next = multiple ? [...files, ...ok] : ok.slice(0, 1);
      setFiles(next);
      onFiles(next);
    },
    [files, multiple, onFiles, validate],
  );

  function removeAt(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    onFiles(next);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="파일 선택 또는 드래그앤드롭"
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
          over ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <p className="text-base font-semibold text-slate-800">
          파일을 여기로 끌어다 놓거나 클릭해서 선택
        </p>
        {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept_}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-xs text-slate-500">
        🔒 파일은 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.
      </p>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 p-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{f.name}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {(f.size / 1024 / 1024).toFixed(2)}MB
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`${f.name} 제거`}
                className="shrink-0 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
