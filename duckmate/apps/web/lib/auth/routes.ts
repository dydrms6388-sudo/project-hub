/**
 * 라우트 → 게이트 대상 분류. C3 §1 표가 유일한 소스(값을 여기로 옮김).
 * 미들웨어와 layout 의 requireGate() 가 같은 함수를 쓴다.
 */
import type { RouteTarget, VerifyLevel, Enums } from "@duckmate/db";

/** L2 라우트: 추천·매칭·채팅·타인 프로필. L1 라우트(온보딩 완료 필요): 내 프로필·설정·신고 */
export const ROUTE_MIN_LEVEL: Readonly<Record<string, VerifyLevel>> = {
  "/home": 2,
  "/reco": 2,
  "/match": 2,
  "/chat": 2,
  "/profile": 2,
  "/me": 1,
  "/settings": 1,
  "/report": 1,
  "/blocks": 1, // E4: 차단 목록 (12_flows 의 /settings/blocks 는 여기로 redirect)
  // Phase 2·3·5 (라우트만 예약)
  "/shop": 2,
  "/likes-you": 2,
  "/play": 2,
  "/events": 2,
  "/ranking": 2,
};

/** 온보딩 라우트 ↔ step (age/phone 은 계정 생성 전이라 step 에 없음) */
export const ONBOARDING_ROUTE_STEP: Readonly<Record<string, Exclude<Enums["onboarding_step"], "verify" | "done">>> = {
  "/onboarding/basic": "basic",
  "/onboarding/hobbies": "hobbies",
  "/onboarding/quiz": "quiz",
  "/onboarding/card": "card",
  "/onboarding/photos": "photos",
};

export const ROUTES = {
  login: "/login",
  age: "/onboarding/age",
  phone: "/onboarding/phone",
  verify: "/verify",
  home: "/home",
  me: "/me",
  suspended: "/suspended",
  appeal: "/appeal",
  restore: "/account/restore",
  blockedAge: "/blocked/age",
  admin: "/admin",
  notFound: "/404",
} as const;

function stripTrailingSlash(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function classifyRoute(rawPathname: string): RouteTarget {
  const pathname = stripTrailingSlash(rawPathname);

  if (matchesPrefix(pathname, ROUTES.admin)) return { kind: "admin" };

  if (pathname === ROUTES.login) return { kind: "auth", route: "login" };
  if (pathname === ROUTES.age) return { kind: "auth", route: "age" };
  if (pathname === ROUTES.phone) return { kind: "auth", route: "phone" };
  if (pathname === ROUTES.blockedAge) return { kind: "auth", route: "blocked_age" };

  const step = ONBOARDING_ROUTE_STEP[pathname];
  if (step) return { kind: "onboarding", step };
  if (matchesPrefix(pathname, "/onboarding")) return { kind: "onboarding", step: "basic" }; // 알 수 없는 온보딩 경로 → 현재 단계로

  if (pathname === ROUTES.verify) return { kind: "verify" };
  if (pathname === ROUTES.suspended) return { kind: "status", route: "suspended" };
  if (pathname === ROUTES.appeal) return { kind: "status", route: "appeal" };
  if (pathname === ROUTES.restore) return { kind: "status", route: "restore" };

  for (const [prefix, minLevel] of Object.entries(ROUTE_MIN_LEVEL)) {
    if (matchesPrefix(pathname, prefix)) return { kind: "app", minLevel };
  }
  return { kind: "public" };
}

/** 미들웨어가 건드리지 않는 경로(정적·API·헬스) */
export function isBypassedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}
