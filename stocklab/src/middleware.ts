import { NextResponse, type NextRequest } from "next/server";

const UID_COOKIE = "sl_uid";
export const FRESH_HEADER = "x-sl-anon-fresh";

/**
 * 비로그인 사용량 식별용 익명 uid 쿠키 발급 (개인정보 아님: 랜덤 UUID).
 * 쿠키 없이 들어온 요청은 요청 헤더 x-sl-anon-fresh=1 을 달아 usage.ts 가 IP 단독 키로 집계하게 한다
 * (쿠키를 매번 버리는 클라이언트가 한도를 우회하지 못하도록).
 */
export function middleware(req: NextRequest) {
  const hasUid = Boolean(req.cookies.get(UID_COOKIE));
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set(FRESH_HEADER, hasUid ? "0" : "1");
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  if (!hasUid) {
    res.cookies.set(UID_COOKIE, crypto.randomUUID(), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = { matcher: ["/screener/:path*"] };
