-- ============================================================================
-- 스톡랩(StockLab) 초기 스키마 — Supabase Postgres
-- 기준: stocklab/src/lib/types.ts (컬럼명 snake_case 1:1), src/lib/data/supabase.ts
-- 적용: supabase db push  또는  psql "$DATABASE_URL" -f 0001_init.sql
-- 멱등성: 재실행 가능하도록 IF NOT EXISTS / CREATE OR REPLACE 사용
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. 공용 헬퍼: updated_at 자동 갱신 트리거 함수
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'BEFORE UPDATE 트리거용 — updated_at 을 now() 로 갱신';

-- ----------------------------------------------------------------------------
-- 1. profiles — auth.users 1:1 (로그인 도입 시 사용, plan: free|pro)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan         text not null default 'free' check (plan in ('free', 'pro')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is '사용자 프로필. auth.users insert 시 트리거로 자동 생성';

-- auth.users insert → profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. stocks — 종목 마스터 (KOSPI/KOSDAQ)
-- ----------------------------------------------------------------------------
create table if not exists public.stocks (
  code       char(6) primary key,
  name       text not null,
  market     text not null check (market in ('KOSPI', 'KOSDAQ')),
  sector     text,
  is_active  boolean not null default true,      -- 상장폐지/거래정지 종목은 false
  listed_at  date,
  updated_at timestamptz not null default now()
);

comment on table public.stocks is '종목 마스터. pipeline/load_stocks.py 가 매일 upsert, 목록에서 사라진 종목은 is_active=false';
comment on column public.stocks.code is '6자리 종목코드 (예: 005930)';

create index if not exists stocks_market_active_idx on public.stocks (market, is_active);

drop trigger if exists stocks_set_updated_at on public.stocks;
create trigger stocks_set_updated_at
  before update on public.stocks
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. daily_prices — 일봉 OHLCV + 시가총액
-- ----------------------------------------------------------------------------
create table if not exists public.daily_prices (
  code          char(6) not null references public.stocks(code) on delete cascade,
  trade_date    date not null,
  open          numeric,
  high          numeric,
  low           numeric,
  close         numeric,
  volume        bigint,
  market_cap    numeric,          -- 원 단위(KRX 원본). financials 로 옮길 때 억원으로 환산
  listed_shares bigint,           -- 상장주식수 (EPS/BPS 계산용, KRX 제공)
  primary key (code, trade_date)
);

comment on table public.daily_prices is
  '일봉. 파티셔닝 전략(추후): 전 종목 20년 백필 시 ~1,400만 행. '
  '행 수가 1천만을 넘으면 trade_date 기준 RANGE 파티션(연도별)으로 전환 권장 — '
  'create table daily_prices_p (like daily_prices) partition by range (trade_date); '
  '기존 테이블은 daily_prices_legacy 로 rename 후 연도별 파티션에 insert select. '
  '현 단계(최근 수년치)는 단일 테이블 + (code, trade_date) PK + trade_date 인덱스로 충분.';
comment on column public.daily_prices.market_cap is '시가총액(원). NULL 허용';

create index if not exists daily_prices_trade_date_idx on public.daily_prices (trade_date);

-- ----------------------------------------------------------------------------
-- 4. financials — 종목·회계연도별 재무 스냅샷 (일배치 갱신)
-- ----------------------------------------------------------------------------
create table if not exists public.financials (
  code             char(6) not null references public.stocks(code) on delete cascade,
  fiscal_year      integer not null,
  price            numeric,       -- 전일 종가(지연 시세)
  market_cap       numeric,       -- 억원
  per              numeric,
  pbr              numeric,
  roe              numeric,       -- %
  debt_ratio       numeric,       -- 부채비율 %
  eps              numeric,       -- 원
  bps              numeric,       -- 원
  revenue          numeric,       -- 억원
  operating_income numeric,       -- 억원
  net_income       numeric,       -- 억원
  as_of            date not null, -- 데이터 기준일(KST)
  updated_at       timestamptz not null default now(),
  primary key (code, fiscal_year)
);

comment on table public.financials is '종목별 최신 재무 스냅샷. pipeline/load_financials.py (DART OpenAPI) 가 upsert';
comment on column public.financials.as_of is '앱 dataAsOf() 가 max(as_of) 를 읽음';

create index if not exists financials_as_of_idx on public.financials (as_of desc);

drop trigger if exists financials_set_updated_at on public.financials;
create trigger financials_set_updated_at
  before update on public.financials
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. dividends — 종목·회계연도별 배당 요약
-- ----------------------------------------------------------------------------
create table if not exists public.dividends (
  code              char(6) not null references public.stocks(code) on delete cascade,
  fiscal_year       integer not null,
  dps               numeric,                 -- 주당배당금(원)
  dividend_yield    numeric,                 -- %
  payout_ratio      numeric,                 -- 배당성향 % (= dps / eps * 100)
  consecutive_years integer not null default 0,
  ex_dividend_date  date,                    -- 배당락일 (12월 결산 기본 규칙, KRX 일정 확보 시 교체)
  as_of             date not null,
  primary key (code, fiscal_year)
);

comment on table public.dividends is '종목별 배당 요약. pipeline/load_dividends.py (DART alotMatter → pykrx fallback) 가 upsert';

create index if not exists dividends_as_of_idx on public.dividends (as_of desc);

-- ----------------------------------------------------------------------------
-- 6. daily_picks — 매일 1종목 "오늘의 조건 충족 종목" (앱 크론 라우트가 upsert on pick_date)
-- ----------------------------------------------------------------------------
create table if not exists public.daily_picks (
  pick_date      date primary key,
  code           char(6) not null references public.stocks(code),
  name           text not null,
  market         text not null check (market in ('KOSPI', 'KOSDAQ')),
  strategy_key   text not null,               -- 예: low-pbr-high-roe
  strategy_label text not null,               -- 예: 저PBR + 고ROE
  conditions     text[] not null default '{}',
  metrics        jsonb not null default '{}'::jsonb,
  data_as_of     date not null,
  created_at     timestamptz not null default now()
);

comment on table public.daily_picks is '/api/cron/daily-pick 이 service role 로 upsert(onConflict=pick_date). 투자 권유 아님(재미용/정보 제공)';

-- ----------------------------------------------------------------------------
-- 7. usage_limits — 비로그인 일일 사용량 (key = ip+cookie 해시, 원문 미저장)
-- ----------------------------------------------------------------------------
create table if not exists public.usage_limits (
  key        text not null,
  feature    text not null,     -- 예: screener:value / screener:dividend
  usage_date date not null,     -- KST 날짜
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, feature, usage_date)
);

comment on table public.usage_limits is '일일 사용량 카운터. service role 전용(consume_usage RPC). 7일 지난 행은 purge_usage_limits() 로 정리';

create index if not exists usage_limits_usage_date_idx on public.usage_limits (usage_date);

-- ----------------------------------------------------------------------------
-- 8. 뷰 — 스크리너용 (stocks + 최신 financials + 최신 dividends)
--    반환 컬럼은 types.ts 의 ScreenRow / DividendRow 와 정확히 일치해야 한다.
--    security_invoker=true → 호출자(anon) 권한/RLS 로 기반 테이블을 읽음
-- ----------------------------------------------------------------------------

-- 종목별 최신 financials (as_of 최신 → 동률이면 fiscal_year 큰 것)
create or replace view public.v_latest_financials
with (security_invoker = true) as
select distinct on (f.code)
  f.code, f.fiscal_year, f.price, f.market_cap, f.per, f.pbr, f.roe, f.debt_ratio,
  f.eps, f.bps, f.revenue, f.operating_income, f.net_income, f.as_of
from public.financials f
order by f.code, f.as_of desc, f.fiscal_year desc;

-- 종목별 최신 dividends
create or replace view public.v_latest_dividends
with (security_invoker = true) as
select distinct on (d.code)
  d.code, d.fiscal_year, d.dps, d.dividend_yield, d.payout_ratio,
  d.consecutive_years, d.ex_dividend_date, d.as_of
from public.dividends d
order by d.code, d.as_of desc, d.fiscal_year desc;

-- ScreenRow: code,name,market,sector,price,market_cap,per,pbr,roe,debt_ratio,dividend_yield,as_of
create or replace view public.v_screen_value
with (security_invoker = true) as
select
  s.code,
  s.name,
  s.market,
  s.sector,
  f.price,
  f.market_cap,
  f.per,
  f.pbr,
  f.roe,
  f.debt_ratio,
  d.dividend_yield,
  f.as_of
from public.stocks s
join public.v_latest_financials f on f.code = s.code
left join public.v_latest_dividends d on d.code = s.code
where s.is_active;

comment on view public.v_screen_value is '가치 스크리너 행(ScreenRow). 앱: from("v_screen_value").select("*")';

-- DividendRow: code,name,market,sector,price,market_cap,dps,dividend_yield,payout_ratio,
--              consecutive_years,ex_dividend_date,as_of
create or replace view public.v_screen_dividend
with (security_invoker = true) as
select
  s.code,
  s.name,
  s.market,
  s.sector,
  f.price,
  f.market_cap,
  d.dps,
  d.dividend_yield,
  d.payout_ratio,
  d.consecutive_years,
  d.ex_dividend_date,
  coalesce(d.as_of, f.as_of) as as_of
from public.stocks s
join public.v_latest_dividends d on d.code = s.code
left join public.v_latest_financials f on f.code = s.code
where s.is_active;

comment on view public.v_screen_dividend is '배당 스크리너 행(DividendRow). 앱: from("v_screen_dividend").select("*")';

-- ----------------------------------------------------------------------------
-- 9. RPC — consume_usage(p_key, p_feature, p_date) → 증가 후 count 반환
--    security definer + service role 전용 (anon/authenticated 실행 불가)
-- ----------------------------------------------------------------------------
create or replace function public.consume_usage(p_key text, p_feature text, p_date date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.usage_limits as u (key, feature, usage_date, count, updated_at)
  values (p_key, p_feature, p_date, 1, now())
  on conflict (key, feature, usage_date)
  do update set count = u.count + 1, updated_at = now()
  returning u.count into v_count;
  return v_count;
end;
$$;

comment on function public.consume_usage(text, text, date) is
  '사용량 1 소비(upsert 증가) 후 새 count 반환. 앱은 service role 클라이언트로 rpc 호출';

revoke all on function public.consume_usage(text, text, date) from public, anon, authenticated;
grant execute on function public.consume_usage(text, text, date) to service_role;

-- 7일 지난 사용량 행 삭제 (삭제 행 수 반환)
create or replace function public.purge_usage_limits(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.usage_limits
  where usage_date < (current_date - make_interval(days => p_keep_days));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_usage_limits(integer) is
  'usage_limits 정리. 스케줄(선택, pg_cron 확장 활성화 후): '
  'select cron.schedule(''purge-usage-limits'', ''30 16 * * *'', $$select public.purge_usage_limits(7)$$); '
  '(16:30 UTC = 01:30 KST). pg_cron 미사용 시 파이프라인(run_daily.py)에서 rpc 로 호출해도 됨';

revoke all on function public.purge_usage_limits(integer) from public, anon, authenticated;
grant execute on function public.purge_usage_limits(integer) to service_role;

-- ----------------------------------------------------------------------------
-- 10. 권한(grants)
--     service_role 은 RLS 를 우회하므로 파이프라인/서버 쓰기는 모두 service role 로 수행
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- 공개 읽기 데이터
grant select on public.stocks, public.daily_prices, public.financials, public.dividends, public.daily_picks
  to anon, authenticated;
grant select on public.v_latest_financials, public.v_latest_dividends, public.v_screen_value, public.v_screen_dividend
  to anon, authenticated;

-- profiles: 본인 행만 (RLS 로 제한)
grant select, update on public.profiles to authenticated;

-- usage_limits: 클라이언트 키로는 접근 불가
revoke all on public.usage_limits from anon, authenticated;

-- service role 전체 권한
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ----------------------------------------------------------------------------
-- 11. RLS
-- ----------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.stocks       enable row level security;
alter table public.daily_prices enable row level security;
alter table public.financials   enable row level security;
alter table public.dividends    enable row level security;
alter table public.daily_picks  enable row level security;
alter table public.usage_limits enable row level security;

-- 공개 읽기 (anon + authenticated select). 쓰기 정책 없음 → service role 만 쓰기 가능
drop policy if exists "stocks_public_read"       on public.stocks;
drop policy if exists "daily_prices_public_read" on public.daily_prices;
drop policy if exists "financials_public_read"   on public.financials;
drop policy if exists "dividends_public_read"    on public.dividends;
drop policy if exists "daily_picks_public_read"  on public.daily_picks;

create policy "stocks_public_read"       on public.stocks       for select to anon, authenticated using (true);
create policy "daily_prices_public_read" on public.daily_prices for select to anon, authenticated using (true);
create policy "financials_public_read"   on public.financials   for select to anon, authenticated using (true);
create policy "dividends_public_read"    on public.dividends    for select to anon, authenticated using (true);
create policy "daily_picks_public_read"  on public.daily_picks  for select to anon, authenticated using (true);

-- usage_limits: 정책 없음 (anon/authenticated 완전 차단, service role 은 RLS 우회)

-- profiles: 본인 행 select/update
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 끝. 다음: 0002_seed_sample.sql (선택, 샘플 데이터)
-- ----------------------------------------------------------------------------
