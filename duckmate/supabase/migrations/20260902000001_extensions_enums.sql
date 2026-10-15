-- =============================================================================
-- 0001 — extensions & enum types
-- DuckMate(덕메이트) · D1 스키마
-- 모든 enum 문자열은 packages/db/src/types.ts(Enums) 와 1:1 로 동일해야 한다.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- profiles ----------
create type public.profile_status as enum ('active', 'paused', 'banned', 'age_blocked', 'deleting');
create type public.profile_mode as enum ('friend', 'dating');
create type public.gender as enum ('female', 'male', 'unspecified');
create type public.seeking_gender as enum ('any', 'female', 'male');
create type public.onboarding_step as enum ('basic', 'hobbies', 'quiz', 'card', 'photos', 'verify', 'done');
create type public.availability_slot as enum ('morning', 'afternoon', 'evening', 'night');

-- verify_level 은 enum 이 아니라 smallint(0~3) + check. 도메인으로 고정.
create domain public.verify_level as smallint check (value between 0 and 3);

-- ---------- photos ----------
create type public.review_status as enum ('pending', 'approved', 'rejected', 'held');
-- 반려 코드 7개 (A5 §8). approved / held 는 review_status 로 표현하므로 여기엔 없다.
create type public.photo_reject_code as enum (
  'reject_no_face', 'reject_not_self', 'reject_nudity', 'reject_text_contact',
  'reject_minor', 'reject_group', 'reject_quality'
);

-- ---------- consents / legal ----------
create type public.consent_key as enum (
  'age_19', 'terms', 'privacy', 'evidence_snapshot', 'marketing_push',
  'dating_mode_public', 'auto_renew', 'digital_no_withdrawal', 'reconsent'
);
create type public.consent_source as enum ('onboarding', 'settings', 'checkout', 'banner', 'recheck');
create type public.legal_doc_key as enum ('terms', 'privacy', 'location', 'youth', 'business', 'refund', 'marketing');

-- ---------- identity ----------
create type public.identity_provider as enum ('mock', 'portone');
create type public.identity_result as enum ('success', 'failed', 'minor', 'duplicate_ci', 'blocked_ci');

-- ---------- matching ----------
create type public.like_type as enum ('like', 'super');
create type public.reco_action as enum ('like', 'super', 'pass');
create type public.match_status as enum ('active', 'blocked', 'left', 'paused');

-- ---------- safety ----------
create type public.report_reason as enum (
  'SEXUAL_HARASSMENT', 'ROMANCE_SCAM', 'MINOR_SUSPECT', 'IMPERSONATION', 'OFF_PLATFORM_LURE',
  'COMMERCIAL_SPAM', 'HATE_SPEECH', 'STALKING', 'PII_REQUEST', 'INAPPROPRIATE_PHOTO',
  'THREAT_VIOLENCE', 'FAKE_PROFILE', 'NO_SHOW', 'OTHER'
);
create type public.report_priority as enum ('P0', 'P1', 'P2', 'P3');
create type public.report_status as enum ('queued', 'in_review', 'need_info', 'confirmed', 'dismissed');
create type public.report_surface as enum ('profile', 'chat', 'system');
-- 제재 레벨은 정수 1~6 (A5 §4). 0 = 없음은 행이 없는 상태.
create domain public.sanction_level as smallint check (value between 1 and 6);
create type public.appeal_status as enum ('pending', 'accepted', 'rejected');
create type public.admin_role as enum ('moderator', 'admin');
create type public.inquiry_category as enum (
  'general', 'privacy_export', 'data_export', 'legal_request', 'report', 'hobby_request', 'refund'
);
create type public.inquiry_status as enum ('open', 'answered', 'closed');

-- ---------- payments (Phase 3 — 타입만) ----------
create type public.subscription_tier as enum ('free', 'plus', 'pro');
create type public.subscription_status as enum ('active', 'past_due', 'canceled', 'expired', 'refunded');
create type public.payment_provider as enum ('toss', 'apple', 'google');
create type public.payment_kind as enum ('subscription', 'item');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'canceled', 'partially_refunded', 'refunded');
create type public.item_type as enum ('superlike', 'boost', 'rewind_pack', 'card_refill');
create type public.refund_reason as enum ('change_of_mind', 'service_fault', 'duplicate_charge', 'minor', 'other');
create type public.refund_status as enum ('requested', 'approved', 'rejected', 'executed');

-- ---------- game (Phase 2 — 타입만) ----------
create type public.quest_kind as enum ('daily', 'weekly');
create type public.game_type as enum ('daily_card', 'taste_battle', 'fandom_quiz', 'match_reveal');
create type public.game_session_result as enum ('pending', 'completed', 'expired', 'canceled');
create type public.event_status as enum ('draft', 'open', 'closed', 'canceled', 'done');
create type public.rsvp_status as enum ('going', 'waitlist', 'canceled', 'no_show', 'attended');

-- ---------- push / analytics ----------
create type public.push_kind as enum ('transactional', 'service', 'marketing');
create type public.push_slot as enum ('A', 'B', 'instant');
