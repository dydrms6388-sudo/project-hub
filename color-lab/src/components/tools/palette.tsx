"use client";

import { useMemo } from "react";
import {
  bestTextOn,
  HARMONIES,
  harmonyColors,
  hexToRgb,
  lightnessScale,
} from "@/lib/color";
import { CopyChip, downloadPalettePng, Swatch, useQueryState } from "@/components/ui";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
      {label}
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={`${label} 색 선택`}
      />
      <input
        type="text"
        value={value}
        size={9}
        style={{ fontFamily: "ui-monospace, monospace" }}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} HEX 입력`}
      />
    </label>
  );
}

// ── 3. 배색 팔레트 생성기 ──────────────────────────────────
export function PaletteGenerator() {
  const [c, setC] = useQueryState("c", "#E34234");
  const valid = !!hexToRgb(c);

  return (
    <div className="card">
      <ColorField label="기준색" value={c} onChange={setC} />
      {valid ? (
        HARMONIES.map((h) => {
          const cols = harmonyColors(c.toUpperCase(), h.degrees);
          return (
            <div key={h.name} style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 6px" }}>
                {h.name}{" "}
                <span className="muted" style={{ fontWeight: 400, fontFamily: "ui-monospace, monospace" }}>
                  ({h.degrees.map((d) => `${d >= 0 ? "+" : ""}${d}°`).join(", ")})
                </span>
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
                  gap: 6,
                }}
              >
                {cols.map((col, i) => (
                  <Swatch
                    key={i}
                    hex={col}
                    height={58}
                    textColor={bestTextOn(hexToRgb(col)!) + "cc"}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <CopyChip label="HEX 목록" value={cols.join(", ")} />
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    downloadPalettePng(cols, `palette-${h.degrees.length}`)
                  }
                >
                  PNG 다운로드
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <p className="muted">유효한 HEX 값(#RRGGBB)을 입력하세요.</p>
      )}
    </div>
  );
}

// ── 4. 명도 단계 생성기 ────────────────────────────────────
export function ShadeGenerator() {
  const [c, setC] = useQueryState("c", "#008080");
  const [nStr, setN] = useQueryState("n", "11");
  const n = Math.max(5, Math.min(13, Number(nStr) || 11));
  const valid = !!hexToRgb(c);
  const scale = useMemo(
    () => (valid ? lightnessScale(c.toUpperCase(), n) : []),
    [c, n, valid]
  );
  const cssVars = scale
    .map((s, i) => `  --shade-${(i + 1) * 100}: ${s.toLowerCase()};`)
    .join("\n");

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <ColorField label="기준색" value={c} onChange={setC} />
        <label style={{ fontSize: "0.9rem" }}>
          단계 수{" "}
          <select value={String(n)} onChange={(e) => setN(e.target.value)}>
            {[5, 7, 9, 11, 13].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {valid && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${n}, 1fr)`,
              gap: 4,
              marginTop: 14,
            }}
          >
            {scale.map((s, i) => (
              <div
                key={i}
                title={s}
                style={{
                  background: s,
                  height: 56,
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,.08)",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <CopyChip label="HEX 목록" value={scale.join(", ")} />
            <CopyChip label="CSS 변수" value={`:root {\n${cssVars}\n}`} />
            <button
              type="button"
              className="btn"
              onClick={() => downloadPalettePng(scale, "shades")}
            >
              PNG 다운로드
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            OKLCH의 밝기(L) 축을 균등 보간해 만든 스케일입니다. HSL의 L과 달리
            지각 밝기에 가깝게 정렬되어, 디자인 시스템의 단계 팔레트(100~900)에
            바로 쓸 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}

// ── 7. 그라디언트 생성기 ───────────────────────────────────
export function GradientGenerator() {
  const [type, setType] = useQueryState("type", "linear");
  const [aStr, setAngle] = useQueryState("deg", "135");
  const [c1, setC1] = useQueryState("c1", "#4F46E5");
  const [c2, setC2] = useQueryState("c2", "#40E0D0");
  const angle = ((Number(aStr) % 360) + 360) % 360;

  const css = useMemo(() => {
    if (type === "radial") return `radial-gradient(circle, ${c1}, ${c2})`;
    if (type === "conic") return `conic-gradient(from ${angle}deg, ${c1}, ${c2}, ${c1})`;
    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  }, [type, angle, c1, c2]);

  const valid = hexToRgb(c1) && hexToRgb(c2);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: "0.9rem" }}>
          형태{" "}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="linear">linear (선형)</option>
            <option value="radial">radial (원형)</option>
            <option value="conic">conic (원뿔형)</option>
          </select>
        </label>
        <ColorField label="색 1" value={c1} onChange={setC1} />
        <ColorField label="색 2" value={c2} onChange={setC2} />
      </div>
      {type !== "radial" && (
        <label style={{ display: "block", marginTop: 10, fontSize: "0.9rem" }}>
          각도 {angle}°
          <input
            type="range"
            min={0}
            max={359}
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
          />
        </label>
      )}
      {valid && (
        <>
          <div
            style={{
              marginTop: 12,
              height: 150,
              borderRadius: 12,
              background: css,
              border: "1px solid var(--line)",
            }}
          />
          <div style={{ marginTop: 10 }}>
            <CopyChip label="CSS" value={`background: ${css};`} />
          </div>
        </>
      )}
    </div>
  );
}
