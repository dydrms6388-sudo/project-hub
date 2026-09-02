// =============================================================================
// E4 · /me — 내 프로필 [F-PRF-01] (12_flows §5.1)
// 덕질카드 미리보기 + 인증 레벨 + 사진 검수 상태 + 모드 + 설정 진입.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, CardContent, DuckCard, VerifyLevelBadge } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getMyHobbies, getMyPhotos } from "./_lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 프로필",
  robots: { index: false, follow: false },
};

/** 다음 인증 단계 안내 — 재촉·죄책감 카피 금지, 얻는 것만 사실대로 (A3 §3.2) */
function nextStepGuide(level: number, approvedPhotos: number) {
  if (level < 2) {
    return {
      text: "본인인증하면 매칭·채팅과 데이팅 모드가 열려요.",
      href: "/verify",
      cta: "본인인증 하기",
    };
  }
  if (level < 3 && approvedPhotos === 0) {
    return {
      text: "얼굴이 나온 사진이 1장 승인되면 인증 뱃지가 붙어요. 사진 없이도 매칭·채팅은 그대로 이용할 수 있어요.",
      href: "/me/photos",
      cta: "사진 관리",
    };
  }
  return null;
}

export default async function MyProfilePage() {
  const { profile } = await requireOnboardingDone();
  const [hobbies, photoSummary] = await Promise.all([
    getMyHobbies(profile.id),
    getMyPhotos(profile.id),
  ]);

  const top3 = hobbies.filter((h) => h.rank !== null).map((h) => h.name);
  const guide = nextStepGuide(profile.verify_level, photoSummary.counts.approved);
  const cardIncomplete = !profile.fav_note || !profile.current_obsession || top3.length < 3;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <header className="flex items-center justify-between">
        <h1 className="text-h1">내 프로필</h1>
        <Link
          href="/settings"
          className="text-body-sm text-primary underline underline-offset-2"
        >
          설정
        </Link>
      </header>

      <section className="flex flex-col gap-3" aria-label="내 덕질카드">
        <DuckCard
          nickname={profile.nickname}
          topHobbies={top3.length > 0 ? top3 : hobbies.slice(0, 3).map((h) => h.name)}
          bias={profile.fav_note ?? undefined}
          obsession={profile.current_obsession ?? undefined}
          verifyLevel={profile.verify_level}
        />
        <div className="flex gap-2">
          <Link href="/me/duckcard" className="flex-1">
            <Button className="w-full">덕질카드 편집</Button>
          </Link>
          <Link href="/me/photos" className="flex-1">
            <Button variant="ghost" className="w-full">
              사진 관리
            </Button>
          </Link>
        </div>
        {cardIncomplete && (
          <p className="text-caption text-ink-muted">
            최애·요즘 빠진 것을 채우면 상대에게 보여줄 궁합 이유가 풍부해져요.
          </p>
        )}
      </section>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm text-ink-muted">인증 상태</span>
            <VerifyLevelBadge level={profile.verify_level} />
          </div>
          {guide && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-body-sm">{guide.text}</p>
              <Link href={guide.href}>
                <Button size="sm" variant="ghost">
                  {guide.cta}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm text-ink-muted">사진</span>
            <span className="flex items-center gap-2">
              <span className="text-body">{photoSummary.total}장</span>
              {photoSummary.counts.pending > 0 && (
                <Badge variant="warning">검수 중 {photoSummary.counts.pending}</Badge>
              )}
              {photoSummary.counts.rejected > 0 && (
                <Badge variant="danger">반려 {photoSummary.counts.rejected}</Badge>
              )}
            </span>
          </div>
          <p className="text-caption text-ink-muted">
            승인 전 사진은 상대에게 보이지 않아요.{" "}
            <Link href="/me/photos" className="text-primary underline underline-offset-2">
              사진 관리로 이동
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-4">
          <span className="flex flex-col">
            <span className="text-body-sm text-ink-muted">모드</span>
            <span className="text-body">
              {profile.mode === "dating" ? "데이팅 모드" : "취미 친구 모드"}
            </span>
          </span>
          <Link href="/settings/mode">
            <Button size="sm" variant="ghost">
              바꾸기
            </Button>
          </Link>
        </CardContent>
      </Card>

      <p className="text-caption text-ink-muted">
        상대에게는 덕질카드가 먼저 보이고, 사진은 검수 승인분만 프로필 상세에 노출돼요.
      </p>
    </main>
  );
}
