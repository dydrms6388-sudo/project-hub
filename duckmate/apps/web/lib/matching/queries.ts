// =============================================================================
// D3 · 매칭 조회/액션 서버 함수 (apps/web/lib/matching/queries.ts)
//
// 규약:
// - 전부 서버 전용 — Server Component / Server Action / Route Handler 에서만 호출.
//   클라이언트 번들에 들어가면 런타임 예외(assertServerOnly).
// - 결과는 ActionResult 패턴(15_auth D2-1: throw 대신 {ok, code, message})을
//   따르되, 매칭 도메인 에러 코드는 이 파일의 MatchingErrorCode 로 별도 정의한다
//   (lib/auth/schemas.ts 는 D2 소유 — 수정 금지 제약).
// - 한도 검사(Lv1 좋아요 일 3회 · 슈퍼라이크 잔액 · 되돌리기 일 3회)는 전부
//   서버 카운트(service role) — RLS 는 자격만 방어한다 (14_schema D1 규약 ④).
// - 일일 리셋 = KST 06:00 (03_core_loop §결정-2). 서비스 데이 = (UTC+9h−6h) 날짜.
// - 티어 한도 값은 @duckmate/db TIER_LIMITS 단일 진실 — 하드코딩 금지.
// =============================================================================

import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  TIER_LIMITS,
  type Tier,
  type Gender,
  type Json,
  type LikeType,
  type Profile,
  type ProfileMode,
  type VerifyLevel,
} from "@duckmate/db";

// ---------------------------------------------------------------------------
// 결과 타입 (ActionResult 패턴 — 매칭 도메인 코드)
// ---------------------------------------------------------------------------

export type MatchingErrorCode =
  | "AUTH_REQUIRED" //        세션 없음
  | "PROFILE_NOT_FOUND" //    내 프로필 없음
  | "PROFILE_MISMATCH" //     인자 profileId ≠ 세션 프로필 (IDOR 방어)
  | "LIKE_LIMIT" //           Lv1 좋아요 일 3회 초과 (KST 06:00 리셋)
  | "SUPERLIKE_EMPTY" //      슈퍼라이크 잔액 0 (E4 페이월 소스 superlike_empty)
  | "ALREADY_LIKED" //        같은 상대에게 이미 좋아요/슈퍼라이크
  | "TARGET_NOT_AVAILABLE" // RLS 거부 — 상대 비활성/차단/내 자격 미달(can_engage)
  | "REWIND_NOT_ALLOWED" //   무료 티어 되돌리기 불가 (페이월 소스 rewind_attempt)
  | "REWIND_LIMIT" //         플러스 일 3회 초과
  | "NOTHING_TO_REWIND" //    오늘 보낸(미매칭) 좋아요 없음
  | "DB_ERROR";

export type MatchingResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: MatchingErrorCode; message: string };

function fail(code: MatchingErrorCode, message: string): MatchingResult<never> {
  return { ok: false, code, message };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/matching/queries.ts 는 서버 전용입니다 — 클라이언트에서 import 금지");
  }
}

// ---------------------------------------------------------------------------
// KST 서비스 데이 헬퍼 (일일 리셋 06:00 — D3/D7/퀘스트 공통 기준)
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

/** KST 06:00~다음날 05:59 를 하루로 보는 "서비스 데이" 날짜 (YYYY-MM-DD) */
export function matchingServiceDate(now: Date = new Date()): string {
  // UTC+9h(KST) − 6h(리셋 시각) 의 달력 날짜
  return new Date(now.getTime() + 3 * HOUR_MS).toISOString().slice(0, 10);
}

/** 현재 서비스 데이의 시작 시각(= 해당일 06:00 KST)의 UTC Date */
export function matchingServiceDayStart(now: Date = new Date()): Date {
  return new Date(`${matchingServiceDate(now)}T06:00:00+09:00`);
}

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

type Ctx = { supabase: Awaited<ReturnType<typeof createClient>>; profile: Profile };

/** 세션 프로필 로드 + 인자 profileId 일치 검증 (IDOR 방어) */
async function getOwnCtx(profileId: string): Promise<MatchingResult<Ctx>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return fail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");
  if ((profile as Profile).id !== profileId) {
    return fail("PROFILE_MISMATCH", "본인 프로필로만 호출할 수 있어요.");
  }
  return { ok: true, data: { supabase, profile: profile as Profile } };
}

/** 실 티어 조회 — 활성 계열 구독이 없으면 free (uq_subscriptions_active 와 동일 상태군) */
async function getActualTier(userId: string): Promise<Tier> {
  const service = createServiceClient();
  const { data } = await service
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userId)
    .in("status", ["active", "cancel_scheduled", "past_due"])
    .limit(1)
    .maybeSingle();
  return ((data?.tier as Tier | undefined) ?? "free") satisfies Tier;
}

// ---------------------------------------------------------------------------
// getTodayRecommendations — 오늘의 추천 큐 (S2)
// ---------------------------------------------------------------------------

export interface RecommendationTopHobby {
  slug: string;
  name: string;
  category: string;
  rank: 1 | 2 | 3 | null;
}

export interface RecommendationCard {
  recommendationId: string;
  targetId: string;
  /** 순수 궁합 점수 [0,1] — UI 는 round(score×100)% 로 표기 */
  score: number;
  /** 한국어 궁합 이유 3줄 (build_reasons) */
  reasons: string[];
  seenAt: string | null;
  target: {
    nickname: string;
    gender: Gender;
    regionCode: string;
    bio: string | null;
    favNote: string | null;
    currentObsession: string | null;
    verifyLevel: VerifyLevel;
    mode: ProfileMode;
  };
  topHobbies: RecommendationTopHobby[];
}

export interface TodayRecommendations {
  forDate: string;
  /** 미열람 카드부터 재개(S2 규칙)할 수 있게 seenAt 포함, 점수 내림차순 */
  cards: RecommendationCard[];
}

/**
 * 오늘(KST 서비스 데이)의 추천 큐. RLS(본인 행만) 하에서 유저 세션으로 읽는다.
 * 발행분 중 상대가 탈퇴/차단/제재로 조회 불가가 된 카드는 조용히 제외한다
 * (빈 큐 폴백 UI 는 E2 소관 — F-DIS-05).
 */
export async function getTodayRecommendations(
  profileId: string,
): Promise<MatchingResult<TodayRecommendations>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase } = ctxRes.data;

  const forDate = matchingServiceDate();
  const { data: recs, error } = await supabase
    .from("daily_recommendations")
    .select("id, target_id, score, reasons, seen_at")
    .eq("profile_id", profileId)
    .eq("for_date", forDate)
    .order("score", { ascending: false });
  if (error) return fail("DB_ERROR", error.message);

  const recRows = (recs ?? []) as {
    id: string;
    target_id: string;
    score: number;
    reasons: Json;
    seen_at: string | null;
  }[];
  if (recRows.length === 0) {
    return { ok: true, data: { forDate, cards: [] } };
  }

  const targetIds = recRows.map((r) => r.target_id);

  // 상대 프로필 — profiles_select_visible(can_view_profile) RLS 가 자동 필터
  const { data: targets } = await supabase
    .from("profiles")
    .select(
      "id, nickname, gender, region_code, bio, fav_note, current_obsession, verify_level, mode",
    )
    .in("id", targetIds);

  const targetMap = new Map<string, Profile>();
  for (const t of (targets ?? []) as Profile[]) targetMap.set(t.id, t);

  // 상대 취미 (덕질카드 Top3 우선) — profile_hobbies RLS: can_view_profile
  const { data: hobbies } = await supabase
    .from("profile_hobbies")
    .select("profile_id, rank, hobbies (slug, name, category)")
    .in("profile_id", targetIds);

  const hobbyMap = new Map<string, RecommendationTopHobby[]>();
  for (const row of (hobbies ?? []) as unknown as {
    profile_id: string;
    rank: 1 | 2 | 3 | null;
    hobbies: { slug: string; name: string; category: string } | null;
  }[]) {
    if (!row.hobbies) continue;
    const list = hobbyMap.get(row.profile_id) ?? [];
    list.push({ ...row.hobbies, rank: row.rank });
    hobbyMap.set(row.profile_id, list);
  }
  for (const list of hobbyMap.values()) {
    list.sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9));
  }

  const cards: RecommendationCard[] = [];
  for (const r of recRows) {
    const t = targetMap.get(r.target_id);
    if (!t) continue; // 조회 불가(탈퇴·차단·제재) — 카드 제외
    cards.push({
      recommendationId: r.id,
      targetId: r.target_id,
      score: Number(r.score),
      reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
      seenAt: r.seen_at,
      target: {
        nickname: t.nickname,
        gender: t.gender,
        regionCode: t.region_code,
        bio: t.bio,
        favNote: t.fav_note,
        currentObsession: t.current_obsession,
        verifyLevel: t.verify_level,
        mode: t.mode,
      },
      topHobbies: hobbyMap.get(r.target_id) ?? [],
    });
  }

  return { ok: true, data: { forDate, cards } };
}

// ---------------------------------------------------------------------------
// sendLike — 좋아요/슈퍼라이크 발신 (F-DIS-03)
// ---------------------------------------------------------------------------

/** Lv1 좋아요 일일 한도 (A5 §1 / D1 규약 ④ — 서버 카운트) */
const LV1_DAILY_LIKE_LIMIT = 3;

export interface SendLikeData {
  matched: boolean;
  matchId: string | null;
  /** 매칭 성립 시 첫 대화 제안 카드 3개 (트리거가 즉시 생성 — E2 리빌 모달용) */
  firstSuggestion: Json | null;
}

/**
 * 한도 규칙:
 * - Lv1 + type='like' → KST 서비스 데이 기준 일 3회 (service role 카운트,
 *   idx_likes_from_time). Lv2+ 는 무제한 (무제한 스와이프 아님 — 큐 자체가 일 N명).
 * - type='super' → item_balances 잔액 1 이상 필요. 성공 시 원장에 -1 기록
 *   (멱등키 superlike:{from}:{to} — 더블탭 방어).
 * 매칭 성립 여부는 insert 후 trg_likes_mutual_match 결과를 조회해 반환한다.
 */
export async function sendLike(
  targetId: string,
  type: LikeType,
  profileId: string,
): Promise<MatchingResult<SendLikeData>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase, profile } = ctxRes.data;
  const service = createServiceClient();

  // --- Lv1 일 3회 서버 카운트 (KST 06:00 리셋) ---
  if (type === "like" && profile.verify_level === 1) {
    const { count, error: cntError } = await service
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("from_id", profileId)
      .eq("type", "like")
      .gte("created_at", matchingServiceDayStart().toISOString());
    if (cntError) return fail("DB_ERROR", cntError.message);
    if ((count ?? 0) >= LV1_DAILY_LIKE_LIMIT) {
      return fail(
        "LIKE_LIMIT",
        `휴대폰 인증 단계에서는 좋아요를 하루 ${LV1_DAILY_LIKE_LIMIT}번까지 보낼 수 있어요. 본인인증하면 제한이 풀려요.`,
      );
    }
  }

  // --- 슈퍼라이크 잔액 검사 (item_balances 뷰 — 만료분 제외 실잔액) ---
  let superBalance = 0;
  if (type === "super") {
    const { data: bal, error: balError } = await service
      .from("item_balances")
      .select("balance")
      .eq("user_id", profile.user_id)
      .eq("item_type", "superlike")
      .maybeSingle();
    if (balError) return fail("DB_ERROR", balError.message);
    superBalance = (bal?.balance as number | undefined) ?? 0;
    if (superBalance < 1) {
      return fail("SUPERLIKE_EMPTY", "슈퍼라이크가 없어요."); // E4 페이월 superlike_empty
    }
  }

  // --- 좋아요 insert (유저 세션 — RLS likes_insert_own: can_engage + can_view) ---
  const { error: insError } = await supabase
    .from("likes")
    .insert({ from_id: profileId, to_id: targetId, type });
  if (insError) {
    if (insError.code === "23505") {
      return fail("ALREADY_LIKED", "이미 관심을 보낸 상대예요.");
    }
    if (insError.code === "42501") {
      return fail("TARGET_NOT_AVAILABLE", "지금은 이 상대에게 보낼 수 없어요.");
    }
    return fail("DB_ERROR", insError.message);
  }

  // --- 슈퍼라이크 차감 (원장 append-only, 멱등) ---
  //   본격 차감 순서(만료 임박 우선 lot 분해)는 D6 원장 유틸이 단일 구현 예정 —
  //   그 전까지는 잔액 기준 -1 기록. bucket 은 가장 임박한 유효 지급분을 따른다.
  if (type === "super") {
    const { data: lot } = await service
      .from("item_ledger")
      .select("bucket")
      .eq("user_id", profile.user_id)
      .eq("item_type", "superlike")
      .gt("delta", 0)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const { error: ledError } = await service.from("item_ledger").insert({
      user_id: profile.user_id,
      item_type: "superlike",
      delta: -1,
      balance_after: superBalance - 1,
      bucket: (lot?.bucket as string | undefined) ?? "grant_reward",
      expires_at: null,
      ref: `superlike:${profileId}:${targetId}`,
    });
    // 멱등키 충돌(23505) = 같은 상대에 대한 재시도 — 차감 1회 유지, 에러 아님
    if (ledError && ledError.code !== "23505") {
      return fail("DB_ERROR", ledError.message);
    }
  }

  // --- 매칭 성립 확인 (trg_likes_mutual_match → try_create_match 결과) ---
  const { data: match } = await supabase
    .from("matches")
    .select("id, first_suggestion")
    .or(
      `and(a_id.eq.${profileId},b_id.eq.${targetId}),and(a_id.eq.${targetId},b_id.eq.${profileId})`,
    )
    .eq("status", "active")
    .maybeSingle();

  return {
    ok: true,
    data: {
      matched: Boolean(match),
      matchId: (match?.id as string | undefined) ?? null,
      firstSuggestion: (match?.first_suggestion as Json | undefined) ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// getLikers — 나를 좋아한 사람 (F-DIS-07)
// ---------------------------------------------------------------------------

export interface LikerSummary {
  profileId: string;
  type: LikeType;
  likedAt: string;
  nickname: string;
  favNote: string | null;
  verifyLevel: VerifyLevel;
  topHobbies: string[];
}

export type LikersData =
  | { mode: "blur"; count: number } //             무료: 블러 — 실카운트만 (N≥1 배지)
  | { mode: "open"; count: number; likers: LikerSummary[] }; // 플러스/프로: 공개

/**
 * tier 인자는 화면 분기 힌트일 뿐 — 권한 판정은 항상 서버에서 실제 구독을
 * 재조회해 낮은 쪽을 적용한다 (클라이언트 티어 위조 방어).
 * 이미 매칭된 상대는 카운트/목록에서 제외한다.
 */
export async function getLikers(
  profileId: string,
  tier: Tier,
): Promise<MatchingResult<LikersData>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { supabase, profile } = ctxRes.data;

  const actualTier = await getActualTier(profile.user_id);
  const effectiveTier: Tier = actualTier === tier ? tier : actualTier;
  const open = TIER_LIMITS[effectiveTier].seeLikers !== "blur";

  // 받은 좋아요 (RLS likes_select_own: to_id = 나)
  const { data: likes, error } = await supabase
    .from("likes")
    .select("from_id, type, created_at")
    .eq("to_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return fail("DB_ERROR", error.message);

  const likeRows = (likes ?? []) as { from_id: string; type: LikeType; created_at: string }[];

  // 이미 매칭된 상대 제외
  const { data: matches } = await supabase
    .from("matches")
    .select("a_id, b_id")
    .or(`a_id.eq.${profileId},b_id.eq.${profileId}`)
    .eq("status", "active");
  const matchedIds = new Set<string>();
  for (const m of (matches ?? []) as { a_id: string | null; b_id: string | null }[]) {
    if (m.a_id && m.a_id !== profileId) matchedIds.add(m.a_id);
    if (m.b_id && m.b_id !== profileId) matchedIds.add(m.b_id);
  }
  const pending = likeRows.filter((l) => !matchedIds.has(l.from_id));

  if (!open) {
    return { ok: true, data: { mode: "blur", count: pending.length } };
  }

  // 공개: 프로필 요약 (profiles_select_visible RLS 가 비노출 대상 자동 필터)
  const fromIds = pending.map((l) => l.from_id);
  const likers: LikerSummary[] = [];
  if (fromIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, fav_note, verify_level")
      .in("id", fromIds);
    const pMap = new Map<string, Profile>();
    for (const p of (profiles ?? []) as Profile[]) pMap.set(p.id, p);

    const { data: hobbies } = await supabase
      .from("profile_hobbies")
      .select("profile_id, rank, hobbies (name)")
      .in("profile_id", fromIds)
      .not("rank", "is", null)
      .order("rank", { ascending: true });
    const hMap = new Map<string, string[]>();
    for (const row of (hobbies ?? []) as unknown as {
      profile_id: string;
      hobbies: { name: string } | null;
    }[]) {
      if (!row.hobbies) continue;
      const list = hMap.get(row.profile_id) ?? [];
      list.push(row.hobbies.name);
      hMap.set(row.profile_id, list);
    }

    for (const l of pending) {
      const p = pMap.get(l.from_id);
      if (!p) continue; // 조회 불가 상대 — 목록에서도 제외
      likers.push({
        profileId: l.from_id,
        type: l.type,
        likedAt: l.created_at,
        nickname: p.nickname,
        favNote: p.fav_note,
        verifyLevel: p.verify_level,
        topHobbies: hMap.get(l.from_id) ?? [],
      });
    }
  }

  return { ok: true, data: { mode: "open", count: likers.length, likers } };
}

// ---------------------------------------------------------------------------
// rewind — 되돌리기 (F-DIS-08: 플러스 일 3회 / 프로 무제한 / 무료 불가)
// ---------------------------------------------------------------------------

export interface RewindData {
  targetId: string;
  type: LikeType;
  /** 슈퍼라이크였으면 잔액 환급 여부 */
  refunded: boolean;
}

/**
 * 오늘(KST 서비스 데이) 보낸 마지막 좋아요를 취소한다.
 * - 이미 매칭이 성립한 좋아요는 되돌릴 수 없다 (언매치는 별도 플로우 — matches.status).
 * - likes 에는 클라이언트 DELETE 정책이 없으므로 삭제는 service role 로 수행.
 * - 사용 횟수는 audit_logs(action='matching.rewind') 서버 카운트 — 별도 테이블 없이
 *   일 한도 판정 (확정). 슈퍼라이크였다면 원장에 +1 환급(멱등).
 * - 되돌린 상대의 오늘 추천 카드 seen_at 을 초기화해 큐에 다시 노출한다.
 */
export async function rewind(profileId: string): Promise<MatchingResult<RewindData>> {
  assertServerOnly();
  const ctxRes = await getOwnCtx(profileId);
  if (!ctxRes.ok) return ctxRes;
  const { profile } = ctxRes.data;
  const service = createServiceClient();

  // --- 티어 판정 (TIER_LIMITS.rewindPerDay: 0=불가, -1=무제한) ---
  const tier = await getActualTier(profile.user_id);
  const perDay = TIER_LIMITS[tier].rewindPerDay;
  if (perDay === 0) {
    return fail("REWIND_NOT_ALLOWED", "되돌리기는 플러스부터 쓸 수 있어요."); // 페이월 rewind_attempt
  }

  const dayStartIso = matchingServiceDayStart().toISOString();

  if (perDay > 0) {
    const { count, error: cntError } = await service
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("actor_id", profileId)
      .eq("action", "matching.rewind")
      .gte("created_at", dayStartIso);
    if (cntError) return fail("DB_ERROR", cntError.message);
    if ((count ?? 0) >= perDay) {
      return fail("REWIND_LIMIT", `되돌리기는 하루 ${perDay}번까지예요.`);
    }
  }

  // --- 오늘 보낸 마지막 좋아요 찾기 ---
  const { data: lastLike, error: likeError } = await service
    .from("likes")
    .select("to_id, type, created_at")
    .eq("from_id", profileId)
    .gte("created_at", dayStartIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (likeError) return fail("DB_ERROR", likeError.message);
  if (!lastLike) {
    return fail("NOTHING_TO_REWIND", "오늘 보낸 좋아요가 없어요.");
  }
  const targetId = lastLike.to_id as string;
  const likeType = lastLike.type as LikeType;

  // 매칭 성립 여부 — 성립했으면 되돌리기 불가
  const { data: match } = await service
    .from("matches")
    .select("id")
    .or(
      `and(a_id.eq.${profileId},b_id.eq.${targetId}),and(a_id.eq.${targetId},b_id.eq.${profileId})`,
    )
    .maybeSingle();
  if (match) {
    return fail("NOTHING_TO_REWIND", "이미 매칭된 상대라 되돌릴 수 없어요.");
  }

  // --- 삭제 + 환급 + 카드 복원 + 사용 기록 ---
  const { error: delError } = await service
    .from("likes")
    .delete()
    .eq("from_id", profileId)
    .eq("to_id", targetId);
  if (delError) return fail("DB_ERROR", delError.message);

  let refunded = false;
  if (likeType === "super") {
    const { data: bal } = await service
      .from("item_balances")
      .select("balance")
      .eq("user_id", profile.user_id)
      .eq("item_type", "superlike")
      .maybeSingle();
    const { error: refundError } = await service.from("item_ledger").insert({
      user_id: profile.user_id,
      item_type: "superlike",
      delta: 1,
      balance_after: ((bal?.balance as number | undefined) ?? 0) + 1,
      bucket: "grant_reward",
      expires_at: null,
      ref: `rewind:${profileId}:${targetId}:${lastLike.created_at}`,
    });
    refunded = !refundError;
  }

  // 오늘 추천 카드였다면 미열람 상태로 복원 → 큐에 재노출
  await service
    .from("daily_recommendations")
    .update({ seen_at: null })
    .eq("profile_id", profileId)
    .eq("target_id", targetId)
    .eq("for_date", matchingServiceDate());

  // 일 한도 카운트용 사용 기록 (audit_logs 는 service role 전용 테이블)
  const { error: auditError } = await service.from("audit_logs").insert({
    actor_id: profileId,
    action: "matching.rewind",
    target: `likes:${targetId}`,
    meta: { type: likeType, refunded },
  });
  if (auditError) return fail("DB_ERROR", auditError.message);

  return { ok: true, data: { targetId, type: likeType, refunded } };
}
