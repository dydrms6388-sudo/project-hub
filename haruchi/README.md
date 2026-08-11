# 하루치 (haruchi)

> 입력을 없애고, 다음 달을 미리 보여주는 가계부.

허브(`tomatoeggcat.com`)의 정적 파이프라인과 **무관한 별도 프로젝트**다.
`gen-pages.mjs` 가 건드리지 않도록 RESERVED 에 `haruchi` 를 등록해 두었다.

## 이 서비스가 하지 않는 것

법적 제약이라 협상 대상이 아니다.

- 카드사·은행 웹사이트 **스크래핑 없음**. 신용정보법 개정으로 2021.8 부터
  마이데이터 허가 없는 스크래핑 기반 금융데이터 수집은 불가하다.
- 마이데이터 API 를 전제로 설계하지 않는다 (허가 요건 미충족).
- 금융 인증정보(아이디/비밀번호/공동인증서)를 받는 입력란이 없다. 컬럼도 없다.
- "토스 연동", "실시간 자동 연동" 같은 문구를 UI 에 쓰지 않는다. 그런 기능이 없다.
- 오픈뱅킹은 이용기관 등록(사업자) 이후의 일이다. 지금 코드에 없다.

데이터는 **사용자가 붙여넣거나 올린 텍스트**에서만 온다.

> 위 내용은 법률 자문이 아니다. 출시 전 개인정보처리방침·이용약관은 전문가
> 검토를 받는다는 전제로 진행한다.

## 구조

```
haruchi/
  packages/
    schema/      zod 스키마 + 타입 단일 소스 (순수 TS)
    parser/      문자·알림 텍스트 → 거래 (순수 TS, 어댑터 패턴)
    categorizer/ 자동 분류 3단 파이프라인 + 시드 규칙 (순수 TS)
  apps/web/   Next.js 15 App Router
  supabase/migrations/  스키마 + RLS + 카테고리 시드
  scripts/    CI 게이트 (RLS, 클라이언트 시크릿, 시드 동기화)
```

`packages/*` 는 React·Next·Supabase 에 의존하지 않는 순수 함수 모음이다.
I/O 가 없어 테스트가 빠르고, 나중에 앱으로 이식된다.
**금액은 전부 원 단위 정수다. float 을 쓰지 않는다.**

## 개발

```bash
pnpm install
pnpm test          # vitest, 커버리지 게이트 90%
pnpm typecheck
node scripts/check-rls.mjs
node scripts/check-client-secrets.mjs
node scripts/check-seed-sync.mjs
pnpm --filter @haruchi/web dev
```

환경변수(`apps/web/.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

없어도 앱은 뜬다. `/paste` 는 파싱까지 브라우저에서 처리하므로 로그인·저장소
없이도 동작한다. 저장만 막힌다.

`SUPABASE_SERVICE_ROLE_KEY` 는 이 앱 어디에서도 읽지 않는다. 모든 접근은 RLS 를
통과한다.

## 새 카드사 어댑터 추가

건드릴 파일은 **2개**다. 그보다 많아지면 설계가 틀어진 것이다.

1. `packages/parser/src/adapters/<발신처>.ts` — `createCardAdapter` 또는
   `createBankAdapter` 에 넘길 설정. 머리말 정규식과 토큰 순서만 다르다.
2. `packages/parser/test/fixtures/<발신처>.ts` — 픽스처 8케이스 이상
   (정상/취소/할부/해외/멀티라인/중복/깨진문자/연도누락).

그다음 `adapters/index.ts` 와 `fixtures/index.ts` 배열에 한 줄씩 추가한다.

## 새 분류 규칙 추가

시드 규칙(200여 개)은 **코드에** 있다. 배포와 함께 갱신되어야 하고 사용자별
규칙과 섞이면 안 되기 때문이다.

- 키워드만 추가할 때: `packages/categorizer/src/seed-rules.ts` 한 곳.
- 카테고리 자체를 추가할 때: `src/categories.ts` 와
  `supabase/migrations/0002_seed_categories.sql` 를 **함께** 고친다.
  어긋나면 `scripts/check-seed-sync.mjs` 가 CI 에서 막는다.

키워드 작성 시 주의:

- 긴 키워드가 이긴다. "동물병원"이 "병원"보다 먼저 매칭되므로 상·하위 개념을
  따로 신경 쓸 필요가 없다.
- 짧고 흔한 조각은 넣지 않는다. "펫"은 "카펫"에, "이자"는 "이자카야"에 걸린다.
  **오분류는 미분류보다 나쁘다** — 사용자가 알아채지 못한 채 통계가 틀어진다.
- 영문 약어는 `prefix` 로 잠근다. "CU"를 contains 로 두면 "DOCUMENT"에 걸린다.

## 파서 설계 원칙

- **LLM 을 쓰지 않는다.** 느리고, 비싸고, 비결정적이고, 금융 데이터가 외부로 나간다.
- **확신이 없으면 실패시킨다.** 못 읽은 블록은 `unparsed` 로 원문 그대로 돌려준다.
  틀린 금액을 자신 있게 등록하는 것이 최악이다.
- **시스템 타임존을 읽지 않는다.** KST 고정이며 "지금"은 인자로 주입받는다.
- `dedupe_key = sha256(last4|시각|금액|상호앞8자|취소여부)`.
  시각이 없는 소스(명세서)는 일 단위 스탬프를 쓰고, 느슨한 매칭으로 이어 붙인다.

## 진행 상황

- [x] Phase 0 — 모노레포, Next 15, 디자인 토큰, CI 게이트
- [x] Phase 1 — 파서 어댑터 7종, dedupe, `/paste`, 스키마 + RLS
- [~] Phase 2 — 분류 파이프라인·시드 규칙·교정 학습 완료 (실측 정확도 85.3%).
      대시보드 "하루 가용액" 히어로는 예산 엔진(Phase 3)과 DB 가 필요해 남음
- [ ] Phase 3 — 예산 + 목표
- [ ] Phase 4~9 — 스펙 12장 로드맵 참고
