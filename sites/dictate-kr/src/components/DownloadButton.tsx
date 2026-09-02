"use client";

import { useState } from "react";

export type DownloadFile = { name: string; blob: Blob };

/** Blob 하나를 즉시 저장 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 여러 개면 JSZip 으로 묶어서 저장 (jszip 은 이 시점에 동적 로드) */
export async function saveFiles(files: DownloadFile[], zipName = "download.zip") {
  if (files.length === 0) return;
  if (files.length === 1) {
    saveBlob(files[0].blob, files[0].name);
    return;
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const out = await zip.generateAsync({ type: "blob" });
  saveBlob(out, zipName);
}

export default function DownloadButton({
  files,
  zipName = "download.zip",
  label = "다운로드",
  disabled = false,
  className = "",
}: {
  files: DownloadFile[] | (() => DownloadFile[] | Promise<DownloadFile[]>);
  zipName?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const list = typeof files === "function" ? await files() : files;
      await saveFiles(list, zipName);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || busy}
      aria-label={label}
      className={`rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {busy ? "준비 중…" : label}
    </button>
  );
}
