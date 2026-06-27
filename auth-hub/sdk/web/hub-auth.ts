// ════════════════════════════════════════════════════════════════════
// hub-auth.ts — 웹 마이크로서비스용 허브 SSO/과금 클라이언트 (Next.js App Router)
//
// 이 파일을 각 앱의 `src/lib/hub-auth.ts` 로 복사해 쓴다.
// 프레임워크 비종속(원격 검증 기반): next-auth 의존성이 없어도 동작한다.
//   - 인증/과금 상태: 허브 `/api/me` 에 쿠키를 전달해 확인(SSO).
//   - 미들웨어: 세션 쿠키 유무로 빠른 게이트 → 없으면 허브 `/login` 으로.
//   - 크레딧 차감: 허브 `/api/credits/deduct` 프록시.
//
// 필요한 ENV (앱 .env):
//   NEXT_PUBLIC_HUB_URL = https://tomatoeggcat.com   (허브 주소)
// SSO 쿠키 공유 전제: 허브와 앱이 같은 상위 도메인(.tomatoeggcat.com) 또는 apex 서빙.
// 허브에 AUTH_COOKIE_DOMAIN=.tomatoeggcat.com 설정 필요.
// ════════════════════════════════════════════════════════════════════

import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const HUB_URL =
  process.env.NEXT_PUBLIC_HUB_URL || "https://tomatoeggcat.com";

// Auth.js v5 세션 쿠키 이름(https=__Secure- 접두).
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

export interface HubUser {
  id: string;
  name: string | null;
  email: string | null;
  plan: "FREE" | "PRO";
  credits: number;
}

/** 원본 쿠키 헤더 문자열로 허브에 현재 사용자 조회. 비로그인/오류 시 null. */
export async function getHubUserByCookie(
  cookieHeader: string
): Promise<HubUser | null> {
  if (!cookieHeader) return null;
  try {
    const res = await fetch(`${HUB_URL}/api/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { authenticated: boolean; user?: HubUser };
    return data.authenticated && data.user ? data.user : null;
  } catch {
    return null;
  }
}

/** App Router 서버 컴포넌트/액션에서 현재 사용자 조회(요청 쿠키 자동 전달). */
export async function getHubUser(): Promise<HubUser | null> {
  const c = await cookies();
  const cookieHeader = c.getAll().map((x) => `${x.name}=${x.value}`).join("; ");
  return getHubUserByCookie(cookieHeader);
}

/** PRO 플랜 필요 여부 게이트. */
export async function requirePlan(plan: "PRO" = "PRO"): Promise<HubUser> {
  const user = await getHubUser();
  if (!user) throw new HubAuthError("unauthenticated");
  if (plan === "PRO" && user.plan !== "PRO") throw new HubAuthError("plan_required");
  return user;
}

/** 크레딧 N개 이상 보유 여부 게이트. */
export async function requireCredits(amount: number): Promise<HubUser> {
  const user = await getHubUser();
  if (!user) throw new HubAuthError("unauthenticated");
  if (user.credits < amount) throw new HubAuthError("insufficient_credits");
  return user;
}

export class HubAuthError extends Error {
  constructor(
    public readonly code:
      | "unauthenticated"
      | "plan_required"
      | "insufficient_credits"
  ) {
    super(code);
    this.name = "HubAuthError";
  }
}

/** 서버에서 크레딧 차감(허브 프록시). 현재 요청 쿠키를 그대로 전달. */
export async function deductCredits(params: {
  amount: number;
  service: string;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; balance: number; applied: boolean }
  | { ok: false; error: string; required?: number; available?: number }
> {
  const c = await cookies();
  const cookieHeader = c.getAll().map((x) => `${x.name}=${x.value}`).join("; ");
  const res = await fetch(`${HUB_URL}/api/credits/deduct`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    cache: "no-store",
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, ...data };
  return { ok: true, ...data };
}

// ── 링크 헬퍼(클라이언트/서버 공용) ──
export function hubLoginUrl(callbackUrl?: string): string {
  const u = new URL(`${HUB_URL}/login`);
  if (callbackUrl) u.searchParams.set("callbackUrl", callbackUrl);
  return u.toString();
}
export function hubPricingUrl(): string {
  return `${HUB_URL}/pricing`;
}
export function hubLogoutUrl(callbackUrl?: string): string {
  const u = new URL(`${HUB_URL}/api/auth/signout`);
  if (callbackUrl) u.searchParams.set("callbackUrl", callbackUrl);
  return u.toString();
}

// ── 미들웨어 팩토리 ──
// 보호 경로에 세션 쿠키가 없으면 허브 로그인으로 보낸다(빠른 게이트).
// 세밀한 plan/credit 검증은 페이지/액션에서 requirePlan/requireCredits 로.
export function createHubMiddleware(opts: {
  protectedPrefixes: string[];
  /** 로그인 후 돌아올 앱의 공개 URL(절대). 미지정 시 요청 origin 사용. */
  appOrigin?: string;
}) {
  return function middleware(req: NextRequest) {
    const { pathname, origin } = req.nextUrl;
    const isProtected = opts.protectedPrefixes.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isProtected) return NextResponse.next();

    const hasSession = SESSION_COOKIE_NAMES.some((n) => req.cookies.get(n));
    if (hasSession) return NextResponse.next();

    const back = `${opts.appOrigin || origin}${pathname}`;
    return NextResponse.redirect(hubLoginUrl(back));
  };
}

/** 서버 컴포넌트에서 비로그인 시 허브 로그인으로 보내는 헬퍼. */
export async function getHubUserOrLoginUrl(): Promise<
  { user: HubUser } | { loginUrl: string }
> {
  const user = await getHubUser();
  if (user) return { user };
  const h = await headers();
  const path = h.get("x-pathname") || "/";
  const origin = h.get("x-forwarded-host")
    ? `https://${h.get("x-forwarded-host")}`
    : "";
  return { loginUrl: hubLoginUrl(`${origin}${path}`) };
}
