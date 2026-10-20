# BETWEEN — PROGRESS

세션이 끊겨도 이 파일 + TASKS.md 를 읽고 이어서 진행한다.

## 현재 상태 (2026-10-20)
- [x] 환경 확인: Node 22, 로컬 PostgreSQL 16 (Docker 없음 → Supabase 로컬 스택 불가), Playwright Chromium 1194
- [x] 프로젝트 생성 `between/` (허브 정적사이트와 분리된 Next.js 16 서브프로젝트)
- [x] 패키지 설치 (Next 16.4, React 19.3, Tailwind 4, Zod 4, TanStack Query 5, Vitest 5, Playwright 1.56.1)
- [x] DB 설계: supabase/migrations 3개 (스키마 / RLS·권한·뷰·RPC / Storage)
- [x] 로컬 auth shim + db-setup 스크립트
- [x] 도메인/검증/쿼리빌더/서버 계층 (env, db, auth 2드라이버, storage 2드라이버, 이미지 정화)
- [x] 통합 테스트 42개 통과 (RLS/IDOR/마스킹/매칭/연락처/차단/신고/운영/사진/레이트리밋)
- [ ] UI (온보딩, 탐색, 스와이프, 좋아요/매칭, 내 프로필, 상세, 운영자)
- [ ] Server Actions / Route Handlers
- [ ] 단위 테스트, E2E
- [ ] 문서, 빌드, 최종 검증

## 재개 방법
1. `cd between && npm install`
2. `pg_ctlcluster 16 main start` (로컬) → `cp .env.example .env.local` → `npm run db:reset && npm run db:seed`
3. TASKS.md 의 미완료 항목부터 진행
