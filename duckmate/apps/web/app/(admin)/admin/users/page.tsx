import Link from "next/link";
import { Badge } from "@duckmate/ui";
import { requireAdminPage } from "@/lib/admin/auth";
import { detectSearchKind, searchUsers } from "@/lib/admin/queries";
import { PROFILE_STATUS_LABELS } from "@/lib/admin/constants";
import { fmtDateTime, shortId } from "@/lib/admin/format";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdminPage("moderator");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const kindParam = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = detectSearchKind(q, kindParam);
  const results = q ? await searchUsers(ctx.admin, q, kind) : [];
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-h1">유저 검색</h1>
        <p className="text-body-sm text-muted-foreground">닉네임(부분 일치) / 전화번호·전화 해시(sha256, 원문은 저장·기록하지 않음) / 프로필 ID / auth user ID. 자동 판별.</p>
      </header>
      <form method="get" className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="닉네임 · 010-… · 64hex · uuid" className="h-12 flex-1 rounded-md border border-input bg-card px-4 text-body" autoFocus />
        <select name="kind" defaultValue={kindParam ?? ""} className="h-12 rounded-md border border-input bg-card px-3 text-body-sm" aria-label="검색 종류">
          <option value="">자동</option>
          <option value="nickname">닉네임</option>
          <option value="phone_hash">전화/해시</option>
          <option value="profile_id">프로필 ID</option>
          <option value="user_id">auth user ID</option>
        </select>
        <button type="submit" className="h-12 rounded-md bg-primary px-5 text-button text-primary-foreground">
          검색
        </button>
      </form>
      {q ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-body-sm">
            <thead className="bg-muted text-left text-caption text-muted-foreground">
              <tr>
                <th className="px-3 py-2">닉네임</th>
                <th className="px-3 py-2">레벨</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">모드/성별</th>
                <th className="px-3 py-2">제재</th>
                <th className="px-3 py-2">온보딩</th>
                <th className="px-3 py-2">최근 활동</th>
                <th className="px-3 py-2">가입</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    결과 없음 ({kind})
                  </td>
                </tr>
              ) : (
                results.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/users/${u.id}`} className="text-primary underline-offset-4 hover:underline">
                        {u.nickname ?? "(닉네임 없음)"}
                      </Link>
                      <div className="tnum text-caption text-muted-foreground">{shortId(u.id)}</div>
                    </td>
                    <td className="px-3 py-2">L{u.verify_level}</td>
                    <td className="px-3 py-2">
                      {PROFILE_STATUS_LABELS[u.status]}
                      {u.hidden_at ? <Badge variant="warning" size="sm" className="ml-1">비노출</Badge> : null}
                    </td>
                    <td className="px-3 py-2">
                      {u.mode} / {u.gender ?? "?"}
                    </td>
                    <td className="px-3 py-2">{u.active_sanction_level > 0 ? <Badge variant="danger" size="sm">L{u.active_sanction_level}</Badge> : "—"}</td>
                    <td className="px-3 py-2">{u.onboarding_step}</td>
                    <td className="tnum px-3 py-2">{fmtDateTime(u.last_active_at)}</td>
                    <td className="tnum px-3 py-2">{fmtDateTime(u.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
