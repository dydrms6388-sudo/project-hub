# 덕메이트 (DuckMate)

"같은 걸 좋아하는 사람이랑 만나는 앱" — 취미·덕질 궁합 기반 데이팅 서비스.

전체 스펙: [`docs/ORCHESTRATOR_SPEC.md`](docs/ORCHESTRATOR_SPEC.md) · 에이전트 산출물: [`docs/agents/`](docs/agents/)

## 구조 (pnpm workspaces + Turborepo)

```
apps/web         # 메인 서비스 (Next.js 15 App Router + Supabase)
apps/company     # 회사 소개 사이트 (Next.js SSG, output: export)
packages/ui      # 디자인 시스템 컴포넌트
packages/db      # DB 타입
packages/game-engine  # Phase 2 (Phase 1 게이트 통과 전 비어 있음)
supabase/        # 마이그레이션 SQL + Edge Functions
```

## 개발

```bash
cd duckmate
pnpm install
pnpm build        # 전체 빌드
pnpm typecheck
pnpm dev          # web:3000, company:3001
```

환경변수는 `.env.example` 참고 — 실제 키는 Vercel/Supabase 대시보드에만 (커밋 금지).

## 배포

- Vercel 프로젝트 2개: root=`duckmate/apps/web`, root=`duckmate/apps/company`
- Supabase 프로덕션 1개: `supabase/migrations/` 적용
- 배포 게이트 상태는 `docs/DEPLOY_LOG.md` 참고

> 이 디렉터리는 tomatoeggcat 허브의 gen-pages 파이프라인과 무관한 별도 프로젝트다
> (`gen-pages.mjs` RESERVED 에 `duckmate` 등록됨 — illusion-lab 과 같은 방식).
