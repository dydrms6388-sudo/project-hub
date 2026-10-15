"use server";

// =============================================================================
// E2 · 탐색 Server Actions — 좋아요/슈퍼라이크/패스/열람 기록
//
// 규약:
//  - 좋아요는 반드시 이 Server Action 경유 (클라이언트에서 D3 queries 직접 호출 금지).
//  - profileId 는 클라이언트가 보내지 않는다 — 세션에서 서버가 재확인한다(IDOR 방어).
//  - 결과는 ActionResult 패턴. UI 는 code 로 분기한다:
//      LIKE_LIMIT        → /verify 유도 (페이월 아님! 12_flows §8.6)
//      SUPERLIKE_EMPTY   → paywall_source = "superlike_empty" 안내 (Phase 1 결제 없음)
//      ALREADY_LIKED / TARGET_NOT_AVAILABLE → 조용히 다음 카드로
//  - 매칭 성립 시 리빌 페이로드를 함께 돌려주고, 클라이언트가 전역 리빌 큐에 넣는다.
//  - Lv1 상호 좋아요(매칭 보류, §8.5)는 status="pending" 으로 구분한다.
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import { sendLike, type MatchingErrorCode } from "@/lib/matching/queries";
import type { LikeType, VerifyLevel } from "@duckmate/db";
import { logAppEvent } from "../_components/analytics";
import type { PaywallSource } from "../_components/paywall-notice";
import {
  parseSuggestions,
  type MatchRevealSuggestion,
} from "../_components/match-reveal-types";

export interface LikeOutcome {
  /** sent = 접수 / matched = 매칭 성립(리빌) / pending = 매칭 보류(양측 Lv2 미달) */
  status: "sent" | "matched" | "pending";
  matchId: string | null;
  suggestions: MatchRevealSuggestion[];
  /** 내 인증 레벨 — pending 안내에서 /verify CTA 노출 판정에 쓴다 */
  myVerifyLevel: VerifyLevel;
}

export type LikeActionResult =
  | { ok: true; data: LikeOutcome }
  | {
      ok: false;
      code: MatchingErrorCode;
      message: string;
      /** true 면 페이월이 아니라 본인인증 유도 화면으로 (Lv 게이트) */
      verifyRequired?: boolean;
      paywallSource?: PaywallSource;
    };

/** 좋아요 발신 지점 — like_sent props.source (03_core_loop §4.1) */
export type LikeSource = "queue" | "card";

async function currentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, verify_level")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    supabase,
    id: data.id as string,
    verifyLevel: data.verify_level as VerifyLevel,
  };
}

export async function sendLikeAction(
  targetId: string,
  type: LikeType,
  source: LikeSource = "queue",
): Promise<LikeActionResult> {
  const me = await currentProfile();
  if (!me) {
    return { ok: false, code: "AUTH_REQUIRED", message: "로그인이 필요해요." };
  }

  const res = await sendLike(targetId, type, me.id);
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      verifyRequired: res.code === "LIKE_LIMIT",
      paywallSource: res.code === "SUPERLIKE_EMPTY" ? "superlike_empty" : undefined,
    };
  }

  await logAppEvent(type === "super" ? "superlike_sent" : "like_sent", {
    target_id: targetId,
    source,
  });

  if (res.data.matched && res.data.matchId) {
    await logAppEvent("match_created", { match_id: res.data.matchId, source });
    return {
      ok: true,
      data: {
        status: "matched",
        matchId: res.data.matchId,
        suggestions: parseSuggestions(res.data.firstSuggestion),
        myVerifyLevel: me.verifyLevel,
      },
    };
  }

  // 매칭 보류 판정(§8.5): 상대도 나를 좋아했는데 매칭이 안 됐다 = 양측 Lv2 미달
  // (likes RLS: to_id = 나 인 행만 읽을 수 있으므로 상대의 발신 여부만 확인 가능)
  const { data: reciprocal } = await me.supabase
    .from("likes")
    .select("from_id")
    .eq("from_id", targetId)
    .eq("to_id", me.id)
    .maybeSingle();

  return {
    ok: true,
    data: {
      status: reciprocal ? "pending" : "sent",
      matchId: null,
      suggestions: [],
      myVerifyLevel: me.verifyLevel,
    },
  };
}

/** 패스 — 서버 상태 변경 없음(큐에서 seen 처리만). 계측만 남긴다. */
export async function passAction(targetId: string): Promise<void> {
  await logAppEvent("pass_sent", { target_id: targetId, source: "queue" });
}

/**
 * 카드 열람 기록 — daily_recommendations.seen_at.
 * 클라이언트에 허용된 유일한 갱신 컬럼(00003 grant update (seen_at)).
 * 미열람 카드부터 재개하는 S2 규칙의 근거 데이터다.
 */
export async function markRecommendationSeen(recommendationId: string): Promise<void> {
  const me = await currentProfile();
  if (!me) return;
  await me.supabase
    .from("daily_recommendations")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .is("seen_at", null);
}

// ---------------------------------------------------------------------------
// [F-DIS-08] 되돌리기 — Phase 3 까지 UI 미노출 (12_flows §3.2 "자리만 예약").
// 서버 구현은 lib/matching/queries.ts rewind() 에 이미 있고, 무료 티어는
// REWIND_NOT_ALLOWED → paywall_source "rewind_attempt" 로 이어질 예정이다.
// Phase 3 에서 이 파일에 rewindAction 을 추가하고 카드 스택에 버튼을 켠다.
// ---------------------------------------------------------------------------
