import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/auth/supabase";
import { env } from "@/lib/server/env";

// Supabase 이메일 연결/로그인 링크 콜백 (AUTH_PROVIDER=supabase 전용)
export async function GET(req: NextRequest) {
  const origin = env().APP_ORIGIN;
  const code = req.nextUrl.searchParams.get("code");
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/explore";
  // open redirect 방지: 내부 경로만 허용
  const next = /^\/[a-z/-]*$/.test(nextParam) ? nextParam : "/explore";
  if (env().AUTH_PROVIDER === "supabase" && code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/start?error=link`);
}
