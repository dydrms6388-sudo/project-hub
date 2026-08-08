import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sounds } from "@/lib/sounds";
import { wavePoints } from "@/lib/ogWave";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "소리실험실 — 인터랙티브 소리 실험";

export default async function OgImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0b1020",
          padding: 48,
          fontFamily: "Pretendard",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#7ea0ff", fontWeight: 700 }}>
            tomatoeggcat.com
          </div>
          <div
            style={{
              fontSize: 66,
              fontWeight: 700,
              color: "#f2f5ff",
              lineHeight: 1.22,
              marginTop: 10,
            }}
          >
            소리실험실
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#9aa6c4",
              marginTop: 14,
              fontWeight: 400,
            }}
          >
            {sounds.length}가지 소리 현상을 브라우저에서 실시간 합성하는
            인터랙티브 실험실
          </div>
        </div>
        <div
          style={{
            display: "flex",
            background: "#111832",
            borderRadius: 20,
            border: "2px solid #2a3763",
            padding: 24,
          }}
        >
          <svg width={1104} height={220} viewBox="0 0 1104 220">
            <line
              x1="0"
              y1="110"
              x2="1104"
              y2="110"
              stroke="#2a3763"
              strokeWidth="2"
            />
            <polyline
              points={wavePoints("shepard-risset", 1104, 220)}
              fill="none"
              stroke="#7ee2a8"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>
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
