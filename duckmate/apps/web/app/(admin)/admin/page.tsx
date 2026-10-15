// D8 · /admin — 지표 대시보드 (F-ADM-04)
// 신고율은 활동 지표 옆에 교차 배치한다 (A3 §4.3 — 성장 지표와 안전 지표 동시 노출).

import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@duckmate/ui";
import { getDashboardMetrics, FUNNEL_EVENT_NAMES } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

const FUNNEL_LABELS: Record<(typeof FUNNEL_EVENT_NAMES)[number], string> = {
  signup_start: "가입 시작",
  onboarding_complete: "온보딩 완료",
  reco_queue_open: "추천 큐 열람",
  like_sent: "좋아요 발신",
  match_created: "매칭 성립",
  first_message_sent: "첫 메시지",
};

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-caption text-ink-muted">{label}</p>
        <p
          className={`text-h1 tabular-nums ${
            tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink"
          }`}
        >
          {value}
        </p>
        {sub ? <p className="text-caption text-ink-muted">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const res = await getDashboardMetrics();
  if (!res.ok) {
    return <p className="text-body text-danger">지표를 불러오지 못했어요: {res.message}</p>;
  }
  const m = res.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-h1">대시보드</h1>
        <p className="text-caption text-ink-muted">
          KST 오늘 기준 · 생성 {new Date(m.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
      </header>

      {/* 청소년보호책임자 임계 경고 위젯 (B1 L5: DAU 10만 = 지정 의무 + L8 재판정) */}
      {m.youth.nearing ? (
        <div
          role="alert"
          className={`rounded-md border border-line px-4 py-3 text-body-sm ${
            m.youth.reached ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning"
          }`}
        >
          {m.youth.reached
            ? `일 이용자 ${m.youth.dau.toLocaleString()}명 — 규모 요건(10만 명) 도달. 청소년보호책임자 지정(정보통신망법 §42의3) 및 불법촬영물 기술적 조치(L8) 재판정이 필요해요.`
            : `일 이용자 ${m.youth.dau.toLocaleString()}명 — 규모 요건(10만 명)의 ${m.youth.ratioPct}%. 청소년보호책임자 지정을 준비하세요.`}
        </div>
      ) : null}

      {/* 활동 + 신고율 교차 배치 */}
      <section aria-label="활동 지표" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="DAU (오늘, 근사)"
          value={m.dauToday.toLocaleString()}
          sub={`청소년보호 임계 대비 ${m.youth.ratioPct}%`}
        />
        <Stat label="신규 가입 (오늘)" value={m.signupsToday.toLocaleString()} />
        <Stat
          label="매칭율 (오늘)"
          value={m.matchRatePct === null ? "—" : `${m.matchRatePct}%`}
          sub={`좋아요 ${m.likesToday.toLocaleString()} → 매칭 ${m.matchesToday.toLocaleString()}`}
        />
        <Stat
          label="신고율 (오늘)"
          value={m.reportRatePct === null ? "—" : `${m.reportRatePct}%`}
          sub={`신고 ${m.reportsToday.toLocaleString()}건 / DAU`}
          tone={m.reportRatePct !== null && m.reportRatePct >= 1 ? "warning" : undefined}
        />
      </section>

      {/* 큐 상태 */}
      <section aria-label="큐 지표" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="SLA 위반 (24h/1h 초과)"
          value={m.slaBreached.toLocaleString()}
          sub={m.slaImminent > 0 ? `임박(4시간 이내) ${m.slaImminent}건` : undefined}
          tone={m.slaBreached > 0 ? "danger" : undefined}
        />
        <Stat
          label="미종결 신고"
          value={m.reportsOpen.toLocaleString()}
          sub={m.reportsOpenP0 > 0 ? `P0 ${m.reportsOpenP0}건` : "P0 없음"}
          tone={m.reportsOpenP0 > 0 ? "danger" : undefined}
        />
        <Stat
          label="사진 검수 대기"
          value={m.photosPending.toLocaleString()}
          sub="24시간 이내 처리 안내 기준"
          tone={m.photosPending > 50 ? "warning" : undefined}
        />
        <Stat
          label="이의제기 대기"
          value={m.appealsPending.toLocaleString()}
          sub={m.appealsOverdue > 0 ? `기한(7일) 초과 ${m.appealsOverdue}건` : "기한 초과 없음"}
          tone={m.appealsOverdue > 0 ? "danger" : undefined}
        />
      </section>

      {/* 오늘의 퍼널 */}
      <Card>
        <CardHeader>
          <CardTitle>오늘의 퍼널 (A3 §4.1 이벤트)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-line text-left text-caption text-ink-muted">
                  {FUNNEL_EVENT_NAMES.map((name) => (
                    <th key={name} className="px-3 py-2 font-medium">
                      {FUNNEL_LABELS[name]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {FUNNEL_EVENT_NAMES.map((name) => (
                    <td key={name} className="px-3 py-2 tabular-nums">
                      {(m.funnelToday[name] ?? 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            코호트(D1/D7/D30)·30일 이동평균 DAU 는 일별 롤업 도입 후 제공 — 21_admin.md §미결.
          </p>
        </CardContent>
      </Card>

      {/* 바로가기 */}
      <section className="flex gap-3">
        <Link href="/admin/reports" className="text-body-sm text-accent-text underline">
          신고 큐로 이동 {m.reportsOpen > 0 ? <Badge variant="danger">{m.reportsOpen}</Badge> : null}
        </Link>
        <Link href="/admin/photos" className="text-body-sm text-accent-text underline">
          사진 검수 {m.photosPending > 0 ? <Badge variant="warning">{m.photosPending}</Badge> : null}
        </Link>
        <Link href="/admin/appeals" className="text-body-sm text-accent-text underline">
          이의제기 {m.appealsPending > 0 ? <Badge variant="neutral">{m.appealsPending}</Badge> : null}
        </Link>
      </section>
    </div>
  );
}
