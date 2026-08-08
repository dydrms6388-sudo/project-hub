import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSound } from "@/lib/sounds";
import { previewPolylinePoints } from "@/lib/preview";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "소리실험실 — 40가지 인터랙티브 소리 실험";

export default async function OgImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  const picks = ["shepard-tone", "fm-synthesis", "noise-colors", "binaural-beats"]
    .map((s) => getSound(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0d1220",
          padding: 56,
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", gap: 20 }}>
          {picks.map((s) => (
            <div
              key={s.slug}
              style={{
                display: "flex",
                background: "#141b2e",
                borderRadius: 16,
                border: "2px solid #2b3654",
                padding: 10,
              }}
            >
              <svg width={244} height={150} viewBox="0 0 244 150">
                <polyline
                  points={previewPolylinePoints(s, 244, 150)}
                  fill="none"
                  stroke="#5eead4"
                  strokeWidth={2.5}
                />
              </svg>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, color: "#f2f5ff", marginTop: 52 }}>
          소리실험실
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#96a2bd", marginTop: 12, fontWeight: 400 }}>
          40가지 소리 현상을 슬라이더로 조작하는 인터랙티브 실험실
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
