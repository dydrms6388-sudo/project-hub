# 27 — 접근성·성능·SEO 게이트 (E6)

> 입력: `06_PRD.md` §5(비기능: LCP·WCAG AA·noindex·sitemap), `12_flows.md` §0-6·§1(라우트 맵 noindex 열), `22`~`26_fe_*.md`·`21_admin.md`(E6 검증 대상), `13_company_site.md`(sitemap/robots), `10_brand.md` §4.3·§4.4(금지 표현·이모지), `11_design_system.md` §6(접근성 체크리스트).
> 범위: 검사 스크립트 3종(`scripts/check-noindex.mjs`·`check-copy.mjs`·`measure-web-vitals.mjs`) + `apps/web/app/{sitemap,robots}.ts`·`not-found.tsx` + `next.config.ts` 헤더 + **발견 결함의 최소 수정**(§4 파일별 목록). 동작을 바꾸는 리팩터링 없음. git commit 없음(코디네이터 스냅샷 제외), 비밀값 없음.
> 기준일 2026-09-02. 측정 환경: 샌드박스 리눅스(외부 CDN 차단 → Pretendard 폴백 폰트), Playwright 크로미움 141, Lighthouse 13.4.1 모바일 시뮬레이션.

## 다음 에이전트에게 넘기는 결정사항

### G1 (E2E)
1. **더미 env 세트 = `scripts/lib/dummy-env.mjs` `DUMMY_ENV`** 하나만 쓴다: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` · `NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key-0123456789abcdef`(≥20자) · `SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key-0123456789abcdef` · `NEXT_PUBLIC_SITE_URL=http://localhost:3000` · `NEXT_PUBLIC_COMPANY_URL=http://localhost:3001` · `AUTH_GATE_SECRET=dummy-gate-secret-…`. `lib/env.ts` zod(url·min(20))만 통과하면 되고 네트워크는 열리지 않는다(세션 쿠키 없음 → `getUser` 로컬 실패 → 비로그인). `next build` 할 때는 `NODE_ENV` 를 넣지 말 것(경고).
2. **산출물 폴더 분리 = `NEXT_DIST_DIR`**(`next.config.ts distDir`). E6 은 `.next-e6`(prod)·`.next-dev`(dev 라우트) 를 쓰고, G1 은 `.next-e2e` 를 쓴다. 같은 `.next` 를 두 프로세스가 쓰면 `Could not find a production build` / `Cannot find module './NNNN.js'` 로 서로 죽는다(이번 세션에서 실제 발생). `.gitignore` 의 `.next-*` 가 전부 잡는다.
3. **dev 라우트 3개는 `next dev` 에서만 렌더**: `/dev/discover?screen=reco|match|home|done[&safety=1]` · `/dev/chat?view=list|room[&match=<uuid>&realtime=polling&scam=1]` · `/dev/profile`. `next start` 는 `NODE_ENV=production` 이라 전부 404(정적 프리렌더된 404). 스크린샷·스모크는 `NEXT_DIST_DIR=.next-dev pnpm exec next dev -p 3012`.
4. **testid 관례 = `<화면>-<요소>` 케밥케이스**(`landing-start`·`onb-back`·`reco-like`·`chat-input`·`chat-send`·`account-delete-page`·`not-found`). 새 화면도 같은 규칙. 스킵 링크는 `a.skip-link[href="#main"]`, 모든 프레임의 본문은 `main#main[tabindex=-1]` 이다(키보드 E2E: Tab 1회 → 스킵 링크 포커스 → Enter → `document.activeElement === main`).
5. **크로미움 실행 파일**: Playwright 1.62 가 기대하는 `chromium_headless_shell-1234` 가 샌드박스에 없다. `chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" })`(`scripts/lib/dummy-env.mjs` `CHROMIUM_CANDIDATES`) 로 우회. 외부 호스트(jsdelivr 폰트)는 `page.route` 로 abort 해야 networkidle 이 끝난다.

### G2 (보안 리뷰)
6. **`apps/web/next.config.ts` 는 G2 보안 헤더 + E6 `X-Robots-Tag` 를 병합한 상태**다(G2 가 파일을 통째로 덮어써 E6 블록·G1 `distDir` 이 사라진 것을 다시 합침). `headers()` 순서: `/(.*)` 보안 6종 → `/:prefix(onboarding|verify|home|reco|match|chat|profile|me|settings|report|blocks|appeal|suspended|blocked|admin|login|api|dev|shop|likes-you|play|events|ranking|update-required|404)/:path*` `noindex, nofollow` → `/account/restore` → `VERCEL_ENV≠production` 이면 `/:path*` 전체 noindex. **미들웨어는 헤더를 붙이지 않는다**(중복 금지) — next.config 헤더가 미들웨어 307 리다이렉트 응답에도 붙는 것을 `check-noindex` 가 실측(표 §1).
7. **미들웨어 판정 실측**(비로그인): `(app)`·`(onboarding)` steps·`/verify`·`/appeal`·`/suspended`·`/account/restore` → `307 /login?next=<pathname>`(쿼리는 버림) · `(admin)` → `rewrite /404`(존재 비노출, 404 + noindex) · `/dev/*` 프로덕션 404 · `/legal/youth-policy` → `308 /legal/youth`. `x-dm-gate` 응답 헤더로 사유 코드가 노출된다(내부 진단용, 민감 정보 아님 — G2 가 프로덕션에서 제거할지 판단).
8. **`/account/delete` 는 index 허용으로 바꿨다**(E4 는 noindex 로 두었음). 근거: 09_store_policy 의 "누구나 접근 가능한 웹 계정 삭제 URL" 은 스토어 심사·검색 노출이 목적 → 공식 페이지(sitemap 포함, canonical 부여). 개인정보 없음.
9. **robots.txt Disallow 25개**(`app/robots.ts`): 12_flows §0-6 목록 + `/profile`·`/api`·`/dev`·Phase 2~5 예약 경로(`/shop`·`/likes-you`·`/play`·`/events`·`/ranking`·`/update-required`). `Allow: / /legal /account/delete`. sitemap = 10 URL(`/`·`/legal`·법적 7·`/account/delete`). **UGC 라우트는 sitemap 에 절대 넣지 않는다** — 검사가 `OFFICIAL` 집합과 대조해 초과/누락 모두 실패 처리.
10. **전역 `not-found.tsx` 신설**: 미들웨어 `/404` rewrite·미존재 경로·프로덕션 `/dev/*` 가 같은 화면(문구 1종, noindex). 기존에는 Next 기본 404(영문) 였다.
11. **아이콘 404 제거**: `manifest.webmanifest` 가 가리키던 `/icons/{icon-192,icon-512,badge-72}.png` 와 `/favicon.ico` 가 전부 404 였다(Lighthouse best-practices 감점, 푸시 알림 배지 깨짐). 브랜드 자산이 없어 **기하 도형 플레이스홀더**(보라 바탕 + 코랄 원, 텍스트 글리프 없음)를 Playwright 로 생성해 `apps/web/public/icons/*`, `apps/web/app/{icon,apple-icon}.png`, `apps/company/app/{icon,apple-icon}.png` 에 두었다. 디자인 자산이 오면 같은 파일명으로 교체만 하면 된다(20_notifications 의 badge 는 단색 규칙 유지: 흰 바탕·검정).

### G3 (배포 후 검증)
12. **배포 전 게이트 명령(루트)**: `pnpm check:all` = `check:legal`(경고만) → `check:copy`(exit 1) → `check:noindex`(build+start 후 70건 검사, exit 1). CI 에서는 `pnpm --filter @duckmate/web build` 직후 `NEXT_DIST_DIR=.next node scripts/check-noindex.mjs --no-build` 로 재빌드를 피한다. company 는 `pnpm --filter @duckmate/company build` 후 `out/` 을 읽는다(`--skip-company` 로 생략 가능).
13. **배포 후 실측 절차**: ① `curl -sI https://<web>/home` → `307` + `location: /login?next=%2Fhome` + `x-robots-tag: noindex, nofollow` ② `curl -s https://<web>/robots.txt | grep -c Disallow` = 25 ③ `curl -s https://<web>/sitemap.xml | grep -c '<loc>'` = 10 ④ preview 배포는 `curl -sI https://<preview>/` 에 `x-robots-tag` 가 있어야 한다(`VERCEL_ENV`) ⑤ company `curl -sI https://<company>/` 에 `x-robots-tag` **없어야** 하고 HTML `<meta name="robots" content="index, follow">`.
14. **Lighthouse 실측 절차**: `npx lighthouse@13 <url> --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=json` 을 `/`·`/login`·`/legal/terms`·`/account/delete`·company `/`·`/contact/`·`/legal/terms/` 에 실행(`node scripts/measure-web-vitals.mjs --lighthouse --no-build` 가 같은 일을 로컬에서 한다). 판정: Perf ≥ 90(랜딩·법적) · A11y = 100 · SEO ≥ 90(단, noindex 페이지는 `is-crawlable` 실패로 SEO 60대가 **정상**). 프로덕션에서는 Pretendard CDN 이 실제 로드되므로 렌더 차단 시간이 로컬 시뮬레이션과 다르다 — 실측 후 §3 표를 갱신할 것.
15. **`measure-web-vitals.mjs` 의 JS 전송량은 gzip 실측**(`transferSize`, `next start` 압축 기준). Vercel 은 brotli 라 10~15% 더 작다. 목표 비교는 gzip 값으로 한다.

### 전 그룹 공통 (미달·주의)
16. **company 홈 JS ≤ 80KB gz 목표는 Next 15 App Router 로는 도달 불가**: lucide 전체 import 제거 후 홈 First Load = **125KB gz**(E5 보고 306KB → 181KB 감소). 남은 125KB 중 **102KB 가 프레임워크 공통**(react-dom 54KB + Next 런타임 46KB + webpack 2KB)이고 페이지 고유분은 23KB 다. `optimizePackageImports` 는 이미 켜져 있어 `@duckmate/ui` 배럴은 원인이 아니다(재측정 확인). 80KB 를 지키려면 React 를 버려야 하므로 **목표를 "페이지 고유 JS ≤ 30KB gz + First Load ≤ 130KB gz" 로 개정할 것을 13_company_site 결정 23 에 제안**. web 홈은 118KB gz(목표 200KB 이내).
17. **Pretendard CDN `<link rel="stylesheet">` 가 렌더 차단(Lighthouse 추정 300~450ms)** — 11 결정 3 대로 Phase 2 self-host(`next/font/local`)가 정답. 그 전에는 `<link rel="preload" as="style" onload>` 패턴으로 비차단 전환 가능(FOUT 발생, 폰트 렌더 타이밍이 바뀌므로 E6 범위 밖에서 결정).
18. **랜딩 `<title>` 중복 수정**: `"덕메이트 — … · 덕메이트"` 로 서비스명이 두 번 나오던 것을 `title: { absolute }` 로 고쳤다. 다른 페이지는 템플릿 `%s · 덕메이트` 그대로.
19. **금지 표현 사전은 `scripts/check-copy.mjs` `FORBIDDEN` 배열이 단일 소스**(10_brand §4.4 10분류 + §4.3 금지 이모지 11개). `packages/ui/copy-lint.json` 은 만들지 않았다(정규식·lookbehind 가 필요해 JSON 으로는 표현이 나빠짐). 예외는 같은 줄 `// copy-lint-disable-line <사유>`. 서비스명 리터럴 "덕메이트" 허용 파일 = `config/company.ts`·`manifest.webmanifest`·`lib/push/templates.ts`·`app/**/layout.tsx`.
20. **채팅 메시지 목록에 `aria-live="polite" aria-relevant="additions"`** 를 붙였다(새 메시지 낭독). 전송 실패는 기존 `role=alert`, 입력 비활성·마스킹 안내는 `role=status` 그대로.

---

## 1. 라우트 × 인덱싱 실측 (`node scripts/check-noindex.mjs`, 70건 전부 통과)

정책: index 허용 = `/`, `/legal`, `/legal/{terms,privacy,location,youth,community,refund,business}`, `/account/delete`. 나머지 전부 noindex(메타 + `X-Robots-Tag`). 비로그인 프로브.

| 경로 | 상태 | `<meta name="robots">` | `X-Robots-Tag` | 비고 |
|---|---|---|---|---|
| `/` · `/legal` · `/legal/{7}` · `/account/delete` | 200 | `index, follow` | — | 공식 페이지 10 |
| `/login` | 200 | `noindex, nofollow` | `noindex, nofollow` | |
| `/onboarding/age` · `/onboarding/phone` | 200 | `noindex, nofollow, nocache` | `noindex, nofollow` | (onboarding) layout |
| `/blocked/age` | 200 | `noindex, nofollow` | `noindex, nofollow` | |
| `/onboarding/{basic,hobbies,quiz,card,photos}` · `/verify` | 307 | — | `noindex, nofollow` | → `/login?next=…` |
| `/home` · `/reco` · `/reco/done` · `/match/[id]` · `/chat` · `/chat/[id]` | 307 | — | `noindex, nofollow` | → `/login?next=…` |
| `/me` · `/me/edit` · `/me/photos` · `/settings/*`(9) · `/blocks` · `/report` · `/report/new` | 307 | — | `noindex, nofollow` | → `/login?next=…` |
| `/appeal` · `/suspended` · `/account/restore` | 307 | — | `noindex, nofollow` | → `/login?next=…` |
| `/admin` · `/admin/{photos,reports,users,metrics,audit}` | 404 | `noindex` | `noindex, nofollow` | 비로그인 = 404 rewrite |
| `/dev/discover` · `/dev/chat` · `/dev/profile` | 404 | `noindex` | `noindex, nofollow` | 프로덕션 404 |
| `/no-such-page` | 404 | `noindex` | — | 전역 not-found |
| `/legal/youth-policy` | 308 | — | — | → `/legal/youth` |
| `/api/health` | 200 | — | `noindex, nofollow` | |
| `/sitemap.xml` | 200 | 10 URL | — | 공식 페이지만 |
| `/robots.txt` | 200 | Disallow 25 + Sitemap | — | |
| company `out/` 9 페이지 | — | `index, follow` (404 만 `noindex`) | — | sitemap 7 URL, robots `Allow: /` |

## 2. 지표 (`node scripts/measure-web-vitals.mjs --lighthouse`)

목표: LCP ≤ 2.5s(로컬) · CLS ≤ 0.1 · web 홈 JS ≤ 200KB gz · company 홈 JS ≤ 80KB gz(→ 결정 16). 모바일 375×812, 워밍업 1회 후 두 번째 로드. `*` = dev 서버(비압축·개발 번들, 크기 참고값). JS(gz) 는 same-origin `.js` 전송량 합(nomodule polyfill 포함, 모던 브라우저 실제 전송은 −39KB).

{{MEASURE_MD}}

## 3. 접근성 점검(코드 리뷰) · 수정 목록

| 항목 | 결과 | 수정 |
|---|---|---|
| 온보딩 폼 라벨/에러 연결 | `Input invalid` → `aria-invalid`, `FieldError role=alert` + `aria-describedby`(Age·Phone·Basic·Hobbies·Card·Consent 전부) | 없음 |
| 아이콘 전용 버튼 `aria-label` | `size="icon"` 10곳 전부 `aria-label` 보유(뒤로가기·메뉴·닫기·사진 크게 보기 등) | 없음 |
| 포커스 트랩 | Dialog·Sheet = Radix `@radix-ui/react-dialog`(트랩·ESC·포커스 복귀), ReconsentGate 닫기 불가 Dialog | 없음 |
| 스킵 링크 | **없었음**(company 만 있었음) | `app/layout.tsx` `a.skip-link` + `globals.css` 스타일, `main#main[tabindex=-1]` 을 AppShell·OnboardingFrame·랜딩·legal·admin·not-found 에 부여 |
| `lang="ko"` | web·company 둘 다 `<html lang="ko">` | 없음 |
| 색 대비 | 토큰만 사용, `--accent-foreground` = neutral-900(코랄 위 흰 글자 없음), muted 최소 #5C5650. axe `color-contrast` 위반 0(폴백 폰트 기준) | 없음 |
| `prefers-reduced-motion` | `styles.css` 전역 블록 + flip-card transform 제거 + MatchReveal 즉시 완료 | 없음 |
| 추천 카드 키보드 | 패스/좋아요/슈퍼라이크 = `<Button aria-label>`, 카드 `aria-label="추천 n / N"`, 프로필 열기 버튼(스와이프 없음) | 없음 |
| 채팅 `aria-live` | 입력 비활성 `role=status`, 글자수 `aria-live=polite`, 실패 `role=alert`, 폴링 배너 `aria-live` — **메시지 목록엔 없었음** | `MessageList.tsx` `<ol aria-live="polite" aria-relevant="additions">` |
| 이미지 alt | 모든 `<img>` alt 보유(프로필 썸네일은 `alt=""` + 상태 배지 텍스트) | 없음 |
| 헤딩 순서 | axe `heading-order` 위반 0 | 없음 |
| 랜드마크 | 페이지당 `main` 1개 확인 | 없음 |

## 4. 성능 점검

- **서버/클라이언트 경계**: `"use client"` 58 / 123 tsx(app+components). 화면 컴포넌트(`*Screen.tsx`)가 클라이언트, `page.tsx`·layout·`load.ts` 는 서버 — 남용 없음. 서버 데이터는 page 에서 fetch 후 props.
- **`force-dynamic`**: 세션·쿠키를 보는 라우트 37곳(전부 게이트 필요) — 적절. **법적 페이지·`/legal`·`/account/delete`·`/dev/profile` 은 SSG/정적 유지** 확인(빌드 표 `○`/`●`).
- **이미지**: `next/image` 미사용(정적 export·서명 URL·Supabase 변환 파이프라인 D7 담당). `<img>` 9곳 alt 보유. `loading="lazy" decoding="async"` 가 DuckCard 에만 있어 채팅·프로필·어드민 5곳에 추가(§5).
- **폰트**: `preconnect` + Pretendard CDN 스타일시트(렌더 차단 — 결정 17).
- **번들**: web 공통 103KB gz(react-dom 54 + Next 46). `/chat/*`·`/me/photos`·`/onboarding/photos` 에 Supabase 브라우저 클라이언트 청크 52KB gz(Realtime·Storage) 가 얹혀 235~278KB — 필요한 곳에만 로드되고 있어 정상. 미들웨어 110KB(Supabase SSR + zod).
- company: `optimizePackageImports` 로 배럴 제거 확인, 클라이언트 JS 는 `ContactForm`·`NavLink`·ui 도메인 컴포넌트뿐.

## 5. 수정 파일 목록 (파일별)

| 파일 | 변경 |
|---|---|
| `scripts/check-noindex.mjs` (신규) | build+start(더미 env, `NEXT_DIST_DIR`) → 70건 라우트/헤더/sitemap/robots + company `out/` 검사, 표 출력, exit 1 |
| `scripts/check-copy.mjs` (신규) | 10_brand §4.3·§4.4 사전 grep(주석·테스트 제외), 서비스명 리터럴 규칙, exit 1 |
| `scripts/measure-web-vitals.mjs` (신규) | Playwright LCP/CLS/FCP/TTFB/DOM/JS gz + axe-core(npm pack 캐시, 불가 시 자체 규칙) + `--lighthouse` + First Load JS 표(app-build-manifest) + company 정적 서버 |
| `scripts/lib/dummy-env.mjs` (신규) | 더미 env·크로미움 경로 단일 소스 |
| `package.json` (루트) | `check:copy`·`measure:vitals`·`check:all` 추가 |
| `apps/web/app/sitemap.ts` · `robots.ts` (신규) | 공식 10 URL / Disallow 25 + Sitemap(`NEXT_PUBLIC_SITE_URL`) |
| `apps/web/app/not-found.tsx` (신규) | 전역 404(noindex, `main#main`) |
| `apps/web/next.config.ts` | G2 보안 헤더 + E6 `X-Robots-Tag` + `distDir`(G1) + `optimizePackageImports` 병합 |
| `apps/web/app/layout.tsx` · `globals.css` | 스킵 링크 + `.skip-link` |
| `apps/web/app/(public)/page.tsx` | `main#main`, `title.absolute`(서비스명 중복 제거) |
| `apps/web/app/account/delete/page.tsx` | `robots index` + canonical(결정 8), `main#main` |
| `apps/web/app/(public)/legal/layout.tsx` · `(admin)/layout.tsx` · `components/onboarding/OnboardingFrame.tsx` · `packages/ui/src/components/domain/AppShell.tsx` | `main#main tabindex=-1 outline-none` |
| `apps/web/components/chat/MessageList.tsx` | 메시지 목록 `aria-live`, 대화 사진 `loading=lazy` |
| `apps/web/components/profile/PhotosScreen.tsx` · `app/(admin)/_components/{PhotoReviewGrid,EvidenceViewer}.tsx` · `app/(admin)/admin/users/[id]/page.tsx` | `<img loading="lazy" decoding="async">` |
| `apps/web/components/onboarding/copy.ts` | "본인인증 (지금 여기)" → "(이 단계)" — 금지 표현 `지금 여기`(위치) 오탐 회피 |
| `apps/web/components/discover/mock.ts` · `components/chat/dev/mockApi.ts` · `packages/ui/src/demo/DemoGallery.tsx` | 목 문구 "서울 근처"→"서울 같은 지역", "성동구 근처 러닝 코스"→"성동구 러닝 코스"(금지 표현 `근처`) |
| `apps/web/public/icons/*.png` · `apps/web/app/{icon,apple-icon}.png` · `apps/company/app/{icon,apple-icon}.png` (신규) | 플레이스홀더 아이콘(결정 11) |
| `docs/agents/27_fe_quality.md` (신규) | 이 문서 |

## 6. 미달 항목 · 원인 · 제안

| 항목 | 실측 | 목표 | 원인 | 제안 |
|---|---|---|---|---|
| company 홈 JS | 125KB gz(First Load) | ≤ 80KB gz | Next App Router 공통 102KB(react-dom+런타임) | 목표 개정(결정 16) 또는 Phase 5 위키 시점에 Astro 등 정적 프레임워크 검토 |
| Lighthouse Perf(랜딩) | 88~97(실행별 변동) | ≥ 90 | Pretendard CDN 렌더 차단(추정 300ms), 샌드박스에선 CDN 실패로 더 나쁘게 측정 | Phase 2 self-host(결정 17); 프로덕션 실측 후 재판정 |
| Lighthouse Perf(`/legal/terms`) | 77 | ≥ 90 | HTML 134KB(약관 전문 SSG) + 렌더 차단 CSS, `max-potential-fid` | 본문은 SSG 라 서버 비용 0. 목차 접기·`content-visibility: auto` 는 UX 변경이라 E6 범위 밖 |
| Lighthouse SEO(`/login`) | 63 | — | `is-crawlable` 실패 = noindex 의도 | 정상(무시) |
| Lighthouse `errors-in-console` | 실패 | — | 샌드박스 CDN 차단(`ERR_TUNNEL_CONNECTION_FAILED`) | 프로덕션 재확인 |
| 폰트 자체 호스팅 | CDN | Phase 2 | — | `next/font/local` |

## 7. 검증

- `node scripts/check-noindex.mjs`(NEXT_DIST_DIR=.next-e6) ✅ 70/70 · `node scripts/check-copy.mjs` ✅ 227 파일 위반 0(수정 후) · `node scripts/check-legal-placeholders.mjs` ✅ exit 0(플레이스홀더 경고는 의도)
- `pnpm -r typecheck` ✅ · `pnpm -r test` ✅ (db 70 · web 268) · `pnpm --filter @duckmate/web build` ✅ · `pnpm --filter @duckmate/company build` ✅ (13 페이지)
