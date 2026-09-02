import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getBlockList } from "@/lib/moderation/queries";
import { BlocksScreen } from "@/components/settings/BlocksScreen";

export const metadata: Metadata = { title: "차단 관리", robots: { index: false, follow: false } };

/** /blocks — 차단 목록(v_my_blocks) + 해제 (18_moderation 결정 5) */
export default async function BlocksPage() {
  await requireProfile(1);
  const blocks = await getBlockList().catch(() => []);
  return <BlocksScreen blocks={blocks} />;
}
