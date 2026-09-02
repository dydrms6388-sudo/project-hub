import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPattern, getCategory, patterns } from "@/lib/patterns";
import { patternPreviewUri } from "@/lib/ogImage";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "수학 패턴 미리보기";

export function generateStaticParams() {
  return patterns.map((p) => ({ slug: p.slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pat = getPattern(slug);
  const cat = pat ? getCategory(pat.category) : undefined;
  const preview = patternPreviewUri(slug, 560, 560);
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
          background: "#0b0f19",
          padding: 48,
          alignItems: "center",
          gap: 44,
          fontFamily: "Pretendard",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 534,
            height: 534,
            borderRadius: 20,
            border: "2px solid #1e293b",
            background: preview ? "#0b0f19" : "#111827",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} width={530} height={530} alt="" />
          ) : (
            <div style={{ fontSize: 150, color: "#6366f1" }}>∑</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, color: "#818cf8", fontWeight: 700 }}>
            패턴연구소
          </div>
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              color: "#f1f5f9",
              lineHeight: 1.22,
              marginTop: 12,
            }}
          >
            {pat?.name ?? "수학 패턴"}
          </div>
          <div style={{ fontSize: 26, color: "#94a3b8", marginTop: 16, fontWeight: 400 }}>
            {cat?.label ?? ""}
          </div>
          <div style={{ fontSize: 24, color: "#64748b", marginTop: 8, fontWeight: 400 }}>
            슬라이더로 조작하고 PNG·SVG로 저장
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
