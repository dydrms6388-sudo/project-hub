import "server-only";

/**
 * 재동의 판정(서버 컴포넌트용). E2 `(app)/layout.tsx` 가 호출해 `<ReconsentGate pending={…} />` 에 넘긴다.
 *   const pending = await getPendingReconsents();   // [] 면 모달 없음
 * 규칙: legal_documents.requires_reconsent=true AND major(현재) > major(사용자 최신 동의) — lib/auth/consents.ts pendingReconsents.
 * 조회 실패(테이블 없음 등)는 [] 로 흡수한다(재동의 모달이 앱 진입을 막지 않도록).
 */
import { pendingReconsents } from "@/lib/auth/consents";
import { getSession } from "@/lib/auth/session";
import { legalHrefForDocKey, legalLabelForDocKey } from "./index";
import type { PendingReconsent } from "./types";

export async function getPendingReconsents(): Promise<PendingReconsent[]> {
  const { supabase, user } = await getSession();
  if (!user) return [];
  try {
    const list = await pendingReconsents(supabase, user.id);
    return list.map((p) => ({ documentKey: p.documentKey, version: p.version, label: legalLabelForDocKey(p.documentKey), href: legalHrefForDocKey(p.documentKey) }));
  } catch (e) {
    console.error("[legal] pendingReconsents failed", e);
    return [];
  }
}
