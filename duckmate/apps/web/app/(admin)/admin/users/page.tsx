// D8 · /admin/users — 유저 검색 (F-ADM-03)
// 검색은 GET 폼(?q=) — 조회 조건이 URL 에 남아 케이스 공유·재방문이 가능하다.
// "@" 포함 시 이메일 검색(GoTrue 스캔), 그 외 닉네임 부분일치. 목록에는
// 이메일을 싣지 않는다(개인정보 최소 노출 — 상세에서만 조회).

import Link from "next/link";
import { Badge, Button, Input, VerifyLevelBadge } from "@duckmate/ui";
import type { VerifyLevel } from "@duckmate/ui";
import type { ProfileStatus } from "@duckmate/db";
import { searchUsers } from "@/lib/admin/users";
import { Flash, flashFrom } from "../_components/flash";

export const dynamic = "force-dynamic";

function statusBadge(status: ProfileStatus) {
  if (status === "active") return <Badge variant="success">활성</Badge>;
  if (status === "paused") return <Badge variant="warning">휴면</Badge>;
  return <Badge variant="danger">정지</Badge>;
}

export default async function UserSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim();

  const res = q ? await searchUsers(q) : null;

  return (
    <div className="flex flex-col gap-4">
      <Flash {...flashFrom(sp)} />
      <header className="flex items-center justify-between">
        <h1 className="text-h1">유저 관리</h1>
        <p className="text-caption text-ink-muted">
          닉네임 부분일치 · &quot;@&quot; 포함 시 이메일 검색 (최대 20건)
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-col gap-1 text-caption text-ink-muted">
          검색어 (2자 이상)
          <Input name="q" defaultValue={q} placeholder="닉네임 또는 이메일" />
        </label>
        <Button type="submit" variant="ghost" size="md">
          검색
        </Button>
      </form>

      <p className="text-caption text-ink-muted">
        유저 조회·제재는 신고/이의제기 처리 목적 외 이용을 금지합니다 (A5 §4.1). 상세 화면 열람과
        모든 제재 조치는 감사로그에 남습니다.
      </p>

      {res === null ? (
        <p className="rounded-md border border-line bg-surface-raised p-6 text-body text-ink-muted">
          검색어를 입력하면 결과가 표시돼요.
        </p>
      ) : !res.ok ? (
        <p className="text-body text-danger">{res.message}</p>
      ) : res.data.length === 0 ? (
        <p className="rounded-md border border-line bg-surface-raised p-6 text-body text-ink-muted">
          일치하는 유저가 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface-raised">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-ink-muted">
                <th className="px-3 py-2 font-medium">닉네임</th>
                <th className="px-3 py-2 font-medium">이메일</th>
                <th className="px-3 py-2 font-medium">인증</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">모드</th>
                <th className="px-3 py-2 font-medium">권한</th>
                <th className="px-3 py-2 font-medium">가입</th>
                <th className="px-3 py-2 font-medium" aria-label="상세" />
              </tr>
            </thead>
            <tbody>
              {res.data.map((u) => (
                <tr key={u.profileId} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2">{u.nickname}</td>
                  <td className="px-3 py-2 text-ink-muted">{u.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <VerifyLevelBadge level={u.verifyLevel as VerifyLevel} compact />
                  </td>
                  <td className="px-3 py-2">{statusBadge(u.status)}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {u.mode === "dating" ? "연애" : "친구"}
                  </td>
                  <td className="px-3 py-2">
                    {u.role === "admin" ? <Badge variant="brand">admin</Badge> : <span className="text-ink-muted">user</span>}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">
                    {new Date(u.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.profileId}`} className="text-accent-text underline">
                      상세·제재
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
