// D8 · /admin/reports/[reportId] — 신고 상세 (evidence 스냅샷 열람) + 조치 폼
// evidence 는 service role 서버 프록시로만 열람하며, 열람 사실이 audit_logs 에
// 남는다 (lib/admin/reports.getReportDetail). 원문(body)은 이 화면에서만 노출.

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
  VerifyLevelBadge,
} from "@duckmate/ui";
import { getReportDetail } from "@/lib/admin/reports";
import { SANCTION_LEVEL_INFO, formatRemaining } from "@/lib/admin/service";
import type { SanctionLevel } from "@duckmate/db";
import { Flash, flashFrom } from "../../_components/flash";
import { resolveReportAction } from "../actions";

export const dynamic = "force-dynamic";

interface EvidenceMessage {
  id?: number;
  sender_id?: string;
  body?: string;
  image_path?: string | null;
  created_at?: string;
}

interface EvidenceShape {
  snapshot_at?: string;
  match_id?: string;
  window?: { from?: string; to?: string };
  messages?: EvidenceMessage[];
  images_copied?: string[];
  flags?: unknown[];
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reportId } = await params;
  const sp = await searchParams;

  const res = await getReportDetail(reportId);
  if (!res.ok) {
    return (
      <div>
        <p className="text-body text-danger">{res.message}</p>
        <Link href="/admin/reports" className="text-body-sm underline">
          큐로 돌아가기
        </Link>
      </div>
    );
  }
  const { report, target, targetSanctions, targetReportCount30d } = res.data;
  const evidence = (report.evidence ?? null) as EvidenceShape | null;
  const isOpen = ["RECEIVED", "AUTO_TRIAGED", "IN_REVIEW"].includes(report.status);

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex items-center gap-3">
        <Link href="/admin/reports" className="text-body-sm text-ink-muted underline">
          ← 신고 큐
        </Link>
        <h1 className="text-h2">신고 상세</h1>
        <Badge variant={report.priority === "P0" ? "danger" : report.priority === "P1" ? "warning" : "neutral"}>
          {report.priority ?? "—"}
        </Badge>
        <Badge variant="neutral">{report.status}</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 신고 내용 */}
        <Card>
          <CardHeader>
            <CardTitle>신고 내용</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-body-sm">
            <p>
              사유 코드: <span className="font-mono">{report.reason_code}</span>
            </p>
            <p>
              접수: {new Date(report.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · SLA{" "}
              <span className={report.sla_due_at && new Date(report.sla_due_at) < new Date() ? "text-danger" : ""}>
                {formatRemaining(report.sla_due_at)}
              </span>
            </p>
            {report.detail ? (
              <p className="rounded-md bg-surface p-3">{report.detail}</p>
            ) : (
              <p className="text-ink-muted">상세 설명 없음</p>
            )}
            <p className="text-caption text-ink-muted">
              신고자 정보는 피신고자에게 익명 — 통보 문안에 포함 금지 (A5 §6).
            </p>
          </CardContent>
        </Card>

        {/* 대상 요약 */}
        <Card>
          <CardHeader>
            <CardTitle>피신고자</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-body-sm">
            {target ? (
              <>
                <p className="flex items-center gap-2">
                  <Link href={`/admin/users/${target.id}`} className="underline">
                    {target.nickname}
                  </Link>
                  <VerifyLevelBadge level={target.verify_level} compact />
                  <Badge variant={target.status === "active" ? "success" : "danger"}>{target.status}</Badge>
                </p>
                <p className="text-ink-muted">
                  최근 30일 신고 누적 {targetReportCount30d}건
                  {targetReportCount30d >= 3 ? " — AUTO_3REPORTS 임계 (자동 기능제한 대상)" : ""}
                </p>
                <p className="text-ink-muted">제재 이력 {targetSanctions.length}건:</p>
                <ul className="flex flex-col gap-1">
                  {targetSanctions.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <Badge variant={s.status === "ACTIVE" ? "danger" : "neutral"}>
                        Lv{s.level} {s.status}
                      </Badge>
                      <span className="text-caption text-ink-muted">{s.reason}</span>
                    </li>
                  ))}
                  {targetSanctions.length === 0 ? (
                    <li className="text-caption text-ink-muted">제재 이력 없음</li>
                  ) : null}
                </ul>
              </>
            ) : (
              <p className="text-ink-muted">대상 프로필 없음 (탈퇴 등) — 제재 부과 불가, 기각으로 종결</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 증거 스냅샷 (원문 — service role 전용 열람, 열람 audit 기록됨) */}
      <Card>
        <CardHeader>
          <CardTitle>증거 스냅샷 (원문)</CardTitle>
        </CardHeader>
        <CardContent>
          {!evidence ? (
            <p className="text-body-sm text-ink-muted">
              스냅샷 없음 — 프로필 단독 신고이거나 스냅샷 생성 실패 (D5 접수 파이프라인 확인).
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-body-sm">
              <p className="text-caption text-ink-muted">
                스냅샷 {evidence.snapshot_at ?? "—"} · 범위 {evidence.window?.from ?? "—"} ~{" "}
                {evidence.window?.to ?? "—"} · 메시지 {evidence.messages?.length ?? 0}개 · 이미지 사본{" "}
                {evidence.images_copied?.length ?? 0}개 · 자동 탐지 히트 {evidence.flags?.length ?? 0}건
              </p>
              <div className="max-h-96 overflow-y-auto rounded-md border border-line bg-surface p-3">
                {(evidence.messages ?? []).length === 0 ? (
                  <p className="text-ink-muted">메시지 없음</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(evidence.messages ?? []).map((msg, i) => {
                      const fromTarget = msg.sender_id === report.target_id;
                      return (
                        <li key={msg.id ?? i} className="flex flex-col">
                          <span className={`text-caption ${fromTarget ? "text-danger" : "text-ink-muted"}`}>
                            {fromTarget ? "피신고자" : "신고자"} ·{" "}
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
                              : "—"}
                          </span>
                          <span>{msg.body ?? ""}</span>
                          {msg.image_path ? (
                            <span className="text-caption text-ink-muted">[이미지: {msg.image_path}]</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <p className="text-caption text-ink-muted">
                이 원문은 신고 처리·이의제기·법적 대응 목적 외 이용 금지 (A5 §4.1). 열람은 감사로그에 기록됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 조치 폼 */}
      {isOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>조치 확정</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={resolveReportAction} className="flex max-w-xl flex-col gap-3">
              <input type="hidden" name="reportId" value={report.id} />
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                제재 레벨 (제재 부과 시)
                <Select name="sanctionLevel" defaultValue="">
                  <option value="">선택</option>
                  {([1, 2, 3, 4, 5] as SanctionLevel[]).map((lv) => (
                    <option key={lv} value={lv}>
                      Lv{lv} — {SANCTION_LEVEL_INFO[lv].label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                처리 사유 (필수 — 통보·이의제기의 근거)
                <Textarea name="reason" required rows={3} placeholder="위반 조항·판단 근거를 기록" />
              </label>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                부승인 어드민 닉네임 (Lv5 영구정지에만 필수 — 2인 승인)
                <Input name="coApproverNickname" placeholder="레벨 5가 아니면 비워두세요" />
              </label>
              <div className="flex items-center gap-3">
                <Button type="submit" name="decision" value="sanction" variant="danger" size="lg">
                  제재 부과 + 종결
                </Button>
                <Button type="submit" name="decision" value="dismiss" variant="ghost" size="md">
                  기각 (DISMISSED)
                </Button>
              </div>
              <p className="text-caption text-ink-muted">
                Lv5 는 부승인 어드민 검증 후에만 확정됩니다. 확정 시 계정 영구정지 + CI 해시 블랙리스트 등록.
                통보(NOTIFIED)는 알림 파이프라인(D7)이 수행합니다.
              </p>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-line bg-surface-raised p-4 text-body-sm text-ink-muted">
          종결된 신고예요 (처리 {report.handled_at ? new Date(report.handled_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—"}).
        </p>
      )}
    </div>
  );
}
