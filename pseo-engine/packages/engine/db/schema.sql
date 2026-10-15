-- @pseo/engine — 공공데이터 프로그래매틱 SEO 엔진 스키마.
-- 첫 데이터셋: 국토부 아파트 실거래가. 두 번째 데이터셋(주유소 등)도 같은
-- 테이블 구조를 재사용한다(dataset_key 구분) — 어댑터 추상화 검증(Phase 4)의 전제.
--
-- Supabase Postgres 기준. `supabase db push` 또는 SQL 에디터로 적용.

-- ── 수집 원본: 재처리 가능하도록 그대로 적재 ────────────────────────────────
create table if not exists raw_records (
  id           bigint generated always as identity primary key,
  dataset_key  text not null,                    -- 'molit-apt' | 'opinet-gas' | …
  source_id    text not null,                    -- 원본 레코드의 자연키(중복 방지)
  payload      jsonb not null,
  fetched_at   timestamptz not null default now(),
  unique (dataset_key, source_id)
);
create index if not exists raw_records_dataset_idx on raw_records (dataset_key, fetched_at);

-- ── 지역 계층: 시도 > 시군구 > 읍면동 ───────────────────────────────────────
create table if not exists regions (
  id         bigint generated always as identity primary key,
  level      text not null check (level in ('sido', 'sigungu', 'dong')),
  code       text not null unique,               -- 법정동코드 prefix (시도 2 / 시군구 5 / 동 10자리)
  name       text not null,
  parent_id  bigint references regions(id),
  slug       text not null unique
);
create index if not exists regions_parent_idx on regions (parent_id);

-- ── 단지 ────────────────────────────────────────────────────────────────────
create table if not exists complexes (
  id          bigint generated always as identity primary key,
  dataset_key text not null,
  region_id   bigint not null references regions(id),
  name        text not null,
  slug        text not null,
  built_year  int,
  unique (dataset_key, region_id, name)
);
create index if not exists complexes_region_idx on complexes (region_id);

-- ── 거래 ────────────────────────────────────────────────────────────────────
create table if not exists transactions (
  id          bigint generated always as identity primary key,
  dataset_key text not null,
  complex_id  bigint not null references complexes(id),
  deal_date   date not null,
  price_krw   bigint not null,                   -- 만원 단위 아님: 원 단위 정규화
  area_m2     numeric(8,2) not null,
  floor       int,
  source_id   text not null,                     -- raw_records.source_id 역참조
  unique (dataset_key, source_id)
);
create index if not exists transactions_complex_date_idx on transactions (complex_id, deal_date);
create index if not exists transactions_dataset_date_idx on transactions (dataset_key, deal_date);

-- ── 페이지 레지스트리: URL 단위 색인 관리 ──────────────────────────────────
-- data_score 임계치 미달 페이지는 생성하지 않고 상위로 301 (Low Value 방지).
create table if not exists page_registry (
  id           bigint generated always as identity primary key,
  dataset_key  text not null,
  url          text not null unique,
  entity_type  text not null check (entity_type in ('overview','sido','sigungu','dong','complex','complex_year')),
  entity_id    bigint not null,
  data_score   int not null default 0,
  indexed_at   timestamptz,                      -- Search Console 확인 시각 (Phase 3)
  noindex      boolean not null default false,   -- 30일 노출 0 → true (크롤 예산 보호)
  last_updated timestamptz not null default now()
);
create index if not exists page_registry_score_idx on page_registry (dataset_key, data_score desc);
create index if not exists page_registry_entity_idx on page_registry (entity_type, entity_id);

-- ── 증분 수집 커서 ──────────────────────────────────────────────────────────
create table if not exists ingest_cursors (
  dataset_key   text not null,
  scope         text not null,                   -- 예: 시군구 코드 '11110'
  cursor        text not null,                   -- 예: 마지막 성공 계약월 '202607'
  last_success  timestamptz not null default now(),
  primary key (dataset_key, scope)
);

-- ── 갱신 스케줄 (Phase 3에서 활성화) ────────────────────────────────────────
-- select cron.schedule('pseo-daily-ingest', '0 18 * * *',  -- 03:00 KST
--   $$select net.http_post(url := '<ingest-webhook>', body := '{}'::jsonb)$$);
