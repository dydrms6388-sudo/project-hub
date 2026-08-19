// =============================================================================
// E2 · 매칭 리빌 페이로드 타입 + 파서 (서버/클라이언트 공용 — "use client" 아님)
//
// matches.first_suggestion 형식 (00008_matching.sql make_first_suggestion):
//   [{ "type":"hobby", "hobby_slug": string|null, "hobby_name": string|null,
//      "text": string }] × 3
// Phase 2 에서 type 에 battle|quiz 가 추가된다 (A3 부록-4) — 파서는 type 을 문자열로
// 유지해 확장에 견디게 둔다.
// =============================================================================

export interface MatchRevealSuggestion {
  /** suggestion_type props 값과 동일 (Phase 1 은 hobby 만) */
  type: string;
  hobbySlug: string | null;
  hobbyName: string | null;
  text: string;
}

export interface MatchRevealPayload {
  matchId: string;
  /** 상대 닉네임 */
  partnerNickname: string;
  /** 상대 덕질카드 Top3 (없으면 빈 배열) */
  partnerTopHobbies: string[];
  /** 궁합 % (0~100). 모르면 null — CompatGauge 자체를 렌더하지 않는다 */
  compatPercent: number | null;
  suggestions: MatchRevealSuggestion[];
}

/** matches.first_suggestion(jsonb) → 리빌 모달용 제안 3개. 형식이 어긋나면 빈 배열. */
export function parseSuggestions(raw: unknown): MatchRevealSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: MatchRevealSuggestion[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.text !== "string" || row.text.length === 0) continue;
    out.push({
      type: typeof row.type === "string" ? row.type : "hobby",
      hobbySlug: typeof row.hobby_slug === "string" ? row.hobby_slug : null,
      hobbyName: typeof row.hobby_name === "string" ? row.hobby_name : null,
      text: row.text,
    });
  }
  return out.slice(0, 3);
}
