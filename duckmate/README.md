# 덕메이트 (DuckMate)

"같은 걸 좋아하는 사람이랑 만나는 앱." 취미·덕질 궁합 → 함께 하는 활동 → 만남.

- `apps/web` — 서비스 본체 (Next.js 15 App Router + Supabase)
- `apps/company` — 회사 소개 사이트 (완전 정적 export)
- `packages/ui` — 디자인 시스템 (shadcn 기반)
- `packages/db` — DB 타입·쿼리 헬퍼
- `packages/game-engine` — Phase 2 게임 엔진 (Phase 1 게이트 통과 전 구현 금지)
- `supabase/` — 마이그레이션·Edge Functions
- `docs/agents/` — 에이전트 산출물 (01~30)

> 이 디렉터리는 상위 `project-hub` 정적 허브와 별개로 배포된다 (Vercel root = `duckmate/apps/web`, `duckmate/apps/company`).
