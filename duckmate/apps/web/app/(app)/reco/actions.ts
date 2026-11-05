"use server";

/**
 * E2 추천 화면 서버 액션 — D3 쿼리(server-only)를 클라이언트가 재조회할 수 있게 감싼다.
 *   fetchTodayRecommendations() → TodayView (ensure_today_recommendations 포함, 사진 서명 URL 1h, 슈퍼라이크 상태, undo 권한)
 */
import { entitlementsFor } from "@duckmate/db";
import { ok, type ActionResult } from "@/lib/auth/errors";
import { getSuperlikeStatus, getTodayRecommendations } from "@/lib/matching/queries";
import type { TodayView } from "@/components/discover/types";
import { signPhotoPaths } from "./photos";

export async function fetchTodayRecommendations(): Promise<ActionResult<TodayView>> {
  const r = await getTodayRecommendations();
  if (!r.ok) return r;
  const [sl, signed] = await Promise.all([getSuperlikeStatus(), signPhotoPaths(r.data.cards.flatMap((c) => c.photoPaths))]);
  const superlike = sl.ok ? sl.data : null;
  const canUndo = entitlementsFor(superlike?.tier ?? "free").undo === true;
  return ok({
    ...r.data,
    cards: r.data.cards.map((c) => ({
      ...c,
      photoUrls: c.photoPaths.map((p) => signed.get(p)).filter((u): u is string => Boolean(u)),
    })),
    superlike,
    canUndo,
  });
}
