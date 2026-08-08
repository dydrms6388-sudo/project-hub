"use client";

import { useMemo, useState } from "react";
import {
  bestTextOn,
  fmtHsl,
  fmtOklch,
  fmtRgb,
  HARMONIES,
  harmonyColors,
  hexToRgb,
  hslToRgb,
  oklchToRgb,
  rgbToHex,
  rgbToOklch,
} from "@/lib/color";
import { Swatch, useQueryState } from "@/components/ui";

const WHEEL_BG =
  "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)";

// ── 색상환 데모: 색상각 슬라이더 ────────────────────────────
export function WheelDemo() {
  const [hStr, setH] = useQueryState("h", "160");
  const h = ((Number(hStr) % 360) + 360) % 360;
  const hex = rgbToHex(hslToRgb({ h, s: 80, l: 55 }));

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: WHEEL_BG,
            position: "relative",
            flexShrink: 0,
          }}
          aria-hidden
        >
          {/* HSL 색상환은 0°=빨강이 3시 방향이 아닌 위쪽부터 돌도록 -90° 보정 */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: hex,
              border: "3px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
              transform: `rotate(${h - 90}deg) translate(56px) `,
              transformOrigin: "0 0",
              marginLeft: -7,
              marginTop: -7,
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: "block", fontSize: "0.9rem" }}>
            색상각(Hue) {h}°
            <input
              type="range"
              min={0}
              max={359}
              value={h}
              onChange={(e) => setH(e.target.value)}
            />
          </label>
          <Swatch hex={hex} height={64} textColor={bestTextOn(hexToRgb(hex)!) + "cc"} />
          <p className="muted" style={{ marginTop: 6 }}>
            0° 빨강 → 60° 노랑 → 120° 초록 → 180° 시안 → 240° 파랑 → 300°
            마젠타로 한 바퀴 도는 HSL/RGB 색상환입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 배색 조화 데모: 관계 토글 ──────────────────────────────
export function HarmonyDemo() {
  const [c, setC] = useQueryState("c", "#D96C2C");
  const [idxStr, setIdx] = useQueryState("m", "0");
  const idx = Math.max(0, Math.min(HARMONIES.length - 1, Number(idxStr) || 0));
  const scheme = HARMONIES[idx];
  const valid = !!hexToRgb(c);
  const cols = valid ? harmonyColors(c.toUpperCase(), scheme.degrees) : [];

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="color"
          value={valid ? c : "#000000"}
          onChange={(e) => setC(e.target.value.toUpperCase())}
          aria-label="기준색"
        />
        {HARMONIES.map((hm, i) => (
          <button
            key={hm.name}
            type="button"
            className={"btn" + (i === idx ? " primary" : "")}
            onClick={() => setIdx(String(i))}
          >
            {hm.name}
          </button>
        ))}
      </div>
      {valid && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
              gap: 6,
              marginTop: 14,
            }}
          >
            {cols.map((col, i) => (
              <Swatch
                key={i}
                hex={col}
                height={64}
                textColor={bestTextOn(hexToRgb(col)!) + "cc"}
              />
            ))}
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            색상환에서 {scheme.degrees.map((d) => `${d}°`).join(" · ")} 위치의
            색을 뽑은 것입니다. 실제 팔레트 제작은{" "}
            <a href="/tool/palette-generator/">배색 팔레트 생성기</a>에서 할 수
            있습니다.
          </p>
        </>
      )}
    </div>
  );
}

// ── 난색/한색 데모: 같은 레이아웃, 다른 온도 ────────────────
export function WarmCoolDemo() {
  const [mode, setMode] = useState<"warm" | "cool">("warm");
  const pal =
    mode === "warm"
      ? { bg: "#FBEDE3", card: "#F4C9A8", accent: "#D96C2C", text: "#5C3317" }
      : { bg: "#E5EEF4", card: "#B9D4E5", accent: "#2C7BD9", text: "#173A5C" };

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className={"btn" + (mode === "warm" ? " primary" : "")}
          onClick={() => setMode("warm")}
        >
          난색 팔레트
        </button>
        <button
          type="button"
          className={"btn" + (mode === "cool" ? " primary" : "")}
          onClick={() => setMode("cool")}
        >
          한색 팔레트
        </button>
      </div>
      <div
        style={{
          marginTop: 12,
          background: pal.bg,
          borderRadius: 12,
          padding: 16,
          transition: "background .2s",
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            background: pal.card,
            borderRadius: 10,
            padding: 14,
            color: pal.text,
            transition: "background .2s",
          }}
        >
          <strong>같은 레이아웃, 다른 온도</strong>
          <p style={{ margin: "6px 0 10px", fontSize: 14 }}>
            내용은 그대로 두고 색만 바꿔도 화면의 인상이 달라집니다.
          </p>
          <span
            style={{
              background: pal.accent,
              color: "#fff",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 14,
              fontWeight: 700,
              display: "inline-block",
            }}
          >
            버튼
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 색공간 데모: 같은 색, 다른 좌표 ─────────────────────────
export function SpacesDemo() {
  const [c, setC] = useQueryState("c", "#3EB489");
  const rgb = hexToRgb(c);

  const view = useMemo(() => {
    if (!rgb) return null;
    return {
      hex: rgbToHex(rgb),
      rgb: fmtRgb(rgb),
      hsl: fmtHsl(rgb),
      oklch: fmtOklch(rgb),
    };
  }, [rgb]);

  const [oklchL, setOklchL] = useState<number | null>(null);

  return (
    <div className="card">
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
        색
        <input
          type="color"
          value={rgb ? rgbToHex(rgb) : "#000000"}
          onChange={(e) => {
            setC(e.target.value.toUpperCase());
            setOklchL(null);
          }}
          aria-label="색 선택"
        />
        <span style={{ fontFamily: "ui-monospace, monospace" }}>{c}</span>
      </label>
      {view && rgb && (
        <>
          <Swatch hex={view.hex} height={64} textColor={bestTextOn(rgb) + "cc"} />
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <tbody>
                <tr>
                  <th>sRGB</th>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>{view.rgb}</td>
                </tr>
                <tr>
                  <th>HSL</th>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>{view.hsl}</td>
                </tr>
                <tr>
                  <th>OKLCH</th>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>{view.oklch}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ margin: "12px 0 4px" }}>
            아래 슬라이더는 OKLCH의 밝기(L)만 움직입니다. 색상과 채도를 지키며
            밝기만 바뀌는 것이 지각 균일 색공간의 특징입니다.
          </p>
          {(() => {
            const base = rgbToOklch(rgb);
            const ok = { L: oklchL ?? base.L, C: base.C, h: base.h };
            const shifted = rgbToHex(oklchToRgb(ok));
            return (
              <>
                <input
                  type="range"
                  min={10}
                  max={97}
                  value={Math.round(ok.L * 100)}
                  onChange={(e) => setOklchL(Number(e.target.value) / 100)}
                  aria-label="OKLCH 밝기"
                />
                <Swatch
                  hex={shifted}
                  height={44}
                  textColor={bestTextOn(hexToRgb(shifted)!) + "cc"}
                />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ── 색의 연상 데모 ─────────────────────────────────────────
const MEANINGS: {
  name: string;
  hex: string;
  common: string;
  note: string;
}[] = [
  {
    name: "빨강",
    hex: "#C0392B",
    common: "열정 · 경고 · 축하(동아시아)",
    note: "동아시아 문화권에서는 행운·경사의 색으로도 쓰이는 반면, 금융 맥락의 서구권에서는 손실을 뜻하는 관례가 있습니다. 한국 증시는 반대로 상승이 빨강입니다.",
  },
  {
    name: "노랑",
    hex: "#E7B416",
    common: "주의 · 명랑 · 풍요",
    note: "교통 표지의 주의 표시로 국제적 관례가 있습니다. 역사적으로 중국에서는 황제의 색으로 제한된 시기가 있었다고 전해집니다.",
  },
  {
    name: "초록",
    hex: "#27AE60",
    common: "자연 · 안전 · 허용",
    note: "신호등의 진행, 비상구 표지 등 안전 표준에서의 쓰임은 규격으로 정해져 있는 사실이고, '치유의 색' 같은 표현은 관례적 연상입니다.",
  },
  {
    name: "파랑",
    hex: "#2C7BD9",
    common: "신뢰 · 차분함 · 기술",
    note: "글로벌 기업 로고에서 채택 빈도가 높은 색이라는 조사들이 있으며, '신뢰의 색'이라는 서술은 그 관행에서 온 통설입니다.",
  },
  {
    name: "보라",
    hex: "#7D3C98",
    common: "고귀함 · 창의 · 신비",
    note: "고대 티리안 퍼플 염료의 희소성에서 비롯한 연상이라는 설명이 일반적입니다. 현대에는 창의·예술 분야의 브랜딩 관례로 이어집니다.",
  },
  {
    name: "흰색",
    hex: "#F5F5F5",
    common: "순수 · 시작 · 애도(동아시아 전통)",
    note: "서구 혼례의 흰 드레스와 동아시아 전통 상례의 소복이 보여 주듯, 같은 색이 문화권에 따라 정반대 의례에 쓰입니다.",
  },
  {
    name: "검정",
    hex: "#222222",
    common: "격식 · 권위 · 애도(서구)",
    note: "서구 상복의 색이자 격식의 색입니다. 패션에서는 시대를 타지 않는 기본색이라는 관례적 평가가 굳어 있습니다.",
  },
];

export function MeaningDemo() {
  const [idx, setIdx] = useState(0);
  const m = MEANINGS[idx];
  return (
    <div className="card">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MEANINGS.map((mm, i) => (
          <button
            key={mm.name}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={mm.name}
            className="btn"
            style={{
              background: mm.hex,
              width: 40,
              height: 32,
              border:
                i === idx ? "3px solid var(--text)" : "1px solid var(--line)",
            }}
          />
        ))}
      </div>
      <h3 style={{ marginTop: 14 }}>{m.name}</h3>
      <p>
        <strong>관례적 연상:</strong> {m.common}
      </p>
      <p className="muted">{m.note}</p>
      <p className="notice">
        색의 의미는 문화·시대·맥락에 따라 달라지는 관습이지, 색 자체의 고정된
        속성이 아닙니다. 위 서술은 널리 통용되는 통설을 정리한 참고용입니다.
      </p>
    </div>
  );
}
