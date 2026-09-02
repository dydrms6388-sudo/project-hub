# 스톡랩 DB 스키마 (Supabase Postgres)

- 버전 1.0 (2026-09-02) · 상위: `10-PRD.md`, `11-feature-specs.md` · 보안: `26-security-rls.md`
- 컬럼명은 `src/lib/types.ts` 와 1:1(snake_case). P1 컬럼은 **그대로 유지**, P2/P3는 추가만(하위 호환).
- 표기: 🟩 P1 · 🟦 P2 · 🟪 P3. `auth.users` 는 Supabase 관리 테이블.
- 마이그레이션 위치: `supabase/migrations/NNNN_*.sql` (P1: `0001_core.sql`, `0002_views_rpc.sql`).

---

## 1. ERD

```mermaid
erDiagram
  auth_users ||--|| profiles : "id"
  profiles ||--o{ subscriptions : user_id
  subscriptions ||--o{ payments : subscription_id
  profiles ||--o{ saved_screens : user_id
  profiles ||--o{ strategies : user_id
  strategies ||--o{ backtests : strategy_id
  profiles ||--o{ backtests : user_id
  strategies ||--o{ rankings : strategy_id
  saved_screens ||--o{ signals : saved_screen_id
  saved_screens ||--o{ alerts : saved_screen_id
  profiles ||--o{ alerts : user_id
  alerts ||--o{ alert_deliveries : alert_id
  profiles ||--o{ portfolios : user_id
  portfolios ||--o{ portfolio_items : portfolio_id
  stocks ||--o{ portfolio_items : code
  stocks ||--o{ daily_prices : code
  stocks ||--o| financials : code
  stocks ||--o{ financial_statements : code
  stocks ||--o| dividends : code
  stocks ||--o{ dividend_history : code
  stocks ||--o{ daily_picks : code
  stocks ||--o{ signals : code
  profiles ||--o{ game_accounts : user_id
  seasons ||--o{ game_accounts : season_id
  game_accounts ||--o{ game_trades : account_id
  game_accounts ||--o{ game_positions : account_id
  stocks ||--o{ game_trades : code
  profiles ||--o{ points : user_id
  badges ||--o{ user_badges : badge_id
  profiles ||--o{ user_badges : user_id
  profiles ||--o{ predictions : user_id
  prediction_sets ||--o{ predictions : set_id
  profiles ||--o{ coupons : user_id
  profiles ||--o{ push_tokens : user_id

  profiles { uuid id PK; text nickname; text plan; jsonb consents; bytea phone_enc; timestamptz created_at }
  subscriptions { uuid id PK; uuid user_id FK; text plan; text status; text billing_key_enc; timestamptz current_period_end }
  payments { uuid id PK; uuid subscription_id FK; text order_id UK; text payment_key; int amount; text status }
  webhook_events { text provider PK; text event_id PK; jsonb payload; timestamptz received_at }
  stocks { char6 code PK; text name; text market; text sector; date listed_at; date delisted_at }
  daily_prices { char6 code PK; date trade_date PK; int open; int high; int low; int close; bigint volume; numeric adj_close }
  index_prices { text index_code PK; date trade_date PK; numeric close }
  financials { char6 code PK; int fiscal_year; numeric per; numeric pbr; numeric roe; numeric debt_ratio; date as_of }
  financial_statements { char6 code PK; int fiscal_year PK; int quarter PK; date published_at; jsonb items }
  dividends { char6 code PK; int fiscal_year; numeric dps; numeric dividend_yield; int consecutive_years; date ex_dividend_date }
  dividend_history { char6 code PK; int fiscal_year PK; numeric dps; date ex_dividend_date }
  daily_picks { date pick_date PK; char6 code; text strategy_key; jsonb conditions; jsonb metrics }
  usage_limits { text key PK; text feature PK; date date PK; int count }
  saved_screens { uuid id PK; uuid user_id FK; text name; jsonb filters; bool is_public; text share_slug UK }
  strategies { uuid id PK; uuid user_id FK; text key UK; text label; jsonb definition; bool is_builtin; bool is_ranked }
  backtests { uuid id PK; uuid user_id FK; uuid strategy_id FK; jsonb params; text params_hash; text status; jsonb metrics; jsonb series }
  rankings { text season PK; text kind PK; uuid strategy_id PK; int rank; numeric total_return; numeric mdd }
  signals { uuid id PK; uuid saved_screen_id FK; char6 code FK; date signal_date; text kind }
  alerts { uuid id PK; uuid user_id FK; text type; jsonb config; text[] channels; bool active; int cooldown_sec }
  alert_deliveries { uuid id PK; uuid alert_id FK; text channel; text status; timestamptz sent_at }
  portfolios { uuid id PK; uuid user_id FK; text name }
  portfolio_items { uuid id PK; uuid portfolio_id FK; char6 code FK; numeric quantity; numeric avg_price }
  seasons { text id PK; date starts_on; date ends_on; text status }
  game_accounts { uuid id PK; uuid user_id FK; text season_id FK; bigint cash; bigint equity; int rank; text tier }
  game_positions { uuid account_id PK; char6 code PK; numeric quantity; numeric avg_price }
  game_trades { uuid id PK; uuid account_id FK; char6 code FK; text side; numeric quantity; int fill_price; text status }
  points { uuid id PK; uuid user_id FK; int delta; text reason; date kst_date }
  badges { text code PK; text label; text category; int points }
  user_badges { uuid user_id PK; text badge_code PK; timestamptz earned_at }
  prediction_sets { date set_date PK; char6[] codes; timestamptz closes_at }
  predictions { uuid id PK; uuid user_id FK; date set_date FK; char6 code; text guess; text result }
  coupons { uuid id PK; uuid user_id FK; text feature; int amount; timestamptz expires_at; timestamptz used_at }
  push_tokens { uuid id PK; uuid user_id FK; text token UK; text platform }
```

## 2. 테이블 상세

### 2.1 사용자·구독

#### 🟩 `profiles` (= users)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` ON DELETE CASCADE | |
| `nickname` | text | NOT NULL, 2~20자, UNIQUE(lower) | 실명 아님 |
| `plan` | text | NOT NULL DEFAULT 'free', CHECK IN ('free','basic','pro') | 🟦 `subscriptions` 트리거로 동기화(읽기 캐시) |
| `plan_expires_at` | timestamptz | NULL | 🟦 |
| `consents` | jsonb | NOT NULL DEFAULT '{}' | `{ "email_alert": {at,ver,ip_hash}, "kakao_alert": {...}, "marketing": {...} }` 🟦 |
| `phone_enc` | bytea | NULL | 🟦 알림톡 전화번호 AES-GCM 암호화(서버 키). 화면 마스킹 전용 `phone_last4` |
| `phone_last4` | char(4) | NULL | 🟦 |
| `marketing_optin` | bool | DEFAULT false | 🟦 |
| `quiet_hours` | int4range | DEFAULT '[21,8)' | 🟦 실시간 알림 무음(KST 시) |
| `device_hash` | text | NULL | 🟪 다계정 탐지(sha256, 원문 없음) |
| `created_at` `updated_at` | timestamptz | DEFAULT now() | |
- 트리거: `auth.users` INSERT → `profiles` 생성(닉네임 임시 `user_xxxx`).
- 인덱스: `UNIQUE (lower(nickname))`.

#### 🟦 `subscriptions`
| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK default gen_random_uuid() |
| `user_id` | uuid | FK profiles, NOT NULL |
| `plan` | text | CHECK IN ('basic','pro') |
| `cycle` | text | CHECK IN ('monthly','yearly') |
| `status` | text | CHECK IN ('pending','active','past_due','canceled') |
| `customer_key` | text | UNIQUE (토스 customerKey, uuid) |
| `billing_key_enc` | text | NULL, 암호화 |
| `card_last4` `card_company` | text | 표시용 |
| `current_period_start` `current_period_end` | timestamptz | |
| `cancel_at_period_end` | bool | DEFAULT false |
| `retry_count` | int | DEFAULT 0 |
| `created_at` `updated_at` `canceled_at` | timestamptz | |
- 인덱스: `(user_id) WHERE status IN ('active','past_due')` UNIQUE(활성 구독 1개), `(current_period_end) WHERE status='active'`(갱신 cron).

#### 🟦 `payments`
| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | uuid | PK |
| `subscription_id` | uuid | FK |
| `order_id` | text | **UNIQUE** `sub_{subscription_id}_{YYYYMM}` |
| `payment_key` | text | UNIQUE NULL |
| `amount` | int | 원 |
| `status` | text | CHECK IN ('ready','done','failed','canceled','partial_canceled') |
| `method` `receipt_url` `fail_code` `fail_message` | text | |
| `approved_at` `created_at` | timestamptz | |

#### 🟦 `webhook_events`
| 컬럼 | 타입 | 제약 |
|---|---|---|
| `provider` | text | PK (`toss`,`solapi`,`resend`) |
| `event_id` | text | PK (제공자 이벤트 id 또는 sha256(payload)) |
| `event_type` | text | |
| `payload` | jsonb | |
| `processed_at` | timestamptz | NULL = 미처리 |
| `received_at` | timestamptz | DEFAULT now() |
- 보관 90일.

### 2.2 시장 데이터 (공개 읽기)

#### 🟩 `stocks`
| 컬럼 | 타입 | 제약 |
|---|---|---|
| `code` | char(6) | PK |
| `name` | text | NOT NULL |
| `market` | text | CHECK IN ('KOSPI','KOSDAQ') |
| `sector` | text | NULL |
| `listed_at` | date | NULL 🟦 (생존편향 방지) |
| `delisted_at` | date | NULL 🟦 |
| `is_active` | bool | GENERATED (`delisted_at IS NULL`) |
| `updated_at` | timestamptz | |
- 인덱스: `(market)`, `gin (name gin_trgm_ops)`(검색).

#### 🟩 `daily_prices` — **파티션 테이블**
| 컬럼 | 타입 | 제약 |
|---|---|---|
| `code` | char(6) | PK(복합), FK stocks |
| `trade_date` | date | PK(복합), **파티션 키** |
| `open` `high` `low` `close` | int | 원 |
| `volume` | bigint | |
| `trading_value` | bigint | 원 🟦 유동성 필터 |
| `adj_close` | numeric(14,4) | 🟦 수정주가 |
| `adj_factor` | numeric(12,8) | DEFAULT 1 🟦 |
| `market_cap` | bigint | 억원 NULL |
```sql
create table daily_prices (...) partition by range (trade_date);
create table daily_prices_2006 partition of daily_prices for values from ('2006-01-01') to ('2007-01-01');
-- … 연도별(2006~2027). 매년 12월 cron으로 다음 연도 파티션 생성 (pg_partman 미사용, 함수 ensure_price_partition(year)).
create index on daily_prices (trade_date desc, code);   -- 파티션별 자동 생성
```
- P1은 최근 2년 파티션만 적재(스크리너/오늘의 주식은 최신 종가만 사용), P2 백테스트 도입 시 20년 백필.
- 예상 규모: 2,500종목 × 250일 × 20년 ≈ 12.5M 행 ≈ 1.2GB(인덱스 포함). Supabase Pro 8GB 내.
- 보관: 영구. `trading_value`/`adj_*` 백필은 P2 마이그레이션.

#### 🟦 `index_prices`
`index_code text` (`KOSPI`,`KOSDAQ`,`KOSPI200`) + `trade_date date` PK, `close numeric`. 벤치마크·추세 필터.

#### 🟩 `financials` (최신 스냅샷, 종목당 1행)
| 컬럼 | 타입 |
|---|---|
| `code` | char(6) PK, FK stocks |
| `fiscal_year` | int |
| `price` | numeric NULL (전일 종가) |
| `market_cap` | numeric NULL (억원) |
| `per` `pbr` `roe` `debt_ratio` `eps` `bps` | numeric NULL |
| `revenue` `operating_income` `net_income` | numeric NULL (억원) |
| `as_of` | date NOT NULL |
- 인덱스: `(pbr) WHERE pbr > 0`, `(per) WHERE per > 0`, `(roe)`, `(market_cap desc)`, `(as_of)`.

#### 🟦 `financial_statements` (point-in-time, 백테스트 전용)
| 컬럼 | 타입 |
|---|---|
| `code` `fiscal_year` `quarter` | PK (quarter 0=연간, 1~4) |
| `published_at` | date NOT NULL (DART 접수일) — **룩어헤드 방지 키** |
| `items` | jsonb (`total_assets, total_liabilities, current_assets, equity, revenue, operating_income, net_income, ebit, cash, shares_outstanding, cfo …` 억원) |
| `source` | text (`dart`) |
- 인덱스: `(code, published_at)`.

#### 🟩 `dividends` (최신 요약, 종목당 1행)
| 컬럼 | 타입 |
|---|---|
| `code` | char(6) PK |
| `fiscal_year` | int |
| `dps` `dividend_yield` `payout_ratio` | numeric NULL |
| `consecutive_years` | int NOT NULL DEFAULT 0 |
| `ex_dividend_date` | date NULL |
| `as_of` | date NOT NULL |
- 인덱스: `(dividend_yield desc)`, `(consecutive_years desc)`, `(ex_dividend_date)`.

#### 🟦 `dividend_history`
`code, fiscal_year PK`, `dps numeric`, `ex_dividend_date date`, `pay_date date`. 배당성장 전략·백테스트 배당 재투자.

#### 🟩 `daily_picks`
| 컬럼 | 타입 |
|---|---|
| `pick_date` | date PK (KST) |
| `code` | char(6) FK |
| `name` `market` | text (비정규화, 화면용) |
| `strategy_key` `strategy_label` | text |
| `conditions` | jsonb (text[]) |
| `metrics` | jsonb |
| `data_as_of` | date |
| `created_at` | timestamptz |

### 2.3 사용량·저장

#### 🟩 `usage_limits`
| 컬럼 | 타입 |
|---|---|
| `key` | text PK(복합) — anon: sha256 32자 · 로그인: `u:{user_id}` |
| `feature` | text PK(복합) — `screener:value`, `screener:dividend`, 🟦 `backtest` |
| `date` | date PK(복합) — 일 한도는 KST 날짜, 🟦 월 한도는 해당 월 1일 |
| `count` | int NOT NULL DEFAULT 0 |
| `updated_at` | timestamptz |
```sql
create or replace function consume_usage(p_key text, p_feature text, p_date date)
returns int language sql security definer set search_path = public as $$
  insert into usage_limits(key, feature, date, count) values (p_key, p_feature, p_date, 1)
  on conflict (key, feature, date) do update set count = usage_limits.count + 1, updated_at = now()
  returning count;
$$;
```
- 한도 비교는 호출자(Next)가 수행(`count > limit` → 거절). 보관 7일(cron `delete where date < current_date - 7`).

#### 🟦 `saved_screens`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `name` | text 1~40 |
| `kind` | text CHECK IN ('value','dividend','multi') |
| `filters` | jsonb (`11-feature-specs.md §1.5`) |
| `is_public` | bool DEFAULT false |
| `share_slug` | text UNIQUE NULL (8자 base62) |
| `description` | text ≤300 |
| `last_result_codes` | char(6)[] — 시그널 diff 기준 |
| `last_evaluated_at` | timestamptz |
| `created_at` `updated_at` | |
- 인덱스: `(user_id)`, `(share_slug)`.

### 2.4 전략·백테스트·랭킹

#### 🟦 `strategies`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK NULL (builtin은 NULL) |
| `key` | text UNIQUE (`magic-formula` … 사용자: `u-{8자}`) |
| `label` | text |
| `description` | text ≤500 (표현 가드) |
| `definition` | jsonb (DSL, `22-backtest-engine-design.md §4`) |
| `definition_hash` | text |
| `is_builtin` | bool |
| `is_ranked` | bool DEFAULT false (프로 참가) |
| `is_public` | bool DEFAULT false |
| `forked_from` | uuid FK strategies NULL (복제) |
| `created_at` `updated_at` | |

#### 🟦 `backtests`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `strategy_id` | uuid FK NULL |
| `params` | jsonb (입력 전체) |
| `params_hash` | text — sha256(strategy definition_hash + params) 캐시 키 |
| `status` | text CHECK IN ('queued','running','done','failed','canceled') |
| `progress` | smallint 0~100 |
| `metrics` | jsonb (`cagr, mdd, sharpe, sortino, win_rate, total_return, trades, turnover, alpha, beta`) |
| `series` | jsonb (일별 equity/drawdown 다운샘플 ≤ 2,000점, 월별 수익) |
| `trades_url` | text (Supabase Storage: 전체 거래 내역 parquet/json) |
| `error` | text |
| `worker_id` `started_at` `finished_at` | |
| `expires_at` | timestamptz (베이직 90일 / 프로 1년) |
| `created_at` | |
- 인덱스: `(user_id, created_at desc)`, `(status) WHERE status IN ('queued','running')`(워커 폴링), `(params_hash)`.
- 보관: `expires_at` 경과 시 `series`/`trades_url` 삭제, `metrics`는 유지.

#### 🟦 `rankings`
| 컬럼 | 타입 |
|---|---|
| `season` | text PK(복합) `YYYY-MM` |
| `kind` | text PK(복합) CHECK IN ('strategy','game_month','game_week') |
| `strategy_id` | uuid PK(복합) NULL → 🟪 game은 `account_id` 사용 (별도 컬럼, 둘 중 하나 NOT NULL) |
| `account_id` | uuid NULL |
| `rank` | int |
| `total_return` `cagr` `mdd` `sharpe` `win_rate` | numeric |
| `trades` | int |
| `window_start` `window_end` | date |
| `is_public` | bool (전월 1위 공개) |
| `computed_at` | timestamptz |
- 인덱스: `(season, kind, rank)`.

### 2.5 시그널·알림

#### 🟦 `signals`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `saved_screen_id` | uuid FK |
| `code` | char(6) FK |
| `signal_date` | date |
| `kind` | text CHECK IN ('enter','exit') |
| `snapshot` | jsonb (해당 시점 지표) |
- UNIQUE `(saved_screen_id, code, signal_date, kind)`. 보관 1년.

#### 🟦 `alerts`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `type` | text CHECK IN ('signal','holding_move','ex_dividend','price_level','ranking_change','weekly_report') |
| `saved_screen_id` | uuid FK NULL |
| `portfolio_id` | uuid FK NULL |
| `config` | jsonb — `price_level: {code, price, direction:'above'|'below'}` · `holding_move: {pct}` |
| `channels` | text[] CHECK ⊆ {'email','kakao','push'} |
| `realtime` | bool DEFAULT false |
| `cooldown_sec` | int DEFAULT 86400 |
| `active` | bool DEFAULT true |
| `last_fired_at` | timestamptz |
| `created_at` `updated_at` | |
- 인덱스: `(user_id) WHERE active`, `(type) WHERE active`.

#### 🟦 `alert_deliveries`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `alert_id` | uuid FK |
| `user_id` | uuid FK (비정규화, RLS용) |
| `channel` | text |
| `status` | text CHECK IN ('queued','sent','failed','skipped_quiet','skipped_cooldown','bounced') |
| `provider_msg_id` | text |
| `payload_digest` | text (본문 sha256, 원문 미저장) |
| `error` | text |
| `queued_at` `sent_at` | |
- 보관 90일. 인덱스 `(alert_id, sent_at desc)`.

#### 🟪 `push_tokens`
`id, user_id FK, token UNIQUE, platform CHECK IN ('web','android','ios'), last_seen_at, created_at`. 만료 실패 3회 → 삭제.

### 2.6 포트폴리오

#### 🟩(라이트)/🟦 `portfolios`
`id uuid PK, user_id FK, name text, created_at`. 무료 1개(5종목), 베이직+ 5개.

#### `portfolio_items`
`id PK, portfolio_id FK, code FK, quantity numeric, avg_price numeric NULL, added_at`. UNIQUE `(portfolio_id, code)`.
> P1 "포트폴리오 체크 라이트"는 비로그인은 로컬 스토리지, 로그인 시 이 테이블.

### 2.7 게임 (🟪 P3)

#### `seasons`
`id text PK 'YYYY-MM', starts_on date, ends_on date, status CHECK IN ('upcoming','active','closed')`.

#### `game_accounts`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `season_id` | text FK |
| `cash` | bigint DEFAULT 10000000 |
| `equity` | bigint (일 마감 재계산) |
| `return_pct` | numeric |
| `rank` `tier` | int / text |
| `trade_count` | int |
| `flagged` | bool DEFAULT false (악용 의심) |
| `created_at` `updated_at` | |
- UNIQUE `(user_id, season_id)`. 인덱스 `(season_id, return_pct desc)`.

#### `game_positions`
`account_id FK, code FK PK(복합), quantity numeric, avg_price numeric`.

#### `game_trades`
| 컬럼 | 타입 |
|---|---|
| `id` | uuid PK |
| `account_id` | uuid FK |
| `code` | char(6) FK |
| `side` | text CHECK IN ('buy','sell') |
| `quantity` | numeric |
| `order_price_hint` | int (주문 시 표시된 지연가, 참고) |
| `fill_price` | int NULL (체결 종가) |
| `fee` `tax` | int |
| `status` | text CHECK IN ('pending','filled','rejected') |
| `ordered_at` `filled_at` | timestamptz |
- 인덱스 `(account_id, ordered_at desc)`, `(status) WHERE status='pending'`. 보관: 시즌 종료 + 12개월.

### 2.8 포인트·배지·예측·쿠폰 (🟪 P3)

#### `points` (원장, append-only)
`id PK, user_id FK, delta int, reason text CHECK IN ('checkin','checkin_bonus','predict_win','predict_streak','season_reward','badge','share','screen_first','redeem'), ref jsonb, kst_date date, created_at`.
- 인덱스 `(user_id, kst_date)`. 잔고 = `sum(delta)`; 뷰 `v_point_balance`. UNIQUE `(user_id, reason, kst_date) WHERE reason='checkin'`(하루 1회).

#### `badges` / `user_badges`
`badges(code PK, label, description, category, points int, icon)` · `user_badges(user_id, badge_code PK(복합), earned_at)`.

#### `prediction_sets` / `predictions`
- `prediction_sets(set_date date PK, codes char(6)[] (3개), base_close jsonb, closes_at timestamptz, resolved_at, results jsonb)`.
- `predictions(id PK, user_id FK, set_date FK, code char(6), guess CHECK IN ('up','down'), result CHECK IN ('win','lose','void') NULL, created_at)`. UNIQUE `(user_id, set_date, code)`.

#### `coupons`
`id PK, user_id FK, feature text ('backtest.run','screener.run'), amount int, source text, expires_at, used_at NULL, created_at`. 인덱스 `(user_id) WHERE used_at IS NULL`.

## 3. 뷰 · RPC

```sql
-- 🟩 v_screen_value : ScreenRow 와 컬럼 1:1
create view v_screen_value as
select s.code, s.name, s.market, s.sector,
       f.price, f.market_cap, f.per, f.pbr, f.roe, f.debt_ratio,
       d.dividend_yield, f.as_of
from stocks s join financials f using (code)
left join dividends d using (code)
where s.delisted_at is null;

-- 🟩 v_screen_dividend : DividendRow 와 1:1
create view v_screen_dividend as
select s.code, s.name, s.market, s.sector,
       f.price, f.market_cap, d.dps, d.dividend_yield, d.payout_ratio,
       d.consecutive_years, d.ex_dividend_date, d.as_of
from stocks s join dividends d using (code)
left join financials f using (code)
where s.delisted_at is null;

-- 🟦 v_plan : 유효 플랜 (구독 만료 반영)
create view v_plan as
select p.id as user_id,
  case when s.status in ('active','past_due') and s.current_period_end > now() then s.plan else 'free' end as plan
from profiles p left join subscriptions s on s.user_id = p.id and s.status in ('active','past_due');

-- 🟪 v_point_balance
create view v_point_balance as select user_id, sum(delta) as balance from points group by user_id;
```
| RPC | Phase | 설명 |
|---|---|---|
| `consume_usage(p_key,p_feature,p_date) → int` | 🟩 | 위 §2.3 |
| `claim_backtest_job(p_worker_id) → backtests` | 🟦 | `UPDATE … WHERE id = (SELECT id FROM backtests WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) SET status='running', worker_id=…` |
| `place_game_order(p_code, p_side, p_qty)` | 🟪 | 잔고·한도 검증 후 `pending` 주문 (security definer, auth.uid()) |
| `checkin()` | 🟪 | 하루 1회 포인트 + 스트릭 계산 + 7일 쿠폰 |
| `redeem_points(p_item)` | 🟪 | 원장 차감 + 보상 지급(트랜잭션) |

## 4. 보관·정리 정책 (pg_cron 또는 Vercel cron)
| 테이블 | 보관 | 정리 |
|---|---|---|
| `usage_limits` | 7일 | 일 |
| `webhook_events` | 90일 | 주 |
| `alert_deliveries` | 90일 | 주 |
| `signals` | 1년 | 월 |
| `backtests.series/trades_url` | 베이직 90일 · 프로 1년 | 일 (`expires_at`) |
| `game_trades` | 시즌 + 12개월 | 월 |
| `points` | 12개월 후 소멸분 `redeem` 음수 행 추가(원장 삭제 없음) | 월 |
| `daily_prices` `financial_statements` | 영구 | – |
| `profiles.phone_enc` | 프로 해지 30일 후 NULL | 일 |

## 5. Phase별 마이그레이션 순서
| 파일 | 내용 |
|---|---|
| `0001_core.sql` 🟩 | profiles, stocks, daily_prices(파티션 2025~2027), financials, dividends, daily_picks, usage_limits, portfolios, portfolio_items |
| `0002_views_rpc.sql` 🟩 | v_screen_value, v_screen_dividend, consume_usage, profiles 트리거 |
| `0003_rls.sql` 🟩 | `26-security-rls.md` |
| `0010_billing.sql` 🟦 | subscriptions, payments, webhook_events, v_plan, plan 동기화 트리거 |
| `0011_screens_alerts.sql` 🟦 | saved_screens, signals, alerts, alert_deliveries |
| `0012_backtest.sql` 🟦 | strategies(+20 builtin seed), backtests, rankings, financial_statements, dividend_history, index_prices, daily_prices 백필 파티션 2006~2024, claim_backtest_job |
| `0020_game.sql` 🟪 | seasons, game_accounts, game_positions, game_trades, push_tokens, RPC |
| `0021_points.sql` 🟪 | points, badges(seed 16), user_badges, prediction_sets, predictions, coupons, RPC |
