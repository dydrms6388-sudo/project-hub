# E5 · 회사 소개 사이트 구현 (`apps/company`) — 덕메이트(DuckMate)

> 작성: 서브에이전트 E5 (회사 소개 사이트 구현) · 기준일 2026-08-19
> 입력: `13_company_site.md`(C4 IA·카피 — 카피의 단일 기준) · `06_PRD.md`(F-CMP-01: Phase 1 = 홈+법적고지+문의) · `10_brand.md`/`11_design_system.md`(토큰, D-6 company 복제 지시) · `apps/web/app/globals.css`(C2 확정 토큰 원본).
> 검증: `pnpm --filter @duckmate/company build` ✅ (정적 export 9 라우트 생성 성공)

---

## 다음 에이전트에게 넘기는 결정사항

### D-1. 문의 폼 = "엔드포인트 우선 + mailto 폴백" 2모드 (C4 D-4 의 단계적 구현)

`output: "export"` 라 **Server Action·Route Handler·미들웨어를 쓸 수 없다.** 전송은 전부 클라이언트에서 일어난다. `components/contact-form.tsx` 는 빌드 타임 env 로 모드를 고정한다.

| 조건 | 동작 |
|---|---|
| `NEXT_PUBLIC_CONTACT_ENDPOINT` 설정됨 | `fetch(endpoint, {method:"POST", json})` → 접수. 실패 시 에러 배너 + **mailto 보조 링크**(C4 D-4 허용 범위) |
| 미설정(현재 기본값) + `company.contactEmail` 있음 | 입력값을 제목·본문에 채운 **mailto 폴백**으로 메일 클라이언트 오픈 |
| 미설정 + `contactEmail` 도 빈 값(**지금 상태**) | 폼 대신 "문의 접수 채널 준비 중" 안내 카드 렌더 (죽은 폼·빈 mailto 노출 방지) |

- **근거**: C4 D-4 는 "mailto 단독 폴백 불허 · Edge Function `company-contact` 가 Phase 1 필수"라고 못박았지만, 그 Edge Function 과 `contact_messages` 테이블은 **D1/백엔드 소관이며 아직 없다**. E5 의 파일 소유권(`apps/company/**`) 밖이라 만들 수 없다. 그래서 **엔드포인트 연동 코드를 완성해 두고 env 한 줄로 활성화**되게 하고, 그때까지는 접수 창구가 비지 않도록 mailto 폴백을 둔다. Edge Function 배포 후 `NEXT_PUBLIC_CONTACT_ENDPOINT` 만 설정하면 C4 D-4 목표 상태가 되고, company 코드 수정은 필요 없다.
- 전송 페이로드: `{ name, email, category, body, website }` (`website` = honeypot). Edge Function 구현자는 이 키 이름을 맞출 것. CORS 는 company 도메인만 허용.
- 폼 상단 고정 안내로 **신고는 앱 내 신고 기능**임을 명시했다(24h SLA 는 앱 내 신고에만 적용 — C4 D-4).

### D-2. `/safety` 를 Phase 1 에 포함(C4 D-1 대비 확대) — 빈 라우트 아님

C4 D-1 은 `/safety` 를 Phase 5 로, Phase 1 라우트를 3개로 제한했으나, **오케스트레이터 E5 지시서가 `app/safety/page.tsx` 를 Phase 1 구현 항목으로 명시**해 이를 따랐다. C4 §2.2 에 대외 순화 카피가 이미 확정돼 있어 **콘텐츠가 완비된 실 페이지**로 만들 수 있었고(§5.1 "빈 라우트 인덱싱 방지" 취지 위배 없음), PRD 공통 확정 10항 "안전 정책 전면 노출"에도 부합한다.
- 홈 `#safety` 섹션은 C4 §2.1 대로 **약속 4개 카드 + 24h 배지**를 유지하고, 하단에 `/safety` 로 가는 "자세히 보기" 링크를 붙였다(C4 §2.1 마이크로카피의 Phase 5 형태를 그대로 적용).
- 여전히 **만들지 않은 라우트**: `/service`, `/team`, `/news`, `/careers`, `/wiki` — 폴더조차 없다. 헤더·푸터에도 링크 없음.

### D-3. 토큰은 `apps/web/app/globals.css` 의 **복제본**이다 (C2 D-6 지시 이행)

`apps/company/app/globals.css` = web 파일 전문 복사 + 최상단 경고 주석. 값 변경 0건, `@source "../../../packages/ui/src"` 포함(company 도 경로 깊이가 같아 그대로 유효). **web 토큰이 바뀌면 이 파일을 다시 복제해야 한다** — 자동 동기화 장치는 없다. (별도 Next 앱 = 별도 Tailwind 빌드라 CSS 공유 불가.)

### D-4. 사업자 정보 스키마를 C4 §3.2 형태로 교체함 (기존 `config/company.ts` 파괴적 변경)

기존 파일은 플랫 문자열 + 값 자리에 `[TODO_사업자정보:...]` 를 직접 박아둔 형태였는데, C4 §3.2 타입(`privacyOfficer`/`youthOfficer` 객체, `hostingProvider`, `mailOrderNo`)과 "빈 문자열로 커밋 → 렌더 시 치환" 규칙으로 **교체**했다. company.ts 를 import 하는 곳은 `apps/company/**` 뿐이라 영향 범위는 이 앱 내부로 한정된다.
- `display(v)` = 빈 값이면 `[TODO_사업자정보]` 반환(화면용), `isFilled(v)` = 실값 여부(JSON-LD·mailto 용), `missingCompanyFields()` = 경고용 목록.
- **JSON-LD 에는 플레이스홀더를 넣지 않는다** — 미입력 필드는 구조화 데이터에서 아예 생략(기계 판독 데이터에 거짓값 금지). 화면 표는 반대로 플레이스홀더를 그대로 노출(스펙 §0-4).
- 빌드 경고는 루트 `app/layout.tsx` 모듈 최상단에서 `console.warn` (C4 D-2 `TodoBuildWarning`). 현재 **11건 경고 출력, 빌드는 통과**.

### D-5. 루트 `turbo.json` 에 env 추가 요청 (E5 권한 밖)

`turbo.json` 의 `tasks.build.env` 에 아래 3개가 없어 **Turbo 캐시가 env 변경을 감지하지 못한다**(도메인 바꿔도 캐시 히트로 옛 URL 이 남을 수 있음). 루트 파일 소유자가 추가할 것:
`NEXT_PUBLIC_COMPANY_URL`, `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_CONTACT_ENDPOINT`.

### D-6. E6(SEO 게이트)에게: 검사 규칙 예외 1건

정적 export 산출물 중 **`out/404.html` 에만 `<meta name="robots" content="noindex">` 가 붙는다**(Next 의 not-found 기본 동작, 제거 불가·제거 불필요). "company 산출물 noindex 0건" 검사는 `404.html` 을 제외할 것. 그 외 `index/safety/legal/contact` 는 전부 `index, follow`. sitemap 항목(4개) = 실제 라우트 집합(404 제외)과 일치한다.

### D-7. 미구현·후속

- **OG 이미지 없음**: C1 로고/OG 벡터 미제작(C2 D-6)이라 존재하지 않는 `og.png` 를 참조하지 않았다. `metadata.openGraph.images` 와 Organization JSON-LD 의 `logo` 필드는 **비워 둔 상태**. 브랜드 에셋 확정 시 `apps/company/public/og.png`(1200×630) 추가 + `app/layout.tsx` 의 openGraph, `components/json-ld.tsx` 의 `organizationJsonLd()` 두 곳만 수정하면 된다.
- **Pretendard 셀프호스팅 미해결**(C2 D-6 과 동일) — 현재 시스템 폰트 폴백. E6 성능 게이트 전 처리 필요.
- 계측 없음(C4 §6.1) — company 에는 analytics 스크립트를 넣지 않았다.
- 다크모드 수동 토글 UI 는 company 에 없다(시스템 선호만 따름). 회사 사이트에는 설정 화면이 없어 의도된 것.

---

## 1. 생성·수정 파일

| 파일 | 상태 | 내용 |
|---|---|---|
| `app/globals.css` | 교체 | web 토큰 전문 복제(스케일·시맨틱·다크모드 2경로·타이포·`@source`) |
| `app/layout.tsx` | 교체 | 헤더/푸터, `metadataBase`+title 템플릿+robots index, Organization·WebSite JSON-LD, TODO 빌드 경고, 스킵 링크 |
| `app/page.tsx` | 교체 | 홈: Hero(미션) + 핵심 섹션 ①② + 안전 섹션(`#safety`) + 클로징 CTA |
| `app/safety/page.tsx` | 신규 | 인증 4단계 표 · 신고 24h/긴급 1h · 데이터 정책 5항 · CTA |
| `app/legal/page.tsx` | 신규 | 인트로 + 사업자 정보 표 + 약관 6종 링크 + 권리침해 안내 |
| `app/contact/page.tsx` | 신규 | 신고 채널 안내 배너 + 문의 폼 + 첨부 불가 안내 |
| `app/sitemap.ts` | 신규 | 4개 라우트, `force-static` |
| `app/robots.ts` | 신규 | 전체 Allow + sitemap/host |
| `components/site-header.tsx` | 신규 | 로고 + 내비(안전과 신뢰·문의) + 시작하기 CTA(UTM) |
| `components/site-footer.tsx` | 신규 | 사업자 요약 1줄(자동 렌더) + 사이트 링크 + web 약관 6종 링크 |
| `components/safety-pledge.tsx` | 신규 | 안전 약속 4카드 + "신고 24시간 이내 처리" 배지 |
| `components/legal-notice-table.tsx` | 신규 | C4 §3.1 표 10행, 빈 값 → `[TODO_사업자정보]` |
| `components/contact-form.tsx` | 신규 | 클라이언트 폼(2모드, honeypot, 동의 체크, 2,000자 카운터) |
| `components/json-ld.tsx` | 신규 | `JsonLd` + `organizationJsonLd()` + `webSiteJsonLd()` |
| `config/company.ts` | 교체 | C4 §3.2 `CompanyInfo` + `display`/`isFilled`/`missingCompanyFields` |
| `config/site.ts` | 신규 | `COMPANY_URL`/`WEB_URL`/`CONTACT_ENDPOINT`, `webUrl(path, campaign)` UTM 헬퍼, `LEGAL_DOCS` |
| `.env.example` | 신규 | 위 3개 env 설명 |

- `package.json`·`next.config.ts`·`tsconfig.json`·`postcss.config.mjs` **수정 없음** — `@duckmate/ui` 는 이미 workspace 의존성으로 있었고 `transpilePackages` 도 설정돼 있었다. **새 npm 의존성 0건.**
- `apps/web`·`packages/*` 파일은 읽기만 했고 수정 0건.

## 2. 카피 출처

전 페이지 본문은 **`13_company_site.md` §2 를 원본으로 그대로 사용**했다(문장 임의 생성 최소화).

| 화면 | 출처 |
|---|---|
| 홈 히어로·서브카피·CTA 2개 | §2.1 히어로 |
| 핵심 ① 취향이 먼저입니다 / ② 대화를 돈으로 잠그지 않습니다 | §2.1 핵심 섹션 ①② |
| 홈 `#safety` 약속 4개 | §2.1 핵심 섹션 ③ |
| 클로징 CTA | §2.1 클로징 |
| `/safety` 인트로·인증 4단계 표·신고 5항·데이터 5항 | §2.2 (05_trust_safety 대외 순화본) |
| `/legal` 인트로 + 표 라벨 10종 | §2.3 · §3.1 |
| `/contact` 필드·유형 6종·동의 문구·신고 안내 | §4.1 |

E5 가 추가로 작성한 문장(§2 에 원문 없음): 핵심 섹션 ①② 하단 각 1줄 주석("궁합 계산 결과는 재미로 보는 참고 지표입니다." / "결제 기능은 준비 중이며, 오픈 시 요금과 해지 방법을 사전에 안내합니다."), 법적 고지 §약관·§권리침해 안내문, 문의 페이지 보조 안내. **A5 §5.2 우회 학습 방지 준수** — 탐지 룰명·정규식·임계값은 어디에도 노출하지 않았고, 공개 수치는 "24시간 이내 / 긴급 1시간 이내"뿐이다(C4 D-6 허용 범위). "대화는 신고 시에만 보존" 문구는 §2.2 자구를 그대로 사용했으므로 B2 개인정보처리방침 확정본과 **자구 일치 여부를 B2 가 최종 확인**해야 한다.

## 3. 기술 결정 근거 (정적 export 제약)

- `output: "export"` 유지 → **Server Action / Route Handler / 동적 라우트 / `next/image` 최적화 / 미들웨어 전부 미사용.** 문의 폼이 유일한 동적 요소이며 클라이언트 `fetch` 또는 `mailto` 로만 처리한다(D-1).
- `app/sitemap.ts` / `app/robots.ts` 는 export 모드에서도 **빌드 타임에 `out/sitemap.xml`·`out/robots.txt` 파일로 생성**되는 것을 산출물로 확인했다(별도 생성 스크립트 불필요).
- 도메인 미확보(PRD 이슈 #2) → 모든 절대 URL 은 `config/site.ts` 경유, 기본값 `*.vercel.app`. **URL 하드코딩 0건.**
- 브랜드명은 전부 `BRAND_NAME`(`@duckmate/ui`) 참조 — 카피에 "덕메이트" 하드코딩 없음(C2 D-5-5).
- 색은 시맨틱/스케일 토큰 클래스만 사용, hex·임의값 0건(C2 D-1). 코랄은 `text-accent-text`(밝은 배경 위 텍스트)로만 사용해 D-2 하드룰 위반 없음.
- 본문 최소 16px(`text-body`), 법적 고지 최소 13px(`text-caption`) 준수(C2 D-5-6).

## 4. 배포 설정 (Vercel)

| 항목 | 값 |
|---|---|
| Root Directory | `duckmate/apps/company` (모노레포 루트 기준 `apps/company`) |
| Framework Preset | Next.js |
| Install Command | `pnpm install`(워크스페이스 루트에서 자동) |
| Build Command | `pnpm --filter @duckmate/company build` (또는 프리셋 기본 `next build`) |
| Output Directory | `out` (`output: "export"`) |
| Node | 20+ |
| Env | `NEXT_PUBLIC_COMPANY_URL`, `NEXT_PUBLIC_WEB_URL`, (선택) `NEXT_PUBLIC_CONTACT_ENDPOINT` |

- apps/web 과 **별도 Vercel 프로젝트**다(PRD G-1: 프로덕션 URL 2개). 배포 후 `NEXT_PUBLIC_COMPANY_URL` 을 실제 도메인으로 채우고 재배포해야 canonical/sitemap 이 맞는다.
- 빌드 로그에 `⚠️ [company] 사업자 정보 미입력 N건` 경고가 뜨는 것이 **정상**이다(차단 아님). 사업자 등록 완료 시 `config/company.ts` 한 파일만 채우면 표·푸터·JSON-LD·mailto 가 동시에 갱신된다.

## 5. Phase 5 확장 지점

| 확장 | 손댈 곳 |
|---|---|
| `/service` 서비스 소개 | `app/service/page.tsx` 신규 + 헤더 내비 + `app/sitemap.ts` ROUTES 배열 |
| `/team`, `/careers` | 동일 패턴(라우트 + 내비 + ROUTES) |
| `/news`, `/news/[slug]` | `content/news/*.md` + frontmatter(`type: blog\|press`). 정적 export 이므로 `generateStaticParams` 필수, 마크다운 파서 의존성 추가 필요 → 소유자 승인 대상 |
| `/wiki/[category]/[slug]` (F-CMP-03, 30글) | 위와 동일 + `Article`+`BreadcrumbList`+`FAQPage` JSON-LD → `components/json-ld.tsx` 에 빌더 함수 추가. 글당 web CTA 1개 초과 금지(C4 §6.2-1), `webUrl(path, "wiki-<slug>")` 사용 |
| 홈 `#safety` 축소 | `components/safety-pledge.tsx` 는 이미 `withDetailLink` prop 으로 "자세히 보기" 노출을 제어한다 |
| 문의 폼 Edge Function 전환 | 코드 수정 없음 — `NEXT_PUBLIC_CONTACT_ENDPOINT` env 설정만 |
| 다국어/영문 | 현재 `lang="ko"` 고정, i18n 미구현 |

## 6. 검증 결과

```
pnpm --filter @duckmate/company build
✓ Compiled successfully / ✓ Exporting (2/2)
Route (app): / · /_not-found · /contact · /legal · /robots.txt · /safety · /sitemap.xml  (전부 ○ Static)
⚠️ [company] 사업자 정보 미입력 11건 — 경고만, 빌드 통과
```

산출물 확인:
- `out/` = `index.html`, `safety.html`, `legal.html`, `contact.html`, `404.html`, `sitemap.xml`, `robots.txt`
- noindex: `404.html` 1건뿐(D-6), 나머지 전부 `index, follow`
- `sitemap.xml` 4 URL = 실제 라우트 집합
- JSON-LD: 홈에 `Organization` + `WebSite` 삽입 확인
- title: 홈 단독 `덕메이트 — 같은 걸 좋아하는 사람이랑 만나는 앱`, 그 외 `{페이지명} | 덕메이트`
- `legal.html` 에 `[TODO_사업자정보]` 정상 노출(표 10행 + 푸터 요약)
- CSS 27KB, `prefers-color-scheme:dark` + `[data-theme]` 두 경로 모두 포함
