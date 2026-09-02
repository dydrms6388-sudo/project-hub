# 30 — 리텐션 실험 설계 (F3)

> 입력: `00_brief.md`(KPI D1 40 / D7 20 / D30 10, 푸시 일 2건, 게임 8요소), `03_core_loop.md`(루프·07:00 리셋·푸시 슬롯·이벤트명), `20_notifications.md`(정책·템플릿 키·예산·리마인더·재동의), `04_monetization.md`(다크패턴 금지 16항·결제 트리거·ledger `quest:` ref), `02_persona.md`(이탈 지점·안티 요구사항 20항), `10_brand.md`(카피 원칙·금지 표현 §4.4·#31 스트릭 끊김 카피), `06_PRD.md`(§6 KPI·§6.1 이벤트·F-065/066/090/091), `21_admin.md`(0060 지표 함수·§8 미결), `16_matching.md`(성비 큐·재노출·`v_reco_*` 뷰), `07_legal_checklist.md`(광고성 정보·야간 제한·자동화 결정).
> **문서만 작성한다 — 코드 없음**(Phase 1 게이트 미통과, 브리프 절대 규칙 1). SQL/TS 스니펫은 계약 표기용이며 파일로 만들지 않는다. `28_game_design.md`(F1 작성 중)는 참조하지 않고 브리프 §게임 8요소만 전제로 한다.
> 기준일 2026-09-02. 시간은 전부 KST, 일 경계 = `loop_date()`(07:00), 주 경계 = `week_start_loop_date()`(월 07:00).

## 다음 에이전트에게 넘기는 결정사항

### 실험 플랫폼 (D7·D8 — 마이그레이션 0090~0093 예약)
1. **배정 = 서버측 결정적 해시, 외부 SaaS 없음.** `bucket = ('x' || substr(md5(user_id::text || ':' || experiment_key || ':' || salt), 1, 8))::bit(32)::int % 100` (0~99). 같은 유저는 같은 실험에서 항상 같은 버킷, 실험 간에는 독립(키가 다르면 해시가 다름). `salt`는 `experiments.salt`(실험 생성 시 무작위 16자, 변경 금지). 클라이언트는 버킷을 계산하지 않는다 — `get_experiment_variant(experiment_key)` RPC(authenticated, 본인만)가 variant 문자열을 돌려주고 서버 배치(푸시)는 SQL 함수 `experiment_variant_for(profile_id, key)`를 직접 호출.
2. **테이블 3개(0090)**: `experiments(key pk, name, hypothesis, status(draft/running/paused/concluded), salt, unit('user'), variants jsonb[{name, weight, config}], primary_metric, guardrails jsonb, started_at, ended_at, min_sample, planned_end_at, owner)`, `experiment_assignments(profile_id, experiment_key, variant, bucket, assigned_at, pk(profile_id, experiment_key))` — **첫 노출 시점에만 insert**(배정은 결정적이므로 이 표는 "노출된 적 있음"의 기록), `experiment_events(id, experiment_key, profile_id, variant, kind('exposure'|'conversion'|'guardrail'), metric_key, value numeric, loop_date, created_at)`. 전부 service role 전용, RLS 본인 select만(`experiment_assignments`).
3. **가중치는 버킷 구간으로 고정**: 2안 = 0~49 A / 50~99 B, 3안 = 0~32 / 33~65 / 66~99. 실험 중 가중치·salt 변경 금지(변경 = 새 `experiment_key`). `status='paused'`면 전원 control 노출(배정 기록은 유지).
4. **노출 이벤트 규약**: 화면 실험은 클라이언트 `track('experiment_exposed', {experiment_key, variant, surface})` + 서버 `experiment_events(kind='exposure')` 이중 기록(분석은 서버 행 기준, 클라이언트 행은 대조용). 푸시 실험은 `push_queue.params.variant`에 싣고 `notification_log`에 **`variant text` 컬럼 추가(0090)** → 전송 성공 행이 곧 노출.
5. **전환은 이벤트가 아니라 베이스 테이블에서 계산한다**(클라이언트 `analytics_events`는 insert 자유라 보상·판정 근거로 쓰지 않음, D1 §0-10). 루프 완주 = `daily_recommendations(seen_at)` ∧ `likes(loop_date)`, 첫 메시지 = `matches.first_message_at`, 오픈 = `notification_log.opened_at`. `experiment_events(kind='conversion')`는 배치가 하루 1회 베이스 테이블에서 파생해 적재(재계산 가능).
6. **가드레일 3종 자동 판정(0093 뷰 `v_experiment_guardrails`)**: 신고율(`reports`/`matches`, 매칭 기준) · 차단률(`blocks`/활성 유저) · 언서브율(`push_subscriptions.disabled_at` 갱신 + `push_prefs` 슬롯/서비스 OFF 전환 + `consents(marketing_push, agreed=false)`). variant가 control 대비 **+50% 이상 악화 AND 절대 사건 수 ≥ 10**이면 `status='paused'` 자동 전환 + `notify_admin_push('experiment_guardrail', …)`.
7. **분석 뷰(0093, service role)**: `v_experiment_results(experiment_key, variant, exposed_users, conversions, rate, loop_date_from, loop_date_to)`, `v_experiment_guardrails`, `v_retention_cohort_daily`, `v_loop_completion_daily`, `v_streak_distribution`, `v_quest_metrics_daily`, `v_churn_risk_daily`, `v_event_metrics`. D8 `/admin/metrics`에 "리텐션" 탭 추가(§9).
8. **활동 사실 테이블 `user_activity_days(profile_id, loop_date, first_open_at, source, push_slot, pk(profile_id, loop_date))`(0093)**: `touch_activity(p_source, p_push_slot)` RPC(authenticated, `current_profile_id()`만)가 upsert. D1/D7/D30·스트릭·이탈 룰의 "접속" 근거는 이 표다(`profiles.last_active_at`은 마지막 시각만 남고 클라이언트가 덮어쓸 수 있어 코호트 계산 불가). E5 `track('app_opened')` 직후 같은 요청에서 호출.

### 스트릭·퀘스트 (F2·D7 — 0091)
9. **스트릭 단위 = "루프 완주일"**, 접속이 아니다. `loop_date`에 (a) `daily_recommendations.seen_at`≥1 ∧ `likes.created_at`이 같은 loop_date에 ≥1 **또는** (b) 오늘의 궁합 카드 뒤집기(`game_sessions(game_type='daily_card', loop_date)` 행 존재) 중 하나면 그날은 완주. 추천 풀이 비어 좋아요를 보낼 수 없는 유저(§6 `short`)는 (a) 대신 `seen_at`≥1만으로 인정(빈 칸 표시 유저의 불이익 방지).
10. **스트릭은 서버 함수 `recompute_streak(profile_id)`만 갱신**(service/definer). `game_profiles`에 `streak_last_loop_date date, streak_best int, freeze_stock smallint(0~1), freeze_used_on date` 추가. 07:05 배치 `streak_daily()`가 전날 미완주자를 판정(프리즈 자동 적용 또는 0으로 리셋). 클라이언트는 읽기만.
11. **보상은 `item_ledger`(ref=`quest:streak_{n}:{loop_date}`)로만**, 코인 없음(`game_profiles.coins`는 Phase 2에서 사용하지 않음). 7일 배수마다 슈퍼라이크 1(주 1 상한과 합쳐 무료 유저 주 최대 2), 14일 `card_refill` 1, 30일 프로필 배지. 복구 아이템·스트릭 구매 **없음**(영구 결정, A4 §5-15).
12. **프리즈 = 14일 달성마다 1개 자동 적립, 최대 보유 1, 자동 사용, 구매 불가.** 사용 시 카피 "쉬는 날로 채웠어요" — "지켰다/살렸다" 어휘 금지.
13. **끊김 화면 = 브랜드 #31 원문 고정** + 대안 4개(§3.4). 끊김을 알리는 **푸시는 존재하지 않는다**(예산 소비도, transactional도 아님). 끊김 사실은 홈 카드 1줄로만.
14. **데일리 퀘스트 4종 키 고정**: `daily_open`, `daily_card`, `daily_vote`, `daily_reply`. 주간 2종: `weekly_loop_5`, `weekly_reply_3`. `quests` 시드 6행(0091), `reward` jsonb는 §4 표. 판정은 전부 **베이스 테이블 파생**(§4.2), `quest_progress` 갱신은 `quest_daily()` 배치 + 행동 직후 RPC 훅(`bump_quest(profile_id, key)`, service 전용; D4 `send_message`, F1 카드/배틀 RPC, D3 `act_on_recommendation` 끝에서 호출).
15. **일 상한**: 데일리 4종 = XP 4×10, 아이템 0. 주간 2종만 아이템(`card_refill` 1 / 슈퍼라이크 1). 유저당 주간 아이템 획득 상한 = 스트릭 포함 슈퍼라이크 2·카드 리필 2(`item_ledger` 검사, 초과분 미적립·audit).
16. **답장 퀘스트 스팸 방지**: 상대가 마지막 발신자인 매칭에서 **내가 보낸 첫 답장 1건만** 카운트(매칭당 일 1회), 10자 미만·`is_held`·`message_flags` hit·직전 내 메시지와 동일 본문은 제외, 제안 카드 자동 전송 첫 메시지는 답장이 아니다(`suggestion_template_id` not null 제외). D4 분당 30건 레이트리밋·`SC_MASS_LIKE` 룰과 별도로 **일 퀘스트 카운트 상한 3매칭**.

### 이벤트 (F3 Phase 5·D1·D5 — 0092)
17. `events`에 `kind('online'|'offline')`, `rsvp_opens_at`, `rsvp_closes_at`, `checkin_code_hash`, `safety_ack_required bool` 추가. `event_rsvps`에 `checked_in_at`, `safety_ack_at`, `waitlisted bool`, `canceled_at` 추가. `rsvp_status` enum에 `no_show` 값 추가.
18. **호스트 요건**: Phase 5 = 운영팀 계정(`admin_users`)만, 조건 L3. 사용자 호스트 개방(Phase 5 이후 별도 결정)은 L3 ∧ 이벤트 참가(체크인) 3회 ∧ 최근 90일 `NO_SHOW` 0 ∧ 활성 제재 0. `events.host_id`는 반드시 L3 프로필.
19. **노쇼 = 체크인 없음 + 호스트 신고**. 호스트가 이벤트 종료 후 24h 내 `create_report(reason_code='NO_SHOW', surface='event')` — `report_surface` enum에 `event` 추가(0092). A5·PRD §0-17 그대로 3회/90일 → 이벤트 참가 제한 30일(`sanctions.level=1, reason='NO_SHOW_X3'`), 재범 90일. 참가자가 호스트를 신고하는 경로도 동일 코드.
20. 오프라인 이벤트는 **정원 ≤ 8(기존 제약)·공개 장소·운영팀 동석**, 상세 위치는 RSVP 확정자에게만 이벤트 시작 24h 전 공개(그 전엔 구 단위). 위치 공개 자체는 `region_code` 이상 세분화 금지 원칙의 **예외가 아니라** 운영자가 고른 공개 장소 주소(사용자 위치 아님).

### 푸시 A/B (D7)
21. **템플릿 변형은 `push_templates.variants jsonb`로 두고 `renderPush(key, params, {variant})`가 선택**. 카피 lint(`lintCopy`)는 변형마다 돈다. 변형 카피는 §6 표 확정본이며 전부 `kind='service'` 유지(혜택·유료·이벤트 언급 없음 → 광고성 아님, B1 §4). 야간 23~07 보류·예산·슬롯 B 우선순위·리마인더 30일 2건 상한은 **실험이 건드리지 않는다**.
22. 푸시 실험 단위 = 유저(발송 아님). 오픈율은 발송 기준 비율에 군집 보정(설계 효과 1.5)을 적용해 표본을 산정한다(§6.3). 3안 실험은 Bonferroni(α=0.025).
23. 실험 1개당 슬롯 하나만. 슬롯 A 실험과 슬롯 B 실험을 동시에 돌려도 되지만 **같은 슬롯에 2개 실험 금지**(상호작용).

### 이탈 룰 (D7·D3·E2 — ML 없음)
24. `churn_score_daily()` 배치(07:10)가 `v_churn_risk_daily`에 점수를 적재하고, 개입은 **기존 슬롯 B 우선순위 표 안에서** 실행한다(새 슬롯 없음, 예산 2건 불변). 개입 푸시는 유저당 7일 1건 상한(`reminder_cap_30d`와 합산 관리).
25. 인앱 개입(제안 카드 재노출·인증 유도·전국 폴백 제안)은 푸시 예산을 쓰지 않고 홈 상단 1줄(닫기 가능, 주 1회 재표시 — A3 §4.1 넛지 규칙과 동일 슬롯 공유: **동시 1개**).
26. "마스킹 해제 직후 이탈"(양쪽 72h+L3 후 둘 다 7일 미접속)은 이탈이 아니라 **졸업 후보**로 분리 집계(A4 §10). 푸시 개입 금지, 측정만.

### KPI (D8)
27. D1/D7/D30 = **가입 loop_date + N일 당일 접속**(엄격 day-N, `user_activity_days` 기준). 보조로 "N일 창(N−1~N+1)" 값을 같은 뷰에 병기. 가입일 = `profiles.created_at`의 loop_date, 분모 = 그날 가입 중 `age_blocked` 제외·L2 도달자(추천을 본 적이 없는 L1은 리텐션 정의 밖 → 온보딩 지표).
28. D8 함수 6개 추가 요청: `admin_metrics_retention(p_days)`, `admin_metrics_loop(p_days)`, `admin_metrics_streak()`, `admin_metrics_quests(p_days)`, `admin_metrics_experiment(p_key)`, `admin_metrics_events(p_days)`. 기존 `admin_metrics_daily/gender/sla`·`v_push_metrics_daily`·`v_reco_gender_balance`는 그대로 인용(§9 매핑표).

### 절대 실험하지 않는 것 (전 그룹)
29. 가격·무료 한도 하향·안전 기능·동의 화면·법적 문구·해지 마찰·야간 창·예산 상한·성비 큐 파라미터를 변수로 두는 실험 금지(§8.2). 실험 결과가 유의해도 가드레일(§0-6) 악화 시 채택 금지.
30. Phase 2 게이트(PRD §8) "죄책감 카피 리뷰 통과"는 본 문서 §3.4·§6 표 + `copy-lint.json` 통과를 근거로 한다.

---

## 1. 목표와 가설 구조

| KPI | 목표 | 주 레버(본 문서) | 측정 |
|---|---|---|---|
| D1 40% | 가입 다음날 07:00 이후 재접속 | 슬롯 A 카피(§6), 온보딩 퀴즈 기본값(§8), 첫 매칭 안전 모달 길이(§8) | `v_retention_cohort_daily` |
| D7 20% | 첫 주 루프 습관 | 스트릭 3·7일(§3), 데일리 퀘스트(§4), 주간 이벤트 예고(§5) | 동상 + `v_loop_completion_daily` |
| D30 10% | 매칭 성과 체감 | 이탈 룰 개입(§7), 전국 폴백·인증 유도, 주간 퀘스트 | 동상 + `v_churn_risk_daily` |
| 루프 완주율 ≥ 50% | 접속한 날 완주 | 카드 위치·추천 수·제안 카드 순서 실험(§8) | `daily_loop_completed`/`app_opened` |

원칙: (1) **완주가 접속보다 상위** — 접속만 늘리는 장치(가짜 알림·카운트다운)는 금지. (2) 보상은 "루프를 한 사람"에게만, 접속·좋아요 남발에는 주지 않는다. (3) 모든 리텐션 장치는 **끄면 Phase 1 루프로 돌아가야** 한다(피처 플래그 `RETENTION_STREAK`, `RETENTION_QUESTS`, `RETENTION_EVENTS`, `EXPERIMENTS_ENABLED` — `app_settings`).

## 2. 실험 플랫폼

### 2.1 배정
- 단위 = 유저(`profile_id`). 세션·발송 단위 배정 없음(같은 사람이 A·B를 번갈아 보면 안 됨).
- 결정적 해시(§0-1). 배정 시점의 DB 조회가 필요 없으므로 07:30 슬롯 A 배치처럼 수만 명을 도는 함수 안에서도 비용 0.
- 신규 가입 코호트 한정 실험(온보딩 계열)은 `experiments.eligibility jsonb`에 `{"created_after": "<loop_date>"}`로 표현. 기존 유저는 항상 control.
- 실험 가능한 대상 = `status='active'` ∧ L2+ ∧ 활성 제재 없음. 미성년 0 전제(L2는 성인 인증 완료).

### 2.2 테이블 델타 (0090)

```sql
-- 0090_experiments.sql (예약, 작성 금지)
create table public.experiments (
  key text primary key, name text not null, hypothesis text not null,
  status text not null default 'draft' check (status in ('draft','running','paused','concluded')),
  salt text not null, unit text not null default 'user',
  variants jsonb not null,            -- [{"name":"control","from":0,"to":49,"config":{}}, {"name":"b","from":50,"to":99,"config":{}}]
  primary_metric text not null, guardrails jsonb not null default '["report_rate","block_rate","unsub_rate"]',
  eligibility jsonb not null default '{}', min_sample integer not null, planned_end_at timestamptz,
  started_at timestamptz, ended_at timestamptz, owner text, created_at timestamptz not null default now());
create table public.experiment_assignments (profile_id uuid references public.profiles(id) on delete cascade,
  experiment_key text references public.experiments(key), variant text not null, bucket smallint not null,
  assigned_at timestamptz not null default now(), primary key (profile_id, experiment_key));
create table public.experiment_events (id bigint generated always as identity primary key,
  experiment_key text not null, profile_id uuid, variant text not null,
  kind text not null check (kind in ('exposure','conversion','guardrail')),
  metric_key text, value numeric, loop_date date not null, created_at timestamptz not null default now());
alter table public.notification_log add column variant text;
```

함수: `experiment_variant_for(p_profile_id, p_key) → text`(service), `get_experiment_variant(p_key) → text`(authenticated, 본인, 첫 호출 시 `experiment_assignments` insert + exposure 행), `experiment_guardrail_check()`(배치, §0-6), `experiment_conclude(p_key, p_winner)`.

### 2.3 이벤트 규약

| 이벤트 | 기록 주체 | 속성 | 비고 |
|---|---|---|---|
| `experiment_exposed` | 클라이언트 `track()` + 서버 `experiment_events` | `experiment_key, variant, surface` | 화면 첫 렌더 1회/세션 |
| (푸시 노출) | `notification_log.variant` | — | 전송 성공 행만 |
| `experiment_converted` | 서버 배치 파생 | `experiment_key, variant, metric_key` | 클라이언트가 보내지 않음 |
| `experiment_guardrail` | `experiment_guardrail_check()` | `metric_key, control, treatment, ratio, action` | paused 전환 시 admin 알림 |

### 2.4 가드레일·중단 규칙

| 지표 | 정의 | 경고 | 자동 중단 |
|---|---|---|---|
| 신고율 | 기간 내 `reports`(피신고자가 실험 노출자) / 노출자의 `matches` | treatment/control ≥ 1.3 | ≥ 1.5 ∧ 사건 ≥ 10 |
| 차단률 | `blocks`(blocker=노출자) / 노출자 수 | ≥ 1.3 | ≥ 1.5 ∧ ≥ 10 |
| 언서브율 | `push_subscriptions.disabled_at` + `push_prefs.service=false` 또는 슬롯 OFF 전환 + `consents(marketing_push, agreed=false)` / 노출자 | ≥ 1.3 | ≥ 1.5 ∧ ≥ 10 |
| D7(장기) | 실험 코호트 D7 | −3pp | 채택 금지 |

중단 후 재개는 사람이 한다(`status` 수동). 결론 = 표본 충족 ∧ 계획 기간 종료(둘 다) 후에만; 조기 유의성으로 끝내지 않는다(peeking 금지).

## 3. 스트릭

### 3.1 정의
- **1일 = `loop_date` 1개(07:00~익일 07:00).** 06:59 완주는 전날, 07:01은 오늘. 자정 경계 없음.
- 완주 조건 §0-9. "접속"은 스트릭에 포함되지 않는다 — 열기만 하고 닫는 날은 0.
- 연속 = 전날 `loop_date`가 완주(또는 프리즈 적용)이면 +1. 첫 완주일 = 1.
- 표시 위치: 홈 상단 카운터("3일째"), 루프 끝 화면("오늘도 완주 · 4일째"). 카운트다운·"N시간 남음" 표기 금지.

### 3.2 보상표

| 일수 | 보상 | `item_ledger.ref` | 반복 |
|---|---|---|---|
| 3 | 취미 아바타 데코 1종 해금(코스메틱, `game_profiles.badges` jsonb) | — | 최초 1회 |
| 7 (배수) | 슈퍼라이크 1 | `quest:streak_7:{loop_date}` | 7일마다(주 1 쿼터와 별도, 잔액 소멸 없음) |
| 14 | `card_refill` 1 + 프리즈 1 적립 | `quest:streak_14:{loop_date}` | 14일마다 |
| 30 | 프로필 배지 "30일"(덕질 카드 하단 작은 칩, 외모·인기 라벨 아님) | — | 30·60·90… |

슈퍼라이크는 일 상한 5(공통)·주간 획득 상한 §0-15에 걸린다. 보상 안내 카피: "7일 완주 · 슈퍼라이크 1개 받았어요"(사실형, 느낌표 없음).

### 3.3 프리즈
- 적립: 14일 달성마다 1, 최대 보유 1(초과분 소멸, 알림 없음). 구매·광고 시청·초대로 얻는 경로 **없음**.
- 사용: 미완주 판정 시 자동. 홈 카드 "어제는 쉬는 날로 채웠어요 · 프리즈 0개 남음". 사용 여부를 유저가 선택하게 하지 않는다(선택 UI는 "쓸까 말까" 압박이 됨).
- 휴면(`paused`)·제재 기간·서버 배치 실패일(`audit_logs(streak_daily_failed)`)은 프리즈를 쓰지 않고 **경계 정지**(일수 유지, 증가 없음).

### 3.4 끊김 처리 — 죄책감 카피 금지
브랜드 #31 원문(고정): 헤드라인 "오늘 카드 1장 준비돼 있어요" / 본문 "스트릭은 다시 1일부터. 지난 기록은 사라지지 않아요." / 버튼 "카드 보기". 아래 표의 0번이 원문이고 **대안 5개(1~5)** 가 A/B 후보다. 전부 §10 lint 사전 통과(부정형 재촉 표현 포함 0):

| # | 헤드라인 | 본문 | 버튼 | 검사 |
|---|---|---|---|---|
| 0 | 오늘 카드 1장 준비돼 있어요 | 스트릭은 다시 1일부터. 지난 기록은 사라지지 않아요. | 카드 보기 | C1 #31 원문(기본값) |
| 1 | 다시 1일째예요 | 최고 기록 {best}일은 그대로 남아 있어요. | 오늘 추천 보기 | `{best}` 실제 값, 기록 보존 사실 |
| 2 | 오늘 추천 {n}명이 와 있어요 | 오늘 완주하면 다시 1일이 시작돼요. | 추천 보기 | `{n}` 실제 값, 조건-결과 서술 |
| 3 | 새로 시작해요 | 스트릭은 매일 07:00에 새 추천과 함께 이어져요. | 카드 보기 | 시각 사실만 |
| 4 | 어제는 쉬었네요 | 카드 1장·추천 {n}명이 오늘 몫이에요. | 오늘 몫 보기 | 사실 서술, 재촉·평가 어휘 0 |
| 5 | 스트릭 1일 · 최고 {best}일 | 지난 기록은 그대로예요. 오늘 완주하면 2일째가 돼요. | 오늘 완주하기 | 숫자 사실형(`.tnum`), 손실 언급 0 |

금지: "아쉽게도", "놓쳤어요", "사라졌어요", "지켜주세요", "아까워요", "서두를"류 재촉의 부정형(naive lint 오탐 회피), 우는 이모지, 끊김 푸시, 끊김 직전 "오늘 안 하면" 알림. 스트릭 유지 목적의 푸시는 존재하지 않는다 — 슬롯 A/B 카피는 스트릭을 언급하지 않는다(§6).

### 3.5 게이밍 방지
- 판정 근거는 서버 테이블뿐(§0-10). `analytics_events`·`profiles.last_active_at`은 무관.
- 좋아요 1건으로 완주 성립 → 좋아요 남발 유인? 일일 추천 N 상한이 곧 좋아요 상한이라 남발 불가. 보낸 좋아요를 되돌리면(플러스 undo) 그날 `likes` 행이 0이 될 수 있음 → 07:05 배치 시점의 상태로 판정(당일 재계산 없음).
- 카드 뒤집기만으로 완주 성립은 F1 `draw_daily_card` RPC 행 기준(클라이언트 이벤트 아님).
- 다계정: L2 CI 해시 유니크로 차단. 프리즈 적립은 `game_profiles` 단일 행.

## 4. 데일리·주간 퀘스트

### 4.1 데일리 4종 (`quests.kind='daily'`, `quest_progress.loop_date`=당일)

| key | 제목(해요체) | 완료 판정(베이스 테이블) | 보상 | 일 상한 |
|---|---|---|---|---|
| `daily_open` | 오늘 추천 열기 | `user_activity_days(loop_date)` 존재 ∧ `daily_recommendations.seen_at`≥1 | XP 10 | 1 |
| `daily_card` | 궁합 카드 뒤집기 | `game_sessions(game_type='daily_card', loop_date, participants ∋ me)` | XP 10 | 1 |
| `daily_vote` | 취향 배틀 1표 | `game_sessions(game_type='battle', loop_date)` 응답 1 | XP 10 | 1 |
| `daily_reply` | 대화 답장 1개 | §0-16 규칙 충족 `messages` 1건 | XP 10 | 1 (카운트 매칭 ≤3) |

- 4개 전부 완료 시 "오늘 퀘스트 끝" 카드 — 추가 보상 없음(완료 자체가 목표가 되지 않게).
- 게임 슬롯이 없는 요일(A3 §3: 배틀은 목·일 수집, 퀴즈 대전 수)에는 `daily_vote` 대신 `daily_quiz`(퀴즈 대전 5문항) 표시 — 키는 두 개, 노출은 요일별 1개.
- XP → `game_profiles.level`(100 XP당 1). 레벨은 랭킹·노출·매칭 점수에 **영향 없음**(코스메틱만). 취미 랭킹(Phase 5)은 별도 점수식(A3 §3, 좋아요 수 제외).

### 4.2 주간 2종 (`quest_progress.loop_date`=주 시작 월요일)

| key | 제목 | 판정 | 보상 | 비고 |
|---|---|---|---|---|
| `weekly_loop_5` | 이번 주 5일 완주 | 주 내 완주일(§3.1) ≥ 5 | `card_refill` 1 (`quest:weekly_loop_5:{week}`) | 스트릭과 중복 가능 |
| `weekly_reply_3` | 서로 다른 3명에게 답장 | `daily_reply` 규칙 충족 매칭 distinct ≥ 3 | 슈퍼라이크 1 | 주간 획득 상한 §0-15 |

월 07:00 `weekly_reset`(D7 기존 잡)에서 미완료 진행도 폐기, 결과 화면 "지난주 퀘스트 2/2". 이월 없음.

### 4.3 판정·훅
- `bump_quest(profile_id, key)`는 증분만 하고 **최종 완료 판정은 `quest_daily()`(07:05)가 베이스 테이블로 재검증** — 훅 누락·중복 호출 모두 안전.
- 완료 알림은 인앱 토스트만. 퀘스트 완료·미완료·마감 임박 푸시 **없음**.
- 스팸 답장 방지 §0-16. 추가로 같은 상대에게 3일 연속 "답장 퀘스트용 1줄"만 보내는 패턴(10~15자·질문 없음·상대 무응답)은 `v_quest_metrics_daily.suspect_reply_ratio`로 모니터링(제재 아님, 룰 튜닝 근거).

## 5. 주간 취미 이벤트

### 5.1 온라인 이벤트 캘린더(12주 템플릿, Phase 2 후반 파일럿 → Phase 5 정식)
A3 §3 주간 루프에 맞춰 **화 07:00 공개 → 토 진행 → 월 결과**. 12 카테고리를 12주에 1회씩 배정하고 매주 형식을 바꾼다. 전부 온라인·앱 내 또는 무료 외부 도구(계정 연동 없음, 링크만).

| 주 | 카테고리 | 형식 | 참여 행동(측정) |
|---|---|---|---|
| 1 | `fandom` | 최애 무대 같이 보기(동시 시청, 앱 채팅 스레드) | RSVP → 시작 시각 접속 |
| 2 | `boardgame` | 온라인 보드게임 밤(무료 웹 보드게임 링크, 4인 테이블 ×2) | RSVP → 테이블 배정 → 체크인 |
| 3 | `fitness` | 주말 5km 각자 뛰기 챌린지(기록 인증 사진, 위치 없음) | 인증 업로드(검수 큐) |
| 4 | `anime` | 이번 분기 신작 1화 같이 보기 + 취향 배틀 특집 | 배틀 응답 |
| 5 | `game` | 협동 미션 밤(듀오/파티, 앱은 매칭만) | 체크인 |
| 6 | `cafe` | 홈카페 사진 챌린지(테마 1개) | 사진 업로드 |
| 7 | `book` | 한 권 같이 읽기(2주, 화상 없이 앱 스레드) | 스레드 답글 |
| 8 | `photo` | 주말 출사 테마 챌린지(장소 비공개, 결과만) | 사진 업로드 |
| 9 | `code` | 토이 프로젝트 데모 데이(링크 공유) | 스레드 답글 |
| 10 | `music` | 플레이리스트 교환(취향 배틀 음악 특집) | 배틀 응답 |
| 11 | `travel`·`pet` | 사진 챌린지 2종 동시 | 사진 업로드 |
| 12 | 전체 | 덕질 퀴즈 대전 시즌 결산 | 퀴즈 응답 |

참여 지표(`v_event_metrics`): 노출 → RSVP율(`event_rsvps`/이벤트 화면 노출), RSVP → 체크인율, 이벤트 후 48h 매칭 부스트 대상 수(A3 §3 `+0.05`), 참가자 D7 vs 비참가자 D7(관측, 실험 아님), 참가자 신고율. 이벤트 알림은 슬롯 B ④(관심 취미 일치자만)·참가자 리마인드(금) — 기존 정책 그대로.

### 5.2 오프라인 이벤트(Phase 5)
| 항목 | 규칙 |
|---|---|
| 호스트 | §0-18. 운영팀 계정, L3, 이벤트당 운영자 1명 동석 |
| 참가 자격 | L3(승인 사진 필수) ∧ 활성 제재 0 ∧ 최근 90일 `NO_SHOW` 확정 < 3 |
| 정원 | 2~8(기존 check), 대기열 `waitlisted` |
| 장소 | 운영자가 정한 공개 장소(카페·공원·공용 공간). 주거지·술집 금지(A1 "술·바" 제외). 상세 주소는 RSVP 확정자에게 시작 24h 전 |
| 안전 확인 | RSVP 시 `safety_ack_at` 필수: "공개 장소·본인 이동수단·불편하면 언제든 떠나도 돼요·신고 1탭" 4줄. A5 오프라인 만남 배너 문구 톤과 통일 |
| 진행 중 | 체크인 코드(운영자 화면 6자리, `checkin_code_hash`) 입력 → `checked_in_at`. 앱은 위치를 묻지 않는다 |
| 노쇼 | §0-19. 호스트가 종료 후 24h 내 신고, D5 큐 P3, 참가자 이의는 `appeals`가 아니라 `inquiries`(제재 level 1은 이의신청 대상 아님) |
| 취소 | 시작 24h 전까지 무페널티(`canceled_at`), 이후 취소는 노쇼 아님·기록만 |
| 종료 후 | 참가자 간 48h 매칭 부스트, 상호 신고 창구 배너 1회 |

## 6. 푸시 카피 A/B

### 6.1 변형표 (템플릿 키 = `20_notifications` §3, 전부 `kind='service'`, 해요체, 이모지 0, 금지어 0)

| key | 변형 | 제목 | 본문 | 가설 |
|---|---|---|---|---|
| `daily_reco_ready` | A(원문) | 새 추천 {n}명 도착 | 취미가 겹치는 순서예요. 내일 07:00에 또 와요. | 기준 |
| | B(사유형) | 새 추천 {n}명 도착 | 공통 취미 {top_hobby} 순으로 골랐어요. | 구체 사유가 오픈↑ |
| | C(결과형, pending>0만) | 새 추천 {n}명 · 결과 대기 {pending}건 | 어제 보낸 좋아요 결과는 오늘 확인할 수 있어요. | 어제 행동 연결이 완주↑ |
| `reco_remaining` | A(원문) | 오늘 추천 {n}명이 남아 있어요 | 내일 07:00에 새 추천으로 바뀌어요. | 기준 |
| | B(사실 강조) | 아직 안 본 {n}명 | 07:00까지 볼 수 있어요. | 시각 명시가 완주↑ (카운트다운 아님) |
| `reminder_d3` | A(원문) | 새 추천이 매일 07:00에 와요 | 오늘 추천 {n}명이 준비돼 있어요. | 기준 |
| | B(취미형) | {top_hobby} 하는 사람 {n}명 | 오늘 추천에 있어요. 07:00마다 새로 와요. | 취미 언급이 복귀↑ |
| `reminder_d7` | A(원문) | (d3와 동일 카피) | | 기준 |
| | B(짧게) | 추천 {n}명 준비돼 있어요 | 설정 > 알림에서 언제든 끌 수 있어요. | 해제 안내 병기가 언서브율↓·신뢰↑ |
| `unseen_match` | A(원문) | 매칭됐어요 | 첫 대화 카드가 준비돼 있어요. | 기준 |
| | B(취미형) | 매칭됐어요 · 공통 취미 {k}개 | 첫 대화 카드 3장 중 하나로 시작해 보세요. | 카드 채택률↑ |
| `unreplied_message` | A(원문) | 새 메시지 | {nickname}에게서 답장이 왔어요. | 기준 |
| | B(시간형) | {nickname}의 답장이 기다리고 있어요 | {hours}시간 전에 왔어요. | 시간 사실이 응답률↑ |

`{top_hobby}`·`{k}`·`{hours}`·`{pending}`은 전부 DB 실값(`reasons`·`v_reco_daily_summary`·`matches`). 값이 없으면 변형 B/C는 A로 폴백(폴백도 노출 기록은 배정 variant로 남김 — ITT). `new_match`/`new_message`(transactional 즉시)는 실험 대상 아님(뭉침·야간 정책과 얽힘, 상대 행동에 대한 응답이라 카피가 결과를 바꾸면 안 됨).

### 6.2 지표
- 1차: 오픈율 = `notification_log.opened_at is not null / sent`(variant별, 슬롯별).
- 2차: 오픈 후 완주율 = 오픈 유저 중 그날 완주(§3.1) / 오픈 유저. 리마인더는 복귀율 = 발송 후 3일 내 `user_activity_days` 존재.
- 가드레일: 언서브율(§2.4), 슬롯 OFF 전환율, 신고율.

### 6.3 표본 크기 (양측 α=0.05, 검정력 80% → (z₀.₉₇₅+z₀.₈)² = (1.96+0.84)² = 7.84)
공식(두 비율): n/arm = 2·7.84·p̄(1−p̄) / δ², p̄ = 기준+δ/2.

| 실험 | 기준율 가정 | MDE(절대) | 유저/발송 n/arm | 군집 보정 ×1.5(발송 기준) | 3안 Bonferroni ×1.21 |
|---|---|---|---|---|---|
| 슬롯 A 오픈율 | 12%(목표 15%) | +3pp | 2,040 발송 | **3,060 발송** | 3,700 |
| 슬롯 A 오픈율(정밀) | 12% | +2pp | 4,740 | 7,110 | 8,600 |
| `reco_remaining` 오픈율 | 15% | +3pp | 2,400 | 3,600 | — |
| `reminder_d3` 복귀율 | 8% | +3pp | 1,500 유저 | (유저 단위, 보정 없음) | — |
| 오픈 후 완주율 | 50% | +5pp | 1,570 유저 | — | 1,900 |
| 언서브율 | 0.5% | +0.5pp | 4,670 유저 | 초기 표본으로 검정 불가 → 가드레일 임계(§2.4)로만 관리 | — |

기간: 초대제 베타(푸시 구독 500~1,500명, 슬롯 A 1건/일/유저) 기준 슬롯 A 2안은 6,120 발송 ≈ 1,000명이면 **6~7일**, 단 요일 효과로 **최소 14일·최대 28일** 고정, 표본 미달 시 연장(주 단위). `reminder_d3`는 대상이 하루 수십 명이라 **8~12주** 필요 → 우선순위 낮음(§8).

### 6.4 제약 준수·중단
- 야간 23~07 보류, 예산 2건, 슬롯 B 1건, 리마인더 30일 2건 상한, 마케팅 창(해당 없음) — 실험은 카피 문자열만 바꾼다.
- 중단: 가드레일 자동(§2.4), 또는 lint 실패 변형이 프로덕션에서 발견되면 즉시 A로 고정(`experiments.status='paused'`).
- 결론 후 승자 카피는 `templates.ts` 원문을 교체하고 이 문서 §6.1을 개정(D7 `templates.test.ts` 갱신).

### 6.5 금지 표현 검사표 (§4.4 사전 대조)

| 변형 | 희소성 | 죄책감 | 가짜 신호 | 외모 | 만남 압박 | 결제 | 호칭 | 광고성 | 판정 |
|---|---|---|---|---|---|---|---|---|---|
| `daily_reco_ready` A/B/C | — | — | 실값만 | — | — | — | — | 아님 | 통과 |
| `reco_remaining` B "07:00까지 볼 수 있어요" | 시각 사실(카운트다운 아님) | — | — | — | — | — | — | 아님 | 통과(리뷰 시 "까지"가 재촉으로 읽히면 "07:00에 바뀌어요"로 대체) |
| `reminder_d3` B | — | — | 실값 | — | — | — | — | 아님 | 통과 |
| `reminder_d7` B | — | — | — | — | — | — | — | 아님 | 통과 |
| `unseen_match` B | — | — | 실값 | — | — | — | — | 아님 | 통과 |
| `unreplied_message` B "기다리고 있어요" | — | 경계(상대 기다림 = 압박?) | — | — | — | — | 닉네임 | 아님 | 조건부 — lint 사전에 "기다리고" 없으나 C1 리뷰 필수, 불허 시 "답장이 와 있어요" |

## 7. 이탈 예측 룰 (Phase 2, 룰 기반)

### 7.1 시그널·점수 (`churn_score_daily()`, 07:10, L2+ 활성 유저 전원)

| # | 시그널 | 근거 테이블 | 점수 | 페르소나 |
|---|---|---|---|---|
| S1 | 추천 미확인 2일 연속(`seen_at` 0) | `daily_recommendations` | +3 | 전체 |
| S2 | 매칭 후 상대 메시지에 미답장 3일 | `matches.last_message_at`, `messages.sender_id` | +3 | P2·P4 |
| S3 | 사진 반려 후 7일 재업로드 없음 | `photos(review_status='rejected')`, 이후 insert 없음 | +2 | P2·P4 |
| S4 | 3일 연속 완주율 0(접속은 있음) | `user_activity_days` ∧ 완주 없음 | +2 | 전체 |
| S5 | 성비 불리 지역: 데이팅 남성 ∧ 같은 시도 여성 후보 풀 < 30 ∧ 추천 5 미만 2일 | `v_reco_daily_summary.reco_count`, `reco_candidates.pool_size` | +2 | P3 |
| S6 | 매칭 0 ∧ 가입 7일 경과 ∧ 좋아요 ≥ 10 | `matches`, `likes` | +2 | P2·P3 |
| S7 | 알림 미구독 ∧ 3일 미접속 | `push_subscriptions` 없음 | +1 | 전체 |
| S8 | 마스킹 해제 후 양쪽 7일 미접속 | `matches.matched_at+72h`, L3 양쪽 | 점수 0, `graduation_candidate=true` | — |

점수 밴드: 0~2 정상 / 3~4 주의 / ≥5 위험. `v_churn_risk_daily(profile_id, loop_date, score, band, signals[], graduation_candidate)`.

### 7.2 개입 매핑 (푸시는 슬롯 B 우선순위 안, 인앱은 홈 상단 1줄)

| 밴드·시그널 | 개입 | 채널 | 상한 |
|---|---|---|---|
| 주의 + S1 | `reco_remaining`/`reminder_d3`(기존) | 슬롯 B | 기존 상한 |
| 주의 + S2 | 해당 매칭의 제안 카드 3장 채팅 상단 재노출(접힌 상태) + `unreplied_message`(기존 ②) | 인앱 + 슬롯 B | 매칭당 1회 |
| 주의 + S3 | "대표 사진 다시 올리기" 1줄(반려 사유 안내 링크) | 인앱 | 주 1회 |
| 위험 + S5 | "온라인 위주라 지역 상관없어요" 전국 폴백 토글 제안 + 친구 모드 병행 안내 | 인앱 | 1회(수락/거절 기록) |
| 위험 + S6 | 덕질 카드 다듬기 제안(브랜드 #15 톤) — "매칭 안 되는 이유" 류 금지 | 인앱 | 주 1회 |
| 위험 + S7 | 푸시 소프트 배너(#34) 재노출 | 인앱 | loop_date당 1회(기존) |
| 위험 전체 | `reminder_d7`(기존) | 슬롯 B | 30일 2건 |
| S8 | 개입 없음, 집계만 | — | — |

인앱 넛지는 프로필 완성 넛지(A3 §4.1)와 슬롯을 공유해 **동시 1개**, 우선순위 = 안전·인증 > 사진 > 전국 폴백 > 카드 다듬기.

### 7.3 측정
- 룰 정밀도: 밴드별 7일 후 이탈률(미접속 7일) — 위험 밴드가 정상 밴드의 3배 이상이면 룰 유지, 아니면 점수 재조정(월 1회).
- 개입 효과: 개입 자체를 실험으로(§8 R11) — 위험 밴드를 배정해 control은 기존 슬롯 B만, treatment는 인앱 개입 추가.
- 전국 폴백 수락률·수락 후 D7, 사진 재업로드율, 제안 카드 재노출 후 답장률.

## 8. 실험 백로그

### 8.1 우선순위 (P1 = Phase 2 첫 달)

| ID | P | 가설 | 변형 | 1차 지표 | 최소 표본/arm | 기간 | 리스크·가드 |
|---|---|---|---|---|---|---|---|
| R1 | 1 | 슬롯 A 사유형 카피(§6.1 B)가 오픈율 +3pp | A/B/C | 오픈율 | 3,060 발송 | 14~28일 | 언서브율; C는 pending>0만 |
| R2 | 1 | 궁합 카드가 추천 목록 **위**에 있으면 완주율↑ | 위/아래 | 완주율 | 1,570 유저 | 14일 | 카드 위치가 추천 seen을 늦춤 → S1 관찰 |
| R3 | 1 | 온보딩 퀴즈 기본값 "3문항 후 자동 계속"이 퀴즈 이탈률↓·D1 유지 | 스킵 버튼 상시 / 3문항 후 계속 제안 | 퀴즈 완료율, D1 | 1,000 가입/arm | 신규 코호트 4주 | D1 −3pp면 폐기; 스킵 버튼은 두 안 모두 유지(PRD §0-31) |
| R4 | 1 | 제안 카드 순서 online→offline→talk vs 성향 정렬(D3 기본) | 고정/성향 | 채택률 | 900 매칭/arm(40% 기준 +5pp) | 4주 | 오프라인 카드 앞세움은 dating 제외(기존) |
| R5 | 2 | 무료 추천 5명 vs 7명 | 5/7 | 완주율·좋아요→매칭 | 1,570 유저 | 14일 | **하한 5는 불변**(상향만 실험). 7명이 완주 시간 8분 초과하면 폐기 |
| R6 | 2 | 슬롯 B 발송 시각 19:30 vs 20:30(availability 무관 고정) | 19:30/20:30 | 오픈율 | 3,060 발송 | 14일 | 야간 창 밖 금지(20:30 상한) |
| R7 | 2 | 첫 매칭 안전 모달 3줄(원문) vs 3줄+접힌 상세 | 원문/확장 | 매칭→첫 메시지, 신고율 | 900 매칭 | 4주 | **문구 축약 금지**(A5 원문 고정, 추가만) |
| R8 | 2 | 스트릭 3일 코스메틱 보상 유무 | 있음/없음 | D7 | 1,570 | 4주 | 보상 없음 arm에 상실감 카피 없음 |
| R9 | 2 | 데일리 퀘스트 카드 홈 상단 vs 루프 끝 화면 | 상/끝 | 퀘스트 완료율, 완주율 | 1,570 | 14일 | 홈 상단 넛지 슬롯 충돌 → R9 중 다른 넛지 억제 |
| R10 | 2 | `unseen_match` 취미형 카피 | A/B | 오픈율·카드 채택률 | 2,400 발송 | 28일 | 발송량 적음 |
| R11 | 2 | 이탈 위험 밴드 인앱 개입(§7.2) 유무 | 없음/있음 | 7일 후 접속률 | 800 유저/arm(30%→+8pp) | 6주 | 개입 카피 lint |
| R12 | 3 | 루프 끝 화면에 "내일 게임 종류" 예고 유무 | 없음/있음 | D1 | 2,000 | 4주 | 게임 슬롯 요일 의존 |
| R13 | 3 | `reminder_d3` 취미형 | A/B | 복귀율 | 1,500 유저 | 8~12주 | 표본 느림 |
| R14 | 3 | 이벤트 RSVP 버튼 카피 "참여하기" vs "같이 하기" | 2안 | RSVP율 | 1,000 노출 | 4주 | Phase 5 |
| R15 | 3 | 주간 퀘스트 목표 5일 vs 4일 완주 | 5/4 | 완료율·D7 | 1,570 | 4주 | 아이템 획득 상한 유지 |

### 8.2 절대 실험하지 않는 것
가격·SKU·할인(Phase 3 A4 §7 별도, 코호트 단위만) · 무료 티어 한도 **하향** · 신고/차단/인증/마스킹/이미지 조건 · 동의 화면 문구·체크 기본값·순서 · 법적 문구·제재 통보·이의신청 · 해지 뎁스·확인 횟수 · 야간 창·예산 상한·리마인더 상한 · 성비 큐·남성 웨이팅 파라미터 · 안전 모달 원문 축약 · "누가 나를 좋아했는지" 노출 범위(유료 가치·가짜 신호와 결합) · 죄책감·희소성·카운트다운을 변수로 두는 어떤 실험 · 미성년·연령 게이트 · 광고 위치(Phase 3 이후도 §9 allowlist 안에서만).

## 9. KPI 대시보드 스펙

### 9.1 코호트·정의

| 지표 | 정의 | 분모 | 소스 |
|---|---|---|---|
| D1/D7/D30(엄격) | 가입 loop_date + N일 **당일** `user_activity_days` 행 존재 | 그날 가입 ∧ L2 도달 ∧ `age_blocked`·`deleting` 제외 | `v_retention_cohort_daily` |
| D7/D30(창) | N−1~N+1 중 1일 이상 | 동상 | 동상(병기) |
| 루프 완주율 | 완주(§3.1) 유저 / `user_activity_days` 유저(같은 loop_date) | — | `v_loop_completion_daily` |
| 매칭→첫 메시지 | `matches.first_message_at not null` / 그날 매칭 | — | `admin_metrics_daily().matches/.first_messages` (기존) |
| 24h 응답률 | 양쪽 각 1건 이상 24h 내 / 매칭 | — | 신규 컬럼 `v_loop_completion_daily.reciprocated_24h` |
| 성비 | 데이팅 L3 활성 여성 / 전체 | — | `admin_metrics_gender()` + `v_reco_gender_balance` (기존) |
| 신고율 | `reports` / `matches` | — | `reportRatePerMatch` (기존) |
| 푸시 오픈율·예산 | 슬롯·템플릿·variant별 | — | `v_push_metrics_daily` (기존) + `variant` 그룹 추가 |
| 스트릭 분포 | 0/1~2/3~6/7~13/14~29/30+ 유저 수, 프리즈 사용 수 | 활성 | `v_streak_distribution` |
| 퀘스트 | 키별 완료율, 아이템 적립 수, `suspect_reply_ratio` | 활성 | `v_quest_metrics_daily` |
| 이탈 위험 | 밴드별 인원, 개입 수, 7일 후 접속률 | L2+ | `v_churn_risk_daily` |
| 이벤트 | RSVP율·체크인율·노쇼율·참가자 D7 | 이벤트별 | `v_event_metrics` |
| 실험 | variant별 노출·전환·가드레일 | 실험별 | `v_experiment_results`, `v_experiment_guardrails` |

### 9.2 D8 함수 매핑

| 화면 카드 | 기존 함수(0060) | 신규 함수(0093) |
|---|---|---|
| 리텐션 코호트 표(가입일 × D1/D7/D30) | — (§8 미결) | `admin_metrics_retention(p_days)` |
| 루프 완주율·응답률 선 차트 | `admin_metrics_daily` | `admin_metrics_loop(p_days)` |
| 스트릭 분포 막대 | — | `admin_metrics_streak()` |
| 퀘스트 완료율 표 | — | `admin_metrics_quests(p_days)` |
| 실험 결과 표 + 가드레일 배지 | — | `admin_metrics_experiment(p_key)` |
| 이벤트 표 | — | `admin_metrics_events(p_days)` |
| 성비·신고율·SLA·푸시 | `admin_metrics_gender/sla`, `v_push_metrics_daily` | 변경 없음 |

권한 = 기존 `admin_metrics_guard()`(moderator+). 일 경계 전부 `loop_date()`. `p_days` clamp 1~90.

## 10. 윤리·법 체크리스트

| # | 항목 | 대조 | 상태 |
|---|---|---|---|
| 1 | 스트릭 끊김 협박 카피 없음 | A4 §5-15, A2 §5-2, C1 #31 | §3.4 — 끊김 푸시 자체 없음 |
| 2 | 복구 아이템·스트릭 구매 없음 | A4 §5-13(감점 구조 유사) | §0-11 영구 |
| 3 | 가짜·추정 수치 없음 | A4 §5-4, C1 §4.4 | 푸시 변수 전부 DB 실값, 없으면 폴백 |
| 4 | 희소성·카운트다운 없음 | A4 §5-3 | "07:00에 바뀌어요" 사실형만; §6.5 조건부 항목 리뷰 |
| 5 | 광고성 정보 요건 | B1 §4·D7 §0-26 | 모든 실험 카피 `service`, 혜택·유료·이벤트 언급 0 → `(광고)`·08~21 창 비대상. 리텐션 카피에 유료 문구가 들어가는 순간 `marketing` 재분류 + 동의자만 |
| 6 | 야간 전송 | D7 §0-23 | 23~07 보류 불변, 슬롯 B 실험 상한 20:30 |
| 7 | 예산 일 2건 | 브리프·A3 §7 | 이탈 개입·퀘스트·이벤트 알림 전부 기존 슬롯 안, 신규 슬롯 0 |
| 8 | 수신 거부 경로 | B1 §4 | `reminder_d7` B 변형에 "설정 > 알림에서 끌 수 있어요" 병기, 슬롯 OFF 즉시 반영 |
| 9 | 2년 재동의 | D7 `consent_recheck` | 실험 무관(서비스 알림) |
| 10 | 자동화 결정(개인정보보호법 §37조의2) | B1 §0-10 | 이탈 점수는 노출·권리에 영향 없음(인앱 제안·기존 리마인더만) → 처리방침 "추천·알림 최적화 통계" 항목에 개요 기재 `(변호사 검토)` |
| 11 | 실험 자체의 고지 | B1 §3.2 | 처리방침 "서비스 개선을 위한 A/B 테스트(가명 처리)" 1줄 추가 요청(B2). 개별 동의 불요 판단 `(변호사 검토)` |
| 12 | 미성년 0 | 브리프 규칙 2 | 실험·스트릭·퀘스트·이벤트 자격 전부 L2+(성인 인증) |
| 13 | 외모·인기 라벨 없음 | PRD §0-30 | 스트릭 배지·XP 레벨은 코스메틱, 노출·점수·랭킹 무관 |
| 14 | 만남 압박 없음 | A2 §5-5 | 이벤트 카피 "같이 해요" 톤, 오프라인 유도 푸시 없음; P4 억제 규칙 유지 |
| 15 | 위치 | B1 §2 | 이벤트 체크인은 코드 입력, Geolocation 미호출; 사진 챌린지 EXIF 제거(D7 파이프라인) |
| 16 | 노쇼 제재 | A5·PRD §0-17 | 3회/90일 → 이벤트 제한 30일, 수동 판정, 자동 제재 없음 |
| 17 | 해지·탈퇴 마찰 | A4 §5-2·5 | 실험 금지 목록 §8.2 |
| 18 | 개인정보 최소화 | PRD §5.4 | `experiment_events`에 닉네임·본문 없음, `profile_id`만(가명화 대상 아님 — 탈퇴 시 cascade 삭제) |
| 19 | 무료 감점 없음 | A4 §5-13 | 스트릭·퀘스트 보상은 무료 유저도 동일, 보상이 노출 가중치를 바꾸지 않음 |
| 20 | 카피 lint | C1 §4.4 | 본 문서 신규 카피 전부 `copy-lint.json` 통과 필요, "기다리고"·"까지" 2건은 C1 리뷰 |

## 11. 미결·후속

- `unreplied_message` B·`reco_remaining` B의 어감(§6.5 조건부)은 C1 리뷰 후 확정. 불허 시 대체 문구 기재됨.
- `experiment_events.profile_id` 보존 기간: `analytics_events` 2년과 동일 여부 B2 확인.
- 이벤트 사진 챌린지 업로드는 검수 큐(D8) 부하 증가 → Phase 5 전 검수 인력 확인.
- `user_activity_days`가 생기면 D8 `admin_metrics_daily().active_users`(현재 `analytics_events` 기반)를 이 표 기준으로 바꿀지 D8 판단.
- 취미 랭킹(Phase 5, F-091)은 본 문서 범위 밖 — 점수식은 A3 §3(게임 참여 + 대화 지속, 좋아요 수 제외) 유지.
