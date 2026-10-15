# 11 — 디자인 시스템 `packages/ui` (C2)

> 입력: `10_brand.md`(토큰·타입·아이콘·모션 — 값을 그대로 옮김), `12_flows.md`(화면·컴포넌트 필요 목록), `06_PRD.md` §0 C 그룹 28~35.
> 코드 위치: `packages/ui/src`. shadcn 스타일로 **손으로 작성**(CLI 미사용), Radix 프리미티브 + cva + tailwind-merge + lucide-react. Storybook 없음 → `DemoGallery`.
> 값(색·크기·모션)을 바꾸려면 `10_brand.md`를 먼저 고치고 `styles.css`/`tokens.ts`에 반영한다. 컴포넌트 안에 HEX 리터럴을 새로 넣지 않는다(예외: 아바타 색 페어·danger 배너 소프트색은 tokens/styles에만).

## 다음 에이전트에게 넘기는 결정사항

### import / 설정 (E1~E6 공통)
1. **import 경로는 2개뿐**: 컴포넌트·토큰·유틸은 `import { Button, DuckCard, cn, HOBBY_CATEGORIES } from "@duckmate/ui"`, 스타일은 `import "@duckmate/ui/styles.css"` (앱 `app/layout.tsx` 1회). 서브패스 `@duckmate/ui/tokens`·`@duckmate/ui/demo`도 열려 있지만 루트 export를 우선한다.
2. **Tailwind v4 스캔 설정 필수**: `apps/web/app/globals.css`(company도 동일)를 아래로 교체한다. `@source`가 없으면 `packages/ui` 안의 클래스가 CSS에 생성되지 않아 스타일이 전부 빠진다.
   ```css
   @import "@duckmate/ui/styles.css";
   @source "../../../packages/ui/src";
   ```
   `styles.css`가 이미 `@import "tailwindcss"`를 포함하므로 globals.css에서 `@import "tailwindcss"`를 **중복 선언하지 않는다**.
3. **Pretendard 로딩(Phase 1)은 앱 layout `<head>`에 `<link>` 2개**: `PRETENDARD_CDN_HREF` 상수(tokens.ts) + `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>`. `styles.css`에는 font-family 스택만 있고 `@font-face`·`@import url()`은 없다(CSP·정적 export 단순화). Phase 2 self-host는 `next/font/local` + `--font-sans` 덮어쓰기.
4. **다크모드 = `<html class="dark">` 또는 `data-theme="dark"`**. 클래스가 없으면 `prefers-color-scheme: dark`로 자동 폴백된다(`styles.css` @media 블록). 라이트 강제는 `class="light"` 또는 `data-theme="light"`. 앱은 Phase 1에서 토글 UI를 만들지 않는다(OS 설정 존중, company도 동일). `dark:` 유틸은 `.dark`/`data-theme` 기준 커스텀 variant로 정의돼 있으나, **컴포넌트는 시맨틱 토큰(`bg-card`, `text-muted-foreground`)만 쓰면 다크 대응이 자동**이다.
5. **Radix 의존 컴포넌트는 `"use client"`**가 파일에 이미 있다. 서버 컴포넌트에서 import해도 되지만(경계는 패키지 안에서 그어짐), `Card`·`Badge`·`Label`·`Input`·`Skeleton`·`EmptyState`·`Spinner`·`IntensityDots`·`VerifyBadge`·`CompatGauge`·`OnboardingProgress`·`LegalFooter`는 클라이언트 지시어 없이 서버에서 그대로 렌더 가능하다.
6. **Next `<Link>` 주입은 `renderLink` prop**: `AppShell`·`LegalFooter`는 기본 `<a href>`를 쓰고, 앱은 `renderLink={(item, p) => <Link href={item.href} {...p} />}`로 바꾼다. `Button asChild` + `<Link>` 조합도 가능(Radix Slot).
7. **`ToastProvider`는 `(app)` layout 1회**, 사용은 `const { toast } = useToast(); toast({ title: "5개까지 고를 수 있어요" })`. variant `default|success|error`, 3개 초과 시 오래된 것부터 제거. `TooltipProvider`는 앱 루트 1회.
8. **lucide-react `0.544.0` 고정**(brand §6.2 요구 `^0.4xx` 이상 충족). `Home`·`Loader2`는 이 버전에 **없음** → `House`·`LoaderCircle` 사용(AppShell/Spinner/Button 반영). 취미 12 아이콘(`MicVocal`·`Dices`·`Footprints`·`Tv`·`Gamepad2`·`Coffee`·`BookOpen`·`Camera`·`Code`·`Plane`·`PawPrint`·`Music`) + `ShieldCheck`·`BadgeCheck`·`Sprout` 모두 typecheck로 존재 확인. D1 시드의 `hobbies.icon`(kebab)은 `HOBBY_CATEGORIES[].icon`, export 이름은 `.iconExport`를 쓴다.
9. **아이콘 규격은 컴포넌트 안에서 고정**(24/1.75, 칩 16/2, 빈 상태 48/1.25 `#A493C4`). 앱에서 직접 lucide를 쓸 때는 `ICON` 상수(tokens.ts)를 참조한다. 채움(fill) 금지, 예외는 좋아요 활성 `Heart className="fill-accent text-accent"` / 슈퍼라이크 활성 `Star className="fill-primary text-primary"`.
10. **서비스명 리터럴 금지 유지**: 패키지 어디에도 "덕메이트"가 없다. 데모 카피·기본 라벨도 마찬가지이므로 E 그룹의 `check-service-name.mjs` 대상에 `packages/ui`를 포함해도 통과한다.

### 컴포넌트 계약 (props 그대로 쓸 것)
11. **`DuckCard`** props: `profileId`(아바타 seed) · `nickname` · `ageBand`("20대 후반") · `region`(구까지) · `verifyLevel`(0~3, 카드에는 2/3만 옴) · `hobbies: {category, label, intensity, overlap?}[]`(Top3, rank 순, 초과분 무시) · `favorite?` · `nowInto?` · `compat?`(0~100, 생략 시 게이지 없음) · `reasons?`(상위 2개만 렌더) · `availabilityOverlap?` · `sameRegion?` · `suggestion?`("같이 할 수 있는 것") · `photos?`(**카드 아래 스트립**에만 렌더) · `onHeaderClick?` · `footer?`(사진 보기 버튼 슬롯) · `headerAction?` · `compact?`. "입문 환영"은 Top3 중 `intensity ≤ 2`가 있으면 **자동**(PRD §0-30) — 앱이 따로 계산하지 않는다. 데이터 fetching·뒤집기 상태는 없다: 2면(사진 캐러셀)은 E2가 `flip-card` 유틸 + 버튼/탭 둘 다로 구현(PRD §0-35).
12. **`CompatGauge`**: `value`(0~100) · `label`(기본 "궁합") · `size sm|md|lg` · `layout bar|ring` · `showValue`. 색 규칙은 `compatTone()`(tokens.ts): **0~39 muted / 40~79 primary / 80~100 accent(코랄)**. `role="meter"` + `aria-valuenow`. 코랄 텍스트는 accent-700(#B5321F)이라 본문 대비 통과.
13. **`HobbyChip`**: `label` · `category?`(slug → 아이콘 자동) · `icon?` · `glyph icon|emoji|none` · `selected` · `highlighted`(겹침 = 코랄 소프트) · `intensity?`(점 5개 인라인) · `rank?` · `beginnerWelcome?`(생략 시 intensity ≤ 2 자동) · `size sm|md`. `onClick`이 있으면 `<button aria-pressed>`, 없으면 `<span>`. 온보딩 S4 선택 그리드·덕질 카드 Top3·매칭 겹침 태그 전부 이 컴포넌트.
14. **`IntensityDots`**: `value 1~5` · `showLabel` · `tone primary|accent|muted|inherit`. 라벨은 `INTENSITY_LABELS`(관심 있음·가끔·주 1회·거의 매일·이게 인생) 단일 소스 — E1의 몰입도 시트 라디오 라벨도 여기서 읽는다.
15. **`VerifyBadge`**: `level 0~3`. **L0/L1은 기본 미렌더**(`showLow`로 인증 센터에서만 표시). L2 = `ShieldCheck` primary 아웃라인 "본인인증", L3 = `BadgeCheck` primary 채움 "사진인증". 라벨은 `VERIFY_LABELS`.
16. **`MatchReveal`**: `variant 'simple'|'scratch'`(scratch는 타입만, simple로 폴백 — F2 Phase 2) · `left`/`right`(DuckCard compact 권장) · `overlapLabels` · `headline`(기본 "매칭됐어요 🎉") · `durationMs`(상한 1200) · `onDone`(자동/건너뛰기 공통 1회) · `skipLabel`. reduce-motion이면 즉시 `onDone`. E2는 `onDone` 후 제안 카드 3장을 렌더한다(순서 고정, 12_flows §4.1).
17. **`SuggestionCard`**: `title` · `body`(첫 메시지 원문 그대로) · `kind online|offline|talk` · `icon?`(lucide 컴포넌트 또는 이모지 1자) · `position 1~3` · `selected` · `loading` · `onSelect` · `selectLabel`(기본 "이걸로 시작하기"). 3장 가로 스냅은 부모가 `flex snap-x overflow-x-auto` + 카드 `w-72 shrink-0 snap-start`.
18. **`SafetyBanner`**: `variant info|warn|danger`(danger는 스캠 시그널·제재용 추가) · `title?` · `children`(문구는 05 §10 확정본 그대로) · `action?{label,onClick}` · `onDismiss?`. `danger`만 `role="alert"`.
19. **`OnboardingProgress`**: `current`(1-based) · `total`(기본 **7** = 연령·휴대폰·기본·취미·퀴즈·카드·사진) · `showCount` · `labels?`. 12_flows처럼 "6/6" 표기를 유지하려면 `total={6}`으로 호출하고 `/onboarding/photos`도 `current={6}`을 넘긴다 — 어느 쪽이든 앱 전체에서 한 값으로 통일(E1 결정). `role="progressbar"` + `aria-valuetext`.
20. **`AppShell`**: `active 'home'|'chat'|'me'|'settings'` · `badges?{chat: n}` · `renderLink` · `header?` · `hideTabs?`(채팅방·풀스크린) · `tabs?`(라벨/href 덮어쓰기). 기본 탭 = 홈 `/home` / 채팅 `/chat` / 프로필 `/me` / 설정 `/settings`(`DEFAULT_APP_TABS`). 12_flows의 "오늘·추천·채팅·나" 4탭으로 바꾸려면 `tabs` prop만 교체하면 되고 컴포넌트 수정 불필요. main은 하단 탭 높이(64px)+safe-area만큼 자동 패딩.
21. **`LegalFooter`**: `company: LegalCompanyInfo`(companyName·ceoName·bizNo·ecomNo·address·email·phone?·privacyOfficer·youthOfficer·hostingProvider) · `links`(기본 `/legal/*` 5종) · `renderLink` · `year` · `compact`(결제 시트 축약본) · `note`. 값이 비었거나 `{{PLACEHOLDER}}` 형식이면 **`[TODO_사업자정보]`를 그대로 출력**(숨기지 않음). `phone`만 선택 항목(플레이스홀더면 줄 미렌더). company.ts → props 매핑은 E5/E6.
22. **`StreakBadge`는 Phase 1에서 `null`을 렌더**한다. props 타입(`days`·`todayDone`·`broken`)만 확정. F3가 Phase 2에서 본문을 채운다. 앱에 자리 표시 컴포넌트를 만들지 않는다.
23. **`HobbyAvatar`/`Avatar`**: 사진 없으면 `avatarFor(profileId, categorySlug)`(FNV-1a 해시, 서버·클라이언트 동일) 로 카테고리 색 페어 + 이모지(기본)/lucide 아이콘(`glyph="icon"`). `Avatar src`가 비거나 로드 실패면 자동 폴백. 사람 실루엣·이니셜·성별 기본 아바타 없음(`initial`은 옵션, 기본 off).
24. **`Sheet`(bottom sheet)는 헤더 X + 하단 "닫기" 텍스트 둘 다 기본 표시**(PRD §0-34), `bottomCloseLabel={null}`로만 끌 수 있다. `Dialog showClose={false}`는 확인 필수 모달(첫 매칭 안전 모달·제재 level 1 경고)에만.
25. **`RadioCard`**(radio-group.tsx)는 퀴즈 선택지·신고 사유·몰입도 시트용 카드형 라디오. 행 전체가 터치 영역(min-h 56px).
26. **`Skeleton*` 3종**(`SkeletonCard`·`SkeletonList`·`SkeletonForm`)은 12_flows §8 표와 1:1. "300ms 이내 응답이면 미표시 / 2s 초과 시 '조금 오래 걸리네요'"는 호출부(E)가 타이머로 처리.
27. **`EmptyState`**: `icon`(lucide 컴포넌트 또는 이모지 1개) · `title` · `description` · `action`(대체 행동 **1개**). 자책 카피 금지는 카피 소유자(E) 책임.

### 토큰·규칙
28. **코랄 위 글자 = `text-accent-foreground`(#1C1A17)**. `Button variant="accent"`가 이미 지킨다. 코랄을 텍스트로 쓸 때는 `text-coral-700`(라이트)/`text-coral-300`(다크) — `text-accent`를 본문 텍스트 색으로 쓰지 않는다(3.16:1).
29. **텍스트 색 최소 = `text-muted-foreground`(#5C5650)**. `text-sand-500`(#7D766F)은 비활성 아이콘·구분선 전용, `text-sand-400`은 placeholder 전용. 12px(`text-caption`) 미만 텍스트 유틸은 제공하지 않는다.
30. **숫자는 `.tnum`** — 남은 추천 수, 잔여 슈퍼라이크, "07:00", ₩ 가격, "3/10", D-day. 컴포넌트 내부 숫자(진행 바 카운트, 게이지 %, 탭 배지)는 이미 적용.
31. **radius**: 버튼/입력 `rounded-md`(12) · 카드 `rounded-lg`(16) · 모달/시트 `rounded-xl`(20) · 칩/배지 `rounded-full`. 완전 원형 버튼 금지(아이콘 버튼도 `rounded-md`).
32. **모션 유틸**: `animate-fade-in|fade-out|slide-up|slide-down|scale-in|toast-in|like-pop|skeleton`, `flip-card`, `duration-(--duration-fast|base|exit|sheet|flip)`, `ease-(--ease-enter|exit)`. `height`/`top` 애니메이션 금지, `transform`·`opacity`만. reduce-motion 블록은 brand §7.2 그대로 전역 적용(별도 설정 토글 없음).

---

## 1. 파일 구조

```
packages/ui/
├─ package.json            exports: ".", "./styles.css", "./tokens", "./demo", "./*"; sideEffects: ["**/*.css"]
└─ src/
   ├─ index.ts             공개 API 전부
   ├─ styles.css           @import "tailwindcss" + 토큰(:root/.dark/@media) + @theme + 타입 스케일 + 모션 + reduce-motion
   ├─ tokens.ts            HEX 스케일·시맨틱·THEME·RADIUS·MOTION·TYPE_SCALE·ICON·HOBBY_CATEGORIES·avatarFor·compatTone·법적 플레이스홀더
   ├─ lib/cn.ts            clsx + tailwind-merge
   ├─ components/          기본 21종 (shadcn 네이밍, kebab-case 파일)
   ├─ components/domain/   도메인 12종 (PascalCase 파일)
   └─ demo/DemoGallery.tsx 전 컴포넌트 갤러리
```

## 2. 컴포넌트 목록

### 2.1 기본

| 이름 | 경로 (`src/components/`) | props 요약 | client | Phase |
|---|---|---|---|---|
| `Button` | `button.tsx` | `variant default\|secondary\|accent\|outline\|ghost\|destructive\|link`, `size sm\|md\|lg\|icon`, `asChild`, `loading` | ● | 1 |
| `Input` | `input.tsx` | HTML input + `invalid` | | 1 |
| `Textarea` | `textarea.tsx` | HTML textarea + `invalid` | | 1 |
| `Label` | `label.tsx` | `required`, `hint` | | 1 |
| `Checkbox` | `checkbox.tsx` | Radix Checkbox (`checked`, `onCheckedChange`, indeterminate) | ● | 1 |
| `RadioGroup` / `RadioGroupItem` / `RadioCard` | `radio-group.tsx` | Radix RadioGroup; `RadioCard {label, description}` | ● | 1 |
| `Select` 계열 | `select.tsx` | Radix Select: `Select, SelectTrigger(invalid), SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator` | ● | 1 |
| `Switch` | `switch.tsx` | Radix Switch | ● | 1 |
| `Badge` | `badge.tsx` | `variant default\|primary\|secondary\|accent\|outline\|muted\|success\|warning\|danger\|info`, `size sm\|md\|lg` | | 1 |
| `Card` 계열 | `card.tsx` | `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter` | | 1 |
| `Dialog` 계열 | `dialog.tsx` | Radix Dialog; `DialogContent {showClose}` | ● | 1 |
| `Sheet` 계열 | `sheet.tsx` | Dialog 기반 하단 시트; `SheetContent {bottomCloseLabel, showClose, handle}` | ● | 1 |
| `Tabs` 계열 | `tabs.tsx` | Radix Tabs | ● | 1 |
| `Progress` | `progress.tsx` | `value 0~100`, `tone primary\|accent\|success\|muted` | ● | 1 |
| `Skeleton` / `SkeletonCard` / `SkeletonList` / `SkeletonForm` | `skeleton.tsx` | `rows`, `fields` | | 1 |
| `ToastProvider` / `useToast` | `toast.tsx` | `toast({title, description?, variant?, duration?, action?})`, `dismiss(id)` | ● | 1 |
| `Tooltip` 계열 | `tooltip.tsx` | Radix Tooltip (`TooltipProvider` 루트 1회) | ● | 1 |
| `Avatar` / `HobbyAvatar` | `avatar.tsx` | `seed, category, size sm\|md\|lg\|xl, glyph emoji\|icon, initial?`; `Avatar {src, alt}` 폴백 | ● | 1 |
| `EmptyState` | `empty-state.tsx` | `icon`(lucide\|이모지), `title`, `description`, `action` | | 1 |
| `Spinner` | `spinner.tsx` | `size sm\|md\|lg`, `label` | | 1 |

### 2.2 도메인

| 이름 | 경로 (`src/components/domain/`) | props 요약 | Phase |
|---|---|---|---|
| `DuckCard` | `DuckCard.tsx` | 결정사항 11 | 1 |
| `CompatGauge` | `CompatGauge.tsx` | `value, label, size, layout bar\|ring, showValue` | 1 |
| `HobbyChip` | `HobbyChip.tsx` | 결정사항 13 | 1 |
| `IntensityDots` | `IntensityDots.tsx` | `value 1~5, showLabel, tone, size` | 1 |
| `VerifyBadge` | `VerifyBadge.tsx` | `level 0~3, showLow, size, iconOnly` | 1 |
| `StreakBadge` | `StreakBadge.tsx` | `days, todayDone, broken, size` — **렌더 없음(null)** | 2 (F3) |
| `MatchReveal` | `MatchReveal.tsx` | 결정사항 16; `scratch`는 타입만 | 1 (scratch: 2) |
| `SuggestionCard` | `SuggestionCard.tsx` | 결정사항 17 | 1 |
| `SafetyBanner` | `SafetyBanner.tsx` | `variant info\|warn\|danger, title, action, onDismiss` | 1 |
| `OnboardingProgress` | `OnboardingProgress.tsx` | `current, total=7, showCount, labels`; `ONBOARDING_STEPS` | 1 |
| `AppShell` | `AppShell.tsx` | `active, tabs, badges, renderLink, header, hideTabs`; `DEFAULT_APP_TABS` | 1 |
| `LegalFooter` | `LegalFooter.tsx` | `company, links, renderLink, year, compact, note`; `DEFAULT_LEGAL_LINKS` | 1 |

### 2.3 데모
- `DemoGallery`(`src/demo/DemoGallery.tsx`): 전 컴포넌트 + 타입 스케일 + 다크 토글. E 그룹이 `apps/web/app/dev/ui/page.tsx`에 `"use client"` 페이지로 마운트(`metadata.robots = noindex`, 프로덕션에서는 404 처리 권장).

## 3. 토큰 표

### 3.1 시맨틱 (CSS 변수 → Tailwind 유틸)

| 변수 | 라이트 | 다크 | 유틸 예 |
|---|---|---|---|
| `--background` / `--foreground` | #FAF8F5 / #1C1A17 | #15121F / #F3F0EB | `bg-background text-foreground` |
| `--card` / `--card-foreground` | #FFFFFF / #1C1A17 | #1E1A2B / #F3F0EB | `bg-card` |
| `--primary` / `--primary-foreground` | #5B3BCF / #FFFFFF | #9F8BF0 / #1B1140 | `bg-primary text-primary-foreground` |
| `--secondary` / `--secondary-foreground` | #EEEAF6 / #463A5B | #352C45 / #DDD6EC | 입문 환영 칩 |
| `--accent` / `--accent-foreground` | #F4573C / **#1C1A17** | #FF8A73 / #1B1140 | 좋아요·매칭 |
| `--destructive` / `-foreground` | #D23B3B / #FFFFFF | #FF6B6B / #15121F | 신고·차단·탈퇴 |
| `--muted` / `--muted-foreground` | #F3F0EB / #5C5650 | #2C2536 / #A8A19A | 캡션 최소 색 |
| `--success` / `--success-soft` | #177A4C / #E6F6EE | #4DBE86 / 어두운 소프트 | `text-success bg-success-soft` |
| `--warning` / `--warning-fill` / `--warning-soft` | #8A5A08 / #F0B33B / #FFF4DD | #F0B33B / #F0B33B / 어두운 소프트 | 검수 대기 |
| `--info` / `--info-fill` / `--info-soft` | #1F4F9E / #2F6FD6 / #E8F0FD | #6EA3F0 / #2F6FD6 / 어두운 소프트 | 안전 수칙 |
| `--border` / `--input` / `--ring` | #E6E1DA / #D2CCC4 / #5B3BCF | #2C2536 / #3A3247 / #9F8BF0 | 포커스 링 2px offset 2px |
| `--radius` | 0.75rem | — | `rounded-sm(8) md(12) lg(16) xl(20)` |

풀 스케일: `violet-50~950`, `lilac-50~950`, `coral-50~950`, `sand-0~950` (예: `bg-violet-100 text-violet-700`). 컴포넌트는 시맨틱 우선, 스케일은 아바타·강조 칩·일러스트에 한정.

### 3.2 타입 스케일 유틸

`text-display`(32/40·800) `text-h1`(26/34·700) `text-h2`(22/30·700) `text-h3`(18/26·600) `text-body`(16/24) `text-body-sm`(14/20) `text-label`(14/20·500) `text-caption`(12/16·500, 최소) `text-button`(16/24·600) `text-button-sm`(14/20·600) + `tnum`. display/h1은 md 이상에서 +4px.

### 3.3 모션 토큰

`--duration-fast 120ms` · `--duration-base 200ms` · `--duration-exit 150ms` · `--duration-sheet 260ms` · `--duration-flip 320ms` · `--ease-enter cubic-bezier(0.2,0,0,1)` · `--ease-exit cubic-bezier(0.4,0,1,1)`. TS 상수 `MOTION`(matchRevealMax 1200 포함).

### 3.4 TS 상수 (`tokens.ts`)

`VIOLET·LILAC·CORAL·SAND·BRAND·SEMANTIC·THEME·RADIUS·MOTION·TYPE_SCALE·FONT_FAMILY·PRETENDARD_CDN_HREF·ICON·HOBBY_CATEGORIES·HOBBY_BY_SLUG·isHobbyCategorySlug·INTENSITY_LABELS·BEGINNER_WELCOME_MAX_INTENSITY·VERIFY_LABELS·avatarFor·hashString·compatTone·LEGAL_TODO·isLegalPlaceholder·displayLegal`.

## 4. 사용 규칙

### 4.1 앱 설정 (E1 최초 1회)
1. `apps/web/package.json`에 `@duckmate/ui: workspace:*` 이미 있음. `pnpm install`.
2. `apps/web/app/globals.css`:
   ```css
   @import "@duckmate/ui/styles.css";
   @source "../../../packages/ui/src";
   ```
3. `apps/web/app/layout.tsx` `<head>`:
   ```tsx
   <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
   <link rel="stylesheet" href={PRETENDARD_CDN_HREF} />
   ```
   `<html lang="ko" suppressHydrationWarning>` (다크 클래스 주입 대비).
4. `(app)/layout.tsx`: `<ToastProvider><TooltipProvider>…</TooltipProvider></ToastProvider>`.
5. `app/dev/ui/page.tsx`: `"use client"; import { DemoGallery } from "@duckmate/ui"; export default DemoGallery;` + noindex.
6. company(`apps/company`)는 2~3만 동일 적용하고 `<body className="bg-sand-50">` 고정(brand 결정 23).

### 4.2 컴포넌트 작성 규칙 (패키지에 추가할 때)
- 파일 1개 = 컴포넌트 1군. `React.forwardRef` + `displayName`. `className`은 항상 `cn()`으로 병합, 마지막 인자.
- `"use client"`는 상태·이벤트·Radix·`window` 접근이 있을 때만.
- 색은 시맨틱 토큰 클래스만. 새 HEX가 필요하면 `10_brand.md` → `styles.css @theme` → 사용.
- 텍스트 유틸은 타입 스케일 10종만 사용(`text-[13px]` 금지).
- 카피 리터럴은 최소화하고 기본값은 prop으로 덮어쓸 수 있게(`selectLabel`, `skipLabel`, `note`…). 서비스명 리터럴 금지.
- 아이콘은 `aria-hidden="true"`, 의미가 있으면 텍스트 또는 `aria-label` 동반.

## 5. 다크모드 적용법
- 기본: 아무것도 안 해도 OS 설정을 따른다(`@media (prefers-color-scheme: dark)` 블록이 `.light`/`data-theme="light"`가 없을 때 다크 토큰 적용).
- 강제: `<html class="dark">` / `<html class="light">` 또는 `data-theme`. `DemoGallery`의 토글이 이 방식.
- `color-scheme`을 토큰 블록에서 같이 바꾸므로 스크롤바·폼 컨트롤 네이티브 색도 따라온다.
- 컴포넌트 안 `dark:` 유틸은 스케일 색(코랄/바이올렛 소프트 칩)에만 쓰였다. 시맨틱 토큰만 쓰면 `dark:`가 필요 없다.
- 다크 대비 검증은 brand §2.5 D1~D13 표를 따른다(전부 AA).

## 6. 접근성 체크리스트 (컴포넌트 반영 상태)
- [x] 본문 텍스트 대비 ≥ 4.5:1 — 토큰 조합만 사용, muted 최소 #5C5650
- [x] 코랄 위 흰 글자 없음(`accent-foreground` = neutral-900)
- [x] 포커스 링 2px + offset 2px(`:focus-visible` 전역 + 컴포넌트별 `outline-ring`)
- [x] 터치 영역 ≥ 44px: 버튼 md 48 / icon 44 / 탭 64 / 닫기 44 / RadioCard 56 / 체크박스는 Label 행으로 확보(호출부)
- [x] 색만으로 의미 전달 금지: VerifyBadge(아이콘+텍스트), IntensityDots(aria-label+옵션 라벨), CompatGauge(`role=meter`+숫자), 겹침 칩(코랄+"겹치는 취미 n개" 텍스트)
- [x] `role`/`aria`: Dialog(Radix, 포커스 트랩·ESC), Sheet(동일), Progress/OnboardingProgress(`progressbar`+`aria-valuetext`), Toast(Radix `aria-live`), MatchReveal(`role=status aria-live=polite`), SafetyBanner(`status`/`alert`), Skeleton(`aria-hidden`, 래퍼 `role=status`), AppShell(`nav aria-label` + `aria-current=page` + 배지 sr-only)
- [x] reduce-motion: 전역 블록 + MatchReveal 즉시 완료 + flip-card transform 제거
- [x] 이미지: `DuckCard photos[].alt` 기본값 "{닉네임} 사진 n", Avatar `alt`/`aria-label`
- [x] 최소 글자 12px, 한글 `word-break: keep-all; overflow-wrap: anywhere`
- [ ] (호출부) 폼 오류는 `aria-describedby`로 연결, `invalid` prop과 함께 사용
- [ ] (호출부) 카드 뒤집기는 버튼과 탭 둘 다 제공(PRD §0-35)
- [ ] (호출부) 스켈레톤 300ms 지연 표시 / 2s 초과 안내 텍스트

## 7. 검증 결과
- `pnpm --filter @duckmate/ui typecheck` 통과(TS strict, `noUncheckedIndexedAccess`).
- `styles.css`를 Tailwind v4(`@tailwindcss/node` 4.3.3)로 컴파일해 `text-display`·`tnum`·`animate-skeleton`·`duration-(--duration-fast)`·`dark:` 변형·`pb-safe`·`flip-card`·reduce-motion 블록 생성 확인.
- lucide 0.544.0: brand §6.2 아이콘 12종 + `ShieldCheck`·`BadgeCheck`·`Sprout` 존재 확인. `Home`→`House`, `Loader2`→`LoaderCircle`로 대체(결정사항 8).
