// =============================================================================
// E4 · /me/photos — 사진 관리 (검수 상태 노출, 12_flows §5.2 / §8.2)
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getMyPhotos } from "../_lib/queries";
import { PhotoManager } from "./photo-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "사진 관리",
  robots: { index: false, follow: false },
};

export default async function PhotosPage() {
  const { profile } = await requireOnboardingDone();
  const { photos, counts } = await getMyPhotos(profile.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/me" className="text-primary underline underline-offset-2">
          ← 내 프로필
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">사진 관리</h1>
        <p className="text-body-sm text-ink-muted">
          업로드한 사진은 검수 후 공개돼요 (보통 24시간 이내).
        </p>
      </header>

      <section
        aria-label="검수 안내"
        className="rounded-xl border border-line bg-surface-raised p-4 text-body-sm"
      >
        <ul className="ml-4 list-disc space-y-1">
          <li>얼굴이 나온 사진이 1장 승인되면 인증 뱃지가 붙어요.</li>
          <li>타인 사진·AI 생성 사진은 반려돼요.</li>
          <li>사진이 없어도 매칭과 채팅은 그대로 이용할 수 있어요.</li>
          {profile.verify_level >= 3 && counts.approved <= 1 && (
            <li>
              승인 사진을 모두 지우면 사진 인증 뱃지(Lv3)가 본인인증(Lv2)으로 내려가요.
            </li>
          )}
        </ul>
      </section>

      <PhotoManager profileId={profile.id} photos={photos} />
    </main>
  );
}
