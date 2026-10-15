# D3 · 매칭 엔진 (16_matching)

> 산출물: `supabase/migrations/00008_matching.sql`,
> `supabase/functions/daily-recommendations/index.ts`,
> `apps/web/lib/matching/queries.ts`
> (본 문서는 D3 실행이 중단된 뒤 오케스트레이터가 확정 코드를 근거로 정리했다.)

## 다음 에이전트에게 넘기는 결정사항

- **M3-1 점수 공식 확정**: `compat = 0.40×hobby_jaccard + 0.35×quiz_cosine +
  0.15×availability_overlap + 0.10×mutual_signal`, 여기에 성향 감점을 뺀 뒤
  `[0,1]` 로 클램프하고 소수 4자리 반올림. 스펙 §3 가중치를 그대로 채택했다.
- **M3-2 성향 감점**: `meeting`·`tempo` 축 거리가 1.0 을 넘는 초과분마다 ×0.10 감점
  (축당 최대 0.10, 합계 최대 0.20). A2 의 "P3×P4 초기 추천 배제"를 하드 배제가 아닌
  연속 감점으로 구현해 큐 고갈을 피했다.
- **M3-3 목적 불일치 하드 제외**: `intent` 축에서 한쪽 ≤ −0.5(취미 친구 고정)이고
  다른 쪽 ≥ +0.5(연애 목적)이면 `compat_score = null` → 큐에서 제외. PRD 의
  "목적 불일치 쌍 큐 제외"에 대응한다.
- **M3-4 재노출 규칙**: 열람(`seen_at`)한 상대는 **14일 내 재노출 금지**. 다만 신규
  후보가 부족하면 2차 백필에서 금지를 풀고 "가장 오래전에 본 상대"부터 채운다 —
  **"추천 0명" 화면을 만들지 않는다는 것이 상위 규칙**(12_flows 엣지케이스).
- **M3-5 티어 인원수 단일 소스**: 무료 5 / 플러스 15 / 프로 30 은
  `packages/db/src/tier-limits.ts` 의 `TIER_LIMITS.dailyRecs` 와 **같은 값을 유지**해야
  한다. SQL 과 TS 양쪽에 값이 존재하므로 변경 시 반드시 함께 고친다.
- **M3-6 first_suggestion 은 트리거 소관**: `matches` insert 트리거
  (`fill_first_suggestion`)가 `make_first_suggestion()` 을 호출해 제안 3개를 채운다.
  E2·E3 는 **읽기만** 하고 직접 생성하지 않는다.

## 1. 점수 구성요소

| 함수 | 가중치 | 정의 |
|---|---|---|
| `hobby_jaccard(a,b)` | 0.40 | 취미 태그 자카드. 덕질카드 **Top3 는 1.5 배 가중**. |
| `quiz_cosine(a,b)` | 0.35 | 궁합 퀴즈 5축 가중 벡터의 코사인을 `[0,1]` 로 정규화. 축값 = 축별 응답 벡터값 평균 × `quiz_questions.weight`(meeting·intent 1.2). |
| `availability_overlap(a,b)` | 0.15 | 활동 시간대 겹침 (overlap coefficient). |
| `mutual_signal(a,b)` | 0.10 | 상호 관심 — 역방향 좋아요·덕질카드 열람. |

보조 함수 `quiz_axis_values(p)` 는 **weight 미적용 생값**을 돌려주며, 감점·intent 제외·
근거 문장 생성에 쓰인다(코사인 계산과 목적이 다르므로 분리했다).

## 2. 추천 큐 생성 — `build_daily_recommendations(for_date)`

수신 자격: `status='active'` AND `verify_level >= 1` AND `onboarding_step='done'` AND
활성 제재(level ≥ 3) 없음.

처리 순서:
1. **성비 감쇠 계수 산정** — dating 모드·Lv2+·active 회원의 m:f 비율로 다수 성별의
   노출 계수를 `max(0.8, 소수/다수)` 로 낮춘다(하한 0.8 — 과도한 굶주림 방지).
2. **1차 후보** — 차단·기존 매칭·목적 불일치·14일 재노출 금지를 모두 배제하고
   `compat_score` 내림차순. 신규 가입자(48h 이내)는 1.15 배 가산해 콜드스타트를 완화한다.
3. **2차 백필** — 티어 정원에 못 미치면 재노출 금지를 해제해 정원을 채운다.
4. `daily_recommendations` 에 `score` 와 **근거 3줄(`reasons` jsonb)** 을 함께 적재한다.

`build_reasons(a,b)` 는 공통 취미명(최대 2개)과 가장 가까운 퀴즈 축을 한국어 문장으로
만든다(축 라벨: immersion=몰입도, meeting=만남 성향, tempo=대화 속도, explore=탐색 성향,
intent=관계 목적). 이 문장이 CompatGauge 의 "이유 3줄"에 그대로 표시된다.

## 3. 첫 대화 제안 — `make_first_suggestion(match_id)`

공통 취미 기반 "같이 할 수 있는 것" 3개를 jsonb 로 만들어 `matches.first_suggestion` 에
저장한다. `matches` insert 트리거로 자동 호출되므로 애플리케이션 코드의 개입이 없다.
Phase 2 에서 취향 배틀·퀴즈 결과를 제안 소스로 추가할 자리를 남겨 두었다.

## 4. 스케줄 실행

`supabase/functions/daily-recommendations/index.ts` (Deno) 가 service role 로
`build_daily_recommendations()` 를 호출하고 처리 통계를 반환한다.
**cron 등록은 D7 의 `00011_notifications.sql` 에서 통합 관리**한다 —
KST 06:00 추천 생성 → 08:00 데일리 푸시 순서.

## 5. E2 가 쓰는 API (`apps/web/lib/matching/queries.ts`)

모든 함수는 `MatchingResult<T>` (= `{ok:true, data}` | `{ok:false, code}`) 를 돌려준다.
throw 하지 않으므로 화면이 `code` 로 분기하고 리다이렉트를 결정한다.

| 함수 | 용도 | 주요 실패 코드 |
|---|---|---|
| `getTodayRecommendations(profileId)` | 오늘의 추천 카드 목록 + 소진 여부 | `NOT_ONBOARDED`, `SANCTIONED` |
| `sendLike(profileId, targetId, type)` | 좋아요/슈퍼라이크 (일 한도·잔액 검사) | `DAILY_LIMIT`, `NO_SUPERLIKE`, `BLOCKED`, `VERIFY_LEVEL_REQUIRED` |
| `getLikers(profileId, tier)` | 나를 좋아한 사람 (무료는 카운트만) | `TIER_LOCKED` |
| `rewind(profileId)` | 되돌리기 (플러스 이상, 일 3회) | `TIER_LOCKED`, `DAILY_LIMIT` |

`matchingServiceDate()` / `matchingServiceDayStart()` 는 **KST 06:00 리셋**을 반영한
서비스 기준일을 계산한다. 일 한도·추천 정원 판정은 반드시 이 함수를 거쳐야 한다.

## 6. 미결 · 후속

- Lv1 사용자의 좋아요 일 3회 제한은 RLS 가 아니라 서버 카운트로 집행된다(D1 규약 4).
  Edge 레벨 우회 가능성은 G2 보안 리뷰 대상.
- 성비 감쇠 하한 0.8 은 실데이터 없이 정한 값 — Phase 2 에서 실측 후 조정 필요.
- `mutual_signal` 의 "카드 열람" 신호는 `daily_recommendations.seen_at` 기반이라
  Phase 2 의 취향 배틀 신호가 추가되면 재정의해야 한다.
