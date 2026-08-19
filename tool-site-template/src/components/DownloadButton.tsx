"use client";
import { useState } from "react";

type Item = { name: string; blob: Blob };

/** 파일 1개면 바로 다운로드, 여러 개면 zip으로 묶는다. */
export function DownloadButton({ items, zipName = "download.zip", label }: { items: Item[]; zipName?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  if (!items.length) return null;

  async function run() {
    setBusy(true);
    try {
      if (items.length === 1) {
        save(items[0].blob, items[0].name);
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        items.forEach((it) => zip.file(it.name, it.blob));
        save(await zip.generateAsync({ type: "blob" }), zipName);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="rounded-md bg-ink px-4 py-2 text-[15px] font-medium text-white disabled:opacity-60"
    >
      {busy ? "준비 중…" : label ?? (items.length === 1 ? "다운로드" : `${items.length}개 zip으로 다운로드`)}
    </button>
  );
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
