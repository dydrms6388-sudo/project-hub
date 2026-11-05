-- =============================================================================
-- 0011 — indexes (조회 패턴별)
-- =============================================================================

-- profiles
create index profiles_status_verify_mode_idx on public.profiles (status, verify_level, mode) where hidden_at is null;
create index profiles_region_idx            on public.profiles (region_code) where status = 'active';
create index profiles_last_active_idx       on public.profiles (last_active_at desc);
create index profiles_delete_requested_idx  on public.profiles (delete_requested_at) where status = 'deleting';
create index profiles_age_blocked_idx       on public.profiles (age_blocked_at) where status = 'age_blocked';
create index profiles_onboarding_idx        on public.profiles (onboarding_step, onboarding_started_at) where onboarding_step <> 'done';
create unique index profiles_nickname_lower_idx on public.profiles (lower(nickname)) where nickname is not null;

-- hobbies / quiz / availability
create index hobbies_category_idx        on public.hobbies (category_id, sort_order) where is_active;
create index profile_hobbies_hobby_idx   on public.profile_hobbies (hobby_id);
create index quiz_answers_question_idx   on public.quiz_answers (question_id);
create index availability_slot_idx       on public.availability (weekday, slot);

-- photos
create index photos_profile_status_idx   on public.photos (profile_id, review_status);
create index photos_review_queue_idx     on public.photos (created_at) where review_status in ('pending', 'held');

-- consents / legal / identity
create index consents_user_key_idx       on public.consents (user_id, key, agreed_at desc);
create index consents_marketing_idx      on public.consents (agreed_at) where key = 'marketing_push' and agreed and withdrawn_at is null;
create index identity_user_idx           on public.identity_verifications (user_id, created_at desc);
create index blocked_ci_expires_idx      on public.blocked_ci_hashes (expires_at);

-- recommendations
create index reco_profile_date_idx       on public.daily_recommendations (profile_id, loop_date desc, position);
create index reco_target_date_idx        on public.daily_recommendations (target_id, loop_date desc);
create index reco_unacted_idx            on public.daily_recommendations (profile_id, loop_date) where acted_at is null;

-- likes / matches / blocks
create index likes_to_idx                on public.likes (to_id, created_at desc);
create index likes_from_created_idx      on public.likes (from_id, created_at desc);
create index likes_super_week_idx        on public.likes (from_id, created_at) where type = 'super';
create index matches_a_idx               on public.matches (a_id, status);
create index matches_b_idx               on public.matches (b_id, status);
create index matches_last_message_idx    on public.matches (last_message_at desc nulls last);
create index matches_ended_idx           on public.matches (ended_at) where status in ('left', 'blocked');
create index blocks_blocked_idx          on public.blocks (blocked_id);

-- messages
create index messages_match_created_idx  on public.messages (match_id, created_at desc);
create index messages_unread_idx         on public.messages (match_id, sender_id) where read_at is null;
create index message_flags_message_idx   on public.message_flags (message_id);
create index message_flags_rule_idx      on public.message_flags (rule_id, created_at desc);

-- reports / sanctions / appeals / audit
create index reports_queue_idx           on public.reports (status, priority, due_at) where status in ('queued', 'in_review', 'need_info');
create index reports_target_idx          on public.reports (target_id, created_at desc);
create index reports_reporter_idx        on public.reports (reporter_id, created_at desc);
create index reports_expires_idx         on public.reports (expires_at) where legal_hold = false and expires_at is not null;
create index sanctions_profile_active_idx on public.sanctions (profile_id, ends_at) where revoked_at is null;
create index sanctions_report_idx        on public.sanctions (report_id);
create index appeals_status_idx          on public.appeals (status, created_at) where status = 'pending';
create index audit_logs_target_idx       on public.audit_logs (target_type, target_id, created_at desc);
create index audit_logs_actor_idx        on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx      on public.audit_logs (created_at);
create index inquiries_status_idx        on public.inquiries (status, created_at);

-- payments (Phase 3)
create index subscriptions_user_idx      on public.subscriptions (user_id, status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end) where status in ('active', 'past_due', 'canceled');
create index payments_user_idx           on public.payments (user_id, created_at desc);
create index item_ledger_user_type_idx   on public.item_ledger (user_id, item_type, created_at);
create index item_ledger_expires_idx     on public.item_ledger (expires_at) where expires_at is not null and delta > 0;
create index boosts_active_idx           on public.boosts (user_id, ends_at);
create index refund_requests_status_idx  on public.refund_requests (status, created_at);

-- game / events (Phase 2·5)
create index game_sessions_type_date_idx on public.game_sessions (game_type, loop_date);
create index game_sessions_participants_idx on public.game_sessions using gin (participants);
create index quest_progress_date_idx     on public.quest_progress (loop_date, quest_id);
create index events_starts_idx           on public.events (starts_at) where status = 'open';
create index events_region_idx           on public.events (region_code, hobby_id);
create index event_rsvps_profile_idx     on public.event_rsvps (profile_id);

-- push / analytics
create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
create index notification_log_budget_idx on public.notification_log (user_id, loop_date) where budget_consumed;
create index notification_log_sent_idx   on public.notification_log (sent_at);
create index analytics_events_name_idx   on public.analytics_events (name, loop_date);
create index analytics_events_created_idx on public.analytics_events (created_at);
