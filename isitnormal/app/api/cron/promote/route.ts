import { NextResponse, type NextRequest } from "next/server";
import { runPromotion } from "@/lib/promote-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 승격 잡 크론 엔드포인트 (Vercel Cron). CRON_SECRET 로 보호.
 * Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 보낸다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const summary = await runPromotion();
  return NextResponse.json({ ok: true, summary });
}
