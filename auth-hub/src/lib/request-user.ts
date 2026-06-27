import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractBearer, verifyMobileToken } from "@/lib/mobile-token";

// ─────────────────────────────────────────────────────────────
// 요청 주체(사용자) 해석기.
// 마이크로서비스/네이티브 앱이 호출하는 API 라우트는 두 가지 인증 방식을 모두 허용:
//   1) 웹: Auth.js 세션 쿠키(SSO) → auth()
//   2) 네이티브: Authorization: Bearer <mobile JWT> → verifyMobileToken()
// 반환값에는 항상 최신 plan/credits 를 DB 에서 채워준다.
// ─────────────────────────────────────────────────────────────

export interface RequestUser {
  id: string;
  email: string | null;
  name: string | null;
  plan: "FREE" | "PRO";
  credits: number;
  via: "session" | "bearer";
}

export async function getRequestUser(req: Request): Promise<RequestUser | null> {
  // 1) 베어러(네이티브) 우선 — 명시적으로 토큰을 보냈으면 그것을 신뢰.
  const bearer = extractBearer(req);
  if (bearer) {
    const claims = await verifyMobileToken(bearer);
    if (claims?.uid) {
      const dbUser = await prisma.user.findUnique({
        where: { id: claims.uid },
        select: { id: true, email: true, name: true, plan: true, creditBalance: true },
      });
      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          plan: dbUser.plan as "FREE" | "PRO",
          credits: dbUser.creditBalance,
          via: "bearer",
        };
      }
    }
    return null; // 베어러를 보냈는데 무효면 쿠키로 폴백하지 않는다.
  }

  // 2) 세션 쿠키(웹 SSO)
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      plan: (session.user.plan as "FREE" | "PRO") ?? "FREE",
      credits: session.user.credits ?? 0,
      via: "session",
    };
  }

  return null;
}
