"use client";
import { useCallback, useRef, useState, type DragEvent } from "react";

type Props = {
  accept?: string;               // 예: "image/*,.heic"
  multiple?: boolean;
  maxSizeMB?: number;
  onFiles: (files: File[]) => void;
  hint?: string;
};

export function FileDrop({ accept, multiple = true, maxSizeMB = 500, onFiles, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback((list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (tooBig) {
      setError(`${tooBig.name}: ${maxSizeMB}MB를 넘습니다. 더 작은 파일을 선택하세요.`);
      return;
    }
    setError(null);
    onFiles(multiple ? files : files.slice(0, 1));
  }, [maxSizeMB, multiple, onFiles]);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setOver(false); handle(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="파일 선택 또는 끌어다 놓기"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
          over ? "border-ink bg-paper" : "border-line hover:border-muted"
        }`}
      >
        <p className="text-[15px] font-medium text-ink">파일을 여기에 놓거나 눌러서 선택</p>
        <p className="mt-1 text-sm text-muted">{hint ?? (accept ? `지원: ${accept}` : "모든 파일")} · 최대 {maxSizeMB}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          // 같은 파일을 다시 고를 때도 change 가 발화하도록 value 를 비운다.
          onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        파일은 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
