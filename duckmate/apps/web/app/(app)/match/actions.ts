"use server";

/**
 * E2 매칭 화면 서버 액션.
 *   fetchMatchView(matchId) → getMatch(D3, first_suggestion 자기 치유 포함) + 양쪽 덕질 카드 재료(profile_hobbies·regions·사진) + 첫 매칭 여부
 */
import type { Enums } from "@duckmate/db";
import { AuthError, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { getProfile, requireProfileForAction } from "@/lib/auth/session";
import { getMatch, getMatches, type RecoHobby } from "@/lib/matching/queries";
import { ageBandOf, clampVerifyLevel, favoriteOf, regionLabel } from "@/components/discover/format";
import type { CardPerson, MatchView } from "@/components/discover/types";
import { signPhotoPaths } from "../reco/photos";

type HobbyMeta = { id: number; slug: string; name: string; category_id: number } | null;

export async function fetchMatchView(matchId: string): Promise<ActionResult<MatchView>> {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(matchId)) throw new AuthError("NOT_FOUND");
    const m = await getMatch(matchId);
    if (!m.ok) return m;
    const ctx = await requireProfileForAction(2);
    const myId = ctx.profileId;
    const partnerId = m.data.partnerId;

    const [hobbiesRes, myProfile, matchesRes, photosRes] = await Promise.all([
      ctx.supabase
        .from("profile_hobbies")
        .select("profile_id, hobby_id, rank, intensity, fav_note, hobbies(id, slug, name, category_id)")
        .in("profile_id", [myId, partnerId]),
      getProfile(),
      getMatches(),
      ctx.supabase
        .from("photos")
        .select("path, is_primary, sort_order")
        .eq("profile_id", partnerId)
        .eq("review_status", "approved")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);
    if (hobbiesRes.error) throw hobbiesRes.error;
    if (!myProfile) throw new AuthError("NOT_AUTHENTICATED", undefined, { redirectTo: "/login" });

    const mine: RecoHobby[] = [];
    const theirs: RecoHobby[] = [];
    for (const h of hobbiesRes.data ?? []) {
      const meta = h.hobbies as unknown as HobbyMeta;
      if (!meta) continue;
      const row: RecoHobby = {
        hobbyId: h.hobby_id,
        slug: meta.slug,
        name: meta.name,
        categoryId: meta.category_id,
        rank: h.rank,
        intensity: h.intensity,
        favNote: h.fav_note,
        isCommon: false,
      };
      (h.profile_id === myId ? mine : theirs).push(row);
    }
    const myIds = new Set(mine.map((h) => h.hobbyId));
    const theirIds = new Set(theirs.map((h) => h.hobbyId));
    for (const h of mine) h.isCommon = theirIds.has(h.hobbyId);
    for (const h of theirs) h.isCommon = myIds.has(h.hobbyId);
    mine.sort((a, b) => a.rank - b.rank);
    theirs.sort((a, b) => a.rank - b.rank);

    // 내 지역 라벨 (regions 는 공개 참조 테이블)
    let myRegion = "지역 비공개";
    if (myProfile.region_code) {
      const { data: region } = await ctx.supabase.from("regions").select("sido, sigungu").eq("code", myProfile.region_code).maybeSingle();
      myRegion = regionLabel(region?.sigungu, region?.sido);
    }

    const partnerPhotoPaths = (photosRes.data ?? []).map((p) => p.path);
    const signed = await signPhotoPaths(partnerPhotoPaths);

    const me: CardPerson = {
      profileId: myId,
      nickname: myProfile.nickname ?? "나",
      ageBand: ageBandOf(myProfile.birth_date),
      region: myRegion,
      verifyLevel: clampVerifyLevel(myProfile.verify_level),
      hobbies: mine,
      favorite: favoriteOf(mine),
      nowInto: myProfile.now_into,
      bio: myProfile.bio,
      photoUrls: [],
    };
    const p = m.data.partner;
    const partner: CardPerson | null = p
      ? {
          profileId: p.id,
          nickname: p.nickname ?? "닉네임 없음",
          ageBand: p.age_band,
          region: regionLabel(p.sigungu, p.sido),
          verifyLevel: clampVerifyLevel(p.verify_level),
          hobbies: theirs,
          favorite: favoriteOf(theirs),
          nowInto: p.now_into,
          bio: p.bio,
          photoUrls: partnerPhotoPaths.map((x) => signed.get(x)).filter((u): u is string => Boolean(u)),
        }
      : null;

    const commonSlugs = new Set(m.data.commonHobbySlugs);
    const overlapLabels = theirs.filter((h) => h.isCommon || commonSlugs.has(h.slug)).map((h) => h.name);
    const matchCount = matchesRes.ok ? matchesRes.data.length : 1;
    const showSafetyModal = matchCount <= 1 && !myProfile.safety_modal_seen_at;

    return ok({
      matchId,
      mode: m.data.match.mode as Enums["profile_mode"],
      status: m.data.match.status,
      matchedAt: m.data.match.matched_at,
      firstMessageAt: m.data.match.first_message_at,
      me,
      partner,
      partnerProfile: p,
      firstSuggestion: m.data.firstSuggestion,
      overlapLabels,
      showSafetyModal,
    });
  } catch (e) {
    return toActionFailure(e);
  }
}
