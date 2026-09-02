-- ============================================================================
-- 00007: 본인인증 CI 해시 저장처 (D2 에스컬레이션 → 오케스트레이터 확정)
-- 목적: 1인 1계정(CI 중복 가입 차단). profiles 는 select 가 테이블 단위로
--       열려 있으므로 CI 해시는 service role 전용 별도 테이블에 격리한다.
-- blocked_hashes(영구정지 재가입 차단)와 별개 — 이쪽은 "활성 회원" 매핑.
-- ============================================================================

create table public.identity_hashes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  ci_hash    text not null,
  created_at timestamptz not null default now()
);

create unique index uq_identity_hashes_ci on public.identity_hashes (ci_hash);

alter table public.identity_hashes enable row level security;
-- 정책 없음 = service role 외 전면 차단
revoke all on public.identity_hashes from anon, authenticated;

comment on table public.identity_hashes is
  'PASS 본인인증 CI sha256 해시 — 1인 1계정 강제. service role 전용. 원문 CI 저장 금지.';
