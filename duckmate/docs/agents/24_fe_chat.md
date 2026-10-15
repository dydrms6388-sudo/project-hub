# 24 — 채팅 UI + 첫 대화 제안 카드 (E3)

> 입력: `17_chat.md`(D4 액션·구독·표시 규칙), `12_flows.md`(§5 채팅·§7 신고/차단·§8 공용 상태·§10 이벤트), `18_moderation.md`(partner_risk_banner·BLOCK_COPY·SANCTION_COPY), `11_design_system.md`, `10_brand.md`(§4.5 #17·#21), `06_PRD.md`(§4.4), `15_auth.md`(`requireProfile`·`ActionResult`).
> 산출물: `apps/web/app/(app)/chat/{page.tsx,actions.ts,[matchId]/page.tsx}`, `apps/web/components/chat/**`, `apps/web/stores/chat.ts`, `apps/web/app/dev/chat/page.tsx`, `docs/screenshots/web-chat-{list,room,room-empty,room-ended,room-sent}.png`, 이 문서.
> 기준일 2026-09-02. `lib/**`·`app/(app)/layout.tsx`·`app/api/**` 수정 없음. git commit 없음. 비밀값 없음.

## 다음 에이전트에게 넘기는 결정사항

### 라우트·파일 (E2/E4/G1 공통)
1. **라우트 2개**: `/chat`(목록, `app/(app)/chat/page.tsx`) · `/chat/[matchId]`(대화방, `app/(app)/chat/[matchId]/page.tsx`). 둘 다 서버 컴포넌트 → `requireProfile(2)` → 초기 데이터 fetch → `*Screen.tsx`(클라이언트) 에 props. `metadata.robots` noindex, `dynamic="force-dynamic"`. `(app)/layout.tsx`(E2) 가 AppShell·게이트를 얹으면 그대로 동작한다 — 대화방은 `h-dvh` 풀스크린이므로 **E2 는 `/chat/[matchId]` 경로에서 `AppShell hideTabs`** 를 권장.
2. **대화방 초기 데이터** = `Promise.all([getChatRoom, getMessages(limit 50), partnerRiskBanner])`. `getChatRoom` 이 `NOT_FOUND`(차단자 본인·비당사자·없는 방) 면 `notFound()`(존재 비노출), `redirectTo` 가 있으면 그대로 redirect. `matchId` 는 uuid 정규식 사전 검사.
3. **클라이언트 데이터 접근 계약 = `ChatApi`**(`components/chat/api.tsx`). 화면은 서버 액션을 직접 import 하지 않고 `useChatApi()` 로 받는다. 기본값 `realChatApi` = `lib/chat/{actions,images,realtime}` + `lib/moderation/actions.blockProfile` + **`app/(app)/chat/actions.ts`**(`fetchChatList/fetchChatRoom/fetchMessages/fetchPartnerRiskBanner` — `lib/chat/queries.ts` 가 `"use server"` 파일이 아니라 클라이언트 페이지네이션·폴링용으로 한 겹 감쌌다). 테스트·목 라우트는 `<ChatApiProvider api={createMockChatApi()}>`.
4. **`SuggestionPicker` 계약 (E2 import)** — `import { SuggestionPicker } from "@/components/chat/SuggestionPicker"`:
   ```ts
   type SuggestionPickerProps = {
     matchId: string;
     cards: ReadonlyArray<FirstSuggestion>;              // @duckmate/db FirstSuggestion (c1~c3)
     surface?: "match" | "chat";                          // 분석 props (기본 chat)
     onSent?: (sent: SentMessage, card: FirstSuggestion, position: number) => void;
     onFailure?: (failure: ActionFailure, card: FirstSuggestion) => void;
     send?: (input: { matchId: string; body: string }) => Promise<ActionResult<SentMessage>>; // 기본 useChatApi().sendMessage
     collapsible?: boolean; defaultCollapsed?: boolean; disabled?: boolean; title?: string; className?: string;
   };
   ```
   선택 → `sendMessage({ matchId, body: card.body })` → 성공 시 `track("suggestion_selected", { template_id, kind, position, surface })` 후 `onSent`. **E2 매칭 화면 사용 예**: `<SuggestionPicker matchId={id} cards={firstSuggestion} surface="match" onSent={() => router.push(`/chat/${id}`)} />`. 실패 문구는 카드 아래 한 줄로 자체 표시하니 E2 는 `onFailure` 에서 `redirectTo` 만 따르면 된다. `ChatApiProvider` 없이도 동작(컨텍스트 기본값 = 실제 액션).
5. **`send_first_message(match_id, suggestion_id)` RPC 는 쓰지 않는다**(마이그레이션에 없음). 제안 카드 본문을 일반 `sendMessage` 로 보내므로 `messages.suggestion_template_id` 는 **NULL 로 기록된다** — D3/D4 가 `sendMessage` 에 `suggestionTemplateId?` 를 추가하면 `SuggestionPicker.select()` 한 줄만 바꾸면 된다(16_matching §0-12 의 "선택 시 `id` 를 넘긴다" 미충족 항목).
6. **대화방 제안 카드 재노출 조건** = `messages.length === 0 && first_suggestion.length > 0 && status active && 내 제재 < 2`. 접힘 토글(`collapsible`), 제목 "첫 마디, 이렇게 시작해 볼까요?". 첫 메시지가 생기면 자동으로 사라진다.

### 상태·데이터 흐름
7. **TanStack 키**: 목록 `['matches']`(`ChatListItem[]`, staleTime 15s) · 메시지 `['messages', matchId]` = `{ items: UiMessage[], nextBefore }`(staleTime ∞, queryFn 은 최신 50개를 다시 받아 **기존 캐시·낙관적 행과 `mergeMessages()` 로 병합** — invalidate 해도 페이지네이션한 과거분·전송 중 행이 사라지지 않는다). 위로 스크롤(상단 40px) 또는 [이전 대화 보기] → `fetchMessages({ before: nextBefore })` prepend + 스크롤 위치 보정.
8. **Zustand `stores/chat.ts`**(persist `dm.chat`, localStorage): `activeMatchId`·`realtimeStatus`(비영속) / `draftByMatch`·`safetyBannerShownMatchIds`·`guideSeen`·`dismissedByMatch`(영속) / `revealedImageIds`·`readLocally`(세션). 메시지·목록 본문은 넣지 않는다(12_flows §0-14).
9. **Realtime 폴백 동작**: `subscribeToMatch/subscribeToInbox` 의 `onStatus('polling')` → 스토어 `realtimeStatus='polling'` → 화면이 **5초 간격 `invalidateQueries`**(목록 `['matches']`, 방 `['messages', id]`) + 상단 얇은 바 "연결 중… 5초마다 새 메시지를 확인하고 있어요"(`data-testid="chat-polling"`). `onResync`(재연결 직후 1회) 도 invalidate. 구독 해제 시 `connecting` 으로 되돌린다. 실 Supabase private 채널 join 은 D4 §4 미확인 항목이므로 **G1 이 실환경에서 `connected` 전이를 1회 확인**해야 한다.
10. **낙관적 전송**: `makeOptimistic()` 로 `tmp-<clientId>` 행을 즉시 붙이고 → `sendMessage` 응답의 `id/createdAt` 로 확정(`sentToMessage`, `clientId` 유지) → 같은 id 의 Realtime 에코는 `mergeMessages` 가 흡수(화면 전용 필드 보존). 실패 매핑은 `mapSendFailure()`(순수, 테스트): `RATE_LIMITED` → 인라인(행 제거·드래프트 복원) / `NOT_ENTITLED` 종료류 → 입력 비활성+사유 / `IMAGE_NOT_ALLOWED` → 이미지 버튼 비활성+인라인 / `SANCTIONED` → `redirectTo ?? /suspended` / `NOT_VERIFIED` → `/verify` / 그 외 → 행에 "다시 보내기"(같은 clientId 로 재전송).
11. **읽음**: 진입·`visibilitychange(visible)`·상대 메시지 수신 시 `markRead` → `marked>0` 이면 `message_read{latency_min}`. 목록은 `readLocally[matchId] ≥ last_message_at` 또는 `activeMatchId` 면 배지 0(서버 재조회 전 즉시 반영). 내 말풍선의 "읽음" 표시 = `v_messages.read_at`(마지막 읽힌 내 메시지 1개에만). 페이로드에 read 이벤트가 없어(17_chat §0-10) 상대가 읽는 순간의 갱신은 폴링/재진입 때 반영된다.
12. **배너 우선순위** = `pickTopBanner()`(순수): `partner_scam_banner || partner_risk_banner || Realtime scam_signal` → 위험(danger, [신고하기] → `/report/new?…&reason=ROMANCE_SCAM`) > `contact_unmasked=false` → 마스킹 안내(`unmask_at` 시각, `both_l3=false` 면 "양쪽 사진인증부터", `my_contact_hits≥3 || warnContact` 면 warn 톤 + "반복되면 자동 신고" 줄, 닫기 불가) > `image_allowed=false` → 이미지 가능 시각 > 첫 매칭 안전 수칙 3줄 1회(`guideSeen`). 한 번에 1개만. 내 제재 level 2 배너(`my_sanction_level≥2`)와 오프라인 만남 배너(A5 §10.2, 매칭당 1회, `SentMessage.offlineMeeting || OFFLINE_MEETING_RE`)는 별도 슬롯.
13. **마스킹 표시**: 수신 `display_body` 의 `[연락처 숨김]/[링크 숨김]/[계좌 숨김]` 을 `splitMasked()` 로 칩 **"연락처 가림"**(`data-testid="chat-masked-chip"`, 툴팁 = 이유) 으로 렌더. 발신자 화면은 원문 + `SentMessage.contactMasked` 일 때만 말풍선 아래 A5 §10.4 원문 안내(`chat-masked-note`). `is_held` 내 메시지 → "검토 중이라 상대에게 전달되지 않았어요". `warnRules` 있으면 토스트 "커뮤니티 가이드에 맞지 않는 표현이 있어요" 1회.
14. **이미지**: 버튼 활성 = `image_allowed && both_l3`. 흐름 `prepareChatImage`(canvas 긴 변 1080px → WebP q0.85, 실패 시 원본) → `createChatImageUploadUrl` → `storage.uploadToSignedUrl` → `sendImageMessage`. 낙관적 행은 blob URL 로 즉시 표시. **수신 이미지는 블러 + [보기] 탭 후에만 `getChatImageUrl`** (스토어 `revealedImageIds`, 세션 유지), 탭하면 확대 Sheet. 이미지 실패는 재시도 대신 "다시 선택" 안내.
15. **헤더 메뉴**(Sheet): 프로필 보기(공개 필드만: 닉네임·인증·연령대·구·모드·매칭 시각 + [매칭 화면 보기] `/match/[id]`) / 신고하기 / 차단하기(`BLOCK_COPY` 확인 모달 → `blockProfile` → `block_submitted{surface:'chat'}` → `/chat`) / 대화 나가기(확인 → `leaveMatch` → `chat_left` → `/chat`). 종료 방(blocked/left/paused)은 입력창 대신 상태별 바(`ENDED_LABEL`), 헤더 🚩 유지, 나가기 숨김.
16. **신고 진입 URL** = `reportHref(partnerId, matchId, reason?)` → `/report/new?target=&match=&surface=chat[&reason=ROMANCE_SCAM]` (12_flows §7.1, E4 `app/(app)/report/new`). E4 는 `reason` 쿼리를 프리셀렉트로 읽으면 된다(선택).
17. **분석 이벤트**(`components/chat/track.ts` → `@/lib/analytics/track`): 12_flows 표의 `message_sent{match_id_hash,is_first,has_image,length_bucket}` · `message_read{latency_min}` · `conversation_reciprocated{hours_since_match}` · `suggestion_selected` · `block_submitted` 는 E1 유니온 그대로. 지시서의 **`chat_opened`·`chat_list_viewed`·`image_sent`·`chat_left`·`suggestion_picker_shown` 은 E1 `AnalyticsEvent` 유니온에 없어 `ChatExtraEvent` 로 캐스팅해 보낸다 — E1 이 `lib/analytics/track.ts` 유니온에 4개를 추가하면 캐스팅 제거.** `match_id` 는 `hashId()`(FNV-1a) 만 전송.
18. **시각 라벨은 클라이언트 전용**: 서버 TZ(UTC) 와 브라우저 TZ 가 달라 hydration mismatch 가 났다 → 두 화면 모두 `useMounted()` 전에는 `SkeletonList` 를 그린다(300ms 규칙 안). `dayLabel/timeLabel/relativeLabel/dateTimeLabel` 은 `model.ts` 순수 함수(now 주입).

### E2E 훅 (G1)
19. **`data-testid`**: 목록 `chat-list`·`chat-list-item[data-match-id]`·`chat-unread`·`chat-polling` / 방 `chat-room`·`chat-partner-name`·`chat-report`(헤더 🚩 링크)·`chat-menu`·`chat-block`(메뉴 항목)·`chat-block-confirm`·`chat-leave`·`chat-leave-confirm`·`chat-profile-sheet`·`chat-banner-{scam,mask,image,guide,offline,sanction}`·`chat-ended`·`chat-scroll`·`chat-load-older`·`chat-date-separator`·`chat-message[data-mine][data-message-id]`·`chat-masked-chip`·`chat-masked-note`·`chat-retry`·`chat-image-blurred`·`chat-image-zoom`·`chat-input`·`chat-send`·`chat-image`·`chat-inline-error`·`chat-input-disabled`·`suggestion-picker`·`suggestion-card`.
20. **G1 시나리오 (전송 → 마스킹 표시 → 신고 진입)** — 목 라우트에서 검증된 순서: `/chat/[id]` 진입 → `chat-input` 에 `"제 번호는 010-1234-5678 이에요"` → `chat-send` → 내 말풍선 아래 `chat-masked-note` 노출(발신자 원문 유지) + 상대 화면(또는 상대 계정)에서는 `chat-masked-chip` "연락처 가림" → `chat-menu` → `chat-block` 가시 / 헤더 `chat-report` href `= /report/new?target=<partner>&match=<match>&surface=chat`. 실환경 추가 확인: 3회째 CT 히트 후 `chat-banner-mask` 가 warn 톤으로 바뀌는지(`warnContact`).
21. **개발 목 라우트 `/dev/chat`**(프로덕션 404): `?view=list` / `?view=room[&match=<uuid>][&realtime=polling][&scam=1]`. 시드 4방: 민재(활성·미읽음 2·마스킹 수신·읽음 표시) / 하은(`bbbbbbbb-…`, 메시지 0 + 제안 카드 3장, both_l3=false) / 도현(`cccccccc-…`, left) / 탈퇴(paused). 목 `sendMessage` 는 `safety-rules` 의 `scoreMessage/maskContacts` 를 그대로 돌리며 본문에 "실패" → INTERNAL, "답장" → `RATE_LIMITED: WAIT_FOR_REPLY`.

### lib 수정 기록 · 미결
22. **`lib/**` 수정 0건.** 참고로 필요했던 것: `lib/chat/queries.ts` 클라이언트 호출 불가(→ 결정 3 래퍼로 해결), `get_chat_list` 에 궁합 점수 없음(→ `ChatRoomScreen.compat?` prop 만 예약, 헤더 게이지는 값이 올 때만), `partner_photo_path` 서명 URL 헬퍼 없음(→ `HobbyAvatar` 고정, 카테고리는 partner_id 해시).
23. **D4/D5 에 요청**: (a) `get_chat_list` 에 `compat_score`·`partner_top_category` 추가(헤더 게이지·아바타 색) (b) `sendMessage` 에 `suggestionTemplateId?` (c) 내 채팅 제한 `ends_at`(현재 배너에 해제 시각 없이 "24시간 제한" 만 — `ChatRoomScreen.sanctionEndsAt?` prop 예약, E4 `getMySanctions()` 를 page 에서 넘기면 표시).
24. **입력 상한은 UI 1,000자**(지시서) — 서버 `CHAT_MESSAGE_MAX_LEN` 2,000 보다 보수적. 800자부터 카운터 표시.
25. **`/safety-guide`**(오프라인 만남 배너 링크) 는 E5 정적 페이지(12_flows §11) — 아직 없으면 404. `/match/[id]`(프로필 시트 링크) 는 E2.

---

## 1. 화면 표

| 화면 | 파일 | 초기 데이터(서버) | 클라이언트 갱신 | 상태 분기 |
|---|---|---|---|---|
| `/chat` 목록 | `app/(app)/chat/page.tsx` → `components/chat/ChatListScreen.tsx` | `getChatList()` | `subscribeToInbox` → invalidate `['matches']`, polling 5s | 빈 상태(10_brand #17 + [오늘의 추천 보기]) / 행: 아바타·닉네임·`VerifyBadge`·상태 뱃지(종료·떠남·일시정지)·마지막 메시지(masked, "[연락처 가림]")·상대 시각·미읽음 배지·첫 메시지 없으면 "첫 마디를 골라 보세요 · 제안 카드 3장" + NEW |
| `/chat/[matchId]` 대화방 | `app/(app)/chat/[matchId]/page.tsx` → `ChatRoomScreen.tsx` | `getChatRoom` + `getMessages(50)` + `partnerRiskBanner` | `subscribeToMatch`(message/match_status) + polling 5s + 위로 페이지네이션 | 헤더(`ChatHeader`) / 배너 슬롯(`ChatBanners`) / 제안 카드(`SuggestionPicker`) / 리스트(`MessageList`) / 입력(`MessageInput`) 또는 종료 바 / 시트·모달(`ChatDialogs`) |
| `/dev/chat` 목 | `app/dev/chat/page.tsx` → `components/chat/dev/*` | 시드 | 인메모리 목 | 프로덕션 `notFound()` |

순수 로직 `components/chat/model.ts`: `mergeMessages/removeMessage/payloadToMessage/sentToMessage/makeOptimistic` · `groupByDay/dayLabel/timeLabel/relativeLabel/dateTimeLabel` · `splitMasked/hasMaskedToken` · `mapSendFailure` · `pickTopBanner` · `parseFirstSuggestion/isEnded/ENDED_LABEL/hashId/lengthBucket/isReciprocated/reportHref/newClientId`.

## 2. 에러 코드 → UI

| 코드 (detail) | UI |
|---|---|
| `RATE_LIMITED` WAIT_FOR_REPLY / DAILY_CAP | 입력창 위 인라인(warn), 낙관적 행 제거·드래프트 복원 |
| `RATE_LIMITED` 분당 30 | 인라인 "요청이 많아요. {retryAfterSec}초 후" |
| `NOT_ENTITLED` MATCH_LEFT/BLOCKED/PAUSED/BLOCKED | 입력 비활성 + "대화가 종료되었어요" |
| `NOT_ENTITLED` IMAGE_NOT_ALLOWED | 이미지 버튼 비활성(`image_allowed=false`) + 인라인 사유 |
| `SANCTIONED` | 토스트 + `redirectTo ?? /suspended` (진입 시 `my_sanction_level≥2` 면 배너 + 입력 비활성, 리다이렉트 없음) |
| `NOT_VERIFIED` / `NOT_AUTHENTICATED` | `redirectTo`(/verify, /login) |
| `INVALID_INPUT` | 인라인 |
| `NOT_FOUND` | 입력 비활성 "대화방을 찾을 수 없어요" |
| 그 외(INTERNAL 등) | 행에 "전송하지 못했어요 · 다시 보내기" |

## 3. 검증 결과 (2026-09-02)

| 항목 | 결과 |
|---|---|
| `pnpm --filter @duckmate/web typecheck` | **E3 경로(`components/chat/**`·`app/(app)/chat/**`·`app/dev/chat`·`stores/chat.ts`) 오류 0.** 전체 실행은 동시 작업 중인 타 에이전트 파일(`app/(app)/me/photos` → `@/components/profile/PhotosScreen` 미존재, `components/onboarding/hobbies.test.ts`, `.next/types` 의 `app/page` 이동) 오류로 비정상 종료 — E3 무관 |
| `vitest` `components/chat/model.test.ts` | 20/20 통과 (병합/dedupe·낙관적→확정 교체·Realtime 에코 필드 보존·날짜 구분·상대 시각·마스킹 세그먼트·에러 매핑·배너 우선순위·해시/버킷/상호응답) + `lib/chat/chat.test.ts` 5/5 |
| `next build` | **통과(EXIT 0)** — `apps/web` 을 `apps/web-e3check` 로 격리 복사(node_modules 심링크, 타 에이전트의 동시 `next build`/`next start` 가 `.next` 를 지우는 문제 회피) 후 실행. `✓ Compiled successfully` · 타입 검사 통과 · `ƒ /chat 8.35 kB (First Load 233 kB)` · `ƒ /chat/[matchId] 214 B (277 kB)` · `ƒ /dev/chat 6.27 kB (283 kB)`. 복사본은 검증 후 삭제 |
| Playwright(375×812, Chromium 1194, `/dev/chat` 목) | `web-chat-list.png`(4행·미읽음 1·상태 뱃지) / `web-chat-room.png`(마스킹 배너·날짜 구분선·"연락처 가림" 칩·읽음 표시) / `web-chat-room-sent.png`(G1: 전화번호 전송 → `chat-masked-note`) / `web-chat-room-empty.png`(제안 카드 3장 + 폴링 바) / `web-chat-room-ended.png`(left 상태 바, 입력 없음). 콘솔: hydration mismatch 0(결정 18 적용 후), 에러 = Pretendard CDN 프록시 차단·manifest 404 뿐 |
| 비밀값 grep | 없음 |

미실행: 실 Supabase Realtime private 채널(D4 §4 미확인 항목과 동일), 실제 이미지 업로드(스토리지 서명 URL), 실계정 2개 왕복(G1).
