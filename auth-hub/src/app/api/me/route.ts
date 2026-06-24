import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

// GET /api/me — 현재 사용자의 인증/과금 상태. 마이크로서비스가 권한 확인용으로 호출 가능.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      plan: session.user.plan,
      credits: session.user.credits,
    },
  });
}
