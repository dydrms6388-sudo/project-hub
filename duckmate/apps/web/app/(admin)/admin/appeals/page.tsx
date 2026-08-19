// D8 · /admin/appeals — 이의제기 큐 (F-SAF-07)
// 접수 오래된 순 = 기한(접수 +7일) 초과분이 자연히 최상단. 4-eyes: 원 제재 처리자는
// 자기 건을 처리할 수 없다 — 해당 행은 폼 대신 "다른 어드민 배정" 안내를 띄운다.
// (화면 차단은 안내이고, 실제 경계는 decideAppeal 안의 세션 검증이다.)

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Textarea,
} from "@duckmate/ui";
import { APPEAL_SLA_DAYS, listAppeals } from "@/lib/admin/appeals";
import { SANCTION_LEVEL_INFO, formatRemaining } from "@/lib/admin/service";
import { Flash, flashFrom } from "../_components/flash";
import { decideAppealAction } from "./actions";

export const dynamic = "force-dynamic";

const KST = { timeZone: "Asia/Seoul" } as const;

export default async function AppealsQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const scope = one(sp.scope) === "all" ? "all" : "pending";

  const res = await listAppeals(scope);
  if (!res.ok) return <p className="text-body text-danger">{res.message}</p>;
  const rows = res.data;
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h1">이의제기</h1>
        <p className="text-caption text-ink-muted">
          처리 기한 {APPEAL_SLA_DAYS}일 · 대기 {rows.length}건
          {overdueCount > 0 ? ` · 기한 초과 ${overdueCount}건` : ""}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          범위
          <Select name="scope" defaultValue={scope}>
            <option value="pending">미처리만</option>
            <option value="all">전체</option>
          </Select>
        </label>
        <Button type="submit" variant="ghost" size="md">
          필터 적용
        </Button>
      </form>

      <p className="rounded-md border border-line bg-surface-raised p-3 text-caption text-ink-muted">
        4-eyes 원칙(A5 §3.3): 원 제재를 확정한 어드민은 그 건의 이의제기를 처리할 수 없습니다.
        인용 시 제재가 즉시 해제되고, 영구정지였다면 계정 복구 + CI 해시 블랙리스트가 회수됩니다.
        기각 사유는 신청자 통보 문안의 원천이므로 그대로 읽힐 문장으로 작성하세요.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface-raised p-6 text-body text-ink-muted">
          처리할 이의제기가 없어요.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ appeal, sanction, nickname, dueAt, overdue, fourEyesBlockedForMe }) => {
            const pending = appeal.status === "PENDING";
            return (
              <Card key={appeal.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {appeal.profile_id ? (
                      <Link href={`/admin/users/${appeal.profile_id}`} className="underline">
                        {nickname ?? "(닉네임 없음)"}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">탈퇴/없음</span>
                    )}
                    {sanction ? (
                      <Badge variant={sanction.level >= 4 ? "danger" : "warning"}>
                        Lv{sanction.level} {SANCTION_LEVEL_INFO[sanction.level].label}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">제재 정보 없음</Badge>
                    )}
                    <Badge variant={pending ? "brand" : "neutral"}>{appeal.status}</Badge>
                    {overdue ? <Badge variant="danger">기한 초과</Badge> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-body-sm">
                  <p className="text-caption text-ink-muted">
                    접수 {new Date(appeal.created_at).toLocaleString("ko-KR", KST)} · 기한{" "}
                    <span className={overdue ? "text-danger" : undefined}>
                      {new Date(dueAt).toLocaleString("ko-KR", KST)} ({formatRemaining(dueAt)})
                    </span>
                  </p>

                  <div className="rounded-md bg-surface p-3">
                    <p className="mb-1 text-caption text-ink-muted">이의 신청 내용</p>
                    <p className="whitespace-pre-wrap">{appeal.body}</p>
                  </div>

                  {sanction ? (
                    <p className="text-caption text-ink-muted">
                      원 제재 사유: {sanction.reason} · 상태 {sanction.status} · 기간{" "}
                      {new Date(sanction.starts_at).toLocaleString("ko-KR", KST)} ~{" "}
                      {sanction.ends_at
                        ? new Date(sanction.ends_at).toLocaleString("ko-KR", KST)
                        : "영구"}
                      {sanction.report_id ? (
                        <>
                          {" · "}
                          <Link href={`/admin/reports/${sanction.report_id}`} className="underline">
                            원 신고 보기
                          </Link>
                        </>
                      ) : (
                        " · (수동 부과)"
                      )}
                    </p>
                  ) : null}

                  {!pending ? (
                    <p className="rounded-md border border-line p-3 text-caption text-ink-muted">
                      처리 완료 —{" "}
                      {appeal.decided_at
                        ? new Date(appeal.decided_at).toLocaleString("ko-KR", KST)
                        : "—"}
                      {appeal.decided_reason ? ` · 사유: ${appeal.decided_reason}` : ""}
                    </p>
                  ) : fourEyesBlockedForMe ? (
                    <p
                      role="note"
                      className="rounded-md border border-line bg-warning-tint p-3 text-caption text-warning"
                    >
                      4-eyes 제한: 이 제재를 확정한 어드민이 본인이라 처리할 수 없어요. 다른 어드민에게
                      배정해 주세요.
                    </p>
                  ) : (
                    <form
                      action={decideAppealAction}
                      className="flex max-w-xl flex-col gap-3 border-t border-line pt-3"
                    >
                      <input type="hidden" name="appealId" value={appeal.id} />
                      <label className="flex flex-col gap-1 text-caption text-ink-muted">
                        결정 사유 (필수 — 기각 시 신청자에게 그대로 통보)
                        <Textarea
                          name="reason"
                          required
                          rows={3}
                          placeholder="재검토 결과와 판단 근거를 기록"
                        />
                      </label>
                      <div className="flex items-center gap-3">
                        <Button type="submit" name="decision" value="ACCEPTED" variant="primary" size="md">
                          인용 (제재 해제)
                        </Button>
                        <Button type="submit" name="decision" value="REJECTED" variant="ghost" size="sm">
                          기각
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
