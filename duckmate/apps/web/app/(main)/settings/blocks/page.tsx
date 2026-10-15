// =============================================================================
// E4 · /settings/blocks — 차단 목록·해제 [F-SAF-05]
//
// 차단 상대의 프로필은 RLS(can_view_profile → is_blocked)로 조회되지 않는 것이
// 정상이다. 닉네임을 못 읽으면 "차단한 상대"로 표기하고 차단 일시만 보여준다.
// 차단 사실은 상대에게 통지되지 않음을 명시한다 (A5 부록).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { UnblockButton } from "./unblock-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "차단 목록",
  robots: { index: false, follow: false },
};

export default async function BlocksPage() {
  const { profile } = await requireOnboardingDone();
  const supabase = await createClient();

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", profile.id)
    .order("created_at", { ascending: false });

  const blocks = (blockRows ?? []) as { blocked_id: string; created_at: string }[];

  const nicknames = new Map<string, string>();
  if (blocks.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in(
        "id",
        blocks.map((b) => b.blocked_id),
      );
    for (const row of (profiles ?? []) as { id: string; nickname: string }[]) {
      nicknames.set(row.id, row.nickname);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">차단 목록</h1>
        <p className="text-body-sm text-ink-muted">
          차단하면 서로의 프로필·대화가 보이지 않아요. 차단 사실은 상대에게 알리지 않아요.
        </p>
      </header>

      {blocks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-2 py-6 text-center">
            <p className="text-body">차단한 상대가 없어요.</p>
            <p className="text-body-sm text-ink-muted">
              불쾌한 상대를 만나면 프로필이나 대화방의 ⋮ 메뉴에서 언제든 차단할 수 있어요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <li key={block.blocked_id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body">
                      {nicknames.get(block.blocked_id) ?? "차단한 상대"}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {new Date(block.created_at).toLocaleDateString("ko-KR")} 차단
                    </span>
                  </span>
                  <UnblockButton targetId={block.blocked_id} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-ink-muted">
        차단을 해제해도 이전 대화는 복구되지 않을 수 있어요. 위험하다고 느끼면 차단과 함께{" "}
        <Link href="/legal/community#제3조" className="text-primary underline underline-offset-2">
          신고
        </Link>
        해 주세요.
      </p>
    </main>
  );
}
