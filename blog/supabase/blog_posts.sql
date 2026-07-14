-- blog_posts: 자동 발행 블로그 글 저장 테이블
-- Supabase SQL Editor 에서 1회 실행.

create table if not exists public.blog_posts (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        unique      not null,
  title        text                    not null,
  html         text                    not null,
  excerpt      text,
  tags         text[]      default '{}',
  tool_slug    text,
  keyword      text,
  published_at timestamptz default now(),
  created_at   timestamptz default now()
);

-- 조회 패턴: slug 단건 조회, published_at 내림차순 목록/오늘 발행 수 카운트
create index if not exists blog_posts_slug_idx         on public.blog_posts (slug);
create index if not exists blog_posts_published_at_idx on public.blog_posts (published_at desc);

-- RLS: 공개 읽기 허용, 쓰기는 service_role(크론)만.
alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts public read" on public.blog_posts;
create policy "blog_posts public read"
  on public.blog_posts for select
  using (true);
-- insert/update/delete 정책 없음 → anon/authenticated 는 쓰기 불가.
-- service_role 키는 RLS 를 우회하므로 크론 라우트에서만 insert 가능.
