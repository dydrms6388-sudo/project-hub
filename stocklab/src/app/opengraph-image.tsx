import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/**
 * 사이트 레벨 정적 OG 이미지 (1200x630).
 * next/og 기본 폰트는 라틴 문자만 내장하므로 외부 폰트 fetch 없이 렌더하기 위해 텍스트를 영문으로 구성한다.
 */
export const alt = `${SITE.nameEn} — data tools for individual investors`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const host = SITE.url.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b0e13 0%, #131820 60%, #1a2a4a 100%)",
          color: "#e8ecf1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#60a5fa" }} />
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{SITE.nameEn}</div>
          <div style={{ fontSize: 22, color: "#9aa5b4", marginLeft: 6 }}>{`by ${SITE.parent.name}`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 }}>
            Screen. Calculate. Verify.
          </div>
          <div style={{ fontSize: 28, color: "#9aa5b4", lineHeight: 1.4 }}>
            Value & dividend screeners, compound calculator, daily rule-based picks. No tips, just tools.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#9aa5b4" }}>
          <div>{host}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["KOSPI", "KOSDAQ", "DART", "KRX"].map((t) => (
              <div key={t} style={{ border: "1px solid #263040", borderRadius: 999, padding: "6px 16px", fontSize: 20 }}>{t}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
