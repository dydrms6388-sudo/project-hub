-- 0003: 배당 지급 예상 월(pay_months) 추가 + 배당 뷰 재생성
-- 앱: DividendRow.pay_months (src/lib/types.ts). 파이프라인: load_dividends.py 가 DART 배당 공시의 지급일에서 월 추출(없으면 null).
alter table public.dividends add column if not exists pay_months smallint[];
comment on column public.dividends.pay_months is '배당 지급 예상 월(1~12) 배열. 연배당 [4], 분기배당 [4,5,8,11] 등. 직전 연도 실적 기준 추정치.';

drop view if exists public.v_screen_dividend;
drop view if exists public.v_latest_dividends;
create or replace view public.v_latest_dividends
with (security_invoker = true) as
select distinct on (d.code)
  d.code, d.fiscal_year, d.dps, d.dividend_yield, d.payout_ratio,
  d.consecutive_years, d.ex_dividend_date, d.pay_months, d.as_of
from public.dividends d
order by d.code, d.as_of desc, d.fiscal_year desc;
grant select on public.v_latest_dividends to anon, authenticated;

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
  d.pay_months,
  coalesce(d.as_of, f.as_of) as as_of
from public.stocks s
join public.v_latest_dividends d on d.code = s.code
left join public.v_latest_financials f on f.code = s.code
where s.is_active;

comment on view public.v_screen_dividend is '배당 스크리너 행(DividendRow). 앱: from("v_screen_dividend").select("*")';
grant select on public.v_screen_dividend to anon, authenticated;
