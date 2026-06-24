import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { Kakao, Naver } from "@/lib/providers";

// ─────────────────────────────────────────────────────────────
// Auth.js v5 중앙 설정.
// - 프로바이더: Google(내장) + 카카오/네이버(커스텀)
// - 어댑터: Prisma (User/Account/Session 테이블에 영속)
// - 세션 전략: JWT (stateless — 마이크로서비스에서 검증 가능)
//   * DB 어댑터를 쓰면서도 session.strategy="jwt" 이면 로그인 계정만 DB에 저장하고
//     세션 자체는 JWT 쿠키로 운반된다(서버리스/SSO에 유리).
// ─────────────────────────────────────────────────────────────

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  // 서브도메인 SSO: AUTH_COOKIE_DOMAIN=.tomatoeggcat.com 설정 시 전 서브도메인 공유.
  cookies: cookieDomain
    ? {
        sessionToken: {
          name: `__Secure-authjs.session-token`,
          options: {
            domain: cookieDomain,
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
          },
        },
      }
    : undefined,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Naver({
      clientId: process.env.NAVER_CLIENT_ID!,
      clientSecret: process.env.NAVER_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // 로그인 직후/매 요청마다 JWT 에 userId·plan·credit 캐시를 실어 stateless 검증 지원.
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.uid = user.id;
      }
      // 최초 로그인 또는 세션 갱신 시 과금 캐시를 DB에서 동기화.
      if (token.uid && (trigger === "signIn" || trigger === "update" || token.plan === undefined)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { plan: true, creditBalance: true },
        });
        if (dbUser) {
          token.plan = dbUser.plan;
          token.credits = dbUser.creditBalance;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.plan = (token.plan as "FREE" | "PRO") ?? "FREE";
        session.user.credits = (token.credits as number) ?? 0;
      }
      return session;
    },
  },
});
