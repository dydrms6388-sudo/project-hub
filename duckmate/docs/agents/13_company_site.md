# C4 · 회사 소개 사이트 IA & 카피 — 덕메이트(DuckMate)

> 작성: 서브에이전트 C4 (회사 소개 사이트 IA) · 기준일 2026-08-19
> 입력: `ORCHESTRATOR_SPEC.md` §7 · `06_PRD.md`(E5 지시: Phase 1 = 홈+법적고지+문의) · `01_market.md`(안전정책 역포지셔닝) · `05_trust_safety.md`(대외 순화 대상 원문).
> 구현 주체: **E5** (`apps/company`, Next.js 15 App Router + `output: 'export'` 완전 정적 SSG). E6(SEO 게이트), B1/B2(법적 문구 검수)와 접점 있음.

---

## 다음 에이전트에게 넘기는 결정사항

### D-1. 라우트 확정 (Next.js App Router, `apps/company/app/`)

| 페이지 | 라우트 (파일) | Phase | 비고 |
|---|---|:---:|---|
| 홈 | `app/page.tsx` | **1** | 미션 + 핵심 섹션 3개 + **안전 요약 섹션(`#safety`)** + 문의/시작하기 CTA |
| 법적 고지 | `app/legal/page.tsx` | **1** | 사업자 정보 표시(§3 표). 값은 전부 `config/company.ts`에서만 |
| 문의 | `app/contact/page.tsx` | **1** | 폼 → Supabase Edge Function `company-contact` (§4) |
| 서비스 소개 | `app/service/page.tsx` | 5 | Phase 1은 홈 섹션으로 갈음 |
| 안전과 신뢰 | `app/safety/page.tsx` | 5 | Phase 1은 홈 `#safety` 섹션으로 갈음. §2.2 카피는 이 페이지 기준으로 이미 작성됨 |
| 팀·비전 | `app/team/page.tsx` | 5 | |
| 블로그·보도자료 | `app/news/page.tsx`, `app/news/[slug]/page.tsx` | 5 | 콘텐츠는 `apps/company/content/news/*.md` frontmatter `type: blog\|press` |
| 채용 | `app/careers/page.tsx` | 5 | |
| 취미 위키 (예약) | `app/wiki/page.tsx`, `app/wiki/[category]/page.tsx`, `app/wiki/[category]/[slug]/page.tsx` | 5 | §5.3 클러스터 구조. **Phase 1에는 폴더도 만들지 않는다**(빈 라우트 인덱싱 방지). URL 체계만 지금 확정 |

- **Phase 1 게이트(F-CMP-01) 범위 = 홈 + `/legal` + `/contact` 3개 라우트뿐이다.** 나머지는 라우트 자체를 만들지 않는다 — 404가 아니라 "존재하지 않는 URL"이어야 하며, 내비게이션에도 미구현 페이지 링크를 넣지 않는다.
- PRD의 "안전 정책 전면 노출" 요건은 **홈의 안전 섹션(`#safety`)** 이 충족한다. Phase 5에서 `/safety` 독립 페이지로 승격 시 홈 섹션은 요약 3줄 + "자세히 보기" 링크로 축소.

### D-2. Phase 1 컴포넌트 목록 (`apps/company/components/`)

| 컴포넌트 | 역할 |
|---|---|
| `SiteHeader` | 로고 + 내비(Phase 1: 홈/문의) + "덕메이트 시작하기" CTA 버튼(→ apps/web, §6 UTM 규칙) |
| `SiteFooter` | **`config/company.ts` 값 자동 렌더**(상호·대표·사업자번호 요약 1줄) + `/legal` 링크 + apps/web 약관 6종 링크(§3.3) |
| `Hero` | 미션 한 줄 + 서브카피 + CTA 2개(시작하기 / 안전 정책 보기) |
| `FeatureSection` | 핵심 섹션 3개(§2.1)의 공통 레이아웃 (아이콘+제목+본문+근거 1줄) |
| `SafetyPledge` | 안전 요약 섹션: 약속 4개 카드 + "신고 24시간 이내 처리" 배지 |
| `LegalNoticeTable` | §3.1 표를 `company.ts`에서 읽어 렌더. 빈 값은 `[TODO_사업자정보]` 노출 |
| `ContactForm` | §4 폼(클라이언트 컴포넌트, fetch → Edge Function) + 실패 시 mailto 보조 링크 |
| `JsonLd` | §5.2의 Organization/WebSite JSON-LD `<script>` 삽입 |
| `TodoBuildWarning` | 빌드 시 `company.ts` 필수 필드 빈 값이면 `console.warn` (스펙 §0-4: 경고만, 차단 안 함) — `next.config` 또는 루트 layout에서 실행 |

### D-3. 사업자 정보 단일 소스 `apps/company/config/company.ts`

§3.2의 타입·필드를 그대로 구현한다. **법적 고지·푸터·JSON-LD·메일 수신 주소가 전부 이 파일 하나를 참조**하고, 하드코딩 금지. `NEXT_PUBLIC_WEB_URL`/`NEXT_PUBLIC_COMPANY_URL` env로 도메인 주입(PRD 오픈 이슈 #2: 도메인 미확보 → vercel.app 허용).

### D-4. 문의 폼 판정 (§4 상세)

- **mailto 단독 폴백은 불허.** Phase 1부터 Supabase Edge Function `company-contact`가 `contact_messages` 테이블 저장까지 수행한다(메일 발송 프로바이더 키가 없어도 접수는 유실되지 않음). 메일 발송은 `RESEND_API_KEY` 존재 시에만 활성화되는 부가 기능.
- mailto는 **폼 전송 실패 시 보조 링크**로만 노출(주소는 `company.ts`의 `contactEmail`).
- **신고는 문의 폼 채널이 아니다** — 유형 선택 UI에서 앱 내 신고로 안내(24h SLA는 앱 내 신고에만 적용됨을 명시).

### D-5. SEO·상호 링크 규칙 (§5·§6 상세)

- 회사 사이트는 **전 페이지 인덱싱 O** (robots 전체 허용 + sitemap.xml 전 라우트). UGC가 없으므로 noindex 예외 없음. E6 검증 스크립트는 company에 대해 "noindex 0건 + sitemap에 존재하는 라우트만 빌드 산출물에 존재"를 검사.
- title 템플릿 `"%s | 덕메이트"`, 홈만 단독 `"덕메이트 — 같은 걸 좋아하는 사람이랑 만나는 앱"`. JSON-LD는 홈에 Organization+WebSite, 위키(Phase 5)에 Article+BreadcrumbList+FAQPage.
- 역할 분담: **apps/web 랜딩 = 가입 전환, company = 신뢰·SEO.** company→web 링크는 전부 `?utm_source=company&utm_medium=referral&utm_campaign={page}`. web→company는 푸터 3링크(회사소개/안전과 신뢰/법적 고지)만. 법적 문서 6종 원문은 apps/web에만 게시하고 company는 **링크만**(중복 게시 금지 — 개정 시 불일치 방지).

### D-6. 대외 카피 안전 수칙 (E5·마케팅 공통, 위반 시 A5 원칙 침해)

- 탐지 룰의 구체 내용(정규식, `PAT_*` 룰명, 자동 제재 임계값 "3인/30일" 등)은 **대외 카피에 절대 노출 금지** — A5 §5.2 "우회 학습 방지" 원칙. "이상 패턴을 자동 감지합니다" 수준까지만.
- SLA는 "24시간 이내"·"긴급 신고는 1시간 이내 임시 조치"까지 공개 OK(마케팅 자산, A1 결정).
- "대화는 신고 시에만 스냅샷 보존" 문구는 B2 개인정보처리방침 문구와 자구 일치시킬 것(카피가 정책보다 넓게 약속하면 안 됨).

---

## 1. 사이트맵 & IA

```
company.{도메인}
├─ /            홈 (Phase 1)  ─ 미션 · 핵심가치 3 · 안전 요약(#safety) · CTA
├─ /legal       법적 고지 (Phase 1)
├─ /contact     문의 (Phase 1)
├─ /service     서비스 소개 (Phase 5)
├─ /safety      안전과 신뢰 (Phase 5 — 카피는 §2.2에 선작성)
├─ /team        팀·비전 (Phase 5)
├─ /news        블로그·보도자료 (Phase 5)
│   └─ /news/[slug]
├─ /careers     채용 (Phase 5)
└─ /wiki        취미 위키 (Phase 5 — 유일한 SEO 유입 채널)
    └─ /wiki/[category]/[slug]     예: /wiki/boardgame/beginner-guide
```

- 정적 export이므로 동적 기능은 문의 폼(외부 Edge Function 호출) 하나뿐. 나머지는 전부 빌드 타임 생성.
- `/wiki`는 카테고리(=취미 클러스터, §5.3) 2단 구조로 **URL 체계만 지금 예약**한다. 클러스터당 글 3개 × 10클러스터 = 30개가 Phase 5 목표(F-CMP-03).
- 내비게이션: Phase 1 헤더는 `홈 · 문의 · [덕메이트 시작하기]`만. 푸터에 `/legal` + web 약관 링크. Phase 5에서 `서비스 · 안전과 신뢰 · 팀 · 뉴스 · 채용 · 위키` 추가.

---

## 2. 페이지별 카피 초안 (실사용 한국어 문장)

> 서비스명은 가칭 "덕메이트"(PRD 오픈 이슈 #1). 브랜드 토큰 1곳에서 치환 가능하게 구현할 것.

### 2.1 홈 (`/`) — Phase 1

**히어로 (미션 한 줄)**

> **같은 걸 좋아하는 사람이랑 만나는 앱, 덕메이트.**
> 외모 스와이프 말고, 취향으로 시작하는 만남을 만듭니다.

- 서브카피: "내 취미 Top 3, 최애, 요즘 빠진 것 — 덕메이트의 첫인상은 사진이 아니라 덕질 카드입니다."
- CTA: `[덕메이트 시작하기]`(→ web) · `[안전 정책 보기]`(→ `#safety`)

**핵심 섹션 ① — 취향이 먼저입니다**

> 덕메이트에서 프로필의 첫 화면은 사진이 아니라 **덕질 카드**입니다.
> 좋아하는 것 세 가지, 최애, 요즘 빠진 것으로 서로를 소개하고,
> 취미 궁합·취향 퀴즈·활동 시간대를 계산해 **"왜 잘 맞는지"를 이유와 함께** 보여드립니다.
> 매칭이 되면 "이번 주말에 같이 보드게임 어때요?" — 같이 할 수 있는 것부터 제안합니다.

**핵심 섹션 ② — 대화를 돈으로 잠그지 않습니다**

> 무료 회원도 매일 새로운 추천을 받고, 매칭되고, 대화할 수 있습니다.
> 유료 기능은 추천 수와 편의 기능을 넓혀줄 뿐, **매칭된 상대와의 대화 시작에 결제를 요구하지 않습니다.**
> 자동갱신은 미리 알려드리고, 해지는 두 번의 탭이면 충분합니다.

**핵심 섹션 ③ — 안전이 성장보다 먼저입니다** (`#safety`, `SafetyPledge` 컴포넌트)

> 덕메이트는 이렇게 약속합니다.
> - **만 19세 미만은 가입할 수 없습니다.** 가입 시 확인하고, 본인인증에서 다시 확인합니다.
> - **본인인증을 마치지 않은 회원끼리는 대화할 수 없습니다.** 매칭과 채팅은 양쪽 모두 인증을 완료했을 때만 열립니다.
> - **모든 신고는 24시간 이내에 처리합니다.** 긴급한 신고는 1시간 이내에 임시 조치합니다.
> - **대화 내용은 들여다보지 않습니다.** 채팅은 신고가 접수된 경우에만, 처리에 필요한 범위만 보존합니다.

(하단 마이크로카피: "안전 정책 전문과 처리 절차는 [안전과 신뢰] 페이지에서 확인하실 수 있습니다." — Phase 1에서는 이 링크를 숨기고 위 4개 약속으로 종결)

**클로징 CTA**

> 취향이 맞는 사람과의 첫 대화, 오늘 시작해 보세요.
> `[덕메이트 시작하기]`

### 2.2 안전과 신뢰 (`/safety`) — Phase 5 (카피 선확정, 05_trust_safety 대외 순화본)

> 순화 원칙(D-6): 내부 룰명·정규식·임계값·자동제재 수치는 제외. 이용자가 "무엇을 기대할 수 있는지"만 서술.

**인트로**

> 만남을 다루는 서비스에서 안전은 기능이 아니라 전제입니다.
> 덕메이트는 매칭 알고리즘보다 신고 처리 체계를 먼저 만들었습니다.

**섹션 1 · 인증 절차 — 단계를 올릴수록 더 많이 열립니다**

> 덕메이트의 모든 회원은 4단계 인증 체계를 거칩니다.
>
> | 단계 | 내용 | 할 수 있는 것 |
> |---|---|---|
> | 가입 | 이메일 가입 + 성인 여부 확인 | 내 프로필 만들기까지만. 다른 회원에게 노출되지 않습니다 |
> | 휴대폰 인증 | 휴대폰 번호 1개당 계정 1개 | 둘러보기와 제한된 호감 표시 |
> | 본인인증 | 통신사 본인인증으로 성인 여부·본인 여부 재확인, 1인 1계정 | 매칭·채팅·사진 전송 등 정식 이용 |
> | 사진 인증 | 프로필 사진 검수(도용·AI 생성 여부 확인) | 인증 뱃지 표시, 모임 호스팅 |
>
> 본인인증을 완료하지 않은 회원끼리는 매칭도, 대화도 성립하지 않습니다.
> 본인인증 과정에서 만 19세 미만으로 확인되면 계정은 즉시 정지되고 정보는 파기 절차를 밟습니다.

**섹션 2 · 신고 처리 — 24시간 약속**

> - 신고가 접수되면 즉시 접수 알림을 드리고, **24시간 이내에 처리 결과를 알려드립니다.**
> - 성범죄·사기·미성년자 의심 등 긴급 신고는 **1시간 이내에 임시 조치**(해당 상대의 발신 정지 등)가 이뤄집니다.
> - 신고자가 누구인지 상대에게 알리지 않으며, 신고 즉시 해당 상대는 화면에서 숨겨지고 원클릭으로 차단할 수 있습니다.
> - 심각한 위반은 영구 이용 정지되며, 재가입이 차단됩니다. 제재에 대해서는 이의제기 절차를 운영합니다.
> - 금전 요구, 외부 링크 유도, 조기 연락처 요구 같은 이상 패턴은 시스템이 자동으로 감지해 상대방에게 안전 안내를 표시합니다.

**섹션 3 · 데이터 정책 요약**

> - **채팅은 상시 열람·수집하지 않습니다.** 신고가 접수된 대화만, 처리에 필요한 범위로 한정해 보존하고, 분쟁이 끝나면 정해진 기한 후 파기합니다.
> - 주민등록번호 등 신원 원문 정보는 저장하지 않습니다. 본인인증 결과는 중복 가입 차단에 필요한 암호화된 값만 보관합니다.
> - 실시간 위치를 수집하지 않습니다. 활동 지역은 회원이 직접 선택한 지역 단위까지만 사용합니다.
> - 탈퇴하면 회원이 작성한 정보는 지체 없이 파기합니다. 법령이 보존을 요구하는 기록은 해당 기간만 보관합니다.
> - 수사기관 자료 제공은 적법한 절차(영장 등)를 확인한 경우에만 응합니다.
>
> 자세한 내용은 [개인정보처리방침](web `/legal/privacy` 링크)을 확인해 주세요.

### 2.3 법적 고지 (`/legal`) — Phase 1

페이지 구성: 인트로 1줄 + 사업자 정보 표(§3.1) + apps/web 약관 6종 링크 목록(§3.3).

> **사업자 정보**
> 덕메이트 서비스는 아래 사업자가 운영합니다. 전자상거래 등에서의 소비자보호에 관한 법률 및 정보통신망법에 따라 다음 사항을 표시합니다.

(이하 `LegalNoticeTable`이 §3.1 표를 렌더)

---

## 3. 법적 고지 ↔ `config/company.ts` 1:1 매핑

### 3.1 표시 항목 (화면 표)

| 표시 라벨 (화면) | `company.ts` 필드 | 근거 | 비고 |
|---|---|---|---|
| 상호(법인명) | `legalName` | 전자상거래법 §10 | |
| 대표자 | `ceoName` | 〃 | |
| 사업자등록번호 | `bizRegNo` | 〃 | |
| 통신판매업 신고번호 | `mailOrderNo` | 전자상거래법 | **Phase 3 결제 오픈 전 하드 블로커**(PRD 이슈 #3). 그 전까지 `[TODO_사업자정보]` |
| 사업장 소재지 | `address` | 〃 | |
| 대표 전화 | `phone` | 〃 | |
| 대표 이메일 | `contactEmail` | 〃 | 문의 폼 수신 주소와 동일 필드 |
| 개인정보보호책임자 | `privacyOfficer.name` / `.email` | 개인정보보호법 | B1 지정, A5 §4.4 창구 단일화와 동일 인물 |
| 청소년보호책임자 | `youthOfficer.name` / `.email` | 정보통신망법 | 스펙 §0-4 |
| 호스팅 서비스 제공자 | `hostingProvider` | 전자상거래법 | 기본값 `"Vercel Inc."` |

### 3.2 타입 정의 (E5가 그대로 구현)

```ts
// apps/company/config/company.ts — 사업자 정보 단일 소스 (스펙 §7)
export interface CompanyInfo {
  serviceName: string;              // "덕메이트" (브랜드 토큰, C1 확정 시 치환)
  legalName: string;                // 상호(법인명)
  ceoName: string;                  // 대표자
  bizRegNo: string;                 // 사업자등록번호
  mailOrderNo: string;              // 통신판매업 신고번호
  address: string;                  // 사업장 소재지
  phone: string;                    // 대표 전화
  contactEmail: string;             // 대표 이메일 = 문의 수신 주소
  privacyOfficer: { name: string; email: string };
  youthOfficer: { name: string; email: string };
  hostingProvider: string;          // "Vercel Inc."
}

export const TODO_PLACEHOLDER = "[TODO_사업자정보]";

export const company: CompanyInfo = {
  serviceName: "덕메이트",
  legalName: "",   // 빈 문자열 = 미확보 → 렌더 시 TODO_PLACEHOLDER 노출 + 빌드 경고
  /* ... 나머지 필드 동일 패턴 ... */
};
```

- 렌더 규칙: 빈 값 → 화면에 `[TODO_사업자정보]` 그대로 노출(스펙 §0-4: 숨기지 말 것), 빌드 시 `TodoBuildWarning`이 필드명 나열 경고. **빌드 차단은 하지 않는다.**
- `serviceName` 외 값은 소유자 확인 전까지 전부 빈 문자열로 커밋.

### 3.3 약관 문서 링크 (원문은 apps/web 단일 게시)

`/legal` 하단과 푸터에서 링크: 이용약관 `web/legal/terms` · 개인정보처리방침 `web/legal/privacy` · 위치정보 이용약관 `web/legal/location` · 청소년보호정책 `web/legal/youth` · 커뮤니티 가이드라인 `web/legal/community` · 환불정책 `web/legal/refund` (B2 산출물 경로 기준, 실제 URL은 E4 라우팅 확정 따름). company에 원문 사본을 두지 않는다.

---

## 4. 문의 폼 설계 (`/contact`)

### 4.1 필드

| 필드 | 타입 | 필수 | 검증 |
|---|---|:---:|---|
| 이름 또는 닉네임 | text ≤ 50자 | O | 실명 강제하지 않음 |
| 회신받을 이메일 | email | O | 형식 검증 |
| 문의 유형 | select | O | `서비스 이용` / `제휴·비즈니스` / `언론·보도` / `채용` / `권리침해·법적 요청` / `기타` |
| 내용 | textarea ≤ 2,000자 | O | |
| 개인정보 수집·이용 동의 | checkbox | O | "문의 처리 목적, 처리 완료 후 1년 보관" 고지 |
| (honeypot) `website` | hidden text | — | 값이 있으면 조용히 성공 처리(스팸) |

- 유형에 `신고`를 두지 않는다. 폼 상단 고정 안내: **"앱 이용 중 발생한 신고는 앱 내 [신고하기]를 이용해 주세요. 앱 내 신고만 24시간 처리 약속이 적용됩니다."**
- 첨부파일 없음(Phase 1 — 스팸·저장 비용 회피). 필요 시 회신 메일로 수령.

### 4.2 발송 구조 (Supabase Edge Function)

```
ContactForm ──POST JSON──▶ Edge Function `company-contact`
  1) CORS: company 도메인만 허용
  2) honeypot·필드 검증, IP당 5건/h rate limit
  3) INSERT contact_messages (service role)   ← 여기까지가 Phase 1 필수 (접수 유실 방지)
  4) RESEND_API_KEY 있으면 company.contactEmail 로 메일 발송 (실패해도 3)이 있으므로 200 응답)
```

- 테이블: `contact_messages(id, name, email, category, body, ip_hash, created_at, handled_at)` — RLS: service role 전용, D1 마이그레이션에 추가 요청. 어드민(D8) 큐 노출은 선택(Phase 1은 Supabase 대시보드 열람으로 충분).
- **mailto 폴백 판정: 단독 사용 불허.** 근거: (a) 이메일 주소 크롤링·스팸 노출, (b) 모바일에서 메일 클라이언트 미설정 시 동작 불능, (c) 접수 기록이 남지 않아 처리 여부 추적 불가. 단, **폼 전송 실패 화면에 한해** "이메일로 직접 보내기(mailto)" 보조 링크 허용.
- 정적 export 제약: 폼은 클라이언트 컴포넌트에서 `fetch(NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL + '/company-contact')`. anon key 등 비밀 아닌 값만 사용.

---

## 5. SEO 전략

### 5.1 인덱싱 범위

- **회사 사이트는 전 페이지 인덱싱 허용** (UGC 없음). `robots.txt`: 전체 Allow + sitemap 지정. 어떤 페이지에도 `noindex` 금지.
- `sitemap.xml`은 빌드 타임 생성(정적 export이므로 스크립트 생성), 존재하는 라우트 전부 포함. E6 검증: "company 빌드 산출물의 HTML 전수에 noindex 0건 && sitemap 항목 = 산출물 라우트 집합".
- 서비스 본체(apps/web)의 UGC noindex는 E6 소관 — company와 규칙이 정반대임을 검증 스크립트에서 도메인별로 분기할 것.

### 5.2 메타 / OG / JSON-LD 스펙

| 항목 | 스펙 |
|---|---|
| title | 홈: `덕메이트 — 같은 걸 좋아하는 사람이랑 만나는 앱` / 그 외: `{페이지명} | 덕메이트` (Next `metadata.title.template`) |
| description | 페이지별 고유 120자 내외. 홈: "외모 스와이프가 아니라 취향으로 만나는 데이팅·취미친구 앱. 본인인증 필수, 신고 24시간 처리." |
| canonical | `NEXT_PUBLIC_COMPANY_URL` 기반 절대 URL, 페이지별 지정 |
| OG | `og:type=website`(뉴스·위키 글은 `article`), 사이트 공통 정적 OG 이미지 1장(1200×630, C1 브랜드 컬러: 딥 바이올렛+코랄) + Phase 5 위키는 카테고리별 1장. 결과별 동적 OG는 서버 없어 불가(허브와 동일 제약) — 정적으로 충분 |
| JSON-LD | **홈**: `Organization`(name=`company.serviceName`, legalName, url, logo, contactPoint[email=`contactEmail`, contactType="customer support"], sameAs=[]) + `WebSite`. **위키 글(Phase 5)**: `Article` + `BreadcrumbList` + (FAQ 섹션 있는 글만) `FAQPage`. 값은 전부 `company.ts`·frontmatter에서 주입, 하드코딩 금지 |

### 5.3 취미 위키 키워드 클러스터 초안 10개 (Phase 5, 클러스터당 3글 = 30개)

콜드스타트 카테고리(A1: 보드게임·공연·러닝/클라이밍·카페투어·애니/웹툰) 우선, 여초·균형 취미 가중(A1 §4.1 성비 전략과 정렬).

| # | 클러스터 (`/wiki/{category}`) | 타겟 키워드 군 | 글 3개 예시 slug |
|---|---|---|---|
| 1 | `boardgame` 보드게임 | 보드게임 입문, 2인 보드게임 추천, 보드게임카페 처음 | `beginner-guide` · `two-player-picks` · `cafe-first-visit` |
| 2 | `concert` 공연·콘서트 | 콘서트 처음 가는 법, 티켓팅 팁, 공연 관람 매너 | `first-concert-guide` · `ticketing-basics` · `concert-etiquette` |
| 3 | `running` 러닝 | 러닝 입문, 러닝 크루 참여, 5km 완주 플랜 | `start-running` · `join-a-crew` · `first-5k-plan` |
| 4 | `climbing` 클라이밍 | 클라이밍 입문, 암장 첫 방문, 볼더링 용어 | `first-gym-visit` · `bouldering-terms` · `gear-for-beginners` |
| 5 | `cafe` 카페투어 | 카페투어 코스, 디저트 카페 용어, 카페 기록 앱/방법 | `seoul-cafe-course` · `dessert-glossary` · `cafe-logging` |
| 6 | `anime` 애니 | 애니 입문작 추천, 분기 신작 보는 법, 애니 용어 사전 | `starter-anime` · `seasonal-guide` · `otaku-glossary` |
| 7 | `webtoon` 웹툰 | 웹툰 장르별 추천, 정주행 리스트, 웹툰 굿즈 입문 | `genre-picks` · `binge-list` · `goods-101` |
| 8 | `idol` 아이돌 덕질 | 덕질 입문(용어·응원법), 콘서트 준비물, 팬덤 활동 가이드 | `fandom-101` · `concert-checklist` · `fan-activities` |
| 9 | `reading` 독서·독서모임 | 독서모임 참여법, 완독 습관, 북토크 매너 | `join-book-club` · `reading-habit` · `booktalk-guide` |
| 10 | `photo` 사진 | 폰카 잘 찍는 법, 출사 입문, 필름카메라 시작 | `phone-photography` · `first-photowalk` · `film-camera-101` |

- 공통 롱테일 패턴: "혼자 시작하는 {취미}", "{취미} 용어 정리", "서울 {취미} 모임/장소" — 각 글 하단에 "같은 취미인 사람과 함께하기 → 덕메이트" CTA 1개(§6 UTM 규칙, 광고성 문구 금지·본문 가치 우선. 스펙 §7 "실질 콘텐츠" 요건).
- 글 요건: 고유 title/description, 본문 1,500자 이상, FAQ 3문항(FAQPage JSON-LD), BreadcrumbList.

---

## 6. apps/web 랜딩과의 관계

### 6.1 역할 분담

| | **apps/web 랜딩** (비로그인 홈) | **apps/company** |
|---|---|---|
| 목적 | **전환**: 가입 시작(`signup_start` 퍼널 진입) | **신뢰·SEO**: 스토어 심사·언론·법적 표시·검색 유입 |
| 화자 | 서비스가 사용자에게 ("지금 시작해 보세요") | 회사가 사회에게 ("우리는 이렇게 운영합니다") |
| 콘텐츠 | 기능 데모, 덕질카드 미리보기, 가입 CTA | 미션, 안전 정책, 사업자 정보, 뉴스, 채용, 위키 |
| 인덱싱 | 공식 페이지만 O, UGC 전면 noindex (E6) | 전부 O |
| 계측 | A3 퍼널 이벤트 전 구간 | 계측 없음(Phase 1) — `analytics_events` 미사용, 유입 측정은 UTM으로 web 쪽에서 |

- **중복 금지 원칙**: 안전 정책 "전문"은 company가, 안전 "약속 배너"는 web 온보딩 첫 화면이 담당(A6 공통사항 #10). 동일 문구 재사용은 허용하되 소스는 이 문서 §2 카피가 원본.

### 6.2 상호 링크 규칙

1. **company → web**: 헤더·히어로·클로징 CTA "덕메이트 시작하기" = `{WEB_URL}/?utm_source=company&utm_medium=referral&utm_campaign={home|safety|wiki-슬러그}`. 위키 글당 CTA 1개 초과 금지.
2. **web → company**: 푸터 고정 3링크(회사 소개 `/` · 안전과 신뢰 `/#safety`, Phase 5부터 `/safety` · 법적 고지 `/legal`). 본문·온보딩 플로우 중간에 company로 이탈시키는 링크 금지(전환 퍼널 보호).
3. **법적 문서**: 원문은 web 단일 게시, company는 링크만(§3.3). 역방향으로 web의 사업자 정보 표시는 `company.ts`를 `packages/` 공유 없이 **web 푸터가 자체 표기하지 않고 company `/legal` 링크로 대체** — 표시 의무 충족 위치는 B1 검수 대상(웹 서비스 자체 푸터 1줄 표기+링크가 안전안).
4. 도메인 미확보 상태(PRD 이슈 #2)에서는 두 vercel.app URL을 env로 상호 주입. 하드코딩 금지.

---

## 부록 · Phase 1 체크리스트 (E5용 요약)

- [ ] `app/page.tsx` 홈: Hero + FeatureSection×3 + SafetyPledge(`#safety`) + 클로징 CTA (§2.1 카피 그대로)
- [ ] `app/legal/page.tsx`: LegalNoticeTable + web 약관 6종 링크
- [ ] `app/contact/page.tsx`: ContactForm + 신고 채널 안내문
- [ ] `config/company.ts`: §3.2 타입, 빈 값 + TodoBuildWarning
- [ ] Edge Function `company-contact` + `contact_messages` 테이블(D1에 마이그레이션 요청)
- [ ] robots/sitemap/metadata/JsonLd(Organization) — §5 스펙
- [ ] 미구현 라우트(서비스/팀/뉴스/채용/위키/safety) 부재 확인 — 내비에 링크 없음
- [ ] Lighthouse 4개 항목 90+ (E6 게이트 G-6)
