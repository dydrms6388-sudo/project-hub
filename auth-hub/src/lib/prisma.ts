import { PrismaClient } from "@prisma/client";

// 서버리스(Vercel) 환경에서 핫 리로드/콜드스타트 시 커넥션 폭증을 막기 위한 싱글톤.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
