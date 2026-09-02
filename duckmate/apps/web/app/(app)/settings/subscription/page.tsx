import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ENTITLEMENTS, type Tier } from "@duckmate/db";
import { Badge } from "@duckmate/ui";
import { requireProfile } from "@/lib/auth/session";
import { isPaymentsEnabled, UNLIMITED } from "@/lib/payments";
import { paymentsAllowedByLegal } from "@/config/company";
import { SUBSCRIPTION_COPY } from "@/components/settings/copy";
import { WebOnly } from "@/components/settings/WebOnly";

export const metadata: Metadata = { title: "구독", robots: { index: false, follow: false } };

const TIERS: ReadonlyArray<Tier> = ["free", "plus", "pro"];
const TIER_LABEL: Readonly<Record<Tier, string>> = { free: SUBSCRIPTION_COPY.free, plus: SUBSCRIPTION_COPY.plus, pro: SUBSCRIPTION_COPY.pro };

/** 12키 → 행 라벨·표기 (19_payments 결정 2: 무료 열 긍정 표기, X 는 실제 false 만, -1 = 전체). 티어 비교 없음, 키 값만 렌더 */
type Row = { label: string; cell: (t: Tier) => { text: string; off: boolean } };
const ROWS: ReadonlyArray<Row> = [
  { label: "일일 추천", cell: (t) => ({ text: `${ENTITLEMENTS[t].daily_reco_limit}명/일`, off: false }) },
  { label: "오늘의 궁합 카드", cell: (t) => ({ text: `${ENTITLEMENTS[t].daily_card_limit}장/일`, off: false }) },
  { label: "나를 좋아한 사람", cell: (t) => (ENTITLEMENTS[t].see_likers === "full" ? { text: "닉네임·카드 공개", off: false } : { text: "인원수만", off: false }) },
  { label: "좋아한 사람 우선 추천", cell: (t) => ({ text: ENTITLEMENTS[t].liker_priority ? "포함" : "—", off: !ENTITLEMENTS[t].liker_priority }) },
  { label: "주간 슈퍼라이크", cell: (t) => ({ text: `${ENTITLEMENTS[t].weekly_superlike_quota}개/주`, off: false }) },
  { label: "취향 배틀 결과 상세", cell: (t) => ({ text: ENTITLEMENTS[t].battle_detail_top === UNLIMITED ? "전체" : `상위 ${ENTITLEMENTS[t].battle_detail_top}`, off: false }) },
  { label: "되돌리기", cell: (t) => ({ text: ENTITLEMENTS[t].undo ? "포함" : "—", off: !ENTITLEMENTS[t].undo }) },
  { label: "이벤트 우선 참가", cell: (t) => ({ text: ENTITLEMENTS[t].event_priority ? "24시간 먼저" : "—", off: !ENTITLEMENTS[t].event_priority }) },
  { label: "광고", cell: (t) => ({ text: ENTITLEMENTS[t].ads ? "표시" : "없음", off: false }) },
  { label: "읽음 표시", cell: (t) => ({ text: ENTITLEMENTS[t].read_receipts ? "포함" : "—", off: !ENTITLEMENTS[t].read_receipts }) },
  { label: "고급 필터", cell: (t) => ({ text: ENTITLEMENTS[t].advanced_filters ? "포함" : "—", off: !ENTITLEMENTS[t].advanced_filters }) },
  { label: "프로필 통계", cell: (t) => ({ text: ENTITLEMENTS[t].profile_stats ? "포함" : "—", off: !ENTITLEMENTS[t].profile_stats }) },
];

/**
 * /settings/subscription — Phase 1: "준비 중" + 무료/플러스/프로 혜택표(12키), 결제 버튼·가격·카운트다운 없음 (19_payments 결정 1·§7).
 * 판정 1곳: isPaymentsEnabled() && paymentsAllowedByLegal(). false 면 가격 열은 "준비 중".
 */
export default async function SubscriptionPage() {
  await requireProfile(1);
  const enabled = isPaymentsEnabled() && paymentsAllowedByLegal();
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="subscription-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">구독</h1>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-h3">{SUBSCRIPTION_COPY.preparing}</h2>
          <Badge variant="info" size="sm">
            {SUBSCRIPTION_COPY.priceTbd}
          </Badge>
        </div>
        <p className="text-body-sm mt-1 text-muted-foreground">{SUBSCRIPTION_COPY.preparingBody}</p>
        <p className="text-body-sm mt-2 text-muted-foreground">현재 이용 중: {TIER_LABEL.free}</p>
      </section>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-body-sm" data-testid="tier-table">
          <caption className="sr-only">티어별 혜택 표</caption>
          <thead>
            <tr className="bg-muted">
              <th scope="col" className="px-3 py-2.5 text-left font-medium">
                혜택
              </th>
              {TIERS.map((t) => (
                <th key={t} scope="col" className="px-3 py-2.5 text-center font-medium">
                  {TIER_LABEL[t]}
                  <span className="tnum block text-caption font-normal text-muted-foreground">{t === "free" ? "₩0" : enabled ? "" : SUBSCRIPTION_COPY.priceTbd}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <th scope="row" className="px-3 py-2.5 text-left font-normal text-muted-foreground">
                  {r.label}
                </th>
                {TIERS.map((t) => {
                  const c = r.cell(t);
                  return (
                    <td key={t} className={`tnum px-3 py-2.5 text-center ${c.off ? "text-muted-foreground" : "text-foreground"}`}>
                      {c.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-caption mt-4 text-muted-foreground">
        유료 혜택은 안내 후에만 열려요. 가격·결제 조건은 결제 화면에 부가세 포함 최종가로 표시하고, 자동 결제는 결제 전에 고지해요.{" "}
        <Link href="/legal/refund" className="text-primary underline underline-offset-4">
          환불정책
        </Link>
      </p>
      <WebOnly fallback={null}>
        {/* Phase 3: 웹 결제 안내·Toss 결제 시트는 이 안에만 (09_store_policy 결정 10). Phase 1 은 렌더할 웹 전용 문구 없음 */}
        {null}
      </WebOnly>
    </div>
  );
}
