import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/explore-client";
import { filtersFromSearchParams } from "@/lib/explore/filters";
import { withUser } from "@/lib/server/db";
import { explore, getViewer, listSavedFilters } from "@/lib/server/repo";
import { requireViewer } from "@/lib/server/viewer";

export const metadata: Metadata = { title: "탐색" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromSearchParams(await searchParams);
  const { session } = await requireViewer();
  const { page, saved } = await withUser(session.claims, async (db) => {
    const viewer = await getViewer(db, session.userId);
    const page = viewer ? await explore(db, viewer, filters, 0) : { items: [], nextOffset: null };
    return { page, saved: await listSavedFilters(db, session.userId) };
  });
  return <ExploreClient filters={filters} initial={page} savedFilters={saved} />;
}
