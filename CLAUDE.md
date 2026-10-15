# TomatoEggCat — repo guide for Claude Code

한국어 마이크로 도구 허브 (`tomatoeggcat.com`). **정적 사이트, 빌드 프레임워크 없음.**

## 아키텍처 (핵심)
- 순수 정적 HTML. Next.js/React/번들러 **없음**. Vercel에 루트를 그대로 서빙.
- `node gen-pages.mjs` 가 `projects.json` → 앱별 랜딩(`/<slug>/index.html`) + 허브
  `index.html` + `sitemap.xml` + `vercel.json` 을 **생성**한다. (배포마다 재실행)
- ⚠️ 생성 산출물은 **손으로 고치지 말 것** (배포 때 덮어씀): `index.html`,
  `sitemap.xml`, `vercel.json`, 그리고 대부분의 `/<slug>/index.html`.
- 예외 = **내장(builtin) 앱**: `gen-pages.mjs` 의 `BUILTINS` 배열에 등록된 slug 폴더는
  손으로 관리하는 "진짜 앱"이며 생성기가 덮어쓰지 않는다 (verification 메타만 주입).
  기존: salary, dsr, jeonse-loan, yangdo, refinance, age, dday, bmi, pyeong.

## 새 자립형(client-side) 앱을 추가하는 법
1. `/<slug>/index.html` 에 **단일 파일 완결형** 앱 작성 (백엔드/외부 API/키 금지).
2. `gen-pages.mjs` 의 `BUILTINS` 배열 + `BUILTIN_CATS` 에 등록 → 허브·사이트맵 반영,
   생성기의 orphan 정리에서 보호됨.
3. `node gen-pages.mjs` 실행해 경고 0 확인 (`광고 영역`/`REPLACE_` 잔재 금지).

## 콘텐츠/정책 규칙 (AdSense·품질)
- 광고: 결과 하단 1개만. 입력 화면 광고 금지. `광고 영역` 플레이스홀더 텍스트 금지
  (배포 가드가 grep 으로 잡아 경고). 실제 `adsbygoogle` 유닛(ca-pub-5567719201265106) 사용.
- 민감정보(실명/전화/주민번호/이메일) 수집 금지.
- AI/알고리즘 출력은 진단·의료·법률·금융 확정 표기 금지 → **"재미용" 고지 필수**.
- 타인 비하·외모평가형 결과 금지.
- 각 페이지 고유 title/description, 고유 본문(소개/사용법/FAQ), JSON-LD
  (SoftwareApplication + FAQPage + BreadcrumbList).

## VIRAL 앱 (바이럴 정적 앱) 공통 요건 — 신규 앱은 5요소 모두 구현
1. 결과는 **URL 상태**(`?r=<base64>`)로 인코딩 → 링크 = 결과 랜딩 (백엔드 없이
   `/r/{slug}` 대체). 로드 시 `?r=` 있으면 그 결과를 즉시 재현.
2. 공유 유입(`?r=` 존재) 시 첫 화면에 **"나도 해보기" CTA** 노출.
3. **결과 카드** = canvas 로 PNG 저장 가능 + 도메인 워터마크(`tomatoeggcat.com/<slug>`).
4. 공유: 링크 복사 / 커뮤니티 텍스트 블록 복사 / X / navigator.share.
5. **리믹스**: 이전 입력 프리필로 1클릭 재생성.

> 정적 스택 한계: 결과별 **동적 OG 이미지**(Satori/ImageResponse)는 서버가 없어 불가.
> 대체로 canvas 카드(사용자가 저장·업로드)를 제공한다. 정적 OG 는 앱 단위로만 존재.
> 서버·DB·유료 AI 키가 필요한 기능(daily 자동발행 cron, 서버 레이트리밋 등)은
> 이 스택에서 미구현 — 도입하려면 소유자 승인(과금) 필요.

## 개발
- 로컬 확인: `node gen-pages.mjs` 후 정적 서버로 열기. 테스트 러너 없음.
- 검증 메타 코드는 `site.config.mjs` / env (`GOOGLE_SITE_VERIFICATION` 등)에서 주입.

## 영어권(K-culture) 앱 — 프롬프트 팩 5
- 대상이 영어권이라 **UI·본문·FAQ·JSON-LD 전부 영어**(`<html lang="en">`, `og:locale=en_US`).
  한국어는 도구가 내놓는 호칭·예문에만 쓴다. 기계번역 톤 금지.
- 현재: **`whatdoicallthem`** (K1, Korean Title Calculator). 허브 카테고리 `🌏 English · K-culture`.
  - 구성: `/`(계산기) + `/titles/`(12종 레퍼런스) + `/quiz/`(15문항) + `/guide/`(3편) = 18페이지.
  - 규칙 엔진은 `index.html` 안에 인라인(단일 파일 원칙). 데이터 테이블이 아니라 **함수형 해석기**라
    조합 누락이 구조적으로 불가능하고, 그 사실을 게이트로 검증한다.
- **DEPLOY GATE**: `node whatdoicallthem/coverage-test.mjs` (경고 0 / exit 0).
  index.html 에서 엔진 블록(`title dictionary` ~ `state → URL` 주석 사이)을 떼어내 5,670개 조합을
  전수 검사한다. 섹션 주석을 바꾸면 게이트가 먼저 깨지므로 그대로 둘 것.
- gen-pages.mjs 연동 3가지:
  - `BUILTINS` + `BUILTIN_CATS` + `CORE_SLUGS` 등록 → 색인·sitemap 대상.
  - **`SELF_MANAGED`**: 자체 OG/JSON-LD/편집블록을 가진 앱. CORE 전용 한국어 주입
    (`✍️ 작성·검토 … 2026년 고시 요율`, ko-KR SoftwareApplication, theme-sync)을 **주입도 제거도 안 한다**.
    영어 페이지에 한국어 세법 문구가 붙는 사고를 막는 장치이므로 영어권 앱은 반드시 여기 등록.
  - **`SUBPAGE_INDEXED`**: 하위 문서를 가진 앱만 옵트인으로 `walkSubpages()` 로 sitemap 에 싣는다
    (전수 자동탐색은 news-cards 의 일자별 아카이브 30여 개까지 쓸어담아서 안 함).
- 팩 5 잔여 9종(K2 hangul60, K6 koreatripcost, K3 saymykorean, K5 koreannumbers, K8
  koreanfamilytitles, K4 koreanpoliteness, K9 hanguldaily-en, K7 koreanaddress, K10 kstylecard)은
  미착수. 팩 문서는 Next.js 템플릿 전제이지만 이 저장소는 정적이므로 K1 과 같은 방식으로 이식한다.

## 서브프로젝트: `illusion-lab/` (별도 배포)
- 인터랙티브 착시 실험실. **Next.js 15 App Router + 정적 export** — 허브의
  gen-pages 파이프라인과 무관하며 별도 Vercel 프로젝트(root=`illusion-lab`)로 배포.
- `illusion-lab/data/illusions.json` 이 단일 소스. slug 추가 시 renderer
  (`src/lib/renderers/`), SVG 도형(`src/lib/figures.tsx`), 본문
  (`src/lib/content/`) 3종 등록 필요 — `node scripts/check-coverage.mjs` 로 검사.
- 빌드: `cd illusion-lab && npm install && npm run build` → `out/`.
- gen-pages.mjs 의 RESERVED 에 `illusion-lab` 등록됨(고아 정리 보호).
