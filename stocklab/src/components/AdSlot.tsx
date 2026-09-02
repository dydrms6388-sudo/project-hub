import { SITE } from "@/lib/site";

/**
 * 결과 하단 1개만 사용. 입력 화면에는 배치하지 않는다 (CLAUDE.md 광고 규칙).
 * NEXT_PUBLIC_ADSENSE_SLOT 미설정 시 렌더하지 않음(플레이스홀더 텍스트 금지).
 */
export function AdSlot({ slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT }: { slot?: string }) {
  if (!slot) return null;
  return (
    <div className="my-6 flex justify-center" aria-label="스폰서">
      <ins className="adsbygoogle block w-full" data-ad-client={SITE.adsenseClient} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
      <script dangerouslySetInnerHTML={{ __html: "(adsbygoogle=window.adsbygoogle||[]).push({});" }} />
    </div>
  );
}
