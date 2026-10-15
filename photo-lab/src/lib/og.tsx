import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

async function loadFonts() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  return [
    { name: "Pretendard", data: bold, weight: 700 as const },
    { name: "Pretendard", data: regular, weight: 400 as const },
  ];
}

/** 사이트 공통 OG 카드 — 다크 배경 + 조리개 링 모티프 */
/** Pretendard에 없는 기호를 치환 — satori의 외부 폰트 폴백 다운로드(네트워크 호출) 방지 */
function sanitize(s: string): string {
  return s.replace(/∝/g, "~").replace(/⁻⁴/g, "^-4");
}

export async function ogCard({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  const fonts = await loadFonts();
  title = sanitize(title);
  subtitle = sanitize(subtitle);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d0f12",
          padding: 64,
          fontFamily: "Pretendard",
          position: "relative",
        }}
      >
        {/* 조리개 링 모티프 */}
        <div
          style={{
            position: "absolute",
            right: -110,
            top: -110,
            width: 460,
            height: 460,
            borderRadius: 230,
            border: "26px solid #e8a33d",
            opacity: 0.28,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 20,
            width: 200,
            height: 200,
            borderRadius: 100,
            border: "16px solid #5b9bd5",
            opacity: 0.35,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              color: "#0d0f12",
              background: "#e8a33d",
              borderRadius: 999,
              padding: "8px 26px",
            }}
          >
            {badge}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: title.length > 22 ? 62 : 76,
              fontWeight: 700,
              color: "#e6e9ee",
              lineHeight: 1.2,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 400,
              color: "#9aa3b0",
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#e6e9ee" }}>
            Photo<span style={{ color: "#e8a33d" }}>Lab</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#9aa3b0" }}>
            사진 촬영 계산 레퍼런스
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
