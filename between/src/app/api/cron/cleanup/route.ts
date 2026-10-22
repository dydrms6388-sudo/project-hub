import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withService } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { storage } from "@/lib/storage";

// Vercel Cron (vercel.json) — 만료 프로필 삭제, 지금가능 상태 만료, rate limit 정리
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const paths = await withService(async (db) => {
    const r = await db.query<{ purge_expired: string }>("select public.purge_expired()");
    return r.rows.map((x) => x.purge_expired);
  });
  await storage.remove(paths);
  return NextResponse.json({ removedPhotos: paths.length });
}
