import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { MatchScreen } from "@/components/discover/MatchScreen";
import { fetchMatchView } from "../actions";

export const metadata: Metadata = { title: "매칭", robots: { index: false, follow: false } };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile(2);
  const r = await fetchMatchView(id);
  if (!r.ok) {
    if (r.redirectTo) redirect(r.redirectTo);
    if (r.code === "NOT_FOUND" || r.code === "FORBIDDEN" || r.code === "INVALID_INPUT") notFound();
  }
  return <MatchScreen matchId={id} initial={r.ok ? r.data : null} />;
}
