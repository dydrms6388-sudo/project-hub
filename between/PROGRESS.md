# BETWEEN — PROGRESS

세션이 끊겨도 이 파일 + TASKS.md 를 읽고 이어서 진행한다. (재개 방법은 맨 아래)

## 현재 상태 (2026-10-22)

- [x] 환경: Node 22, 로컬 PostgreSQL 16 (Docker 없음 → Supabase 로컬 스택 대신 auth shim), Playwright Chromium 1194
- [x] `between/` Next.js 16 서브프로젝트, 허브 gen-pages RESERVED 등록
- [x] DB: 마이그레이션 4개 (스키마 / RLS·권한·뷰·RPC / Storage / 차단목록 RPC)
- [x] 서버 계층, Server Actions, Route Handlers, proxy(CSP nonce)
- [x] UI 전체 (온보딩·복구·탐색·필터·스와이프·좋아요/매칭·상세·내 프로필·수정·차단목록·운영자·법적고지·PWA)
- [x] 단위 62 + 통합 42 = 104 통과
- [x] E2E 20/20 통과 (iPhone 13·iPhone SE·Pixel 7·Desktop × 메인 12단계·신고/차단·접근통제·운영자 404·보안헤더/CSP)
- [x] 문서: CLAUDE.md, README, ARCHITECTURE, DEPLOYMENT, TASKS
- [x] 최종 npm run check 통과 → push → draft PR
- [ ] (승인 필요) Supabase/Vercel 실제 배포

## 이슈 기록

- 성인 연도 계산이 서버 시간대(UTC) 기준이던 버그 → KST 기준으로 수정 (TS + SQL)
- E2E: 하이드레이션 전 파일 입력 이벤트 유실 → `go()` 헬퍼로 networkidle 대기
- 한 트랜잭션 내 Promise.all 병렬 쿼리 → 순차 실행으로 수정 (pg 경고)
- shadcn 레지스트리 호스트가 네트워크 정책상 차단 → GitHub 원본에서 new-york-v4 컴포넌트 소스 사용

## 재개 방법

1. `cd between && npm install`
2. `pg_ctlcluster 16 main start` → `cp .env.example .env.local` → `npm run db:reset && npm run db:seed`
3. `npm run check && npm run test:e2e`
4. TASKS.md 의 미완료 항목 진행
- E2E: 가입 레이트리밋(IP당 8/시간)이 단일 IP 테스트에서 발동 → START_RATE_LIMIT_PER_HOUR 로 설정화 (운영 기본값 유지)
