// =============================================================================
// E2 · /discover/[profileId] — 상대 프로필 상세 (12_flows §3.3)
//
// 순서 규약: ① 덕질카드(풀 버전) ② 사진(검수 승인분만) ③ 활동 시간대·소개.
//  - 사진이 없으면 영역 자체를 렌더하지 않는다 (§8.2 — 깨진 이미지·자리 표시 금지).
//  - 덕질카드 미완성 상대는 있는 필드만 렌더 (§8.7).
//  - 조회 불가(차단·탈퇴·제재·자격 미달)는 RLS 가 걸러내며 → notFound().
//  - 신고·차단(⋮)은 전역 바텀시트(라우트 아님) 소관이라 여기서는 슬롯만 둔다.
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  CompatGauge,
  DuckCard,
  Progress,
  VerifyLevelBadge,
} from "@duckmate/ui";
import type { TimeSlot, VerifyLevel } from "@duckmate/db";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { getTodayRecommendations } from "@/lib/matching/queries";
import { createClient } from "@/lib/supabase/server";
import { getApprovedPhotoUrls } from "../../_components/photo-url";
import { ProfileLikeActions } from "./_components/profile-like-actions";

export const metadata: Metadata = {
  title: "프로필",
  robots: { index: false, follow: false },
};

const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "아침",
  afternoon: "오후",
  evening: "저녁",
  night: "밤",
};

interface HobbyRow {
  rank: 1 | 2 | 3 | null;
  intensity: 1 | 2 | 3 | 4 | 5;
  hobbies: { name: string } | null;
}

function ageFromBirthDate(birthDate: string): number | null {
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** availability 행 → "평일 밤 · 주말 오후" 형태의 요약 */
function summarizeAvailability(rows: { weekday: number; slot: TimeSlot }[]): string[] {
  const weekday = new Set<TimeSlot>();
  const weekend = new Set<TimeSlot>();
  for (const row of rows) {
    (row.weekday === 0 || row.weekday === 6 ? weekend : weekday).add(row.slot);
  }
  const out: string[] = [];
  if (weekday.size > 0) {
    out.push(`평일 ${[...weekday].map((s) => SLOT_LABEL[s]).join("·")}`);
  }
  if (weekend.size > 0) {
    out.push(`주말 ${[...weekend].map((s) => SLOT_LABEL[s]).join("·")}`);
  }
  return out;
}

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const { profile: me } = await requireOnboardingDone();
  if (profileId === me.id) notFound();

  const supabase = await createClient();

  // RLS(profiles_select_visible / can_view_profile)가 열람 자격을 판정한다.
  const { data: target } = await supabase
    .from("profiles")
    .select(
      "id, nickname, birth_date, region_code, bio, fav_note, current_obsession, verify_level, mode",
    )
    .eq("id", profileId)
    .maybeSingle();
  if (!target) notFound();

  const [{ data: hobbyRows }, { data: availabilityRows }, recRes] = await Promise.all([
    supabase
      .from("profile_hobbies")
      .select("rank, intensity, hobbies (name)")
      .eq("profile_id", profileId)
      .order("rank", { ascending: true, nullsFirst: false }),
    supabase.from("availability").select("weekday, slot").eq("profile_id", profileId),
    getTodayRecommendations(me.id),
  ]);

  // 열람 자격 확인 후에만 승인 사진 signed URL 발급 (00006 규약)
  const photoUrls = await getApprovedPhotoUrls(profileId);

  const hobbies = ((hobbyRows ?? []) as unknown as HobbyRow[]).filter((h) => h.hobbies);
  const topHobbies = hobbies
    .filter((h) => h.rank !== null)
    .slice(0, 3)
    .map((h) => ({ name: h.hobbies?.name ?? "", intensity: h.intensity }))
    .filter((h) => h.name.length > 0);
  const topHobbyNames = topHobbies.map((h) => h.name);

  const recCard = recRes.ok
    ? recRes.data.cards.find((card) => card.targetId === profileId)
    : undefined;
  const compatPercent = recCard ? Math.round(recCard.score * 100) : null;

  const age = ageFromBirthDate(target.birth_date as string);
  const availability = summarizeAvailability(
    (availabilityRows ?? []) as { weekday: number; slot: TimeSlot }[],
  );
  const nickname = target.nickname as string;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-h1">{nickname}</h1>
        {age !== null && <span className="text-body text-ink-muted">{age}</span>}
        {typeof target.region_code === "string" && target.region_code.length > 0 && (
          <span className="text-body text-ink-muted">{target.region_code}</span>
        )}
        <div className="ml-auto">
          <VerifyLevelBadge level={target.verify_level as VerifyLevel} compact />
        </div>
        {/*
          신고·차단(⋮) 슬롯: 전역 바텀시트(components/report-sheet, 12_flows §결정-2 ②)가
          붙는 자리. 라우트가 아니라 전역 오버레이라서 E2 소유 범위 밖 — 컴포넌트가
          준비되면 여기에 트리거 버튼만 삽입한다(2탭 이내 규칙 유지).
        */}
      </div>

      <DuckCard
        nickname={nickname}
        topHobbies={topHobbyNames}
        bias={(target.fav_note as string | null) ?? undefined}
        obsession={(target.current_obsession as string | null) ?? undefined}
        verifyLevel={target.verify_level as VerifyLevel}
        avatarSrc={photoUrls[0]}
      />

      {topHobbies.length > 0 && (
        <Card>
          <CardTitle>취향 몰입도</CardTitle>
          <ul className="mt-3 flex flex-col gap-3">
            {topHobbies.map((hobby) => (
              <li key={hobby.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-body">{hobby.name}</span>
                  <span className="text-caption text-ink-muted">{`몰입도 ${hobby.intensity}/5`}</span>
                </div>
                <Progress
                  value={hobby.intensity}
                  max={5}
                  label={`${hobby.name} 몰입도 5단계 중 ${hobby.intensity}단계`}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recCard && compatPercent !== null && (
        <Card>
          <CardTitle>궁합</CardTitle>
          <div className="mt-3">
            <CompatGauge percent={compatPercent} size="hero" reasons={recCard.reasons} />
          </div>
        </Card>
      )}

      {photoUrls.length > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            <CardTitle>사진</CardTitle>
            <Badge variant="success">검수 승인</Badge>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {photoUrls.map((url, i) => (
              <li key={url}>
                {/* next/image 미사용: signed URL 은 만료되는 임시 주소라 최적화 캐시 부적합 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${nickname}님의 사진 ${i + 1}`}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(availability.length > 0 || (target.bio as string | null)) && (
        <Card>
          {availability.length > 0 && (
            <>
              <CardTitle>활동 시간대</CardTitle>
              <CardDescription className="mt-1">{availability.join(" · ")}</CardDescription>
            </>
          )}
          {(target.bio as string | null) && (
            <div className={availability.length > 0 ? "mt-4" : undefined}>
              <CardTitle>소개</CardTitle>
              <p className="mt-1 whitespace-pre-line text-body text-ink">
                {target.bio as string}
              </p>
            </div>
          )}
        </Card>
      )}

      <ProfileLikeActions
        targetId={profileId}
        nickname={nickname}
        topHobbies={topHobbyNames}
        compatPercent={compatPercent}
      />
    </div>
  );
}
