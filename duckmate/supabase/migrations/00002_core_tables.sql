-- =============================================================================
-- 덕메이트(DuckMate) · D1 마이그레이션 00002 — 핵심 테이블 + 인덱스 + updated_at 트리거
-- 근거: ORCHESTRATOR_SPEC §4 + PRD M1(birth_date)·M7(컬럼/테이블 추가) + A5 + A4 + A3
--
-- FK on delete 정책 원칙 (PRD/A5 §4.3 탈퇴 파기 정책):
--   · 본인 소유 데이터(취미/퀴즈/사진/추천/좋아요/차단/토큰) = profiles cascade
--     (profiles 는 auth.users cascade → 탈퇴 시 연쇄 파기)
--   · 증거·감사 계열(reports/sanctions/appeals/moderation_flags/audit_logs)
--     = on delete set null → 행 자체는 탈퇴 후에도 보존 (A5 증거보존 정책 확정)
--   · matches/messages = set null 유지 (12_flows §8.10 "탈퇴 상대와의 대화방 유지",
--     A5 §4.3 "상대방 화면 사본은 상대 탈퇴 시까지" — 본문 파기는 파기 잡이 수행)
-- =============================================================================

-- updated_at 공용 트리거 함수 ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1. profiles — 회원 프로필 (auth.users 1:1)
-- =============================================================================
create table public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users (id) on delete cascade,
  nickname           text not null check (char_length(nickname) between 2 and 12),
  -- M1 중재: birth_year 대신 birth_date (만 19세 판정). PASS 인증 후 덮어쓰기(D2).
  -- CHECK 는 최후 방어선 — 미성년 birth_date 는 저장 자체가 불가능.
  birth_date         date not null check (birth_date <= (current_date - interval '19 years')),
  gender             public.gender_type not null,
  region_code        text not null default '',
  bio                text check (bio is null or char_length(bio) <= 500),
  verify_level       smallint not null default 0 check (verify_level between 0 and 3),
  status             public.profile_status not null default 'active',
  mode               public.profile_mode not null default 'friend',
  role               text not null default 'user' check (role in ('user', 'admin')),
  onboarding_step    public.onboarding_step not null default 'age',
  -- 덕질카드 자유 필드 (12_flows §2.5)
  fav_note           text check (fav_note is null or char_length(fav_note) <= 40),
  current_obsession  text check (current_obsession is null or char_length(current_obsession) <= 80),
  -- A4 §2.2 부스트: 사용 시 now()+1h 기록, D3 이 노출 가중치에 사용
  boost_active_until timestamptz,
  last_active_at     timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 추천/탐색 후보 조회: 상태·레벨·모드 필터 + 최근 활동 정렬 (D3)
create index idx_profiles_discover
  on public.profiles (status, verify_level, mode, last_active_at desc);
create index idx_profiles_region on public.profiles (region_code) where status = 'active';

-- =============================================================================
-- 2. hobbies — 취미 마스터
-- =============================================================================
create table public.hobbies (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  category   text not null,
  icon       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_hobbies_category on public.hobbies (category) where is_active;
create index idx_hobbies_name_trgm on public.hobbies using gin (name gin_trgm_ops);

-- =============================================================================
-- 3. profile_hobbies — 프로필×취미 (rank 1~3 = 덕질카드 Top3)
-- =============================================================================
create table public.profile_hobbies (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  hobby_id   uuid not null references public.hobbies (id) on delete cascade,
  rank       smallint check (rank between 1 and 3),   -- null = Top3 아님
  intensity  smallint not null check (intensity between 1 and 5),
  fav_note   text check (fav_note is null or char_length(fav_note) <= 40),
  created_at timestamptz not null default now(),
  primary key (profile_id, hobby_id)
);

-- Top3 순위는 프로필당 유일
create unique index uq_profile_hobbies_rank
  on public.profile_hobbies (profile_id, rank) where rank is not null;
-- 태그 자카드 계산: hobby → 보유 프로필 역조회 (D3)
create index idx_profile_hobbies_hobby on public.profile_hobbies (hobby_id);

-- =============================================================================
-- 4. quiz_questions / quiz_answers — 궁합 퀴즈 (A2 §4: 5축×2문항)
-- =============================================================================
create table public.quiz_questions (
  id         integer generated always as identity primary key,
  category   text not null check (category in ('immersion', 'meeting', 'tempo', 'explore', 'intent')),
  text       text not null,
  -- 4지선다: [{ "label": "...", "value": -1.0 | -0.33 | 0.33 | 1.0 }, ...] 4개
  options    jsonb not null check (jsonb_array_length(options) = 4),
  weight     numeric(3, 2) not null default 1.00,     -- meeting·intent = 1.20
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table public.quiz_answers (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  question_id integer not null references public.quiz_questions (id) on delete cascade,
  choice      smallint not null check (choice between 0 and 3),  -- options 배열 인덱스
  answered_at timestamptz not null default now(),
  primary key (profile_id, question_id)
);

-- =============================================================================
-- 5. photos — 프로필 사진 + 검수 큐 (D2/D8)
-- =============================================================================
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  path          text not null,                        -- Storage 경로 (비공개 버킷)
  is_primary    boolean not null default false,
  review_status public.review_status not null default 'pending',
  reject_reason text,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_photos_profile on public.photos (profile_id, review_status);
-- 미완료 검수 큐: 오래된 것부터 (D8 사진 검수 큐)
create index idx_photos_review_queue
  on public.photos (created_at) where review_status = 'pending';
create unique index uq_photos_primary
  on public.photos (profile_id) where is_primary;

-- =============================================================================
-- 6. availability — 활동 시간대 (D3 시간대 겹침 점수)
-- =============================================================================
create table public.availability (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),  -- 0 = 일요일
  slot       public.time_slot not null,
  primary key (profile_id, weekday, slot)
);

-- =============================================================================
-- 7. daily_recommendations — 일일 추천 (KST 06:00 발행, D3)
-- =============================================================================
create table public.daily_recommendations (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  score      numeric(6, 4) not null,
  reasons    jsonb not null default '[]'::jsonb,       -- 궁합 근거 3줄
  for_date   date not null,                            -- KST 기준 발행일 (D3 이 변환 책임)
  seen_at    timestamptz,
  created_at timestamptz not null default now(),
  check (profile_id <> target_id),
  unique (profile_id, target_id, for_date)
);

-- 오늘 큐 조회(미소진 카드 재개 포함): (나, 날짜) → 점수순
create index idx_daily_recs_queue
  on public.daily_recommendations (profile_id, for_date, score desc);
-- 재노출 규칙: 내가 이 상대를 이미 봤는지 (D3)
create index idx_daily_recs_seen
  on public.daily_recommendations (profile_id, target_id) where seen_at is not null;

-- =============================================================================
-- 8. likes — 좋아요/슈퍼라이크
-- =============================================================================
create table public.likes (
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  type       public.like_type not null default 'like',
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  primary key (from_id, to_id)
);

-- "나를 좋아한 사람" 블러 카운트 + 상호 좋아요 확인 (역방향 조회)
create index idx_likes_to on public.likes (to_id, created_at desc);
-- Lv1 일 3회 제한 카운트 (D2/D3 런타임 검증용)
create index idx_likes_from_time on public.likes (from_id, created_at desc);

-- =============================================================================
-- 9. matches — 매칭 (a_id < b_id 정규화 쌍)
-- =============================================================================
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  -- 탈퇴 후에도 상대 화면의 대화방은 유지 → set null (12_flows §8.10)
  a_id             uuid references public.profiles (id) on delete set null,
  b_id             uuid references public.profiles (id) on delete set null,
  matched_at       timestamptz not null default now(),
  first_suggestion jsonb,                              -- 첫 대화 제안 카드 3개 (D3 사전 생성)
  status           public.match_status not null default 'active',
  closed_at        timestamptz,
  check (a_id is null or b_id is null or a_id < b_id)
);

create unique index uq_matches_pair
  on public.matches (a_id, b_id) where a_id is not null and b_id is not null;
create index idx_matches_a on public.matches (a_id, status);
create index idx_matches_b on public.matches (b_id, status);
-- 마스킹 해제 판정(matched_at + 72h)·매칭 후 24h 무대화 리마인더 스캔 (D4/D7)
create index idx_matches_matched_at on public.matches (matched_at) where status = 'active';

-- =============================================================================
-- 10. messages — 채팅 (keyset 페이지네이션용 bigint id)
-- =============================================================================
create table public.messages (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id) on delete cascade,
  sender_id   uuid references public.profiles (id) on delete set null,
  body        text not null,                           -- 원문: 클라이언트 SELECT 불가(컬럼 권한)
  masked_body text not null,                           -- 클라이언트가 받는 유일한 본문
  mask_rules  jsonb not null default '[]'::jsonb,      -- [{rule, start, end}] 어드민 대조용
  image_path  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- 채팅 페이지네이션: (match_id, id desc) keyset — created_at 동률 안전
create index idx_messages_pagination on public.messages (match_id, id desc);
-- 안읽음 카운트/읽음 처리
create index idx_messages_unread on public.messages (match_id, sender_id) where read_at is null;
-- 신고 스냅샷: 직전 72h 범위 스캔 (create_report_snapshot)
create index idx_messages_created_at on public.messages (match_id, created_at desc);

-- =============================================================================
-- 11. blocks — 차단 (양방향 비노출의 근거 테이블)
-- =============================================================================
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  primary key (blocker_id, blocked_id)
);

-- is_blocked(a,b) 역방향 조회
create index idx_blocks_blocked on public.blocks (blocked_id, blocker_id);

-- =============================================================================
-- 12. reports — 신고 (탈퇴 후 보존 → set null, service role 전용)
-- =============================================================================
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_id   uuid references public.profiles (id) on delete set null,
  match_id    uuid references public.matches (id) on delete set null,
  -- A5 §2 택소노미 18코드 (text + CHECK — A5 지시)
  reason_code text not null check (reason_code in (
    'HARASS_SEXUAL', 'HARASS_SEXUAL_IMAGE',
    'HARASS_VERBAL', 'HARASS_STALKING', 'HARASS_THREAT',
    'SCAM_ROMANCE', 'SCAM_MONEY', 'SCAM_EXTERNAL_LINK',
    'FAKE_PROFILE', 'FAKE_INFO',
    'SPAM_AD', 'SPAM_PROSTITUTION',
    'SAFETY_MINOR', 'SAFETY_OFFLINE',
    'CONTENT_HATE', 'CONTENT_ILLEGAL', 'CONTENT_SELF_HARM',
    'OTHER'
  )),
  detail      text,                                    -- OTHER 는 필수 (서버 검증)
  evidence    jsonb,                                   -- §4.2 스냅샷 — 어떤 클라이언트도 열람 불가
  status      public.report_status not null default 'RECEIVED',
  priority    public.report_priority,
  sla_due_at  timestamptz,                             -- 접수+24h, P0 는 +1h (트리거 설정)
  handled_by  uuid references public.profiles (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- 어드민 신고 큐: 미종결 우선순위·SLA 순 (D8)
create index idx_reports_queue
  on public.reports (priority, sla_due_at)
  where status in ('RECEIVED', 'AUTO_TRIAGED', 'IN_REVIEW');
-- AUTO_3REPORTS: 30일 내 동일 대상 신고자 수 집계 (D5)
create index idx_reports_target on public.reports (target_id, created_at desc);
create index idx_reports_reporter on public.reports (reporter_id, created_at desc);

-- =============================================================================
-- 13. sanctions — 제재 (탈퇴 후 보존)
-- =============================================================================
create table public.sanctions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles (id) on delete set null,
  level         smallint not null check (level between 1 and 5),
  reason        text not null,
  report_id     uuid references public.reports (id) on delete set null,
  status        public.sanction_status not null default 'ACTIVE',
  appeal_status public.appeal_status not null default 'NONE',
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,                           -- null = 영구 (level 5)
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_sanctions_updated_at
  before update on public.sanctions
  for each row execute function public.set_updated_at();

-- 활성 제재 판정 (RLS is_active_member / 라우트 가드)
create index idx_sanctions_active
  on public.sanctions (profile_id, level, ends_at) where status = 'ACTIVE';

-- =============================================================================
-- 14. moderation_flags — 자동 탐지 히트 로그 (A5 §5, D4/D5)
-- =============================================================================
create table public.moderation_flags (
  id         bigint generated always as identity primary key,
  match_id   uuid references public.matches (id) on delete set null,
  message_id bigint references public.messages (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,  -- 발신자
  rule_code  text not null check (rule_code in (
    'PAT_CONTACT_EARLY', 'PAT_MONEY', 'PAT_INVEST', 'PAT_EXTERNAL_LINK',
    'PAT_SEXUAL', 'PAT_OFFPLATFORM_PUSH', 'PAT_SCRIPT_DUP'
  )),
  action     text not null check (action in ('LOG', 'MASK', 'WARN', 'QUEUE', 'BLOCK_SEND')),
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- AUTO_PATTERN_SCAM: 발신자별 24h 히트 집계 (D5)
create index idx_modflags_profile on public.moderation_flags (profile_id, created_at desc);
create index idx_modflags_rule on public.moderation_flags (rule_code, created_at desc);
create index idx_modflags_match on public.moderation_flags (match_id);

-- =============================================================================
-- 15. appeals — 이의제기 (A5 §3.3: 제재 건당 1회, 4-eyes)
-- =============================================================================
create table public.appeals (
  id             uuid primary key default gen_random_uuid(),
  sanction_id    uuid not null unique references public.sanctions (id) on delete cascade,
  profile_id     uuid references public.profiles (id) on delete set null,
  body           text not null,
  status         public.appeal_status not null default 'PENDING',
  decided_by     uuid references public.profiles (id) on delete set null,
  decided_at     timestamptz,
  decided_reason text,
  created_at     timestamptz not null default now()
);

-- 어드민 이의제기 큐 (처리 기한 7일)
create index idx_appeals_queue on public.appeals (created_at) where status = 'PENDING';

-- =============================================================================
-- 16. blocked_hashes — CI/휴대폰 해시 블랙리스트 (A5 §3.1 level 5 재가입 차단)
-- =============================================================================
create table public.blocked_hashes (
  hash_type   text not null check (hash_type in ('ci', 'phone')),
  hash        text not null,                           -- 해시만, 원문 저장 금지
  reason      text,
  sanction_id uuid references public.sanctions (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (hash_type, hash)
);

-- =============================================================================
-- 17. subscriptions — 구독 (스키마만 Phase 1 확정, 코드는 Phase 3 · A4 §4)
-- =============================================================================
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  tier               public.subscription_tier not null default 'free',
  provider           text,                             -- 'toss' | 'revenuecat'
  provider_sub_id    text,
  status             public.subscription_status not null default 'none',
  current_period_end timestamptz,
  cancel_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (provider, provider_sub_id)
);

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- 채널 충돌 규칙(A4 §6.2): 유저당 활성 구독 1개
create unique index uq_subscriptions_active
  on public.subscriptions (user_id)
  where status in ('active', 'cancel_scheduled', 'past_due');
create index idx_subscriptions_user on public.subscriptions (user_id, status);
-- 갱신 3일 전 고지 cron 스캔 (D7)
create index idx_subscriptions_period_end
  on public.subscriptions (current_period_end) where status = 'active';

-- =============================================================================
-- 18. item_ledger — 소모성 아이템 원장 (append-only · A4 §2.2)
-- =============================================================================
create table public.item_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  item_type     public.item_type not null,
  delta         integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  bucket        public.ledger_bucket not null,
  expires_at    timestamptz,                           -- null = 무만료(구매분)
  ref           text not null,                         -- 멱등키 (payment_id / weekly:2026-W34 등)
  created_at    timestamptz not null default now(),
  unique (user_id, ref)                                -- 멱등성: 웹훅 재전송·더블탭 방어
);

-- 잔액 계산·차감 순서(expires_at 오름차순, NULL 마지막)
create index idx_item_ledger_balance
  on public.item_ledger (user_id, item_type, expires_at asc nulls last);

-- 만료분 제외 실잔액 뷰 (A4 §2.2)
create view public.item_balances
  with (security_invoker = on) as
select user_id, item_type, sum(delta)::integer as balance
from public.item_ledger
where expires_at is null or expires_at > now()
group by user_id, item_type;

-- =============================================================================
-- 19. game_profiles / game_sessions — 게임 (Phase 2 대비 스키마만)
-- =============================================================================
create table public.game_profiles (
  profile_id     uuid primary key references public.profiles (id) on delete cascade,
  level          integer not null default 1,
  xp             integer not null default 0,
  streak_days    integer not null default 0,
  last_played_at timestamptz,
  coins          integer not null default 0 check (coins >= 0),
  updated_at     timestamptz not null default now()
);

create trigger trg_game_profiles_updated_at
  before update on public.game_profiles
  for each row execute function public.set_updated_at();

create table public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  game_type    text not null check (game_type in ('battle', 'quiz')),
  participants jsonb not null default '[]'::jsonb,     -- [profile_id, ...]
  state        jsonb not null default '{}'::jsonb,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_game_sessions_updated_at
  before update on public.game_sessions
  for each row execute function public.set_updated_at();

-- 기본 jsonb_ops: RLS 의 participants ? 'profile_id' 존재 연산자를 지원
create index idx_game_sessions_participants
  on public.game_sessions using gin (participants);

-- =============================================================================
-- 20. quests / quest_progress — 퀘스트 (Phase 2 대비, 시드는 비활성)
-- =============================================================================
create table public.quests (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  title      text not null,
  kind       public.quest_kind not null,
  reward     jsonb not null default '{}'::jsonb,       -- {item_type, qty} 등
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.quest_progress (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  quest_id     uuid not null references public.quests (id) on delete cascade,
  progress     integer not null default 0,
  completed_at timestamptz,
  for_date     date not null,                          -- KST 리셋 기준일
  primary key (profile_id, quest_id, for_date)
);

-- =============================================================================
-- 21. events / event_rsvps — 주간 취미 이벤트 (Phase 5 대비)
-- =============================================================================
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  hobby_id    uuid references public.hobbies (id) on delete set null,
  title       text not null,
  description text,
  region      text not null default '',
  starts_at   timestamptz not null,
  capacity    integer check (capacity is null or capacity > 0),
  host_id     uuid references public.profiles (id) on delete set null,  -- Lv3 만 (RLS)
  created_at  timestamptz not null default now()
);

create index idx_events_upcoming on public.events (starts_at, region);

create table public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- =============================================================================
-- 22. audit_logs — 감사로그 (보존 3년, service role 전용)
-- =============================================================================
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target     text,                                     -- 'reports:uuid' 형식
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on public.audit_logs (created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor_id, created_at desc);

-- =============================================================================
-- 23. analytics_events — 퍼널 이벤트 (A3 §4.1 이름 고정)
-- =============================================================================
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  name       text not null,                            -- app_open, match_created, ... (A3 스네이크케이스)
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 퍼널 집계: 이벤트명 × 기간 (D8)
create index idx_analytics_name_time on public.analytics_events (name, created_at desc);
create index idx_analytics_profile on public.analytics_events (profile_id, created_at desc);

-- =============================================================================
-- 24. push_tokens — Web Push 구독 (D7 · Phase 4 에 FCM/APNs 추가)
-- =============================================================================
create table public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     public.push_platform not null default 'web',
  token        text not null,                          -- Web Push subscription JSON / FCM 토큰
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, token)
);

create index idx_push_tokens_user on public.push_tokens (user_id) where is_active;

-- =============================================================================
-- 25. contact_messages — 회사 사이트 문의 폼 (apps/company → Edge Function)
-- =============================================================================
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) <= 50),
  email      text not null check (char_length(email) <= 200),
  subject    text check (subject is null or char_length(subject) <= 120),
  body       text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- =============================================================================
-- 26. refund_requests — 환불 신청 큐 (PRD M7 · Phase 3 구현, 스키마 선확정)
-- =============================================================================
create table public.refund_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,  -- 환불 기록은 탈퇴 후 보존
  payment_ref text not null,
  reason      text,
  amount      integer,                                 -- calc_refund 결과 (원)
  status      public.refund_request_status not null default 'requested',
  handled_by  uuid references public.profiles (id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- 환불 큐 SLA 영업일 3일 (D8)
create index idx_refund_requests_queue
  on public.refund_requests (created_at) where status = 'requested';
