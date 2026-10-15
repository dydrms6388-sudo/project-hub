// =============================================================================
// E4 · /me/duckcard — 덕질카드 편집 (12_flows §5.1)
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getMyHobbies } from "../_lib/queries";
import { DuckCardForm } from "./duckcard-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "덕질카드 편집",
  robots: { index: false, follow: false },
};

export default async function DuckCardEditPage() {
  const { profile } = await requireOnboardingDone();
  const hobbies = await getMyHobbies(profile.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/me" className="text-primary underline underline-offset-2">
          ← 내 프로필
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">덕질카드 편집</h1>
        <p className="text-body-sm text-ink-muted">
          상대에게 사진보다 먼저 보이는 카드예요.
        </p>
      </header>

      <DuckCardForm
        hobbies={hobbies}
        favNote={profile.fav_note ?? ""}
        currentObsession={profile.current_obsession ?? ""}
      />

      <p className="text-caption text-ink-muted">
        취미 자체를 바꾸고 싶다면 Top3 선택지에 없는 취미를 먼저 추가해야 해요. (취미 편집은 추천 큐
        재계산과 함께 다음 업데이트에서 열려요.)
      </p>
    </main>
  );
}
