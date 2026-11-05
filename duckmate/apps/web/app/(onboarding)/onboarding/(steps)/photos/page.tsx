import type { Metadata } from "next";
import { requireGate } from "@/lib/auth/session";
import { getOnboardingSnapshot } from "@/lib/onboarding/actions";
import { PhotosScreen } from "@/components/onboarding/PhotosScreen";

export const metadata: Metadata = { title: "사진" };
export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  await requireGate({ kind: "onboarding", step: "photos" });
  const snap = await getOnboardingSnapshot();
  return <PhotosScreen initial={snap.ok ? snap.data.photos : []} />;
}
