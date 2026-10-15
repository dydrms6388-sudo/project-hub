/**
 * 미들웨어용 Supabase 클라이언트 — 세션 리프레시 + 쿠키 동기화 (@supabase/ssr 표준 패턴).
 * 반환한 `response` 를 그대로(또는 쿠키를 복사해) 돌려줘야 리프레시된 토큰이 브라우저에 저장된다.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@duckmate/db";

export type MiddlewareSession = {
  supabase: SupabaseClient<Database>;
  response: NextResponse;
  user: User | null;
};

export async function updateSession(request: NextRequest): Promise<MiddlewareSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  if (!url || !anonKey) {
    // env 미설정(빌드/프리뷰): 세션 없음으로 취급. 게이트는 로그인으로 보낸다.
    return {
      supabase: null as unknown as SupabaseClient<Database>,
      response,
      user: null,
    };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() 는 Auth 서버에 토큰을 검증한다(getSession 은 쿠키만 읽으므로 신뢰 금지).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}
