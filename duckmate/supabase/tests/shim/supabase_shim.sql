-- =============================================================================
-- supabase/tests/shim/supabase_shim.sql — 검증 전용 Supabase 런타임 셰임 (프로덕션 미적용)
-- Docker 없는 환경에서 vanilla PostgreSQL 16 에 마이그레이션을 적용하기 위해 auth/storage 스키마·롤·
-- auth.uid()/jwt()/role()·default privileges 만 흉내 낸다. `scripts/db-test.sh` 가 마이그레이션 앞에 1회 적용.
-- 실 Supabase(`supabase start`/`db reset`) 에서는 절대 실행하지 않는다.
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, phone text unique, phone_confirmed_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
  last_sign_in_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin bool,
  created_at timestamptz, updated_at timestamptz, is_sso_user bool default false, deleted_at timestamptz,
  is_anonymous bool default false
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create table if not exists storage.buckets (
  id text primary key, name text unique not null, owner uuid, public bool default false,
  avif_autodetection bool default false, file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, owner_id text, metadata jsonb, path_tokens text[] generated always as (string_to_array(name,'/')) stored,
  created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(), version text
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[]; begin select string_to_array(name,'/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
create or replace function storage.filename(name text) returns text language plpgsql immutable as $$
declare _parts text[]; begin select string_to_array(name,'/') into _parts; return _parts[array_length(_parts,1)]; end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
