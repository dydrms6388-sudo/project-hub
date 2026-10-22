-- ============================================================================
-- BETWEEN — core schema
-- 원칙: 최소 수집, DB 제약으로 2차 검증, 모든 테이블 RLS (0002 에서 활성화)
-- 선택지 코드는 src/lib/domain/options.ts 와 동기화 (tests/unit/options-sync.test.ts 가 검사)
-- ============================================================================

create type public.account_status as enum ('active', 'suspended', 'banned');
create type public.availability as enum ('now', 'tonight', 'weekend', 'flexible', 'off');
create type public.swipe_kind as enum ('like', 'pass');
create type public.contact_kind as enum ('kakao_openchat', 'line', 'instagram', 'telegram', 'link');
create type public.contact_visibility as enum ('public', 'matches');
create type public.photo_visibility as enum ('public', 'matches');
create type public.report_reason as enum ('spam', 'fake', 'minor', 'harassment', 'explicit', 'scam', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.moderation_kind as enum (
  'warn', 'suspend', 'ban', 'hide_profile', 'remove_photo', 'restore', 'dismiss_report', 'auto_hold'
);
create type public.admin_role as enum ('moderator', 'admin');

-- ---------------------------------------------------------------------------
-- profiles : 1 auth user = 1 profile. id = auth.users.id
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null
    check (char_length(nickname) between 2 and 16 and nickname ~ '^[가-힣A-Za-z0-9_. ]+$'),
  birth_year smallint not null check (birth_year >= 1930),
  sido text not null check (char_length(sido) <= 10),
  sigungu text check (char_length(sigungu) <= 20),
  dong text check (char_length(dong) <= 20),
  height smallint check (height between 140 and 220),
  weight smallint check (weight between 35 and 200),
  body_type text check (body_type in ('slim', 'slender', 'average', 'toned', 'muscular', 'chubby', 'big')),
  position text check (position in ('top', 'bottom', 'versatile', 'other', 'undisclosed')),
  styles text[] not null default '{}'
    check (cardinality(styles) <= 5 and styles <@ array['clean', 'cute', 'manly', 'dandy', 'sporty', 'street', 'glasses', 'beard', 'tattoo', 'bear']),
  personality text[] not null default '{}'
    check (cardinality(personality) <= 5 and personality <@ array['calm', 'cheerful', 'sweet', 'funny', 'shy', 'honest', 'thoughtful', 'homebody', 'outgoing', 'introvert']),
  interests text[] not null default '{}'
    check (cardinality(interests) <= 10 and interests <@ array['workout', 'running', 'hiking', 'travel', 'food', 'cafe', 'cooking', 'movies', 'music', 'concert', 'games', 'reading', 'art', 'photo', 'fashion', 'pets', 'drink', 'dance', 'swim', 'kpop']),
  bio text check (char_length(bio) <= 500),
  purposes text[] not null default '{}'
    check (cardinality(purposes) <= 8 and purposes <@ array['friend', 'dating', 'relationship', 'chat', 'meal', 'drink', 'workout_buddy', 'travel']),
  active_times text[] not null default '{}'
    check (cardinality(active_times) <= 6 and active_times <@ array['morning', 'afternoon', 'evening', 'night', 'late_night', 'weekend']),
  smoking text check (smoking in ('no', 'sometimes', 'yes')),
  drinking text check (drinking in ('no', 'sometimes', 'often')),
  -- 필드별 공개 설정 {"height":"public"|"private", ...} (기본값은 0002 의 public.field_public() 참조)
  field_visibility jsonb not null default '{}'::jsonb
    check (jsonb_typeof(field_visibility) = 'object' and pg_column_size(field_visibility) < 2048),
  is_hidden boolean not null default false,
  expires_at timestamptz,
  status public.account_status not null default 'active',
  suspended_until timestamptz,
  adult_confirmed_at timestamptz not null,
  privacy_consent_at timestamptz not null,
  -- 민감정보(성적 지향 관련 세부 성향) 별도 동의. 동의 없으면 position 저장 불가.
  sensitive_consent_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint position_requires_sensitive_consent
    check (position is null or sensitive_consent_at is not null),
  constraint dong_requires_sigungu check (dong is null or sigungu is not null)
);

create index profiles_listable_idx on public.profiles (last_active_at desc)
  where status = 'active' and not is_hidden;
create index profiles_region_idx on public.profiles (sido, sigungu);
create index profiles_created_idx on public.profiles (created_at desc);
create index profiles_birth_year_idx on public.profiles (birth_year);
create index profiles_interests_gin on public.profiles using gin (interests);
create index profiles_styles_gin on public.profiles using gin (styles);
create index profiles_purposes_gin on public.profiles using gin (purposes);

-- 성인(청소년보호법: 만 19세가 되는 해의 1월 1일 이후) 검증 + updated_at
create or replace function public.profiles_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birth_year > extract(year from (now() at time zone 'Asia/Seoul'))::int - 19 then
    raise exception 'ADULT_ONLY' using errcode = 'check_violation';
  end if;
  if new.expires_at is not null and new.expires_at > now() + interval '366 days' then
    raise exception 'EXPIRY_TOO_FAR' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- ---------------------------------------------------------------------------
-- profile_photos : 최대 5장. 실제 바이너리는 Storage(비공개 버킷) — 경로는 서버가 생성
-- ---------------------------------------------------------------------------
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 200),
  position smallint not null default 0 check (position between 0 and 4),
  width int not null check (width between 1 and 4096),
  height int not null check (height between 1 and 4096),
  bytes int not null check (bytes between 1 and 10485760),
  visibility public.photo_visibility not null default 'public',
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint storage_path_owner check (storage_path like user_id::text || '/%')
);
create index profile_photos_user_idx on public.profile_photos (user_id, position);

create or replace function public.profile_photos_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.profile_photos where user_id = new.user_id and removed_at is null) >= 5 then
    raise exception 'PHOTO_LIMIT' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profile_photos_limit before insert on public.profile_photos
  for each row execute function public.profile_photos_limit();

-- ---------------------------------------------------------------------------
-- profile_preferences : 저장된 탐색 필터 (최대 10개)
-- ---------------------------------------------------------------------------
create table public.profile_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  filters jsonb not null check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) < 4096),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create or replace function public.profile_preferences_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.profile_preferences where user_id = new.user_id) >= 10 then
    raise exception 'PREFERENCE_LIMIT' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profile_preferences_limit before insert on public.profile_preferences
  for each row execute function public.profile_preferences_limit();

-- ---------------------------------------------------------------------------
-- contact_methods : 외부 연락 수단. value 는 서버에서 정규화된 https URL 만 저장
-- ---------------------------------------------------------------------------
create table public.contact_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.contact_kind not null,
  value text not null check (value ~ '^https://[^\s<>"''`]+$' and char_length(value) <= 300),
  visibility public.contact_visibility not null default 'matches',
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- ---------------------------------------------------------------------------
-- likes : 스와이프 기록 (like / pass). PK 로 중복 방지
-- ---------------------------------------------------------------------------
create table public.likes (
  liker_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  kind public.swipe_kind not null,
  created_at timestamptz not null default now(),
  primary key (liker_id, target_id),
  check (liker_id <> target_id)
);
create index likes_target_idx on public.likes (target_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- matches : 상호 좋아요 시 트리거로 생성. user_a < user_b 로 정규화
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid,
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index matches_user_b_idx on public.matches (user_b);

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- reports / moderation
-- 신고 대상 프로필이 삭제돼도 운영 기록은 남도록 reported_id 는 FK 없이 보존
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid not null,
  reason public.report_reason not null,
  detail text check (char_length(detail) <= 500),
  status public.report_status not null default 'open',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id is null or reporter_id <> reported_id)
);
create unique index reports_one_open_per_pair on public.reports (reporter_id, reported_id)
  where status = 'open';
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reported_idx on public.reports (reported_id);

create table public.admin_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null default 'moderator',
  granted_at timestamptz not null default now(),
  granted_by uuid
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid, -- null = 시스템 자동 조치
  target_user_id uuid not null,
  report_id uuid references public.reports (id) on delete set null,
  action public.moderation_kind not null,
  reason text check (char_length(reason) <= 500),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- activity_status : "지금 만나기". now 는 반드시 만료시각을 가진다 (최대 6시간)
-- ---------------------------------------------------------------------------
create table public.activity_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.availability not null default 'off',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.activity_status_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'now' then
    if new.expires_at is null or new.expires_at > now() + interval '6 hours 1 minute' then
      raise exception 'NOW_REQUIRES_EXPIRY' using errcode = 'check_violation';
    end if;
  elsif new.status = 'off' then
    new.expires_at := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger activity_status_before_write before insert or update on public.activity_status
  for each row execute function public.activity_status_before_write();

-- ---------------------------------------------------------------------------
-- 서버 전용 테이블 (authenticated 에 권한 없음)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- 로컬 인증 드라이버의 복구 코드 (sha-256 해시만 저장)
create table public.account_recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now()
);
