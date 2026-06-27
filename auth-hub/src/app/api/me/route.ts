import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";

// GET /api/me — 현재 사용자의 인증/과금 상태.
// 웹(세션 쿠키) + 네이티브(Authorization: Bearer <mobile JWT>) 모두 지원.
// 마이크로서비스가 권한 확인용으로 호출.
export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
    },
  });
}
