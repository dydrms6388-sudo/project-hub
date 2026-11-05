import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { getMetrics } from "@/lib/admin/queries";
import { KPI, METRICS_PERIODS, REPORT_SLA_LABEL } from "@/lib/admin/constants";
import { fmtDate, fmtNum } from "@/lib/admin/format";
import {
  datingFemaleRatio, funnelWithRates, genderByMode, likeToMatchRate, matchToFirstMessageRate, pct, photoReview24hRate, recoToLikeRate,
  reportRatePerActive, reportRatePerMatch, slaCompliance, slaComplianceAll, sum,
} from "@/lib/admin/metrics";
import { BarChart, Gauge, LineChart, Stat } from "../../_components/charts";

export default async function MetricsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage("moderator");
  const sp = await searchParams;
  const raw = Number.parseInt((Array.isArray(sp.days) ? sp.days[0] : sp.days) ?? "7", 10);
  const days = (METRICS_PERIODS as readonly number[]).includes(raw) ? raw : 7;
  const m = await getMetrics(ctx.admin, days);
  const labels = m.daily.map((d) => fmtDate(d.loop_date));
  const fem = datingFemaleRatio(m.gender);
  const gm = genderByMode(m.gender);
  const funnel = funnelWithRates(m.funnel);
  const totalSanctions = sum(m.sanctions, (s) => s.total);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-h1">지표</h1>
          <p className="text-body-sm text-muted-foreground">loop_date(KST 07:00) 기준 · 정의는 21_admin.md 지표 정의표 · 분석 이벤트(app_opened) 는 E5 track() 도입 후 채워져요.</p>
        </div>
        <div className="flex gap-1">
          {METRICS_PERIODS.map((d) => (
            <Link key={d} href={`/admin/metrics?days=${d}`} className={`rounded-md px-3 py-1.5 text-label ${days === d ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {d}일
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="DAU (last_active 24h)" value={fmtNum(m.active.dau)} />
        <Stat label="WAU (7d)" value={fmtNum(m.active.wau)} />
        <Stat label="MAU (30d)" value={fmtNum(m.active.mau)} />
        <Stat label="활성 프로필" value={fmtNum(m.active.total_active)} hint={`L2+ ${fmtNum(m.active.total_l2_plus)}`} />
        <Stat label={`신규 가입 (${days}일)`} value={fmtNum(sum(m.daily, (d) => d.signups))} hint={`온보딩 완료 ${fmtNum(sum(m.daily, (d) => d.onboarding_completed))}`} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">성비 (active · L2+) — 1순위 KPI</h2>
          <div className="mt-3">
            <Gauge label="데이팅 모드 여성 비율" value={fem.ratio} target={KPI.datingFemaleRatio} />
          </div>
          <table className="tnum mt-3 w-full text-body-sm">
            <thead className="text-caption text-muted-foreground">
              <tr><th className="text-left">모드</th><th>여성</th><th>남성</th><th>미지정</th><th>합계</th></tr>
            </thead>
            <tbody>
              {(["dating", "friend"] as const).map((mode) => (
                <tr key={mode} className="text-center">
                  <td className="text-left">{mode}</td><td>{gm[mode].female}</td><td>{gm[mode].male}</td><td>{gm[mode].unspecified}</td><td>{gm[mode].total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fem.ratio !== null && fem.ratio < KPI.datingFemaleRatio ? <p className="mt-2 text-caption text-coral-700 dark:text-coral-300">KPI 미달 → 남성 웨이팅(F-057) 검토</p> : null}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">인증 레벨 분포</h2>
          <BarChart data={m.verifyLevels.map((v) => ({ label: `L${v.verify_level}`, value: v.cnt }))} height={140} />
          <div className="mt-2 grid grid-cols-4 text-center text-body-sm tnum">
            {m.verifyLevels.map((v) => (
              <div key={v.verify_level}>
                <div className="text-caption text-muted-foreground">L{v.verify_level}</div>
                {fmtNum(v.cnt)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-h3">온보딩 퍼널 (기간 내 가입 코호트)</h2>
        <BarChart data={funnel.map((f) => ({ label: f.step, value: f.cnt, hint: f.label }))} height={140} />
        <table className="tnum mt-2 w-full text-body-sm">
          <thead className="text-caption text-muted-foreground"><tr><th className="text-left">단계</th><th>인원</th><th>직전 대비</th><th>가입 대비</th></tr></thead>
          <tbody>
            {funnel.map((f) => (
              <tr key={f.step} className="text-center"><td className="text-left">{f.label}</td><td>{fmtNum(f.cnt)}</td><td>{pct(f.stepRate)}</td><td>{pct(f.fromStart)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-caption text-muted-foreground">추천 화면 도달률(목표 45%) = 본인인증(L2) / 가입 = {pct(funnel.find((f) => f.step === "verified")?.fromStart ?? null)}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">추천 → 좋아요 → 매칭 (일별)</h2>
          <LineChart labels={labels} series={[{ name: "추천", points: m.daily.map((d) => d.reco_count), tone: "muted" }, { name: "좋아요", points: m.daily.map((d) => d.likes) }, { name: "매칭", points: m.daily.map((d) => d.matches), tone: "accent" }]} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="추천→좋아요" value={pct(recoToLikeRate(m.daily))} />
            <Stat label="좋아요→매칭 (목표 8%)" value={pct(likeToMatchRate(m.daily))} tone={(likeToMatchRate(m.daily) ?? 0) >= KPI.likeToMatch ? "success" : undefined} />
            <Stat label="매칭→첫 메시지 (목표 70%)" value={pct(matchToFirstMessageRate(m.daily))} tone={(matchToFirstMessageRate(m.daily) ?? 0) >= KPI.matchToFirstMessage ? "success" : undefined} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">가입 · 활성(app_opened) · 신고 (일별)</h2>
          <LineChart labels={labels} series={[{ name: "가입", points: m.daily.map((d) => d.signups) }, { name: "활성(이벤트)", points: m.daily.map((d) => d.active_users), tone: "success" }, { name: "신고", points: m.daily.map((d) => d.reports), tone: "accent" }]} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="신고율 (신고/활성유저)" value={pct(reportRatePerActive(m.daily))} hint="analytics_events 기준" />
            <Stat label="신고율 (신고/매칭, 목표 ≤3%)" value={pct(reportRatePerMatch(m.daily))} tone={(reportRatePerMatch(m.daily) ?? 0) > KPI.reportRatePerMatch ? "danger" : "success"} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">신고 SLA (기간 내 접수)</h2>
          <div className="mt-2">
            <Gauge label="P0~P2 준수율 (목표 100%)" value={slaComplianceAll(m.sla)} target={1} />
          </div>
          <table className="tnum mt-3 w-full text-body-sm">
            <thead className="text-caption text-muted-foreground"><tr><th className="text-left">우선순위</th><th>접수</th><th>종결</th><th>기한 내</th><th>초과 미종결</th><th>준수율</th><th>평균 처리(분)</th></tr></thead>
            <tbody>
              {m.sla.map((r) => (
                <tr key={r.priority} className="text-center">
                  <td className="text-left">{r.priority} <span className="text-caption text-muted-foreground">({REPORT_SLA_LABEL[r.priority]})</span></td>
                  <td>{r.total}</td><td>{r.handled}</td><td>{r.within_sla}</td>
                  <td className={r.overdue_open > 0 ? "font-semibold text-destructive" : ""}>{r.overdue_open}</td>
                  <td>{pct(slaCompliance(r))}</td><td>{r.avg_handle_minutes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">제재 건수 (기간, 레벨별)</h2>
          <BarChart data={m.sanctions.map((s) => ({ label: `L${s.level}`, value: s.total, hint: `자동 ${s.auto_cnt} / 수동 ${s.manual_cnt}` }))} height={140} />
          <p className="tnum mt-1 text-body-sm">
            합계 {fmtNum(totalSanctions)} · 자동 {fmtNum(sum(m.sanctions, (s) => s.auto_cnt))} · 수동 {fmtNum(sum(m.sanctions, (s) => s.manual_cnt))} · 해제 {fmtNum(sum(m.sanctions, (s) => s.revoked_cnt))}
          </p>
          <h2 className="mt-4 text-h3">사진 검수</h2>
          <div className="mt-2">
            <Gauge label="24h 내 처리율 (목표 95%)" value={photoReview24hRate(m.photos)} target={KPI.photoReview24h} />
          </div>
          <p className="tnum mt-1 text-body-sm">
            대기 {m.photos.pending} · 보류 {m.photos.held} · 24h 초과 대기 {m.photos.pending_over_24h} · 기간 승인 {m.photos.approved} / 반려 {m.photos.rejected}
          </p>
          {Object.keys(m.photos.reject_codes).length > 0 ? (
            <p className="text-caption text-muted-foreground">
              반려 코드: {Object.entries(m.photos.reject_codes).map(([k, v]) => `${k} ${v}`).join(" · ")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
