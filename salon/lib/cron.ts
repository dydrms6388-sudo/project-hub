import { NextResponse, type NextRequest } from "next/server";

// Vercel Cron은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <CRON_SECRET>을 붙여 호출한다.
export function unauthorizedCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
