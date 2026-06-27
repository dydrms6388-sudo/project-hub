import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mintMobileToken } from "@/lib/mobile-token";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────
// 네이티브 로그인 브리지.
// 앱이 expo-web-browser 로 이 URL 을 연다:
//   {AUTH_URL}/mobile/issue?redirect=myapp://auth
// 흐름:
//   1) 세션 없음 → /login 으로 보내고 callbackUrl 로 이 URL 을 보존(로그인 후 복귀).
//   2) 세션 있음 → 네이티브 베어러 JWT 발급 → redirect 스킴으로 토큰 전달.
//      myapp://auth#token=<jwt>  (프래그먼트로 보내 서버 로그/리퍼러 유출 최소화)
//
// 허용 스킴 화이트리스트(ALLOWED_MOBILE_SCHEMES, 쉼표구분)로 오픈 리다이렉트 방지.
// ─────────────────────────────────────────────────────────────

function isAllowedRedirect(redirect: string): boolean {
  try {
    const u = new URL(redirect);
    const allowed = (process.env.ALLOWED_MOBILE_SCHEMES || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    // 스킴(예: "nyangstat:") 단위 화이트리스트. 미설정 시 https 만 허용(개발 편의).
    const scheme = u.protocol.replace(":", "").toLowerCase();
    if (allowed.length === 0) return scheme === "https";
    return allowed.includes(scheme);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirect = url.searchParams.get("redirect") || "";

  if (!redirect || !isAllowedRedirect(redirect)) {
    return NextResponse.json(
      { error: "invalid_redirect", hint: "set ALLOWED_MOBILE_SCHEMES" },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", url.origin);
    // 로그인 후 이 issue URL 로 복귀하도록 callbackUrl 보존.
    loginUrl.searchParams.set("callbackUrl", url.pathname + url.search);
    return NextResponse.redirect(loginUrl);
  }

  const token = await mintMobileToken({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  const dest = new URL(redirect);
  // 프래그먼트로 토큰 전달(쿼리보다 유출 위험 낮음).
  dest.hash = `token=${encodeURIComponent(token)}`;
  return NextResponse.redirect(dest.toString());
}
