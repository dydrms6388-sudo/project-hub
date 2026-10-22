-- 차단 목록 화면용: 내가 차단한 사용자의 닉네임만 반환 (차단 상대는 profile_cards 에서 제외되므로 별도 함수)
create or replace function public.my_blocked_list()
returns table (blocked_id uuid, nickname text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, p.nickname, b.created_at
    from public.blocks b
    left join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc
$$;
revoke execute on function public.my_blocked_list() from public, anon;
grant execute on function public.my_blocked_list() to authenticated;
