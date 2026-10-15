/**
 * 미들웨어 — 세션 리프레시 + 경량 게이트 (C3 §0-3 순서).
 *
 *  - 세션: @supabase/ssr updateSession (getUser 검증, 쿠키 동기화)
 *  - 게이트 상태: get_gate_state() RPC 1회 → HMAC 서명 쿠키 `dm_gate` 로 60s 캐시
 *    (상태를 바꾸는 서버 액션은 invalidateGateCache() 로 쿠키를 지운다)
 *  - 판정은 lib/auth/gate.ts evaluateGate() (layout 의 requireGate 와 동일 함수). 미들웨어는 1차 방어,
 *    각 그룹 layout 이 DB 를 직접 보고 다시 판정한다(캐시 위·변조 시에도 안전).
 *  - (admin) 은 app_role() admin/moderator 가 아니면 404 로 rewrite.
 */
import { NextResponse, type NextRequest } from "next/server";
import { parseGateState } from "@duckmate/db";
import type { GateState } from "@duckmate/db";
import { updateSession } from "@/lib/supabase/middleware";
import { classifyRoute, isBypassedPath, ROUTES } from "@/lib/auth/routes";
import { GATE_CACHE_TTL_SEC, GATE_COOKIE, decodeGateCookie, encodeGateCookie, evaluateGate } from "@/lib/auth/gate";
import { gateCacheSecret } from "@/lib/env/server";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isBypassedPath(pathname)) return NextResponse.next();

  const target = classifyRoute(pathname);
  const { supabase, response, user } = await updateSession(request);

  // 공개 라우트 + 세션 없음: 바로 통과 (DB 조회 없음)
  if (!user && target.kind === "public") return response;

  let state: GateState | null = null;
  let cacheHit = false;
  const secret = gateCacheSecret();

  if (user) {
    if (secret) {
      state = await decodeGateCookie(request.cookies.get(GATE_COOKIE)?.value, user.id, secret);
      cacheHit = state !== null;
    }
    if (!state) {
      const { data, error } = await supabase.rpc("get_gate_state");
      if (error) console.error("[middleware] get_gate_state failed", error.message);
      state = parseGateState(data);
    }
  }

  const result = evaluateGate(state, target);

  let out: NextResponse;
  if (result.allow) {
    out = response;
  } else if (result.code === "FORBIDDEN" && target.kind === "admin") {
    // 권한 없음은 404 와 동일 화면 (존재 여부 비노출)
    out = NextResponse.rewrite(new URL(ROUTES.notFound, request.url));
  } else {
    const url = request.nextUrl.clone();
    url.pathname = result.redirectTo;
    url.search = "";
    if (result.code === "NOT_AUTHENTICATED" && target.kind !== "public") url.searchParams.set("next", pathname);
    out = NextResponse.redirect(url);
  }

  // 리프레시된 세션 쿠키를 리다이렉트/리라이트 응답에도 복사
  if (out !== response) {
    for (const c of response.cookies.getAll()) out.cookies.set(c);
  }
  out.headers.set("x-dm-gate", result.allow ? "allow" : result.code);

  // 게이트 캐시 쿠키 (세션 있고 서명 키 있을 때만). 미들웨어가 DB 를 본 경우에만 갱신
  if (user && state && secret && !cacheHit) {
    out.cookies.set(GATE_COOKIE, await encodeGateCookie(user.id, state, secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GATE_CACHE_TTL_SEC,
    });
  } else if (!user && request.cookies.has(GATE_COOKIE)) {
    out.cookies.delete(GATE_COOKIE);
  }
  return out;
}

export const config = {
  matcher: [
    // 정적 파일·이미지 최적화·API 제외 (api 는 라우트 핸들러가 자체 인증)
    "/((?!_next/static|_next/image|api/|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
