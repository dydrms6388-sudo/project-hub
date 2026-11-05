# 25 — 프로필 · 설정 · 구독 · 차단 · 데이터/탈퇴 · 신고/이의신청 · 법적 문서 (E4, `apps/web`)

> 입력: `12_flows.md`(§6 프로필/설정·§7 신고/차단·§8 공용 상태·라우트 맵), `15_auth.md`(set_mode·request_delete/cancel_delete/pause_account·pendingReconsents·ActionResult·사진 액션), `18_moderation.md`(submitReport·blockProfile·getBlockList·getMySanctions·submitAppeal·카테고리 5→14), `19_payments.md`(Phase 1 "준비 중"·§7 다크패턴 14항), `20_notifications.md`(push 액션 4·client.ts·권한 타이밍), `08_legal_docs.md` + `content/legal/README.md`(변수 18·재동의 MAJOR), `07_legal_checklist.md`, `09_store_policy.md`, `10_brand.md`, `11_design_system.md`, `26_fe_company.md`(company.ts 스키마).
> 범위: `app/(app)/{me,settings,report,blocks}/**` · `app/appeal/**` · `app/(public)/legal/**` · `app/account/{delete,restore}/**` · `components/{profile,settings,report,legal}/**` · `config/company.ts` · `lib/legal/**` · `stores/{ui,push}.ts` · `app/dev/profile`. 기준일 2026-09-02. 모바일 375px, page = 서버 컴포넌트 + `*Screen.tsx` 클라이언트.

## 다음 에이전트에게 넘기는 결정사항

### 라우트 · 게이트 (E2·E6·G1)
1. **라우트 확정(총 20)**: `/me` `/me/edit`(#card·#hobbies·#quiz·#availability·#bio) `/me/photos` / `/settings` `/settings/mode` `/settings/verify` `/settings/notifications` `/settings/subscription` `/settings/data` `/settings/data/delete` / `/blocks` / `/report` `/report/new`(별칭) / `/appeal` / `/legal` `/legal/{terms,privacy,location,youth,community,refund}` `/legal/business` / `/account/delete` `/account/restore` / `/dev/profile`. 12_flows 의 `/settings/blocks`→`/blocks`, `/settings/account`→`/settings/data` 는 **서버 redirect 페이지**로 남겨 링크 호환.
2. **법적 문서 canonical = 짧은 slug** (`/legal/youth`·`/legal/community`·`/legal/refund`). 08_legal_docs 결정 4 의 긴 slug(`youth-policy`·`community-guidelines`·`refund-policy`)는 `LEGAL_ALIASES` 로 **308 permanentRedirect**(company 사이트 canonical `WEB_APP_URL/legal/youth-policy` 도 그대로 동작). 전부 `(public)` · 비로그인 O · `robots index,follow` · 빌드 시 SSG(`generateStaticParams` 9개 = 6 + 별칭 3).
3. **`/appeal` 은 `app/appeal/page.tsx`(그룹 밖)** — 지시의 `app/(app)/appeal/**` 에서 이동. 이유: E2 `(app)/layout.tsx` 가 `requireProfile(1)` 을 걸어 정지 사용자(게이트 ③)가 `/suspended` 로 튕겨 `/appeal` 에 닿을 수 없다. `classifyRoute('/appeal')` 은 폴더와 무관하게 `status:appeal` 이라 미들웨어 판정은 동일. 페이지는 세션 + `getMySanctions().screen ∈ {suspended, permanent}` 만 확인하고 아니면 `/home`.
4. **`lib/auth/routes.ts` 최소 수정 1건(D2 경로)**: `ROUTE_MIN_LEVEL["/blocks"] = 1` 추가. 없으면 `/blocks` 가 public 으로 분류돼 미들웨어 1차 방어를 건너뛴다(페이지 `requireProfile(1)` 이 2차 방어라 보안 문제는 아님). 그 외 `lib/**` 미접촉.
5. **gated 페이지는 전부 `export const dynamic = "force-dynamic"`** — `createClient()` 가 `cookies()` 전에 `publicEnv()` 를 부르므로 env 없는 빌드에서 프리렌더가 터진다(`/account/restore` 에서 재현). 새 (app) 페이지를 만드는 에이전트도 동일하게 선언할 것.
6. **E6 noindex 검증 목록**: index **O** = `/legal`, `/legal/{terms,privacy,location,youth,community,refund,business}` (`<meta name="robots" content="index, follow">` + `<link rel="canonical" href="/legal/<slug>">`). index **X**(`noindex, nofollow`) = `/me*`, `/settings*`, `/blocks`, `/report*`, `/appeal`, `/account/delete`, `/account/restore`. `/dev/profile` 은 프로덕션 404.

### 공용 컴포넌트 계약 (E2·E3)
7. **`components/legal/ReconsentGate.tsx`**: `const pending = await getPendingReconsents()`(`lib/legal/reconsent.ts`, server-only) → `<ReconsentGate pending={pending} />`. `[]` 면 null. 닫기 불가 Dialog · 문서별 체크(사전 체크 없음) 전부 true 여야 [동의하고 계속하기] 활성 → `acceptReconsent({documentKeys})`(`lib/legal/actions.ts`, `consents(key='reconsent', document_key, source='banner')`) → `router.refresh()`. **E2 `(app)/layout.tsx` 가 `AppFrame` 안에 1회 마운트**하면 된다(현재 미연결 — 병합 요청 §5). testid `reconsent-gate`·`reconsent-confirm`.
8. **`components/report/BlockConfirm.tsx`**: `<BlockConfirm open onOpenChange targetId nickname? surface="profile"|"chat" onBlocked? />`. 문구 `BLOCK_COPY` 그대로, 액션 호출(`blockProfile`)·toast·`track('block_submitted',{surface})` 는 컴포넌트 안. 호출부는 열고 닫기 + `onBlocked`(채팅이면 `/chat`, 프로필이면 `/reco` 로 이동)만. testid `block-dialog`·`block-confirm`·`block-cancel`. E3 `ChatHeader` ⋮ 차단, E2 `/profile/[id]` ⋮ 차단은 이 컴포넌트를 쓴다.
9. **신고 진입 링크 규약**: `/report?target=<uuid>&match=<uuid>&surface=chat|profile&reason=<code>`. `surface` 생략 시 match 있으면 chat. `reason` 은 프리셀렉트(스캠 배너 `ROMANCE_SCAM` → 2단에서 바로 시작). 잘못된 uuid 면 빈 상태 화면. `/report/new` 도 동일.
10. **`<WebOnly>`(`components/settings/WebOnly.tsx`)** = 19_payments 결정 3 구현. `isNativeApp()` 이면 children 렌더 0, fallback 만. Phase 3 웹 결제 문구·Toss 시트는 반드시 이 안에.

### E2E 훅 (`data-testid`) — G1 시나리오
11. 신고: `report-category-{1..5}` → `report-reason-{CODE}`(14) → `report-detail` → `report-submit` → 완료 `report-done` · `report-block-check`(기본 체크) · `report-finish`. 차단 모달 `block-confirm`. 차단 목록 `block-item`·`unblock`·`unblock-confirm`.
12. 설정: `settings-hub`·`settings-mode`·`settings-verify`·`settings-subscription`·`settings-notifications`·`settings-blocks`·`settings-data`·`settings-appeal`·`settings-logout`. 모드: `mode-friend`·`mode-dating`·`mode-preview-open`·`mode-preview-scroll`·`mode-preview-confirm`·`mode-seeking-{any|female|male}`·`mode-submit`. 데이터: `data-download`·`account-pause`·`account-pause-confirm`·`account-delete`. 삭제: `delete-ack`·`delete-request`·`delete-confirm`. 복구: `restore-cancel-delete`·`restore-logout`. 이의신청: `appeal-sanction-{level}`·`appeal-body`·`appeal-submit`. 사진: `photo-add`·`photo-file-input`·`photo-{pending|approved|rejected|held}`·`photo-set-primary`·`photo-delete`·`photo-delete-confirm`. 편집: `save-card`·`save-hobbies`·`save-quiz`·`save-basic`·`save-bio`. 알림: `push-enable`·`push-service`·`push-slot-a/b`·`push-instant`·`push-quiet-save`·`push-marketing`. 인증: `verify-step-{0..3}`·`verify-cta-identity`·`verify-cta-photo`.
13. **G1 시나리오(신고→차단)**: 서윤 로그인 → `/chat/[matchId]` 🚩 → `/report?target=민재&match=…&surface=chat` → `report-category-1` → `report-reason-ROMANCE_SCAM` → `report-submit` → `report-done` 에 "24시간 안에 확인해요." → `report-block-check` 체크 유지 → `report-finish` → `blockProfile` → `/chat` 로 이동, `/blocks` 에 `block-item` 1개(닉네임 민재) → `unblock`·`unblock-confirm` → 0개. 24h 내 재신고는 완료 화면에 "이미 접수된 신고에 내용을 추가했어요".

### 데이터 · 계정
14. **데이터 다운로드는 Phase 1 부터 자동**(12_flows 의 "문의 폼" 대신): `exportMyData()`(`app/(app)/settings/data/actions.ts`) 가 **사용자 권한(RLS)** 으로 17 섹션을 모아 `buildExport()`(`components/settings/data-export.ts`, 순수) JSON 을 돌려주고 클라이언트가 Blob 다운로드(`my-data-YYYYMMDD.json`). 조회 실패 섹션은 `partial[]` 로 표시 + "10일 이내 문의" 안내. `excluded` 5항목(타인 메시지·사진/점수 내부값/룰 hit/타인 신고/전화·CI 해시) 명시. 스키마 `schema_version: 1` 은 vitest 로 고정.
15. **계정 삭제 = 설정 › 내 데이터 › 계정 삭제(2탭)** → 보존 항목 5개(`RETENTION_ITEMS`) + 7일 유예 안내 + 체크 1개 → [탈퇴하기] → 시트 확인 1회(10_brand #32 문구) → `requestDelete()` → `/`. 만류·할인 없음. 07_legal 결정 21 의 "지금 바로 삭제" 옵션은 `request_delete` 에 즉시 옵션이 없어 **미구현**(D2 RPC 추가 시 시트에 두 번째 버튼만 추가).
16. **휴면**은 `/settings/data` 의 [휴면하기] → 시트 → `pauseAccount()` → 로그아웃. 재개는 `verifyOtp` 가 자동(`resume_account`) — 별도 화면 없음. `/account/restore` 는 `deleteRequestedAt + 7d` 로 D-day·삭제 예정일 표시, [탈퇴 취소] 1탭.
17. **`/account/delete`(비로그인, noindex)** = 09_store_policy 결정 3 의 웹 계정 삭제 URL. 절차 4단계 + 보존 항목 + [로그인하고 삭제 진행] → `/login?next=/settings/data/delete`. company 사이트 푸터에서 이 URL 을 링크할 것(E5).

### 법적 문서 · company.ts
18. **`apps/web/config/company.ts`** = company 앱과 **동일 키 18 + `WEB_APP_URL`(env `NEXT_PUBLIC_SITE_URL`)·`COMPANY_URL`(`NEXT_PUBLIC_COMPANY_URL`)·`CONTACT_ENDPOINT`·브랜드 4**. 값은 두 파일에 같이 채운다(소유자). 추가 export: `LEGAL_VAR_KEYS`(18), `paymentsAllowedByLegal()`(COMPANY_NAME·ECOMMERCE_REG_NUMBER 둘 다 있어야 true — 구독 화면이 `isPaymentsEnabled() && paymentsAllowedByLegal()` 로 판정), `siteUrl()`, `APP_VERSION`(`NEXT_PUBLIC_APP_VERSION` 또는 "0.1.0"). `check-legal-placeholders.mjs` 가 이 파일의 토큰 22개를 경고한다(의도, 차단 X).
19. **렌더 파이프라인 `lib/legal/`**: `markdown.ts`(순수: frontmatter·marked·heading id·목차·표 래퍼) + `index.ts`(fs 로더·캐시·`LEGAL_DOCS`·`LEGAL_ALIASES`·`resolveLegalSlug`·`legalHrefForDocKey`) + `reconsent.ts` + `actions.ts`. 클라이언트에서 링크만 필요하면 `components/legal/links.ts`(fs 미포함 사본). `marked@^18.0.11` 을 web 에 추가(company 와 동일 버전). 본문 CSS 는 `components/legal/legal.css`(`(public)/legal/layout.tsx` 에서 import, `globals.css` 미수정).
20. 하단 안내는 "현행 버전 x · 시행일 y · 이전 버전은 git 태그(`legal/<slug>@버전`)" 로 고정. `.next.md` 개정 예정본 병행 게시는 미구현(현행본만, `effective_date` 미래면 "개정 예정" 배지).

### 기타 계약
21. **분석 이벤트는 E1 `lib/analytics/track.ts` 로 위임**(`components/settings/track.ts` 어댑터). 발화: `mode_changed{from,to,preview_viewed}` · `report_submitted{reason_code,surface,deduped}` · `block_submitted{surface}` · `account_paused` · `account_delete_requested` · `account_delete_canceled` · `push_permission_prompted/granted{surface:'settings'}`. **E1 병합 요청**: union 에 `me_viewed settings_viewed verify_center_viewed notification_settings_viewed report_opened data_export_downloaded photo_uploaded photo_deleted unblock_submitted appeal_submitted logged_out` 추가(어댑터 `E4ViewEvent` 와 동일).
22. **모드 전환 미리보기**는 Dialog 안 스크롤 영역 끝(8px 이내)에 닿아야 [확인했어요] 활성 → `previewViewed=true` → `setMode`. 서버 `NOT_ENTITLED` 는 인라인 배너 + [인증 센터로]. 반대 방향(dating→friend)도 미리보기 1회(사진 노출 축소 안내).
23. **사진 서명 URL 은 admin storage 로 본인 폴더(`{profileId}/…`)만 10분 서명**(`app/(app)/me/load.ts signPhotoUrls`). 삭제 확인 시트는 유일한 승인 사진이면 "삭제하면 사진인증(L3)이 해제되고 데이팅 모드가 꺼져요". 업로드는 `createPhotoUploadUrl → uploadToSignedUrl(브라우저) → confirmPhotoUpload` 그대로.
24. **`/me/edit` 는 온보딩 액션 재사용**(`saveBasic`·`saveHobbies`·`saveQuizAnswers`·`saveCard` — `onboarding_step=done` 이면 `contextForScreen` 이 전부 허용, `advance` 는 no-op). bio 만 `app/(app)/me/edit/actions.ts updateBio`(RLS self update + `text-rules` CT/BW 검사). 닉네임 30일 규칙은 서버가 판정하고 화면은 `nickname_changed_at` 으로 미리 비활성.
25. **Zustand**: `stores/ui.ts`(modalStack·isOffline·reducedMotion) · `stores/push.ts`(permission·subscribed·bannerDismissedLoopDate). 서버 데이터 복제 없음. E2 홈 배너가 `usePushStore` 를 읽으면 설정 화면과 상태가 맞는다.

---

## 1. 화면 표

| 라우트 | 파일 (page → Screen) | 데이터(서버) | 액션 | 비고 |
|---|---|---|---|---|
| `/me` | `(app)/me/page.tsx` → `components/profile/MeScreen` | `loadMyProfileView`(profile·hobbies·photos 서명 URL·region·quiz·availability) | — | DuckCard compact(compat 없음), VerifyBadge L1~L3, 편집 5행 |
| `/me/edit` | `(app)/me/edit/page.tsx` → `ProfileEditScreen` | `loadProfileEditData`(hobbies 전체·regions·quiz_questions·answers) | `saveCard` `saveHobbies` `saveQuizAnswers` `saveBasic` `updateBio` | 섹션별 부분 저장, 앵커 5 |
| `/me/photos` | `(app)/me/photos/page.tsx` → `PhotosScreen` | `loadMyPhotos` | `createPhotoUploadUrl` `confirmPhotoUpload` `deletePhoto` `setPrimaryPhoto` | 배지 4종(반려 코드 문구 = `PHOTO_REJECT_MESSAGES`), 대표는 승인만 |
| `/settings` | `(app)/settings/page.tsx` → `SettingsHubScreen` | `getBlockList` `getMySanctions` `isPaymentsEnabled` | `signOut` | 이의신청 행은 level≥3 활성 제재 때만 |
| `/settings/mode` | → `ModeScreen` | `loadMyProfileView` | `setMode` | 미리보기 필수 · seeking_gender · L3 게이트 |
| `/settings/verify` | → `VerifyCenterScreen` | `loadMyPhotos` | — | L0~L3 진행, CTA `/verify` · `/me/photos` |
| `/settings/notifications` | → `NotificationsScreen` | `getPushPrefs` | `subscribePush` `unsubscribePush` `updatePushPrefs` + `enablePush()`(client) | 권한 프롬프트는 버튼 안에서만, 23~07 고정 안내, 마케팅 = consents |
| `/settings/subscription` | 서버 컴포넌트 단독 | `ENTITLEMENTS` 12키 | — | "준비 중" 배지, 가격 없음, 결제 버튼 없음, `<WebOnly>` |
| `/settings/data` | → `DataScreen` | — | `exportMyData` `pauseAccount` | 다운로드 JSON · 휴면 · 삭제 진입 |
| `/settings/data/delete` | → `DeleteAccountScreen` | — | `requestDelete` | 보존 항목 + 체크 + 시트 확인 |
| `/blocks` | `(app)/blocks/page.tsx` → `BlocksScreen` | `getBlockList` | `unblockProfile` | 빈 상태 `BLOCK_COPY.empty` |
| `/report` `/report/new` | `(app)/report/page.tsx` → `ReportScreen` | `getReportContext`(닉네임·최근 5 메시지) | `submitReport` `blockProfile` | 2단 → 상세 → 증거 안내 → 완료(차단 기본 체크) |
| `/appeal` | `app/appeal/page.tsx` → `AppealScreen` | `getMySanctions` | `submitAppeal` | 7일·1회·72h, 상태 배지 |
| `/account/restore` | `app/account/restore/page.tsx` → `RestoreScreen` | `getGateState` | `cancelDelete` `signOut` | D-day, 삭제 예정일 |
| `/account/delete` | `app/account/delete/page.tsx` | — | — | 비로그인 안내, noindex |
| `/legal` `/legal/[slug]` `/legal/business` | `(public)/legal/*` + `components/legal/*` | `loadLegalDoc` (SSG) | — | index O, canonical, 별칭 308 |
| `/dev/profile` | `app/dev/profile/page.tsx` | 목 데이터 | — | 프로덕션 404 |

카피 상수: `components/settings/copy.ts`(DELETE·PAUSE·RESTORE·MODE·PHOTO·NOTIFY·SUBSCRIPTION·DATA·RETENTION_ITEMS), 신고/차단/제재/이의신청 문구는 `lib/moderation/constants.ts` 만 렌더. 서비스명 리터럴 0(`SERVICE_NAME` 상수만).

## 2. 파일 구성

```
apps/web/
├─ config/company.ts                      변수 18 + URL + 브랜드, isPlaceholder/display/fillPlaceholders/paymentsAllowedByLegal
├─ lib/legal/{markdown,index,reconsent,actions,types}.ts + legal.test.ts
├─ app/(public)/legal/{layout,page}.tsx  [slug]/page.tsx  business/page.tsx
├─ app/(app)/me/{page,load}.tsx  edit/{page,actions}.tsx  photos/page.tsx
├─ app/(app)/settings/page.tsx  {mode,verify,notifications,subscription}/page.tsx  data/{page,actions}.tsx  data/delete/page.tsx  {blocks,account}/page.tsx(redirect)
├─ app/(app)/blocks/page.tsx  app/(app)/report/page.tsx  report/new/page.tsx
├─ app/appeal/page.tsx  app/account/{delete,restore}/page.tsx  app/dev/profile/page.tsx
├─ components/legal/{LegalTabs,LegalDocView,BusinessBlock,LegalFooterBlock,ReconsentGate}.tsx  links.ts  legal.css
├─ components/profile/{MeScreen,ProfileEditScreen,PhotosScreen}.tsx  types.ts  format.ts
├─ components/settings/{SettingsHubScreen,ModeScreen,VerifyCenterScreen,NotificationsScreen,DataScreen,DeleteAccountScreen,BlocksScreen,AppealScreen,RestoreScreen,WebOnly}.tsx  copy.ts  track.ts  data-export.ts(+test)
├─ components/report/{ReportScreen,BlockConfirm}.tsx  params.ts  report.test.ts
└─ stores/{ui,push}.ts
```

## 3. 검증 결과 (2026-09-02)

| 항목 | 결과 |
|---|---|
| `pnpm --filter @duckmate/web typecheck` | E4 경로 오류 0 (전체 0) |
| `pnpm --filter @duckmate/web build` (env 미설정) | 성공 — `/legal/[slug]` SSG 9경로, `/legal`·`/legal/business` static, gated 페이지 ƒ dynamic |
| `vitest run` | 전체 22 파일 268 통과. E4 신규: `lib/legal/legal.test.ts` 5(변수 치환·18키 외 토큰 0·frontmatter·렌더), `components/settings/data-export.test.ts` 3(스키마 v1·제외 항목·파일명), `components/report/report.test.ts` 4(5→14 매핑·순서·OTHER·파라미터) |
| `node scripts/check-legal-placeholders.mjs` | 경고만(exit 0): md 6 + `apps/web/config/company.ts` 22 토큰 + company 앱 |
| `next start`(더미 env) 라우트 프로브 | `/legal` `/legal/terms` `/legal/community` `/legal/refund` `/legal/business` `/account/delete` 200 · `/legal/youth-policy` → 308 `/legal/youth` · `/me` `/blocks` `/report` `/appeal` → 307 `/login?next=` · `/dev/profile` 404(프로덕션) |
| robots/canonical | `/legal/terms` `index, follow` + `canonical /legal/terms` · `/account/delete` `noindex, nofollow` |
| 스크린샷 (375×812 @2x, Playwright + `/opt/pw-browsers` chromium) | `docs/screenshots/web-legal.png`(`/legal/terms`) · `web-account-delete.png` · `web-settings.png`(`/dev/profile`, next dev) |
| 비밀값 | 없음(env 키 이름만). `service role` 은 `lib/supabase/admin.ts` 경유 서명 URL 1곳 |
| git commit | 없음(지시) |

미실행: Supabase 실 DB 연동(로그인 화면 실데이터·`v_my_blocks`·`get_my_moderation_state`·Storage 서명 URL), 브라우저 푸시 권한 실동작, 사진 업로드 E2E. G1 이 시드 계정(서윤/민재)으로 §0-13 시나리오를 1회 재확인 필요.

## 4. 미결 · 병합 요청

| 대상 | 요청 |
|---|---|
| E2 `(app)/layout.tsx` | `AppFrame` 안에 `const pending = await getPendingReconsents(); <ReconsentGate pending={pending} />` 1회 마운트. `/report*` 는 풀스크린이므로 `hideTabs` 권장(현재 탭 바가 함께 보임) |
| E2 `/profile/[id]` · E3 `ChatHeader` | 차단은 `components/report/BlockConfirm` 사용, 신고는 `/report?target=&match=&surface=` 링크 |
| E1 `lib/analytics/track.ts` | `AnalyticsEvent` union 에 결정 21 의 E4 이벤트 11개 추가 |
| E5 company 푸터 | `/account/delete` 링크(스토어 Data Safety 양식용 웹 URL) |
| D2 `lib/account/actions.ts` | 07_legal 결정 21 "지금 바로 삭제" 옵션(`request_delete(p_immediate)`) 추가 시 `DeleteAccountScreen` 시트에 버튼 1개만 추가 |
| D1/D5 | `v_my_blocks`·`consents`·`v_messages` 타입이 `packages/db` 에 병합되면 `data/actions.ts` 의 untyped 캐스트 제거 |
| 소유자 | `apps/web/config/company.ts` 와 `apps/company/config/company.ts` 값 동시 입력(18키). `NEXT_PUBLIC_APP_VERSION` 을 Vercel 빌드에 주입하면 설정 하단 버전이 바뀐다 |
