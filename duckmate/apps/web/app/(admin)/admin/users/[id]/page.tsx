import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@duckmate/ui";
import { SANCTION_LEVELS } from "@duckmate/db";
import { requireAdminPage } from "@/lib/admin/auth";
import { getUserDetail, isUuid } from "@/lib/admin/queries";
import { APPEAL_STATUS_LABELS, PROFILE_STATUS_LABELS, REPORT_STATUS_LABELS } from "@/lib/admin/constants";
import { fmtDateTime, shortId } from "@/lib/admin/format";
import { DecideAppealButtons, ForceLogoutButton, HideToggleButton, IssueSanctionButton, LiftSanctionButton, ScheduleDeleteButton } from "../../../_components/UserActions";

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-h3">
        {title} {count !== undefined ? <span className="tnum text-body-sm text-muted-foreground">({count})</span> : null}
      </h2>
      {children}
    </section>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminPage("moderator");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getUserDetail(ctx.admin, id);
  if (!d) notFound();
  const p = d.profile;
  const isSelf = p.user_id === ctx.user.id;
  const activeSanctions = d.sanctions.filter((s) => !s.revoked_at && (!s.ends_at || new Date(s.ends_at) > new Date()));
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="text-body-sm text-muted-foreground hover:underline">
          ← 검색
        </Link>
        <h1 className="text-h1">{p.nickname ?? "(닉네임 없음)"}</h1>
        <Badge variant="outline">L{p.verify_level}</Badge>
        <Badge variant={p.status === "active" ? "success" : "danger"}>{PROFILE_STATUS_LABELS[p.status]}</Badge>
        <Badge variant="outline">{p.mode}</Badge>
        {d.activeSanctionLevel > 0 ? <Badge variant="danger">활성 제재 L{d.activeSanctionLevel}</Badge> : null}
        {p.hidden_at ? <Badge variant="warning">비노출 {p.hidden_reason ?? ""}</Badge> : null}
        {d.adminRole ? <Badge variant="primary">{d.adminRole}</Badge> : null}
        {d.authUser?.app_role && d.authUser.app_role !== d.adminRole ? <Badge variant="danger">JWT role 불일치: {d.authUser.app_role}</Badge> : null}
        {isSelf ? <Badge variant="muted">본인</Badge> : null}
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <IssueSanctionButton role={ctx.role} profileId={p.id} isSelf={isSelf} />
        <HideToggleButton profileId={p.id} hidden={!!p.hidden_at} />
        <ForceLogoutButton role={ctx.role} userId={p.user_id} isSelf={isSelf} />
        <ScheduleDeleteButton role={ctx.role} profileId={p.id} status={p.status} isSelf={isSelf} />
        <span className="text-caption text-muted-foreground">모든 액션: 확인 모달 + 사유 필수 + audit_logs</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="프로필">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-body-sm">
            <dt className="text-muted-foreground">profile_id</dt><dd className="tnum">{p.id}</dd>
            <dt className="text-muted-foreground">user_id</dt><dd className="tnum">{p.user_id}</dd>
            <dt className="text-muted-foreground">성별 / 찾는</dt><dd>{p.gender ?? "?"} / {p.seeking_gender ?? "—"}</dd>
            <dt className="text-muted-foreground">출생연도</dt><dd className="tnum">{p.birth_year ?? "—"} (생년월일 원문은 미표시)</dd>
            <dt className="text-muted-foreground">지역</dt><dd>{p.region_code ?? "—"}</dd>
            <dt className="text-muted-foreground">소개</dt><dd className="whitespace-pre-wrap">{p.bio ?? "—"}</dd>
            <dt className="text-muted-foreground">요즘 빠진 것</dt><dd>{p.now_into ?? "—"}</dd>
            <dt className="text-muted-foreground">온보딩</dt><dd>{p.onboarding_step} · 완료 {fmtDateTime(p.onboarding_completed_at)}</dd>
            <dt className="text-muted-foreground">가입 / 활동</dt><dd className="tnum">{fmtDateTime(p.created_at)} / {fmtDateTime(p.last_active_at)}</dd>
            <dt className="text-muted-foreground">매칭 수</dt><dd className="tnum">{d.matchCount}</dd>
            <dt className="text-muted-foreground">삭제 예약</dt><dd className="tnum">{fmtDateTime(p.delete_requested_at)}</dd>
            <dt className="text-muted-foreground">phone_hash</dt><dd className="tnum text-caption">{p.phone_hash ? `${p.phone_hash.slice(0, 12)}…` : "—"}</dd>
          </dl>
        </Section>
        <Section title="Auth · 인증 이력" count={d.identity.length}>
          {d.authUser ? (
            <div className="tnum mb-2 text-body-sm">
              phone 확인 {fmtDateTime(d.authUser.phone_confirmed_at)} · 마지막 로그인 {fmtDateTime(d.authUser.last_sign_in_at)}
              {d.authUser.banned_until && new Date(d.authUser.banned_until) > new Date() ? <Badge variant="danger" size="sm" className="ml-2">banned_until {fmtDateTime(d.authUser.banned_until)}</Badge> : null}
            </div>
          ) : (
            <p className="mb-2 text-body-sm text-muted-foreground">Auth 사용자 조회 실패(로컬/권한)</p>
          )}
          <ul className="flex flex-col gap-1 text-body-sm">
            {d.identity.map((iv) => (
              <li key={iv.id} className="tnum">
                {iv.provider} · <Badge variant={iv.result === "success" ? "success" : "danger"} size="sm">{iv.result}</Badge> · {iv.is_active ? "active" : "inactive"} · 생년 일치 {iv.birth_date_verified === null ? "?" : iv.birth_date_verified ? "O" : "X"} · {fmtDateTime(iv.created_at)}
              </li>
            ))}
            {d.identity.length === 0 ? <li className="text-muted-foreground">없음 (CI/DI 해시는 표시하지 않음)</li> : null}
          </ul>
        </Section>
        <Section title="사진" count={d.photos.length}>
          <div className="flex flex-wrap gap-2">
            {d.photos.map((ph) => (
              <figure key={ph.id} className="w-28">
                {ph.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ph.url} alt={`사진 ${shortId(ph.id)}`} loading="lazy" decoding="async" className="aspect-square w-28 rounded-md border border-border object-cover" />
                ) : (
                  <div className="flex aspect-square w-28 items-center justify-center rounded-md border border-dashed border-border text-caption text-muted-foreground">없음</div>
                )}
                <figcaption className="text-caption text-muted-foreground">
                  {ph.is_primary ? "대표 · " : ""}
                  {ph.review_status}
                  {ph.reject_code ? ` (${ph.reject_code})` : ""}
                </figcaption>
              </figure>
            ))}
            {d.photos.length === 0 ? <p className="text-body-sm text-muted-foreground">없음</p> : null}
          </div>
          {d.photos.some((x) => x.review_status === "pending" || x.review_status === "held") ? (
            <Link href="/admin/photos" className="mt-2 inline-block text-body-sm text-primary hover:underline">
              검수 큐에서 처리 →
            </Link>
          ) : null}
        </Section>
        <Section title="제재" count={d.sanctions.length}>
          <ul className="flex flex-col gap-1 text-body-sm">
            {d.sanctions.map((s) => {
              const active = activeSanctions.some((a) => a.id === s.id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="tnum">
                    <Badge variant={active ? "danger" : "muted"} size="sm">L{s.level}</Badge> {SANCTION_LEVELS[s.level].label} · {s.reason.slice(0, 60)} · {fmtDateTime(s.starts_at)}~{s.ends_at ? fmtDateTime(s.ends_at) : "영구"}
                    {s.revoked_at ? ` · 해제 ${fmtDateTime(s.revoked_at)}` : ""}
                    {s.report_id ? (
                      <Link href={`/admin/reports/${s.report_id}`} className="ml-1 text-primary hover:underline">
                        신고
                      </Link>
                    ) : null}
                  </span>
                  {active ? <LiftSanctionButton role={ctx.role} sanctionId={s.id} level={s.level} /> : null}
                </li>
              );
            })}
            {d.sanctions.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
        </Section>
        <Section title="이의신청" count={d.appeals.length}>
          <ul className="flex flex-col gap-2 text-body-sm">
            {d.appeals.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="tnum">
                    <Badge variant={a.status === "pending" ? "warning" : a.status === "accepted" ? "success" : "muted"} size="sm">{APPEAL_STATUS_LABELS[a.status]}</Badge> 제재 L{a.sanction_level ?? "?"} · {fmtDateTime(a.created_at)} · 72h 내 판정
                  </span>
                  {a.status === "pending" ? <DecideAppealButtons role={ctx.role} appealId={a.id} /> : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
                {a.decision_note ? <p className="text-caption text-muted-foreground">판정: {a.decision_note}</p> : null}
              </li>
            ))}
            {d.appeals.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
        </Section>
        <Section title="신고 (받음)" count={d.reportsReceived.length}>
          <ul className="flex flex-col gap-1 text-body-sm">
            {d.reportsReceived.map((r) => (
              <li key={r.id} className="tnum">
                <Link href={`/admin/reports/${r.id}`} className="text-primary hover:underline">
                  {r.priority} {r.reason_code}
                </Link>{" "}
                · {REPORT_STATUS_LABELS[r.status]} · {fmtDateTime(r.created_at)}
              </li>
            ))}
            {d.reportsReceived.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
        </Section>
        <Section title="신고 (보냄)" count={d.reportsSent.length}>
          <ul className="flex flex-col gap-1 text-body-sm">
            {d.reportsSent.map((r) => (
              <li key={r.id} className="tnum">
                <Link href={`/admin/reports/${r.id}`} className="text-primary hover:underline">
                  {r.priority} {r.reason_code}
                </Link>{" "}
                → {r.target_id ? shortId(r.target_id) : "?"} · {REPORT_STATUS_LABELS[r.status]} · {fmtDateTime(r.created_at)}
              </li>
            ))}
            {d.reportsSent.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
        </Section>
        <Section title="차단">
          <p className="tnum text-body-sm">
            차단함 {d.blocksGiven.length} · 차단당함 {d.blocksReceived.length}
            {d.blocksGiven.length >= 50 ? <Badge variant="warning" size="sm" className="ml-2">이상 행동 플래그(24h 50건 검토)</Badge> : null}
          </p>
        </Section>
        <Section title="동의 이력" count={d.consents.length}>
          <ul className="flex flex-col gap-0.5 text-caption">
            {d.consents.map((c) => (
              <li key={c.id} className="tnum">
                {c.key}
                {c.document_key ? `(${c.document_key})` : ""} v{c.version} · {c.agreed ? "동의" : "철회"} · {c.source} · {fmtDateTime(c.agreed_at)}
              </li>
            ))}
            {d.consents.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
        </Section>
        <Section title="최근 활동 (audit_logs)" count={d.recentAudit.length}>
          <ul className="flex flex-col gap-0.5 text-caption">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="tnum">
                {fmtDateTime(a.created_at)} · {a.action} · {a.actor_role ?? "?"} {a.actor_id ? shortId(a.actor_id) : ""}
              </li>
            ))}
            {d.recentAudit.length === 0 ? <li className="text-muted-foreground">없음</li> : null}
          </ul>
          {ctx.role === "admin" ? (
            <Link href={`/admin/audit?target=${p.id}`} className="mt-1 inline-block text-body-sm text-primary hover:underline">
              전체 감사로그 →
            </Link>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
