-- =============================================================================
-- 덕메이트(DuckMate) · D2 마이그레이션 00006 — Storage 버킷 + storage.objects RLS
--
-- 버킷 2개 (둘 다 비공개 — signed URL 로만 서빙):
--   photos      : 프로필 사진.  객체 경로 규약 = {profile_id}/{uuid}.webp
--                 (public.photos.path 에는 버킷 접두 포함 "photos/{profile_id}/{uuid}.webp"
--                  로 저장한다 — D2 savePhoto·아래 정책이 이 규약에 의존)
--   chat-images : 채팅 이미지.  객체 경로 규약 = {match_id}/{uuid}.webp
--
-- 정책 원칙:
--   - 업로드는 본인 폴더만 (photos = 내 profile_id 폴더, chat-images = 내가 참여한
--     매칭 폴더 + 양측 Lv≥2 조건은 이미지 전송 게이트와 동일 — A5 §1.2).
--   - 프로필 사진 열람 = 본인 + "매칭 상대(검수 승인분만)" + 검수자(admin).
--     탐색 카드의 승인 사진 서빙은 D3/E2 서버 경로가 service role signed URL 로
--     발급한다(can_view_profile 판정 후) — 클라이언트 직접 SELECT 는 위 3자만.
--   - evidence/ 증거 버킷은 D5 소관(서비스 전용) — 여기서 만들지 않는다.
--   - service role 은 RLS 우회 (검수·증거 복사·파기 잡).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 버킷 생성 (비공개, webp 강제 — 클라이언트 리사이즈 규약 12_flows §2.6)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos',      'photos',      false, 10485760, array['image/webp']),
  ('chat-images', 'chat-images', false, 10485760, array['image/webp'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. photos 버킷 정책
-- -----------------------------------------------------------------------------

-- 업로드: 본인 profile_id 폴더 + {uuid}.webp 파일명 + 발신 자격(제재 미적용)
create policy storage_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  );

-- 열람 ①: 본인 폴더 전체 (검수 전 포함 — /me/photos 상태 화면)
create policy storage_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

-- 열람 ②: 검수자(admin) — 검수 큐 (확정 처리는 service role, D8)
create policy storage_photos_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- 열람 ③: 매칭 상대 — 검수 승인(approved)된 사진만 signed URL 발급 가능
create policy storage_photos_select_matched on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1
      from public.photos ph
      join public.matches m
        on m.status = 'active'
       and (
            (m.a_id = public.current_profile_id() and m.b_id = ph.profile_id)
         or (m.b_id = public.current_profile_id() and m.a_id = ph.profile_id)
       )
      where ph.path = 'photos/' || storage.objects.name
        and ph.review_status = 'approved'
        and ph.profile_id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

-- 삭제: 본인 폴더만 (public.photos 행 삭제와 함께 클라이언트가 수행)
create policy storage_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

-- 갱신(덮어쓰기)은 클라이언트 불가 — 재업로드는 새 uuid 로 (검수 우회 방지)

-- -----------------------------------------------------------------------------
-- 3. chat-images 버킷 정책
--    이미지 전송 게이트 = 양측 verify_level ≥ 2 (A5 →D4). 메시지 행 insert 는
--    D4 Edge Function(service role)이지만 파일 업로드는 클라이언트가 직접 한다.
-- -----------------------------------------------------------------------------

-- 업로드: 내가 참여한 활성 매칭 폴더 + 나 Lv≥2 + 발신 자격(can_engage)
--   (상대 Lv≥2 는 매칭 성립 조건에 이미 내장 — try_create_match 가 양측 Lv2 검증)
create policy storage_chat_images_insert_participant on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and public.current_verify_level() >= 2
    and public.can_engage()
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(storage.objects.name))[1]
        and m.status = 'active'
        and (m.a_id = public.current_profile_id() or m.b_id = public.current_profile_id())
    )
  );

-- 열람: 해당 매칭 참여자만 (차단 시 matches 정책과 동일하게 행 자체가 안 보이지만
--   storage 는 별도 판정이므로 여기서도 참여자 조건을 건다)
create policy storage_chat_images_select_participant on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(storage.objects.name))[1]
        and (m.a_id = public.current_profile_id() or m.b_id = public.current_profile_id())
    )
  );

-- 삭제: 업로더 본인만 (owner_id = 업로드한 auth.users id — Storage 가 자동 기록)
create policy storage_chat_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and owner_id = auth.uid()::text
  );

-- 증거 보존과의 관계: 신고 시 이미지 원본은 D5 Edge 가 evidence/ 버킷(별도, service
-- 전용)으로 "복사"하므로 업로더의 삭제가 증거를 훼손하지 않는다 (A5 §4.2).
