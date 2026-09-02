import { NextResponse, type NextRequest } from "next/server";

const UID_COOKIE = "sl_uid";

/** 비로그인 사용량 식별용 익명 uid 쿠키 발급 (개인정보 아님: 랜덤 UUID) */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(UID_COOKIE)) {
    res.cookies.set(UID_COOKIE, crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = { matcher: ["/screener/:path*"] };
