// =============================================================================
// E4 · /settings/subscription — 구독 관리 [F-PAY-06]
//
// Phase 1 규약(04_monetization §결정 · 12_flows §5.3):
//   · 지금은 **현재 티어 표시 + 혜택표 + 안내**만. 결제 CTA 는 비활성(결제 코드 금지).
//   · 가격·한도는 @duckmate/db 의 TIER_PRICES / TIER_LIMITS 단일 진실만 참조.
//   · 다크패턴 가드: 자동갱신 고지 문구를 결제 버튼 위에 고정 노출, 해지는
//     설정(1) → 구독 관리(2) = 2뎁스로 끝내고, 환불정책은 1탭 링크로 붙인다.
//   · 카운트다운·잔여 수량·손실 공포 카피는 만들지 않는다 (C2 D-3).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, CardContent } from "@duckmate/ui";
import { TIER_LIMITS, TIER_PRICES, type Subscription, type SubscriptionTier } from "@duckmate/db";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "구독 관리",
  robots: { index: false, follow: false },
};

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: "무료",
  plus: "플러스",
  pro: "프로",
};

const TIERS: SubscriptionTier[] = ["free", "plus", "pro"];

const ROWS: { label: string; value: (tier: SubscriptionTier) => string }[] = [
  { label: "일일 추천", value: (t) => `${TIER_LIMITS[t].dailyRecs}명` },
  { label: "오늘의 궁합 카드", value: (t) => `${TIER_LIMITS[t].dailyCards}장` },
  {
    label: "나를 좋아한 사람",
    value: (t) =>
      TIER_LIMITS[t].seeLikers === "blur"
        ? "인원수만 표시"
        : TIER_LIMITS[t].seeLikers === "open+boost"
          ? "공개 + 우선 노출"
          : "공개",
  },
  { label: "슈퍼라이크", value: (t) => `주 ${TIER_LIMITS[t].weeklySuperlikes}개` },
  {
    label: "되돌리기",
    value: (t) =>
      TIER_LIMITS[t].rewindPerDay === 0
        ? "—"
        : TIER_LIMITS[t].rewindPerDay === -1
          ? "무제한"
          : `일 ${TIER_LIMITS[t].rewindPerDay}회`,
  },
  { label: "이벤트 우선 참가", value: (t) => (TIER_LIMITS[t].eventPriority ? "O" : "—") },
  { label: "광고", value: (t) => (TIER_LIMITS[t].ads ? "결과 하단 배너 1개" : "없음") },
];

const STATUS_LABEL: Record<string, string> = {
  none: "구독 없음",
  active: "이용 중",
  cancel_scheduled: "기간 말 해지 예약됨",
  past_due: "결제 확인 중",
  expired: "종료됨",
  refunded: "환불 완료",
};

export default async function SubscriptionPage() {
  const { user } = await requireOnboardingDone();
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end, cancel_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const subscription = data as Pick<
    Subscription,
    "tier" | "status" | "current_period_end" | "cancel_at"
  > | null;
  const tier: SubscriptionTier = subscription?.tier ?? "free";
  const status = subscription?.status ?? "none";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">구독 관리</h1>
        <p className="text-body-sm text-ink-muted">지금 이용 중인 플랜과 혜택을 확인할 수 있어요.</p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <span className="flex items-center gap-2">
            <span className="text-h3">{TIER_LABEL[tier]}</span>
            <Badge variant={tier === "free" ? "neutral" : "brand"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          </span>
          <p className="text-body-sm text-ink-muted">
            {tier === "free"
              ? "무료 플랜을 이용 중이에요. 매일 추천과 궁합 카드는 무료에서도 계속 제공돼요."
              : `월 ${TIER_PRICES[tier].toLocaleString("ko-KR")}원`}
          </p>
          {subscription?.current_period_end && (
            <p className="text-caption text-ink-muted">
              현재 결제 기간 종료: {new Date(subscription.current_period_end).toLocaleDateString("ko-KR")}
            </p>
          )}
          {subscription?.cancel_at && (
            <p className="text-caption text-ink-muted">
              해지 예약: {new Date(subscription.cancel_at).toLocaleDateString("ko-KR")}까지 혜택 유지
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-label="플랜별 혜택" className="flex flex-col gap-2">
        <h2 className="text-h3">플랜 혜택</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface-raised">
          <table className="w-full border-collapse text-body-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">항목</th>
                {TIERS.map((t) => (
                  <th key={t} className="px-3 py-2 text-left">
                    {TIER_LABEL[t]}
                    <span className="block text-caption font-normal text-ink-muted">
                      {TIER_PRICES[t] === 0 ? "0원" : `${TIER_PRICES[t].toLocaleString("ko-KR")}원/월`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-ink-muted">
                    {row.label}
                  </th>
                  {TIERS.map((t) => (
                    <td key={t} className="px-3 py-2">
                      {row.value(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-ink-muted">표시 가격은 부가세 포함이며, 표시가 = 결제가예요.</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4">
        <h2 className="text-h3">유료 플랜은 아직 열리지 않았어요</h2>
        <p className="text-body-sm text-ink-muted">
          결제 기능은 준비 중이라 지금은 결제할 수 없어요. 열리면 이 화면에서 바로 안내드릴게요.
        </p>
        <p className="text-body-sm">
          매월 자동결제되며, 해지는 이 화면에서 언제든 바로 할 수 있어요. 해지해도 이미 결제한 기간이
          끝날 때까지는 혜택이 그대로 유지돼요.
        </p>
        <div>
          <Button size="lg" disabled>
            결제는 아직 열리지 않았어요
          </Button>
        </div>
        <Link href="/legal/refund" className="text-body-sm text-primary underline underline-offset-2">
          환불정책 보기
        </Link>
      </section>

      <p className="text-caption text-ink-muted">
        본인인증·매칭·채팅 같은 기본 기능은 유료 플랜과 무관해요. 인증 레벨 제한은 결제로 풀리지
        않아요 —{" "}
        <Link href="/verify" className="text-primary underline underline-offset-2">
          본인인증
        </Link>
        으로만 열려요.
      </p>
    </main>
  );
}
