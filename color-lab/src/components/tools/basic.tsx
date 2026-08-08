"use client";

import { useMemo, useState } from "react";
import {
  fmtHsl,
  fmtLab,
  fmtOklch,
  fmtRgb,
  hexToRgb,
  mixOklab,
  mixSrgb,
  rgbToHex,
  bestTextOn,
  wcagGrade,
} from "@/lib/color";
import { CopyChip, useQueryState } from "@/components/ui";

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

// ── 1. 명도 대비 검사기 ────────────────────────────────────
export function ContrastChecker() {
  const [fg, setFg] = useQueryState("fg", "#FFFFFF");
  const [bg, setBg] = useQueryState("bg", "#4F46E5");
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const g = fgRgb && bgRgb ? wcagGrade(fgRgb, bgRgb) : null;

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <ColorField label="글자색" value={fg} onChange={setFg} />
        <ColorField label="배경색" value={bg} onChange={setBg} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            const t = fg;
            setFg(bg);
            setBg(t);
          }}
        >
          ⇄ 서로 바꾸기
        </button>
      </div>

      {g && bgRgb && (
        <>
          <div
            style={{
              marginTop: 14,
              background: bg,
              color: fg,
              borderRadius: 10,
              padding: "18px 16px",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: 14 }}>일반 텍스트 미리보기 (16px)</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              큰 텍스트 미리보기 (24px 굵게)
            </div>
          </div>
          <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: "12px 0 4px" }}>
            대비비 {g.ratio.toFixed(2)}:1
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>기준</th>
                  <th>요구 대비</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AA 일반 텍스트", "4.5:1", g.aaNormal],
                  ["AA 큰 텍스트(18pt/14pt굵게↑)", "3:1", g.aaLarge],
                  ["AAA 일반 텍스트", "7:1", g.aaaNormal],
                  ["AAA 큰 텍스트", "4.5:1", g.aaaLarge],
                ].map(([name, req, ok]) => (
                  <tr key={name as string}>
                    <td>{name}</td>
                    <td>{req}</td>
                    <td className={ok ? "pass" : "fail"}>
                      {ok ? "통과" : "미달"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!g && <p className="muted">유효한 HEX 값(#RRGGBB)을 입력하세요.</p>}
    </div>
  );
}

// ── 2. 색상 코드 변환기 ────────────────────────────────────
export function ColorConverter() {
  const [c, setC] = useQueryState("c", "#3EB489");
  const rgb = hexToRgb(c);
  return (
    <div className="card">
      <ColorField label="색" value={c} onChange={setC} />
      {rgb ? (
        <>
          <div
            style={{
              marginTop: 12,
              height: 72,
              borderRadius: 10,
              background: rgbToHex(rgb),
              border: "1px solid var(--line)",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <CopyChip label="HEX" value={rgbToHex(rgb)} />
            <CopyChip label="RGB" value={fmtRgb(rgb)} />
            <CopyChip label="HSL" value={fmtHsl(rgb)} />
            <CopyChip label="LAB" value={fmtLab(rgb)} />
            <CopyChip label="OKLCH" value={fmtOklch(rgb)} />
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            LAB은 D65 백색점 기준 CIE LAB, OKLCH는 CSS Color Module Level 4에
            채택된 OKLab의 원통 좌표 표기입니다.
          </p>
        </>
      ) : (
        <p className="muted">유효한 HEX 값(#RRGGBB)을 입력하세요.</p>
      )}
    </div>
  );
}

// ── 8. 색 혼합기 ───────────────────────────────────────────
export function ColorMixer() {
  const [a, setA] = useQueryState("a", "#0047AB");
  const [b, setB] = useQueryState("b", "#FFD700");
  const [tStr, setT] = useQueryState("t", "50");
  const t = Math.max(0, Math.min(100, Number(tStr) || 0)) / 100;
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);

  const rows = useMemo(() => {
    if (!ra || !rb) return null;
    return [
      { name: "sRGB 보간", hex: rgbToHex(mixSrgb(ra, rb, t)) },
      { name: "OKLab 보간", hex: rgbToHex(mixOklab(ra, rb, t)) },
    ];
  }, [ra, rb, t]);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <ColorField label="색 A" value={a} onChange={setA} />
        <ColorField label="색 B" value={b} onChange={setB} />
      </div>
      <label style={{ display: "block", marginTop: 12, fontSize: "0.9rem" }}>
        혼합 비율 — B쪽 {Math.round(t * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(t * 100)}
          onChange={(e) => setT(e.target.value)}
        />
      </label>
      {rows && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 10,
            }}
          >
            {rows.map((r) => (
              <div key={r.name}>
                <div
                  style={{
                    background: r.hex,
                    height: 84,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 8,
                    color: bestTextOn(hexToRgb(r.hex)!) + "cc",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 13,
                  }}
                >
                  {r.hex}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {r.name}
                </div>
                <CopyChip label="HEX" value={r.hex} />
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            같은 비율이라도 어느 색공간에서 보간하느냐에 따라 결과가 달라집니다.
            sRGB 보간은 중간에서 어둡고 탁해지기 쉽고, OKLab 보간은 지각적으로
            더 자연스러운 중간색을 만듭니다. CSS의{" "}
            <code>color-mix()</code>가 이 개념의 표준 구현입니다.
          </p>
        </>
      )}
    </div>
  );
}
