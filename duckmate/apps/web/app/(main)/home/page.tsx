// =============================================================================
// E2 · /home — 홈 (슬롯 구조) [F-DIS-01] (12_flows §3.1, A3 S1)
//
// 구성 순서:
//   ① 사진 반려 1회성 배너 (§8.8, 푸시로는 보내지 않음)
//   ② 카드 슬롯 — Phase 2 에 궁합 카드로 교체되는 독립 컴포넌트 (M8)
//   ③ 나를 좋아한 사람 엔트리 — N≥1 일 때만, 무료는 블러 + 실카운트 (F-DIS-07)
//   ④ 프로필 보완 퀘스트 — 온보딩 스킵분 회수 (§결정-5)
//   ⑤ 본인인증 안내 — Lv<2 일 때만 (/verify 단일 승급 화면으로)
// 계측: app_open(source, push_slot)
// =============================================================================

import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getLikers, getTodayRecommendations } from "@/lib/matching/queries";
import { createClient } from "@/lib/supabase/server";
import { BlurredLikers } from "../_components/blurred-likers";
import { DismissibleBanner } from "../_components/dismissible-banner";
import { LinkButton } from "../_components/link-button";
import { PaywallNotice } from "../_components/paywall-notice";
import { TrackEvent } from "../_components/track-event";
import { HomeCardSlot } from "./_components/home-card-slot";
import { ProfileQuest } from "./_components/profile-quest";

export const metadata: Metadata = {
  title: "홈",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  return typeof value === "string" ? value : undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawSource = readParam(sp, "src");
  const source = rawSource === "push" || rawSource === "deeplink" ? rawSource : "organic";
  const rawSlot = readParam(sp, "slot");
  const pushSlot = source === "push" && (rawSlot === "1" || rawSlot === "2") ? Number(rawSlot) : null;

  const { profile } = await requireOnboardingDone();
  const supabase = await createClient();

  const [recsRes, likersRes, photos, hobbies] = await Promise.all([
    getTodayRecommendations(profile.id),
    getLikers(profile.id, "free"),
    supabase.from("photos").select("review_status").eq("profile_id", profile.id),
    supabase
      .from("profile_hobbies")
      .select("hobby_id", { count: "exact", head: true })
      .eq("profile_id", profile.id),
  ]);

  const cards = recsRes.ok ? recsRes.data.cards : [];
  const unseenCount = cards.filter((card) => card.seenAt === null).length;
  const likersCount = likersRes.ok ? likersRes.data.count : 0;
  const likersOpen = likersRes.ok && likersRes.data.mode === "open";

  const photoRows = (photos.data ?? []) as { review_status: string }[];
  const rejectedCount = photoRows.filter((p) => p.review_status === "rejected").length;
  const hobbyCount = hobbies.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <TrackEvent name="app_open" props={{ source, push_slot: pushSlot }} />

      {rejectedCount > 0 && (
        <DismissibleBanner
          storageKey="dm.banner.photo-rejected"
          message={`사진 ${rejectedCount}장이 반려됐어요. 사유를 확인하고 다시 올릴 수 있어요.`}
          actionHref="/me/photos"
          actionLabel="사유 보기"
        />
      )}

      {/* Phase 2 에 오늘의 궁합 카드로 교체되는 슬롯 (부록 B-1) */}
      <HomeCardSlot unseenCount={unseenCount} totalCount={cards.length} />

      {likersCount > 0 && (
        <Card>
          <CardTitle>{`나에게 관심을 보낸 ${likersCount}명`}</CardTitle>
          <CardDescription className="mt-1">
            {likersOpen
              ? "누가 보냈는지 확인할 수 있어요."
              : "서로 관심을 보내면 대화를 시작할 수 있어요."}
          </CardDescription>
          <div className="mt-3">
            <BlurredLikers count={likersCount} />
          </div>
          <div className="mt-4">
            <LinkButton href="/likes" variant="ghost" size="md">
              보러 가기
            </LinkButton>
          </div>
          {!likersOpen && <PaywallNotice source="likers_blur" className="mt-3" />}
        </Card>
      )}

      <ProfileQuest
        missingFavNote={!profile.fav_note}
        missingObsession={!profile.current_obsession}
        missingPhotos={photoRows.length === 0}
        hobbyCount={hobbyCount}
      />

      {profile.verify_level < 2 && (
        <Card>
          <CardTitle>본인인증하면 매칭·채팅이 열려요</CardTitle>
          <CardDescription className="mt-1">
            서로 인증한 회원끼리만 대화할 수 있어요. 좋아요 횟수 제한도 함께 풀려요.
          </CardDescription>
          <div className="mt-4">
            <LinkButton href="/verify?required=2" variant="primary" size="md">
              인증하기
            </LinkButton>
          </div>
        </Card>
      )}

      {/*
        Phase 2 예약 슬롯: 데일리 게임 진입(F-GAM-02 취향 배틀) 카드가 이 자리에
        추가된다. 라우트(/games/*)와 함께 F그룹이 켠다 — 12_flows 부록 B-1.
      */}
    </div>
  );
}
