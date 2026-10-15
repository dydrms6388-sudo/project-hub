# C2 · 디자인 시스템 — 덕메이트(DuckMate)

> 작성: 서브에이전트 C2 (디자인 시스템) · 기준일 2026-08-19
> 입력: `10_brand.md`(C1 확정 토큰 — 본 문서는 이를 코드로 옮긴 것), `06_PRD.md`.
> 구현 위치: `packages/ui/src/*` (컴포넌트) + `apps/web/app/globals.css` (토큰).
> 검증 완료: `pnpm --filter @duckmate/ui typecheck` ✅ / `pnpm --filter @duckmate/web build` ✅

---

## 다음 에이전트에게 넘기는 결정사항

### D-1. 색은 토큰 클래스만 — hex·임의값 전면 금지
- 컴포넌트/화면 코드에서 `#5a3daa`, `bg-[#...]`, `text-[rgb(...)]` 금지. **스케일 토큰**(`bg-brand-600`, `text-accent-700` 등)과 **시맨틱 토큰**(`bg-surface`, `text-ink`, `bg-primary` 등)만 사용한다.
- **기본 선택은 시맨틱 토큰**이다. 시맨틱 토큰은 다크모드에서 자동 스왑되므로 `dark:` 접두사가 거의 필요 없다. 스케일 토큰을 직접 쓰는 순간 다크모드 책임은 그 코드를 쓴 에이전트에게 넘어간다.

### D-2. 코랄(액센트) 하드룰 — C1 D-4의 코드 집행 방식
- **코랄 배경 + 흰 텍스트 조합 금지.** 코랄이 배경이면 텍스트는 반드시 `text-accent-fg`(모드 불변 어두운 잉크 `#1d1a26`)를 쓴다. `text-ink`도 안 된다 — 다크모드에서 ink 는 밝은 색으로 스왑되어 하드룰을 깨기 때문이다. `Button variant="accent"` 가 이 조합을 이미 내장하고 있으니 직접 조립하지 말고 그걸 써라.
- 밝은 배경 위 코랄 "텍스트"는 `text-accent-text`(라이트 accent-700 / 다크 accent-300 자동). `text-accent-500`을 본문 텍스트에 쓰지 말 것(라이트에서 3:1 — 대형 전용).
- 화면당 코랄 사용 영역은 1~2곳 (궁합 %·좋아요·리빌 CTA 같은 감정 피크만).

### D-3. 만들지 않은(만들면 안 되는) 컴포넌트
- **카운트다운 타이머·재고 표시·손실 공포 배너는 인벤토리에 없다. 추가 금지** (PRD 공통 확정 5항, A4 다크패턴 금지 10항). 필요해 보여도 만들지 말고 오케스트레이터에 보고.
- 외모 점수·매력 평가 표시 슬롯 없음 (C1 §4.1 원칙 5).
- radix 등 **외부 UI 라이브러리 추가 금지** — 허용 의존성은 `clsx`/`tailwind-merge`/`class-variance-authority` 뿐. Dialog 는 네이티브 `<dialog>`, Select 는 네이티브 `<select>` 를 쓴다.

### D-4. 다크모드 계약
- 토큰 스왑은 `apps/web/app/globals.css` 한 곳에서 처리: `prefers-color-scheme: dark` **그리고** `html[data-theme="dark"|"light"]` 수동 토글 겸용. 토글 UI(E4 설정 화면)는 `document.documentElement.dataset.theme = "dark" | "light"` 설정 + 저장만 하면 된다. **미설정(system) 상태에서는 data-theme 속성을 아예 두지 말 것.**
- `dark:` variant 는 위 두 경로 모두에 반응하도록 재정의돼 있다(`@custom-variant dark`). 단, 시맨틱 토큰을 쓰면 `dark:` 자체가 거의 필요 없다.
- **E5 주의**: `apps/company/app/globals.css` 는 C2가 건드리지 않았다. company 앱에서 `@duckmate/ui` 컴포넌트를 쓰려면 web 의 globals.css 토큰 블록(시맨틱 변수 + `@theme` + `@source "../../../packages/ui/src"`)을 복제해 와야 렌더된다.

### D-5. 컴포넌트 사용 강제 사항 (E1~E5 공통)
1. `ToastProvider` 는 앱 루트(클라이언트 경계) 1곳에만 설치. `useToast()` 로 호출.
2. 궁합 %는 **반드시 `CompatGauge`** 로 렌더 — "재미용" 고지(`noticeText`)가 내장돼 있고 생략 불가. 직접 % 숫자를 그리지 말 것.
3. 인증 레벨 표시는 **반드시 `VerifyLevelBadge`** — 레벨명·색을 화면별로 재정의 금지.
4. 거절/닫기/나중에 버튼은 수락 CTA 대비 **최소 70% 크기**: 수락이 `size="lg"` 면 거절은 `md` 이상, 숨김·투명 처리 금지 (C1 D-4-3). `Button variant="ghost"` 사용.
5. 브랜드명은 `import { BRAND_NAME } from "@duckmate/ui"` — 카피에 "덕메이트" 하드코딩 금지 (C1 D-1).
6. 본문 텍스트 16px(`text-body`) 미만 금지, 법적 고지 최소 13px(`text-caption`) — 더 작은 타이포 토큰은 존재하지 않으며 만들지 말 것.
7. 상태는 색 단독 전달 금지 — 각 컴포넌트가 텍스트/아이콘을 병행하도록 만들어져 있으니 아이콘·라벨 슬롯을 비우지 말 것.
8. `Input`/`Textarea`/`Select` 의 `invalid` 를 켤 때는 반드시 에러 문구 요소를 `aria-describedby` 로 연결.

### D-6. 미완/후속 작업
- **Pretendard Variable 셀프호스팅 미구현**: 현재는 폰트 스택 선언만 있고 woff2 파일(`packages/ui/fonts` 예정)과 `@font-face` 가 없다 → 시스템 폰트로 폴백 중. E6 성능 게이트 전에 서브셋 woff2 추가 필요 (외부 CDN 금지 — C1 §3.1).
- `StreakBadge` 는 Phase 2(F-GAM-05) 대비 **표시 전용 스켈레톤** — 로직·보상 연동 없음. Phase 1 화면에서 사용 금지.
- `MatchReveal` 은 Phase 1 단순 모달용 컨테이너(M8). 스크래치 연출은 Phase 2 F그룹이 이 컨테이너 내부를 교체하는 방식으로.
- 로고/심볼 벡터(C1 §5)는 미제작 — 앱 아이콘·OG 이미지는 후속.

---

## 1. 토큰 체계

토큰의 단일 원본은 `apps/web/app/globals.css`. hex 값의 단일 원본은 `10_brand.md` D-2/D-3 표이며 1:1 로 옮겼다(기존 임시 토큰 값 변경 0건, 누락 단계만 추가).

### 1.1 스케일 토큰 (모드 불변, `@theme`)

| 팔레트 | 클래스 예 | 단계 |
|---|---|---|
| brand (딥 바이올렛) | `bg-brand-600` | 50~900 전체 |
| accent (코랄) | `text-accent-700` | 50~900 전체 |
| success / warning / danger | `text-success-600` 등 | 각 50~900 전체 |

용도 규약(C1 §2.2): 50~100 배경 틴트 · 200~300 보더/다크 텍스트 · 400~500 그래픽/게이지/대형 숫자 · 600~700 라이트 텍스트/버튼 배경 · 800~900 딥 배경(리빌·스플래시).

### 1.2 시맨틱 토큰 (다크모드 자동 스왑) — **기본 선택지**

| 클래스 | 라이트 → 다크 | 용도 |
|---|---|---|
| `surface` | #faf9f6 → #141220 | 페이지 배경 |
| `surface-raised` | #ffffff → #1e1b2e | 카드/시트/모달 |
| `ink` / `ink-muted` | #1d1a26→#e9e5f2 / #5f5a70→#a49dbb | 본문 / 보조 텍스트 |
| `line` | #e8e4de → #332e47 | 보더/디바이더 |
| `primary` / `primary-fg` / `primary-strong` | brand-600/백색/brand-700 → brand-300/brand-900/brand-200 | 주 CTA (배경/텍스트/hover) |
| `primary-tint` / `primary-tint-fg` | brand-100/brand-900 → brand-800/brand-100 | 선택 칩·배지 틴트 |
| `accent` | accent-500 → accent-400 | 감정 포인트 배경·게이지 채움 |
| `accent-text` | accent-700 → accent-300 | 밝은 배경 위 코랄 텍스트 |
| `accent-tint` / `accent-tint-fg` | accent-50/700 → accent-900/200 | 코랄 틴트 배지 |
| `success` / `warning` / `danger` (+ 각 `-tint`) | 600계 → 300~400계 | 상태 텍스트/틴트 배경 |

### 1.3 모드 불변 시맨틱 (하드룰 집행용)

| 클래스 | 값 | 규칙 |
|---|---|---|
| `accent-fg` | #1d1a26 고정 | **코랄 배경 위 텍스트는 이것만** (다크에서도 어두운 잉크) |
| `danger-solid` | #d3382c 고정 | 위험 버튼 배경 전용(백색 텍스트 4.80:1) — `danger` 는 텍스트용 |

### 1.4 타이포그래피 토큰 (`text-*` 유틸리티)

`display`(34/42·800·-0.02em) · `h1`(26/34·700) · `h2`(21/29·700) · `h3`(17/25·600) · `body`(16/26) · `body-sm`(14/22) · `caption`(13/18·500) — C1 §3.2 그대로. 추가로 궁합 % 전용 `stat-hero`(56px) / `stat-inline`(22px).

`.stat-number`(+내부 `.stat-number-unit`) 클래스가 weight 800 / tabular-nums / % 기호 0.5em 규칙을 고정한다 — CompatGauge 가 사용하며, 다른 곳에서 % 숫자를 직접 만들 일은 없어야 한다.

### 1.5 모션 토큰

`animate-reveal-pop`(0.6s scale-in) · `animate-reveal-rise`(0.7s+0.35s delay rise) — 매칭 리빌·다이얼로그 용, 총 1.1s. 새 애니메이션은 5초 이내 + `motion-reduce:animate-none` 병기 필수.

---

## 2. 컴포넌트 인벤토리 (`packages/ui/src/`)

`"use client"` 는 Dialog·Tabs·Toast 3개뿐 — 나머지는 서버 컴포넌트에서 바로 사용 가능.

### 2.1 기본

| 컴포넌트 | 파일 | 주요 props | 상태/접근성 | 주 사용처 |
|---|---|---|---|---|
| `Button` | button.tsx | `variant: primary\|accent\|ghost\|danger`, `size: sm\|md\|lg`, `loading`, 네이티브 button props | loading 시 스피너+`aria-busy`+클릭 차단, focus ring | 모든 CTA. accent 는 화면당 1곳 |
| `Input` | input.tsx | `invalid`, 네이티브 input props | `aria-invalid`, 16px 고정(iOS 줌 방지) | 온보딩·프로필 폼 (E1, E4) |
| `Textarea` | textarea.tsx | `invalid`, 네이티브 props | 동일 | 덕질카드 작성, 신고 상세 |
| `Select` | select.tsx | `invalid`, children=`<option>` | 네이티브 select — 모바일 접근성 | 지역·카테고리 선택 (E1) |
| `Badge` | badge.tsx | `variant: neutral\|brand\|accent\|success\|warning\|danger` | 틴트 토큰 → 다크 자동 | 카운트·상태 라벨 |
| `Card` (+Header/Title/Description/Content/Footer) | card.tsx | div props | surface-raised 위계 | 범용 컨테이너 |
| `Dialog` 〔client〕 | dialog.tsx | `open`, `onClose`, `title`, `dismissOnBackdrop` | 네이티브 `<dialog>.showModal()` — ESC·포커스트랩 내장, `aria-labelledby`, 닫기 버튼 상시 노출 | 매칭 리빌 모달(E2), 확인창 |
| `Tabs`/`TabList`/`Tab`/`TabPanel` 〔client〕 | tabs.tsx | `defaultValue`, `value`, `onValueChange` / Tab: `value`, `disabled` | role=tablist/tab/tabpanel, ←→/Home/End 키보드, roving tabindex | 친구/데이팅 모드 전환(E2), 설정(E4) |
| `Progress` | progress.tsx | `value`, `max`, `label` | `role="progressbar"`+aria-value*, 채움 brand-500 | 온보딩 단계(E1) |
| `Avatar` | avatar.tsx | `name`, `src?`, `size: sm\|md\|lg` | src 없으면 이니셜 폴백+`role="img"` — 사진 없음이 1급 상태(M6) | 덕질카드, 채팅 헤더(E3) |
| `Skeleton` | skeleton.tsx | `className` 으로 크기 | `aria-hidden` — 로딩 고지는 컨테이너 `aria-busy` 로 | 추천 큐·카드 로딩 |
| `ToastProvider`+`useToast` 〔client〕 | toast.tsx | `toast(message, {variant, duration})` | `role="status"`(polite), 자동 닫힘 4s | 저장 완료·오류 알림 전역 |

### 2.2 도메인

| 컴포넌트 | 파일 | 주요 props | 규칙 | 주 사용처 |
|---|---|---|---|---|
| `DuckCard` | duck-card.tsx | `nickname`, `topHobbies`(≤3), `bias`(최애), `obsession`(요즘 빠진 것), `verifyLevel?`, `avatarSrc?`, `footer?` | 사진 없어도 완결. 외모 평가 슬롯 없음 | 추천 큐 첫 화면(E2), 채팅 상단 요약(E3), 프로필(E4) |
| `CompatGauge` | compat-gauge.tsx | `percent`, `size: hero\|inline`, `reasons?`(≤3줄), `noticeText`(기본 "궁합은 재미와 추천용이에요") | stat-number 스타일 고정, **고지 생략 불가**, 게이지+숫자 이중 전달 | 매칭 리빌(E2), 매칭 리스트 |
| `StreakBadge` | streak-badge.tsx | `days`, `active` | **Phase 2 스켈레톤 — Phase 1 사용 금지.** 끊김을 danger 로 칠하지 않음 | Phase 2 홈 (F2) |
| `MatchReveal` | match-reveal.tsx | `headline`(기본 "취향이 통했어요!"), `subline?`, `children` | CSS 애니메이션만(1.1s), brand-800→900 딥 배경, reduced-motion 존중 | 매칭 성립 모달 내부(E2, F-DIS-04) |
| `HobbyChip` | hobby-chip.tsx | `label`, `selected`, `selectable`(false=표시용 span), button props | 제어형. `aria-pressed`, 선택=색+✓아이콘+굵기 3중 | 온보딩 취미 선택(E1), 덕질카드 |
| `VerifyLevelBadge` | verify-level-badge.tsx | `level: 0\|1\|2\|3`, `compact?` | 라벨: 미인증/휴대폰 인증/본인 인증/사진 인증 — 재정의 금지. Lv2+ 체크 아이콘 | 프로필·덕질카드·설정 (E1~E4) |

기타 export: `cn`(클래스 병합), `BRAND_NAME`/`BRAND_NAME_EN`(브랜드명 단일 상수).

---

## 3. 다크모드 전략 (요약)

1. **메커니즘**: 시맨틱 CSS 변수(`--dm-*`)를 ① `@media (prefers-color-scheme: dark)` (단, `[data-theme="light"]` 가 아닐 때) ② `[data-theme="dark"]` 두 경로에서 다크 값으로 스왑. `@theme inline` 이 이 변수를 Tailwind 유틸리티로 노출한다.
2. **우선순위**: 수동 토글 > 시스템 선호. 토글 미설정 시 data-theme 속성 없음 = 시스템 추종.
3. **다크는 검정이 아니라 바이올렛 밤하늘** (C1 §2.3) — surface #141220, 카드 #1e1b2e. 순수 `bg-black`/`bg-white` 사용 금지 (`text-white` 는 brand-600+ 딥 배경 위에서만 허용).
4. **FOUC 방지(E4 숙제)**: 수동 토글 도입 시 `<head>` 인라인 스크립트로 저장값을 `data-theme` 에 먼저 반영할 것.

---

## 4. 검증 기록

```bash
cd /home/user/project-hub/duckmate
pnpm --filter @duckmate/ui typecheck   # ✅ 통과 (2026-08-19)
pnpm --filter @duckmate/web build      # ✅ 통과 — Next.js 15.5, 4 static pages
```

컴파일 산출 CSS 에서 시맨틱 유틸리티(`bg-primary-tint`, `text-accent-text`, `bg-danger-solid`, `text-stat-hero`), `[data-theme=dark]`/`[data-theme=light]` 셀렉터, `dark:` variant, `.stat-number` 생성 확인 완료.
