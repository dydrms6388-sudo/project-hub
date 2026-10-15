-- =============================================================================
-- 0051 — 푸시 스케줄러 (D7): 슬롯 A/B · 리마인더 · 2년 재확인 · D5 통보 drain · dispatch 호출 · pg_cron
-- 시각은 전부 KST 로 판단, cron 표현식만 UTC(KST−9h).
--   07:00 flush_held_queue       → '0 22 * * *'
--   07:30 enqueue_slot_a         → '30 22 * * *'
--   19:30 run_slot_b_batch       → '30 10 * * *'   (유저별 19:30 / 20:30 예약, dispatch 가 시각에 맞춰 전송)
--   03:30 consent_recheck        → '30 18 * * *'
--   */5   invoke_push_dispatch   → Edge push-dispatch (pg_net + vault secret)
--   */5   drain_moderation_notifications
-- pg_cron/pg_net/vault 가 없는 환경(로컬 PG16)에서도 마이그레이션은 통과한다(멱등·가드).
-- =============================================================================

-- ---------- 슬롯 B 유저별 시각: availability 에 night 만 있고 evening 이 없으면 20:30, 아니면 19:30 ----------
create or replace function public.slot_b_time_for(p_profile_id uuid, p_at timestamptz default now())
returns time language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.availability a where a.profile_id = p_profile_id
                   and a.weekday = extract(isodow from public.kst_date(p_at))::smallint and a.slot = 'night')
     and not exists (select 1 from public.availability a where a.profile_id = p_profile_id
                   and a.weekday = extract(isodow from public.kst_date(p_at))::smallint and a.slot = 'evening')
    then public.push_policy_text('slot_b_late', '20:30')::time
    else public.push_policy_text('slot_b_start', '19:30')::time end
$$;

-- ---------- 결과 대기 건수: 내가 보낸 좋아요 중 30일 내 · 아직 매칭 없음 ----------
create or replace function public.pending_like_results(p_profile_id uuid, p_at timestamptz default now())
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.likes l
  where l.from_id = p_profile_id and l.created_at >= p_at - interval '30 days'
    and public.match_id_of(l.from_id, l.to_id) is null
$$;

-- =============================================================================
-- 슬롯 A 07:30 — 당일 추천 있는 프로필에 daily_reco_ready
--   조건: active·L2+, 슬롯 A 구독, 최근 7일 접속(아니면 월요일만). 예산 소비.
-- =============================================================================
create or replace function public.enqueue_slot_a(p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ld date := public.loop_date(p_at);
  v_monday boolean := extract(isodow from public.kst_date(p_at)) = 1;
  v_r record; v_res jsonb; v_queued integer := 0; v_skipped integer := 0; v_pending integer;
begin
  for v_r in
    select p.id as profile_id, p.user_id, p.last_active_at, s.reco_count
    from public.profiles p
    join (
      select d.profile_id, count(*)::integer as reco_count
      from public.daily_recommendations d where d.loop_date = v_ld group by d.profile_id
    ) s on s.profile_id = p.id
    where p.status = 'active' and p.verify_level >= 2 and p.hidden_at is null
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.user_id and ps.disabled_at is null and ps.slot_a_enabled)
      and (p.last_active_at >= p_at - interval '7 days' or v_monday)
    order by p.id
  loop
    begin
      v_pending := public.pending_like_results(v_r.profile_id, p_at);
      v_res := public.enqueue_push(v_r.profile_id, 'daily_reco_ready',
                 jsonb_build_object('n', v_r.reco_count, 'pending', v_pending),
                 p_at, v_r.user_id::text || ':daily_reco_ready:' || v_ld::text, null, p_at);
      if (v_res ->> 'queued')::boolean then v_queued := v_queued + 1; else v_skipped := v_skipped + 1; end if;
    exception when others then
      v_skipped := v_skipped + 1;
      raise notice 'enqueue_slot_a profile % failed: %', v_r.profile_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('loop_date', v_ld, 'queued', v_queued, 'skipped', v_skipped);
end $$;
comment on function public.enqueue_slot_a is '07:30 KST pg_cron. 당일 추천(daily_recommendations.loop_date) 있는 유저에게 daily_reco_ready 1건. 7일 미접속은 월요일만.';

-- =============================================================================
-- 슬롯 B 19:30~21:00 — 우선순위 1개: ① 미확인 매칭 → ② 미답장 메시지 → ③ 사진 검수 결과(이미 큐) → ④ 추천 미완료
--   해당 없으면 미발송(예산은 상한이지 목표가 아님). 유저별 시각 slot_b_time_for.
-- =============================================================================
create or replace function public.slot_b_candidate(p_profile_id uuid, p_at timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_p public.profiles%rowtype; v_n integer; v_ld date := public.loop_date(p_at);
begin
  select * into v_p from public.profiles where id = p_profile_id;
  if not found then return null; end if;

  -- ① 미확인 매칭: 활성·7일 내·내가 마지막 접속한 뒤 성사·내가 보낸 메시지 없음
  select count(*) into v_n from public.matches m
  where m.status = 'active' and p_profile_id in (m.a_id, m.b_id)
    and m.matched_at >= p_at - interval '7 days' and m.matched_at > v_p.last_active_at
    and not exists (select 1 from public.messages x where x.match_id = m.id and x.sender_id = p_profile_id);
  if v_n > 0 then return jsonb_build_object('template', 'unseen_match', 'params', jsonb_build_object('n', v_n)); end if;

  -- ② 미답장: 활성 매칭에서 상대의 미읽음 메시지(3일 내, 보류 아님)가 내 마지막 메시지 이후
  select count(distinct x.match_id) into v_n
  from public.messages x join public.matches m on m.id = x.match_id and m.status = 'active'
  where p_profile_id in (m.a_id, m.b_id) and x.sender_id <> p_profile_id and not x.is_held and x.read_at is null
    and x.created_at >= p_at - interval '3 days'
    and x.created_at > coalesce((select max(y.created_at) from public.messages y where y.match_id = m.id and y.sender_id = p_profile_id), '-infinity'::timestamptz);
  if v_n > 0 then return jsonb_build_object('template', 'unreplied_message', 'params', jsonb_build_object('n', v_n)); end if;

  -- ③ photo_reviewed 는 D8 이 notify_profile 로 이미 큐에 넣는다(rank 3) — 여기선 만들지 않음

  -- ④ 오늘 추천 열었으나 남음
  select count(*) filter (where d.acted_at is null) into v_n
  from public.daily_recommendations d where d.profile_id = p_profile_id and d.loop_date = v_ld
  having count(*) filter (where d.seen_at is not null) > 0 and count(*) filter (where d.acted_at is null) > 0;
  if v_n > 0 then return jsonb_build_object('template', 'reco_remaining', 'params', jsonb_build_object('n', v_n)); end if;

  return null;
end $$;

create or replace function public.enqueue_slot_b(p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ld date := public.loop_date(p_at);
  v_r record; v_c jsonb; v_res jsonb; v_queued integer := 0; v_none integer := 0; v_skipped integer := 0; v_sched timestamptz;
begin
  for v_r in
    select p.id as profile_id, p.user_id
    from public.profiles p
    where p.status = 'active' and p.verify_level >= 2 and p.hidden_at is null
      and p.last_active_at >= p_at - interval '30 days'
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.user_id and ps.disabled_at is null and ps.slot_b_enabled)
    order by p.id
  loop
    begin
      v_c := public.slot_b_candidate(v_r.profile_id, p_at);
      if v_c is null then v_none := v_none + 1; continue; end if;
      v_sched := public.kst_at(public.kst_date(p_at), public.slot_b_time_for(v_r.profile_id, p_at));
      if v_sched < p_at then v_sched := p_at; end if;
      v_res := public.enqueue_push(v_r.profile_id, v_c ->> 'template', v_c -> 'params', v_sched,
                 v_r.user_id::text || ':B:' || v_ld::text, null, p_at);
      if (v_res ->> 'queued')::boolean then v_queued := v_queued + 1; else v_skipped := v_skipped + 1; end if;
    exception when others then
      v_skipped := v_skipped + 1;
      raise notice 'enqueue_slot_b profile % failed: %', v_r.profile_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('loop_date', v_ld, 'queued', v_queued, 'no_candidate', v_none, 'skipped', v_skipped);
end $$;
comment on function public.enqueue_slot_b is '19:30 KST pg_cron. 우선순위 1개만(미확인 매칭 > 미답장 > 사진 검수(큐 rank 3) > 추천 미완료). 없으면 미발송.';

-- =============================================================================
-- 미접속 리마인더 D3/D7 — 서비스 알림(정보형) 판정: 광고성 아님(혜택·유료 유도 없음, "새 추천 N명" 사실만)
--   각 1회(last_active_at 날짜 기준 dedupe), 30일 내 리마인더 총 2건 상한, 슬롯 B 시각·예산 소비.
-- =============================================================================
create or replace function public.enqueue_reminders(p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ld date := public.loop_date(p_at);
  v_cap integer := public.push_policy_int('reminder_cap_30d', 2);
  v_r record; v_tpl text; v_res jsonb; v_queued integer := 0; v_capped integer := 0; v_skipped integer := 0; v_n integer; v_sched timestamptz;
begin
  for v_r in
    select p.id as profile_id, p.user_id, p.last_active_at,
           case when p.last_active_at >= p_at - interval '4 days' and p.last_active_at < p_at - interval '3 days' then 'reminder_d3'
                when p.last_active_at >= p_at - interval '8 days' and p.last_active_at < p_at - interval '7 days' then 'reminder_d7' end as tpl
    from public.profiles p
    where p.status = 'active' and p.verify_level >= 2 and p.hidden_at is null
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = p.user_id and ps.disabled_at is null and ps.slot_b_enabled)
      and ((p.last_active_at >= p_at - interval '4 days' and p.last_active_at < p_at - interval '3 days')
        or (p.last_active_at >= p_at - interval '8 days' and p.last_active_at < p_at - interval '7 days'))
    order by p.id
  loop
    begin
      v_tpl := v_r.tpl;
      -- 스팸 상한: 30일 내 리마인더(전송 성공 + 대기 중) 총 2건
      select count(*) into v_n from public.notification_log l
      where l.user_id = v_r.user_id and l.template in ('reminder_d3', 'reminder_d7') and l.error is null and l.sent_at >= p_at - interval '30 days';
      v_n := v_n + (select count(*) from public.push_queue q where q.user_id = v_r.user_id and q.template in ('reminder_d3', 'reminder_d7') and q.status in ('pending', 'held', 'sending'));
      if v_n >= v_cap then v_capped := v_capped + 1; continue; end if;
      -- 오늘 슬롯 B 행이 이미 있으면(우선순위 상위) 리마인더는 rank 5 라 자동으로 밀린다
      select count(*) into v_n from public.daily_recommendations d where d.profile_id = v_r.profile_id and d.loop_date = v_ld;
      v_sched := public.kst_at(public.kst_date(p_at), public.slot_b_time_for(v_r.profile_id, p_at));
      if v_sched < p_at then v_sched := p_at; end if;
      v_res := public.enqueue_push(v_r.profile_id, v_tpl, jsonb_build_object('n', v_n, 'since', public.kst_date(v_r.last_active_at)),
                 v_sched, v_r.user_id::text || ':B:' || v_ld::text, null, p_at);
      if (v_res ->> 'queued')::boolean then v_queued := v_queued + 1; else v_skipped := v_skipped + 1; end if;
    exception when others then
      v_skipped := v_skipped + 1;
      raise notice 'enqueue_reminders profile % failed: %', v_r.profile_id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('loop_date', v_ld, 'queued', v_queued, 'capped', v_capped, 'skipped', v_skipped);
end $$;

/** 19:30 KST cron 진입점: 슬롯 B 후 리마인더(같은 dedupe 키 → rank 로 자연 정렬) */
create or replace function public.run_slot_b_batch(p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object('slot_b', public.enqueue_slot_b(p_at), 'reminders', public.enqueue_reminders(p_at));
end $$;

-- =============================================================================
-- 2년 수신동의 재확인 (B1 §0-23 + 미응답 시 OFF 판정)
--   1) 최신 활성 marketing_push 동의가 700일(=730−30) 경과 → reconsent_needed 1회 + consent_rechecks 행
--   2) due_at(730일) 경과 · 미응답 → consents(agreed=false, withdrawn_at, source=recheck) = 마케팅 OFF
--   재동의(설정 토글 ON, 새 agreed 행) → renewed / 그 사이 철회 → withdrawn
-- =============================================================================
create or replace function public.consent_recheck(p_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_days integer := 730;
  v_r record; v_prof uuid; v_notified integer := 0; v_expired integer := 0; v_renewed integer := 0; v_withdrawn integer := 0;
begin
  -- 1) D-30 안내
  for v_r in
    select c.* from (
      select distinct on (user_id) * from public.consents
      where key = 'marketing_push' and user_id is not null and source <> 'recheck'
      order by user_id, agreed_at desc, id desc
    ) c
    where c.agreed and c.withdrawn_at is null
      and c.agreed_at <= p_at - make_interval(days => v_days - 30)
      and not exists (select 1 from public.consent_rechecks r where r.consent_id = c.id)
      -- 그 뒤에 recheck 로 OFF 된 적 없음
      and not exists (select 1 from public.consents x where x.user_id = c.user_id and x.key = 'marketing_push' and x.id > c.id)
  loop
    insert into public.consent_rechecks (user_id, consent_id, notified_at, due_at)
    values (v_r.user_id, v_r.id, p_at, v_r.agreed_at + make_interval(days => v_days));
    select id into v_prof from public.profiles where user_id = v_r.user_id;
    if v_prof is not null then
      perform public.enqueue_push(v_prof, 'reconsent_needed',
        jsonb_build_object('agreed_on', public.kst_date(v_r.agreed_at), 'due_on', public.kst_date(v_r.agreed_at + make_interval(days => v_days)), 'consent_id', v_r.id),
        null, v_r.user_id::text || ':reconsent_needed:' || v_r.id::text, null, p_at);
    end if;
    v_notified := v_notified + 1;
  end loop;

  -- 2) 만료 판정
  for v_r in
    select r.*, c.version, c.document_key from public.consent_rechecks r join public.consents c on c.id = r.consent_id
    where r.resolved_at is null and r.due_at <= p_at
  loop
    if exists (select 1 from public.consents x where x.user_id = v_r.user_id and x.key = 'marketing_push' and x.agreed and x.withdrawn_at is null and x.agreed_at > v_r.notified_at) then
      update public.consent_rechecks set resolved_at = p_at, outcome = 'renewed' where id = v_r.id; v_renewed := v_renewed + 1;
    elsif exists (select 1 from public.consents x where x.user_id = v_r.user_id and x.key = 'marketing_push' and not x.agreed and x.agreed_at > v_r.notified_at) then
      update public.consent_rechecks set resolved_at = p_at, outcome = 'withdrawn' where id = v_r.id; v_withdrawn := v_withdrawn + 1;
    else
      insert into public.consents (user_id, key, document_key, version, agreed, agreed_at, withdrawn_at, source)
      values (v_r.user_id, 'marketing_push', coalesce(v_r.document_key, 'marketing'), v_r.version, false, p_at, p_at, 'recheck');
      update public.consent_rechecks set resolved_at = p_at, outcome = 'expired' where id = v_r.id; v_expired := v_expired + 1;
    end if;
  end loop;
  return jsonb_build_object('notified', v_notified, 'expired', v_expired, 'renewed', v_renewed, 'withdrawn', v_withdrawn);
end $$;
comment on function public.consent_recheck is '03:30 KST pg_cron. D-30 reconsent_needed(광고성 아님) + 730일 미응답 시 marketing_push OFF(consents source=recheck).';

-- =============================================================================
-- D5 통보 큐(moderation_notifications, 0040) → 푸시 큐. 테이블이 없으면 no-op(동적 SQL).
--   audience=user: kind → 템플릿(report_resolved / sanction_issued / sanction_lifted / appeal_decided), 그 외 kind 는 미전달(delivery.ok=false)
--   audience=admin: notify_admin_push(kind, payload, source_id)
-- =============================================================================
create or replace function public.drain_moderation_notifications(p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_r record; v_res jsonb; v_id bigint; v_n integer := 0; v_skip integer := 0; v_tpl text;
begin
  if to_regclass('public.moderation_notifications') is null then
    return jsonb_build_object('delivered', 0, 'skipped', 0, 'note', 'moderation_notifications absent');
  end if;
  for v_r in execute format(
    'select id, audience, kind, profile_id, report_id, sanction_id, payload from public.moderation_notifications where delivered_at is null order by id limit %s for update skip locked', p_limit)
  loop
    begin
      if v_r.audience = 'admin' then
        v_id := public.notify_admin_push(v_r.kind, coalesce(v_r.payload, '{}'::jsonb) || jsonb_build_object('report_id', v_r.report_id, 'sanction_id', v_r.sanction_id), v_r.id);
        v_res := jsonb_build_object('channel', 'admin_notifications', 'ok', true, 'admin_notification_id', v_id);
      else
        v_tpl := case v_r.kind when 'report_resolved' then 'report_resolved' when 'sanction_issued' then 'sanction_issued'
                               when 'sanction_lifted' then 'sanction_lifted' when 'appeal_decided' then 'appeal_decided' end;
        if v_tpl is null or v_r.profile_id is null then
          v_res := jsonb_build_object('channel', 'push_queue', 'ok', false, 'error', 'NO_TEMPLATE_FOR_KIND');
        else
          v_res := jsonb_build_object('channel', 'push_queue', 'ok', true) ||
                   public.notify_profile(v_r.profile_id, v_tpl, coalesce(v_r.payload, '{}'::jsonb) || jsonb_build_object('sanction_id', v_r.sanction_id, 'moderation_notification_id', v_r.id));
        end if;
      end if;
      execute 'update public.moderation_notifications set delivered_at = now(), delivery = $1 where id = $2' using v_res, v_r.id;
      v_n := v_n + 1;
    exception when others then
      v_skip := v_skip + 1;
      raise notice 'drain_moderation_notifications % failed: %', v_r.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('delivered', v_n, 'skipped', v_skip);
end $$;

-- =============================================================================
-- Edge Function push-dispatch 호출 (pg_net + vault). 미설정이면 notice 만.
--   app_settings('push_dispatch') = {"url": "https://<ref>.functions.supabase.co/push-dispatch"}
--   vault secret 'push_dispatch_secret' = Edge secret PUSH_DISPATCH_SECRET 과 동일 값 (x-webhook-secret)
-- =============================================================================
create or replace function public.invoke_push_dispatch()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_req bigint;
begin
  if not exists (select 1 from public.push_queue where status in ('pending', 'held') and scheduled_at <= now()) then
    return jsonb_build_object('invoked', false, 'reason', 'QUEUE_EMPTY');
  end if;
  select value ->> 'url' into v_url from public.app_settings where key = 'push_dispatch';
  if v_url is null then return jsonb_build_object('invoked', false, 'reason', 'NO_URL'); end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return jsonb_build_object('invoked', false, 'reason', 'NO_PG_NET');
  end if;
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_secret using 'push_dispatch_secret';
  end if;
  if v_secret is null then return jsonb_build_object('invoked', false, 'reason', 'NO_SECRET'); end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 25000)'
    into v_req
    using v_url, jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', v_secret), jsonb_build_object('source', 'pg_cron', 'at', now());
  return jsonb_build_object('invoked', true, 'request_id', v_req);
end $$;

-- =============================================================================
-- D8 지표 뷰 (service role 전용)
-- =============================================================================
create view public.v_push_metrics_daily as
select l.loop_date, l.slot, l.kind, l.template,
       count(*) filter (where l.error is null)::integer as sent,
       count(*) filter (where l.error is not null)::integer as failed,
       count(*) filter (where l.opened_at is not null)::integer as opened,
       round(count(*) filter (where l.opened_at is not null)::numeric / nullif(count(*) filter (where l.error is null), 0), 4) as open_rate,
       count(distinct l.user_id) filter (where l.error is null)::integer as users,
       count(*) filter (where l.budget_consumed)::integer as budget_consumed
from public.notification_log l
group by l.loop_date, l.slot, l.kind, l.template;
comment on view public.v_push_metrics_daily is 'D8: 슬롯별 push_sent/push_opened/오픈율(목표 A ≥ 15%). service role 전용.';

create view public.v_push_queue_daily as
select public.loop_date(q.created_at) as loop_date, q.template, q.status,
       coalesce(q.discard_reason, q.hold_reason) as reason,
       count(*)::integer as items, sum(q.merged_count)::integer as merged_events
from public.push_queue q
group by 1, 2, 3, 4;
comment on view public.v_push_queue_daily is 'D8: 보류/폐기 사유 분포(BUDGET_EXCEEDED·QUIET_HOURS·NO_SUBSCRIPTION …).';

revoke all on public.v_push_metrics_daily, public.v_push_queue_daily from public, anon, authenticated;
grant select on public.v_push_metrics_daily, public.v_push_queue_daily to service_role;

-- ---------- 권한 ----------
revoke execute on function
  public.slot_b_time_for(uuid, timestamptz), public.pending_like_results(uuid, timestamptz),
  public.enqueue_slot_a(timestamptz), public.slot_b_candidate(uuid, timestamptz), public.enqueue_slot_b(timestamptz),
  public.enqueue_reminders(timestamptz), public.run_slot_b_batch(timestamptz),
  public.consent_recheck(timestamptz), public.drain_moderation_notifications(integer), public.invoke_push_dispatch()
from public, anon, authenticated;
grant execute on function
  public.slot_b_time_for(uuid, timestamptz), public.pending_like_results(uuid, timestamptz),
  public.enqueue_slot_a(timestamptz), public.slot_b_candidate(uuid, timestamptz), public.enqueue_slot_b(timestamptz),
  public.enqueue_reminders(timestamptz), public.run_slot_b_batch(timestamptz),
  public.consent_recheck(timestamptz), public.drain_moderation_notifications(integer), public.invoke_push_dispatch()
to service_role;

-- =============================================================================
-- pg_cron (멱등). 확장이 없으면 notice 후 건너뜀 — G3 가 Supabase 대시보드에서 pg_cron/pg_net 활성화 후
-- `select public.schedule_push_jobs()` 를 1회 실행해도 된다(같은 내용).
-- =============================================================================
create or replace function public.schedule_push_jobs()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_job record; v_n integer := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return jsonb_build_object('scheduled', 0, 'reason', 'NO_PG_CRON');
  end if;
  for v_job in
    select * from (values
      ('push_flush_held',        '0 22 * * *',  'select public.flush_held_queue()'),               -- 07:00 KST
      ('push_slot_a',            '30 22 * * *', 'select public.enqueue_slot_a()'),                 -- 07:30 KST
      ('push_slot_b',            '30 10 * * *', 'select public.run_slot_b_batch()'),               -- 19:30 KST
      ('push_consent_recheck',   '30 18 * * *', 'select public.consent_recheck()'),                -- 03:30 KST
      ('push_drain_moderation',  '*/5 * * * *', 'select public.drain_moderation_notifications()'),
      ('push_dispatch',          '*/5 * * * *', 'select public.invoke_push_dispatch()')
    ) as t(jobname, schedule, command)
  loop
    execute 'select cron.unschedule(jobid) from cron.job where jobname = $1' using v_job.jobname;
    execute 'select cron.schedule($1, $2, $3)' using v_job.jobname, v_job.schedule, v_job.command;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('scheduled', v_n);
end $$;
revoke execute on function public.schedule_push_jobs() from public, anon, authenticated;
grant execute on function public.schedule_push_jobs() to service_role;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here (%): schedule later with select public.schedule_push_jobs()', sqlerrm;
  end;
  perform public.schedule_push_jobs();
end $$;
