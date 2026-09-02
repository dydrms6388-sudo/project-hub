import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getIllusion, illusions } from "@/lib/illusions";
import { figureDataUri } from "@/lib/figureString";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "착시 도형 미리보기";

export function generateStaticParams() {
  return illusions.map((i) => ({ slug: i.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ill = getIllusion(slug);
  const figSrc = figureDataUri(slug, 480, 336);
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
          background: "#eef2ff",
          padding: 48,
          alignItems: "center",
          gap: 48,
          fontFamily: "Pretendard",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#ffffff",
            borderRadius: 24,
            border: "2px solid #c7d2fe",
            padding: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={figSrc} width={480} height={336} alt="" />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div style={{ fontSize: 28, color: "#4f46e5", fontWeight: 700 }}>
            착시실험실
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              color: "#1f2430",
              lineHeight: 1.25,
              marginTop: 12,
            }}
          >
            {ill?.name ?? "착시 체험"}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#5b6472",
              marginTop: 16,
              fontWeight: 400,
            }}
          >
            {ill ? `${ill.discoveredBy.split("(")[0].trim()} · ${ill.year}` : ""}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#5b6472",
              marginTop: 8,
              fontWeight: 400,
            }}
          >
            슬라이더로 조작하고, 속임수 벗기기로 확인하는 인터랙티브 체험
          </div>
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
