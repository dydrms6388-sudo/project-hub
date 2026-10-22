# BETWEEN — repo guide for Claude Code

한국형 성인 남성 소개팅·친구찾기 모바일 웹서비스. 허브(정적 사이트)와 **독립된** Next.js 서브프로젝트이며
별도 Vercel 프로젝트(root=`between`)로 배포한다. 허브의 `gen-pages.mjs` RESERVED 에 `between` 이 등록돼 있다.

## 아키텍처 (요약 — 상세는 ARCHITECTURE.md)

- Next.js 16 App Router + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui(new-york-v4, `radix-ui`) + motion
- 데이터: Supabase Postgres. 앱은 `pg` 로 접속해 **요청마다 `SET LOCAL ROLE authenticated` + `request.jwt.claims`**
  를 설정한다(PostgREST 와 동일) → 모든 읽기/쓰기에 RLS 가 그대로 적용된다. `src/lib/server/db.ts`
- 인증 드라이버 `AUTH_PROVIDER`: `supabase`(운영, Anonymous Auth) | `local`(개발/테스트, 자체 서명 JWT + auth shim)
- 저장소 드라이버 `STORAGE_PROVIDER`: `supabase`(비공개 버킷 + signed URL) | `local`(파일시스템)
- 타인 프로필은 **마스킹 뷰 `public.profile_cards`** 로만 조회. 원본 `profiles` 는 본인·운영자만.

## 명령어

```bash
npm install
pg_ctlcluster 16 main start          # 로컬 Postgres (Docker 없는 환경)
cp .env.example .env.local
npm run db:reset && npm run db:seed  # shim + 마이그레이션 + 데모 40명
npm run dev                          # http://localhost:3000
npm run typecheck && npm run lint
npm run test                         # vitest: unit(jsdom) + integration(실제 PG, between_test 자동 재생성)
npm run test:e2e                     # playwright: between_e2e + 프로덕션 빌드, 4개 기기 프로필
npm run build
npm run admin:grant -- <user-uuid>   # 로컬 운영자 지정 (익명 해제 + admin_roles)
```

## 보안 규칙 (반드시 지킬 것)

- 사용자 식별은 `getSession()`(서명/토큰 검증) 만 신뢰. 폼/쿼리/localStorage 의 ID 로 권한 판단 금지.
- DB 접근은 `withUser(session.claims, …)`. `withService` 는 인증 생성·삭제·레이트리밋·크론 등 서버 전용 작업만.
- 새 테이블 = RLS 활성화 + 최소 grant(컬럼 단위) + 통합 테스트(타인 접근 거부) 필수.
- SECURITY DEFINER 함수는 `set search_path = ''` + 스키마 한정 이름.
- 운영자 판단은 DB `public.is_admin()` (admin_roles + JWT `is_anonymous=false`).
- 연락처 URL 은 `validateContact()` 로 서버 검증·정규화 → DB CHECK(https) → 렌더 직전 `safeHref()`.
- 사진은 `sanitizePhoto()`(매직바이트·디코딩·EXIF 제거·WebP 재인코딩)를 거친 것만 저장, `/api/photos/:id` 로만 서빙.
- `dangerouslySetInnerHTML` 금지(eslint). SQL 은 파라미터 바인딩만(`src/lib/explore/query.ts` 참고).
- 성향(position) 등 민감정보는 별도 동의 없이는 저장 불가(DB 제약). 기본 비공개 필드: 몸무게·성향·동.
- 성인 확인은 자기 신고임을 숨기지 말 것(실제 본인인증으로 주장 금지).

## 개발 규칙

- 선택지 코드는 `src/lib/domain/options.ts` ↔ 마이그레이션 CHECK 제약 동기화 (`tests/unit/options-sync.test.ts`).
- 마이그레이션은 새 파일로 추가(`supabase/migrations/<timestamp>_*.sql`). 적용된 파일 수정 금지.
- 한 트랜잭션(`withUser` 콜백) 안에서 쿼리를 `Promise.all` 로 병렬 실행하지 말 것(같은 커넥션).
- Server Action 은 `run()` 래퍼 + zod 파싱 + `limitUser` 레이트리밋. 에러는 `toUserMessage` 로만 노출.
- UI: 다크 기본, 모바일 우선, 하단 고정 BottomNav(h-16 + safe-area) 를 고려한 하단 여백.

## 테스트

- 통합 테스트는 실제 Postgres 에 RLS 를 검증한다: `tests/integration/*`, 헬퍼 `tests/helpers/factory.ts`.
- E2E 는 하이드레이션 후 입력해야 한다(`go()` 헬퍼). 콘솔 에러 0 을 단언한다.
- 테스트를 지우거나 skip 해서 녹색을 만들지 말 것.

## 미완료 작업 복구

1. `PROGRESS.md`, `TASKS.md` 읽기 → 2. `git log --oneline -10` → 3. 위 명령어로 환경 복원 후 `npm run check`
