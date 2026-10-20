import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { photoStoragePath } from "@/lib/server/repo";
import { storage } from "@/lib/storage";

// 사진 조회: DB 정책(profile_photos RLS — 공개 범위/차단/매칭)을 통과한 경우에만 전달.
// 응답은 private 캐시만 허용 (CDN 공유 캐시 금지)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const path = await withUser(session.claims, (db) => photoStoragePath(db, id));
  if (!path) return new NextResponse(null, { status: 404 });
  const src = await storage.get(path);
  if (!src) return new NextResponse(null, { status: 404 });
  if (src.kind === "redirect") {
    return NextResponse.redirect(src.url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  }
  return new NextResponse(new Uint8Array(src.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
