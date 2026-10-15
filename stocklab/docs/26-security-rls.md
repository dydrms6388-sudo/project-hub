# 보안 · RLS 설계

- 버전 1.0 (2026-09-02) · 스키마: `20-db-schema.md` · API: `21-api-design.md`
- 원칙: **기본 거부**(RLS 전 테이블 ENABLE + FORCE) · 공개 시장 데이터만 anon SELECT · 사용자 데이터는 `auth.uid()` 본인만 · 쓰기는 대부분 **서버(service role/RPC)** 경유 · PII 최소화

---

## 1. 역할·경계
| 주체 | 키 | 접근 범위 | 실행 위치 |
|---|---|---|---|
| 브라우저(anon) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 뷰/테이블 SELECT | 클라이언트·서버 컴포넌트 |
| 로그인 사용자 | anon key + 세션 JWT | 본인 행 SELECT/INSERT/UPDATE/DELETE (정책 허용분) | 동일 |
| Next 서버 (service role) | `SUPABASE_SERVICE_ROLE_KEY` | `usage_limits`, `daily_picks` 쓰기, 결제/구독, 알림 발송 기록, 관리 작업 | Route Handlers·서버 액션 **만**. 브라우저 번들 금지(`server-only` import) |
| Python 워커 (service role, 별도 키 권장) | 워커 env | `backtests`, `rankings`, `strategies` R/W, 시장 데이터 R | Fly.io |
| 파이프라인 (GitHub Actions) | 별도 service role 또는 DB 직접 접속 계정 `pipeline_writer` | 시장 데이터 테이블 쓰기만 (GRANT 최소) | CI |
| Cron | `CRON_SECRET` | Next cron 라우트 | Vercel Cron |
service role 키는 RLS를 우회하므로 **서버 코드에서도 사용자 입력을 그대로 조건에 넣지 않고** 항상 `user_id = viewer.userId`를 코드에서 강제한다.

## 2. RLS 정책 (SQL)
공통 헬퍼:
```sql
alter table <t> enable row level security; alter table <t> force row level security;
create or replace function public.current_plan() returns text language sql stable security definer set search_path=public as
$$ select coalesce((select plan from v_plan where user_id = auth.uid()), 'free') $$;
```

### 2.1 공개 시장 데이터 (anon SELECT, 쓰기는 파이프라인/service role만)
```sql
-- stocks, daily_prices, index_prices, financials, financial_statements, dividends, dividend_history, daily_picks, badges, prediction_sets, seasons
create policy "public read" on stocks for select to anon, authenticated using (true);
-- (각 테이블 동일) 쓰기 정책 없음 → service role 만 가능
-- 뷰 v_screen_value / v_screen_dividend: security_invoker = true (기반 테이블 정책 적용)
alter view v_screen_value set (security_invoker = true);
alter view v_screen_dividend set (security_invoker = true);
grant select on v_screen_value, v_screen_dividend to anon, authenticated;
```

### 2.2 `profiles`
```sql
create policy "own read"   on profiles for select to authenticated using (id = auth.uid());
create policy "own update" on profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and plan = (select plan from profiles where id = auth.uid())); -- plan 직접 수정 금지
-- insert 는 auth.users 트리거(security definer) · delete 는 service role(탈퇴 API)
-- 공개 프로필(닉네임·티어)은 별도 뷰 v_public_profiles(id, nickname, tier) 로 노출
create view v_public_profiles with (security_invoker=false) as select id, nickname from profiles;
grant select on v_public_profiles to anon, authenticated;
```
`phone_enc`, `consents`, `device_hash` 컬럼은 **컬럼 권한으로 클라이언트 SELECT 제외**: `revoke select(phone_enc, device_hash) on profiles from authenticated;`.

### 2.3 `usage_limits`
```sql
-- 클라이언트 접근 없음. RPC consume_usage 는 security definer 이며 Next 서버에서만 호출(anon 키로 호출 가능하지만 key 를 서버가 계산하므로 브라우저 노출 위험 없음).
revoke all on usage_limits from anon, authenticated;
revoke execute on function consume_usage(text,text,date) from anon, public;
grant  execute on function consume_usage(text,text,date) to service_role;
create policy "own read" on usage_limits for select to authenticated using (key = 'u:' || auth.uid()::text); -- /api/me 잔여 표시용(선택)
```

### 2.4 구독·결제 (`subscriptions`, `payments`, `webhook_events`)
```sql
create policy "own read" on subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own read" on payments for select to authenticated
  using (subscription_id in (select id from subscriptions where user_id = auth.uid()));
-- insert/update/delete 정책 없음 → service role(빌링 API·웹훅·cron) 만
-- webhook_events: 클라이언트 접근 전면 차단
revoke all on webhook_events from anon, authenticated;
revoke select(billing_key_enc) on subscriptions from authenticated;
```

### 2.5 `saved_screens`, `signals`
```sql
create policy "own all" on saved_screens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "public read" on saved_screens for select to anon, authenticated using (is_public = true);
-- 개수 한도는 트리거로 2중 방어
create or replace function enforce_saved_screen_limit() returns trigger language plpgsql security definer as $$
declare n int; lim int;
begin
  select count(*) into n from saved_screens where user_id = new.user_id;
  lim := case current_plan() when 'pro' then 1000000 when 'basic' then 20 else 1 end;
  if n >= lim then raise exception 'QUOTA_EXCEEDED' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger t_saved_screen_limit before insert on saved_screens for each row execute function enforce_saved_screen_limit();
create policy "own read" on signals for select to authenticated
  using (saved_screen_id in (select id from saved_screens where user_id = auth.uid()));
-- signals 쓰기: cron(service role)
```

### 2.6 `strategies`, `backtests`, `rankings`
```sql
create policy "builtin/public read" on strategies for select to anon, authenticated using (is_builtin or is_public);
create policy "own all" on strategies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_builtin = false);
create policy "own read" on backtests for select to authenticated using (user_id = auth.uid());
create policy "own insert" on backtests for insert to authenticated with check (user_id = auth.uid() and status = 'queued');
-- status/metrics 갱신은 워커(service role) 만. 취소는 RPC cancel_backtest(id) security definer.
create policy "public read" on rankings for select to anon, authenticated using (true);
-- 무료 사용자 마스킹은 API 계층(rank>1 이면 strategy_id·metrics 일부 제거) — 행 자체는 공개(순위표는 공개 정보)
```

### 2.7 `alerts`, `alert_deliveries`, `push_tokens`
```sql
create policy "own all" on alerts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function enforce_alert_rules() returns trigger language plpgsql security definer as $$
declare p text := current_plan(); n int;
begin
  if p = 'free' then raise exception 'PLAN_REQUIRED'; end if;
  if p = 'basic' and (new.channels && array['kakao','push'] or new.realtime) then raise exception 'PLAN_REQUIRED'; end if;
  select count(*) into n from alerts where user_id = new.user_id and active and id <> new.id;
  if n >= case p when 'pro' then 50 else 5 end then raise exception 'QUOTA_EXCEEDED'; end if;
  return new;
end $$;
create trigger t_alert_rules before insert or update on alerts for each row execute function enforce_alert_rules();
create policy "own read" on alert_deliveries for select to authenticated using (user_id = auth.uid());
create policy "own all" on push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 2.8 `portfolios`, `portfolio_items`
```sql
create policy "own all" on portfolios for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own all" on portfolio_items for all to authenticated
  using (portfolio_id in (select id from portfolios where user_id = auth.uid()))
  with check (portfolio_id in (select id from portfolios where user_id = auth.uid()));
```

### 2.9 게임·포인트 (P3)
```sql
create policy "own read" on game_accounts for select to authenticated using (user_id = auth.uid());
create policy "leaderboard read" on game_accounts for select to anon, authenticated using (true); -- 노출 컬럼은 뷰 v_game_leaderboard(nickname, return_pct, rank, tier) 로 제한
revoke select(cash, flagged) on game_accounts from anon, authenticated;
create policy "own read" on game_positions for select to authenticated using (account_id in (select id from game_accounts where user_id = auth.uid()));
create policy "own read" on game_trades   for select to authenticated using (account_id in (select id from game_accounts where user_id = auth.uid()));
-- 주문/체결/참가: RPC place_game_order, join_season (security definer, auth.uid() 강제). 직접 insert 정책 없음.
create policy "own read" on points for select to authenticated using (user_id = auth.uid());   -- 쓰기는 RPC checkin/redeem_points + cron
create policy "own read" on user_badges for select to authenticated using (user_id = auth.uid());
create policy "own all"  on predictions for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and now() < (select closes_at from prediction_sets where set_date = predictions.set_date) and result is null);
create policy "own read" on coupons for select to authenticated using (user_id = auth.uid());
```

### 2.10 정책 테스트
`supabase/tests/rls.test.sql`(pgTAP) 또는 Node 스크립트로: anon이 `profiles` SELECT → 0행 · 사용자 A가 B의 `saved_screens` UPDATE → 0행 · free 사용자가 `alerts` INSERT → `PLAN_REQUIRED` · `phone_enc` SELECT → permission denied. CI에서 마이그레이션 적용 후 실행.

## 3. Cron · 워커 · 웹훅 보호
| 대상 | 조치 |
|---|---|
| `/api/cron/*` | `Authorization: Bearer ${CRON_SECRET}` — `crypto.timingSafeEqual`. Vercel Cron은 자동 헤더 첨부. 미설정 시 라우트 503 (오픈 금지) |
| 멱등 | `daily-pick` 같은 날짜 skip · `billing-renew` orderId UNIQUE · `season-rollover` `seasons.status` 상태기계 |
| 워커 ↔ Next | HMAC-SHA256(`WORKER_SECRET`, `${ts}.${body}`), `|now−ts| ≤ 300s`, 재생 방지 `nonce` Upstash 5분 |
| 토스 웹훅 | 페이로드 신뢰 금지 → `GET /v1/payments/{paymentKey}` 재조회 후 상태 반영 · `webhook_events` 멱등 · 처리 실패 시 5xx로 재전송 유도(최대 재시도 후 알림) |
| Resend/솔라피 웹훅 | 서명 헤더 검증(제공자 svix/HMAC) |
| 수신거부 토큰 `/u/[token]` | `HMAC(UNSUB_TOKEN_SECRET, alert_id|user_id|exp)` base64url, 만료 30일, 1회성 아님(재클릭 허용, 멱등) |

## 4. 레이트리밋·남용 방지
| 계층 | 도구 | 규칙 |
|---|---|---|
| 엣지 | Vercel WAF(기본) + `middleware.ts` | 봇 UA 차단 목록, `/api/*` 국가 제한 없음 |
| API | Upstash Ratelimit sliding window (`21-api-design.md §1.3`) | 키: anon `ip`, 로그인 `user_id` |
| 기능 한도 | `usage_limits` + RPC, 트리거 2중 | 서버 계산 키만, 클라이언트 값 불신 |
| 비로그인 우회 | `sha256(ip|sl_uid|USAGE_SALT)` — 미들웨어가 이 요청에서 방금 발급한 uid 는 `x-sl-anon-fresh: 1` 헤더로 표시되고 `anonKey()` 가 이를 `no-cookie` 로 취급해 **ip 단독 키**로 집계(쿠키 폐기 우회 차단, `src/lib/usage.ts`) | `USAGE_SALT` 프로덕션 필수 설정 |
| 인증 | Supabase Auth 기본 보호(이메일 OTP 레이트) + 소셜 로그인 우선, 비밀번호 로그인은 사용하지 않음(옵션) |
| 게임 | RPC 내 일 주문 20건, 비중 50%, Turnstile(출석) |
| 표현 가드 | 사용자 입력 텍스트(조건식 이름·설명, 전략 설명) 서버에서 BANNED 정규식 검사 → 403 `EXPRESSION_BLOCKED` + 신고 큐 |

## 5. PII 최소화 & 개인정보
| 항목 | 정책 |
|---|---|
| 수집 항목 | 이메일(가입, Supabase Auth 관리) · 닉네임 · 소셜 provider id. **실명·전화·주민번호·주소 수집 금지** |
| 알림톡 전화번호(프로, 선택) | 목적: 알림톡 발송만. 절차: 목적·보관기간 고지 → 체크 동의(`consents.kakao_alert = {at, ver, ip_hash}`) → SMS 인증 → `phone_enc`(AES-256-GCM, 키 `PHONE_ENC_KEY` 서버 env, nonce 행별) + `phone_last4`. 발송 시 서버에서만 복호화 → 솔라피 API. 화면 마스킹. 파기: 사용자 삭제 요청 즉시 / 프로 해지 30일 후 / 탈퇴 즉시 |
| IP | 원문 저장 금지. 사용량 키·동의 기록은 해시(salt) |
| 이메일 발송 로그 | 본문 미저장(`payload_digest` 해시만), 90일 |
| 로그 | 요청 로그에 이메일·전화 마스킹(`***`), 쿼리스트링에 PII 없음(필터 값만) |
| 탈퇴 | `auth.admin.deleteUser` → CASCADE. 결제 기록은 전자상거래법상 5년 보관 → `payments`는 `user_id` 대신 `subscription_id`만 유지하고 `subscriptions.user_id`를 NULL 처리(익명화) |
| 아동 | 만 14세 미만 가입 불가 문구(약관 동의 체크) |
| 처리방침 | `/legal/privacy`: 수집 항목·목적·보관·위탁(Supabase, Vercel, Resend, 솔라피, 토스, Upstash, Fly.io)·국외 이전(미국·일본 리전) 명시 |
| 쿠키 | `sl_uid`(익명 uuid, 1년, httpOnly) · `theme`(localStorage) · Supabase 세션 · AdSense 쿠키 고지 |

## 6. 시크릿 관리
| 규칙 | 구현 |
|---|---|
| 저장 | Vercel 환경변수(Production/Preview 분리) · Fly secrets · GitHub Actions secrets. 저장소에 `.env*` 커밋 금지(`.gitignore` 확인됨) |
| 노출 범위 | `NEXT_PUBLIC_*` 만 브라우저. `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`, `WORKER_SECRET`, `PHONE_ENC_KEY`, `CRON_SECRET` 는 `import 'server-only'` 모듈에서만 읽음 |
| 회전 | 분기 1회 + 유출 의심 시 즉시. 워커·파이프라인은 별도 service role(Supabase 프로젝트 API 키 2개 이상 발급 불가 시 Postgres 역할 `pipeline_writer` 생성 + 접속 문자열 사용) |
| 스캔 | `gitleaks` pre-commit + GitHub secret scanning |
| 최소 권한 | 토스 API 키는 빌링 전용 상점 · KIS 앱키 모의/실전 분리 · Resend 도메인 단위 키 |

## 7. OWASP Top 10 대응 (이 앱 기준)
| 항목 | 위협 예 | 대응 |
|---|---|---|
| A01 접근 통제 | 타인 백테스트 열람, plan 위조 | RLS + 서버 `can()` 이중, `plan` 컬럼 UPDATE 차단(트리거·정책), 공개 링크는 `is_public` 명시 |
| A02 암호화 실패 | 전화번호·빌링키 노출 | AES-GCM 컬럼 암호화, 컬럼 권한 revoke, TLS 강제 |
| A03 인젭션 | 필터 값으로 SQL/뷰 조작 | PostgREST 파라미터 바인딩, zod 범위 검증(숫자·enum), DSL은 화이트리스트 파서(`eval` 금지) |
| A04 설계 결함 | 한도 우회, 무료→유료 기능 URL 직접 호출 | 서버 게이팅(클라이언트 숨김은 UX일 뿐), 트리거 2중 |
| A05 설정 오류 | RLS 미적용 테이블, service role 브라우저 노출 | 마이그레이션 마지막에 RLS 점검 쿼리(`select relname from pg_class where relrowsecurity=false and relnamespace='public'::regnamespace and relkind='r'`) CI 실패 처리, `server-only` |
| A06 취약 컴포넌트 | Next/Supabase 취약점 | Dependabot 주간, `npm audit` CI |
| A07 인증 실패 | 세션 탈취 | Supabase 쿠키 httpOnly/secure/sameSite=lax, 짧은 access 토큰 + refresh, 소셜 로그인 state 검증 |
| A08 무결성 | 웹훅 위조, DSL 악성 | 결제조회 재확인, HMAC, DSL 비용 상한 |
| A09 로깅 부족 | 결제 이상 미탐 | 결제·구독 상태 변경 감사 로그(`payments`, `webhook_events`), Sentry, 일일 대사 cron(토스 결제 목록 vs `payments`) |
| A10 SSRF | 사용자 URL 입력 없음 | 외부 호출 대상 고정(토스·솔라피·Resend·KIS·DART 도메인 화이트리스트) |
추가: CSP(`script-src 'self' pagead2.googlesyndication.com …`), `X-Frame-Options: DENY`(공유 카드 iframe 필요 시 `/share/*` 예외), CSRF는 SameSite 쿠키 + Route Handler에서 `Origin` 검사(POST).

## 8. 로깅·모니터링·보관
| 로그 | 내용 | 보관 | 도구 |
|---|---|---|---|
| 요청 로그 | method·path·status·latency·requestId·userId(해시)·plan | 30일 | Vercel Logs → (선택) Axiom/Logtail |
| 감사 로그 | 구독/결제 상태 변경, 알림 동의/철회, 탈퇴, 관리자 작업 | 5년(결제) / 3년(동의) | `audit_log` 테이블(append-only, service role) |
| 오류 | 스택·requestId, PII 스크러빙 | 90일 | Sentry (Next + Python) |
| cron 실행 | 시작/종료/결과 요약 | 90일 | `cron_runs` 테이블 + 실패 시 이메일 |
| 웹훅 | 원문 페이로드(카드번호 없음) | 90일 | `webhook_events` |
| 알림 발송 | 상태·제공자 id·본문 해시 | 90일 | `alert_deliveries` |
| 데이터 파이프라인 | 적재 건수·`as_of`·오류 | 1년 | GitHub Actions 로그 + `system_meta` |
알림: cron 실패 2회 연속, 결제 실패율 > 5%/일, 워커 큐 대기 > 5분, `as_of` 지연 > 1영업일 → 운영자 이메일(Resend).

## 9. 사고 대응 요약
1. 키 유출 의심 → 해당 키 즉시 회전(Vercel/Fly/Supabase) → 감사 로그로 영향 범위 확인 → 필요 시 이용자 고지(개인정보 유출 시 72시간 내 KISA 신고·이용자 통지).
2. 결제 이중 청구 → `payments` 대사 → 토스 취소 API → 이용자 안내.
3. 데이터 오류(잘못된 지표 표시) → 배너 게시 → 파이프라인 재실행 → `/about` 변경 이력 기록.
