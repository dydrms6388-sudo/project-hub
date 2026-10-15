# E6 · 접근성/성능/SEO 품질 게이트 — 덕메이트(DuckMate)

> 작성: 서브에이전트 E6 (접근성/성능/SEO 게이트) · 기준일 2026-08-19
> 입력: `06_PRD.md`(§4 비기능 요구, §3.3 배포 게이트 G-6, F-QLT-01/02) · `11_design_system.md`(C2 D-1/D-2/D-5-6 하드룰) · `26_fe_company.md`(E5 D-6 — 404 예외) · `apps/web/next.config.ts` · `apps/web/app/**` · `apps/company/**`
> 산출물: `scripts/check-indexing.mjs` · `scripts/check-a11y-tokens.mjs` · `scripts/check-secrets.mjs` · `scripts/lib/walk.mjs` · 루트 `package.json` 의 `gate` 스크립트
> 검증: `pnpm gate` 실행 확인 — **위반 5건 / 경고 2건으로 exit 1** (스크립트 자체 오류 0)

---

## 다음 에이전트에게 넘기는 결정사항

### D-1. 품질 게이트 단일 진입점 = 루트 `pnpm gate` · 새 의존성 0건

```bash
cd duckmate && pnpm gate     # 3개 스크립트를 && 로 직렬 실행, 하나라도 위반이면 exit 1
```

- 전부 **Node 내장 모듈(fs·path·url)만** 사용한다. `package.json` 의 `devDependencies` 는 손대지 않았다(추가 0건). CI 러너에 Node 20 만 있으면 `pnpm install` 없이도 `node scripts/*.mjs` 로 돌아간다.
- `gate` 는 `&&` 체인이라 **첫 실패에서 멈춘다.** 전체 위반을 한 번에 보려면 `pnpm gate:indexing`, `pnpm gate:a11y`, `pnpm gate:secrets` 를 각각 돌릴 것(개별 스크립트도 등록해 뒀다).
- 게이트는 **`apps/**`·`packages/**`·`supabase/**` 를 읽기만 한다.** 자동 수정(fix 모드)은 일부러 만들지 않았다 — 파일 소유권이 에이전트별로 갈려 있어 자동 수정이 남의 파일을 건드리기 때문이다. 위반은 **담당 에이전트가 직접 고친다**(§4 표).

### D-2. "공식 페이지" 정의는 코드로 고정 — `/` + `/legal/**` 뿐

`scripts/check-indexing.mjs` 의 `isOfficialWebPath()` 가 유일한 정의다. 이 목록에 없는 `apps/web` 라우트는 **전부 noindex 여야 한다**(PRD 절대 규칙 5 / F-QLT-01).

새 공식 페이지를 추가하려면 **두 곳을 동시에** 고쳐야 한다.

1. `apps/web/next.config.ts` 의 `X-Robots-Tag` `source` 예외
2. `scripts/check-indexing.mjs` 의 `isOfficialWebPath()`

**둘 중 하나만 고치면 게이트가 반드시 잡는다.** 헤더만 열고 메타를 안 열면 `WEB-OFFICIAL-NOINDEX`, 메타만 열고 헤더를 안 열면 `WEB-HEADER-OVERBLOCK`, 스크립트만 고치면 `WEB-HEADER-GAP` 이 뜬다. 이 이중 대조가 이 스크립트의 핵심이므로 **한쪽만 수정해서 게이트를 통과시키려 하지 말 것.**

> ⚠️ **HTTP 헤더가 메타 태그를 이긴다.** `X-Robots-Tag: noindex` 가 붙은 응답은 `metadata.robots.index = true` 를 무력화한다. "공식 페이지인데 인덱싱이 안 된다"는 사고의 90%가 이것이므로, 공식 페이지 추가 시 헤더 예외를 먼저 확인할 것.

### D-3. `apps/web` 에 sitemap·robots.txt 가 **없다** → 배포 게이트 G-6 현재 미충족 (담당: E4)

E6 의 파일 소유권은 `scripts/**` 뿐이라 만들 수 없다. **E4(공식 페이지·법적 문서 담당)가 아래 2개 파일을 생성해야 G-6 이 통과한다.**

- `apps/web/app/sitemap.ts` — 항목은 **정확히 7개**: `/` + `/legal` + `/legal/{terms,privacy,location,youth,community,refund}`. 그 외 라우트를 넣으면 `WEB-SITEMAP-UGC` 로 즉시 걸린다. base URL 은 하드코딩 금지, `process.env.NEXT_PUBLIC_SITE_URL` 사용(이미 `turbo.json` 의 `build.env` 에 등록돼 있음).
- `apps/web/app/robots.ts` — `Disallow` 를 명시하고(`/home`, `/discover`, `/chat`, `/likes`, `/me`, `/settings`, `/onboarding`, `/admin`, `/api`, `/appeal`, `/verify`, `/sanctioned`) `Allow: /`, `Allow: /legal/`, `sitemap` 을 넣는다. **회사 사이트 `apps/company/app/robots.ts` 를 복사해 오지 말 것 — 그쪽은 전체 Allow 라 정반대다.**

`export const dynamic = "force-static"` 를 붙여야 요청마다 렌더되지 않는다(company 쪽 선례 동일).

### D-4. `next.config.ts` 의 noindex 예외 `about` 은 **삭제 대상** (담당: 오케스트레이터 스캐폴드 / E4)

현재 값과 문제:

```ts
source: "/((?!$|legal|about).*)"   // ← "about" 에 해당하는 라우트가 존재하지 않는다
```

- `about` 은 스캐폴드에서 들어온 유령 예외다. **접두사 매칭**이므로 앞으로 `/about-me`, `/aboutus` 같은 라우트가 생기면 **아무도 모르게 인덱싱된다.**
- `legal` 도 같은 이유로 `/legalese` 류를 잘못 통과시킬 수 있다(경고 `WEB-HEADER-PREFIX-MATCH`).

권장 교체값 — 세그먼트 경계를 명시하고 유령 예외를 제거한다:

```ts
source: "/((?!$|legal(?=/|$)).*)"
```

교체 후 `pnpm gate:indexing` 을 다시 돌리면 해당 위반·경고가 동시에 사라진다(스크립트는 `(?=/` 유무를 보고 경고를 끈다).

### D-5. Lighthouse 는 **리포에 설치하지 않는다** — CI 에서 배포 URL 대상으로 측정

`@lhci/cli`·`lighthouse`·`playwright`(추가분)를 devDependencies 에 넣지 않았다. 이유는 세 가지다.

1. `apps/web` 은 Supabase 접속이 필요해 **CI 컨테이너에서 로컬 기동해도 로그인 뒤 화면을 측정할 수 없다.** 측정 가능한 건 어차피 공개 페이지(`/`, `/legal/**`)뿐이다.
2. PRD §4 성능 요구도 **"web 공개 페이지 · company 전체"** 로 한정돼 있다.
3. Vercel Preview 배포가 이미 G-1 에 있으므로, **배포된 Preview URL 을 때리는 것이 실측치에 가장 가깝다**(캐시·압축·CDN 포함).

구체 실행안은 §3. **CI 워크플로 파일(`.github/workflows/*.yml`) 은 E6 소유권 밖이라 만들지 않았다 — §3.1 YAML 을 그대로 복사해 쓰면 된다.**

### D-6. 정적 grep 의 한계 — 이 게이트가 **보증하지 않는 것**

`check-a11y-tokens.mjs` 는 문자열만 본다. 다음은 **자동 검증되지 않으므로** 수동 체크리스트(§5)와 G1 의 Playwright E2E 로 덮어야 한다.

- 실제 렌더된 색의 대비비(computed contrast) — 토큰을 썼다고 AA 가 보장되는 건 아니다. 토큰 자체의 대비는 C1/C2 가 표로 검증했으므로 **토큰 조합을 새로 만들 때만** 위험하다.
- 거절 버튼 70% 크기 규칙(C1 D-4-3) — DOM 측정이 필요해 정적 검사 불가.
- 키보드 포커스 순서·포커스 트랩·스크린리더 라벨.
- 런타임에 조립되는 클래스(`cn(cond && "bg-accent", ...)`)는 부분적으로만 잡힌다.

### D-7. 예외로 확정한 것 2건

| 예외 | 판단 |
|---|---|
| `apps/company/out/404.html` 의 `noindex` | **허용**(E5 D-6). Next not-found 기본 동작이며 제거 불가·불필요. 스크립트가 `404.html` 만 화이트리스트한다. |
| 같은 파일에 `noindex` 와 `index, follow` meta 가 **둘 다** 있는 것 | **경고만**(`CMP-404-CONFLICT`). 크롤러는 가장 제한적인 지시(noindex)를 따르므로 실동작 영향 없음. 다만 지시가 충돌하는 상태이므로 E5 가 정리하면 좋다(루트 layout 의 `robots` 를 404 에서 덮어쓰는 형태). **차단하지 않는다.** |

---

## 1. 게이트 항목표

`✅` = 스크립트로 자동 검사(위반 시 exit 1) · `⚠️` = 자동 검사하되 경고만 · `👤` = 수동(§5) · `🔜` = CI 구성 후 자동

| # | 검사 대상 | 기준 (출처) | 자동화 | 규칙 ID / 도구 |
|---|---|---|:---:|---|
| Q-1 | `apps/web` 전 라우트의 실효 `metadata.robots` | 공식 페이지(`/`, `/legal/**`)만 index, 나머지 전부 noindex (PRD 절대규칙 5 / F-QLT-01) | ✅ | `WEB-UGC-INDEXABLE` / `WEB-OFFICIAL-NOINDEX` / `WEB-META-MISSING` |
| Q-2 | `next.config.ts` 의 `X-Robots-Tag` source ↔ 실제 라우트 | 비공식 라우트 100% 커버, 공식 페이지는 미커버 | ✅ | `WEB-HEADER-GAP` / `WEB-HEADER-OVERBLOCK` / `WEB-HEADER-MISSING` |
| Q-3 | 헤더 예외 토큰의 유효성 | 예외는 실재하는 공식 라우트에만, 세그먼트 경계 명시 | ✅ / ⚠️ | `WEB-HEADER-STALE-EXCEPTION` / `WEB-HEADER-PREFIX-MATCH` |
| Q-4 | `apps/web` sitemap | 존재 + 공식 페이지만 포함 (G-6) | ✅ | `WEB-SITEMAP-MISSING` / `WEB-SITEMAP-UGC` |
| Q-5 | `apps/web` robots.txt | 존재 + UGC Disallow 명시 | ✅(존재만) / 👤(내용) | `WEB-ROBOTSTXT-MISSING` |
| Q-6 | `apps/company` 라우트 인덱싱 | 전 페이지 index 허용, 404 만 예외 (E5 D-6) | ✅ | `CMP-NOINDEX` / `CMP-OUT-NOINDEX` |
| Q-7 | `apps/company` sitemap 집합 | sitemap 경로 집합 == 실제 라우트 집합 | ✅ | `CMP-SITEMAP-GHOST` / `CMP-SITEMAP-MISS` |
| Q-8 | `apps/company` 정적 export 산출물 실측 | `out/*.html` 의 meta robots (빌드 후에만) | ⚠️ | `CMP-OUT-*` (`out/` 없으면 스킵 경고) |
| Q-9 | 색상 토큰 준수 | hex·임의값·외부 팔레트 금지 (C2 D-1) | ✅ | `A11Y-HEX` / `A11Y-ARBITRARY` / `A11Y-PALETTE` |
| Q-10 | 코랄 하드룰 | 코랄 배경 + 흰/검정/`text-ink` 텍스트 금지 (C2 D-2) | ✅ | `A11Y-CORAL` |
| Q-11 | 최소 폰트 크기 | 13px 미만 유틸·선언·**신규 토큰 정의** 금지 (C2 D-5-6, PRD 접근성 "자동갱신 고지 최소 13px") | ✅ | `A11Y-FONT-SM` |
| Q-12 | 순수 흑백 배경 | `bg-white`/`bg-black` 금지, `text-white` 는 brand-600+ 딥 배경에서만 (C2 §1) | ✅ / ⚠️ | `A11Y-RAW-BW` / `A11Y-WHITE-TEXT` |
| Q-13 | 비밀값 커밋 | `.env.example` 외 실키 금지 (PRD §4 보안) | ✅ | `SEC-JWT-SERVICE` / `SEC-JWT` / `SEC-TOSS` / `SEC-PORTONE` / `SEC-SUPABASE-URL` / `SEC-PRIVATE-KEY` / `SEC-VAPID` / `SEC-ENV-ASSIGN` |
| Q-14 | `.env` 파일 관리 | `.env*` gitignore, 실파일 미커밋 | ✅ | `SEC-GITIGNORE` / `SEC-ENV-FILE` |
| Q-15 | Lighthouse P/A/BP/SEO 각 90+ | web 공개 페이지 + company 전체 (PRD §4, G-6) | 🔜 | §3 CI 워크플로 |
| Q-16 | WCAG AA 대비 실측 | 렌더된 색 대비 | 👤 / 🔜 | axe-core (G1 E2E 내) |
| Q-17 | 거절 버튼 ≥ 수락 버튼 70% | C1 D-4-3 / 다크패턴 금지 | 👤 | §5 체크리스트 |
| Q-18 | 키보드 내비게이션 · 포커스 가시성 | PRD §4 접근성 | 👤 | §5 체크리스트 |
| Q-19 | 다크모드 2경로(시스템/토글) 동작 | C2 D-4 | 👤 | §5 체크리스트 |
| Q-20 | 다크패턴 금지 컴포넌트 부재 | 카운트다운·재고·손실공포 (C2 D-3) | 👤 | §5 체크리스트 |

---

## 2. 스크립트 사용법

### 2.1 명령

```bash
cd duckmate

pnpm gate            # 3종 전체 (첫 실패에서 중단, exit 1)
pnpm gate:indexing   # UGC noindex / sitemap / robots
pnpm gate:a11y       # 디자인 하드룰 (색·코랄·폰트)
pnpm gate:secrets    # 비밀값 커밋 검사

NO_COLOR=1 pnpm gate # CI 로그용 (색 코드 제거)
```

- 종료 코드: 위반 0건 → `0`, 1건 이상 → `1`. **경고는 종료 코드에 영향을 주지 않는다.**
- 출력 형식: `규칙ID  파일:줄  \n  설명  \n  담당: …`. 담당은 파일 경로로 추정한 값이므로 참고용이다(정확한 배정은 §4 표).
- 실행 시간: 3종 전부 합쳐 **0.3초 미만**(외부 프로세스·네트워크 없음). pre-commit 훅에 걸어도 부담 없다.

### 2.2 파일

| 파일 | 역할 |
|---|---|
| `scripts/lib/walk.mjs` | 공통 유틸 — 파일 트리 워커, App Router 라우트 추출(`(group)`·`@slot`·`_private` 처리), 리포터 |
| `scripts/check-indexing.mjs` | Q-1 ~ Q-8 |
| `scripts/check-a11y-tokens.mjs` | Q-9 ~ Q-12 |
| `scripts/check-secrets.mjs` | Q-13 ~ Q-14 |

### 2.3 `check-indexing.mjs` 가 실제로 하는 일

1. `apps/web/app` 을 훑어 `page.*` / `route.*` 를 라우트로 변환한다(라우트 그룹·병렬 라우트 세그먼트 제거, `_` 폴더 제외). **현재 page 38개 + route(API) 3개.**
2. 라우트마다 `page.tsx → 가장 가까운 layout.tsx → … → app/layout.tsx` 순으로 올라가며 **`robots:` 를 선언한 첫 파일**을 찾는다(Next 의 metadata 상속 규칙과 동일). 파일 안에 `index: true/false` 가 여러 번 나오면 전부 수집해 "index 를 허용하는 분기가 하나라도 있는가"로 판정한다 — `app/legal/[slug]/page.tsx` 처럼 잘못된 slug 는 noindex, 유효 slug 는 index 인 케이스를 잡기 위해서다.
3. `next.config.ts` 의 `headers()` 블록에서 `X-Robots-Tag: noindex` 를 붙이는 `source` 문자열을 뽑아 `^…$` 앵커를 씌운 `RegExp` 로 만들고, **모든 라우트 경로를 실제로 테스트**한다(동적 세그먼트는 `sample` 로 치환). `:param` 형태의 path-to-regexp 문법이 섞이면 정적 평가가 불가능하므로 경고로 빠진다.
4. sitemap/robots 존재와 내용, company 쪽 라우트·sitemap 일치, `out/*.html` 실측을 검사한다.

**API Route Handler(`app/api/**`)에는 metadata 개념이 없다.** 그래서 이 라우트들은 오직 3번의 헤더 규칙으로만 보호되며, 스크립트도 헤더 커버리지만 확인한다. 헤더 규칙을 좁히면 API 응답이 인덱싱 가능해지므로 주의.

### 2.4 예외를 추가해야 할 때

- **새 공식 페이지**: D-2 참조(두 곳 동시 수정).
- **company 에 인덱싱 제외 페이지가 필요해지면**: `checkCompany()` 의 `is404` 화이트리스트를 확장하지 말고, **먼저 오케스트레이터에 보고**할 것 — 회사 사이트 전 페이지 인덱싱은 C4/E5 확정 사항이다.
- **`A11Y-*` 오탐**: 클래스 문자열을 런타임 조립하다 생긴 오탐이면, 그 코드를 **`packages/ui` 의 컴포넌트 variant 로 옮기는 것이 정답**이다(C2 D-2: "직접 조립하지 말고 `Button variant="accent"` 를 써라"). 스크립트에 예외를 뚫지 말 것.
- **`SEC-*` 오탐**: 테스트 픽스처의 가짜 키는 `YOUR_`, `<...>`, `example`, `dummy`, `xxxx`, `TODO`, `REPLACE` 중 하나를 포함시키면 플레이스홀더로 인식된다.

---

## 3. Lighthouse 측정 방법 (로컬 서버 없이 CI 에서)

### 3.1 제안 워크플로 (`.github/workflows/quality.yml` — **미생성, E6 소유권 밖**)

```yaml
name: quality
on: [pull_request]

jobs:
  gate:                       # 항상 실행. 네트워크·설치 불필요
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/check-indexing.mjs
        working-directory: duckmate
      - run: node scripts/check-a11y-tokens.mjs
        working-directory: duckmate
      - run: node scripts/check-secrets.mjs
        working-directory: duckmate

  lighthouse-company:         # 정적 export = 서버 불필요, 가장 싸고 안정적
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
        working-directory: duckmate
      - run: pnpm --filter @duckmate/company build
        working-directory: duckmate
      # out/ 를 정적 서빙만 하면 되므로 npx 로 1회성 실행 (리포 의존성 추가 없음)
      - run: npx --yes serve -l 4173 duckmate/apps/company/out &
      - run: npx --yes wait-on http://localhost:4173
      - run: |
          npx --yes @lhci/cli@0.14.x autorun \
            --collect.url=http://localhost:4173/ \
            --collect.url=http://localhost:4173/safety \
            --collect.url=http://localhost:4173/legal \
            --collect.url=http://localhost:4173/contact \
            --collect.settings.preset=desktop \
            --assert.assertions.categories:performance=error:0.9 \
            --assert.assertions.categories:accessibility=error:0.9 \
            --assert.assertions.assertions.categories:best-practices=error:0.9 \
            --assert.assertions.categories:seo=error:0.9

  lighthouse-web:             # Vercel Preview 배포가 뜬 뒤에만
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'
    steps:
      - run: |
          npx --yes @lhci/cli@0.14.x autorun \
            --collect.url=${{ github.event.deployment_status.environment_url }}/ \
            --collect.url=${{ github.event.deployment_status.environment_url }}/legal \
            --collect.url=${{ github.event.deployment_status.environment_url }}/legal/terms \
            --assert.assertions.categories:performance=error:0.9 \
            --assert.assertions.categories:accessibility=error:0.9 \
            --assert.assertions.categories:seo=error:0.9
```

### 3.2 왜 이렇게 나눴나

| 앱 | 측정 방식 | 이유 |
|---|---|---|
| `apps/company` | CI 안에서 `next build`(export) → `npx serve out` → LHCI | **DB·env 의존이 전혀 없다.** 순수 정적 HTML 4장이라 CI 에서 재현 가능하고 결과가 안정적이다. `npx --yes` 는 1회성 실행이라 리포 의존성이 늘지 않는다. |
| `apps/web` | **Vercel Preview URL** 에 LHCI | 로그인 뒤 화면은 Supabase 세션이 필요해 CI 로컬 기동으로는 측정 불가. 측정 대상은 어차피 공개 3페이지(`/`, `/legal`, `/legal/{slug}`)뿐이고, PRD §4 도 "web **공개 페이지**"로 한정했다. CDN·압축·이미지 최적화가 실제 배포와 동일하게 반영되는 이점도 있다. |

### 3.3 로컬에서 1회 확인하고 싶을 때 (설치 없이)

```bash
# company
cd duckmate && pnpm --filter @duckmate/company build
npx --yes serve -l 4173 apps/company/out
npx --yes lighthouse http://localhost:4173/ --preset=desktop --view

# web (Supabase env 필요)
cd duckmate && pnpm --filter @duckmate/web build && pnpm --filter @duckmate/web start
npx --yes lighthouse http://localhost:3000/ --preset=desktop --view
```

`npx --yes` 로만 부르므로 `package.json` 에 아무것도 추가되지 않는다(기술 제약 준수).

### 3.4 점수를 깎을 것으로 예상되는 항목 (선제 대응 목록)

| 예상 감점 | 근거 | 담당 |
|---|---|---|
| **FOUT / 폰트 CLS** | Pretendard Variable 셀프호스팅 미구현 — 폰트 스택 선언만 있고 `@font-face`·woff2 파일이 없어 시스템 폰트로 폴백 중 (C2 D-6, E5 D-7). 나중에 woff2 를 넣으면서 `font-display` 를 빠뜨리면 CLS 가 발생한다. | C2 (토큰) + 폰트 파일 추가 시 |
| **이미지 CLS** | `apps/web/app/(main)/chat/[matchId]/_components/chat-image.tsx`, `.../discover/[profileId]/page.tsx` 등이 signed URL 때문에 `next/image` 대신 raw `<img>` 를 쓴다. `discover` 쪽은 `aspect-square` 로 박스가 고정돼 안전하지만, **`chat-image.tsx` 는 `max-h-64 w-auto` 라 로드 전후 폭이 변한다.** | E3 |
| **OG 이미지 부재** | `apps/company` 의 `openGraph.images` 와 Organization JSON-LD `logo` 가 비어 있음(E5 D-7). SEO 카테고리 직접 감점은 없으나 공유 품질 문제. | C1(에셋) → E5 |
| **랜딩 `/` 의 SEO 메타** | `apps/web/app/page.tsx` 에 `title`/`description` 개별 선언이 없어 루트 layout 기본값을 그대로 쓴다(중복 자체는 문제 없음). canonical·OG 는 없음. | E4 |

---

## 4. 현재 위반 목록 (2026-08-19 `pnpm gate` 실측)

**위반 5건 / 경고 2건.** E6 는 `scripts/**` 외 파일을 고칠 수 없으므로 **전부 담당 에이전트가 조치해야 한다.**

### 4.1 위반 (게이트 차단)

| # | 규칙 ID | 위치 | 내용 | 담당 | 조치 |
|---|---|---|---|---|---|
| V-1 | `WEB-SITEMAP-MISSING` | `apps/web/app/sitemap.ts` (부재) | apps/web 에 sitemap 이 아예 없다. **PRD 배포 게이트 G-6 "공식 페이지만 sitemap" 미충족.** | **E4** | D-3 의 스펙대로 `app/sitemap.ts` 생성 (항목 정확히 7개: `/`, `/legal`, `/legal/{terms,privacy,location,youth,community,refund}`) |
| V-2 | `WEB-ROBOTSTXT-MISSING` | `apps/web/app/robots.ts` (부재) | robots.txt 생성부가 없어 크롤러에 Disallow·sitemap 위치를 알리지 못한다. | **E4** | D-3 의 스펙대로 `app/robots.ts` 생성. company 파일 복사 금지(정반대 정책) |
| V-3 | `WEB-HEADER-STALE-EXCEPTION` | `apps/web/next.config.ts:7` | noindex 예외 `about` 에 해당하는 라우트가 없다. 접두사 매칭이라 `/about*` UGC 라우트가 생기면 그대로 인덱싱된다. | **오케스트레이터(스캐폴드 소유) → E4 재배정 권장** | D-4 의 교체값 적용: `source: "/((?!$\|legal(?=/\|$)).*)"` |
| V-4 | `A11Y-PALETTE` | `apps/web/app/page.tsx:23` | `text-gray-500` — 토큰 밖 기본 팔레트. **다크모드에서 스왑되지 않아 어두운 배경 위 회색으로 남아 AA 대비가 깨진다.** | **오케스트레이터(스캐폴드) → E4** | `text-ink-muted` 로 교체 |
| V-5 | `A11Y-FONT-SM` | `apps/web/app/page.tsx:23` | `text-xs`(12px) — 13px 미만 금지. 해당 문구가 **"만 19세 이상만 이용할 수 있어요"** 라는 법적 고지성 텍스트라 PRD §4 "자동갱신 고지 최소 13px" 취지에 정면으로 걸린다. | **오케스트레이터(스캐폴드) → E4** | `text-caption`(13px) 이상으로 교체 |

> V-3·V-4·V-5 는 전부 **그룹 A 스캐폴드 커밋(`b9a2620`)에서 온 파일**이고 이후 아무 FE 에이전트도 손대지 않았다(`apps/web/app/page.tsx`, `next.config.ts`). 랜딩 `/` 는 공식 인덱싱 대상 1순위 페이지이므로 **소유자를 E4 로 명시 배정할 것을 오케스트레이터에 요청한다.**

### 4.2 경고 (차단 아님, 정리 권장)

| # | 규칙 ID | 위치 | 내용 | 담당 |
|---|---|---|---|---|
| W-1 | `WEB-HEADER-PREFIX-MATCH` | `apps/web/next.config.ts:7` | 예외 `legal` 이 세그먼트 경계 없이 접두사 매칭 — `/legalxxx` 류가 생기면 인덱싱된다. V-3 과 같은 수정으로 동시 해소. | 오케스트레이터 / E4 |
| W-2 | `CMP-404-CONFLICT` | `apps/company/out/404.html` | `noindex` 와 `index, follow` meta 가 동시에 있다. 크롤러는 noindex 를 따르므로 실동작 영향 없음(E5 D-6 예외). | E5 (선택) |

### 4.3 통과 확인된 항목 (회귀 감시용 기준선)

- `apps/web` **page 라우트 38개 전부** 실효 robots 판정 성공 — 공식 2종(`/`, `/legal`, `/legal/[slug]`) 외 **UGC 인덱싱 가능 라우트 0건.** 루트 `app/layout.tsx` 가 `robots: { index:false, follow:false }` 를 기본값으로 깔아 둔 설계 덕분에 신규 라우트도 기본 noindex 다 — **이 기본값을 절대 제거하지 말 것.**
- `X-Robots-Tag` 헤더가 비공식 라우트 **38개(page 35 + API route 3)** 를 100% 커버, 공식 3종(`/`, `/legal`, `/legal/[slug]`)은 미커버(정상 — 헤더가 붙으면 metadata 의 index 가 무효화되므로).
- `apps/company` 4개 라우트 전부 index 허용, sitemap 집합 == 라우트 집합, `out/` 실측에서 noindex 는 `404.html` 1건뿐.
- 색상 토큰: hex 리터럴 0건, 임의값 색상 0건, `bg-white`/`bg-black` 0건, **코랄 하드룰 위반 0건**(`packages/ui/src/button.tsx` 의 `accent` variant 가 `bg-accent text-accent-fg` 로 올바르게 구현돼 있다).
- 비밀값: 183개 소스 + 리포 전체 300+ 파일에서 JWT·Toss·PortOne·PEM·env 실값 **0건.** `.env*` 는 `.gitignore` 에 정상 등록, 워킹트리에 실 `.env` 파일 없음, `.env.example` 2종은 전부 플레이스홀더.

### 4.4 스크립트가 잡지 않았지만 기록해 두는 관찰

| 관찰 | 위치 | 판단 | 담당 |
|---|---|---|---|
| 비토큰 타이포 유틸 `text-4xl`·`text-lg` 사용 | `apps/web/app/page.tsx:11,12` | C2 타이포 토큰(`text-display`/`text-h1`/`text-body`)을 쓰지 않았다. 13px 미만은 아니라 **위반은 아니지만** 랜딩만 다른 타이포 스케일을 쓰게 된다. | E4 |
| 루트 layout 에 스킵 링크 없음 | `apps/web/app/layout.tsx` | `(main)`·company 레이아웃에는 "본문으로 건너뛰기"가 있으나 랜딩·onboarding 경로에는 없다. 랜딩은 링크 2개짜리 짧은 페이지라 감점 가능성은 낮음. | E4 / E1 |
| `chat-image.tsx` 의 고정 박스 부재 | `apps/web/app/(main)/chat/[matchId]/_components/chat-image.tsx:54` | 로드 전 스켈레톤은 `h-40 w-40` 인데 실제 이미지는 `max-h-64 w-auto` → **레이아웃 시프트.** 비공개 라우트라 Lighthouse 측정 대상은 아니지만 체감 품질 문제. | E3 |

---

## 5. 미자동화 항목 — 수동 체크리스트

배포 전(G-6 판정 시) **1회 전수 확인**하고 결과를 `docs/DEPLOY_LOG.md` 에 기록한다. 브라우저 기본 도구(DevTools) 외 설치 불필요.

### 5.1 접근성 (WCAG AA)

- [ ] **키보드만으로** 온보딩 7단계 → 추천 → 좋아요 → 매칭 모달 → 채팅 전송 → 신고 시트까지 완주된다(마우스 금지).
- [ ] 모든 인터랙티브 요소에 **눈에 보이는 포커스 링**이 있다(현재 `focus-visible:` 이 22개 파일에 적용돼 있으나 전수는 미확인).
- [ ] 네이티브 `<dialog>` 기반 모달(매칭 리빌·신고 시트)에서 **포커스 트랩 + ESC 닫기 + 닫은 뒤 원래 요소로 포커스 복귀**가 동작한다.
- [ ] 상태를 **색으로만** 전달하는 곳이 없다(인증 뱃지·궁합 %·경고 배너에 텍스트/아이콘 병행 — C2 D-5-7).
- [ ] `Input`/`Textarea`/`Select` 의 에러가 `aria-describedby` 로 연결돼 스크린리더가 읽는다(C2 D-5-8).
- [ ] `prefers-reduced-motion` 에서 매칭 리빌 애니메이션이 정지한다(`motion-reduce:animate-none` 적용 확인됨 — 실동작 확인 필요).
- [ ] 이미지 `alt`: 프로필 사진은 의미 있는 대체 텍스트, 장식 이미지는 `alt=""`.
- [ ] 페이지 제목(`<title>`)이 라우트마다 고유하다.

### 5.2 다크패턴 · 디자인 하드룰 (DOM 측정 필요)

- [ ] **거절/나중에/닫기 버튼이 수락 CTA 대비 70% 이상 크기**다(C1 D-4-3). DevTools 로 두 버튼의 `getBoundingClientRect()` 비교.
- [ ] 카운트다운 타이머 · 재고 표시 · 손실공포 배너가 **어디에도 없다**(C2 D-3 / PRD 공통확정 5).
- [ ] 세션 시작 자동 페이월 팝업이 없고, 동일 `paywall_source` 는 일 1회만 뜬다(A4 §3 — Phase 3).
- [ ] 화면당 코랄 사용 영역이 1~2곳 이내다(C2 D-2).

### 5.3 다크모드 (C2 D-4 — 2경로 전부)

- [ ] OS 다크 + `data-theme` 미설정 → 다크로 렌더.
- [ ] OS 다크 + `data-theme="light"` → 라이트로 렌더(시스템 선호를 이긴다).
- [ ] OS 라이트 + `data-theme="dark"` → 다크로 렌더.
- [ ] 다크 상태에서 본문·캡션 대비가 AA(4.5:1) 이상 — 특히 `text-ink-muted`(`#a49dbb`) on `bg-surface`(`#141220`).

### 5.4 SEO 실측 (배포 후)

- [ ] 프로덕션 `/home`, `/chat/*`, `/discover/*` 응답 헤더에 `X-Robots-Tag: noindex, nofollow` 가 **실제로** 붙는다 → `curl -sI <url> | grep -i x-robots-tag`.
- [ ] 프로덕션 `/` 와 `/legal/terms` 응답에는 그 헤더가 **없다**.
- [ ] `/sitemap.xml` 이 200 이고 공식 7개 URL 만 담고 있다(V-1 조치 후).
- [ ] `/robots.txt` 가 200 이고 UGC 경로가 Disallow 돼 있다(V-2 조치 후).
- [ ] company 사이트 `site:` 검색 대비 — 4개 라우트만 노출 대상.

### 5.5 성능 (§3 실행 후)

- [ ] company 4페이지 Lighthouse P/A/BP/SEO 각 90+.
- [ ] web 공개 3페이지 Lighthouse P/A/BP/SEO 각 90+.
- [ ] 폰트 셀프호스팅 도입 시 `font-display: swap` + 서브셋 적용, 외부 CDN 미사용(C1 §3.1).

---

## 6. 후속 · 인계

| 항목 | 상태 | 다음 담당 |
|---|---|---|
| V-1 ~ V-5 조치 | **미해결 — 게이트 차단 중** | E4 (+ 오케스트레이터의 소유권 배정) |
| `.github/workflows/quality.yml` 생성 | 미생성(E6 소유권 밖) — §3.1 YAML 그대로 사용 가능 | G3 (배포) 또는 오케스트레이터 |
| axe-core 접근성 자동 검사 | 미도입 — Playwright E2E 안에 `@axe-core/playwright` 를 붙이는 것이 가장 싸다(E2E 는 이미 G1 소관이라 의존성 추가 판단도 G1) | G1 |
| 거절 버튼 70% 규칙 자동화 | 미도입 — DOM 측정이 필요해 정적 검사 불가. G1 의 E2E 케이스로 추가 권장 | G1 |
| Pretendard 셀프호스팅 | 미구현(C2 D-6, E5 D-7) — 성능 게이트 통과 전 처리 | C2 / 폰트 에셋 담당 |
| `turbo.json` 에 `gate` 태스크 등록 | 미등록 — 루트 `package.json` 스크립트로만 호출한다. 캐시가 필요 없을 만큼 빨라(0.3초) 의도적으로 두지 않았다 | — |
| 게이트 pre-commit 훅 | 미도입 — husky 등 새 의존성이 필요해 보류. 필요하면 `.git/hooks/pre-commit` 에 `cd duckmate && pnpm gate` 한 줄 | 리포 소유자 |
