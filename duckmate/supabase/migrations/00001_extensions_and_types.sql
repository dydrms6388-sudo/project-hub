-- =============================================================================
-- 덕메이트(DuckMate) · D1 마이그레이션 00001 — 확장 + enum 타입
-- 근거: ORCHESTRATOR_SPEC §4, 06_PRD(M1/M7), 05_trust_safety, 04_monetization
-- 스키마: public. auth.users 는 Supabase 관리 스키마.
-- =============================================================================

-- 확장 --------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- hobbies 검색(닉네임/태그 like 검색)
-- (pg_cron 은 Supabase 대시보드에서 활성화 — D7 소관. 여기서는 생성하지 않음)

-- -----------------------------------------------------------------------------
-- enum 타입
-- 판단 확정: verify_level 은 enum 이 아니라 smallint + CHECK(0~3) 로 둔다(A5 §→D1
--   명시 권고 + 대소 비교(verify_level >= 2)가 게이트 로직의 본체이므로 숫자형이 옳다).
-- reports.reason_code / moderation_flags.rule_code·action 도 A5 지시대로
--   text + CHECK (신규 코드 추가 시 enum alter 없이 check 만 교체).
-- 나머지 고정 어휘는 Postgres enum 으로 확정.
-- -----------------------------------------------------------------------------

create type public.profile_status as enum ('active', 'paused', 'banned');
create type public.profile_mode   as enum ('friend', 'dating');
create type public.gender_type    as enum ('m', 'f', 'n');

-- 12_flows §결정-4: 온보딩 재개용 스텝
create type public.onboarding_step as enum
  ('age', 'phone', 'hobbies', 'quiz', 'duckcard', 'photo', 'mode', 'done');

create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.like_type     as enum ('like', 'super');
create type public.match_status  as enum ('active', 'closed');

-- A5 §→D1: reports.status
create type public.report_status as enum
  ('RECEIVED', 'AUTO_TRIAGED', 'IN_REVIEW', 'ACTIONED', 'DISMISSED', 'NOTIFIED');
create type public.report_priority as enum ('P0', 'P1', 'P2');

create type public.sanction_status as enum ('ACTIVE', 'EXPIRED', 'REVOKED');
create type public.appeal_status   as enum ('NONE', 'PENDING', 'ACCEPTED', 'REJECTED');

-- A4: 티어/구독 상태 머신
create type public.subscription_tier   as enum ('free', 'plus', 'pro');
create type public.subscription_status as enum
  ('none', 'active', 'cancel_scheduled', 'past_due', 'expired', 'refunded');

-- A4 §2: 소모성 아이템 원장
create type public.item_type     as enum ('superlike', 'boost');
create type public.ledger_bucket as enum ('purchase', 'grant_sub', 'grant_reward');

create type public.quest_kind as enum ('daily', 'weekly');

-- 스펙 §4 availability.slot
create type public.time_slot as enum ('morning', 'afternoon', 'evening', 'night');

create type public.push_platform as enum ('web', 'ios', 'android');

create type public.refund_request_status as enum ('requested', 'approved', 'rejected', 'done');
