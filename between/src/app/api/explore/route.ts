import { NextResponse, type NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/explore/filters";
import { jsonError } from "@/lib/server/api";
import { asCurrentUser } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";
import { explore, getViewer } from "@/lib/server/repo";
import { limitUser } from "@/lib/server/request";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filters = filtersFromSearchParams(sp);
    const offset = Math.max(0, Math.min(Number(sp.get("offset")) || 0, 2400));
    const page = await asCurrentUser(async (db, s) => {
      await limitUser(db, "explore", 600, 3600);
      const viewer = await getViewer(db, s.userId);
      if (!viewer) throw new AppError("프로필을 먼저 만들어 주세요.", 403);
      return explore(db, viewer, filters, offset);
    });
    return NextResponse.json(page);
  } catch (e) {
    return jsonError(e);
  }
}
