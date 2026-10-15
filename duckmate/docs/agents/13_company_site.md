# 13 — 회사 소개 사이트 IA·카피 (C4)

> 입력: `00_brief.md` §회사 소개 사이트·절대 규칙 4·5, `06_PRD.md` §0-21·22·27·49·54, F-041·F-042·F-048·F-089·F-092, `01_market.md` §4(포지셔닝 1안·카테고리 Top 8), `05_trust_safety.md` §1·§6·§11(안전 페이지 원천).
> 구현 담당: **E6**(`apps/company`, PRD 담당표). 브리프 원문은 "E5"로도 읽히나 PRD 담당표가 `apps/company`를 E6으로 확정했으므로 본 문서는 E6으로 표기한다. 코드 없음. 카피는 그대로 붙여 넣어도 되는 수준으로 작성했고, 플레이스홀더는 `company.ts` 값으로 치환된다.

## 다음 에이전트에게 넘기는 결정사항

1. **라우트 확정(정적 export, `trailingSlash: true`)**: `/` 홈 · `/service/` 서비스 소개 · `/safety/` 안전과 신뢰 · `/team/` 팀·비전 · `/blog/` 목록 · `/blog/[slug]/` 상세 · `/press/` 보도자료(블로그의 `type: press` 필터 뷰, 별도 콘텐츠 폴더 아님) · `/careers/` 채용 · `/contact/` 문의 · `/legal/{terms,privacy,location,youth,business}/` 법적 고지 · `/wiki/` 위키 허브 · `/wiki/[slug]/` 취미 글(Phase 5) · `/404`. 이 외 라우트 추가 금지(어드민 프론트는 `apps/web/(admin)`이지 company가 아님).
2. **Phase 1 최소 범위 = `/`, `/legal/*` 5종, `/contact/` 만 빌드에 포함.** 나머지 라우트 폴더는 만들되 `page.tsx`를 두지 않는다(링크·사이트맵에서도 제외). 헤더 내비에는 Phase 1에 "서비스 소개·안전" 대신 앱 링크 1개만 노출. Phase 5(F-092)에서 서비스/안전/팀/블로그/채용 활성화, 같은 Phase에 위키(F-089).
3. **홈의 안전 요약 3항목은 Phase 1부터 노출**(A1 §12 "신고 SLA 24h를 마케팅 카피로 전면 노출"). 단 `/safety/` 상세 페이지는 Phase 5이므로, Phase 1 홈의 안전 카드 링크는 `/legal/privacy/`·`/legal/youth/`로 보낸다.
4. **`apps/company/config/company.ts` 스키마**(§2 전문): 모든 값은 `string`, 미입력은 `{{KEY}}` 토큰 그대로 둔다(`null`·빈 문자열 금지). `check-legal-placeholders.mjs`의 정규식 `\{\{[A-Z_]+\}\}`가 그대로 잡도록 키는 대문자 스네이크만. `isPlaceholder(v)` 헬퍼 1개를 같은 파일에서 export.
5. **플레이스홀더 화면 노출 규칙**: 푸터·`/legal/business/` 사업자 블록에서는 값이 플레이스홀더면 `[TODO_사업자정보]` 텍스트를 그대로 출력(숨기지 않음, 브리프 규칙 4). mdx 본문 안의 `{{COMPANY_NAME}}` 등은 빌드 시 `company.ts` 값으로 치환하되 값이 플레이스홀더면 토큰이 그대로 남는다(PRD §4.7). 두 표기가 공존하는 것은 의도된 것이다.
6. **빌드 경고 방식**: `apps/company/package.json`의 `prebuild`가 `node ../../scripts/check-legal-placeholders.mjs`를 실행(이미 `apps/company/config`·`content` 스캔 대상). 추가로 `company.ts`의 `assertCompanyConfig()`를 루트 `layout.tsx` 서버 렌더에서 1회 호출해 플레이스홀더 키 목록을 `console.warn`. **어느 쪽도 `process.exit(1)`·throw 금지**(차단 X).
7. **문의 폼 처리 = Supabase Edge Function `contact`에 POST.** company는 anon 키조차 번들에 넣지 않는다 — 환경변수 `NEXT_PUBLIC_CONTACT_ENDPOINT`(함수 URL) 하나만 사용. 함수가 service role로 `inquiries` insert(D1 §3.1: `email(선택), category, body`) 후, `CONTACT_NOTIFY_EMAIL` secret이 있으면 메일 발송(Supabase secrets, 메일 제공자는 소유자 승인 후 결정), 없으면 어드민 `/admin/inquiries`(D8, Phase 2)에서 열람. 메일 발송 실패는 insert 성공에 영향 없음.
8. **mailto 폴백 판정 = "오류 상태 전용 허용".** 1차 경로는 항상 폼. `NEXT_PUBLIC_CONTACT_ENDPOINT` 미설정 또는 POST 실패 시에만 "메일로 직접 보내기(`mailto:{CONTACT_EMAIL}`)" 링크를 노출한다. `CONTACT_EMAIL`이 플레이스홀더면 mailto도 숨기고 "문의 채널을 준비 중이에요"만 표시. 폼 없이 mailto만 두는 구성은 금지(PRD 54 외부 폼 금지 취지 + `inquiries` 기록 필요).
9. **문의 폼 필드와 저장 매핑**: 이름(선택, 20자) · 이메일(선택, 답변 필요 시 필수 안내) · 유형(`partnership|press|safety|other`) · 내용(필수, 10~2,000자). `inquiries`에 `name` 컬럼은 없으므로(D1) 함수가 `body` 앞에 `[보내신 분: {name}]\n` 한 줄을 결합해 저장. 전화번호·주민번호·주소 입력란은 두지 않는다. `safety` 유형은 접수 확인 문구에 "앱 안에서 신고하면 증거가 자동 첨부돼요"를 함께 보여 앱 내 신고로 유도.
10. **스팸 대책(Phase 1)**: 허니팟 필드(`website`, CSS 숨김, 값 있으면 200 반환 후 폐기) + Edge Function 내 IP 해시 기준 시간당 5건 제한. Turnstile 등 외부 스크립트는 PRD §7 "검토" 상태이므로 Phase 2에서 소유자 승인 후.
11. **법적 고지 = 링크가 아니라 복제 렌더.** `apps/web/content/legal/*.mdx`를 company가 상대 경로로 import해 `/legal/*`에 동일 본문을 렌더(PRD 21). `canonical`은 **web 도메인**(`NEXT_PUBLIC_SITE_URL + /legal/...`)으로 지정해 중복 콘텐츠를 피하고, web URL이 미설정이면 self-canonical. 사업자 정보 블록(§3.8)은 mdx 밖 컴포넌트로 `/legal/business/` 상단과 푸터에 공통 렌더.
12. **sitemap/robots**: `app/robots.ts` = `Allow: /` 전부, `Sitemap: {COMPANY_URL}/sitemap.xml`. `app/sitemap.ts`(`force-static`)가 존재하는 page 라우트 + 블로그·위키 slug를 열거. **앱(`apps/web`) URL은 company sitemap에 넣지 않는다**(앱 `(app)` 라우트는 E5의 `noindex` + Disallow, PRD 49). Vercel preview 배포는 `X-Robots-Tag: noindex` 헤더(`vercel.json`), 프로덕션만 인덱싱.
13. **메타 공통**: `metadataBase = NEXT_PUBLIC_COMPANY_URL`, 페이지별 고유 `title`("{페이지} · 덕메이트" 템플릿)·`description`(80~120자), OG 이미지는 페이지 단위 정적 PNG 1장씩(`public/og/{route}.png`, 1200×630), 사용자 사진·실제 프로필 캡처 사용 금지(PRD §5.4).
14. **JSON-LD**: 루트 레이아웃에 `Organization` + `WebSite` 1회, 페이지별로 `/safety/`·`/service/`·위키 = `FAQPage`, 블로그 상세 = `Article`(보도자료는 `NewsArticle`), 채용 = 공고 있을 때만 `JobPosting`(없으면 출력 안 함), 법적 = `WebPage`. `Organization.name`이 플레이스홀더면 JSON-LD 자체를 생략(구조화 데이터에 `[TODO]` 노출 금지).
15. **콘텐츠 포맷**: 블로그·보도자료·위키·채용은 `apps/company/content/{blog,wiki,careers}/*.mdx` + frontmatter(§4·§6 스키마). CMS·외부 API 없음. 빌드 시 `generateStaticParams`로 전부 정적 생성.
16. **서비스명 상수**: `SERVICE_NAME`은 `company.ts`에 두지 않고 `apps/web/config/site.ts`의 값을 import(PRD §7 단일 소스). 카피의 "덕메이트"는 전부 이 상수로 치환 가능해야 한다.
17. **디자인 시스템**: `packages/ui`(shadcn) 사용, 앱과 같은 토큰. 폰트는 Pretendard Variable 서브셋 self-host(`next/font/local`), 외부 폰트·외부 스크립트 0(Vercel Analytics 제외). 다크 모드는 `prefers-color-scheme` 자동, 토글 없음.
18. **이미지**: `images.unoptimized: true`(정적 export) 대신 빌드 전 `scripts/optimize-images.mjs`(sharp)로 `public/img/**`를 WebP 2단(800/1600px)으로 생성, `<picture>`로 제공. 원본 PNG는 커밋하지 않는다(`public/img-src/` gitignore).
19. **홈 스크린샷 3구역은 실제 앱 화면 캡처가 아니라 시드 계정(D1 F-051 페르소나 4쌍) 기준 목업 프레임**을 쓴다. 실사용자 데이터·실명·연락처가 보이는 캡처 금지, 프레임 하단에 "화면 예시" 캡션 고정.
20. **금지 카피 체크리스트를 company에도 적용**(PRD 20, A2 §5): 미검증 수치("매칭 3배"), 외모·인기 라벨, 만남 압박, 희소성 압박, "탈락" 표현. 안전 SLA는 "24시간 안에 1차 조치"로만 약속(A5 §6 — P0 1h 등 내부 값은 공개 페이지에 쓰지 않음).
21. **요금 안내**: Phase 3 결제 오픈 전까지 `/service/` 요금 섹션은 "준비 중" 카드만(가격 미표기). `PAYMENTS_ENABLED`가 true가 되는 배포에서 A4 확정표를 노출하되, 수치는 `packages/db/src/entitlements.ts`에서 읽는다(하드코딩 금지).
22. **취미 위키(Phase 5)**: 30개 slug·템플릿·SEO 규칙은 §6에 확정. 위키 글의 "덕메이트 CTA"는 앱 온보딩 딥링크(`{SITE_URL}/onboarding/age?from=wiki-{slug}`)로 통일, UTM 대신 `from` 파라미터 1개.
23. **성능·접근성 게이트**: Lighthouse 모바일 Performance/Accessibility/Best Practices/SEO 각 ≥ 95, LCP ≤ 2.0s, CLS < 0.1, 페이지당 JS ≤ 80KB gzip(홈 기준). 미달 시 Phase 게이트 체크리스트에 기록하고 배포는 진행(차단 X).
24. **문의 완료 화면은 별도 라우트가 아니라 `/contact/` 내부 상태**(정적 export에서 POST 리다이렉트 불가). 완료 후 뒤로가기 시 폼은 초기화된다.
25. **채용 "현재 채용 없음" 상태가 기본값**: `content/careers/` 폴더가 비어 있으면 상태 카드만 렌더, `JobPosting` JSON-LD 미출력. 공고 mdx가 생기면 자동으로 카드 목록 전환.

---

## 1. IA 트리와 페이지별 메타

```
/                      홈                          Phase 1
├─ /service/           서비스 소개                  Phase 5 (F-092)
├─ /safety/            안전과 신뢰                  Phase 5 (F-092) — 홈 요약은 Phase 1
├─ /team/              팀·비전                      Phase 5
├─ /blog/              블로그 (목록)                Phase 5
│   ├─ /blog/[slug]/   글 상세
│   └─ /press/         보도자료 필터 뷰
├─ /careers/           채용                         Phase 5
├─ /contact/           문의                         Phase 1
├─ /legal/terms/ · privacy/ · location/ · youth/ · business/   Phase 1
├─ /wiki/              취미 위키 허브               Phase 5 (F-089)
│   └─ /wiki/[slug]/   취미 입문 가이드 30개
└─ /404
```

| 라우트 | 목적 | 1차 CTA | title | description 초안 | JSON-LD |
|---|---|---|---|---|---|
| `/` | 포지셔닝 전달 + 앱 진입 | "덕메이트 시작하기" → `{SITE_URL}/onboarding/age` | `덕메이트 — 같은 걸 좋아하는 사람이랑 만나는 앱` | 외모 스와이프 대신 덕질 궁합. 취미 Top3와 최애로 소개하고, 매칭되면 '같이 할 것'까지 골라주는 취미 친구·데이팅 앱. 만 19세 이상, 본인인증 필수. | Organization, WebSite |
| `/service/` | 작동 방식·모드·덕질카드·요금 설명 | "덕질 카드 만들어 보기" | `서비스 소개 · 덕메이트` | 덕질 카드로 소개하고, 궁합 퀴즈로 맞춰보고, 매칭 즉시 '같이 할 수 있는 것' 제안 카드를 받는 4단계. 취미 친구 모드와 데이팅 모드의 차이도 안내합니다. | FAQPage |
| `/safety/` | 인증·신고·데이터 정책 공개 | "안전 정책 전문 보기" → `/legal/privacy/` | `안전과 신뢰 · 덕메이트` | 본인인증 4단계, 신고 접수 후 24시간 안에 1차 조치, GPS 미수집. 덕메이트가 안전을 위해 하는 것과 하지 않는 것을 숨김없이 공개합니다. | FAQPage |
| `/team/` | 미션·가치·팀 | "함께 만들기" → `/careers/` | `팀과 비전 · 덕메이트` | 취향이 만남의 이유가 되는 세상을 만드는 팀. 덕메이트의 미션, 비전, 세 가지 가치와 팀을 소개합니다. | Organization(확장) |
| `/blog/` | 공지·정책·철학 글 | 최신 글 읽기 | `블로그 · 덕메이트` | 덕메이트 런칭 소식, 안전 정책 이야기, 취미 매칭에 대한 생각을 기록합니다. | Blog |
| `/blog/[slug]/` | 글 본문 | 앱 시작 또는 관련 글 | `{글 제목} · 덕메이트 블로그` | frontmatter `summary` | Article / NewsArticle |
| `/press/` | 언론용 자료 | "언론 문의" → `/contact/?type=press` | `보도자료 · 덕메이트` | 덕메이트 보도자료와 미디어 키트(로고·서비스 설명·스크린샷)를 제공합니다. | Blog |
| `/careers/` | 채용 상태 안내 | "인재풀 등록" → `/contact/?type=other` | `채용 · 덕메이트` | 현재 열린 포지션과 덕메이트의 일하는 방식을 안내합니다. | JobPosting(공고 시) |
| `/contact/` | 제휴·언론·안전·기타 접수 | "보내기" | `문의하기 · 덕메이트` | 제휴, 언론, 안전, 기타 문의를 남겨 주세요. 앱 이용 중 신고는 앱 안의 신고 버튼이 가장 빠릅니다. | ContactPage |
| `/legal/*` | 법적 고지 5종 | — | `{문서명} · 덕메이트` | 각 mdx frontmatter | WebPage |
| `/wiki/` | 취미 입문 허브 | 카테고리 탐색 | `취미 위키 · 덕메이트` | 8개 카테고리 30가지 취미의 시작 비용, 첫 주 루틴, 커뮤니티, 같이 하기 좋은 이유를 정리했습니다. | CollectionPage |
| `/wiki/[slug]/` | 취미 입문 가이드 | "이 취미로 덕메이트 시작" | `{취미} 입문 가이드 — 시작 비용·첫 주 루틴 · 덕메이트 위키` | frontmatter `summary` | Article + FAQPage |

- `description`은 80~120자, 페이지마다 고유. `title` 템플릿은 `%s · 덕메이트`(홈만 예외).
- 모든 페이지 `lang="ko"`, `robots: index, follow`. preview 배포만 `noindex`(결정 12).

## 2. `apps/company/config/company.ts` 스키마

```
export const company = {
  // 사업자 정보 블록 (푸터 + /legal/business/)
  COMPANY_NAME:      "{{COMPANY_NAME}}",      // 상호
  CEO_NAME:          "{{CEO_NAME}}",          // 대표자
  BIZ_NO:            "{{BIZ_NO}}",            // 사업자등록번호 000-00-00000
  ECOM_NO:           "{{ECOM_NO}}",           // 통신판매업신고번호 제0000-서울xx-0000호
  ADDRESS:           "{{ADDRESS}}",           // 도로명 주소
  CONTACT_EMAIL:     "{{CONTACT_EMAIL}}",     // 대표 문의 메일 (mailto 폴백·푸터)
  CONTACT_PHONE:     "{{CONTACT_PHONE}}",     // 대표 전화 (없으면 플레이스홀더 유지)
  PRIVACY_OFFICER:   "{{PRIVACY_OFFICER}}",   // 개인정보보호책임자 성명
  PRIVACY_EMAIL:     "{{PRIVACY_EMAIL}}",     // 개인정보 문의 메일
  YOUTH_OFFICER:     "{{YOUTH_OFFICER}}",     // 청소년보호책임자 성명
  YOUTH_EMAIL:       "{{YOUTH_EMAIL}}",
  // URL
  COMPANY_URL:       process.env.NEXT_PUBLIC_COMPANY_URL ?? "{{COMPANY_URL}}",
  SITE_URL:          process.env.NEXT_PUBLIC_SITE_URL ?? "{{DOMAIN}}",   // 앱(web)
  CONTACT_ENDPOINT:  process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? "",     // Edge Function URL, 빈 값 허용
  // 브랜드
  SNS_X:             "{{SNS_X}}",             // 선택. 플레이스홀더면 푸터 아이콘 미노출
  SNS_INSTAGRAM:     "{{SNS_INSTAGRAM}}",
  FOUNDED_YEAR:      "{{FOUNDED_YEAR}}",
} as const satisfies Record<string, string>;

export const isPlaceholder = (v: string) => /^\{\{[A-Z_]+\}\}$/.test(v) || v === "";
export const display = (v: string) => (isPlaceholder(v) ? "[TODO_사업자정보]" : v);
export function assertCompanyConfig(): string[] { /* 플레이스홀더 키 목록 반환 + console.warn, throw 금지 */ }
```

- 규칙: 값 타입은 전부 `string`(`null`·`undefined` 금지 — `satisfies Record<string,string>`로 강제). 키 = 대문자 스네이크 = 플레이스홀더 토큰 이름(1:1). 법적 mdx의 토큰(PRD 27: `{{COMPANY_NAME}}`·`{{BIZ_NO}}`·`{{ECOM_NO}}`·`{{DOMAIN}}`·`{{PRIVACY_OFFICER}}`)과 키를 맞춰 하나의 치환 함수 `fillPlaceholders(mdx, company)`로 처리한다.
- `PAYMENTS_ENABLED` 연동(PRD 27·F-080): web 쪽 결제 화면이 같은 `company.ts`를 import해 `COMPANY_NAME`·`ECOM_NO` 플레이스홀더 여부를 검사한다. company 파일이지만 **모노레포 공용 단일 소스**이므로 위치를 옮기지 않는다.
- 선택 항목(`CONTACT_PHONE`, `SNS_*`, `FOUNDED_YEAR`)은 플레이스홀더면 해당 줄·아이콘을 **렌더하지 않는다**. 필수 항목(그 외)은 `[TODO_사업자정보]`로 노출.

## 3. 페이지별 카피 초안

플레이스홀더 표기: `{{COMPANY_NAME}}` 등은 `company.ts` 값. "덕메이트"는 `SERVICE_NAME` 상수. 앱 링크 `{SITE_URL}`.

### 3.1 홈 `/`

**히어로**
- 미션 한 줄(H1): **같은 걸 좋아하는 사람이랑 만나는 앱**
- 서브카피: 외모 스와이프 대신 덕질 궁합. 취미 Top3와 최애로 나를 소개하고, 매칭되면 "같이 할 수 있는 것"까지 앱이 골라줘요. 만 19세 이상, 본인인증을 마친 사람끼리만.
- CTA 1(주): **덕메이트 시작하기** → `{SITE_URL}/onboarding/age`
- CTA 2(보조): **어떻게 매칭되나요?** → `/service/` (Phase 1에는 홈 내 "작동 방식" 앵커 `#how`)
- 히어로 하단 작은 글씨: 수도권 우선 오픈 · 친구 모드는 성별 무관 · 미인증 회원 간 DM 없음

**서비스 스크린샷 3구역 캡션**
1. 덕질 카드 — "사진보다 먼저 보이는 건 취향이에요. 취미 Top3, 최애, 요즘 빠진 것으로 소개해요."
2. 매칭 제안 카드 — "매칭되면 '안녕하세요' 대신 '같이 할 것' 세 가지를 먼저 받아요. 하나 고르면 첫 메시지가 돼요."
3. 하루 다섯 명 — "매일 07:00, 취미·궁합·활동 시간대로 고른 다섯 명. 무한 스와이프는 없어요."
(각 프레임 하단 고정 캡션: "화면 예시")

**차별점 3카드**
- **외모 점수는 없어요** — 매칭 점수에 사진은 0%. 취미 겹침 40%, 궁합 퀴즈 35%, 활동 시간대 15%, 서로의 관심 10%로 계산해요.
- **친구 모드와 데이팅 모드를 나눴어요** — 기본은 취미 친구 모드. 데이팅 모드는 본인인증에 사진 인증까지 마친 사람끼리만, 서로 같은 모드일 때만 보여요.
- **첫 대화가 어렵지 않아요** — 매칭 즉시 두 사람의 취미와 시간대로 만든 제안 카드 3장. "이번 주말 오전에 같이 뛰어볼까요?"처럼요.

**안전 요약 3항목** (Phase 1부터 노출)
- **본인인증 없이는 보이지 않아요** — 휴대폰 인증만으로는 프로필이 공개되지 않아요. 추천·좋아요·채팅은 본인인증을 마친 회원끼리만.
- **신고는 24시간 안에 1차 조치해요** — 신고하는 순간 대화 기록이 자동으로 보존되고, 심각한 경우엔 사람이 보기 전에 시스템이 먼저 채팅을 멈춰요.
- **위치는 '구'까지만, GPS는 받지 않아요** — 실시간 위치·반경 노출 없음. 연락처는 매칭 3일 후부터 주고받을 수 있어요.
- 링크: "안전 정책 자세히 보기" → Phase 1 `/legal/privacy/`, Phase 5 `/safety/`

**하단 CTA**
- 헤드: **취향이 맞으면, 첫 대화는 어렵지 않아요.**
- 서브: 3분이면 덕질 카드가 완성돼요. 사진은 나중에 올려도 괜찮아요.
- 버튼: **덕메이트 시작하기** / 작은 링크: 만 19세 이상만 이용할 수 있어요 → `/legal/youth/`

### 3.2 서비스 소개 `/service/`

**작동 방식 4단계**
1. **덕질 카드 만들기** — 취미를 3~5개 고르고 몰입도를 정해요. 최애와 "요즘 빠진 것"을 적으면 카드가 완성돼요. 사진은 선택이에요.
2. **궁합 퀴즈 10문항** — 취미 지식이 아니라 생활 궁합을 물어요. "주말 아침형인가요, 심야형인가요?" 같은 것들. 3문항만 답해도 추천이 시작돼요.
3. **매일 07:00, 다섯 명** — 취미 겹침·궁합·활동 시간대로 고른 다섯 명을 하루에 한 번 받아요. 좋아요 또는 패스, 서로 좋아요면 매칭.
4. **제안 카드로 첫 대화** — 매칭 즉시 "같이 할 수 있는 것" 카드 3장을 받아요. 하나 고르면 그게 첫 메시지. 만남은 서두르지 않아도 돼요.

**친구 모드 / 데이팅 모드**
- 표 형식: 항목 / 취미 친구 모드 / 데이팅 모드
  - 기본값: 기본 / 설정에서 직접 전환
  - 필요한 인증: 본인인증 / 본인인증 + 승인된 대표 사진 1장
  - 성별: 무관 / 선호 성별 설정
  - 상대: 친구 모드 회원끼리만 / 데이팅 모드 회원끼리만
  - 사진: 선택(캐릭터·취미 사진도 보조 사진으로 가능) / 대표 사진은 본인 얼굴 필수
- 문단: 두 모드는 절대 섞이지 않아요. 친구 모드에서 데이팅 목적으로 접근하는 건 신고 사유이고, 데이팅 모드로 바꿔도 프로필 공개 범위가 자동으로 넓어지지 않아요.

**덕질 카드 설명**
- 카드 앞면에 보이는 것: 닉네임 · 연령대(20대 초반처럼) · 구 단위 지역 · 취미 Top3(겹치는 취미 강조) · 최애 · 요즘 빠진 것 · "같이 할 수 있는 것" 한 줄 · 인증 마크(본인인증 / 사진인증) · 입문 환영 배지(가볍게 시작한 취미가 있을 때)
- 카드에 없는 것: 외모 점수, 인기도, 실시간 위치, 전화번호·SNS ID
- 문단: "입문 환영" 배지는 몰입도 1~2로 고른 취미가 있으면 자동으로 붙어요. 고수만 환영받는 곳이 아니라는 뜻이에요.

**요금 안내**
- Phase 3 전(기본): 카드 1장 — **요금제는 준비 중이에요.** 지금은 모든 기능이 무료예요. 유료가 생겨도 매칭·채팅·신고·차단은 계속 무료로 둘 거예요.
- Phase 3 이후: 무료 / 플러스 / 프로 3열 표(값은 `entitlements.ts`), 표 아래 고정 문구 "자동갱신은 결제 버튼 위에 먼저 알려드리고, 해지는 설정에서 두 번 탭이면 끝나요. 7일 이내 청약철회는 전자상거래법에 따라요."

**FAQ(FAQPage JSON-LD 원문)**
- Q. 사진 없이도 쓸 수 있나요? — A. 네. 친구 모드는 사진이 선택이에요. 데이팅 모드만 본인 얼굴이 보이는 대표 사진 1장이 필요해요.
- Q. 하루에 몇 명을 볼 수 있나요? — A. 무료 기준 다섯 명이에요. 매일 07:00에 새로 받아요.
- Q. 지역은 어떻게 정해지나요? — A. 가입할 때 고른 시/군/구만 써요. GPS는 받지 않고, 상대에게는 '구'까지만 보여요.
- Q. 취미를 직접 추가할 수 있나요? — A. 태그는 운영팀이 관리해요. 원하는 취미가 없으면 문의로 알려 주세요. 최애·요즘 빠진 것은 자유롭게 적을 수 있어요.

### 3.3 안전과 신뢰 `/safety/`

**인트로**: 덕메이트는 매칭 알고리즘보다 신고·차단·증거 보존을 먼저 만들었어요. 여기 적힌 건 약속이고, 지키지 못하면 이 페이지를 고칠 거예요.

**인증 4단계(일반인용)**
| 단계 | 이름 | 이렇게 돼요 | 이때부터 할 수 있는 것 |
|---|---|---|---|
| 0 | 가입 | 생년월일을 확인해요. 만 19세 미만은 여기서 끝이에요. | — |
| 1 | 휴대폰 | 문자로 받은 6자리 코드를 입력해요. 번호는 프로필에 표시되지 않아요. | 덕질 카드 작성, 사진 올리기(검수 대기) |
| 2 | 본인인증 | PASS 등 본인인증으로 성인임을 확인해요. 이름은 저장하지 않고 생년월일·성별·중복가입 방지용 해시만 남겨요. | 추천 받기·보이기, 좋아요, 채팅, 친구 모드 |
| 3 | 사진인증 | 올린 대표 사진을 사람이 확인해요(24시간 안에). 본인 얼굴이 보이면 승인. | 데이팅 모드, 채팅 이미지(매칭 하루 뒤부터) |

- 보조 문장: 인증은 내려갈 수도 있어요. 승인된 사진을 지우면 3단계에서 2단계로 돌아가요.

**신고 처리 약속**
- 헤드: **신고 접수 후 24시간 안에 1차 조치해요.**
- 도식(가로 5단계, 각 1줄): 신고 버튼 1탭 → 대화 기록 자동 보존(최근 50개 메시지·프로필·사진) → 심각도 자동 분류 + 즉시 자동 조치(채팅 일시 중지 등) → 운영자 판정 → 신고자에게 결과 통보
- 보조: 신고자가 누구인지는 상대에게 절대 알리지 않아요. 결과는 "조치가 완료되었어요" 수준으로 알려드리고, 상대에게는 사유·기간·이의신청 방법을 함께 전해요.
- 자동으로 막는 것: 돈·투자 이야기가 나오면 상대 화면에 경고 배너, 연락처·링크는 매칭 3일 전엔 `[연락처 숨김]`으로 표시, 미성년 정황은 즉시 프로필 비공개 + 재인증.

**데이터 정책 요약 (수집/미수집 표)**
| 수집해요 | 수집하지 않아요 |
|---|---|
| 휴대폰 번호(본인 확인용, 프로필 비표시) | **GPS·실시간 위치** — 시/군/구 선택값만 |
| 생년월일(본인만 열람, 상대에겐 연령대) | 실명(본인인증 후에도 저장 안 함) |
| 닉네임·성별·취미·퀴즈 답·활동 시간대 | 연락처 목록·SNS 계정 |
| 사진(검수 후 공개, 위치 정보 EXIF 제거) | 외모 점수·매력도 |
| 채팅 내용(본인과 운영자만 원문, 신고 시 증거 보존) | 통화·음성 |
- 보존 요약 3줄: 탈퇴하면 프로필·사진은 바로 지워요(7일 유예 뒤 완전 삭제). 신고 증거는 처리 후 최대 180일, 결제 기록은 법에 따라 5년. 자세한 건 개인정보처리방침에.

**커뮤니티 원칙(5개)**
1. 취향을 놀리지 않아요. 입문자도 고수도 같은 자리에서 시작해요.
2. 친구 모드는 친구 모드예요. 목적이 다르면 모드를 바꾸고, 상대에게 강요하지 않아요.
3. 돈 이야기는 대화가 아니라 신호예요. 송금·투자·상품권 요구는 바로 신고해요.
4. 연락처는 매칭 3일 뒤에. 그 전엔 여기서 충분히 이야기해요.
5. 불편하면 차단해도 돼요. 이유를 설명할 필요 없고, 상대에게 알림도 가지 않아요.

**신고·문의 채널**
- 앱 이용 중 문제 → 앱 안의 [신고] 버튼(채팅 상단·프로필). 증거가 자동 첨부돼 가장 빨라요.
- 앱 밖에서 알려주고 싶은 것 → `/contact/?type=safety`
- 개인정보 열람·삭제·다운로드 → `{{PRIVACY_EMAIL}}` (Phase 1은 10일 이내 이메일 회신)
- 청소년 관련 신고 → `{{YOUTH_EMAIL}}`

**FAQ(FAQPage)**: "차단하면 상대가 알 수 있나요?"(아니요) / "신고하면 내 대화도 보나요?"(신고한 대화의 최근 50개만, 운영자만, 열람 기록 남김) / "위치가 노출되나요?"(구 단위만, GPS 미수집) / "미성년자가 가입하면요?"(3중 차단, 발견 즉시 영구 차단)

### 3.4 팀·비전 `/team/`

- **미션**: 취향이 만남의 이유가 되게 한다.
- **비전**: 외모 점수 없이도 "괜찮은 사람"을 알아볼 수 있는 만남의 기준을 한국에서 만든다.
- **가치 3개**
  1. **안전이 성장보다 먼저** — 신고 파이프라인을 매칭 알고리즘보다 먼저 만들었고, 안전 기능은 유료로 팔지 않아요.
  2. **가짜 신호 없음** — 없는 좋아요 알림, 죄책감 유도 카피, 희소성 압박을 쓰지 않아요. 숫자는 검증된 것만 말해요.
  3. **끝이 있는 하루** — 무한 스와이프 대신 하루 다섯 명. 앱을 오래 붙잡는 게 아니라, 밖에서 같이 할 게 생기는 걸 성공으로 봐요.
- **팀 소개(플레이스홀더 카드 × 3)**: `{{TEAM_MEMBER_NAME}}` / `{{TEAM_MEMBER_ROLE}}` / 한 줄 취미("요즘 빠진 것: ___") — 실제 인물 입력 전에는 섹션 자체를 숨긴다(`content/team.json` 비어 있으면 미렌더, 사업자 정보와 달리 TODO 노출 불필요).
- 하단: "{{COMPANY_NAME}}는 {{FOUNDED_YEAR}}년에 시작했어요." (둘 중 하나라도 플레이스홀더면 문장 생략)

### 3.5 블로그·보도자료 `/blog/`, `/blog/[slug]/`, `/press/`

- **목록**: 카드(제목·요약·날짜·타입 배지 `공지/안전/생각/보도자료`), 최신순, 페이지네이션 없이 20개까지 단일 페이지(그 이상은 Phase 5 이후 `?page=` 정적 분할).
- **상세**: H1 · 날짜 · 읽는 시간 · 본문(mdx) · 하단 "덕메이트 시작하기" CTA · 이전/다음 글. 댓글 없음.
- frontmatter: `title, summary(≤120자), date, type(notice|safety|essay|press), cover(선택), draft(true면 빌드 제외)`.
- `/press/`는 `type: press` 필터 + 미디어 키트 블록(로고 SVG/PNG, 서비스 한 줄, 스크린샷 3장 zip은 `public/press/`).

**첫 글 3개**
1. **덕메이트를 시작합니다 — 외모 스와이프 대신 덕질 궁합** (`notice`)
   요약: 같은 걸 좋아하는 사람을 만나는 앱, 덕메이트가 수도권에서 초대제 베타를 시작합니다. 덕질 카드, 제안 카드, 친구/데이팅 모드 분리 — 세 가지가 다른 이유를 설명합니다.
2. **신고는 24시간, 위치는 구까지 — 덕메이트의 안전 정책** (`safety`)
   요약: 매칭 알고리즘보다 신고 파이프라인을 먼저 만든 이유, 본인인증 4단계, 자동으로 멈추는 것들, 그리고 우리가 수집하지 않는 데이터에 대해 씁니다.
3. **왜 취미로 만나야 하는가 — 첫 대화가 "안녕하세요"로 시작되지 않게** (`essay`)
   요약: 외모 티어와 무한 스와이프가 만든 피로, 취미 데이팅이 실패해 온 이유, 그리고 덕메이트가 '같이 할 것'을 먼저 제안하는 까닭.

### 3.6 채용 `/careers/`

- 인트로: 덕메이트는 작은 팀이에요. 안전을 먼저 만들고, 가짜 신호를 쓰지 않고, 하루에 끝이 있는 제품을 만드는 데 동의하는 사람과 일하고 싶어요.
- **포지션 카드 구조**(`content/careers/*.mdx`): `title, team, type(정규직|계약|인턴), location(서울|원격), posted, closes(선택), summary` + 본문(하는 일 / 필요한 것 / 있으면 좋은 것 / 전형 절차 / 지원 방법 → `/contact/?type=other`).
- **현재 채용 없음 상태(기본)** 카드: **지금은 열린 포지션이 없어요.** 함께하고 싶다면 문의에 "채용"이라고 적어 보내 주세요. 자리가 생기면 먼저 연락드릴게요. 버튼: 인재풀로 연락하기 → `/contact/?type=other&subject=채용`
- 공고 있을 때만 `JobPosting` JSON-LD(`hiringOrganization` = `COMPANY_NAME`, 플레이스홀더면 생략).

### 3.7 문의 `/contact/`

- 인트로: 제휴, 언론, 안전, 그 밖의 이야기를 남겨 주세요. **앱 이용 중 겪은 문제는 앱 안 [신고] 버튼이 가장 빨라요** — 대화 기록이 자동으로 첨부되고 24시간 안에 확인해요.
- 폼 필드
  - 이름 또는 호칭 (선택, 20자) — placeholder "예: 서윤 / OO팀"
  - 이메일 (선택) — 도움말 "답변이 필요하면 적어 주세요. 답변 외 용도로 쓰지 않아요."
  - 유형 (필수, 라디오): 제휴 `partnership` / 언론 `press` / 안전 `safety` / 기타 `other` — `?type=` 쿼리로 프리셀렉트
  - 내용 (필수, 10~2,000자) — 도움말 "전화번호·주소·주민번호는 적지 마세요. 필요하면 저희가 따로 여쭤볼게요."
  - 허니팟 `website`(숨김)
- 개인정보 수집 동의(필수 체크 1개): **[필수] 문의 처리를 위해 이메일(입력 시)과 문의 내용을 수집하며, 처리 완료 후 1년간 보관 뒤 삭제합니다. 동의하지 않으면 문의를 보낼 수 없어요.** 링크: 개인정보처리방침 → `/legal/privacy/`
- 버튼: **보내기** (전송 중 "보내는 중…", 이중 제출 방지)
- 완료 메시지(폼 자리에 교체): **접수됐어요.** 이메일을 남겨 주셨다면 영업일 기준 3일 안에 답장드려요. 안전 관련 문의는 더 빨리 봐요. [홈으로] [하나 더 보내기]
- 오류 메시지: 지금은 보낼 수 없어요. 잠시 후 다시 시도하거나, 아래 메일로 직접 보내 주세요. → (결정 8의 조건에서만) `mailto:{{CONTACT_EMAIL}}?subject=[덕메이트 문의/{유형}]`
- `safety` 선택 시 상단 인라인 안내: 지금 위험한 상황이면 112. 앱 안에서 신고하면 증거가 자동으로 보존돼요.

### 3.8 법적 고지 `/legal/*`

- **판정: 링크가 아니라 복제 렌더**(결정 11). company 방문자(비회원·언론·심사 기관)가 앱 도메인으로 이탈하지 않고 읽을 수 있어야 하고, 앱스토어 심사·AdSense·결제 PG 심사가 "회사 사이트에 약관이 있는가"를 본다. 원본은 `apps/web/content/legal/*.mdx` 하나이므로 중복 관리 비용은 없다. `canonical`은 web으로.
- 인덱스 `/legal/`은 만들지 않는다(푸터 링크 5개로 충분). 각 페이지 상단에 5종 탭 내비 + "시행일 {frontmatter.effective}" 표시.
- **사업자 정보 블록**(`/legal/business/` 상단 + 푸터 공통 컴포넌트 `<BusinessInfo variant="full|compact">`):
  - 상호: `{{COMPANY_NAME}}` · 대표: `{{CEO_NAME}}` · 사업자등록번호: `{{BIZ_NO}}` · 통신판매업신고번호: `{{ECOM_NO}}` · 주소: `{{ADDRESS}}` · 이메일: `{{CONTACT_EMAIL}}` · 전화: `{{CONTACT_PHONE}}`(선택) · 개인정보보호책임자: `{{PRIVACY_OFFICER}}` (`{{PRIVACY_EMAIL}}`) · 청소년보호책임자: `{{YOUTH_OFFICER}}` (`{{YOUTH_EMAIL}}`)
  - `full`은 위 전부 + "사업자정보확인" 외부 링크(공정위, `BIZ_NO`가 실제 값일 때만), `compact`(푸터)는 상호·대표·사업자번호·통신판매업·주소·이메일 + 책임자 2명 성명.
  - 플레이스홀더는 `[TODO_사업자정보]`로 그대로 노출(결정 5). Phase 3 결제 오픈 전 0개가 게이트(PRD Phase 2→3).
- 본문 하단 고정 문구(5종 공통): "이 문서는 `{SITE_URL}/legal/…`과 동일한 내용이에요. 변경 시 시행일이 갱신돼요."

## 4. 공통 헤더 / 푸터 스펙

**헤더**(높이 56px 모바일 / 64px 데스크톱, sticky, 스크롤 시 배경 블러)
- 좌: 로고(SVG, 홈 링크, `aria-label="덕메이트 홈"`)
- 중(데스크톱) / 햄버거 시트(모바일): Phase 1 = `문의` 1개. Phase 5 = 서비스 소개 · 안전과 신뢰 · 팀 · 블로그 · 채용 · 문의 · 위키.
- 우: 주 버튼 **앱 시작하기** → `{SITE_URL}/onboarding/age` (`rel="noopener"`, 같은 탭). `SITE_URL`이 플레이스홀더면 버튼을 "준비 중" 비활성으로.
- 현재 페이지 `aria-current="page"`. 키보드 포커스 링 항상 표시. "본문으로 건너뛰기" 링크 최상단.

**푸터**(전 페이지 공통, 4열 → 모바일 1열 아코디언 없음, 그대로 쌓기)
1. 브랜드: 로고 + 한 줄 "같은 걸 좋아하는 사람이랑 만나는 앱" + SNS 아이콘(플레이스홀더면 미노출)
2. 서비스: 앱 시작하기 · 서비스 소개 · 안전과 신뢰 · 취미 위키 (Phase 1엔 앱 시작하기만)
3. 회사: 팀 · 블로그 · 보도자료 · 채용 · 문의 (Phase 1엔 문의만)
4. 법적 고지: 이용약관 · **개인정보처리방침(굵게)** · 위치정보 이용약관 · 청소년보호정책 · 사업자 정보
- 최하단 사업자 정보 블록 `<BusinessInfo variant="compact">` — 플레이스홀더는 `[TODO_사업자정보]` 그대로. 그 아래 `© {FOUNDED_YEAR 또는 현재 연도} {{COMPANY_NAME}}` + "만 19세 이상만 이용할 수 있어요".
- 푸터에도 광고·뉴스레터 폼 없음.

## 5. 콘텐츠 규칙 요약 (E6 체크리스트)

- 존댓말 "~해요"체 통일, 문장 끝 느낌표는 페이지당 1회 이하. 영어 약어 최소화(OTP → "문자 인증 코드").
- 수치는 원천이 있는 것만: 무료 5명, 07:00, 24시간, 72시간(3일), 최근 50개 메시지, 180일, 7일 유예, 만 19세. 그 외 수치 카피 금지.
- 사람 사진·실명은 시드 페르소나(서윤·도현·민재·하은)만 닉네임으로 사용, 얼굴 이미지는 일러스트.
- "탈락·심사·등급·인기·매력" 단어 금지. "검수"는 사진에만.

## 6. 취미 위키 (Phase 5, 설계만)

### 6.1 30개 목록 (A1 Top 8 우선, slug = `/wiki/{slug}/`)
| 카테고리 | slug (제목) |
|---|---|
| 공연·팬덤 | `concert-ticketing`(콘서트 티켓팅 입문) · `fandom-goods`(팬 굿즈 수집·교환) · `musical`(뮤지컬 첫 관람) · `festival`(음악 페스티벌 첫 참가) |
| 보드게임·TRPG | `boardgame`(보드게임 입문) · `trpg`(TRPG 첫 세션) · `tcg`(카드게임 TCG 입문) |
| 러닝·클라이밍·헬스 | `running-5k`(5km 러닝) · `bouldering`(볼더링 클라이밍) · `gym-beginner`(헬스 입문) · `hiking`(근교 등산) |
| 애니·웹툰·서브컬처 | `anime-start`(애니 입문) · `webtoon-binge`(웹툰 정주행 가이드) · `figure-collecting`(피규어·굿즈 수집) · `cosplay`(코스프레 입문) |
| 게임 | `coop-games`(둘이서 하는 협동 게임) · `rhythm-game`(리듬게임 입문) · `console-start`(콘솔 게임 입문) · `escape-room`(방탈출 입문) |
| 카페투어·디저트·베이킹 | `cafe-tour`(카페투어) · `home-baking`(홈베이킹 입문) · `hand-drip`(핸드드립 홈카페) |
| 독서·북클럽·글쓰기 | `book-club`(독서모임 입문) · `indie-bookstore`(독립서점 투어) · `daily-writing`(글쓰기·일기 습관) |
| 사진·전시·영화 | `film-camera`(필름카메라 입문) · `exhibition`(전시 관람 입문) · `cinema-gv`(영화 감상·GV) |
| 더보기 | `city-cycling`(도심 자전거) · `knitting-craft`(뜨개질·공예) |
- 술·바 카테고리는 제외(A1 첫 제안 카드 금지 취지). 코딩·여행은 성비·안전 이유로 위키에서도 보류.

### 6.2 글 템플릿 (`content/wiki/{slug}.mdx`)
```
frontmatter: title, summary(≤120자), category(8+more 중 1), slug, cost_level(₩0~ / ₩3만 / ₩10만+ 3단),
             time_per_week, solo_ok(bool), pair_ok(bool), updated, faq[{q,a}] 3~5개, related[slug×3]
본문 H2 순서(고정):
  1. 한 줄 소개 + 누가 좋아할까
  2. 시작 비용 — 표(필수 장비/선택 장비/월 지출 예상), "0원으로 시작하는 법" 1문단
  3. 첫 주 루틴 — 7일 체크리스트(하루 1줄)
  4. 커뮤니티 — 온라인 2곳 유형 + 오프라인 1곳 유형(특정 업체명·링크 최소화, 광고 금지)
  5. 같이 하기 좋은 이유 — 2인 활동 예시 3개(덕메이트 제안 카드 템플릿과 어휘 통일)
  6. 자주 묻는 질문 — frontmatter faq 렌더 (FAQPage JSON-LD 원천)
  7. 덕메이트 CTA — "{취미}로 덕질 카드 만들기" → {SITE_URL}/onboarding/age?from=wiki-{slug}
```
- 분량 1,200~2,000자, 이미지 1~3장(일러스트 또는 저작권 확인된 자체 촬영), alt 필수.

### 6.3 SEO 규칙
- title `{취미} 입문 가이드 — 시작 비용·첫 주 루틴 · 덕메이트 위키`, description = summary. 30개 전부 고유(중복 검사 스크립트 `scripts/check-wiki-meta.mjs`, 경고만).
- JSON-LD `Article`(author = Organization) + `FAQPage` + `BreadcrumbList`(홈 › 위키 › 카테고리 › 글).
- 내부 링크: 본문에 `related` 3개 + 카테고리 허브 + `/service/` 1회 + 홈 1회. 외부 링크 `rel="nofollow noopener"`.
- 허브 `/wiki/`는 카테고리 8+1 섹션, 각 글 카드(제목·summary·cost_level·pair_ok 배지). 카테고리별 앵커 URL `#concert` 등.
- 사용자 생성 콘텐츠·댓글 없음(브리프 규칙 5 무관하게 인덱싱 O 유지).

## 7. 성능·접근성 목표

| 항목 | 목표 | 수단 |
|---|---|---|
| Lighthouse 모바일 4개 카테고리 | 각 ≥ 95 | 정적 export, 클라이언트 컴포넌트는 `/contact/` 폼·모바일 내비 2개만 |
| LCP / CLS / INP | ≤ 2.0s / < 0.1 / < 200ms | 히어로 이미지 `fetchpriority="high"` + width/height 명시, 폰트 `display: swap` 서브셋 |
| JS 전송량 | 홈 ≤ 80KB gzip | 애니메이션 라이브러리 금지, CSS 트랜지션만, `prefers-reduced-motion` 시 정지 |
| 이미지 | WebP 2단(800/1600), 스크린샷 ≤ 120KB/장 | `scripts/optimize-images.mjs`, `<picture>` + lazy(히어로 제외) |
| 접근성 | WCAG 2.1 AA | 대비 4.5:1, 터치 44pt, 포커스 링, 폼 오류 `aria-live`, 표는 `<th scope>`, 도식은 SVG + 텍스트 대체 |
| 외부 요청 | 0 (Vercel Analytics 제외) | 외부 폰트·CDN·임베드 금지, 문의 POST만 Edge Function |
| 캐시 | HTML `s-maxage=0, must-revalidate`, 정적 자산 immutable 1y | `vercel.json` headers |
| 보안 헤더 | CSP(`default-src 'self'`, `connect-src` Edge Function 호스트), `X-Frame-Options: DENY` | `vercel.json` |

## 8. Phase 게이트 체크(E6 참고)

- Phase 1: `/`·`/legal/*`·`/contact/` 200 응답, `check-legal-placeholders` 경고 목록 확인, 문의 1건 → `inquiries` 행 생성 확인, Lighthouse 스크린샷을 `DEPLOY_LOG.md`에 첨부.
- Phase 3 전: 사업자 정보 플레이스홀더 0, `/service/` 요금 섹션 준비 중 → 확정표 전환.
- Phase 5: 전체 라우트 활성, 위키 30개 인덱싱 확인(Search Console), `/safety/` SLA 도식 게시(PRD Phase 4→5 공개 런칭 조건).
