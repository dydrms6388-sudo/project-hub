# 23 — 홈 / 추천 / 매칭 리빌 화면 (E2)

> 입력: `12_flows.md`(§0-3 게이트 순서·§1 라우트·§3 홈/추천/루프 끝·§3.5 카드 상태도·§4 매칭·§8 공용 상태·§10 이벤트), `16_matching.md`(D3 시그니처·에러 코드·suggestion 흐름), `15_auth.md`(`requireProfile`·`ActionResult`), `11_design_system.md`(DuckCard·CompatGauge·MatchReveal·SuggestionCard·SafetyBanner·AppShell·Sheet), `10_brand.md`(§4.5 카피 #14~#22, 금지 표현), `03_core_loop.md`(Phase 1 루프·07:00 정적 텍스트), `06_PRD.md`(§4.2·§4.3·§6.1), `05_trust_safety.md`(§10.1 문구), `17_chat.md`(`sendMessage`).
> 산출물: `apps/web/app/(app)/layout.tsx`, `app/(app)/{home,reco,reco/done,match/[id]}/page.tsx`, `app/(app)/{home,reco,match}/actions.ts`, `app/(app)/reco/photos.ts`, `app/dev/discover/*`, `components/discover/*`, `stores/reco.ts`(+test), `docs/screenshots/web-{reco,match,home,reco-done,reco-sheet,match-safety}.png`, 이 문서.
> 기준일 2026-09-02. 모바일 375px. Supabase 미연결 상태에서 목 데이터 라우트로 렌더·스모크 검증(§4). git commit 없음, 비밀값 없음.

## 다음 에이전트에게 넘기는 결정사항

### 라우트 · 게이트 계약 (E3·E4 공통)
1. **`(app)/layout.tsx` 는 `requireProfile(1)`** 로 ①~⑤(온보딩 완료)까지만 서버에서 본다. L2 라우트(`/home`·`/reco`·`/match/*`·`/chat/*`)의 ⑥(`/verify`)은 미들웨어 `classifyRoute`(`ROUTE_MIN_LEVEL`) 가 1차 판정하고, **각 페이지가 `await requireProfile(2)` 로 DB 를 다시 본다**(E3 `/chat` 페이지도 같은 한 줄이 필요). layout 이 pathname 을 알 수 없어 L1 라우트(`/me`·`/settings`, E4)와 공존하려면 이 구조가 유일하다.
2. **L1 상태(verifyLevel<2)에서는 하단 탭을 렌더하지 않고** 상단 "본인인증하고 추천 받기 [인증하기]" 고정 배너(`data-testid=frame-l1-banner`)를 띄운다(12_flows §1). E4 의 `/me`·`/settings` 화면은 탭 없음을 전제로 레이아웃한다.
3. **하단 탭 = `DEFAULT_APP_TABS` 4개(홈 `/home` · 채팅 `/chat` · 프로필 `/me` · 설정 `/settings`)**, Next `<Link>` 주입(`renderLink`), `data-testid=tab-{home|chat|me|settings}`. 활성 탭은 `activeTabOf(pathname)`(`components/discover/AppFrame.tsx`): `/chat*`·`/match*` → chat, `/me*`·`/profile*` → me, `/settings*`·`/report*`·`/appeal*` → settings, 그 외 home. **`/chat/[id]`·`/match/[id]` 는 풀스크린(탭 숨김)** — `isFullscreenPath()`. E3 는 방 화면에서 탭을 따로 숨길 필요 없다.
4. **채팅 탭 배지** = layout 이 `getChatList()`(E3/D4 `get_chat_list`) 를 서버에서 1회 호출해 `unread_count` 합산(실패·L1 = 0). 실시간 갱신은 하지 않는다(라우트 이동마다 서버 재계산). E3 가 방 안에서 `markRead` 하면 다음 네비게이션에 반영된다.
5. **제재/모드 배너(layout)**: `state.sanctionLevel>0` 일 때만 `getMySanctions()` 호출. level 1 `pendingWarning` → 확인 필수 모달(`frame-warning-modal`, `acknowledgeSanction`) / level 2 → `SafetyBanner warn` "채팅·좋아요가 24시간 제한됐어요 · 사유 · 해제 시각"(`frame-sanction-banner`) / `mode==='dating'` → 상단 배지 "데이팅 모드 · 친구 모드 매칭·대화는 그대로 유지돼요"(`frame-mode-banner`). level ≥3 은 게이트 ③이 `/suspended` 로 보내므로 여기 오지 않는다.
6. **noindex**: `(app)/layout.tsx` `metadata.robots = { index:false, follow:false, nocache:true }` (→ `<meta name="robots" content="noindex, nofollow, nocache">`), 각 페이지도 `robots` 를 반복 선언(`scripts/check-noindex.mjs` 가 페이지 단위로 검사해도 통과). `export const dynamic = "force-dynamic"`.
7. **라우트**: `/home`(홈) · `/reco`(카드 스택; 오늘 카드가 있고 `remaining===0` 이면 서버에서 `/reco/done` 으로 redirect) · `/reco/done`(루프 끝; `reco_remaining>0` 이면 `/reco` 로) · `/match/[id]`(당사자 아님·없음 → `notFound()`) · `/likes` **없음**(Phase 3 E4 `/likes-you`). `/profile/[id]` 는 만들지 않았다 — 추천 카드의 상대 상세는 bottom `Sheet`(`profile-sheet`) 로 해결(§0-13). E4 가 `/profile/[id]` 를 만들면 `RecoCardItem.onOpenProfile` 만 라우팅으로 바꾸면 된다.

### 데이터 · 서버 액션 (D3 위에 얹은 얇은 층)
8. **클라이언트가 부르는 D3 쿼리는 전부 `app/(app)/*/actions.ts`("use server") 로 감쌌다**: `fetchTodayRecommendations()`(`getTodayRecommendations` + `getSuperlikeStatus` + 사진 서명 URL 1h + `entitlementsFor(tier).undo` → `TodayView`), `fetchHomeView()`(`getHomeSummary` + 채팅 미답장 수 + 매칭 수 + `safety_modal_seen_at` → `HomeView`), `fetchMatchView(matchId)`(`getMatch` 자기 치유 포함 + 양쪽 `profile_hobbies` + 내 `regions` + 상대 승인 사진 → `MatchView`). `lib/matching/queries.ts` 는 `server-only` 라 클라이언트에서 직접 import 하지 않는다(타입만 `import type`).
9. **화면 → API 표면 = `DiscoverApi`**(`components/discover/types.ts`) 하나. 기본 구현 `serverApi`(`components/discover/api.ts`: `actOnRecommendation/markRecommendationSeen/undo`(D3) · `sendMessage`(D4) · `blockProfile`(D5) · 위 액션 3개), 개발 라우트는 `createMockApi()`(`mock.ts`). 새 화면/테스트는 `api` prop 만 주입하면 된다.
10. **TanStack Query 키**: `['reco', loopDate]` · `['home']` · `['match', matchId]` · **`['matches']`(E3 채팅 목록 키와 동일 — 매칭 성사·첫 메시지 전송 후 E2 가 invalidate 한다)**. 서버 페이지가 `initialData` 를 넘기므로 첫 렌더에 클라이언트 재조회 없음. Zustand 는 `stores/reco.ts`(현재 인덱스·마지막 액션·undo 타이머)만.
11. **사진 서명 URL** 은 `app/(app)/reco/photos.ts`(`server-only`, "use server" 아님) `signPhotoPaths(paths)` — 사용자 권한 클라이언트 `storage.createSignedUrls` → storage RLS(approved + `can_view_profile`) 가 최종 방어선. E4 `/me/photos`·E3 프로필 보기에서 재사용 가능.
12. **`safety_modal_seen_at` 전용 RPC 는 없다**(D1 §0-10 사용자 권한 update 컬럼) → `markSafetyModalSeen()`(`app/(app)/home/actions.ts`) 이 `profiles` 를 `is('safety_modal_seen_at', null)` 조건으로 update(멱등). 모달은 **매칭 화면(첫 매칭 = `v_my_matches` 1건)** 에 노출하고, 홈에서도 `매칭 ≥1 && seen null` 이면 보완 노출(상대가 먼저 매칭 화면을 연 레이스 흡수).

### 추천 카드 · 액션 · 에러
13. **카드 스택 = 세로 스냅 스크롤(`snap-y snap-mandatory`), 스와이프 제스처 없음**(PRD §5.2). 카드 = `DuckCard`(궁합 % `scorePercent` · `reasons[0..1].label` · `slot_overlap.label` → 시간대 겹침 · `region_same{level:sigungu}` → 같은 구 · "같이 할 수 있는 것" = 1순위 공통 취미 `"{취미} 같이 하기"` · 입문 환영은 DuckCard 자동) + 사진 스트립 아래 + 버튼 3개. `is_from_liker/is_boosted` 는 RecoCard 에 애초에 없다.
14. **seen 처리** = `IntersectionObserver` threshold 0.5 + 1초 dwell → `markRecommendationSeen` 1회(카드별 ref 가드, `seenAt` 있으면 skip) + `reco_card_seen{position, score_bucket, target_id_hash}`. 목록 조회만으로 seen 처리하지 않는다(16_matching §0-5).
15. **액션 흐름**: 패스/좋아요 = 낙관적 제거 → 실패 시 복구, 슈퍼라이크 = 응답 후 제거(쿼터 실패가 흔함). 성공 → `stores/reco` `acted` + `like_sent{type, position, reasons_shown}`/`pass_sent{position}`; `matched=true` → (`matchCreated` 면 `match_created{initiator:'me'}`) → `router.push('/match/'+matchId)`. 마지막 카드 처리 후 `router.replace('/reco/done')`.
16. **에러 코드 → UX 는 `components/discover/errors.ts mapFailure()` 단일 함수(vitest 8)**: `redirectTo` 우선 → `NOT_VERIFIED`→`/verify`, `SANCTIONED`→`/suspended`(채팅 전송만 토스트), `NOT_AUTHENTICATED`→`/login`, `NOT_ENTITLED field=superlike` → 카드 안 인라인(`reco-inline-superlike`, 구매 안내 없음), `NOT_ENTITLED`(undo) → "되돌리기는 플러스에서 쓸 수 있어요" 인라인, `ALREADY_ACTED` → 조용히 `['reco']` invalidate, `NOT_FOUND` → 문구 + invalidate, `RATE_LIMITED` → 토스트 "(N초 후)". E3/E4 도 같은 함수를 써도 된다(`surface` 인자).
17. **되돌리기(Phase 1 무료)**: `TodayView.canUndo=false` → 바(`reco-undo-bar`)는 마지막 액션 뒤 300초 카운트(`m:ss`, `.tnum`)만 보여주고 버튼은 **비활성 + "플러스에서" 한 줄**(`reco-undo-note`). 카운트다운은 사실 안내이며 압박 카피·결제 링크 없음(10_brand §4.4). 매칭된 좋아요는 타이머 자체를 만들지 않는다. `get_effective_tier` 가 plus 를 주면 자동으로 활성.
18. **빈 상태/부족**: 카드 0 → `EmptyState` "이 지역엔 아직 사람이 적어요 / 내일 07:00에 다시 추천해요…" + [카드 다듬기 → `/me/edit`]. `short=true`(0 < n < limit) → 스택 끝에 점선 카드 "이 지역/취미에 아직 사람이 적어요 · 내일 07:00 다시 추천해요"(재노출로 채우지 않음). 07:00 은 어디서나 **정적 텍스트 `RESET_TEXT`**, 카운트다운 없음.

### 매칭 화면
19. **순서 고정**: (첫 매칭이면 `SafetyGuideModal` — 05 §10.1 문구 그대로, X 없음, ESC/바깥 탭 차단) → `MatchReveal variant="simple"`(내/상대 `DuckCard compact`, `overlapLabels` = 공통 취미 이름) → 제안 카드 3장 가로 스냅(`suggestion-card-1..3`) → 선택 시 **`sendMessage({matchId, body: card.body})`**(E3/D4) 로 첫 메시지 자동 전송 → `suggestion_selected{template_id, kind, position}` → `/chat/[matchId]`. **`send_first_message(match_id, suggestion_id)` RPC 는 D4 가 만들지 않았으므로 `messages.suggestion_template_id` 는 기록되지 않는다** → D4 에 `sendMessage({..., suggestionTemplateId})` 옵션 추가 요청(§5).
20. **[건너뛰고 채팅하기]** → `suggestion_skipped` → `/chat/[matchId]`(E3 방 상단에 접힌 카드 3장 재노출), **✕ 닫기** → `/chat`. `first_message_at` 이 이미 있으면 카드 대신 [대화 보기]. 리빌 앞뒤에 광고·결제 유도 없음, `prefers-reduced-motion` 은 MatchReveal 이 즉시 완료.

### 공용 컴포넌트 (E3/E4 재사용)
21. `components/discover/`: `AppFrame`(프레임·탭·배너) · `PersonCard`(`CardPerson` → `DuckCard`) · `ProfileSheet`(전체 카드·사진·신고 `/report?target=&surface=profile`·차단) · `BlockConfirmDialog`(12_flows §7.4 문구, `api.block` 주입, `surface` 로 `block_submitted` 발화 — E3 방 ⋮ 차단에 그대로) · `SafetyGuideModal`(`SAFETY_GUIDE` 상수) · `format.ts`(`AGE_BAND_LABELS`·`ageBandOf`·`regionLabel`·`DB_TO_UI_CATEGORY`(DB `performance/gaming/reading/coding/pets` ↔ UI `fandom/game/book/code/pet`)·`toDuckCardHobbies`) · `errors.ts` · `track.ts`(`idHash`).
22. **E2E 훅 `data-testid`**(§3 표): `home`·`home-cta`·`home-pending`·`home-matches`·`home-unanswered`·`home-likers` / `reco-header`·`reco-stack`·`reco-card`(+`data-position`·`data-reco-id`)·`reco-pass`·`reco-like`·`reco-super`·`reco-open-profile`·`reco-inline-superlike`·`reco-undo-bar`·`reco-undo`·`reco-undo-note`·`reco-short`·`reco-empty` / `reco-done`·`done-chat`·`done-edit` / `match-screen`·`match-reveal`·`match-suggestions`·`suggestion-card-{1..3}`·`match-skip`·`match-close`·`match-open-chat` / `profile-sheet`·`profile-report`·`profile-block`·`block-dialog`·`block-confirm` / `safety-modal`·`safety-confirm` / `tab-{home,chat,me,settings}`·`frame-l1-banner`·`frame-sanction-banner`·`frame-mode-banner`·`frame-warning-modal`.
23. **G1(P1 시나리오) 클릭 경로**: 서윤 로그인 → `/home` `[home-cta]` → `/reco` `[reco-card][data-position="1"] [reco-like]`(민재) → `/match/{id}` (`safety-modal` → `safety-confirm`) → `suggestion-card-3 button` → `/chat/{id}`(E3, 첫 메시지 = 카드 본문). 시드는 서윤↔민재 상호 추천(16_matching §7-4). 상대(민재) 화면은 `/chat/{id}` 수신(E3).
24. **개발 라우트 `/dev/discover?screen=reco|match|home|done[&safety=1]`**(`NODE_ENV==='production'` → 404): `createMockApi()` 로 화면·액션 전부 동작(좋아요(민재) → `/match` 이동, 슈퍼라이크 2회째 인라인 사유, undo 는 `NOT_ENTITLED`). 라우팅은 `onNavigate` 콜백으로 대체해 화면 안에 "navigate → …" 로 표시. Playwright 스크린샷·스모크는 이 라우트로 한다(§4).

### lib / 공용 파일 수정 기록
25. **`apps/web/package.json` 에 `"lucide-react": "0.544.0"` 추가**(`packages/ui` 와 동일 고정 버전). 11_design_system §0-9 "앱에서 직접 lucide 사용" 이 전제인데 web 에 직접 의존성이 없어 E1·E3·E4 파일도 `Cannot find module 'lucide-react'` 였다. `pnpm install --offline` 으로 링크(lockfile 갱신). `lib/**`·`app/layout.tsx`·`providers.tsx`·`globals.css` 는 수정하지 않았다.

---

## 1. 파일 구성

| 경로 | 내용 |
|---|---|
| `app/(app)/layout.tsx` | `requireProfile(1)` 게이트 · noindex · 채팅 배지(서버 1회) · 제재/모드 정보 → `AppFrame` |
| `app/(app)/home/page.tsx` · `actions.ts` | 홈 서버 페이지(`requireProfile(2)`) · `fetchHomeView` · `markSafetyModalSeen` |
| `app/(app)/reco/page.tsx` · `actions.ts` · `photos.ts` · `done/page.tsx` | 추천 페이지(전부 acted → `/reco/done`) · `fetchTodayRecommendations` · 서명 URL · 루프 끝 |
| `app/(app)/match/[id]/page.tsx` · `actions.ts` | 매칭 페이지(`notFound`) · `fetchMatchView` |
| `app/dev/discover/page.tsx` · `DevDiscover.tsx` | 개발 전용 목 렌더(프로덕션 404) |
| `components/discover/AppFrame.tsx` | AppShell + 탭 판정 + L1 배너 + 제재 모달/배너 + 모드 배지 |
| `components/discover/HomeScreen.tsx` | 요약 카드 4 + CTA + 빈 상태 + 안전 모달(보완) |
| `components/discover/RecoScreen.tsx` · `RecoCardItem.tsx` | 스택·헤더·undo 바·시트 / 카드 1장 + IO seen + 버튼 3 |
| `components/discover/RecoDoneScreen.tsx` | 루프 끝(이벤트 2종 1회) |
| `components/discover/MatchScreen.tsx` | 안전 모달 → 리빌 → 제안 3장 → 첫 메시지 전송 |
| `components/discover/{PersonCard,ProfileSheet,BlockConfirmDialog,SafetyGuideModal}.tsx` | 공용 |
| `components/discover/{types,api,mock,format,errors,track}.ts` (+`errors.test.ts`) | 계약·바인딩·목·포맷·에러 매핑·이벤트 |
| `stores/reco.ts` (+`reco.test.ts`) | `recoReducer`·`undoRemainingSec`·`formatCountdown`·`useRecoStore` |

## 2. 화면 표

| 라우트 | 화면 | 서버 데이터 | 상태·분기 | 이벤트 |
|---|---|---|---|---|
| `/home` | 오늘 · 날짜 / 오늘의 추천 카드(남은 n, CTA) / 요약 4(결과 대기·새 매칭·미답장·나를 좋아한 사람 — 숫자만, 블러·유료 안내 없음) / 슈퍼라이크 잔여 | `fetchHomeView` | `reco_total=0` → 추천 부족 카피 + [카드 다듬기] · `remaining=0` → [오늘 결과 보기] · 매칭 0 → EmptyState "아직 매칭이 없어요" · 안전 모달(보완) | (`app_opened` 는 E5) |
| `/reco` | 헤더 n/5 + 점 진행 / undo 바 / 카드 스택 / short 카드 / 프로필 시트 | `fetchTodayRecommendations` | 0장 → EmptyState · 전부 acted → `/reco/done` · 액션 실패 매핑(§0-16) | `daily_reco_opened` · `reco_card_seen` · `like_sent` · `pass_sent` · `match_created` |
| `/reco/done` | "오늘 N명을 모두 봤어요" · 결과 대기/매칭 · "내일 07:00에 새 추천이 와요" · [채팅으로 가기] · 매칭 0이면 [덕질 카드 다듬기] | `fetchHomeView` | 광고·타이머·스트릭 없음 | `daily_reco_exhausted` · `daily_loop_completed`(loop_date 당 1회) |
| `/match/[id]` | 안전 모달(첫 매칭) → 리빌(두 카드·겹침 점등·"매칭됐어요 🎉") → "{닉네임}님도 좋아요를 보냈어요. 겹치는 취미 k개." → 제안 3장 → [건너뛰고 채팅하기] | `fetchMatchView` | `first_message_at` 있음 → [대화 보기] · 상대 null → 대체 박스 | `match_screen_viewed` · `suggestion_shown` · `suggestion_selected` · `suggestion_skipped` |
| 시트 | 전체 덕질 카드(Top3+나머지 취미·몰입도·소개·사진) · [신고] [차단] | — | 차단 성공 → 카드 제거 + `['reco']` invalidate | `block_submitted{surface:profile}` |

카피 출처: 10_brand §4.5 #14(홈) #15(추천 부족) #16(매칭 0) #18(루프 끝) #19(매칭 성공) #20(안전 모달, A5 원문) #22(슈퍼라이크 소진, D3 문구). 서비스명 리터럴 없음.

## 3. 상태 · 이벤트 대응 (12_flows §3.5 카드 상태도)

| 상태 | 구현 |
|---|---|
| unseen → seen | `RecoCardItem` IO 50%·1s → `api.seen` (`seenAt` 있으면 옵저버 미부착) |
| seen → passed/liked | `onAct` 낙관적 제거 → `stores/reco acted` → 실패 시 복구 |
| liked → matched | 응답 `matched` → `/match/[id]` (`firstSuggestion` 은 `fetchMatchView` 가 다시 읽음 — 응답 동봉분은 사용하지 않음, 1회 추가 조회) |
| liked → pending | 홈 "결과 기다리는 중" = `pending_results` |
| 모두 acted | `/reco/done` |
| flipped | Phase 1 미구현 — 사진은 카드 아래 스트립 + 시트(11_design §0-11 "2면은 E2 구현" 은 스트립/시트로 대체, `reco_card_flipped` 미발화) |

## 4. 검증 결과 (2026-09-02)

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` (apps/web) | **E2 경로 오류 0**. 남은 오류는 타 에이전트 진행 중 파일(`components/chat/*` 2건, `app/(app)/me/edit` 누락 모듈 1건)과 stale `.next/types` |
| `vitest run components/discover stores` | 15 통과 (`errors.test.ts` 8 · `reco.test.ts` 7) |
| `next build` (레포 그대로) | 타 에이전트 파일에서 실패: `app/(auth)/actions.ts` "use server" 파일의 const export(E1/D2), `app/(app)/me/photos` 누락 모듈(E4), `app/dev/chat` 누락 모듈(E3) — E2 경로 원인 아님 |
| `next build` (E2 + 공용 파일만 남긴 격리 복사본 `apps/web-e2check`, 검증 후 삭제) | **성공 (EXIT 0)** — `/home` `/reco` `/reco/done` `/match/[id]` 동적 라우트 + `/dev/discover`(프로덕션 = 404 정적) 컴파일·타입검사 통과, Middleware 110 kB |
| Playwright(375×812, DPR2, `/dev/discover`) | `web-reco.png`(카드 스택·궁합 78%·이유 2줄·시간대·버튼 3) · `web-match.png`(리빌 두 카드·겹침 태그·제안 3장) · `web-home.png` · `web-reco-done.png` · `web-reco-sheet.png`(프로필 시트) · `web-match-safety.png`(안전 모달) 저장. 콘솔 오류는 Pretendard CDN(프록시 차단)뿐 |
| 스모크(목 API) | 카드 4장 로드 → 슈퍼라이크 1회 성공(카드 3장, 잔여 0 → 버튼 비활성) → undo 바 "되돌리기는 플러스에서 쓸 수 있어요" + 버튼 비활성 → 프로필 시트 → 차단 모달 표시 → 좋아요(민재) → `navigate → /match/{id}`; dataLayer: `daily_reco_opened, like_sent(super), reco_card_seen×2, like_sent, match_created`. 매칭 화면(`safety=1`): 안전 모달 → 확인 → 제안 3장 → 3번 선택 → `navigate → /chat/{id}`; `match_screen_viewed, suggestion_shown, suggestion_selected` |
| 비밀값·서비스명 리터럴 grep (E2 경로) | 없음 |

미실행: Supabase 실연결(게이트·RLS·서명 URL·`ensure_today_recommendations`)·실제 `sendMessage` 왕복 — G1 E2E 에서 확인 필요.

## 5. 병합·후속 요청

- **E1**: `lib/analytics/track.ts` `AnalyticsEvent` 유니온에 `match_created` 추가(현재 `trackLoose` 캐스팅). `app/(auth)/actions.ts` 의 `export const OTP_RESEND_AFTER_SEC` 는 "use server" 파일이라 빌드 실패 → 상수를 별도 파일로.
- **E3**: `/chat` 페이지에 `await requireProfile(2)`; 방 ⋮ 차단은 `BlockConfirmDialog`(`surface="chat"`) 재사용 가능; 매칭 화면 진입 링크는 `/match/{matchId}`(첫 메시지 없는 새 매칭 행).
- **E4**: `/report?target=&surface=profile` 쿼리 계약(시트 신고 버튼). `/profile/[id]` 를 만들면 `RecoCardItem.onOpenProfile` 로 연결.
- **D4**: `sendMessage` 에 `suggestionTemplateId?` 옵션(→ `send_message(..., p_suggestion_template_id)`)을 열어 주면 제안 카드 채택률 지표(`suggestion_template_id`)가 DB 에 남는다.
- **D3**: `RecoCard.reasons` 의 `slot_overlap.label`·`region_same.level` 을 그대로 쓴다 — 형식 변경 시 `format.ts reasonExtras()` 동반 수정.
