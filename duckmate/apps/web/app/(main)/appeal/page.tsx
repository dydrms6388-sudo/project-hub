// =============================================================================
// E4 · /appeal — 이의제기 접수·조회 [F-SAF-07]
// 정지(level 3+) 상태에서는 /sanctioned 화면에 같은 폼이 노출된다(접근권 보장).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import type { MySanction } from "@duckmate/db";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SanctionList } from "./sanction-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이의제기",
  robots: { index: false, follow: false },
};

export default async function AppealPage() {
  await requireOnboardingDone();
  const supabase = await createClient();
  const { data } = await supabase
    .from("my_sanctions")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">제재와 이의제기</h1>
        <p className="text-body-sm text-ink-muted">
          부과된 제재 내용을 확인하고, 사실과 다르면 이의를 제기할 수 있어요.
        </p>
      </header>

      <SanctionList sanctions={(data ?? []) as MySanction[]} />
    </main>
  );
}
