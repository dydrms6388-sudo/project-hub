import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

/**
 * PKCE 코드 교환 콜백. Phase 1 은 휴대폰 OTP 단일이라 사용되지 않지만 (매직링크·OAuth 도입 대비) 표준 핸들러를 둔다.
 * `next` 는 같은 오리진 경로만 허용(오픈 리다이렉트 방지).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? ROUTES.home;
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : ROUTES.home;

  if (!code) return NextResponse.redirect(new URL(`${ROUTES.login}?error=missing_code`, url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`${ROUTES.login}?error=exchange_failed`, url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
