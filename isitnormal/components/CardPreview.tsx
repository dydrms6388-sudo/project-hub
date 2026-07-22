import type { CardData } from "@/lib/card";
import { SITE_NAME } from "@/site.config";

/**
 * 화면용 카드 미리보기 (4:5 세로). OG 이미지(opengraph-image)와 같은 구성이지만
 * 브라우저 한글 폰트로 항상 정확히 렌더된다. 워터마크 + 짧은 URL만, QR 없음(C3).
 */
export default function CardPreview({ card, shortUrl }: { card: CardData; shortUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-lg">
        <div className="text-sm font-semibold text-white/70">{card.title}</div>
        <div className="flex-1 flex flex-col justify-center py-4">
          <div className="text-3xl font-extrabold leading-tight">{card.headline}</div>
          <p className="mt-3 text-[15px] leading-relaxed text-white/90">{card.subline}</p>
        </div>
        <div>
          <div className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {card.tag}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
            <span>{SITE_NAME}</span>
            <span>{shortUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
