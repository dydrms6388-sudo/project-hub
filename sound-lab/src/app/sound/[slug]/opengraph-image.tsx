import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCategory, getSound, sounds } from "@/lib/sounds";
import { wavePoints } from "@/lib/ogWave";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "소리 실험 파형 미리보기";

export function generateStaticParams() {
  return sounds.map((s) => ({ slug: s.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getSound(slug);
  const cat = s ? getCategory(s.category) : undefined;
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "src/app/fonts/Pretendard-Regular.otf")),
  ]);
  const points = wavePoints(slug, 1104, 240);
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
          <div style={{ fontSize: 28, color: "#7ea0ff", fontWeight: 700 }}>
            소리실험실{cat ? ` · ${cat.name}` : ""}
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#f2f5ff",
              lineHeight: 1.22,
              marginTop: 10,
            }}
          >
            {s?.name ?? "소리 실험"}
          </div>
          <div
            style={{
              fontSize: 27,
              color: "#9aa6c4",
              marginTop: 14,
              fontWeight: 400,
            }}
          >
            슬라이더로 실시간 합성하며 파형·스펙트럼으로 확인하는 실험
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
          <svg width={1104} height={240} viewBox="0 0 1104 240">
            <line
              x1="0"
              y1="120"
              x2="1104"
              y2="120"
              stroke="#2a3763"
              strokeWidth="2"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#7ee2a8"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
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
