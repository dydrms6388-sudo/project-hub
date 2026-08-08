import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCategory, getSound, sounds } from "@/lib/sounds";
import { previewPolylinePoints } from "@/lib/preview";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return sounds.map((s) => ({ slug: s.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSound(slug);
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  if (!s) return new ImageResponse(<div style={{ display: "flex" }} />, size);
  const cat = getCategory(s.category);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0d1220",
          padding: 64,
          fontFamily: "Pretendard",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, color: "#7f8db0" }}>
            소리실험실 · {cat?.label ?? s.category}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 62,
              fontWeight: 700,
              color: "#f2f5ff",
              marginTop: 10,
              lineHeight: 1.25,
            }}
          >
            {s.name}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            background: "#141b2e",
            border: "2px solid #2b3654",
            borderRadius: 20,
            padding: 18,
          }}
        >
          <svg width={1036} height={260} viewBox="0 0 1036 260">
            <polyline
              points={previewPolylinePoints(s, 1036, 260)}
              fill="none"
              stroke="#5eead4"
              strokeWidth={3.5}
            />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#96a2bd" }}>
          {s.needsHeadphones ? "🎧 이어폰 필수 · " : ""}
          슬라이더 {s.params.length}개로 직접 조작하는 실시간 합성 실험
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
