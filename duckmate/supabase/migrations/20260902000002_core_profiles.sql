-- =============================================================================
-- 0002 — core: regions, profiles, hobbies, quiz, availability, photos,
--        consents, legal_documents, identity_verifications, blocked_ci_hashes,
--        admin_users, app_settings
-- =============================================================================

-- ---------- app_settings (service role 전용 런타임 플래그) ----------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
comment on table public.app_settings is 'service role 전용 런타임 플래그. payments_enabled 등. 클라이언트 읽기 불가.';
insert into public.app_settings (key, value) values ('payments_enabled', 'false'::jsonb);

-- ---------- regions (시/군/구 코드 — GPS 없음, 사용자 선택값) ----------
create table public.regions (
  code        text primary key check (code ~ '^[0-9]{5}$'),
  sido_code   text not null generated always as (left(code, 2)) stored,
  sido        text not null,
  sigungu     text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);
comment on table public.regions is '행정표준코드 앞 5자리(시도2+시군구3). 동/읍/면 컬럼 없음(위치정보법 회피 조건).';

-- ---------- admin_users (moderator / admin 레지스트리) ----------
create table public.admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.admin_role not null,
  note        text,
  created_at  timestamptz not null default now()
);
comment on table public.admin_users is 'RLS 는 auth.jwt()->app_metadata->role 을 우선 보고, 없으면 이 표를 본다. D8 이 service role 로 관리.';

-- ---------- profiles ----------
create table public.profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  nickname              text check (nickname is null or char_length(nickname) between 2 and 10),
  nickname_changed_at   timestamptz,
  birth_date            date,                                   -- 본인 + service role 만 읽기 (뷰로 차단)
  birth_year            smallint generated always as (extract(year from birth_date)::smallint) stored,
  gender                public.gender,
  seeking_gender        public.seeking_gender,                  -- 데이팅 모드 필수, 타인 비노출
  region_code           text references public.regions(code),
  bio                   text check (bio is null or char_length(bio) <= 200),
  now_into              text check (now_into is null or char_length(now_into) <= 40),
  verify_level          public.verify_level not null default 0,
  status                public.profile_status not null default 'active',
  mode                  public.profile_mode not null default 'friend',
  onboarding_step       public.onboarding_step not null default 'basic',
  onboarding_started_at timestamptz not null default now(),
  onboarding_completed_at timestamptz,
  safety_modal_seen_at  timestamptz,
  last_active_at        timestamptz not null default now(),
  paused_at             timestamptz,
  delete_requested_at   timestamptz,                            -- status='deleting', +7일 후 purge_daily 삭제
  banned_at             timestamptz,
  age_blocked_at        timestamptz,                            -- status='age_blocked', +30일 삭제. birth_date/nickname 미저장
  phone_hash            text,                                   -- sha256(E.164+salt). age_blocked 재시도 차단·탈퇴 후 30일
  hidden_at             timestamptz,                            -- 자동 조치(미성년 의심 등)로 추천/노출 제외
  hidden_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_dating_requires_l3 check (
    mode <> 'dating' or (verify_level >= 3 and seeking_gender is not null)
  ),
  constraint profiles_status_timestamps check (
    (status <> 'deleting' or delete_requested_at is not null) and
    (status <> 'age_blocked' or age_blocked_at is not null)
  )
);
comment on column public.profiles.verify_level is '0 가입 / 1 휴대폰 OTP / 2 본인인증 / 3 = L2 + 승인 대표사진. recompute_verify_level() 만 갱신.';
comment on column public.profiles.delete_requested_at is '탈퇴 요청 시각. 7일 유예 후 purge_daily 가 삭제. 유예 중 재로그인 시 취소.';

-- ---------- hobbies ----------
create table public.hobby_categories (
  id          smallint primary key,
  slug        text not null unique,
  name        text not null,
  icon        text,
  is_initial  boolean not null default false,   -- 온보딩 첫 화면 노출(A1 Top 8)
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);

create table public.hobbies (
  id          smallint primary key,
  slug        text not null unique,
  name        text not null,
  category_id smallint not null references public.hobby_categories(id),
  icon        text,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0
);
comment on table public.hobbies is '대분류 12 + 세부 60 상한. 자유입력 없음, 운영자만 추가(트리거로 상한 강제).';

create table public.profile_hobbies (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  hobby_id    smallint not null references public.hobbies(id),
  rank        smallint not null check (rank between 1 and 5),   -- 1~3 = Top3
  intensity   smallint not null default 2 check (intensity between 1 and 5),
  fav_note    text check (fav_note is null or char_length(fav_note) <= 30),
  created_at  timestamptz not null default now(),
  primary key (profile_id, hobby_id),
  unique (profile_id, rank)
);

-- ---------- quiz ----------
create table public.quiz_questions (
  id          smallint primary key,
  key         text not null unique,
  category    text not null,
  text        text not null check (char_length(text) <= 30),
  options     jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  weight      numeric(3,2) not null default 1.00 check (weight > 0),
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);
comment on column public.quiz_questions.options is '[{"value":1,"label":"..."}, ...] 2~4개. 생활 궁합 문항만(취미 지식 금지).';

create table public.quiz_answers (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  question_id smallint not null references public.quiz_questions(id),
  choice      smallint not null check (choice between 1 and 4),
  answered_at timestamptz not null default now(),
  primary key (profile_id, question_id)
);

-- ---------- availability ----------
create table public.availability (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),   -- ISO: 1=월 … 7=일
  slot        public.availability_slot not null,
  primary key (profile_id, weekday, slot)
);

-- ---------- photos ----------
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  path            text not null unique,                         -- storage 'photos' 버킷 경로: {profile_id}/{photo_id}.webp
  is_primary      boolean not null default false,
  sort_order      smallint not null default 0,
  review_status   public.review_status not null default 'pending',
  reject_code     public.photo_reject_code,
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  face_count      smallint,                                     -- 얼굴 검사 어댑터 참고값(임베딩 저장 금지)
  face_confidence numeric(4,3),
  held_reason     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint photos_reject_code_iff_rejected check (
    (review_status = 'rejected') = (reject_code is not null)
  ),
  constraint photos_path_prefix check (path like profile_id::text || '/%')
);
create unique index photos_one_primary_per_profile on public.photos (profile_id) where is_primary;

-- ---------- consents (이력 보존, update 금지, 철회는 새 행) ----------
create table public.consents (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,   -- 탈퇴 시 가명화(user_id→null, subject_hash 유지)
  subject_hash  text,                                                 -- 탈퇴 후 대체키(ci_hash 또는 무작위)
  key           public.consent_key not null,
  document_key  public.legal_doc_key,                                 -- key='reconsent' 일 때 필수
  version       text not null,
  agreed        boolean not null,
  agreed_at     timestamptz not null default now(),
  withdrawn_at  timestamptz,
  ip_hash       text,
  ua_hash       text,
  source        public.consent_source not null,
  constraint consents_reconsent_doc check (key <> 'reconsent' or document_key is not null)
);

-- ---------- legal_documents ----------
create table public.legal_documents (
  key                 public.legal_doc_key not null,
  version             text not null,
  effective_at        timestamptz not null,
  content_hash        text not null,
  requires_reconsent  boolean not null default false,
  published_at        timestamptz not null default now(),
  primary key (key, version)
);

-- ---------- identity_verifications ----------
create table public.identity_verifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,   -- 탈퇴 후 1년(영구정지 5년) 보관
  profile_id          uuid references public.profiles(id) on delete set null,
  provider            public.identity_provider not null,
  result              public.identity_result not null,
  ci_hash             text,                                                -- sha256(CI + IDENTITY_CI_SALT). 이름은 저장하지 않음
  di_hash             text,
  birth_date          date,
  gender              public.gender,
  birth_date_verified boolean,                                             -- 입력 생년월일과 일치 여부
  verified_at         timestamptz,
  reverify_due_at     timestamptz,                                         -- 예약 컬럼(Phase 1 미사용)
  is_active           boolean not null default true,                       -- 탈퇴/영구정지 시 false
  provider_tx_id      text,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  constraint identity_success_requires_ci check (result <> 'success' or ci_hash is not null)
);
create unique index identity_verifications_active_ci on public.identity_verifications (ci_hash)
  where result = 'success' and is_active;

-- ---------- blocked_ci_hashes (미성년 확정·영구정지 재가입 차단) ----------
create table public.blocked_ci_hashes (
  ci_hash           text primary key,
  reason            text not null,
  source_profile_id uuid,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz                                           -- null = 무기한, 영구정지 5년
);
