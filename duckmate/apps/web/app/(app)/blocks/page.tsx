import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getBlockList } from "@/lib/moderation/queries";
import { BlocksScreen } from "@/components/settings/BlocksScreen";

export const metadata: Metadata = { title: "차단 관리", robots: { index: false, follow: false } };
/** 세션·쿠키 기반 게이트 — 빌드 시 프리렌더 금지 */
export const dynamic = "force-dynamic";

/** /blocks — 차단 목록(v_my_blocks) + 해제 (18_moderation 결정 5) */
export default async function BlocksPage() {
  await requireProfile(1);
  const blocks = await getBlockList().catch(() => []);
  return <BlocksScreen blocks={blocks} />;
}
