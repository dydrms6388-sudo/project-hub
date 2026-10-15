import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { DeleteAccountScreen } from "@/components/settings/DeleteAccountScreen";

export const metadata: Metadata = { title: "계정 삭제", robots: { index: false, follow: false } };
/** 세션·쿠키 기반 게이트 — 빌드 시 프리렌더 금지 */
export const dynamic = "force-dynamic";

/** /settings/data/delete — 설정 › 내 데이터 › 계정 삭제 (2탭) → 확인 시트 1회 → request_delete → 로그아웃 (12_flows 결정 29, 09_store_policy 결정 2·21) */
export default async function DeleteAccountPage() {
  await requireProfile(1);
  return <DeleteAccountScreen />;
}
