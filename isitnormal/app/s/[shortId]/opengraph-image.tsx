import { ImageResponse } from "next/og";
import { resolveShortLink } from "@/lib/shortlink";
import { getSurveyBySlug } from "@/lib/surveys";
import { getStatsBySlug } from "@/lib/stats";
import { buildCard, type CardData } from "@/lib/card";
import { SITE_NAME } from "@/site.config";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1080, height: 1350 }; // C1: 1080x1350 세로 카드

// 한글 폰트 로드 (satori는 글리프 커버 폰트가 없으면 한글을 렌더 못 함). 실패 시 폰트 없이 폴백.
let FONTS: { name: string; data: ArrayBuffer; weight: 400 | 700 }[] | null = null;
async function loadFonts() {
  if (FONTS) return FONTS;
  const base =
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static";
  const [regular, bold] = await Promise.all([
    fetch(`${base}/Pretendard-Regular.otf`).then((r) => r.arrayBuffer()),
    fetch(`${base}/Pretendard-Bold.otf`).then((r) => r.arrayBuffer()),
  ]);
  FONTS = [
    { name: "Pretendard", data: regular, weight: 400 },
    { name: "Pretendard", data: bold, weight: 700 },
  ];
  return FONTS;
}

function Card({ card }: { card: CardData }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "linear-gradient(135deg, #5b6cff 0%, #3f4ee0 100%)",
        color: "white",
        fontFamily: "Pretendard, sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.72)", fontWeight: 400 }}>
        {card.title}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1.15 }}>
          {card.headline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 44,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.92)",
            fontWeight: 400,
          }}
        >
          {card.subline}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: "rgba(255,255,255,0.16)",
            borderRadius: 999,
            padding: "14px 28px",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          {card.tag}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 40,
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <span>{SITE_NAME}</span>
          <span>isitnormal</span>
        </div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const link = await resolveShortLink(shortId);
  let card: CardData = buildCard("정상인가요", null, null);
  if (link) {
    const survey = getSurveyBySlug(link.slug);
    const stats = await getStatsBySlug(link.slug);
    card = buildCard(survey?.title ?? "정상인가요", stats, link.optKey);
  }

  try {
    const fonts = await loadFonts();
    return new ImageResponse(<Card card={card} />, { ...size, fonts });
  } catch {
    // C1: 폰트/렌더 실패 시에도 이미지를 반환(500 금지). 폰트 없이 폴백.
    return new ImageResponse(<Card card={card} />, size);
  }
}
