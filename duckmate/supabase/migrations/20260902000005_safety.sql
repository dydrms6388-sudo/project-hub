-- =============================================================================
-- 0005 — safety: reports, sanctions, appeals, audit_logs, inquiries
-- reports/sanctions 는 당사자 탈퇴 후에도 보존 → FK 는 on delete set null + *_ci_hash 대체키.
-- =============================================================================

create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references public.profiles(id) on delete set null,
  target_id         uuid references public.profiles(id) on delete set null,
  reporter_ci_hash  text,
  target_ci_hash    text,
  match_id          uuid references public.matches(id) on delete set null,
  surface           public.report_surface not null default 'profile',
  reason_code       public.report_reason not null,
  detail            text check (detail is null or char_length(detail) <= 4000),   -- 500자 × append
  priority          public.report_priority not null,
  due_at            timestamptz not null,                     -- created_at + SLA(P0 1h/P1 6h/P2 24h/P3 72h)
  legal_hold        boolean not null default false,
  evidence          jsonb not null,                           -- A5 §5.1 스냅샷(schema:1). 없으면 신고 자체 실패
  detector_hit_count integer not null default 0,
  status            public.report_status not null default 'queued',
  handled_by        uuid references auth.users(id) on delete set null,
  handled_at        timestamptz,
  resolution_note   text,
  auto_actions      jsonb not null default '[]'::jsonb,       -- create_report 가 적용한 자동 조치 목록
  expires_at        timestamptz,                              -- 증거 만료(handled_at + 90/180일). legal_hold 면 무시
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reports_other_requires_detail check (reason_code <> 'OTHER' or detail is not null)
);

create table public.sanctions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id) on delete set null,
  profile_ci_hash  text,
  level            public.sanction_level not null,
  reason           text not null,                             -- 자동 조치는 'AUTO:<rule_id>' 접두어
  reason_code      public.report_reason,
  report_id        uuid references public.reports(id) on delete set null,
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz,                               -- null = 영구(level 6)
  acknowledged_at  timestamptz,                               -- level 1 경고 모달 확인
  issued_by        uuid references auth.users(id) on delete set null,   -- null = 시스템
  revoked_at       timestamptz,                               -- dismissed / 이의신청 인용 시
  revoked_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint sanctions_permanent_iff_level6 check ((level = 6) = (ends_at is null))
);

create table public.appeals (
  id              uuid primary key default gen_random_uuid(),
  sanction_id     uuid not null unique references public.sanctions(id) on delete cascade,   -- 제재 1건당 1회
  profile_id      uuid references public.profiles(id) on delete set null,
  body            text not null check (char_length(body) <= 1000),
  attachment_path text,
  status          public.appeal_status not null default 'pending',
  decision_note   text,
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,                                          -- auth.users.id (null = 시스템/배치)
  actor_role   text,                                          -- admin / moderator / service / system
  action       text not null,                                 -- evidence_viewed, sanction_issued, photo_reviewed, evidence_purged, legal_request …
  target_type  text,
  target_id    text,
  before       jsonb,
  after        jsonb,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  category    public.inquiry_category not null default 'general',
  body        text not null check (char_length(body) between 1 and 2000),
  status      public.inquiry_status not null default 'open',
  handled_by  uuid references auth.users(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.inquiries is 'company 사이트 문의 + 앱 내 요청(취미 추가·데이터 다운로드). 민감정보 필드 없음. 3년 보관.';
