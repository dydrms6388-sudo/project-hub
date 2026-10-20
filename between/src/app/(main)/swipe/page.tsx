import type { Metadata } from "next";
import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { filtersFromSearchParams, filtersToSearchParams } from "@/lib/explore/filters";
import { withUser } from "@/lib/server/db";
import { getViewer, swipeDeck } from "@/lib/server/repo";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "스와이프" };

export default async function SwipePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromSearchParams(await searchParams);
  const { session } = await requireViewer();
  const deck = await withUser(session.claims, async (db) => {
    const viewer = await getViewer(db, session.userId);
    return viewer ? swipeDeck(db, viewer, filters) : [];
  });
  // 필터가 바뀌면 덱 상태를 새로 시작
  return <SwipeDeck key={filtersToSearchParams(filters).toString()} filters={filters} initial={deck} />;
}
