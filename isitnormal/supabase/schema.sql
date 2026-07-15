-- 정상인가요 (isitnormal) — DB 스키마 + RLS (P1 산출물)
-- Supabase / Postgres. 익명 insert 허용, select는 승인·집계된 것만.
-- 이 스키마가 뚫리면(익명이 pending UGC를 select 하면) 즉시 실패다. (E3)
--
-- 원칙 요약:
--   - PII 원문 저장 금지. 실명/상호 등은 insert 전 애플리케이션 스캐너가 마스킹(L1). 여기엔 마스킹본만.
--   - votes 테이블은 ip_hash/fingerprint 등 준식별자를 담으므로 익명 SELECT 전면 차단.
--     통계는 PII 없는 집계 뷰/RPC로만 노출하고, n<30이면 통계 자체를 반환하지 않는다(V3).
--   - 승격/색인 여부는 애플리케이션(lib/promotion-gate.ts)이 판정하고 결과 플래그만 저장.

-- =========================================================================
-- 0. 확장
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- 1. 카테고리 (운영자 관리, 읽기 공개)
-- =========================================================================
create table if not exists categories (
  id          smallint primary key,
  slug        text unique not null,
  name        text not null,
  emoji       text not null,
  sort        smallint not null default 0,
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- 2. 설문 (콘텐츠 원자 단위)
-- =========================================================================
create type survey_origin as enum ('operator', 'user');
create type survey_status as enum ('pending', 'approved', 'held', 'rejected');
create type vote_kind     as enum ('binary', 'scale');  -- v1은 binary(그렇다/아니다)

create table if not exists surveys (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  category_id   smallint not null references categories(id),
  title         text not null,
  body          text not null default '',              -- UGC 원문(마스킹 완료본)
  vote_kind     vote_kind not null default 'binary',
  origin        survey_origin not null default 'user',
  author_badge  text,                                   -- 'operator' 시드는 '@운영자'
  status        survey_status not null default 'pending',
  -- 색인 3층 자산
  editor_commentary text not null default '',           -- 편집자 해설(3층, 고유 텍스트)
  promotion_commentary text not null default '',        -- 승격 시 추가되는 실측 결과 해설(고유). 800자 고유 게이트 충족용
  -- 승격 게이트 결과(애플리케이션이 계산해 기록; sitemap 생성이 이 플래그를 신뢰)
  is_indexed    boolean not null default false,
  promoted_at   timestamptz,
  quality_scan_passed boolean not null default false,
  -- 어뷰징
  is_surge_held boolean not null default false,         -- V2 급등 자동 홀드
  submitter_hash text,                                  -- UGC 작성자 익명 해시(1일 3건 rate limit용, V5)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_surveys_submitter on surveys(submitter_hash, created_at);
create index if not exists idx_surveys_category on surveys(category_id);
create index if not exists idx_surveys_status on surveys(status);
create index if not exists idx_surveys_indexed on surveys(is_indexed) where is_indexed = true;

-- 설문 선택지 (binary면 2행: 그렇다/아니다)
create table if not exists survey_options (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  opt_key     text not null default 'a',   -- 'a'|'b'|'c'|'d' — 시드 콘텐츠의 option key와 일치
  label       text not null,
  sort        smallint not null default 0,
  unique (survey_id, opt_key)
);
create index if not exists idx_options_survey on survey_options(survey_id);

-- =========================================================================
-- 3. 투표 (익명, 3중 중복방지)
-- =========================================================================
-- voter_hash = digest(session_id || ip_hash || fingerprint). 원시 IP는 저장하지 않는다.
create table if not exists votes (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references surveys(id) on delete cascade,
  option_id    uuid not null references survey_options(id) on delete cascade,
  voter_hash   text not null,                 -- 3중 결합 해시 (V1)
  ip_hash      text not null,                 -- 솔트 해시 (rate limit/봇추정용, 원시 IP 아님)
  fingerprint  text not null,
  -- 교차 통계용 자기신고 속성 (선택, 식별 불가 밴드만)
  age_band     text,   -- '10s'|'20s'|'30s'|'40s'|'50s+'|null
  gender       text,   -- 'f'|'m'|'x'|null
  region       text,   -- 광역 단위만
  created_at   timestamptz not null default now()
);
-- 설문당 1표 (V1). 중복 방지 키는 시크릿창에도 안정적인 ip_hash+fingerprint 조합.
-- (session은 시크릿창마다 새로 발급되므로 dedup 키에서 제외 — 오히려 우회 통로가 된다.)
create unique index if not exists uq_vote_once on votes(survey_id, ip_hash, fingerprint);
create index if not exists idx_votes_survey on votes(survey_id);
create index if not exists idx_votes_ip_time on votes(ip_hash, created_at);

-- =========================================================================
-- 4. 댓글 (한 줄 의견)
-- =========================================================================
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  body        text not null,                  -- 마스킹 완료본
  status      survey_status not null default 'pending',
  voter_hash  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_comments_survey on comments(survey_id, status);

-- =========================================================================
-- 5. 신고 / 삭제요청(takedown, 48h SLA)
-- =========================================================================
create type target_type as enum ('survey', 'comment');

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  target      target_type not null,
  target_id   uuid not null,
  reason      text not null,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false
);

create table if not exists takedown_requests (
  id            uuid primary key default gen_random_uuid(),
  target_ref    text not null,                -- 요청자가 지목한 URL/설명 (uuid를 모를 수 있음)
  target        target_type,                  -- 분류되면 채움
  target_id     uuid,
  contact       text not null,                -- 요청자 회신처
  reason        text not null,
  created_at    timestamptz not null default now(),
  sla_due_at    timestamptz not null default (now() + interval '48 hours'),  -- L4
  handled       boolean not null default false,
  handled_at    timestamptz
);

-- =========================================================================
-- 6. 알림 opt-in (이메일만, 로그인 강요 없음)
-- =========================================================================
create table if not exists notify_optin (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  survey_id   uuid references surveys(id) on delete cascade,  -- null이면 주간 통계 구독
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- 6b. 문의 (contact — 실동작)
-- =========================================================================
create table if not exists contact_messages (
  id          uuid primary key default gen_random_uuid(),
  email       text,                          -- 선택 (회신 원할 때만)
  message     text not null,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false
);

-- =========================================================================
-- 7. 공유 짧은 링크 (/s/{shortId}, 90일 만료)
-- =========================================================================
create table if not exists short_links (
  short_id    text primary key,             -- base62, 무한조합 색인 차단 위해 서버조회 전용 (U4)
  slug        text not null,                -- 공유 대상 설문
  opt_key     text not null,                -- 공유자가 선택한 답(결과 미리보기 프레이밍용)
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '90 days')  -- U5
);
create index if not exists idx_short_links_expires on short_links(expires_at);

-- =========================================================================
-- 8. 계측 이벤트 (K값 추적)
-- =========================================================================
create table if not exists events (
  id          bigint generated always as identity primary key,
  name        text not null,   -- view|vote|result_view|card_render|share_click|share_landing|share_to_vote|ugc_submit|notify_optin
  survey_id   uuid,
  session_id  text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_events_name_time on events(name, created_at);

-- =========================================================================
-- 9. 통계 뷰 (PII 없음). n<30이면 애플리케이션이 통계 자체를 숨긴다(V3).
--    이 뷰는 표본수를 함께 반환하므로 소비 측이 게이트를 강제할 수 있다.
-- =========================================================================
create or replace view survey_option_tally as
select
  o.survey_id,
  o.id   as option_id,
  o.label,
  count(v.id) as votes
from survey_options o
left join votes v on v.option_id = o.id
group by o.survey_id, o.id, o.label;

create or replace view survey_totals as
select survey_id, count(*) as n
from votes
group by survey_id;

-- =========================================================================
-- 10. RLS — 이거 뚫리면 즉시 실패
-- =========================================================================
alter table categories        enable row level security;
alter table surveys           enable row level security;
alter table survey_options    enable row level security;
alter table votes             enable row level security;
alter table comments          enable row level security;
alter table reports           enable row level security;
alter table takedown_requests enable row level security;
alter table notify_optin      enable row level security;
alter table short_links       enable row level security;
alter table events            enable row level security;
alter table contact_messages  enable row level security;

-- 읽기 공개: 카테고리
create policy cat_read on categories for select to anon using (true);

-- 설문: 익명 SELECT는 승인된 것만. pending/held/rejected는 익명에게 절대 노출 안 됨 (E3).
create policy survey_read_approved on surveys
  for select to anon using (status = 'approved');
-- 설문: 익명 INSERT 허용하되 status는 항상 'pending'으로 강제 (승인은 서비스롤만).
create policy survey_insert_pending on surveys
  for insert to anon with check (status = 'pending' and origin = 'user');

-- 선택지: 승인된 설문의 것만 읽기.
create policy option_read on survey_options
  for select to anon using (
    exists (select 1 from surveys s where s.id = survey_id and s.status = 'approved')
  );

-- 투표: 익명 INSERT만. SELECT 전면 금지(ip_hash/fingerprint 준식별자 보호).
create policy vote_insert on votes
  for insert to anon with check (true);
-- (votes에는 anon SELECT 정책을 만들지 않는다 → RLS 기본 거부. 통계는 뷰/RPC로만.)

-- 댓글: 승인된 것만 읽기, 익명 INSERT는 pending 강제.
create policy comment_read on comments
  for select to anon using (status = 'approved');
create policy comment_insert on comments
  for insert to anon with check (status = 'pending');

-- 신고/삭제요청/알림: 익명 INSERT만, SELECT 금지.
create policy report_insert   on reports           for insert to anon with check (true);
create policy takedown_insert on takedown_requests for insert to anon with check (true);
create policy notify_insert   on notify_optin      for insert to anon with check (true);
create policy contact_insert  on contact_messages  for insert to anon with check (true);

-- 짧은 링크: 서버(서비스롤)만 생성/조회. 익명 직접 접근 없음 → 정책 미부여(기본 거부).
--   /s/{shortId} 열람은 서버 라우트가 서비스롤로 조회해 렌더한다.

-- 계측: 익명 INSERT만.
create policy event_insert on events for insert to anon with check (true);

-- 뷰(survey_option_tally, survey_totals)는 security_invoker 기본이라 votes RLS를 상속.
-- 익명 통계 노출은 SECURITY DEFINER RPC로 감싸 n>=30 게이트를 서버에서 강제한다(아래).

-- =========================================================================
-- 11. 통계 RPC — n<30이면 null 통계 반환("집계 중"). PII 없음. (V3)
-- =========================================================================
create or replace function get_survey_stats(p_survey_id uuid)
returns table(option_id uuid, opt_key text, label text, votes bigint, n bigint, show_stats boolean)
language sql
security definer
set search_path = public
as $$
  with total as (
    select count(*)::bigint as n from votes where survey_id = p_survey_id
  )
  select
    o.id, o.opt_key, o.label,
    (select count(*) from votes v where v.option_id = o.id)::bigint as votes,
    t.n,
    (t.n >= 30) as show_stats
  from survey_options o, total t
  where o.survey_id = p_survey_id
    and exists (select 1 from surveys s where s.id = p_survey_id and s.status = 'approved')
  order by o.sort;
$$;
revoke all on function get_survey_stats(uuid) from public;
grant execute on function get_survey_stats(uuid) to anon;

-- slug 편의 래퍼 — 앱은 slug만 알고 uuid를 모른다.
create or replace function get_survey_stats_by_slug(p_slug text)
returns table(option_id uuid, opt_key text, label text, votes bigint, n bigint, show_stats boolean)
language sql
security definer
set search_path = public
as $$
  select * from get_survey_stats(
    (select id from surveys where slug = p_slug and status = 'approved')
  );
$$;
revoke all on function get_survey_stats_by_slug(text) from public;
grant execute on function get_survey_stats_by_slug(text) to anon;
-- 소비 측 규칙: show_stats=false이면 votes를 %로 렌더하지 말고 "집계 중"으로 표기.

-- 봇 투표 비율 추정 (V4, 관리자 대시보드용). 같은 ip_hash가 비정상적으로 많은 표를
-- 던진 비율. service_role(관리 API)만 실행.
create or replace function get_bot_ratio()
returns numeric
language sql
security definer
set search_path = public
as $$
  with per_ip as (select ip_hash, count(*) c from votes group by ip_hash),
       tot as (select count(*)::numeric n from votes)
  select coalesce(
    (select sum(c) from per_ip where c > 20)::numeric / nullif((select n from tot), 0),
    0
  );
$$;
revoke all on function get_bot_ratio() from public;
grant execute on function get_bot_ratio() to service_role;

-- =========================================================================
-- 12. 씨드 카테고리 (12) — 운영자 데이터. 실제 시드 설문은 P2에서 투입.
-- =========================================================================
insert into categories (id, slug, name, emoji, sort) values
  (1,  'living', '생활·집안습관',   '🏠', 1),
  (2,  'food',   '음식·식습관',     '🍚', 2),
  (3,  'sleep',  '잠·수면습관',     '😴', 3),
  (4,  'dating', '연애·썸',         '💘', 4),
  (5,  'couple', '부부·동거',       '🏡', 5),
  (6,  'family', '가족·부모',       '👨‍👩‍👧', 6),
  (7,  'money',  '돈·소비',         '💸', 7),
  (8,  'work',   '직장·회사',       '🏢', 8),
  (9,  'school', '학교·학창시절',   '🎒', 9),
  (10, 'body',   '몸·신체반응',     '🫧', 10),
  (11, 'mind',   '성격·감정',       '🧠', 11),
  (12, 'quirks', '취향·은밀한 버릇','🤫', 12)
on conflict (id) do nothing;
