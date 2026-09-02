# 16 — 매칭 엔진 · 추천 배치 · 제안 카드 (D3)

> 입력: `14_schema.md`(D1 결정 40개, 특히 §0-19~21), `15_auth.md`(D2: `requireProfileForAction`·`ActionResult`·admin 클라이언트·함수 권한 회수 규칙), `03_core_loop.md`(재노출·우선 노출·리셋·템플릿 18), `06_PRD.md`(§0-10·15·40·41·45, F-014~023·052·056·069), `04_monetization.md`(daily_reco_limit·슈퍼라이크 쿼터·되돌리기 300초), `02_persona.md`(intensity 페널티·입문 환영·카드 3유형).
> 산출물: `supabase/migrations/20260902000020_matching_engine.sql`, `…0021_matching_actions.sql`, `supabase/functions/daily-recommendations/index.ts`, `apps/web/lib/matching/{rpc,score,suggestions,queries,actions}.ts` + `score.test.ts`·`suggestions.test.ts`.
> 기준일 2026-09-02. 로컬 PostgreSQL 16 에 0001~0014 + 0020·0021 적용, 시나리오 검증 완료(§6). **UI 없음**(E2). Phase 1 = 무료 티어 값만 활성(구조는 티어 대응).

## 다음 에이전트에게 넘기는 결정사항

### E2 (홈·추천·매칭 화면) — 액션/쿼리 시그니처 · 반환 · 에러
1. **모든 D3 서버 액션·쿼리는 `ActionResult<T>`** (`lib/auth/errors.ts`) 를 반환한다. 코드는 `ERROR_CODES` 그대로: `NOT_AUTHENTICATED`·`NOT_VERIFIED`·`NOT_ENTITLED`·`SANCTIONED`·`ALREADY_ACTED`·`NOT_FOUND`·`INVALID_INPUT`·`RATE_LIMITED`. `message` 는 그대로 노출 가능한 문구.
2. **`getTodayRecommendations()`** (`lib/matching/queries.ts`, `['reco', loopDate]`) → `{ loopDate, generated, limit, cards: RecoCard[], remaining, short }`. 내부에서 **`ensure_today_recommendations()` RPC 를 먼저 호출**(오늘 추천 없으면 온디맨드 생성, 멱등)하므로 E2 는 홈/추천 진입 시 이 쿼리 하나만 부르면 된다. `short=true` 면 "이 지역/취미에 아직 사람이 적어요 · 내일 07:00 다시 추천해요" 빈 카드(재노출로 채우지 않음).
3. **`RecoCard`** = `{ recoId, position, loopDate, score(0~1), scorePercent(정수 %), reasons[{kind,label,…}], seenAt, action, profile: v_profile_public 행, hobbies[{hobbyId,slug,name,categoryId,rank,intensity,favNote,isCommon}], commonHobbyIds, introWelcome, primaryPhotoPath, photoPaths }`. 카드 1면은 `hobbies`(rank 순, `isCommon` 강조·`INTENSITY_LABELS`)·`profile.now_into`·`reasons[0..1].label`("추천 이유 2줄")·`introWelcome`("입문 환영" 배지 = Top3 에 intensity ≤ 2). 사진 경로는 storage `photos` 버킷 내 경로 → 서명 URL 은 E2/E5 사진 헬퍼(`lib/photos`) 재사용.
4. **`reasons` jsonb 형식** (D1 시드와 호환, `label` 추가): `hobby_overlap{hobbies[slug], label:"공통 취미: 러닝·사진·출사"}` / `category_adjacent{categories[slug], label:"비슷한 취미 분야: 게임·보드게임"}` / `slot_overlap{slots["sat_morning"…], label:"토요일 아침에 시간이 맞아요"}` / `quiz_similar{same,total,label:"궁합 퀴즈 7/10 일치"}` / `region_same{level:sido|sigungu, label:"서울 근처"}`. 이 순서가 곧 중요도이며 E2 는 `label` 만 렌더하면 된다("같이 할 수 있는 것" 1줄은 `hobby_overlap` 1순위 취미로).
5. **`seen_at` 은 fetch 시 갱신하지 않는다.** 뷰포트 50%·1초(C3 §3.2) 시 **`markRecommendationSeen({recoId})`** 를 1회 호출한다(이미 있으면 no-op). 이유: 재노출 규칙이 "본 것(seen)"과 "안 본 것(unseen → 다음날 즉시 재노출)"을 구분하므로(A3 §6.2) 목록 조회만으로 seen 처리하면 안 본 카드가 7일 잠긴다.
6. **`actOnRecommendation({ targetId, action:"like"|"super"|"pass" })`** → `{ action, recoId, loopDate, already, matched, matchId, firstSuggestion?, superlike?, matchCreated }`. `matched=true` 면 `router.push('/match/'+matchId)`, `firstSuggestion` 3장이 이미 응답에 실려 있으므로 매칭 화면 첫 렌더에 추가 조회 불필요. `matchCreated=true` 일 때만 `match_created{initiator:'me'}` 트래킹. 같은 액션 재호출은 `already:true` 로 멱등, 다른 액션이면 `ALREADY_ACTED`.
7. **슈퍼라이크 실패는 `NOT_ENTITLED` + `field:"superlike"`** — 문구 "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전"(주간 쿼터, 무료 1) / "슈퍼라이크는 하루 5개까지 보낼 수 있어요"(일 상한). 구매 안내 없음(Phase 3 전). 잔여 표시는 `superlike.weekly_remaining`(응답 또는 `getSuperlikeStatus()`).
8. **좋아요/패스 레이트리밋 분당 30건**(`rate_limits`, 키 `reco_act:<profile sha256>`) → `RATE_LIMITED{retryAfterSec}`.
9. **`undo()`**: 무료는 항상 `NOT_ENTITLED`("되돌리기는 플러스 혜택이에요") → Phase 1 은 `PAYMENTS_ENABLED=false` 이므로 스낵바 자체를 렌더하지 않는다(PRD §0-46). 플러스↑: 마지막 행동 300초 이내면 되돌림(`{recoId,targetId,previousAction}`), 만료 `NOT_FOUND`("되돌릴 수 있는 시간(5분)이 지났어요"), 매칭까지 간 좋아요는 `ALREADY_ACTED`. 되돌린 카드는 `action=null` 로 돌아오므로 `['reco']` invalidate.
10. **`getHomeSummary()`** → `{ loop_date, reco_total, reco_remaining, pending_results(결과 대기 = 내가 보낸 미매칭 좋아요), matches_today, likers_count, superlike{weekly_quota,weekly_used,weekly_remaining,daily_cap,used_today} }` — 홈 상단·루프 끝 화면(`/reco/done`)의 숫자는 전부 여기서. **`getLikersCount()`** 는 무료 티어 숫자만(`see_likers='blur'`); 0 이면 유료 안내 없음(A4 §5). 블러 카드 목록(`v_likers`)은 Phase 3 D6.
11. **`getMatches()`** → `v_my_matches[]`(D1 §0-8). **`getMatch(matchId)`** → `{ match, partnerId, partner(v_profile_public|null), firstSuggestion[3], commonHobbySlugs }`. `firstSuggestion` 이 비어 있으면(상대 화면이 레이스로 먼저 열린 경우) 이 쿼리가 **자기 치유**로 생성·기록하므로 E2 는 항상 3장을 받는다.
12. **제안 카드 형식** = D1 §0-20 그대로 `[{id:"c1"|"c2"|"c3", template_id, title, body, kind:"online"|"offline"|"talk"}]`. 노출 순서 = 배열 순서(오프모임 성향이면 offline 이 c1). 선택 시 D4 `send_first_message(match_id, suggestion_id)` 에 `id` 를 넘기고, D4 는 `messages.suggestion_template_id = template_id` 로 기록한다. `suggestion_shown{template_ids, kinds}` 는 배열 그대로.
13. **점수는 카드에 "궁합 %" 로만**(`scorePercent`), 랭킹·외모 점수 아님. `is_from_liker`·`is_boosted` 는 `RecoCard` 에 **노출하지 않는다**(D1 §0-19, 유료 가치 보존). "서로 좋아요" 표기는 매칭 화면에서만.
14. **모드**: 추천·매칭은 항상 `profiles.mode` 가 같은 사람끼리(교차 없음). `dating` 은 양쪽 `seeking_gender` 상호 일치(F-056). 모드 전환 시 그날 추천은 유지되고(이미 생성됨) 다음 07:00 부터 새 모드 풀.

### D4 (채팅) · D7 (배치·푸시) · D8 (어드민)
15. **"새 추천 생성됨" 훅(D7)**: 정식 소스는 **`v_reco_daily_summary`**(service role; `profile_id, user_id, loop_date, reco_count, seen_count, acted_count, like_count, pass_count, liker_count, boosted_count, generated_at`). 슬롯 A(07:30) = `loop_date = loop_date(now()) and reco_count > 0` 인 유저에게 "새 추천 {reco_count}명 도착"(+`pending_likes_count`). 슬롯 B(19:30) ①"아직 N명 남았어요" = `seen_count > 0 and acted_count < reco_count`. 보조로 `pg_notify('duckmate_reco', {profile_id, loop_date, count})` 를 생성 시점에 발행한다(Realtime 은 이 채널을 구독하지 않으므로 서버 LISTEN 용).
16. **매칭 성사 훅(D7/D4)**: `matches` insert 가 정식 이벤트(Realtime `postgres_changes` 또는 DB webhook). 보조 `pg_notify('duckmate_match', {match_id, a_id, b_id})` + `audit_logs(action='match_created', meta{a_id,b_id,mode,initiator,like_type})`. 좋아요 알림은 Phase 1 미발송(가짜 신호 금지·"나를 좋아함" 비노출 정책과 일관) — 보내야 한다면 `likes.id` 를 `notification_log.like_id` 에 필수 기록.
17. **배치 일정**: `0021` 이 `pg_cron` 잡 `duckmate_daily_recommendations` = **`50 21 * * *`(UTC) = 06:50 KST** → `run_daily_recommendation_batch(null, null, 0)`. `p_loop_date=null` 은 `loop_date(now() + 10분)` 이므로 06:50 실행이 **그날 07:00 부터의 새 loop_date** 를 만든다(07:00 공개 = 클라이언트 `['reco', loopDate]` 키 전환). D7 이 `pg_cron` 확장을 만들더라도 충돌 없음(`create extension if not exists`, 잡은 이름으로 unschedule 후 재등록). pg_cron 이 없는 환경은 notice 후 skip → Edge Function `daily-recommendations` 를 외부 스케줄러가 호출.
18. **Edge Function `daily-recommendations`**: POST, 인증 `Authorization: Bearer <service role>` 또는 `x-webhook-secret = DAILY_RECO_WEBHOOK_SECRET`. 입력 `{loop_date?, batch_size?(200), max_batches?(500), start_offset?}` → 페이지 단위로 `run_daily_recommendation_batch` 반복(페이지 실패 시 3회 지수 백오프). RPC 가 프로필별 예외 격리 + 멱등이므로 재실행 안전. 결과·실패 목록은 `audit_logs(reco_batch_ran)` 에도 남는다.
19. **D7 purge**: `daily_recommendations` 는 재노출 판정에 최근 30일치만 필요 → `loop_date < loop_date(now()) - 60` 삭제를 `purge_daily` 에 추가 요청(D3 함수는 60일 이전 행을 참조하지 않는다).
20. **D8 지표 뷰(service role 전용)**: `v_reco_metrics_daily`(loop_date 별 users_with_reco, reco_rows, avg_reco_count, users_under_5, **under_5_ratio(목표 ≤ 30%)**, seen_rate, likes_sent, passes_sent, matches_created, **like_to_match(목표 ≥ 8%)**), `v_reco_gender_balance`(mode 별 female/male/female_ratio, **데이팅 여성 비율 ≥ 35% 1순위 KPI**), `v_reco_daily_summary`(유저별). 성비 큐 조정 파라미터는 `app_settings.reco_gender_balance`, 점수·재노출 파라미터는 `app_settings.reco_params` — D8 어드민 설정 화면에서 service role 로 편집 가능(값 의미는 §2·§3 표).
21. **D4 `send_first_message`**: `first_suggestion` 에서 `id` 로 카드를 찾아 `body` 를 원문으로 insert(마스킹 룰 통과는 D4 책임), `suggestion_template_id = template_id`. 카드 본문은 이미 연락처/장소/시간 확정 표현이 없도록 단위 테스트로 강제됨.
22. **D5 연동**: `reports` 양방향 존재 → 영구 후보 제외, `blocks` → 후보 제외 + 트리거가 오늘 추천 삭제(D1 §0-27), `active_sanction_level ≥ 3` → 뷰어·후보 모두 제외, `hidden_at` → 제외. D5 는 별도 호출 불필요.

### D6 (Phase 3) · 구조적 티어 대응
23. `entitlement_value(tier, key)`(SQL) 가 `ENTITLEMENTS` 의 미러(`daily_reco_limit 5/15/30`, `weekly_superlike_quota 1/5/15`, `undo 0/1/1`, `liker_priority 0/0/1`, `daily_superlike_cap 5`, `undo_window_sec 300`). **`entitlements.ts` 를 바꾸면 이 함수도 같이 바꾼다**(문서 개정 필수, A4 §5-11). `get_effective_tier()` 가 `plus/pro` 를 돌려주기 시작하면 추천 수·쿼터·undo·liker 상한 해제가 자동으로 켜진다(로컬 검증 T7: plus 로 undo 성공·limit 15).
24. 부스트(`boosts` 활성 행) 는 `pair_features` 가 `+0.15` 로 이미 읽는다(Phase 3 전엔 행이 없어 0). A3 §6.3-4 대로 **온디맨드 생성에만** 영향(배치 완료된 당일 추천은 불변).
25. 슈퍼라이크 구매 잔액(`item_ledger`) 은 Phase 3: `act_on_recommendation` 의 `NO_SUPERLIKE` 분기 직전에 "쿼터 0 → ledger 잔액 차감" 을 끼우면 된다(사용 순서 쿼터 → 잔액, A4).

### 공통 · 보안
26. **service 전용 함수**(`revoke … from public, anon, authenticated` 적용): `reco_param`, `is_complete_profile`, `pair_features`, `score_pair`, `reco_reasons`, `reco_candidates`, `generate_daily_recommendations`, `run_daily_recommendation_batch`, `set_match_first_suggestion`. **authenticated**: `ensure_today_recommendations`, `act_on_recommendation`, `undo_last_action`, `superlike_status`(본인만), `match_suggestion_input`(당사자만), `likers_count`, `pending_likes_count`, `matching_home_summary`, `entitlement_value`. 뷰 3개는 service role 만 select.
27. `act_on_recommendation` 은 RLS 와 같은 `can_like()` 를 호출해 실패 사유를 `NOT_VERIFIED / SANCTIONED / NOT_ENTITLED` 로 매핑한다(D1 §0-9). `likes` 직접 insert 정책은 최종 방어선으로 유지.
28. RPC 타입은 `packages/db/src/types.ts` 가 D3 경로가 아니라 **`lib/matching/rpc.ts` 에 로컬 선언 + `callRpc()` 캐스팅**으로 호출한다. 오케스트레이터가 §7 블록을 `Database["public"]["Functions"]` 에 병합하면 캐스팅을 제거할 수 있다.

---

## 1. 파일 구성

| 경로 | 내용 |
|---|---|
| `supabase/migrations/20260902000020_matching_engine.sql` | `app_settings(reco_params, reco_gender_balance)`, `entitlement_value`, `is_complete_profile`, `pair_features`, `score_pair`, `reco_reasons`, `reco_candidates`, `generate_daily_recommendations`, `run_daily_recommendation_batch`, `ensure_today_recommendations`, 뷰 3, 권한 |
| `supabase/migrations/20260902000021_matching_actions.sql` | `superlike_status`, `match_suggestion_input`, `set_match_first_suggestion`, `act_on_recommendation`, `undo_last_action`, `likers_count`, `pending_likes_count`, `matching_home_summary`, pg_cron 잡, 권한 |
| `supabase/functions/daily-recommendations/index.ts` | Deno · service role · 페이지 반복 + 재시도 · 멱등 |
| `apps/web/lib/matching/rpc.ts` | RPC 이름·반환 타입·`callRpc()` |
| `apps/web/lib/matching/score.ts` | 점수식 TS 미러(순수 함수) + `scorePercent/scoreBucket/isIntroWelcome` |
| `apps/web/lib/matching/suggestions.ts` | 템플릿 29(A3 18 + 11) + `buildSuggestions()`·`parseSuggestionInput()`·`humanSlot()` |
| `apps/web/lib/matching/queries.ts` | `getTodayRecommendations / getHomeSummary / getMatches / getMatch / getLikersCount / getSuperlikeStatus / ensureFirstSuggestion` |
| `apps/web/lib/matching/actions.ts` | `actOnRecommendation / markRecommendationSeen / undo / ensureTodayRecommendations` |
| `apps/web/lib/matching/{score,suggestions}.test.ts` | vitest 30개 |

## 2. 점수식 (최종)

```
score(a→b) = clamp01( 0.40·hobby + 0.35·quiz + 0.15·avail + 0.10·mutual
                      + liker·0.10 + active48h·0.03 − inactive7d·0.10 + boost·0.15 [+ new72h·0.05] )   (소수 4자리)
```

| 항 | 정의 | 파라미터(`app_settings.reco_params`) |
|---|---|---|
| **hobby** | `0.7·tagJaccard + 0.3·categoryJaccard`. tagJaccard = Σ min(wA,wB)·pen / Σ max(wA,wB), **w = rank ≤ 3 ? 2 : 1**, pen = \|iA−iB\| ≥ `intensity_penalty_gap`(3) ? 0.5 : 1. categoryJaccard = 취미 대분류 집합 자카드(F-069: 태그 미겹침이어도 분야 일치 점수) | `intensity_penalty_gap` |
| **quiz** | 어느 한쪽 답변 < `quiz_min_answers`(3) → **0.5 중립**(PRD §0-10). 아니면 (문항,선택) one-hot × 문항 `weight` 의 코사인 = Σ_same w² / √(Σ_A w²·Σ_B w²) | `quiz_min_answers` |
| **avail** | (weekday, slot) 집합 자카드 | — |
| **mutual** | b 가 a 를 좋아함 → 1.0 / b `last_active_at` 48h 내 → 0.3 / 0 | — |
| 보정 liker | +0.10, 생성 시 `is_from_liker`, 일일 상한 ceil(limit×0.4) = 무료 2 (pro `liker_priority` 는 해제) | `liker_bonus`, `liker_ratio` |
| 보정 신규 | 가입 72h **AND** 완성 프로필(승인 사진 ≥1 + Top3 + 퀴즈 10) → +0.05, 후보의 **일 부스트 노출 ≤ 40** 초과 시 보정 없이 순수 점수 | `new_bonus`, `new_hours`, `new_daily_exposure_cap` |
| 보정 활동 | 48h 내 +0.03 / 7일↑ −0.10 (48h~7d 는 0) | `active_bonus`, `inactive_penalty` |
| 보정 부스트 | Phase 3 `boosts` 활성 +0.15 | `boost_bonus` |
| 사진 피처 | **0** (PRD §0-40) | — |

**예시(로컬 검증 T1, 지우 → 민재)**: 취미 = 러닝(둘 다 Top, 5 vs 4)·사진(지우 rank2 / 민재 rank4) → inter 2+1 = 3, union 10 → tag 0.30; 카테고리 {fitness, photo, performance} ∩ {fitness, boardgame, cafe, photo} = 2/5 = 0.40 → hobby 0.33. 퀴즈 10문항 동일 → 1.0. 시간대 {토아침, 일아침, 수저녁} ∩ {토아침, 일아침, 토오후} = 2/4 = 0.5. 활동 48h → mutual 0.3. base = 0.132 + 0.35 + 0.075 + 0.03 = **0.587**, +0.03(활동) = **0.617**, 신규 완성 프로필이면 **0.667**. TS `scorePair()` 가 같은 값을 낸다(`score.test.ts`). reasons: `공통 취미: 러닝·사진·출사` / `토요일 아침에 시간이 맞아요` / `궁합 퀴즈 10/10 일치` / `서울 근처`.

## 3. 후보 필터 · 재노출 · 우선 노출

### 3.1 후보 (`reco_candidates(profile_id, loop_date)`)
최상위 순서 = 모드 일치 → 가시성/제재/상태 → 관계 제외 → 재노출 규칙 → 리전.

| 조건 | 규칙 |
|---|---|
| 뷰어 자격 | `active`, L2+, `hidden_at null`, 제재 < 3. 아니면 빈 결과(생성 skip `reason:not_eligible`) |
| 후보 기본 | `active`, L2+, `hidden_at null`, `onboarding_step ∈ verify/done`, **같은 `mode`**, 제재 < 3, `last_active_at ≥ now−14d` |
| 데이팅 | 양쪽 `gender`·`seeking_gender` 존재 + 상호 일치(`any` 허용) |
| 영구 제외 | 차단 양방향, `matches` 행 존재(상태 무관 — 종료된 매칭도 재추천 안 함), 신고 양방향 |
| 대기 제외 | 내가 보낸 좋아요(`likes.from=나`) — 상대 응답 대기 |
| 리전 | 같은 **시도**(앞 2자리) 풀이 `region_pool_min`(300) 이상이면 같은 시도만, 미만이면 전국 폴백(`nationwide`). 동점 시 같은 시도 우선 |

### 3.2 재노출 (`daily_recommendations` 이력 기준, 파라미터 `reco_params`)

| 상태 | 정의 | 재노출 |
|---|---|---|
| 오늘 이미 추천 | 같은 `loop_date` 행 | 제외(유니크) |
| 패스 | `action='pass'` | `loop_date` 기준 **30일** 후 |
| 본 것만 1회 | `seen_at` ∧ `acted_at null` | **7일** 후 1회 |
| 본 것만 2회↑ | 30일 창 안에 seen-only 행 ≥ 2 | **30일** |
| 안 본 것 | `seen_at null` | 다음날 즉시 |
| 좋아요 보냄 / 매칭 / 차단 / 신고 | — | 제외(영구 또는 응답까지) |
| 미접속 14일 | 후보 `last_active_at` | 제외, 복귀 시 자동 해제 |

### 3.3 우선 노출 (`generate_daily_recommendations`)
1. 후보를 `score_no_new desc, same_sido desc, created_at desc` 로 순회.
2. **나를 좋아한 사람** ≤ ceil(limit × 0.4)(무료 2) — 초과분은 그날 제외(다음날 다시 후보). pro `liker_priority` 는 상한 없음(+0.10 으로 자연히 최상단).
3. **신규 부스트**: 후보의 오늘 `is_boosted` 노출 수 < 40 이면 +0.05 적용·`is_boosted=true`, 아니면 순수 점수로 그대로 포함.
4. **성비 큐 조정**(데이팅, `reco_gender_balance`): `enabled` ∧ 뷰어 남성 ∧ (데이팅 L3 활성 중 여성 비율 < `min_female_ratio` 0.35) 이면, 여성 후보의 오늘 총 노출 수 ≥ `female_daily_exposure_cap`(30) 일 때 그 뷰어에게는 건너뜀 → 소수 성별이 소수의 남성에게만 몰리지 않게 분산. 기본 비율 충족 시 비활성. F-057 남성 웨이팅(Phase 2)은 이 파라미터 위에 얹는다.
5. limit = `entitlement_value(get_effective_tier(user_id), 'daily_reco_limit')`. 부족분은 빈 자리(재노출로 채우지 않음, A3 §6.1).

## 4. 배치 흐름

```mermaid
flowchart LR
  subgraph cron["pg_cron 21:50 UTC (06:50 KST)"]
    C[run_daily_recommendation_batch(null,null,0)]
  end
  subgraph edge["Edge Fn daily-recommendations (수동/외부 스케줄러)"]
    E1[POST {batch_size 200}] --> E2[RPC batch offset=0] --> E3{done?}
    E3 -- no --> E4[offset += processed, 재시도 3회] --> E2
    E3 -- yes --> E5[요약 응답 + audit_logs]
  end
  C --> G
  E2 --> G[generate_daily_recommendations(profile, loop_date)]
  G --> S{같은 loop_date 행 있음?}
  S -- yes --> K[skip 멱등]
  S -- no --> F[reco_candidates → pair_features 점수화] --> P[liker 40% · 신규 40회 · 성비 캡 · limit] --> I[insert daily_recommendations] --> N[pg_notify duckmate_reco]
  subgraph user["07:00 이후 유저 접속"]
    U[getTodayRecommendations] --> ET[ensure_today_recommendations RPC] --> G
  end
  N --> D7[D7 슬롯 A 07:30: v_reco_daily_summary]
```

액션 흐름: `actOnRecommendation` → 레이트리밋(30/분) → `act_on_recommendation` RPC(행 잠금 → `can_like` → 쿼터 → `likes` upsert → 추천 행 acted → 상호 좋아요면 `matches` insert + 상대 추천 행 acted + audit + notify → `suggestion_input` 반환) → 서버 액션 `buildSuggestions()` → `set_match_first_suggestion`(service, 비어 있을 때만) → 응답에 `firstSuggestion`.

## 5. 제안 카드 판정

- **템플릿 위치 = TS(`suggestions.ts`)**, SQL 은 입력(`match_suggestion_input`)과 기록(`set_match_first_suggestion`)만. 이유: 한국어 카피·다양성 규칙은 단위 테스트가 쉬운 TS 가 낫고, 매칭 트랜잭션 안에서 문자열 조립을 하면 카피 수정마다 마이그레이션이 필요하다. 레이스(상대가 먼저 열람)는 `getMatch()` 자기 치유 + "비어 있을 때만 set" 으로 흡수.
- 3장 유형 고정 online/offline/talk. 기본 순서 online→offline→talk, **오프모임 성향**(friend ∧ 같은 지역 ∧ 겹치는 시간대 ∧ 1순위 공통 취미 카테고리 ∈ fitness/cafe/boardgame/travel/photo/performance) 이면 offline 먼저. dating 은 offline 을 앞세우지 않는다.
- `{fav}` 는 카드가 양쪽에 공유되므로 **두 사람의 `fav_note` 가 같은 취미에서 동일할 때만** 사용(뷰어 중립). 다르면 그 취미의 비-fav 템플릿.
- 공통 취미 없음 → 범용(GEN-3 online / GEN-4 offline(같은 지역) / GEN-2·GEN-5·GEN-1 talk). 지역·시간대 둘 다 없으면 offline 카드는 talk 로 대체(3장·서로 다른 template_id 는 항상 보장).
- 추가 템플릿 11: `GEN-3`(online 범용) `GEN-4`(offline 범용) `GEN-5`(talk 범용) `FIT-1` `GAME-3` `CAFE-2` `BOOK-2` `ANIME-3` `TRAVEL-1` `MUSIC-1` `PETS-1` — "카테고리마다 `*-1` talk" 규칙(PRD §0-41) 을 12 카테고리 전부에 적용. A3 원문 중 문장 끝이 마침표인 4개(ANIME-2, IDOL-1, RUN-1, CODE-1)와 CAFE-1·RUN-2 는 "질문으로 끝남" 규칙에 맞춰 어순만 손봄.
- 새 취미 카테고리를 시드에 추가하면 `SUGGESTION_TEMPLATES` 에 `*-1` talk 를 같이 추가(테스트가 12 카테고리를 검사하므로 목록도 갱신).

## 6. 검증 결과 (2026-09-02)

**환경**: 로컬 PostgreSQL 16.13 + D1 셰임(auth/storage/롤/default privileges, 레포 미포함). `0001~0014 + 0020 + 0021` 순서 적용 + `seed.sql`, 그 위에 신규 L2 2명(지우·태양) 추가 → 6명. pg_cron 은 로컬에 없어 notice 후 skip(프로덕션 Supabase 에서 등록). Docker 없음 → `supabase start` 미실행(오케스트레이터 `db reset` 1회 재확인 권장).

| # | 시나리오 | 결과 |
|---|---|---|
| T0 | 마이그레이션 16개 + seed 적용 | 전부 성공, 경고 0 |
| T1 | `pair_features` 지우→민재 | hobby .33 (tag .30 / cat .40) · quiz 1.0 · avail .5 · mutual .3 · base .587 · score .617 / 신규 .667, reasons 4개(§2 예시). TS `scorePair` 동일 값 |
| T1 | intensity 차 ≥3 페널티 | 웹툰(5 vs 2) 기여 ×0.5 → tag_jaccard 0.0417(없으면 0) |
| T2 | 후보(서윤) | 5명, 같은 시도 풀 3 < 300 → `nationwide=true` |
| T2 | 배치 #1 / #2 / 페이지(size 2) | generated 6 → skipped 6(멱등) → processed 2·done=false·next_offset 2 |
| T2 | 생성 결과 | 6명 모두 ≤5(지우는 서윤 제외 4), score ∈ [0,1]; 서윤 1위 = 지우 `[liker]` 0.46(+0.10), 민재 `[new]`(유일한 완성 프로필) |
| T2 | 신규 부스트 일 노출 상한 | cap 40 → boosted 5행, cap 1 → 1행 |
| T3 | 재노출 | 내일: pass(도현)·seen-only(민재) 제외, unseen(하은)·지우 포함 / +8d: 민재 복귀, 도현 제외 / +31d: 도현 복귀 / seen-only 2회 → +16d 제외 |
| T3 | 미접속 14일 | 태양 제외 → 접속 갱신 후 복귀 |
| T4 | `ensure_today_recommendations`(authenticated JWT) | 5명 생성 → 재호출 `skipped=true` |
| T4 | 권한 | authenticated: `generate`/`batch`/`set_match_first_suggestion`/`v_reco_metrics_daily` 전부 permission denied; anon: `ensure_today` denied |
| T4 | `v_profile_public` | 하은에게 오늘 추천 5명 전부 가시 |
| T5 | pass → like 재시도 | `ALREADY_ACTED: pass`; 같은 pass 재호출 `already=true` |
| T5 | 하은→서윤 like, 서윤→하은 like | 두 번째에서 `matched=true, match_id`, `mode=friend`, 하은의 추천 행도 `action=like`, `v_my_matches` 에 상대 표시 |
| T5 | `match_suggestion_input` / `set_match_first_suggestion` | 입력 jsonb 정상, set=true → 재호출 set=false(멱등), 2장은 `INVALID_INPUT` 거부 |
| T5 | 매칭 쌍 | 이후 후보에서 제외 |
| T6 | 슈퍼라이크 | 상태 `quota 1 used 0` → super 1회 성공(remaining 0) → 2회째 `NOT_ENTITLED: NO_SUPERLIKE`; 지우가 먼저 좋아했으므로 super 로 매칭 |
| T6 | 추천에 없는 대상 | `NOT_FOUND: recommendation` |
| T7 | undo 무료 | `NOT_ENTITLED: undo requires plus` |
| T7 | undo 플러스(`payments_enabled=true` + subscriptions 행) | tier=plus, 매칭된 좋아요 `ALREADY_ACTED: matched`, pass 되돌리기 성공(행 `action null`) → 다시 pass 가능, 301초 경과 `NOT_FOUND: EXPIRED`, `daily_reco_limit` 15 |
| T8 | 데이팅 후보 | 민재(남, seeking female) → 서윤만(지우는 seeking 불일치, 태양 남성) |
| T8 | 성비 큐 조정 | `min_female_ratio .99 + cap 0` → count 0·`gender_balance_applied=true`; 기본값 → 1명 |
| T8 | 뷰 | `v_reco_gender_balance`(dating f=2 m=2 .5), `v_reco_metrics_daily`, `v_reco_daily_summary` 조회 OK; `audit_logs(reco_batch_ran)` 4행 |
| vitest | `lib/matching/score.test.ts` 18 + `suggestions.test.ts` 12 | 30 통과; 웹 전체 157 통과 |
| typecheck | `pnpm --filter @duckmate/web typecheck` | D3 경로 오류 0 (실패 3건은 전부 `lib/admin/*` — D8 진행 중 파일) |
| 비밀값 | `grep` service_role/JWT/secret in D3 경로 | 없음 |

미실행: Supabase 컨테이너·pg_cron 실등록·Edge Function 실행(Deno 없음). `supabase functions serve daily-recommendations` 로 오케스트레이터가 1회 확인 권장.

## 7. 오케스트레이터 병합 요청 (공용 파일 미수정)

1. **`.env.example`** 에 Edge secrets 주석 추가: `# DAILY_RECO_WEBHOOK_SECRET=  # 외부 스케줄러 → daily-recommendations 호출 시 x-webhook-secret (pg_cron 사용 시 불필요)`.
2. **`packages/db/src/types.ts` `Functions`** 에 추가(그 후 `lib/matching/rpc.ts` 의 `callRpc` 캐스팅 제거 가능):
   ```ts
   // ---- D3 (0020·0021) ----
   ensure_today_recommendations: { Args: Record<string, never>; Returns: Json };
   act_on_recommendation: { Args: { p_target_id: string; p_action: Enums["reco_action"] }; Returns: Json };
   undo_last_action: { Args: Record<string, never>; Returns: Json };
   superlike_status: { Args: { p_profile_id?: string | null }; Returns: Json };
   match_suggestion_input: { Args: { p_match_id: string }; Returns: Json };
   likers_count: { Args: Record<string, never>; Returns: number };
   pending_likes_count: { Args: Record<string, never>; Returns: number };
   matching_home_summary: { Args: Record<string, never>; Returns: Json };
   entitlement_value: { Args: { p_tier: Enums["subscription_tier"]; p_key: string }; Returns: number };
   /** service role 전용 */
   set_match_first_suggestion: { Args: { p_match_id: string; p_cards: Json }; Returns: Json };
   generate_daily_recommendations: { Args: { p_profile_id: string; p_loop_date?: string | null; p_limit?: number | null }; Returns: Json };
   run_daily_recommendation_batch: { Args: { p_loop_date?: string | null; p_batch_size?: number | null; p_offset?: number }; Returns: Json };
   reco_candidates: { Args: { p_profile_id: string; p_loop_date?: string | null }; Returns: Array<{ target_id: string; is_liker: boolean; same_sido: boolean; pool_size: number; nationwide: boolean }> };
   pair_features: { Args: { p_a: string; p_b: string }; Returns: Json };
   ```
   `Views` 에 `v_reco_daily_summary / v_reco_metrics_daily / v_reco_gender_balance`(service 전용, 선택).
3. **의존성 추가 없음**(zod·supabase-js 기존 사용). Edge Function 은 `_shared` 만 사용.
4. `supabase/seed.sql` 의 하드코딩 추천 5행은 그대로 둬도 된다(같은 loop_date 가 있으면 엔진이 skip). E2E 가 "서윤 ↔ 민재 상호 추천" 을 기대하므로 유지 권장.
5. D7 `purge_daily`: `daily_recommendations.loop_date < loop_date(now()) - 60` 삭제 추가(§0-19).

## 8. 미결·후속

- 성능: `pair_features` 는 후보당 쿼리 6~8개(플러스 상한 이내의 Phase 1 규모에 충분). 유저 1만↑ 시 프로필별 피처 배열 캐시 테이블(`profile_features`) + set-based 점수화로 교체 — 수식은 그대로.
- `v_reco_metrics_daily` 의 `matches_created` 는 loop_date 별 전체 매칭(추천 경유 여부 무관). 추천 경유만 세려면 `matches` 에 `source_reco_id` 추가 요청(D1).
- 종료된 매칭(left/blocked) 쌍은 영구 제외한다(D1 §0-44 "해제해도 매칭 복구 없음" 과 일관). 재추천을 허용하려면 `reco_candidates` 의 `matches` 조건에 `status='active' or ended_at > now()-30d` 로 완화.
- `undo_last_action` 은 "마지막 행동" 기준(매칭된 좋아요가 마지막이면 그 앞의 패스도 되돌릴 수 없음). A4 의 `undo_last_pass`(마지막 **패스**) 의미로 바꾸려면 `where action='pass'` 한 줄.
