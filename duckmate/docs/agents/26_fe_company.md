# 26 — 회사 소개 사이트 구현 (E5, `apps/company`)

> 입력: `13_company_site.md`(IA·카피·company.ts 스키마·문의·법적 고지·SEO), `08_legal_docs.md` + `apps/web/content/legal/README.md`(변수 18개·frontmatter), `10_brand.md`, `11_design_system.md`, `07_legal_checklist.md`.
> 범위: **Phase 1 최소 버전 = `/` 홈 + `/legal/{terms,privacy,location,youth,business}/` + `/legal/` 인덱스 + `/contact/`**. `/service/`·`/safety/`·`/team/`·`/blog/`·`/careers/`·`/wiki/` 는 폴더도 만들지 않았다(Phase 5, F-092/F-089).
> 수정 파일: `apps/company/**`, `scripts/check-legal-placeholders.mjs`, `supabase/functions/contact/index.ts`(예외 허용), `docs/screenshots/company-*.png`, 이 문서. `apps/web/content/legal/*.md` 는 읽기만(빌드 시 fs import).

## 다음 에이전트에게 넘기는 결정사항

### G3 (배포)
1. **Vercel 프로젝트 설정**: Root Directory = `duckmate/apps/company`, Framework = Next.js, Build Command = `pnpm --filter @duckmate/company build`(루트 pnpm 워크스페이스라 "Include source files outside of the Root Directory" 켜기), Install Command = `pnpm install --frozen-lockfile`(모노레포 루트에서), Output Directory = `out`. Node 22. `next.config.ts` 는 `output: "export"` + `trailingSlash: true` + `transpilePackages: ["@duckmate/ui"]` + `experimental.optimizePackageImports: ["@duckmate/ui"]`.
2. **환경변수(전부 공개 값, 비밀 없음)** — 표는 §3. 최소 `NEXT_PUBLIC_COMPANY_URL`·`NEXT_PUBLIC_WEB_APP_URL`·`NEXT_PUBLIC_CONTACT_ENDPOINT` 3개. 미설정 시 각각 `http://localhost:3001` 기본값 / 헤더·히어로 CTA "준비 중" 비활성 / 문의 폼 오류 상태(+mailto 폴백). `VERCEL_ENV` 는 Vercel 이 자동 주입하며 `production` 이 아니면 **메타 `noindex`**(정적 export 라 `X-Robots-Tag` 헤더 대신).
3. **빌드 경고는 차단하지 않는다**: `prebuild` = `check-legal-placeholders.mjs`(저장소 루트 기준 스캔) + `scripts/assert-company-config.mjs`(company.ts 소스 스캔) → 둘 다 exit 0. `layout.tsx` 의 `assertCompanyConfig()` 도 빌드 로그에 1회 `console.warn`. 현재 필수 18 + 선택 5 플레이스홀더가 남아 있고 화면에 `[TODO_사업자정보]`/`{{KEY}}` 로 그대로 노출된다(의도, 브리프 규칙 4).
4. **Edge Function `contact` 배포는 `supabase functions deploy contact --no-verify-jwt`** — 브라우저가 anon 키·JWT 없이 직접 POST 한다(company 번들에 Supabase 키 0). secrets(선택): `RESEND_API_KEY` + `CONTACT_NOTIFY_EMAIL`(둘 다 있어야 메일 발송, 없으면 insert 만), `CONTACT_FROM_EMAIL`(기본 `onboarding@resend.dev`), `CONTACT_IP_SALT`. 함수 URL 을 `NEXT_PUBLIC_CONTACT_ENDPOINT` 에 넣는다. `supabase/config.toml` 은 D 그룹 소유라 `[functions.contact] verify_jwt = false` 를 추가하지 않았다 — D 그룹 또는 G3 가 반영.
5. **레이트리밋은 isolate 메모리 기준**(IP SHA-256 해시, 시간당 5건, 콜드 스타트 시 초기화). 테이블 기반(`rate_limits`)으로 올리려면 D1 스키마 추가가 필요하므로 Phase 2 에서 결정.

### company.ts (소유자·E4)
6. **키 = README 18개 그대로** + 사이트 전용 7개(`COMPANY_URL`·`WEB_APP_URL`·`CONTACT_ENDPOINT`·`SNS_X`·`SNS_INSTAGRAM`·`FOUNDED_YEAR`·`HOSTING_PROVIDER`). 13_company_site §2 의 `BIZ_NO`/`ECOM_NO`/`PRIVACY_OFFICER`/`PRIVACY_EMAIL`/`YOUTH_OFFICER`/`YOUTH_EMAIL` 는 08_legal_docs 결정 3에 따라 `BUSINESS_NUMBER`/`ECOMMERCE_REG_NUMBER`/`PRIVACY_OFFICER_NAME`/`PRIVACY_OFFICER_EMAIL`/`YOUTH_OFFICER_NAME`/`YOUTH_OFFICER_EMAIL` 로 **통일** — 그래야 `{{KEY}}` 치환이 md 토큰과 1:1 로 맞는다. `SERVICE_NAME`(가칭 "덕메이트")도 이 파일에 있다(13 결정 16의 `apps/web/config/site.ts` 는 아직 없음 — E4 가 만들면 company 가 그쪽을 import 하도록 1줄 교체).
7. **값 채우는 법**: `apps/company/config/company.ts` 의 `"{{KEY}}"` 를 실제 문자열로 교체(빈 문자열 금지). URL 3개는 env 로만. 채우면 푸터·`/legal/business/`·법적 본문·JSON-LD 가 자동 반영. `BUSINESS_NUMBER` 가 10자리 숫자면 `/legal/business/` 에 공정위 사업자정보확인 링크가 자동 생성.
8. **web 의 `PAYMENTS_ENABLED` 연동**: E4 는 `apps/company/config/company.ts` 를 import 해 `isPlaceholder(company.COMPANY_NAME) || isPlaceholder(company.ECOMMERCE_REG_NUMBER)` 면 false 로 강제하면 된다(파일 위치 이동 금지, 13 §2).

### 법적 고지 렌더 (E4 참고·소유자)
9. **복제 렌더 파이프라인** = `lib/legal.ts`: `fs.readFileSync("../web/content/legal/<file>.md")` → flat frontmatter 파서(의존성 없음) → `fillPlaceholders` → `marked`(유일한 마크다운 의존성) 커스텀 renderer(heading id + 목차 수집, 표는 `.table-wrap` 가로 스크롤 + `th scope`). `/legal/youth/` ← `youth-policy.md`(README slug 별칭). 시행일·버전·마지막 편집일 헤더 표시, `effective_date` 가 미래 날짜면 "개정 예정" 배지. `.next.md` 병행 게시는 미구현(현행본만).
10. **canonical = `WEB_APP_URL + /legal/{frontmatter.slug}`**(youth 는 `/legal/youth-policy`), `WEB_APP_URL` 이 플레이스홀더면 self-canonical. 본문 하단 고정 문구도 같은 URL 을 가리킨다.
11. `/legal/` 인덱스는 지시대로 만들었지만 **sitemap 에는 넣지 않았다**(sitemap = 홈·법적 5·문의 7개, 13 결정 12). 필요하면 `app/sitemap.ts` 배열에 1줄 추가.

### 문의 (D8 어드민·E4)
12. **POST JSON `{ email: string|null, type: "partnership"|"press"|"safety"|"other", body, honeypot }`**. 이름은 클라이언트가 `body` 앞에 `[보내신 분: …]\n` 으로 결합. 함수는 `inquiries.category` enum 에 partnership/press 가 없어 **safety→`report`, 그 외→`general`** 로 저장하고 `body` 첫 줄에 `[유형: {type}]` 을 붙인다 — 어드민 `/admin/inquiries` 는 이 첫 줄로 구분. 허니팟 값이 있으면 200 후 폐기, 429 에 `retry-after: 3600`.
13. **mailto 폴백 = 오류 상태 전용**(13 결정 8): 엔드포인트 미설정·POST 실패 시에만 "메일로 직접 보내기" 노출, `CONTACT_EMAIL` 이 플레이스홀더면 "문의 채널을 준비 중이에요"만. `?type=` 프리셀렉트는 `window.location.search`(정적 export 라 `useSearchParams`/Suspense 회피).

### `@duckmate/ui` 수정 요청 (C2)
14. **`Button asChild` 가 깨져 있다**: `{loading ? <Spinner/> : null}{children}` 로 Slot 자식이 2개가 되어 빌드 시 "Slot failed to slot onto its children" — company 는 서버용 `components/LinkButton.tsx`(같은 클래스 문자열)로 우회했다. ui 에서 `asChild` 일 때 스피너를 넣지 않도록 고치면 LinkButton 을 지울 수 있다. `buttonVariants` 도 `"use client"` 모듈이라 서버 컴포넌트에서 호출 불가(같은 이유).
15. **`import * as Icons from "lucide-react"`(avatar.tsx·HobbyChip.tsx)가 lucide 전체(아이콘 4,000+)를 번들에 넣는다** → 홈 First Load JS 306kB(그 중 한 청크 gzip 150KB). `HOBBY_CATEGORIES[].iconExport` 12개를 정적 map 으로 바꾸면 홈 JS 가 13 결정 23 목표(≤80KB gzip)에 들어간다. 이번 Phase 는 "기록하고 배포 진행"(차단 X).

### E6 (검증) · Phase 5 · 기타
16. **E6 검증 URL**: `/` · `/contact/` · `/contact/?type=safety` · `/legal/` · `/legal/terms/` · `/legal/privacy/` · `/legal/location/` · `/legal/youth/` · `/legal/business/` · `/sitemap.xml` · `/robots.txt` · `/없는경로/`(404). 확인 항목: 푸터 `[TODO_사업자정보]` 노출, 법적 본문 `{{KEY}}` 잔존(정상), 문의 1건 → `inquiries` 행 + 완료 화면, 키보드만으로 동의 체크·전송, Lighthouse 4개(현재 JS 초과는 결정 15 참조).
17. **Phase 5 위키/블로그 추가 방법**: `apps/company/content/{wiki,blog}/*.mdx` + `app/wiki/[slug]/page.tsx`(`generateStaticParams`, `dynamicParams=false`). `lib/legal.ts` 의 `parseFrontmatter`/`render` 를 `lib/markdown.ts` 로 빼서 재사용(마크다운 의존성은 `marked` 그대로), frontmatter `faq[]` → `FAQPage` JSON-LD, `app/sitemap.ts` 에 slug 열거 추가, 헤더 내비는 `components/Header.tsx` 의 `<nav>` 에 `NavLink` 추가.
18. **클라이언트 JS 를 쓰는 company 코드는 2개뿐**: `components/ContactForm.tsx`, `components/NavLink.tsx`(헤더 `aria-current` 용 `usePathname`, 상태 없음). 홈 목업은 ui 의 `DuckCard`·`SuggestionCard`·`HobbyAvatar`(ui 쪽 `"use client"`)를 그대로 렌더하며 실사용자 데이터 없이 시드 페르소나 4명(서윤·도현·민재·하은)만 쓴다. 이미지 파일 0, "화면 예시" 캡션 고정.
19. **외부 요청 = jsDelivr Pretendard `<link>` 2개뿐**(11 결정 3, Phase 1). Phase 2 self-host 시 `layout.tsx` 의 `<link>` 2줄을 `next/font/local` 로 교체. body 배경은 `bg-background`(라이트 = sand-50 오프화이트, OS 다크 자동) — 11 §4.1-6 의 `bg-sand-50` 고정 대신 다크 대비를 지키는 쪽을 택했다.
20. **`scripts/check-legal-placeholders.mjs` 변경**: 저장소 루트 기준 경로 해석(하위 폴더 prebuild 에서도 동일 결과), `README.md` 제외, `node_modules`/`.next` 제외. 출력 경로는 루트 상대.

---

## 1. 라우트 표 (Phase 1, `out/` 산출)

| 라우트 | 파일 | 렌더 | title | JSON-LD | sitemap |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | 서버 + ui 목업 | `덕메이트 — 같은 걸 좋아하는 사람이랑 만나는 앱` | Organization+WebSite(layout, COMPANY_NAME 채워지면), FAQPage(안전 3문항) | ○ |
| `/contact/` | `app/contact/page.tsx` + `components/ContactForm.tsx`(client) | 폼 | `문의하기 · 덕메이트` | ContactPage | ○ |
| `/legal/` | `app/legal/page.tsx` | 카드 6개 | `법적 고지 · 덕메이트` | CollectionPage | × |
| `/legal/terms/` `/legal/privacy/` `/legal/location/` `/legal/youth/` | `app/legal/[slug]/page.tsx` + `lib/legal.ts` | md 복제 렌더 | `{frontmatter.title} · 덕메이트` | WebPage | ○ |
| `/legal/business/` | `app/legal/business/page.tsx` + `components/LegalBlock.tsx` | company.ts 직접 | `사업자 정보 · 덕메이트` | WebPage | ○ |
| `/404` | `app/not-found.tsx` | — | `페이지를 찾을 수 없어요 · 덕메이트`(noindex) | — | × |
| `/sitemap.xml` `/robots.txt` | `app/sitemap.ts` `app/robots.ts` (`force-static`) | — | — | — | — |

공통: `app/layout.tsx`(스킵 링크 → `#main`, Header, Footer, Pretendard link, metadataBase, preview noindex), `components/{Header,Footer,LegalBlock,LegalTabs,Container,Section,Logo,LinkButton,JsonLd,NavLink,HomeMockups}.tsx`, `app/globals.css`(`@import "@duckmate/ui/styles.css"; @source "../../../packages/ui/src";` + `.legal-prose` + `.skip-link`).

## 2. `config/company.ts` 필드표

| 키 | 의미 | 필수 | 화면 | 출처 |
|---|---|---|---|---|
| `COMPANY_NAME` `CEO_NAME` `BUSINESS_NUMBER` `ECOMMERCE_REG_NUMBER` `ADDRESS` `CONTACT_EMAIL` | 사업자 표시 항목 | 필수 | 푸터·`/legal/business/`(`[TODO_사업자정보]`), 법적 본문(`{{KEY}}`), JSON-LD | README |
| `CONTACT_PHONE` | 고객센터 전화 | 선택(플레이스홀더면 줄 미렌더) | 위와 동일 | README |
| `PRIVACY_OFFICER_{NAME,EMAIL,PHONE}` `LOCATION_OFFICER_{NAME,EMAIL}` `YOUTH_OFFICER_{NAME,EMAIL}` | 책임자 3인 | 필수 | 푸터(성명)·business(성명+이메일)·법적 본문 | README |
| `SERVICE_NAME` | 서비스명(가칭) | 상수 | 전 페이지 카피·title 템플릿 | 10_brand 결정 1 |
| `DOMAIN` `EFFECTIVE_DATE` `SUPABASE_REGION` | 법적 본문 전용 | 필수 | 법적 본문 | README |
| `COMPANY_URL` | company 사이트 URL | env `NEXT_PUBLIC_COMPANY_URL` | metadataBase·sitemap·robots·JSON-LD | 13 §2 |
| `WEB_APP_URL` | 앱 URL | env `NEXT_PUBLIC_WEB_APP_URL`(폴백 `NEXT_PUBLIC_SITE_URL`) | CTA(`/onboarding/age`)·법적 canonical·하단 문구 | 13 §2 |
| `CONTACT_ENDPOINT` | Edge Function URL | env `NEXT_PUBLIC_CONTACT_ENDPOINT`(빈 값 허용) | 문의 폼 | 13 결정 7 |
| `SNS_X` `SNS_INSTAGRAM` `FOUNDED_YEAR` | 브랜드 | 선택(플레이스홀더면 미노출/현재 연도) | 푸터 | 13 §2 |
| `HOSTING_PROVIDER` | 호스팅 제공자 | 기본 `Vercel Inc.` | 푸터·business | 07 결정 22 |

export: `company`, `SERVICE_NAME`, `isPlaceholder`, `display`, `fillPlaceholders`, `companyUrl`, `appUrl`, `assertCompanyConfig`, `OPTIONAL_KEYS`, `CompanyKey`.

## 3. 환경변수

| 변수 | 어디서 | 없을 때 |
|---|---|---|
| `NEXT_PUBLIC_COMPANY_URL` | Vercel(프로덕션·프리뷰) | `http://localhost:3001` (sitemap/robots/canonical 이 로컬 주소) |
| `NEXT_PUBLIC_WEB_APP_URL` | Vercel | 헤더·히어로·푸터 CTA "준비 중" 비활성, 법적 canonical = self |
| `NEXT_PUBLIC_CONTACT_ENDPOINT` | Vercel | 폼 전송 시 오류 상태 + mailto(CONTACT_EMAIL 있을 때) |
| `VERCEL_ENV` | Vercel 자동 | 로컬 = index |
| (함수) `RESEND_API_KEY` `CONTACT_NOTIFY_EMAIL` `CONTACT_FROM_EMAIL` `CONTACT_IP_SALT` | Supabase secrets | 메일 미발송(insert 만) / 기본 salt |

## 4. 검증 결과 (2026-09-02)

- `pnpm --filter @duckmate/company typecheck` ✅ / `build` ✅ (Next 15.5.25, 13 페이지 정적 생성, `out/` 에 `index.html`·`legal/{terms,privacy,location,youth,business}/index.html`·`legal/index.html`·`contact/index.html`·`404.html`·`sitemap.xml`·`robots.txt` 존재 확인).
- `node scripts/check-legal-placeholders.mjs` → 경고만, exit 0 (md 6개 + `company.ts` 22개 토큰).
- 빌드 HTML grep: 홈·문의 푸터 `[TODO_사업자정보]` 9곳(HTML 기준, RSC payload 포함 시 18), `/legal/business/` 18곳, 법적 본문에 `{{ADDRESS}}`·`{{COMPANY_NAME}}` 등 토큰 잔존 — 모두 플레이스홀더 정책대로 정상. `/legal/business/` 본문에는 `{{` 없음(전부 TODO 표기).
- 법적 페이지: 목차(`##`/`###`), heading id, 표 `.table-wrap` + `th scope="col"`, 시행일/버전/편집일 헤더, sr-only h1 확인. `<title>` 페이지별 고유, `<link rel="canonical">`, `<meta name="robots" content="index, follow">`, JSON-LD 각 1개.
- 외부 요청: `cdn.jsdelivr.net`(Pretendard)만. 금지어(결혼·배우자·혼인·탈락·회원님·매력·인기) 홈·문의 HTML 0건.
- First Load JS: 홈 306kB / 법적 106kB / 문의 133kB (raw). 홈 초과 원인 = 결정 15(ui lucide 네임스페이스 import). company 자체 페이지 코드는 홈 6.6KB gzip.
- 스크린샷(Playwright chromium, `out/` 정적 서빙, 1280px 전체 페이지): `docs/screenshots/company-home.png` · `company-legal.png`(/legal/privacy/) · `company-contact.png`(/contact/?type=safety).
