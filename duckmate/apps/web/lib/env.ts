/**
 * env — 호환 re-export (H2). 실체는 `lib/env/public.ts`(NEXT_PUBLIC_*, 클라이언트 안전) + `lib/env/server.ts`(`server-only`).
 *
 * ⚠️ 이 파일을 import 하면 server.ts 까지 딸려온다(server-only → 클라이언트 번들에서 빌드 실패).
 *    "use client" 경로는 반드시 `@/lib/env/public` 을 직접 import 할 것. 서버 코드도 새로 쓸 때는 `@/lib/env/server` 를 권장.
 */
export { publicEnv, isProduction, type PublicEnv } from "./env/public";
export { serverEnv, gateCacheSecret, type ServerEnv } from "./env/server";
