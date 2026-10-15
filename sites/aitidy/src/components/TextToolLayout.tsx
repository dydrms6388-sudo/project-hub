"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CopyButton from "./CopyButton";
import { saveBlob } from "./DownloadButton";

/**
 * 입력을 이 브라우저(localStorage)에만 "마지막 1건" 임시 저장하는 훅.
 * - 서버로 전송되지 않는다.
 * - clear() 로 즉시 삭제할 수 있다.
 */
export function useLocalDraft(
  key: string,
  value: string,
  setValue: (v: string) => void,
) {
  const storageKey = `aitidy:draft:${key}`;
  const [restored, setRestored] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setValue(saved);
        setHasSaved(true);
      }
    } catch {
      /* 사생활 보호 모드 등 — 무시 */
    }
    setRestored(true);
    // storageKey 는 도구별 고정값이다.
  }, [storageKey, setValue]);

  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      try {
        if (value) {
          localStorage.setItem(storageKey, value);
          setHasSaved(true);
        } else {
          localStorage.removeItem(storageKey);
          setHasSaved(false);
        }
      } catch {
        /* 용량 초과 등 — 무시 */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, restored, storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* 무시 */
    }
    setHasSaved(false);
    setValue("");
  }, [storageKey, setValue]);

  return { hasSaved, clear };
}

export function DraftNotice({ hasSaved, onClear }: { hasSaved: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
      <span>
        🔒 입력한 내용은 서버로 전송되지 않습니다. 새로고침해도 이어서 쓸 수 있도록{" "}
        <b>마지막 1건만 이 브라우저(localStorage)</b>에 임시 저장됩니다.
        {hasSaved ? " (현재 저장된 내용 있음)" : ""}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="임시 저장된 입력 삭제"
        className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
      >
        저장 내용 삭제
      </button>
    </div>
  );
}

export function OptionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">{children}</div>;
}

export function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-400 accent-blue-600"
      />
      <span>{label}</span>
    </label>
  );
}

export function Radio<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {options.map((o) => (
        <label key={o.value} className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 border-slate-400 accent-blue-600"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </span>
  );
}

/**
 * 도구 공통 레이아웃.
 * 데스크톱: 좌 입력 / 우 결과. 모바일(<1024px): 세로 스택.
 * 상단 툴바에 "복사" / "다운로드".
 */
export default function TextToolLayout({
  storageKey,
  value,
  onChange,
  placeholder,
  inputLabel = "입력 (붙여넣으면 바로 처리됩니다)",
  outputLabel = "결과",
  options,
  belowOptions,
  inputPane,
  output,
  outputText,
  downloadName = "result.txt",
  downloadMime = "text/plain;charset=utf-8",
  extraActions,
  canDownload = true,
}: {
  storageKey: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputLabel?: string;
  outputLabel?: string;
  options?: React.ReactNode;
  belowOptions?: React.ReactNode;
  /** 기본 textarea 대신 직접 입력 UI 를 넣고 싶을 때 */
  inputPane?: React.ReactNode;
  output: React.ReactNode;
  outputText: string;
  downloadName?: string;
  downloadMime?: string;
  extraActions?: React.ReactNode;
  canDownload?: boolean;
}) {
  const { hasSaved, clear } = useLocalDraft(storageKey, value, onChange);
  const taId = `${storageKey}-input`;
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function download() {
    const blob = new Blob([outputText], { type: downloadMime });
    saveBlob(blob, downloadName);
  }

  return (
    <div className="space-y-4">
      {options ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">{options}</div>
      ) : null}
      {belowOptions}

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={() => outputText} label="복사" />
        <button
          type="button"
          onClick={download}
          disabled={!canDownload || !outputText}
          aria-label="결과 다운로드"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다운로드
        </button>
        {extraActions}
        <button
          type="button"
          onClick={() => {
            onChange("");
            areaRef.current?.focus();
          }}
          aria-label="입력 비우기"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          입력 비우기
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          {inputPane ?? (
            <>
              <label htmlFor={taId} className="block text-sm font-medium text-slate-700">
                {inputLabel}
              </label>
              <textarea
                id={taId}
                ref={areaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                placeholder={placeholder}
                className="h-72 w-full resize-y rounded-xl border border-slate-300 p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-500 sm:h-96"
              />
            </>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <span className="block text-sm font-medium text-slate-700">{outputLabel}</span>
          <div className="min-h-72 overflow-x-auto rounded-xl border border-slate-300 bg-slate-50 p-3 sm:min-h-96">
            {output}
          </div>
        </div>
      </div>

      <DraftNotice hasSaved={hasSaved} onClear={clear} />
    </div>
  );
}

export function OutputText({ text, mono = true }: { text: string; mono?: boolean }) {
  if (!text) {
    return <p className="text-sm text-slate-400">왼쪽에 텍스트를 붙여넣으면 결과가 바로 표시됩니다.</p>;
  }
  return (
    <pre
      className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800 ${
        mono ? "font-mono" : ""
      }`}
    >
      {text}
    </pre>
  );
}
