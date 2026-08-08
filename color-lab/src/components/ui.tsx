"use client";

import { useCallback, useEffect, useState } from "react";

// ── 클립보드 복사 버튼 ──────────────────────────────────────
export function CopyChip({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(value).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    });
  }, [value]);
  return (
    <button
      type="button"
      className="btn"
      onClick={copy}
      title={`${value} 복사`}
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      <span style={{ color: "var(--text-dim)", fontFamily: "inherit" }}>
        {label}
      </span>
      <span>{value}</span>
      <span aria-hidden>{done ? "✓" : "⧉"}</span>
    </button>
  );
}

// ── URL 쿼리 상태 (?key=value) ─────────────────────────────
// 정적 export 환경에서 서버 없이 공유 가능한 상태를 만들기 위해
// 마운트 시 읽고, 변경 시 history.replaceState 로만 기록한다.
export function useQueryState(
  key: string,
  initial: string
): [string, (v: string) => void, boolean] {
  const [value, setValue] = useState(initial);
  const [fromUrl, setFromUrl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get(key);
    if (p !== null && p !== "") {
      setValue(p);
      setFromUrl(true);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (v: string) => {
      setValue(v);
      const url = new URL(window.location.href);
      if (v === initial) url.searchParams.delete(key);
      else url.searchParams.set(key, v);
      window.history.replaceState(null, "", url.toString());
    },
    [key, initial]
  );

  return [ready ? value : initial, set, fromUrl];
}

// ── 팔레트 PNG 다운로드 ─────────────────────────────────────
export function downloadPalettePng(
  hexes: string[],
  filename: string,
  labels?: string[]
) {
  const sw = 180;
  const sh = 200;
  const pad = 0;
  const canvas = document.createElement("canvas");
  canvas.width = hexes.length * sw + pad * 2;
  canvas.height = sh + 44;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  hexes.forEach((hex, i) => {
    ctx.fillStyle = hex;
    ctx.fillRect(pad + i * sw, 0, sw, sh);
    ctx.fillStyle = "#333333";
    ctx.font = "16px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      labels?.[i] ?? hex,
      pad + i * sw + sw / 2,
      sh + 27
    );
  });
  const a = document.createElement("a");
  a.download = `${filename}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

// ── 스와치 (인라인) ────────────────────────────────────────
export function Swatch({
  hex,
  label,
  height = 64,
  textColor,
}: {
  hex: string;
  label?: string;
  height?: number;
  textColor?: string;
}) {
  return (
    <div
      style={{
        background: hex,
        height,
        borderRadius: 10,
        display: "flex",
        alignItems: "flex-end",
        padding: 8,
        color: textColor ?? "#00000099",
        fontSize: 12,
        fontFamily: "ui-monospace, monospace",
        border: "1px solid rgba(0,0,0,.08)",
      }}
    >
      {label ?? hex}
    </div>
  );
}
