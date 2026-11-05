-- =============================================================================
-- 0012 — storage buckets & storage.objects RLS
--   photos       (private) 경로 {profile_id}/{photo_id}.webp     — 본인 CRUD, 타인은 approved + can_view_profile
--   chat-images  (private) 경로 {match_id}/{message_id}.webp     — 당사자 읽기, 발신자 업로드(L3 양쪽 + 24h)
--   evidence     (private) 경로 {report_id}/{photo_id}.webp      — service role 전용(정책 없음)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos',      'photos',      false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-images', 'chat-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('evidence',    'evidence',    false, null,     null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- photos ----------
create policy storage_photos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_profile_id()::text);
create policy storage_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_profile_id()::text
              and public.active_sanction_level(public.current_profile_id()) < 3);
create policy storage_photos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_profile_id()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_profile_id()::text);
create policy storage_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.current_profile_id()::text);
create policy storage_photos_viewable on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.photos p
      where p.path = name and p.review_status = 'approved'
        and public.can_view_profile(public.current_profile_id(), p.profile_id)
    )
  );
create policy storage_photos_mod_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_moderator());

-- ---------- chat-images ----------
create policy storage_chat_images_participant_select on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_match_participant(((storage.foldername(name))[1])::uuid, public.current_profile_id())
    and exists (
      select 1 from public.messages m
      where m.image_path = name and (not m.is_held or m.sender_id = public.current_profile_id())
    )
  );
create policy storage_chat_images_sender_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_send_chat_image(((storage.foldername(name))[1])::uuid, public.current_profile_id())
  );
create policy storage_chat_images_mod_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public.is_moderator());

-- ---------- evidence: 정책 없음 = service role 만 (열람은 D8 API 가 audit_logs 기록 후 서명 URL 발급) ----------
