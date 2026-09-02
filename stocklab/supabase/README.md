# 스톡랩 Supabase 스키마

`migrations/0001_init.sql` — 테이블·뷰·RPC·RLS·트리거 (멱등, 재실행 가능)
`migrations/0002_seed_sample.sql` — ⚠️ **합성 샘플 데이터**(90종목). UI 확인용, 운영 DB 에 적용 금지.

## 적용

### A. Supabase CLI

```bash
npm i -g supabase            # 또는 brew install supabase/tap/supabase
cd stocklab
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push             # supabase/migrations/*.sql 을 순서대로 적용
```

샘플 시드를 빼려면 `0002_seed_sample.sql` 을 지우거나 `supabase/migrations` 밖으로 옮긴 뒤 push.

### B. psql 직접

```bash
# Dashboard → Settings → Database → Connection string (URI, 6543 pooler 대신 5432 direct 권장)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_seed_sample.sql   # 선택
```

### C. Dashboard SQL Editor
파일 내용을 붙여넣고 실행 (0001 → 0002 순).

## 환경변수 매핑

| Dashboard (Settings → API) | Next.js (`stocklab/.env.local`) | 파이프라인 (`pipeline/.env`) |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
| anon public key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — |
| service_role secret | `SUPABASE_SERVICE_ROLE_KEY` (서버 전용) | `SUPABASE_SERVICE_ROLE_KEY` |

## 앱 ↔ 스키마 대응 (src/lib/data/supabase.ts)

| 앱 호출 | 키 | 객체 | RLS/권한 |
|---|---|---|---|
| `from("stocks").select("code,name,market,sector").eq("is_active",true)` | anon | `stocks` | 공개 select |
| `from("financials").select("as_of")` (dataAsOf) | anon | `financials` | 공개 select |
| `from("v_screen_value").select("*")` + 필터 | anon | 뷰 (security_invoker) | 기반 테이블 공개 select |
| `from("v_screen_dividend").select("*")` | anon | 뷰 | 〃 |
| `from("daily_picks").select("*")` | anon | `daily_picks` | 공개 select |
| `from("daily_picks").upsert(pick,{onConflict:"pick_date"})` | **service role** | `daily_picks` | 쓰기 정책 없음 → service role 만 |
| `rpc("consume_usage",{p_key,p_feature,p_date})` → int | **service role** | 함수 (security definer) | anon/authenticated EXECUTE 취소 |

뷰 컬럼은 `src/lib/types.ts` 의 `ScreenRow` / `DividendRow` 와 **정확히 일치**한다 (뷰를 바꾸면 타입도 함께).

- `v_screen_value`: `code,name,market,sector,price,market_cap,per,pbr,roe,debt_ratio,dividend_yield,as_of`
  (stocks ⋈ 최신 financials, ⟕ 최신 dividends, `is_active` 만)
- `v_screen_dividend`: `code,name,market,sector,price,market_cap,dps,dividend_yield,payout_ratio,consecutive_years,ex_dividend_date,as_of`
  (stocks ⋈ 최신 dividends, ⟕ 최신 financials)
- "최신" = 종목별 `as_of desc, fiscal_year desc` 첫 행 (`v_latest_financials`, `v_latest_dividends`).

## RLS 요약

| 테이블 | anon / authenticated | service role |
|---|---|---|
| stocks, daily_prices, financials, dividends, daily_picks | select | 전체 (RLS 우회) |
| usage_limits | **없음** (정책 0개 + grant 취소) | 전체 — `consume_usage()` 로만 증가 |
| profiles | 본인 행 select/update (`auth.uid() = id`) | 전체 |

`auth.users` insert → `handle_new_user()` 트리거가 `profiles` 행 자동 생성 (plan `free`).

## 사용량 정리 (usage_limits 7일 보관)

`purge_usage_limits(7)` 함수 제공. 스케줄은 선택:

```sql
-- Dashboard → Database → Extensions 에서 pg_cron 활성화 후
select cron.schedule('purge-usage-limits', '30 16 * * *', $$select public.purge_usage_limits(7)$$); -- 01:30 KST
```

pg_cron 을 쓰지 않으면 파이프라인에서 `supabase.rpc("purge_usage_limits", {"p_keep_days": 7})` 를 호출해도 된다.

## 샘플 시드 재생성

`0002_seed_sample.sql` 은 `stocklab/data/sample-stocks.json` 에서 생성한다. JSON 이 바뀌면
`pipeline/README.md` 의 venv 에서 아래를 실행해 다시 만든다 (Python 표준 라이브러리만 사용):

```bash
cd stocklab && python3 - <<'EOF'
import json
d=json.load(open('data/sample-stocks.json',encoding='utf-8'))
lit=lambda v:'null' if v is None else (repr(v) if isinstance(v,(int,float)) and not isinstance(v,bool) else "'"+str(v).replace("'","''")+"'")
F=['code','fiscal_year','price','market_cap','per','pbr','roe','debt_ratio','eps','bps','revenue','operating_income','net_income','as_of']
D=['code','fiscal_year','dps','dividend_yield','payout_ratio','consecutive_years','ex_dividend_date','as_of']
o=[f"-- ⚠️ 샘플 데이터(합성) — data/sample-stocks.json (as_of {d['as_of']}) 에서 자동 생성. 운영 DB 적용 금지.\nbegin;",
 "insert into public.stocks (code, name, market, sector, is_active) values\n"+",\n".join(f"  ({lit(s['code'])}, {lit(s['name'])}, {lit(s['market'])}, {lit(s.get('sector'))}, true)" for s in d['stocks'])+"\non conflict (code) do update set name=excluded.name, market=excluded.market, sector=excluded.sector, is_active=true;",
 f"insert into public.financials ({', '.join(F)}) values\n"+",\n".join("  ("+", ".join(lit(f.get(c)) for c in F)+")" for f in d['financials'])+"\non conflict (code, fiscal_year) do update set "+", ".join(f"{c}=excluded.{c}" for c in F[2:])+";",
 f"insert into public.dividends ({', '.join(D)}) values\n"+",\n".join("  ("+", ".join(lit(x.get(c) if c!='consecutive_years' else (x.get(c) or 0)) for c in D)+")" for x in d['dividends'])+"\non conflict (code, fiscal_year) do update set "+", ".join(f"{c}=excluded.{c}" for c in D[2:])+";","commit;"]
open('supabase/migrations/0002_seed_sample.sql','w',encoding='utf-8').write("\n\n".join(o)+"\n")
EOF
```

## 스키마 변경 시

새 파일 `migrations/0003_<설명>.sql` 을 추가(기존 파일 수정 금지) → `types.ts` 동기화 → `supabase db push`.
