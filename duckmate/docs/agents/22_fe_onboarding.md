# 22 — 온보딩 / 인증 UI (E1)

> 입력: `12_flows.md`(라우트·S1~S7 와이어·저장 규칙·이벤트 표), `15_auth.md`(서버 액션 시그니처·`ActionResult`·게이트), `11_design_system.md`, `10_brand.md`(카피 #1~#13), `06_PRD.md` §4.1, `20_notifications.md` §0-4.
> 산출물: `apps/web/{app/(public)/**, app/(onboarding)/**, components/onboarding/**, components/auth/**, stores/{session,onboardingDraft}.ts, lib/analytics/**}`, `docs/screenshots/web-*.png`, 이 문서. 모바일 375px 우선, `@duckmate/ui` 만 사용, 서버 page/layout + `*Screen.tsx` 클라이언트.

## 다음 에이전트에게 넘기는 결정사항

### 라우트·게이트 (E2~E4·G1)
1. **라우트 확정**: `/`(랜딩, 인덱싱 O) · `/login`(재방문 OTP = `PhoneOtpScreen mode="login"`) · `/onboarding/age`(S1) · `/onboarding/phone`(S2 가입 = `mode="signup"`) · `/onboarding/{basic,hobbies,quiz,card,photos}` · `/verify`(S7) · `/blocked/age` · `/suspended`. `/suspended` 는 라우트 그룹 4개 규칙(12_flows §0-1)을 지키려고 `app/(public)/suspended/page.tsx` 에 두었다(게이트는 `requireGate({kind:"status", route:"suspended"})`). `app/page.tsx` 스캐폴드는 삭제 → `app/(public)/page.tsx`.
2. **랜딩 CTA**: [시작하기] → `/onboarding/age`(S1), [이미 회원이에요] → `/login`. `/login` 에서 OTP 만 한 신규 사용자는 서버 `redirectTo:"/onboarding/age"` 로 와서 **로그인 상태 S1**(생년월일 + 동의 → `submitBirthDate`)을 거친다. 두 진입 모두 동작하므로 마케팅 링크는 어느 쪽을 써도 된다.
3. **세션 없이 렌더돼야 하는 화면**(`/`, `/login`, `/onboarding/age`, `/onboarding/phone`, `/blocked/age`)은 `lib/auth/session.requireGate()` 대신 **`components/auth/public-gate.ts` `gatePublic(target)`** 를 쓴다(`requireGate` 는 통과 후 세션이 없으면 `/login` 으로 보내 루프가 난다). 반환 `{user, state}` 로 로그인 여부를 분기한다. E2~E4 의 공개 화면(`/safety-guide` 등)도 같은 헬퍼 권장.
4. **온보딩 게이트 2단**: `app/(onboarding)/onboarding/(steps)/layout.tsx` 가 `requireGate({kind:"onboarding", step:"basic"})` 로 ①~⑤-a + 완료자 리다이렉트를 처리하고, 각 step page 가 `requireGate({kind:"onboarding", step})` 로 앞서가기를 막는다(Next layout 은 pathname 을 모름). 미들웨어가 1차 방어. `(onboarding)/layout.tsx` 는 noindex 만 소유.
5. **온보딩 → `/verify` → `/home` 전이는 풀 내비게이션(`window.location.assign`)** 이다(`finishPhotos`·`completeIdentityVerification` 성공 후). 다른 layout 그룹으로 넘어가며 게이트 캐시(`dm_gate` 쿠키 삭제 후) 재평가가 확실히 일어나게 하기 위함. 같은 그룹 안의 step 이동은 `router.replace(redirectTo)`.
6. **`/verify` 의 [프로필 먼저 다듬기] → `/me/edit`(E4)**. step `verify` 상태는 L1 라우트 접근 가능(15_auth §0-9)이므로 E4 는 `/me/*` 에서 L1 배너 "본인인증하고 추천 받기" → `/verify` 링크를 두면 된다. 푸시 권한 요청은 E1 화면 어디서도 하지 않는다(20_notifications §0-4: 첫 `/home` 소프트 배너는 E2).

### 공용 코드 (E2~E4 가 import)
7. **분석**: `import { track } from "@/lib/analytics/track"` — `track(event: AnalyticsEvent, props?: AnalyticsProps): void`. 이벤트명 union 은 12_flows §10 표 전부(`onboarding_*`, `verify_*`, `app_opened`, `daily_reco_*`, `reco_card_*`, `like_sent`, `pass_sent`, `match_screen_viewed`, `suggestion_*`, `message_*`, `conversation_reciprocated`, `report_submitted`, `block_submitted`, `mode_changed`, `account_*`, `push_*`). A2 의 `onb_*` 는 PRD §0-51 대로 `onboarding_step_completed{step}`·`onboarding_step_skipped{step}`·`onboarding_completed` 로 매핑. Phase 1 어댑터 = `window.dataLayer.push({event, ...props, session_id, source, push_slot, ts})` + 개발 환경 `console.debug`; 서버에서 호출하면 no-op, 절대 throw 하지 않음. `phone/nickname/birth_date/message/body/path/email` 키는 어댑터가 제거한다. 훅: `useTrackView(event, props)`(마운트 1회) · `useStepTimer()`(`duration_ms`), 순수 `stepTimer()`.
8. **session 스토어**: `useSessionStore` (`stores/session.ts`) = `{ state: GateState | null, hydrated, hydrate(), clear() }` + 셀렉터 `selectVerifyLevel/selectOnboardingStep/selectSanctionLevel`. **layout 이 `<SessionHydrator state={state} />`(`components/auth/SessionHydrator.tsx`) 로 hydrate** — `(app)/layout.tsx`(E2)도 `requireProfile()` 결과의 `state` 를 같은 컴포넌트로 넣으면 된다. 클라이언트는 verify_level·mode·status 를 바꾸지 않는다(서버 응답 후 `router.refresh()`).
9. **onboardingDraft 스토어**: `useOnboardingDraft` — `birthDate`·`ageGateAt` 만 sessionStorage(`dm_onboarding_draft`, zustand persist partialize), `basic/hobbies/card` 는 메모리(뒤로가기 프리필). 저장 성공 시 해당 슬롯 `null`, 로그아웃·AGE_BLOCKED 시 `clearAll()`.
10. **ActionResult 처리 훅**: `useActionResult()` (`components/onboarding/useActionResult.ts`) → `{ handle(res, {onSuccess, onFieldError, onRedirect, onFailure, push}), run(fn), pending, go(to) }`. 규칙 = 15_auth §0-1 그대로(`redirectTo` 무조건 이동 → `RATE_LIMITED` 토스트+`retryAfterSec` → `field` 인라인 → 나머지 토스트). `run()` 은 네트워크 예외를 `INTERNAL` 실패로 바꾼다. `safeNext()` 는 같은 오리진 경로만 허용. E2~E4 액션 호출부에서 재사용 권장.
11. **재사용 컴포넌트**: `OnboardingFrame`(진행 바 6칸 + 뒤로가기 + 헤드라인 + sticky footer, `FieldError`), `ConsentChecklist`(재동의 배너·설정 마케팅 토글에 재사용 가능, 순수 헬퍼는 `consents.ts`), `LegalFooterWeb`(서버, `config/company.ts` → `LegalFooter` 매핑 `companyToLegalInfo`), `LogoutButton`(signOut + 스토어 클리어), `VerifyScreen`(E4 `/settings/verify` 인증 센터에서 그대로 마운트 가능 — props `{devMode, verifier, callbackError?}`), `SuspendedScreen`(제재 4종 카피, `MyModerationState` 입력), `PhotosScreen` 의 업로드 파이프라인(`photo-utils.ts` `compressImage` → `createPhotoUploadUrl` → `uploadToSignedUrl` → `confirmPhotoUpload`)은 E4 `/me/photos` 가 복제 대신 import 해서 쓴다.
12. **참조 데이터 로더** `components/onboarding/data.ts` (서버 전용): `loadRegions()/loadHobbies()/loadQuiz()` — DB 공개 테이블 우선, 실패·빈 결과 시 시드 미러 상수(`regions.ts`·`hobbies.ts`·`quiz.ts`)로 폴백. E4 `/me/edit` 도 같은 로더를 쓰면 ID 가 DB 와 일치한다. `regionLabel(regions, code)` = 구 단위 표기, `ageBandOf(birthDate)` = "20대 후반".
13. **취미 slug 매핑**: DB `hobby_categories.slug`(`performance/gaming/reading/coding/pets`) ≠ `@duckmate/ui` `HOBBY_CATEGORIES.slug`(`fandom/game/book/code/pet`). `HobbyChip/HobbyAvatar/DuckCard.hobbies[].category` 에는 반드시 `uiCategorySlug(dbSlug)` (`components/onboarding/hobbies.ts`) 결과를 넘긴다. C2 에게: 다음 ui 개정 때 slug 를 DB 와 통일 요청.
14. **진행 바 표기 = 6칸 고정**(`OnboardingProgress total={6}`, `/onboarding/photos` 도 `current=6`), 라벨 `ONBOARDING_LABELS`(연령·휴대폰·기본·취미·퀴즈·덕질 카드). `/login` 과 `/verify` 는 진행 바 없음.
15. **동의 저장 형태**: 체크박스 3(약관·개인정보·청소년보호) + 선택 1(마케팅) + 전체 동의. `evidenceSnapshot` 은 약관 요약 3줄을 약관 행 아래 노출한 뒤 `terms` 와 같은 값으로 전송(`toConsentPayload`). 필수 사전 체크 없음. 법적 링크는 `/legal/{terms,privacy,youth}` 새 창(E4 라우트).
16. **Top3 순서 변경은 드래그가 아니라 [↑ 위로] 버튼**(선택 순서 = rank, 리스트에서 위로/빼기). 6번째 선택 시 토스트 "5개까지 고를 수 있어요". 몰입도 기본 2("가끔"), 시트 라벨은 `INTENSITY_LABELS`(ui) 단일 소스.
17. **mock 인증 UI**: 개발(`NODE_ENV≠production`)에서는 [인증하기] → simulate 셀렉트 모달(`success/fail/minor/duplicate`) → `completeIdentityVerification({token, simulate})`. 프로덕션 mock 은 모달 없이 즉시 complete, 실패 시 "지금은 초대된 번호만 인증할 수 있어요" 전체 화면(10_brand #13). `?error=NOT_CONFIGURED`(portone 미설정 콜백) → 인라인 배너 "지금은 인증할 수 없어요".
18. **제재 화면 분기**(`/suspended`): `getMySanctions().top.level` 3~5 = 정지 N일 + 해제 일시 + [이의신청](`canAppeal`) / 6·`banned` = 영구 + 개인정보처리방침 링크 / `MINOR_SUSPECT` 자동 제재 = 이의신청 불가 문구 / `pendingWarning`(level 1) 이 있으면 [확인했어요] → `acknowledgeSanction` → `/home`. 로그아웃 버튼 항상.
19. **WebOTP**: `/onboarding/phone`·`/login` 코드 단계에서 `navigator.credentials.get({otp:{transport:["sms"]}})` 시도(지원 브라우저만). SMS 본문 마지막 줄 `@{도메인} #{코드}` 형식은 D 그룹 Supabase SMS 템플릿 설정 필요(미설정 시 수동 입력).

### G1 (E2E) — testid 와 시나리오 순서
20. **testid 목록**: 랜딩 `landing`·`landing-start`·`landing-login` / S1 `age-screen`·`birth-year`·`birth-month`·`birth-day`·`onb-next`·`age-login-link`·`age-minor` / S2·로그인 `phone-screen`|`login-screen`·`phone-input`·`otp-request`·`otp-input`·`otp-resend`·`otp-change-phone`·`consent-all`·`consent-terms`·`consent-privacy`·`consent-youth`·`consent-marketing`·`onb-next`·`login-new-link` / S3 `basic-screen`·`nickname-input`·`gender-{female|male|unspecified}`·`region-sido`·`region-sigungu`·`availability-grid`·`avail-{weekday1..7}-{morning|afternoon|evening|night}`·`avail-quick-weekday-evening`·`avail-quick-weekend-day`·`onb-next` / S4 `hobbies-screen`·`hobby-search`·`hobby-search-results`·`hobby-cat-{dbCategorySlug}`·`hobby-more`·`hobby-subchips`·`hobby-chip-{hobbySlug}`·`hobby-sheet`·`intensity-{1..5}`·`fav-note-input`·`hobby-selected`·`hobby-selected-{slug}`·`hobby-edit-{slug}`·`hobby-up-{slug}`·`hobby-remove-{slug}`·`onb-next` / S5 `quiz-screen`·`quiz-q-{id}`·`quiz-choice-{1..4}`·`quiz-prev`·`quiz-later` / S6-a `card-screen`·`card-preview`·`card-fav-note`·`card-now-into`·`card-example-chip`·`onb-next` / S6-b `photos-screen`·`photo-file-input`·`photo-add`·`photo-grid`·`photo-tile-{i}`·`photo-remove-{i}`·`photos-later`·`onb-next` / S7 `verify-screen`·`verify-start`·`verify-later`·`verify-mock-dialog`·`verify-simulate`·`verify-simulate-{success|fail|minor|duplicate}`·`verify-simulate-confirm`·`verify-error`·`verify-{not_allowlisted|duplicate|blocked}`·`verify-back`·`verify-prod-mock-note` / 상태 `blocked-age`·`blocked-home`·`suspended-{3|4|5|permanent}`·`sanction-ack`·`sanction-appeal`·`logout` / 공통 `onb-back`.
21. **G1 P1 시나리오 순서**: `/` → `landing-start` → S1(`birth-*` 성인 → `onb-next`) → S2(`phone-input` 시드 번호 `821000000001` → `otp-request` → `otp-input` `000001` → `consent-all` → `onb-next`) → S3(`nickname-input`·`gender-*`·`region-sido` 11 → `region-sigungu` 11440 → `avail-quick-weekday-evening` → `onb-next`) → S4(`hobby-cat-performance` → `hobby-chip-idol` → `intensity-4` → `fav-note-input` → 시트 닫기 → 칩 2개 더 → `onb-next`) → S5(`quiz-choice-*` ×10 자동 완료 또는 `quiz-later`) → S6-a(`card-now-into` → `onb-next`) → S6-b(`photos-later`) → `/verify`(`verify-start` → `verify-simulate` success → `verify-simulate-confirm`) → `/home`. 실패 경로: `verify-simulate-minor` → `/suspended`(`suspended-permanent`), `verify-simulate-duplicate` → `verify-duplicate`, S1 `2010-01-01` → `age-minor`, 재로그인 `/login` → `login-screen`.
22. **분석 검증**: `window.dataLayer` 에서 `event` 이름을 읽으면 된다(Playwright `page.evaluate(() => window.dataLayer)`). 온보딩 순서 = `onboarding_step_completed{step: age_gate → phone → basic + availability → hobbies → quiz|skipped → card → photos|skipped}` → `onboarding_completed` → `verify_gate_viewed` → `verify_succeeded|verify_failed`.

### D 그룹 (lib 수정·요청)
23. **`app/(auth)/actions.ts` 최소 수정(E1)**: `export const OTP_RESEND_AFTER_SEC = 30` → `const`(export 제거). `"use server"` 파일은 async 함수만 export 할 수 있어 클라이언트 컴포넌트가 이 파일을 import 하는 순간 빌드가 깨졌다(D2 빌드에는 호출자가 없어 드러나지 않음). 값은 이미 `requestOtp` 응답 `resendAfterSec` 로 전달되므로 외부 참조 없음.
24. **D 그룹 요청**: (a) `get_gate_state()`·`getOnboardingSnapshot()` 은 온보딩 page 마다 호출된다(React cache 로 요청당 1회) — 문제 없음. (b) `photos` 버킷 소유자 read 정책이 없으면 재진입 시 기존 사진 썸네일이 플레이스홀더로 보인다(`createSignedUrls` 실패 무시). (c) WebOTP 용 SMS 템플릿(결정 19).
25. **E4 요청**: `config/company.ts` 를 그대로 `LegalFooterWeb` 이 읽는다 — 값 채우면 랜딩 푸터 자동 반영. `SERVICE_NAME` 도 `components/onboarding/copy.ts` 가 `@/config/company` 에서 re-export. `config/site.ts` 를 따로 만들면 그 파일에서 re-export 로 1줄 교체.

---

## 1. 화면 표

| 라우트 | 파일(page → Screen) | 게이트 | 서버 액션 | 이벤트 |
|---|---|---|---|---|
| `/` | `(public)/page.tsx` (서버, Screen 없음) | `gatePublic(public)` + 로그인 시 `homeFor` | — | — |
| `/login` | `(public)/login/page.tsx` → `PhoneOtpScreen mode=login` | `gatePublic(auth/login)` | `requestOtp`·`verifyOtp({phone,token})` | `onboarding_step_completed{phone}`(isNew 만) |
| `/onboarding/age` | `(onboarding)/onboarding/age/page.tsx` → `AgeScreen{loggedIn}` | `gatePublic(auth/age)` | 로그인 시 `submitBirthDate` | `onboarding_step_completed{age_gate}` |
| `/onboarding/phone` | `…/phone/page.tsx` → `PhoneOtpScreen mode=signup` | `gatePublic(auth/phone)` + 로그인 시 `/onboarding/age` | `requestOtp`·`verifyOtp(+birthDate,consents)` | `onboarding_step_completed{phone}` |
| `/onboarding/basic` | `(steps)/basic/page.tsx` → `BasicScreen` | layout + `requireGate(onboarding/basic)` | `saveBasic` | `{basic}`·`{availability}` |
| `/onboarding/hobbies` | `HobbiesScreen` | `requireGate(onboarding/hobbies)` | `saveHobbies` | `{hobbies, hobby_count}` |
| `/onboarding/quiz` | `QuizScreen` | `requireGate(onboarding/quiz)` | `saveQuizAnswers`(문항마다)·`finishQuiz` | `{quiz}` / `onboarding_step_skipped{quiz, answered}` |
| `/onboarding/card` | `CardScreen` (DuckCard 미리보기) | `requireGate(onboarding/card)` | `saveCard` | `{card}` |
| `/onboarding/photos` | `PhotosScreen` | `requireGate(onboarding/photos)` | `createPhotoUploadUrl`·`confirmPhotoUpload`·`deletePhoto`·`finishPhotos` | `{photos}`/`skipped{photos}` + `onboarding_completed` |
| `/verify` | `(onboarding)/verify/page.tsx` → `VerifyScreen` | `requireGate(verify)` | `startIdentityVerification`·`completeIdentityVerification` | `verify_gate_viewed`·`verify_succeeded`·`verify_failed` |
| `/blocked/age` | `(public)/blocked/age/page.tsx` (서버 + `LogoutButton`) | `gatePublic(auth/blocked_age)` | `signOut` | — |
| `/suspended` | `(public)/suspended/page.tsx` → `SuspendedScreen` | `requireGate(status/suspended)` + `getMySanctions()` | `acknowledgeSanction`·`signOut` | — |

카피는 전부 `components/onboarding/copy.ts`(10_brand #1~#13 확정본 + 12_flows 문구, 해요체). 접근성: 모든 입력 `<Label>`/`aria-label`, 오류 `role=alert` + `aria-describedby`, 진행 바 `progressbar`, 시간대 그리드 `aria-pressed` 버튼 표, 퀴즈 문항 전환 시 제목 포커스, 시트/다이얼로그는 Radix 포커스 트랩.

## 2. 상태·저장 규칙 구현
- 서버 저장은 "다음"(액션) 시점, 퀴즈는 답변마다 upsert, 사진은 업로드 즉시 — 12_flows §0-10 그대로.
- 재진입: 각 page 가 `getOnboardingSnapshot()` 으로 프리필. 뒤로가기(S4→S3 등)는 `onboardingDraft` 메모리 → 없으면 스냅샷.
- 오류 코드 처리: `AGE_BLOCKED`(redirectTo `/blocked/age`, 드래프트 삭제) · `RATE_LIMITED`(토스트 "요청이 많아요. 1시간 후…") · `INVALID_INPUT field=token|nickname|consents|nowInto|favNote|hobbies.N.favNote`(인라인) · `CONFLICT`(닉네임 중복 인라인) · `ONBOARDING_INCOMPLETE`(redirectTo) · `MINOR`(→ `/suspended`) · `NOT_ALLOWLISTED/DUPLICATE_CI/BLOCKED_CI`(전체 화면) · `IDENTITY_FAILED/NOT_ENTITLED`(배너).

## 3. 검증 결과 (2026-09-02)

| 항목 | 결과 |
|---|---|
| `vitest run components/onboarding lib/analytics` | 4 파일 15 테스트 통과(지역 80행·코드 패턴·수도권 우선, 취미 12×5=60·UI slug 매핑·검색, 만 나이 KST 경계·연령대·날짜 검증·번호 포맷·동의 페이로드·퀴즈 10문항 규칙, track no-op/timer) |
| `tsc --noEmit` (apps/web 전체) | **E1 경로 오류 0**. 남은 오류는 다른 E 에이전트 작업 중 파일(`components/chat/*`, `app/(app)/me/photos` 미완성 import)과 삭제된 `app/page.tsx` 를 가리키는 stale `.next/types`(다음 빌드에서 사라짐) |
| `next build` | 저장소 `apps/web` 는 E3/E4 미완성 파일 때문에 실패 → E1 경로 + D lib 만 담은 격리 복사본(`apps/web-e1check`, 빌드 후 삭제)에서 **성공**: `/`, `/login`, `/blocked/age`, `/onboarding/{age,phone,basic,hobbies,quiz,card,photos}`, `/verify`, `/suspended` 전부 컴파일·타입체크 통과(env 미설정). First Load JS 142~219kB(photos 219kB = supabase-js 클라이언트) |
| `next start` + Playwright(chromium 1194, 375×812) | 비로그인 `/` `/login` `/blocked/age` `/onboarding/age` `/onboarding/phone` 200 렌더 · `/verify` `/suspended` `/onboarding/basic` 는 `/login?next=` 307 · S1 성인 입력 → S2 이동 + `dataLayer` `onboarding_step_completed` 확인 · S1 미성년 → 안내 상태 · Supabase 없이 OTP 요청 → 토스트(크래시 없음) → `docs/screenshots/web-{landing,login,blocked-age,onboarding-age,onboarding-phone}.png` |
| 카피 가드 | E1 경로 grep `덕메이트`(리터럴)·`탈락`·`회원님`·`습니다` = 0 (주석 제외) |
| 비밀값·서버 전용 import | `"use client"` 파일에서 `serverEnv`/`admin.ts` import 0. `/verify` page 는 `process.env.IDENTITY_VERIFIER` 를 `mock|portone` 구분값으로만 클라이언트에 넘김 |

미실행: Supabase 연결 상태의 온보딩 6화면·사진 업로드·본인인증 실제 왕복(로컬 Supabase 없음). G1 이 결정 21 시나리오로 확인.

## 4. lib 수정 기록
- `apps/web/app/(auth)/actions.ts`: `export const OTP_RESEND_AFTER_SEC` → `const` (결정 23). 그 외 `lib/**` 무수정.
