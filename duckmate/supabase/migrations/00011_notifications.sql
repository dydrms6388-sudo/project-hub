-- =============================================================================
-- 덕메이트(DuckMate) · D7 마이그레이션 00011 — 알림/스케줄러
--
-- 근거:
--   · 03_core_loop §3  — 푸시 고정 슬롯제: 슬롯1 08:00 데일리 앵커 / 슬롯2 이벤트성
--     12:00~21:00 (이월 없음) / 일 최대 2건 / 죄책감 카피 금지 / KST 06:00 리셋
--   · 07_legal_checklist L6·§6 — 기능성/광고성 분리, 광고성은 수신동의 +
--     야간(21:00~08:00) 발송 코드 레벨 하드 가드, "(광고)" 표기 + 수신거부 경로
--   · 09_store_policy §5.2 — push_tokens.platform 규약 (기존 00002 에 확보됨)
--   · 14_schema D7 규약 — KST 변환 책임은 발행자(cron), DB 는 date 만 저장
--
-- 분류 확정 (07 §6-③):
--   · 광고성(marketing_consent 필수, 08~21시만): 슬롯1 데일리 카드 티저,
--     미접속 리마인더(D3/D7)
--   · 기능성(동의 무관, 단 슬롯2 창 12~21시 유지): 매칭 성사, 새 메시지,
--     좋아요 수신, 매칭 후 24h 무대화 제안 카드 리마인드
--
-- "일" 의 정의: 서비스 리셋은 KST 06:00 이지만 발송 허용 창이 08:00~21:00 이므로
--   KST 달력일((now() at time zone 'Asia/Seoul')::date) == 리셋일. for_date 는
--   KST 달력일로 저장하며 일 2건 상한·중복 방지 판정의 단위다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. notification_prefs — 프로필별 알림 채널 · 광고성(마케팅) 수신 동의 · 시간대
--    행이 없으면 = 광고성 동의 없음(opt-in 원칙). 기능성 채널의 기본값은 on.
-- -----------------------------------------------------------------------------
create table public.notification_prefs (
  profile_id           uuid primary key references public.profiles (id) on delete cascade,
  -- 슬롯1 데일리 앵커 (광고성 — marketing_consent 와 AND 로 판정)
  channel_daily        boolean not null default true,
  -- 슬롯2 이벤트성 (기능성 — 매칭/메시지/좋아요. 안전·법적 고지는 이 토글과 무관하게 발송)
  channel_event        boolean not null default true,
  -- 미접속 리마인더 (광고성)
  channel_reminder     boolean not null default true,
  -- 정보통신망법 §50 광고성 정보 수신 동의 (opt-in). 야간 별도 동의는 받지 않음(B1 L6
  -- 확정) — 대신 발송이 08~21시 밖으로 나가지 않게 함수 레벨에서 하드 가드.
  marketing_consent    boolean not null default false,
  -- 동의/철회 시각 — 분쟁 입증 + 2년 주기 재확인 cron 기준(B1 §6-③c). 트리거가 기록.
  marketing_consent_at timestamptz,
  -- IANA 시간대. Phase 1 은 KST 고정 운영이지만 스키마는 유저별 확장 여지를 남긴다.
  timezone             text not null default 'Asia/Seoul',
  updated_at           timestamptz not null default now()
);

create trigger trg_notification_prefs_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- marketing_consent 변경 시각은 서버가 기록 — 클라이언트가 임의 시각을 못 넣게
-- 컬럼 권한에서 제외하고 트리거로만 세팅한다.
create or replace function public.set_marketing_consent_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.marketing_consent then
      new.marketing_consent_at := now();
    end if;
  elsif new.marketing_consent is distinct from old.marketing_consent then
    new.marketing_consent_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_notification_prefs_consent_at
  before insert or update on public.notification_prefs
  for each row execute function public.set_marketing_consent_at();

alter table public.notification_prefs enable row level security;

-- RLS: 자기 행만
create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy notification_prefs_insert_own on public.notification_prefs
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy notification_prefs_update_own on public.notification_prefs
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- 컬럼 권한: marketing_consent_at·updated_at 은 트리거 전용 (D1-7 과 동일 수법)
revoke insert, update, delete on public.notification_prefs from anon, authenticated;
grant insert (profile_id, channel_daily, channel_event, channel_reminder,
              marketing_consent, timezone)
  on public.notification_prefs to authenticated;
grant update (channel_daily, channel_event, channel_reminder,
              marketing_consent, timezone)
  on public.notification_prefs to authenticated;

comment on table public.notification_prefs is
  'D7 알림 설정. 행 부재 = 광고성 미동의(opt-in). marketing_consent 가 B1 L6 의 광고성 수신동의 저장처.';

-- -----------------------------------------------------------------------------
-- 2. notification_log — 발송 이력 (일 2건 상한 · 중복 방지 판정 · push_sent 계측 원천)
--    service role 전용. 발송 파이프라인은 "선점 insert → 발송 → 실패 시 update"
--    순서로 사용해 동시 발송 경쟁을 unique 인덱스로 차단한다.
-- -----------------------------------------------------------------------------
create table public.notification_log (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  -- 슬롯: daily(슬롯1) / event(슬롯2) / reminder(미접속 D3·D7, 슬롯1 대체) / system(제재·결제 고지 등)
  slot         text not null check (slot in ('daily', 'event', 'reminder', 'system')),
  -- 카피/딥링크 결정 키 (A3 §4.1 push_sent props 와 함께 로깅)
  kind         text not null check (kind in (
    'daily_card',                                   -- 슬롯1
    'match_created', 'new_message', 'like_received', -- 슬롯2 우선순위 ①②③
    'match_no_chat_24h',                            -- 슬롯2 우선순위 ④
    'reminder_d3', 'reminder_d7',                   -- 미접속 리마인더
    'renewal_notice', 'consent_recheck', 'system'   -- 기능성 고지 (Phase 3 / 2년 재확인)
  )),
  is_marketing boolean not null,                    -- "(광고)" 표기·동의 검증 여부 감사용
  title        text not null,
  body         text not null,
  deeplink     text not null default '/home',
  status       text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error        text,
  for_date     date not null,                       -- KST 달력일 (상한·중복 판정 단위)
  created_at   timestamptz not null default now()
);

-- 일 상한/중복 판정: (프로필, 날짜) 스캔
create index idx_notification_log_daily
  on public.notification_log (profile_id, for_date, status);
-- 리마인더 주 1회 상한: 최근 발송 시각 스캔 + D8 슬롯별 오픈율 집계
create index idx_notification_log_slot
  on public.notification_log (slot, created_at desc);

-- 슬롯별 하루 1건 하드 보장 (system 은 상한 제외 — 제재/결제 고지는 법정 고지라 무제한)
create unique index uq_notification_log_slot_per_day
  on public.notification_log (profile_id, for_date, slot)
  where status = 'sent' and slot in ('daily', 'event', 'reminder');

alter table public.notification_log enable row level security;
-- 정책 없음 = service role 외 전면 차단
revoke all on public.notification_log from anon, authenticated;

comment on table public.notification_log is
  'D7 발송 이력 — 일 2건 상한·슬롯별 1건 중복 방지 판정용. service role 전용. 슬롯2 이월 금지는 "폐기" 로 구현(미발송 건은 기록조차 남기지 않음).';

-- -----------------------------------------------------------------------------
-- 3. KST 헬퍼
-- -----------------------------------------------------------------------------
create or replace function public.kst_now()
returns timestamp
language sql stable
as $$
  select (now() at time zone 'Asia/Seoul');
$$;

create or replace function public.kst_today()
returns date
language sql stable
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

-- -----------------------------------------------------------------------------
-- 4. pick_daily_push_targets() — 슬롯1(08:00 데일리 앵커) 발송 대상 선정
--
-- 조건 (03 §3.1 + 07 L6):
--   ① 오늘(KST) 추천이 생성되어 있음 (D3 daily-recommendations 산출)
--   ② 광고성 동의(marketing_consent) + channel_daily on   — opt-in
--   ③ 오늘 발송 건수 < 2 && 오늘 슬롯1 미발송
--   ④ 야간 회피: KST 08:00~20:59 안에서만 결과를 반환 (cron 이 08:00 을 지키지만
--      재시도·지연이 야간에 걸리는 사고 방지용 함수 레벨 하드 가드 — B1 §6-③b)
--   ⑤ 오늘 06:00(KST) 이후 이미 접속한 유저는 생략 — 그날 슬롯1 은 소멸(전용 금지)
--   ⑥ 활성 푸시 토큰 보유 + 활성 회원
-- -----------------------------------------------------------------------------
create or replace function public.pick_daily_push_targets()
returns table (
  profile_id uuid,
  user_id    uuid,
  nickname   text,
  reco_count integer
)
language sql stable
security definer set search_path = public, pg_temp
as $$
  select p.id, p.user_id, p.nickname, count(dr.id)::integer
  from public.profiles p
  join public.notification_prefs np
    on np.profile_id = p.id
   and np.channel_daily
   and np.marketing_consent                                      -- ② 광고성 opt-in
  join public.daily_recommendations dr
    on dr.profile_id = p.id
   and dr.for_date = public.kst_today()                          -- ① 오늘 추천 존재
  where p.status = 'active'
    and extract(hour from public.kst_now()) between 8 and 20     -- ④ 야간 하드 가드
    and p.last_active_at
        < (public.kst_today() + time '06:00') at time zone 'Asia/Seoul'  -- ⑤ 기접속 생략
    and exists (
      select 1 from public.push_tokens t
      where t.user_id = p.user_id and t.is_active
    )                                                            -- ⑥ 토큰 보유
    and not exists (
      select 1 from public.notification_log nl
      where nl.profile_id = p.id
        and nl.for_date = public.kst_today()
        and nl.slot in ('daily', 'reminder')
        and nl.status = 'sent'
    )                                                            -- ③ 슬롯1 계열 미발송
    and (
      select count(*) from public.notification_log nl2
      where nl2.profile_id = p.id
        and nl2.for_date = public.kst_today()
        and nl2.slot in ('daily', 'event', 'reminder')
        and nl2.status = 'sent'
    ) < 2                                                        -- ③ 일 2건 상한
  group by p.id, p.user_id, p.nickname
$$;

revoke execute on function public.pick_daily_push_targets() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. pick_reminder_push_targets() — 미접속 D3/D7 리마인더 대상 선정 (슬롯1 대체)
--
-- 스팸 상한 (03 §3.1 + 임무 확정):
--   · 미접속 정확히 3일 또는 7일인 날에만 대상 — 구조적으로 주 1회 이하
--   · 이중 안전장치로 "최근 7일 내 리마인더 발송 이력 없음" 조건 추가
--   · D7 이후 무반응 = 추가 리마인더 없음(전면 중단). 주 1회 다이제스트 강등은
--     Phase 2+ 미구현 — 도입 시 이 함수에 케이스 추가
--   · 리마인더는 광고성(혜택 소구형) 분류 → marketing_consent 필수, 카피는 팩트형만
-- -----------------------------------------------------------------------------
create or replace function public.pick_reminder_push_targets()
returns table (
  profile_id    uuid,
  user_id       uuid,
  nickname      text,
  days_inactive integer
)
language sql stable
security definer set search_path = public, pg_temp
as $$
  select p.id, p.user_id, p.nickname,
         (public.kst_today() - (p.last_active_at at time zone 'Asia/Seoul')::date)::integer
  from public.profiles p
  join public.notification_prefs np
    on np.profile_id = p.id
   and np.channel_reminder
   and np.marketing_consent
  where p.status = 'active'
    and extract(hour from public.kst_now()) between 8 and 20     -- 야간 하드 가드
    and (public.kst_today() - (p.last_active_at at time zone 'Asia/Seoul')::date)
        in (3, 7)                                                -- 정확히 D3 / D7
    and exists (
      select 1 from public.push_tokens t
      where t.user_id = p.user_id and t.is_active
    )
    and not exists (                                             -- 주 1회 이하 이중 가드
      select 1 from public.notification_log nl
      where nl.profile_id = p.id
        and nl.slot = 'reminder'
        and nl.status = 'sent'
        and nl.created_at > now() - interval '7 days'
    )
    and not exists (                                             -- 오늘 슬롯1 계열 미발송
      select 1 from public.notification_log nl
      where nl.profile_id = p.id
        and nl.for_date = public.kst_today()
        and nl.slot in ('daily', 'reminder')
        and nl.status = 'sent'
    )
    and (
      select count(*) from public.notification_log nl2
      where nl2.profile_id = p.id
        and nl2.for_date = public.kst_today()
        and nl2.slot in ('daily', 'event', 'reminder')
        and nl2.status = 'sent'
    ) < 2                                                        -- 일 2건 상한
$$;

revoke execute on function public.pick_reminder_push_targets() from public, anon, authenticated;

-- =============================================================================
-- 6. pg_cron 등록 — KST 06:00 추천 생성(D3) + 08:00 데일리 푸시(슬롯1)
--
--   · pg_cron 은 UTC 기준: KST 06:00 = UTC 21:00(전일), KST 08:00 = UTC 23:00(전일)
--   · Edge Function 호출은 pg_net(net.http_post) — Supabase cron 표준 형식
--   · 프로젝트 URL / service role 키는 배포 시 치환하는 플레이스홀더 변수.
--     미치환 상태로 마이그레이션이 돌면 잡을 등록하지 않고 notice 만 남긴다
--     (로컬 supabase db reset 이 실패하지 않도록).
--   · 슬롯2(이벤트성)는 cron 이 아니라 D3/D4 서버 로직이 발생 즉시
--     push-dispatch 를 { job: "event" } 로 호출한다 (12~21시 창·상한은 함수가 판정).
-- =============================================================================
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
exception when others then
  raise notice '[00011] pg_cron/pg_net 확장을 만들 수 없어 cron 등록을 건너뜁니다 (로컬 개발 환경 추정): %', sqlerrm;
end $$;

do $$
declare
  -- ▼▼ 배포 시 치환 (예: https://abcdefgh.supabase.co) ▼▼
  project_url text := '{{SUPABASE_PROJECT_URL}}';
  service_key text := '{{SUPABASE_SERVICE_ROLE_KEY}}';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice '[00011] pg_cron/pg_net 미설치 — cron 등록 생략';
    return;
  end if;

  if project_url like '{{%' or service_key like '{{%' then
    raise notice '[00011] 플레이스홀더 미치환 — cron 등록 생략. 배포 파이프라인에서 SUPABASE_PROJECT_URL/SERVICE_ROLE_KEY 치환 후 아래 cron.schedule 2건을 실행할 것.';
    return;
  end if;

  -- KST 06:00 — D3 daily-recommendations 호출 (오늘의 추천 5명 + 궁합 카드 발행)
  perform cron.schedule(
    'duckmate-daily-reco-kst0600',
    '0 21 * * *',
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"job":"generate"}'::jsonb
      )
      $job$,
      project_url || '/functions/v1/daily-recommendations',
      service_key
    )
  );

  -- KST 08:00 — 슬롯1 데일리 앵커 푸시 + 미접속 D3/D7 리마인더 (push-dispatch)
  perform cron.schedule(
    'duckmate-push-slot1-kst0800',
    '0 23 * * *',
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{"job":"slot1"}'::jsonb
      )
      $job$,
      project_url || '/functions/v1/push-dispatch',
      service_key
    )
  );

  raise notice '[00011] cron 2건 등록 완료 (daily-reco KST06:00, push-slot1 KST08:00)';
end $$;
