// D8 · /admin/users/[userId] — 유저 상세 (프로필·제재 이력·신고 이력·감사로그)
//                              + 수동 제재 부과 / 제재 해제 폼
// [userId] = profiles.id (auth user_id 아님 — 12_flows §0 라우트 표기 그대로).
// 제재 규칙은 신고 처리(resolveReport)와 동일: Lv5 는 부승인 어드민 닉네임(4-eyes)
// 검증 후에만 확정되고 계정 정지 + CI 해시 블랙리스트가 함께 적용된다.

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
import type { SanctionLevel } from "@duckmate/db";
import type { VerifyLevel } from "@duckmate/ui";
import { getUserDetail } from "@/lib/admin/users";
import { SANCTION_LEVEL_INFO } from "@/lib/admin/service";
import { Flash, flashFrom } from "../../_components/flash";
import { imposeSanctionAction, revokeSanctionAction } from "../actions";

export const dynamic = "force-dynamic";

const KST = { timeZone: "Asia/Seoul" } as const;

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ko-KR", KST) : "—";
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await params;
  const sp = await searchParams;

  const res = await getUserDetail(userId);
  if (!res.ok) {
    return (
      <div>
        <p className="text-body text-danger">{res.message}</p>
        <Link href="/admin/users" className="text-body-sm underline">
          유저 검색으로 돌아가기
        </Link>
      </div>
    );
  }
  const { profile, email, sanctions, reportsAgainst, reportsFiledCount, photos, recentAuditLogs } =
    res.data;
  const activeSanctions = sanctions.filter((s) => s.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="text-body-sm text-ink-muted underline">
          ← 유저 검색
        </Link>
        <h1 className="text-h2">{profile.nickname}</h1>
        <VerifyLevelBadge level={profile.verify_level as VerifyLevel} compact />
        <Badge variant={profile.status === "active" ? "success" : profile.status === "paused" ? "warning" : "danger"}>
          {profile.status}
        </Badge>
        {profile.role === "admin" ? <Badge variant="brand">admin</Badge> : null}
        {activeSanctions.length > 0 ? (
          <Badge variant="danger">활성 제재 {activeSanctions.length}건</Badge>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 프로필 */}
        <Card>
          <CardHeader>
            <CardTitle>프로필</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-body-sm">
            <p>
              profile id: <span className="font-mono text-caption">{profile.id}</span>
            </p>
            <p>이메일: {email ?? "— (조회 실패 또는 미보유)"}</p>
            <p>
              생년월일 {profile.birth_date} · {profile.gender} · 지역 {profile.region_code}
            </p>
            <p>
              모드 {profile.mode === "dating" ? "연애" : "친구"} · 온보딩 {profile.onboarding_step}
            </p>
            <p className="text-ink-muted">
              가입 {fmt(profile.created_at)} · 최근 활동 {fmt(profile.last_active_at)}
            </p>
            <p className="text-ink-muted">
              사진 {photos.length}장 (승인 {photos.filter((p) => p.review_status === "approved").length} ·
              대기 {photos.filter((p) => p.review_status === "pending").length} · 반려{" "}
              {photos.filter((p) => p.review_status === "rejected").length})
            </p>
            <p className="text-caption text-ink-muted">
              프로필 사진 원본은 검수 큐(/admin/photos)에서만 열람합니다 — 이 화면은 메타만 표시.
            </p>
          </CardContent>
        </Card>

        {/* 신고 이력 */}
        <Card>
          <CardHeader>
            <CardTitle>신고 이력</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-body-sm">
            <p className="text-ink-muted">
              피신고 {reportsAgainst.length}건 · 이 유저가 제기한 신고 {reportsFiledCount}건
              {reportsFiledCount >= 10 ? " — 무고성 신고 감시 대상 (A5 §6)" : ""}
            </p>
            {reportsAgainst.length === 0 ? (
              <p className="text-ink-muted">피신고 이력 없음</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {reportsAgainst.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={r.priority === "P0" ? "danger" : r.priority === "P1" ? "warning" : "neutral"}>
                      {r.priority ?? "—"}
                    </Badge>
                    <span className="font-mono text-caption">{r.reason_code}</span>
                    <Badge variant="neutral">{r.status}</Badge>
                    <span className="text-caption text-ink-muted">{fmt(r.created_at)}</span>
                    <Link href={`/admin/reports/${r.id}`} className="text-caption underline">
                      상세
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 제재 이력 + 해제 */}
      <Card>
        <CardHeader>
          <CardTitle>제재 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {sanctions.length === 0 ? (
            <p className="text-body-sm text-ink-muted">제재 이력 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-line text-left text-caption text-ink-muted">
                    <th className="px-3 py-2 font-medium">레벨</th>
                    <th className="px-3 py-2 font-medium">상태</th>
                    <th className="px-3 py-2 font-medium">사유</th>
                    <th className="px-3 py-2 font-medium">기간</th>
                    <th className="px-3 py-2 font-medium">이의</th>
                    <th className="px-3 py-2 font-medium">해제</th>
                  </tr>
                </thead>
                <tbody>
                  {sanctions.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top last:border-b-0">
                      <td className="px-3 py-2">
                        Lv{s.level}
                        <span className="block text-caption text-ink-muted">
                          {SANCTION_LEVEL_INFO[s.level].label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={s.status === "ACTIVE" ? "danger" : "neutral"}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {s.reason}
                        {s.report_id ? (
                          <Link
                            href={`/admin/reports/${s.report_id}`}
                            className="ml-2 text-caption underline"
                          >
                            원 신고
                          </Link>
                        ) : (
                          <span className="ml-2 text-caption text-ink-muted">(수동 부과)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-caption text-ink-muted">
                        {fmt(s.starts_at)}
                        <br />~ {s.ends_at ? fmt(s.ends_at) : "영구"}
                      </td>
                      <td className="px-3 py-2 text-caption text-ink-muted">{s.appeal_status}</td>
                      <td className="px-3 py-2">
                        {s.status === "ACTIVE" ? (
                          <form action={revokeSanctionAction} className="flex flex-col gap-1">
                            <input type="hidden" name="profileId" value={profile.id} />
                            <input type="hidden" name="sanctionId" value={s.id} />
                            <Input name="revokeReason" required placeholder="해제 사유(필수)" />
                            <Button type="submit" variant="ghost" size="sm">
                              해제
                            </Button>
                          </form>
                        ) : (
                          <span className="text-caption text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 수동 제재 부과 */}
      <Card>
        <CardHeader>
          <CardTitle>수동 제재 부과</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={imposeSanctionAction} className="flex max-w-xl flex-col gap-3">
            <input type="hidden" name="profileId" value={profile.id} />
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              제재 레벨
              <Select name="level" defaultValue="" required>
                <option value="">선택</option>
                {([1, 2, 3, 4, 5] as SanctionLevel[]).map((lv) => (
                  <option key={lv} value={lv}>
                    Lv{lv} — {SANCTION_LEVEL_INFO[lv].label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              제재 사유 (필수 — 통보·이의제기의 근거)
              <Textarea name="reason" required rows={3} placeholder="위반 조항·판단 근거를 기록" />
            </label>
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              부승인 어드민 닉네임 (Lv5 영구정지에만 필수 — 2인 승인)
              <Input name="coApproverNickname" placeholder="레벨 5가 아니면 비워두세요" />
            </label>
            <Button type="submit" variant="danger" size="lg">
              제재 부과
            </Button>
            <p className="text-caption text-ink-muted">
              신고 없이 부과하는 제재입니다(report_id 없음). 신고 건 처리는 신고 상세 화면에서 하세요 —
              그래야 신고와 제재가 연결되고 통보 문안이 생성됩니다. Lv5 확정 시 계정 영구정지 + CI 해시
              블랙리스트 등록.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* 감사로그 */}
      <Card>
        <CardHeader>
          <CardTitle>이 유저 대상 감사로그 (최근 20건)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAuditLogs.length === 0 ? (
            <p className="text-body-sm text-ink-muted">기록 없음</p>
          ) : (
            <ul className="flex flex-col gap-1 text-body-sm">
              {recentAuditLogs.map((log) => (
                <li key={String(log.id)} className="flex flex-wrap items-center gap-2">
                  <span className="text-caption text-ink-muted">{fmt(log.created_at)}</span>
                  <span className="font-mono text-caption">{log.action}</span>
                  <span className="text-caption text-ink-muted">actor {log.actor_id ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-caption text-ink-muted">
            target=&quot;profile:{profile.id}&quot; 로 기록된 항목만 표시됩니다 (사진·신고 대상 로그는
            각 큐에서 확인).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
