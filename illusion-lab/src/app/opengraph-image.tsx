import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { figureDataUri } from "@/lib/figureString";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "착시실험실 — 40가지 인터랙티브 착시";

export default async function OgImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  const picks = ["muller-lyer", "kanizsa-triangle", "cafe-wall", "penrose-triangle"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#eef2ff",
          padding: 56,
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          {picks.map((slug) => (
            <div
              key={slug}
              style={{
                display: "flex",
                background: "#ffffff",
                borderRadius: 16,
                border: "2px solid #c7d2fe",
                padding: 12,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={figureDataUri(slug, 230, 161)} width={230} height={161} alt="" />
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#1f2430",
            marginTop: 48,
          }}
        >
          착시실험실
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#5b6472",
            marginTop: 12,
            fontWeight: 400,
          }}
        >
          40가지 고전 착시를 슬라이더로 조작하는 인터랙티브 실험실
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700 },
        { name: "Pretendard", data: regular, weight: 400 },
      ],
    }
  );
}
