-- =============================================================================
-- 0050 — 푸시 코어 (D7): 템플릿 메타 · 사용자 설정 · 큐 · 정책 판정 · 훅 함수
-- 의존: 0001~0014 (push_subscriptions / notification_log / consents / profiles / loop_date / admin_users)
--       0040 moderation_notifications 는 0051 의 drain 함수가 "존재하면" 읽는다(동적 SQL, 하드 의존 없음).
-- 원칙 (A3 §7 · B1 §0-23/24 · PRD §4.8):
--   · 일 예산 2건(loop_date 기준) — 매칭/답장(transactional)은 예산 미소비, 같은 템플릿 60분 내 뭉침
--   · 서비스/transactional 야간 23:00~07:00 KST 보류(큐에 held → 07:00 flush). 슬롯 A(07:30)가 잘리지 않도록
--     오케스트레이터 지시의 21:00~08:00 은 채택하지 않고 PRD §0-45·constants.PUSH_QUIET_HOURS_KST 를 따른다.
--   · 마케팅은 08:00~21:00 KST 하드코딩 + consents(marketing_push) 동의 필수. 창 밖이면 보류가 아니라 폐기.
--   · 실제 전송 시도만 notification_log 에 남기고(성공/실패), 보류·폐기 사유는 push_queue.status/hold_reason.
--   · service 전용 함수는 public/anon/authenticated 에서 execute 를 명시 회수(D2 §0-28).
-- =============================================================================

-- ---------- enum ----------
create type public.push_queue_status as enum ('pending', 'held', 'sending', 'sent', 'failed', 'discarded');

-- ---------- notification_log 델타: 큐 연결 ----------
alter table public.notification_log add column if not exists queue_id bigint;
create index if not exists notification_log_queue_idx on public.notification_log (queue_id) where queue_id is not null;
create index if not exists notification_log_user_template_idx on public.notification_log (user_id, template, sent_at desc);
comment on column public.notification_log.queue_id is 'push_queue.id. 예산은 큐 항목당 1회만 소비(구독 여러 개여도 budget_consumed 는 첫 성공 행만 true).';

-- ---------- 정책 설정 (service role 전용 app_settings) ----------
insert into public.app_settings (key, value) values (
  'push_policy',
  jsonb_build_object(
    'quiet_start', '23:00', 'quiet_end', '07:00',       -- 서비스/transactional 야간 보류(KST)
    'daily_budget', 2,
    'bundle_minutes', 60,
    'reminder_cap_30d', 2,
    'slot_b_start', '19:30', 'slot_b_end', '21:00', 'slot_b_late', '20:30'
  )
) on conflict (key) do nothing;
-- 마케팅 창 08:00~21:00 은 법정(정보통신망법 §50③) → 설정이 아니라 함수 상수.

-- ---------- push_templates (메타만. 카피는 apps/web/lib/push/templates.ts = Edge push-send/lib/templates.ts) ----------
create table public.push_templates (
  key              text primary key,
  kind             public.push_kind not null,
  slot             public.push_slot not null,
  consumes_budget  boolean not null,
  bundle_minutes   integer not null default 0 check (bundle_minutes >= 0),   -- >0 = 같은 템플릿 N분 내 뭉침
  hold_at_night    boolean not null default true,                            -- 야간 보류(마케팅은 무관: 항상 폐기)
  priority_rank    smallint,                                                 -- 슬롯 B 우선순위(작을수록 우선). null = 슬롯 B 아님
  deeplink         text not null,
  description      text
);
comment on table public.push_templates is 'kind/slot/예산/뭉침 메타. 카피는 TS 템플릿(단일 소스). kind 분류 근거는 docs/agents/20_notifications.md §2.';
insert into public.push_templates (key, kind, slot, consumes_budget, bundle_minutes, hold_at_night, priority_rank, deeplink, description) values
  ('daily_reco_ready',   'service',       'A',       true,  0,  true,  null, '/reco',                   '07:30 새 추천 N명 도착(+결과 대기 N건)'),
  ('unseen_match',       'service',       'B',       true,  0,  true,  1,    '/chat',                   '슬롯 B ①: 미확인 매칭'),
  ('unreplied_message',  'service',       'B',       true,  0,  true,  2,    '/chat',                   '슬롯 B ②: 미답장 메시지'),
  ('photo_reviewed',     'service',       'B',       true,  0,  true,  3,    '/me/photos',              '슬롯 B ③: 사진 검수 결과(D8 → notify_profile)'),
  ('reco_remaining',     'service',       'B',       true,  0,  true,  4,    '/reco',                   '슬롯 B ④: 오늘 추천 미완료'),
  ('reminder_d3',        'service',       'B',       true,  0,  true,  5,    '/home',                   '미접속 3일 리마인더(정보형, 30일 내 리마인더 2건 상한)'),
  ('reminder_d7',        'service',       'B',       true,  0,  true,  5,    '/home',                   '미접속 7일 리마인더'),
  ('new_match',          'transactional', 'instant', false, 60, true,  null, '/match/{match_id}',       '매칭 성사(상대 행동의 응답 → 예산 미소비, 60분 뭉침)'),
  ('new_message',        'transactional', 'instant', false, 60, true,  null, '/chat/{match_id}',        '답장 도착(원문 미포함)'),
  ('suggestion_reply',   'transactional', 'instant', false, 60, true,  null, '/chat/{match_id}',        '제안 카드로 첫 대화 시작'),
  ('report_resolved',    'transactional', 'instant', false, 0,  true,  null, '/settings',               '신고 처리 완료(D5 notify_user → drain)'),
  ('sanction_issued',    'transactional', 'instant', false, 0,  true,  null, '/suspended',              '제재 통보(사유 카테고리·기간·이의신청)'),
  ('sanction_lifted',    'transactional', 'instant', false, 0,  true,  null, '/home',                   '제재 해제'),
  ('appeal_decided',     'transactional', 'instant', false, 0,  true,  null, '/appeal',                 '이의신청 결과'),
  ('reconsent_needed',   'service',       'instant', false, 0,  true,  null, '/settings/notifications', '마케팅 수신동의 2년 재확인 안내(D-30). 광고성 아님'),
  ('marketing_event',    'marketing',     'B',       true,  0,  false, null, '/home',                   '(광고) 이벤트. 08~21시·동의자만'),
  ('marketing_benefit',  'marketing',     'B',       true,  0,  false, null, '/home',                   '(광고) 혜택. 08~21시·동의자만'),
  ('admin_alert',        'transactional', 'instant', false, 60, false, null, '/admin/reports',          '운영자 알림(notify_admin_push). 야간에도 전송');

-- ---------- push_prefs (사용자별 설정: 서비스 알림 on/off · 개인 방해금지 시간) ----------
create table public.push_prefs (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  service_enabled  boolean not null default true,
  quiet_start      time,                       -- KST. null = 개인 방해금지 없음(시스템 23~07 은 항상 적용)
  quiet_end        time,
  updated_at       timestamptz not null default now(),
  constraint push_prefs_quiet_pair check ((quiet_start is null) = (quiet_end is null))
);
comment on table public.push_prefs is '서비스 알림 마스터 토글 + 개인 방해금지(KST). 마케팅 동의는 consents(marketing_push) 만이 소스.';
alter table public.push_prefs enable row level security;
grant select, insert, update, delete on public.push_prefs to authenticated;
create policy push_prefs_self on public.push_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger push_prefs_set_updated_at before update on public.push_prefs
  for each row execute function public.set_updated_at();

-- ---------- push_queue ----------
create table public.push_queue (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references auth.users(id) on delete cascade,
  profile_id           uuid references public.profiles(id) on delete cascade,
  template             text not null references public.push_templates(key),
  kind                 public.push_kind not null,
  slot                 public.push_slot not null,
  params               jsonb not null default '{}'::jsonb,        -- 카피 바인딩 값만(닉네임·건수·id). 메시지 원문·개인정보 금지
  dedupe_key           text not null,
  merged_count         integer not null default 1,
  scheduled_at         timestamptz not null default now(),
  status               public.push_queue_status not null default 'pending',
  hold_reason          text,                                       -- QUIET_HOURS / USER_QUIET / BUNDLE
  discard_reason       text,                                       -- can_send_push 의 reason
  attempts             integer not null default 0,
  last_error           text,
  like_id              uuid references public.likes(id) on delete set null,
  notification_log_id  bigint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_at              timestamptz
);
comment on table public.push_queue is 'notify_profile / enqueue_slot_* 가 insert, push-dispatch Edge Function 이 claim_push_queue 로 소비(5분). 보류·폐기 사유의 감사 기록.';
create unique index push_queue_dedupe_open on public.push_queue (dedupe_key) where status in ('pending', 'held', 'sending');
create index push_queue_due_idx on public.push_queue (scheduled_at) where status in ('pending', 'held');
create index push_queue_user_idx on public.push_queue (user_id, created_at desc);
alter table public.push_queue enable row level security;   -- 정책 없음 = service role 전용
create trigger push_queue_set_updated_at before update on public.push_queue
  for each row execute function public.set_updated_at();

-- ---------- admin_notifications (notify_admin_push 의 실제 저장소) ----------
create table public.admin_notifications (
  id            bigint generated always as identity primary key,
  kind          text not null,
  payload       jsonb not null default '{}'::jsonb,
  source_id     bigint,                                            -- moderation_notifications.id (drain 경유 시)
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  delivery      jsonb,
  read_at       timestamptz,
  read_by       uuid references auth.users(id) on delete set null
);
comment on table public.admin_notifications is '운영자 알림함(D8 어드민 UI 가 service role 로 읽고 read_at 갱신). 푸시는 admin_users 의 push_subscriptions 로 admin_alert 템플릿.';
create index admin_notifications_unread_idx on public.admin_notifications (created_at desc) where read_at is null;
alter table public.admin_notifications enable row level security;   -- service role 전용

-- ---------- consent_rechecks (2년 재확인 추적) ----------
create table public.consent_rechecks (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_id   bigint not null unique references public.consents(id) on delete cascade,
  notified_at  timestamptz,
  due_at       timestamptz not null,
  resolved_at  timestamptz,
  outcome      text check (outcome in ('renewed', 'withdrawn', 'expired')),
  created_at   timestamptz not null default now()
);
comment on table public.consent_rechecks is 'marketing_push 동의 행별 2년 재확인: D-30 안내(notified_at) → 만료 시 미응답이면 consents(agreed=false, source=recheck) 로 OFF.';
create index consent_rechecks_due_idx on public.consent_rechecks (due_at) where resolved_at is null;
alter table public.consent_rechecks enable row level security;   -- service role 전용

-- =============================================================================
-- KST 시각 헬퍼
-- =============================================================================
create or replace function public.kst_time(p_at timestamptz default now())
returns time language sql immutable parallel safe as $$
  select (p_at at time zone 'Asia/Seoul')::time
$$;

create or replace function public.kst_date(p_at timestamptz default now())
returns date language sql immutable parallel safe as $$
  select (p_at at time zone 'Asia/Seoul')::date
$$;

create or replace function public.kst_at(p_date date, p_time time)
returns timestamptz language sql immutable parallel safe as $$
  select (p_date + p_time) at time zone 'Asia/Seoul'
$$;

/** [p_start, p_end) 창 안인지. start > end 면 자정을 넘는 창(예 23:00~07:00) */
create or replace function public.time_in_window(p_t time, p_start time, p_end time)
returns boolean language sql immutable parallel safe as $$
  select case when p_start <= p_end then p_t >= p_start and p_t < p_end
              else p_t >= p_start or p_t < p_end end
$$;

/** p_at 이후 처음 오는 KST p_time 시각 (p_at 이 정확히 그 시각이면 다음날) */
create or replace function public.next_kst_time(p_at timestamptz, p_time time)
returns timestamptz language sql immutable parallel safe as $$
  select case when public.kst_at(public.kst_date(p_at), p_time) > p_at
              then public.kst_at(public.kst_date(p_at), p_time)
              else public.kst_at(public.kst_date(p_at) + 1, p_time) end
$$;

create or replace function public.push_policy_text(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value ->> p_key from public.app_settings where key = 'push_policy'), p_default)
$$;

create or replace function public.push_policy_int(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> p_key)::integer from public.app_settings where key = 'push_policy'), p_default)
$$;

/** 서비스/transactional 야간(기본 23:00~07:00 KST) */
create or replace function public.is_push_quiet_kst(p_at timestamptz default now())
returns boolean language sql stable security definer set search_path = public as $$
  select public.time_in_window(public.kst_time(p_at),
                               public.push_policy_text('quiet_start', '23:00')::time,
                               public.push_policy_text('quiet_end', '07:00')::time)
$$;

/** 마케팅 허용 창 08:00~21:00 KST — 법정(정보통신망법 §50③), 설정 불가 */
create or replace function public.is_marketing_window_kst(p_at timestamptz default now())
returns boolean language sql immutable parallel safe as $$
  select public.time_in_window(public.kst_time(p_at), time '08:00', time '21:00')
$$;

-- =============================================================================
-- 예산 · 동의 · 판정
-- =============================================================================
/** loop_date 기준 예산 소비 건수(실패 행 제외) */
create or replace function public.push_budget_used(p_user_id uuid, p_loop_date date default null)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.notification_log
  where user_id = p_user_id and loop_date = coalesce(p_loop_date, public.loop_date(now()))
    and budget_consumed and error is null
$$;

/** 마케팅 수신 동의 현재 상태: 최신 marketing_push 행이 agreed ∧ 미철회 */
create or replace function public.has_marketing_consent(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select c.agreed and c.withdrawn_at is null
    from public.consents c
    where c.user_id = p_user_id and c.key = 'marketing_push'
    order by c.agreed_at desc, c.id desc
    limit 1
  ), false)
$$;

/**
 * 정책 판정. 반환 jsonb:
 *   { allowed, action: 'send'|'hold'|'discard', reason, release_at, budget_used, budget_limit }
 * 순서: 프로필 상태 → 구독 존재 → 슬롯/서비스 토글 → (마케팅) 동의·법정 창 → 예산 → 야간/개인 방해금지 → 뭉침
 */
create or replace function public.can_send_push(
  p_profile_id uuid,
  p_kind public.push_kind,
  p_template text default null,
  p_at timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_p            public.profiles%rowtype;
  v_meta         public.push_templates%rowtype;
  v_prefs        public.push_prefs%rowtype;
  v_has_sub      boolean;
  v_slot_on      boolean;
  v_used         integer := 0;
  v_limit        integer := public.push_policy_int('daily_budget', 2);
  v_release      timestamptz;
  v_reason       text;
  v_last_sent    timestamptz;
  v_bundle       integer;
begin
  select * into v_p from public.profiles where id = p_profile_id;
  if not found then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'NO_PROFILE');
  end if;
  if p_template is not null then
    select * into v_meta from public.push_templates where key = p_template;
    if not found then return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'UNKNOWN_TEMPLATE'); end if;
    if v_meta.kind <> p_kind then return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'KIND_MISMATCH'); end if;
  end if;

  -- 프로필 상태: deleting/age_blocked 는 전부 폐기, paused(휴면) 는 계정 관련 통보만, banned 는 제재 통보만
  if v_p.status in ('deleting', 'age_blocked') then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'PROFILE_INACTIVE');
  elsif v_p.status = 'paused' and coalesce(p_template, '') not in ('sanction_issued', 'sanction_lifted', 'report_resolved', 'appeal_decided', 'reconsent_needed') then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'PROFILE_PAUSED');
  elsif v_p.status = 'banned' and coalesce(p_template, '') not in ('sanction_issued', 'appeal_decided') then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'PROFILE_BANNED');
  end if;

  -- 구독 + 슬롯 토글
  select exists (select 1 from public.push_subscriptions s where s.user_id = v_p.user_id and s.disabled_at is null) into v_has_sub;
  if not v_has_sub then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'NO_SUBSCRIPTION');
  end if;
  if v_meta.key is not null then
    select exists (
      select 1 from public.push_subscriptions s
      where s.user_id = v_p.user_id and s.disabled_at is null
        and case v_meta.slot when 'A' then s.slot_a_enabled when 'B' then s.slot_b_enabled else s.instant_enabled end
    ) into v_slot_on;
    if not v_slot_on and v_meta.kind <> 'marketing' then
      return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'SLOT_OFF');
    end if;
  end if;
  select * into v_prefs from public.push_prefs where user_id = v_p.user_id;
  if found and not v_prefs.service_enabled and p_kind <> 'marketing'
     and coalesce(p_template, '') not in ('sanction_issued', 'reconsent_needed') then
    return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'SERVICE_OFF');
  end if;

  -- 마케팅: 동의 + 법정 창. 창 밖은 보류 없이 폐기(다음 발송 배치가 새로 만든다)
  if p_kind = 'marketing' then
    if not public.has_marketing_consent(v_p.user_id) then
      return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'NO_MARKETING_CONSENT');
    end if;
    if not public.is_marketing_window_kst(p_at) then
      return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'MARKETING_NIGHT');
    end if;
  end if;

  -- 예산 (transactional 은 미소비)
  if coalesce(v_meta.consumes_budget, p_kind <> 'transactional') then
    v_used := public.push_budget_used(v_p.user_id, public.loop_date(p_at));
    if v_used >= v_limit then
      return jsonb_build_object('allowed', false, 'action', 'discard', 'reason', 'BUDGET_EXCEEDED',
                                'budget_used', v_used, 'budget_limit', v_limit);
    end if;
  end if;

  -- 야간 보류 (마케팅은 위에서 폐기됨)
  if p_kind <> 'marketing' and coalesce(v_meta.hold_at_night, true) then
    if public.is_push_quiet_kst(p_at) then
      v_release := public.next_kst_time(p_at, public.push_policy_text('quiet_end', '07:00')::time);
      v_reason := 'QUIET_HOURS';
    elsif v_prefs.quiet_start is not null and public.time_in_window(public.kst_time(p_at), v_prefs.quiet_start, v_prefs.quiet_end) then
      v_release := public.next_kst_time(p_at, v_prefs.quiet_end);
      v_reason := 'USER_QUIET';
    end if;
  end if;

  -- 뭉침: 같은 템플릿이 N분 내 전송됐으면 그 시각 + N분까지 보류(큐에서 병합)
  v_bundle := coalesce(v_meta.bundle_minutes, 0);
  if v_bundle > 0 then
    select max(sent_at) into v_last_sent from public.notification_log
    where user_id = v_p.user_id and template = v_meta.key and error is null and sent_at > p_at - make_interval(mins => v_bundle);
    if v_last_sent is not null then
      v_release := greatest(coalesce(v_release, '-infinity'::timestamptz), v_last_sent + make_interval(mins => v_bundle));
      v_reason := coalesce(v_reason, 'BUNDLE');
    end if;
  end if;

  if v_release is not null then
    return jsonb_build_object('allowed', false, 'action', 'hold', 'reason', v_reason, 'release_at', v_release,
                              'budget_used', v_used, 'budget_limit', v_limit);
  end if;
  return jsonb_build_object('allowed', true, 'action', 'send', 'reason', 'OK', 'budget_used', v_used, 'budget_limit', v_limit);
end $$;
comment on function public.can_send_push is 'D7 정책 판정 단일 지점. notify_profile 이 enqueue 시, claim_push_queue 가 전송 직전에 다시 호출한다.';

-- =============================================================================
-- 큐 삽입 (내부) · 훅 함수
-- =============================================================================
/**
 * 내부 enqueue. p_scheduled_at null 이면 슬롯 B 템플릿은 다음 슬롯 B 창(19:30 KST), 그 외 즉시.
 * 같은 dedupe_key 의 열린 행이 있으면 merged_count+1 + params 병합(뭉침).
 * 반환: {queued, queue_id, merged, action, reason, scheduled_at}
 */
create or replace function public.enqueue_push(
  p_profile_id uuid,
  p_template text,
  p_params jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default null,
  p_dedupe_key text default null,
  p_like_id uuid default null,
  p_at timestamptz default now()
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_meta      public.push_templates%rowtype;
  v_user      uuid;
  v_decision  jsonb;
  v_action    text;
  v_dedupe    text;
  v_sched     timestamptz;
  v_status    public.push_queue_status;
  v_hold      text;
  v_existing  public.push_queue%rowtype;
  v_id        bigint;
  v_ld        date;
begin
  select * into v_meta from public.push_templates where key = p_template;
  if not found then raise exception 'INVALID_INPUT: unknown push template %', p_template; end if;
  select user_id into v_user from public.profiles where id = p_profile_id;
  if v_user is null then return jsonb_build_object('queued', false, 'action', 'discard', 'reason', 'NO_PROFILE'); end if;

  v_decision := public.can_send_push(p_profile_id, v_meta.kind, p_template, coalesce(p_scheduled_at, p_at));
  v_action := v_decision ->> 'action';
  if v_action = 'discard' then
    -- 감사용으로 폐기 행을 남긴다(dedupe 제외: unique 는 열린 상태만)
    insert into public.push_queue (user_id, profile_id, template, kind, slot, params, dedupe_key, scheduled_at, status, discard_reason, like_id)
    values (v_user, p_profile_id, p_template, v_meta.kind, v_meta.slot, coalesce(p_params, '{}'::jsonb),
            coalesce(p_dedupe_key, v_user::text || ':' || p_template || ':' || clock_timestamp()::text),
            coalesce(p_scheduled_at, p_at), 'discarded', v_decision ->> 'reason', p_like_id)
    returning id into v_id;
    return jsonb_build_object('queued', false, 'queue_id', v_id, 'action', 'discard', 'reason', v_decision ->> 'reason');
  end if;

  -- 예약 시각
  v_sched := p_scheduled_at;
  if v_sched is null then
    if v_meta.slot = 'B' and not public.time_in_window(public.kst_time(p_at),
         public.push_policy_text('slot_b_start', '19:30')::time, public.push_policy_text('slot_b_end', '21:00')::time) then
      v_sched := public.next_kst_time(p_at, public.push_policy_text('slot_b_start', '19:30')::time);
    else
      v_sched := p_at;
    end if;
  end if;
  v_ld := public.loop_date(v_sched);

  -- 슬롯 B 는 하루 1건: 이미 오늘 슬롯 B 를 보냈으면 폐기
  if v_meta.slot = 'B' and v_meta.kind <> 'marketing' and exists (
    select 1 from public.notification_log l where l.user_id = v_user and l.slot = 'B' and l.loop_date = v_ld and l.error is null
  ) then
    insert into public.push_queue (user_id, profile_id, template, kind, slot, params, dedupe_key, scheduled_at, status, discard_reason)
    values (v_user, p_profile_id, p_template, v_meta.kind, v_meta.slot, coalesce(p_params, '{}'::jsonb),
            v_user::text || ':' || p_template || ':' || clock_timestamp()::text, v_sched, 'discarded', 'SLOT_B_USED')
    returning id into v_id;
    return jsonb_build_object('queued', false, 'queue_id', v_id, 'action', 'discard', 'reason', 'SLOT_B_USED');
  end if;

  -- dedupe 키: 뭉침 템플릿은 열린 행 1개, 슬롯 B 는 하루 1행(템플릿 무관), 그 외 템플릿·loop_date
  v_dedupe := coalesce(p_dedupe_key,
    case when v_meta.bundle_minutes > 0 then v_user::text || ':' || p_template || ':open'
         when v_meta.slot = 'B' and v_meta.kind <> 'marketing' then v_user::text || ':B:' || v_ld::text
         else v_user::text || ':' || p_template || ':' || v_ld::text end);

  if v_action = 'hold' then
    v_status := 'held'; v_hold := v_decision ->> 'reason';
    v_sched := greatest(v_sched, (v_decision ->> 'release_at')::timestamptz);
  else
    v_status := 'pending';
  end if;

  select * into v_existing from public.push_queue where dedupe_key = v_dedupe and status in ('pending', 'held', 'sending') for update;
  if found then
    if v_existing.status = 'sending' then
      -- 전송 중이면 다음 행으로(전송 완료 후 unique 해제). 뭉침 창 안이므로 release 로 보류
      insert into public.push_queue (user_id, profile_id, template, kind, slot, params, dedupe_key, scheduled_at, status, hold_reason, like_id)
      values (v_user, p_profile_id, p_template, v_meta.kind, v_meta.slot, coalesce(p_params, '{}'::jsonb),
              v_dedupe || ':' || clock_timestamp()::text, greatest(v_sched, p_at + make_interval(mins => greatest(v_meta.bundle_minutes, 1))), 'held', 'BUNDLE', p_like_id)
      returning id into v_id;
      return jsonb_build_object('queued', true, 'queue_id', v_id, 'merged', false, 'action', 'hold', 'reason', 'BUNDLE');
    end if;
    -- 슬롯 B 우선순위: 낮은 rank 가 기존 행을 대체, 아니면 병합 카운트만
    if v_meta.slot = 'B' and v_existing.template <> p_template then
      if coalesce(v_meta.priority_rank, 99) < coalesce((select t.priority_rank from public.push_templates t where t.key = v_existing.template), 99) then
        update public.push_queue set template = p_template, kind = v_meta.kind, params = coalesce(p_params, '{}'::jsonb),
               like_id = coalesce(p_like_id, like_id), scheduled_at = least(scheduled_at, v_sched)
        where id = v_existing.id;
        return jsonb_build_object('queued', true, 'queue_id', v_existing.id, 'merged', false, 'replaced', v_existing.template, 'action', v_action, 'reason', 'PRIORITY');
      end if;
      return jsonb_build_object('queued', false, 'queue_id', v_existing.id, 'action', 'discard', 'reason', 'SLOT_B_LOWER_PRIORITY');
    end if;
    update public.push_queue
      set merged_count = merged_count + 1,
          params = params || coalesce(p_params, '{}'::jsonb) || jsonb_build_object('count', merged_count + 1),
          like_id = coalesce(like_id, p_like_id)
      where id = v_existing.id;
    return jsonb_build_object('queued', true, 'queue_id', v_existing.id, 'merged', true, 'merged_count', v_existing.merged_count + 1, 'action', v_existing.status::text, 'reason', 'MERGED');
  end if;

  insert into public.push_queue (user_id, profile_id, template, kind, slot, params, dedupe_key, scheduled_at, status, hold_reason, like_id)
  values (v_user, p_profile_id, p_template, v_meta.kind, v_meta.slot, coalesce(p_params, '{}'::jsonb), v_dedupe, v_sched, v_status, v_hold, p_like_id)
  returning id into v_id;
  return jsonb_build_object('queued', true, 'queue_id', v_id, 'merged', false, 'action', v_action, 'reason', v_decision ->> 'reason', 'scheduled_at', v_sched);
end $$;

/**
 * 훅 (D3/D4/D5/D8 이 호출, service 전용): 정책 검사 후 push_queue insert.
 *   perform public.notify_profile(p_profile_id, 'new_match', jsonb_build_object('match_id', m.id, 'nickname', partner_nick, 'like_id', l.id));
 * params 에 메시지 원문·전화번호·신고자 정보 금지. like_id 는 "좋아요" 계열 신호의 근거(가짜 신호 금지).
 */
create or replace function public.notify_profile(p_profile_id uuid, p_template_key text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_like uuid;
begin
  if p_profile_id is null then return jsonb_build_object('queued', false, 'action', 'discard', 'reason', 'NO_PROFILE'); end if;
  begin
    v_like := nullif(p_params ->> 'like_id', '')::uuid;
  exception when others then v_like := null; end;
  return public.enqueue_push(p_profile_id, p_template_key, coalesce(p_params, '{}'::jsonb) - 'like_id', null, null, v_like, now());
end $$;
comment on function public.notify_profile is 'D7 훅. service 전용. 정책(can_send_push) 통과분만 큐잉, 보류/폐기 사유 반환. D5 stub notify_user 는 drain_moderation_notifications 가 이 함수로 위임.';

/**
 * 운영자 알림 실제 구현(D5 의 notify_admin(kind, payload, report_id, sanction_id) stub 이 위임하도록 병합 요청).
 * admin_notifications 행 + admin_users 전원의 구독으로 admin_alert 큐잉(60분 뭉침, 야간 전송).
 */
create or replace function public.notify_admin_push(p_kind text, p_payload jsonb default '{}'::jsonb, p_source_id bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_admin record; v_n integer := 0;
begin
  insert into public.admin_notifications (kind, payload, source_id) values (p_kind, coalesce(p_payload, '{}'::jsonb), p_source_id) returning id into v_id;
  for v_admin in
    select p.id as profile_id from public.admin_users a join public.profiles p on p.user_id = a.user_id
  loop
    perform public.enqueue_push(v_admin.profile_id, 'admin_alert',
      jsonb_build_object('kind', p_kind, 'summary', left(coalesce(p_payload ->> 'summary', p_kind), 80), 'notification_id', v_id));
    v_n := v_n + 1;
  end loop;
  update public.admin_notifications set delivered_at = now(), delivery = jsonb_build_object('channel', 'push_queue', 'admins', v_n) where id = v_id;
  return v_id;
end $$;

-- =============================================================================
-- 큐 소비 (push-dispatch Edge Function 전용)
-- =============================================================================
/** held → pending (release 시각 경과분). 07:00 KST cron + claim 시 방어적 재호출 */
create or replace function public.flush_held_queue(p_at timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.push_queue set status = 'pending', hold_reason = null
  where status = 'held' and scheduled_at <= p_at;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/**
 * pending·due 행을 전송 직전 재판정하며 claim. 반환 = sending 으로 바뀐 행.
 *   hold → held(release_at) / discard → discarded / send → sending(attempts+1)
 * p_queue_id 지정 시 그 행만(push-send 즉시 경로).
 */
create or replace function public.claim_push_queue(p_limit integer default 50, p_queue_id bigint default null)
returns setof public.push_queue language plpgsql security definer set search_path = public as $$
declare v_row public.push_queue%rowtype; v_d jsonb; v_claimed integer := 0;
begin
  perform public.flush_held_queue(now());
  for v_row in
    select * from public.push_queue q
    where q.status = 'pending' and q.scheduled_at <= now() and (p_queue_id is null or q.id = p_queue_id)
    order by q.scheduled_at, q.id
    limit greatest(p_limit, 1) * 3
    for update skip locked
  loop
    exit when v_claimed >= greatest(p_limit, 1);
    v_d := public.can_send_push(v_row.profile_id, v_row.kind, v_row.template, now());
    if v_d ->> 'action' = 'send' then
      update public.push_queue set status = 'sending', attempts = attempts + 1 where id = v_row.id returning * into v_row;
      v_claimed := v_claimed + 1;
      return next v_row;
    elsif v_d ->> 'action' = 'hold' then
      update public.push_queue set status = 'held', hold_reason = v_d ->> 'reason',
             scheduled_at = greatest((v_d ->> 'release_at')::timestamptz, now() + interval '1 minute')
      where id = v_row.id;
    else
      update public.push_queue set status = 'discarded', discard_reason = v_d ->> 'reason' where id = v_row.id;
    end if;
  end loop;
  return;
end $$;

/**
 * 구독 1개 전송 결과 기록 → notification_log. 예산은 큐 항목당 첫 성공 1회만 소비.
 * 404/410 은 구독 비활성화(disabled_at). 반환 = notification_log.id
 */
create or replace function public.complete_push_send(
  p_queue_id bigint,
  p_subscription_id uuid,
  p_ok boolean,
  p_status_code integer default null,
  p_error text default null,
  p_payload_hash text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_q public.push_queue%rowtype; v_meta public.push_templates%rowtype; v_log bigint; v_first boolean;
begin
  select * into v_q from public.push_queue where id = p_queue_id;
  if not found then raise exception 'NOT_FOUND: push_queue %', p_queue_id; end if;
  select * into v_meta from public.push_templates where key = v_q.template;
  select not exists (select 1 from public.notification_log l where l.queue_id = p_queue_id and l.error is null) into v_first;

  insert into public.notification_log (user_id, subscription_id, kind, slot, template, loop_date, budget_consumed, like_id, payload_hash, error, queue_id)
  values (v_q.user_id, p_subscription_id, v_q.kind, v_q.slot, v_q.template, public.loop_date(now()),
          p_ok and v_first and coalesce(v_meta.consumes_budget, false), v_q.like_id, p_payload_hash,
          case when p_ok then null else coalesce(p_error, 'SEND_FAILED') || coalesce(' (' || p_status_code::text || ')', '') end,
          p_queue_id)
  returning id into v_log;

  if p_ok then
    update public.push_subscriptions set last_sent_at = now() where id = p_subscription_id;
  elsif p_status_code in (404, 410) then
    update public.push_subscriptions set disabled_at = now() where id = p_subscription_id and disabled_at is null;
  end if;
  return v_log;
end $$;

/** 큐 항목 최종 상태. 실패는 3회까지 재시도(5·10·15분 백오프), p_discard=true 면 폐기(구독 없음 등) */
create or replace function public.finish_push_queue(p_queue_id bigint, p_ok boolean, p_error text default null, p_discard boolean default false)
returns public.push_queue_status language plpgsql security definer set search_path = public as $$
declare v_q public.push_queue%rowtype; v_status public.push_queue_status;
begin
  select * into v_q from public.push_queue where id = p_queue_id for update;
  if not found then raise exception 'NOT_FOUND: push_queue %', p_queue_id; end if;
  if p_ok then
    v_status := 'sent';
    update public.push_queue set status = 'sent', sent_at = now(), last_error = null,
      notification_log_id = (select max(id) from public.notification_log where queue_id = p_queue_id and error is null)
    where id = p_queue_id;
  elsif p_discard then
    v_status := 'discarded';
    update public.push_queue set status = 'discarded', discard_reason = coalesce(p_error, 'DISCARDED'), last_error = p_error where id = p_queue_id;
  elsif v_q.attempts >= 3 then
    v_status := 'failed';
    update public.push_queue set status = 'failed', last_error = p_error where id = p_queue_id;
  else
    v_status := 'pending';
    update public.push_queue set status = 'pending', last_error = p_error,
      scheduled_at = now() + make_interval(mins => 5 * v_q.attempts) where id = p_queue_id;
  end if;
  return v_status;
end $$;

/** 알림 열람 기록(클라이언트 sw → /api/push/opened → 본인 user_id 로만) */
create or replace function public.mark_push_opened(p_queue_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.notification_log set opened_at = coalesce(opened_at, now())
  where queue_id = p_queue_id and user_id = auth.uid() and error is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- =============================================================================
-- 권한 (D2 §0-28: service 전용은 authenticated 에서도 명시 회수)
-- =============================================================================
revoke execute on function
  public.kst_time(timestamptz), public.kst_date(timestamptz), public.kst_at(date, time),
  public.time_in_window(time, time, time), public.next_kst_time(timestamptz, time),
  public.push_policy_text(text, text), public.push_policy_int(text, integer),
  public.is_push_quiet_kst(timestamptz), public.is_marketing_window_kst(timestamptz),
  public.push_budget_used(uuid, date), public.has_marketing_consent(uuid),
  public.can_send_push(uuid, public.push_kind, text, timestamptz),
  public.enqueue_push(uuid, text, jsonb, timestamptz, text, uuid, timestamptz),
  public.notify_profile(uuid, text, jsonb),
  public.notify_admin_push(text, jsonb, bigint),
  public.flush_held_queue(timestamptz),
  public.claim_push_queue(integer, bigint),
  public.complete_push_send(bigint, uuid, boolean, integer, text, text),
  public.finish_push_queue(bigint, boolean, text, boolean),
  public.mark_push_opened(bigint)
from public, anon, authenticated;

grant execute on function
  public.kst_time(timestamptz), public.kst_date(timestamptz), public.kst_at(date, time),
  public.time_in_window(time, time, time), public.next_kst_time(timestamptz, time),
  public.is_push_quiet_kst(timestamptz), public.is_marketing_window_kst(timestamptz),
  public.has_marketing_consent(uuid),
  public.mark_push_opened(bigint)
to authenticated, service_role;

grant execute on function
  public.push_policy_text(text, text), public.push_policy_int(text, integer),
  public.push_budget_used(uuid, date),
  public.can_send_push(uuid, public.push_kind, text, timestamptz),
  public.enqueue_push(uuid, text, jsonb, timestamptz, text, uuid, timestamptz),
  public.notify_profile(uuid, text, jsonb),
  public.notify_admin_push(text, jsonb, bigint),
  public.flush_held_queue(timestamptz),
  public.claim_push_queue(integer, bigint),
  public.complete_push_send(bigint, uuid, boolean, integer, text, text),
  public.finish_push_queue(bigint, boolean, text, boolean)
to service_role;

-- 테이블 권한: push_templates 는 설정 화면 설명용 읽기 허용, 나머지는 service role 전용
grant select on public.push_templates to authenticated;
alter table public.push_templates enable row level security;
create policy push_templates_read on public.push_templates for select to authenticated using (true);
