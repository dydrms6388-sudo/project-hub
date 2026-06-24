import { auth } from "@/auth";
import { NextResponse } from "next/server";

// 보호 라우트 예시: /dashboard, /credits, /account 는 로그인 필요.
// 비로그인 시 /login 으로 리다이렉트(원래 목적지를 callbackUrl 로 보존).
const PROTECTED_PREFIXES = ["/dashboard", "/account", "/credits"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // 정적 파일/이미지/auth API 는 미들웨어 제외.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
