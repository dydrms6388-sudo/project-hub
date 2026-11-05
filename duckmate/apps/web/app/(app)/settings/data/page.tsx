import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { DataScreen } from "@/components/settings/DataScreen";

export const metadata: Metadata = { title: "내 데이터 · 계정", robots: { index: false, follow: false } };
/** 세션·쿠키 기반 게이트 — 빌드 시 프리렌더 금지 */
export const dynamic = "force-dynamic";

/** /settings/data — 다운로드(자동 JSON) · 휴면/재개 · 계정 삭제 진입 (07_legal §0-21 권리 5종 한 곳) */
export default async function DataPage() {
  const { profile } = await requireProfile(1);
  return <DataScreen status={profile.status} />;
}
