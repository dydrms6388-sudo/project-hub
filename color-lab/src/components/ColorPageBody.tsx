"use client";

import { useMemo } from "react";
import {
  bestTextOn,
  CVD_LABELS,
  CvdType,
  fmtHsl,
  fmtOklch,
  fmtRgb,
  harmonyColors,
  hexToRgb,
  hslToRgb,
  lightnessScale,
  rgbToHex,
  rgbToHsl,
  simulateCvd,
  wcagGrade,
} from "@/lib/color";
import type { SectionKey } from "@/lib/content/types";
import { CopyChip, downloadPalettePng, Swatch, useQueryState } from "./ui";

type Props = {
  slug: string;
  nameKo: string;
  nameEn: string;
  hex: string;
  history: string[];
  tips: string[];
  order: SectionKey[];
};

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export default function ColorPageBody(p: Props) {
  const base = hexToRgb(p.hex)!;
  const baseHsl = rgbToHsl(base);

  const [lStr, setL] = useQueryState("l", String(Math.round(baseHsl.l)));
  const [sStr, setS] = useQueryState("s", String(Math.round(baseHsl.s)));
  const l = Math.max(0, Math.min(100, Number(lStr) || 0));
  const s = Math.max(0, Math.min(100, Number(sStr) || 0));
  const adjusted = useMemo(
    () => hslToRgb({ h: baseHsl.h, s, l }),
    [baseHsl.h, s, l]
  );
  const hex = rgbToHex(adjusted);
  const isAdjusted =
    Math.round(baseHsl.l) !== l || Math.round(baseHsl.s) !== s;
  const heroText = bestTextOn(adjusted);

  const shades = useMemo(() => lightnessScale(hex, 9), [hex]);

  const sections: Record<SectionKey, React.ReactNode> = {
    codes: (
      <section key="codes">
        <h2>색상 코드</h2>
        <p className="muted">
          현재 슬라이더 상태의 값입니다. 버튼을 누르면 클립보드에 복사됩니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <CopyChip label="HEX" value={hex} />
          <CopyChip label="RGB" value={fmtRgb(adjusted)} />
          <CopyChip label="HSL" value={fmtHsl(adjusted)} />
          <CopyChip label="OKLCH" value={fmtOklch(adjusted)} />
          <CopyChip
            label="CSS 변수"
            value={`--color-${p.slug}: ${hex.toLowerCase()};`}
          />
        </div>
      </section>
    ),

    shades: (
      <section key="shades">
        <h2>명도 변형 팔레트 (9단계)</h2>
        <p className="muted">
          OKLCH 밝기(L)를 보간해 만든 스케일입니다. 지각적으로 고른 간격이
          나오도록 HSL 대신 OKLCH를 사용했습니다.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(9, 1fr)",
            gap: 4,
          }}
        >
          {shades.map((sh, i) => (
            <div
              key={i}
              title={sh}
              style={{
                background: sh,
                height: 56,
                borderRadius: 6,
                border: "1px solid rgba(0,0,0,.08)",
              }}
            />
          ))}
        </div>
        <div
          className="muted"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.72rem",
          }}
        >
          <span>{shades[0]}</span>
          <span>{shades[8]}</span>
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={() => downloadPalettePng(shades, `${p.slug}-shades`)}
        >
          팔레트 PNG 다운로드
        </button>
      </section>
    ),

    harmony: (
      <section key="harmony">
        <h2>어울리는 색 조합</h2>
        <p className="muted">
          색상환에서 현재 색의 색상각을 회전해 얻는 세 가지 기본 배색입니다.
        </p>
        {(
          [
            { name: "보색 배색", degs: [0, 180], desc: "정반대 색상각. 강한 대비가 필요할 때." },
            { name: "유사 배색", degs: [-30, 0, 30], desc: "이웃 색상각. 자연스럽고 안정적." },
            { name: "삼각 배색", degs: [0, 120, 240], desc: "120° 간격. 활기 있으면서 균형적." },
          ] as const
        ).map((h) => {
          const cols = harmonyColors(hex, h.degs);
          return (
            <div key={h.name} style={{ marginTop: 14 }}>
              <h3 style={{ margin: "0 0 6px" }}>
                {h.name}{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  — {h.desc}
                </span>
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
                  gap: 6,
                }}
              >
                {cols.map((c, i) => (
                  <Swatch
                    key={i}
                    hex={c}
                    height={54}
                    textColor={bestTextOn(hexToRgb(c)!) + "cc"}
                  />
                ))}
              </div>
              {/* 미리보기: 배색을 실제 UI 조각에 적용 */}
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                  display: "flex",
                }}
                aria-hidden
              >
                <div style={{ background: cols[0], flex: 3, padding: "14px 12px" }}>
                  <span
                    style={{
                      color: bestTextOn(hexToRgb(cols[0])!),
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    미리보기 텍스트
                  </span>
                </div>
                {cols.slice(1).map((c, i) => (
                  <div key={i} style={{ background: c, flex: 1 }} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    ),

    contrast: (
      <section key="contrast">
        <h2>접근성 — 텍스트 대비</h2>
        <p className="muted">
          WCAG 2.1 상대 휘도 공식으로 실제 계산한 대비비입니다. AA 일반
          텍스트는 4.5:1, 큰 텍스트는 3:1, AAA는 각각 7:1 / 4.5:1 이상이어야
          합니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>조합</th>
                <th>대비비</th>
                <th>AA 일반</th>
                <th>AA 큰글자</th>
                <th>AAA 일반</th>
                <th>AAA 큰글자</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "흰 텍스트", fg: WHITE, css: "#FFFFFF" },
                { label: "검은 텍스트", fg: BLACK, css: "#000000" },
              ].map((row) => {
                const g = wcagGrade(row.fg, adjusted);
                const cell = (ok: boolean) => (
                  <td className={ok ? "pass" : "fail"}>
                    {ok ? "통과" : "미달"}
                  </td>
                );
                return (
                  <tr key={row.label}>
                    <td>
                      <span
                        style={{
                          background: hex,
                          color: row.css,
                          padding: "2px 10px",
                          borderRadius: 6,
                          fontWeight: 700,
                        }}
                      >
                        {row.label}
                      </span>
                    </td>
                    <td style={{ fontFamily: "ui-monospace, monospace" }}>
                      {g.ratio.toFixed(2)}:1
                    </td>
                    {cell(g.aaNormal)}
                    {cell(g.aaLarge)}
                    {cell(g.aaaNormal)}
                    {cell(g.aaaLarge)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    ),

    cvd: (
      <section key="cvd">
        <h2>색각 이상에서는 어떻게 보일까</h2>
        <p className="muted">
          Machado, Oliveira &amp; Fernandes(2009, IEEE TVCG)의 변환 행렬(중증도
          1.0)을 선형 RGB에 적용한 시뮬레이션입니다. 실제 개인의 지각과는 차이가
          있을 수 있으며, 의료적 진단이 아닙니다.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          <div>
            <Swatch hex={hex} height={64} textColor={heroText + "cc"} />
            <div className="muted" style={{ marginTop: 4 }}>
              원본
            </div>
          </div>
          {(Object.keys(CVD_LABELS) as CvdType[]).map((t) => {
            const sim = rgbToHex(simulateCvd(adjusted, t));
            return (
              <div key={t}>
                <Swatch
                  hex={sim}
                  height={64}
                  textColor={bestTextOn(hexToRgb(sim)!) + "cc"}
                />
                <div className="muted" style={{ marginTop: 4 }}>
                  {CVD_LABELS[t].ko}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ),

    history: (
      <section key="history">
        <h2>{p.nameKo}의 유래와 쓰임</h2>
        {p.history.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </section>
    ),

    tips: (
      <section key="tips">
        <h2>실전 사용 팁</h2>
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          {p.tips.map((t, i) => (
            <li key={i} style={{ margin: "6px 0" }}>
              {t}
            </li>
          ))}
        </ul>
      </section>
    ),
  };

  return (
    <>
      {/* 1. 대형 색상 블록 + 슬라이더 (항상 처음) */}
      <section>
        <div
          style={{
            background: hex,
            borderRadius: "var(--radius)",
            height: 220,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 18,
            border: "1px solid rgba(0,0,0,.08)",
            transition: "background .1s linear",
          }}
        >
          <div
            style={{
              color: heroText,
              fontFamily: "ui-monospace, monospace",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            {hex}
          </div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: "0.88rem" }}>
            밝기 {l}%
            <input
              type="range"
              min={0}
              max={100}
              value={l}
              onChange={(e) => setL(e.target.value)}
              aria-label="밝기"
            />
          </label>
          <label style={{ display: "block", fontSize: "0.88rem", marginTop: 8 }}>
            채도 {s}%
            <input
              type="range"
              min={0}
              max={100}
              value={s}
              onChange={(e) => setS(e.target.value)}
              aria-label="채도"
            />
          </label>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            {isAdjusted && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setL(String(Math.round(baseHsl.l)));
                  setS(String(Math.round(baseHsl.s)));
                }}
              >
                기본 {p.nameKo}(으)로 되돌리기
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigator.clipboard?.writeText(window.location.href)
              }
            >
              현재 상태 링크 복사
            </button>
            <span className="muted">
              조정한 색은 URL에 저장돼 링크로 공유하면 그대로 재현됩니다.
            </span>
          </div>
        </div>
      </section>

      {p.order.map((k) => sections[k])}
    </>
  );
}
