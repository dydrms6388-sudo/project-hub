import { NextResponse, type NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/explore/filters";
import { jsonError } from "@/lib/server/api";
import { asCurrentUser } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";
import { getViewer, swipeDeck } from "@/lib/server/repo";
import { limitUser } from "@/lib/server/request";

export async function GET(req: NextRequest) {
  try {
    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const items = await asCurrentUser(async (db, s) => {
      await limitUser(db, "deck", 300, 3600);
      const viewer = await getViewer(db, s.userId);
      if (!viewer) throw new AppError("프로필을 먼저 만들어 주세요.", 403);
      return swipeDeck(db, viewer, filters);
    });
    return NextResponse.json({ items });
  } catch (e) {
    return jsonError(e);
  }
}
