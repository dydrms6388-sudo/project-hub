-- ============================================================================
-- Supabase Storage: 비공개 버킷 profile-photos
-- 업로드/삭제는 서버(Route Handler)가 이미지 재인코딩·EXIF 제거 후 service role 로 수행하고,
-- 조회는 서버가 DB 정책(profile_photos RLS)으로 권한 확인 후 짧은 signed URL 을 발급한다.
-- 아래 storage 정책은 클라이언트 직접 접근을 대비한 2차 방어선이다.
-- storage 스키마가 없는 로컬 Postgres 에서는 건너뛴다.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('profile-photos', 'profile-photos', false, 10485760, array['image/webp'])
    on conflict (id) do update set public = false;

    execute $p$
      create policy "between photos owner write" on storage.objects for insert to authenticated
      with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "between photos owner delete" on storage.objects for delete to authenticated
      using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "between photos visible read" on storage.objects for select to authenticated
      using (
        bucket_id = 'profile-photos'
        and exists (
          select 1 from public.profile_photos ph
          where ph.storage_path = name
        )
      )
    $p$;
  end if;
end $$;
