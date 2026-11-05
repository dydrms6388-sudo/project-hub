/**
 * D3 읽기 쿼리 (서버 컴포넌트 / 서버 액션). 전부 ActionResult.
 *
 *   getTodayRecommendations()  오늘 추천 카드(없으면 온디맨드 생성) + v_profile_public + 취미/사진/공통 취미
 *   getHomeSummary()           홈 카운터(오늘 추천 N·남은 N·결과 대기·오늘 매칭·나를 좋아한 수·슈퍼라이크 상태)
 *   getMatches()               v_my_matches (채팅 목록·매칭 목록)
 *   getMatch(matchId)          매칭 1건 + 상대 카드 + first_suggestion (비어 있으면 자기 치유)
 *   getLikersCount()           무료: 숫자만 (see_likers='blur')
 *   getSuperlikeStatus()
 */
import "server-only";
import type { DailyRecommendationRow, FirstSuggestion, Json, MatchRow, MyMatchView, ProfilePublicView } from "@duckmate/db";
import { loopDate } from "@duckmate/db";
import { AuthError, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction, type ActionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnsureTodayResult, HomeSummary, SetFirstSuggestionResult, SuperlikeStatus } from "./rpc";
import { buildSuggestions, parseSuggestionInput, type SuggestionInputJson } from "./suggestions";
import { isIntroWelcome, scorePercent } from "./score";

export type RecoReason = { kind: string; label: string } & Record<string, Json | undefined>;

export type RecoHobby = {
  hobbyId: number;
  slug: string;
  name: string;
  categoryId: number;
  rank: number;
  intensity: number;
  favNote: string | null;
  /** 내 취미와 겹침(카드 강조) */
  isCommon: boolean;
};

export type RecoCard = {
  recoId: string;
  position: number;
  loopDate: string;
  /** 0~1 */
  score: number;
  /** 카드 "궁합 %" */
  scorePercent: number;
  /** 상위 2개를 사람말(label)로 표시 */
  reasons: RecoReason[];
  seenAt: string | null;
  action: DailyRecommendationRow["action"];
  profile: ProfilePublicView;
  hobbies: RecoHobby[];
  commonHobbyIds: number[];
  introWelcome: boolean;
  /** 승인 대표 사진 경로(storage photos 버킷 내). 없으면 null → 기본 아바타 */
  primaryPhotoPath: string | null;
  photoPaths: string[];
};

export type TodayRecommendations = {
  loopDate: string;
  generated: boolean;
  limit: number;
  cards: RecoCard[];
  remaining: number;
  /** 후보 부족(재노출로 채우지 않음) → 빈 카드 안내 */
  short: boolean;
};

function parseReasons(v: Json): RecoReason[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is RecoReason => typeof r === "object" && r !== null && "kind" in r && "label" in r);
}

export async function getTodayRecommendations(): Promise<ActionResult<TodayRecommendations>> {
  try {
    const ctx = await requireProfileForAction(2);
    const ensureRes = await ctx.supabase.rpc("ensure_today_recommendations");
    if (ensureRes.error) throw ensureRes.error;
    const ensured = ensureRes.data as unknown as EnsureTodayResult;
    const ld = ensured.loop_date ?? loopDate();

    const { data: rows, error } = await ctx.supabase
      .from("daily_recommendations")
      .select("*")
      .eq("profile_id", ctx.profileId)
      .eq("loop_date", ld)
      .order("position", { ascending: true });
    if (error) throw error;
    const recos = rows ?? [];
    const targetIds = recos.map((r) => r.target_id);
    const limit = ensured.limit ?? 5;
    if (targetIds.length === 0) {
      return ok({ loopDate: ld, generated: ensured.generated, limit, cards: [], remaining: 0, short: true });
    }

    const [profilesRes, hobbiesRes, myHobbiesRes, photosRes] = await Promise.all([
      ctx.supabase.from("v_profile_public").select("*").in("id", targetIds),
      ctx.supabase
        .from("profile_hobbies")
        .select("profile_id, hobby_id, rank, intensity, fav_note, hobbies(id, slug, name, category_id)")
        .in("profile_id", targetIds),
      ctx.supabase.from("profile_hobbies").select("hobby_id").eq("profile_id", ctx.profileId),
      ctx.supabase
        .from("photos")
        .select("profile_id, path, is_primary, sort_order")
        .in("profile_id", targetIds)
        .eq("review_status", "approved")
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true }),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (hobbiesRes.error) throw hobbiesRes.error;
    if (myHobbiesRes.error) throw myHobbiesRes.error;
    if (photosRes.error) throw photosRes.error;

    const myHobbyIds = new Set((myHobbiesRes.data ?? []).map((h) => h.hobby_id));
    const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const hobbiesByProfile = new Map<string, RecoHobby[]>();
    for (const h of hobbiesRes.data ?? []) {
      const meta = h.hobbies as unknown as { id: number; slug: string; name: string; category_id: number } | null;
      if (!meta) continue;
      const list = hobbiesByProfile.get(h.profile_id) ?? [];
      list.push({
        hobbyId: h.hobby_id,
        slug: meta.slug,
        name: meta.name,
        categoryId: meta.category_id,
        rank: h.rank,
        intensity: h.intensity,
        favNote: h.fav_note,
        isCommon: myHobbyIds.has(h.hobby_id),
      });
      hobbiesByProfile.set(h.profile_id, list);
    }
    const photosByProfile = new Map<string, string[]>();
    for (const p of photosRes.data ?? []) {
      const list = photosByProfile.get(p.profile_id) ?? [];
      list.push(p.path);
      photosByProfile.set(p.profile_id, list);
    }

    const cards: RecoCard[] = [];
    for (const r of recos) {
      const profile = profileById.get(r.target_id);
      if (!profile) continue; // can_view_profile 불통(차단 등) → 카드 제외
      const hobbies = (hobbiesByProfile.get(r.target_id) ?? []).sort((a, b) => a.rank - b.rank);
      const photos = photosByProfile.get(r.target_id) ?? [];
      cards.push({
        recoId: r.id,
        position: r.position,
        loopDate: r.loop_date,
        score: Number(r.score),
        scorePercent: scorePercent(Number(r.score)),
        reasons: parseReasons(r.reasons),
        seenAt: r.seen_at,
        action: r.action,
        profile,
        hobbies,
        commonHobbyIds: hobbies.filter((h) => h.isCommon).map((h) => h.hobbyId),
        introWelcome: isIntroWelcome(hobbies),
        primaryPhotoPath: photos[0] ?? null,
        photoPaths: photos,
      });
    }
    return ok({
      loopDate: ld,
      generated: ensured.generated,
      limit,
      cards,
      remaining: cards.filter((c) => c.action === null).length,
      short: cards.length < limit,
    });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function getHomeSummary(): Promise<ActionResult<HomeSummary>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("matching_home_summary");
    if (error) throw error;
    return ok(data as unknown as HomeSummary);
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function getMatches(): Promise<ActionResult<MyMatchView[]>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase
      .from("v_my_matches")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: true })
      .order("matched_at", { ascending: false });
    if (error) throw error;
    return ok(data ?? []);
  } catch (e) {
    return toActionFailure(e);
  }
}

export type MatchDetail = {
  match: MatchRow;
  partnerId: string;
  partner: ProfilePublicView | null;
  firstSuggestion: FirstSuggestion[];
  /** 겹친 취미 slug (매칭 화면 애니메이션 강조) */
  commonHobbySlugs: string[];
};

/** first_suggestion 이 비어 있으면(레이스) 여기서 조립·기록한다 (service, 비어 있을 때만 set → 멱등) */
export async function ensureFirstSuggestion(ctx: ActionContext, matchId: string, input?: SuggestionInputJson | null): Promise<FirstSuggestion[]> {
  let json = input ?? null;
  if (json === null) {
    const { data, error } = await ctx.supabase.rpc("match_suggestion_input", { p_match_id: matchId });
    if (error) throw error;
    json = data as unknown as SuggestionInputJson;
  }
  const cards = buildSuggestions(parseSuggestionInput(json));
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("set_match_first_suggestion", { p_match_id: matchId, p_cards: cards as unknown as Json });
  if (error) throw error;
  return (data as unknown as SetFirstSuggestionResult).first_suggestion;
}

export async function getMatch(matchId: string): Promise<ActionResult<MatchDetail>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data: match, error } = await ctx.supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
    if (error) throw error;
    if (!match) throw new AuthError("NOT_FOUND");
    const partnerId = match.a_id === ctx.profileId ? match.b_id : match.a_id;
    const [partnerRes, input] = await Promise.all([
      ctx.supabase.from("v_profile_public").select("*").eq("id", partnerId).maybeSingle(),
      ctx.supabase.rpc("match_suggestion_input", { p_match_id: matchId }),
    ]);
    if (partnerRes.error) throw partnerRes.error;
    if (input.error) throw input.error;
    let firstSuggestion = (Array.isArray(match.first_suggestion) ? match.first_suggestion : []) as unknown as FirstSuggestion[];
    if (firstSuggestion.length === 0) firstSuggestion = await ensureFirstSuggestion(ctx, matchId, input.data as unknown as SuggestionInputJson);
    return ok({
      match,
      partnerId,
      partner: partnerRes.data ?? null,
      firstSuggestion,
      commonHobbySlugs: (input.common_hobbies ?? []).map((h) => h.slug),
    });
  } catch (e) {
    return toActionFailure(e);
  }
}

/** 무료 티어: 숫자만 (블러 카드는 Phase 3 D6 v_likers). 0 이면 UI 는 유료 안내를 띄우지 않는다 */
export async function getLikersCount(): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("likers_count");
    if (error) throw error;
    return ok({ count: data ?? 0 });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function getSuperlikeStatus(): Promise<ActionResult<SuperlikeStatus>> {
  try {
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.rpc("superlike_status", {});
    if (error) throw error;
    return ok(data as unknown as SuperlikeStatus);
  } catch (e) {
    return toActionFailure(e);
  }
}

