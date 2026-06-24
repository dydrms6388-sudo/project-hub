import type { DefaultSession } from "next-auth";

// 세션/JWT 에 과금 클레임(plan, credits)을 추가하기 위한 타입 확장.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: "FREE" | "PRO";
      credits: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    plan?: "FREE" | "PRO";
    credits?: number;
  }
}
