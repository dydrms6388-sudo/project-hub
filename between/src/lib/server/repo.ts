import "server-only";
// 데이터 접근 함수. 모두 호출자가 넘긴 Db(= withUser 트랜잭션)로 실행되어 RLS 가 항상 적용된다.
// 여기서 사용자 ID 를 인자로 받는 경우에도 RLS/정책이 auth.uid() 로 다시 검증한다 (이중 방어).
import { buildExploreQuery, buildSwipeQuery, CARD_COLUMNS, PAGE_SIZE, type Viewer } from "@/lib/explore/query";
import type { ExploreFilters } from "@/lib/explore/filters";
import type { Onboarding, ProfileUpdate } from "@/lib/validation/profile";
import type { ContactKind } from "@/lib/domain/options";
import type {
  ActivityStatus,
  Contact,
  LikeItem,
  MatchItem,
  MyProfile,
  Photo,
  ProfileCard,
  ReportRow,
  SavedFilter,
} from "@/lib/types";
import type { Db } from "./db";

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));

function serializeProfile(row: Record<string, unknown>): MyProfile {
  return {
    ...(row as unknown as MyProfile),
    expires_at: iso(row.expires_at),
    suspended_until: iso(row.suspended_until),
    sensitive_consent_at: iso(row.sensitive_consent_at),
    created_at: iso(row.created_at)!,
  };
}

// ---------------------------------------------------------------------------
// 프로필
// ---------------------------------------------------------------------------
export async function getMyProfile(db: Db, userId: string): Promise<MyProfile | null> {
  const r = await db.query(
    `select id, nickname, birth_year, sido, sigungu, dong, height, weight, body_type, position, styles, personality,
            interests, bio, purposes, active_times, smoking, drinking, field_visibility, is_hidden, expires_at,
            status, suspended_until, sensitive_consent_at, created_at
       from public.profiles where id = $1`,
    [userId],
  );
  return r.rows[0] ? serializeProfile(r.rows[0]) : null;
}

export async function createProfile(db: Db, userId: string, input: Onboarding): Promise<void> {
  await db.query(
    `insert into public.profiles (id, nickname, birth_year, sido, sigungu, dong, adult_confirmed_at, privacy_consent_at)
     values ($1, $2, $3, $4, $5, $6, now(), now())`,
    [userId, input.nickname, input.birthYear, input.sido, input.sigungu, input.dong],
  );
  await db.query(`insert into public.activity_status (user_id, status) values ($1, 'off')`, [userId]);
}

export async function updateProfile(db: Db, userId: string, v: ProfileUpdate): Promise<void> {
  const expiresAt = v.expiresInDays > 0 ? new Date(Date.now() + v.expiresInDays * 86_400_000) : null;
  // 성향 동의 철회 시 성향 값도 함께 삭제 (DB 제약 position_requires_sensitive_consent)
  const position = v.positionConsent ? v.position : null;
  const r = await db.query(
    `update public.profiles set
       nickname = $2, birth_year = $3, sido = $4, sigungu = $5, dong = $6, height = $7, weight = $8,
       body_type = $9, position = $10, styles = $11, personality = $12, interests = $13, bio = $14,
       purposes = $15, active_times = $16, smoking = $17, drinking = $18, field_visibility = $19,
       is_hidden = $20, expires_at = $21,
       sensitive_consent_at = case when $22::boolean then coalesce(sensitive_consent_at, now()) else null end
     where id = $1`,
    [
      userId, v.nickname, v.birthYear, v.sido, v.sigungu, v.dong, v.height, v.weight, v.bodyType, position,
      v.styles, v.personality, v.interests, v.bio, v.purposes, v.activeTimes, v.smoking, v.drinking,
      JSON.stringify(v.visibility), v.isHidden, expiresAt, v.positionConsent,
    ],
  );
  if (r.rowCount !== 1) throw new Error("FORBIDDEN");
}

export async function setHidden(db: Db, userId: string, hidden: boolean) {
  await db.query(`update public.profiles set is_hidden = $2 where id = $1`, [userId, hidden]);
}

export async function touchActivity(db: Db) {
  await db.query("select public.touch_activity()");
}

export async function getCard(db: Db, targetId: string): Promise<ProfileCard | null> {
  const r = await db.query<ProfileCard>(`select ${CARD_COLUMNS} from public.profile_cards c where c.id = $1`, [
    targetId,
  ]);
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// 탐색 / 스와이프
// ---------------------------------------------------------------------------
export async function getViewer(db: Db, userId: string): Promise<Viewer | null> {
  const r = await db.query<Viewer>(
    `select id, sido, sigungu, interests from public.profiles where id = $1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export async function explore(
  db: Db,
  viewer: Viewer,
  filters: ExploreFilters,
  offset: number,
  limit = PAGE_SIZE,
): Promise<{ items: ProfileCard[]; nextOffset: number | null }> {
  const q = buildExploreQuery(filters, viewer, offset, limit);
  const r = await db.query<ProfileCard>(q.text, q.values);
  const hasMore = r.rows.length > limit;
  return { items: r.rows.slice(0, limit), nextOffset: hasMore ? offset + limit : null };
}

export async function swipeDeck(db: Db, viewer: Viewer, filters: ExploreFilters, limit = 20): Promise<ProfileCard[]> {
  const q = buildSwipeQuery(filters, viewer, limit);
  return (await db.query<ProfileCard>(q.text, q.values)).rows;
}

// ---------------------------------------------------------------------------
// 좋아요 / 매칭
// ---------------------------------------------------------------------------
export async function swipe(
  db: Db,
  userId: string,
  targetId: string,
  kind: "like" | "pass",
): Promise<{ matched: boolean; duplicate: boolean }> {
  const ins = await db.query(
    `insert into public.likes (liker_id, target_id, kind) values ($1, $2, $3)
     on conflict (liker_id, target_id) do nothing`,
    [userId, targetId, kind],
  );
  const matched = await db.query<{ ok: boolean }>("select public.is_matched($1, $2) as ok", [userId, targetId]);
  return { matched: kind === "like" && matched.rows[0].ok, duplicate: ins.rowCount === 0 };
}

export async function undoSwipe(db: Db, userId: string, targetId: string) {
  await db.query(`delete from public.likes where liker_id = $1 and target_id = $2`, [userId, targetId]);
}

export async function myRelation(db: Db, userId: string, targetId: string) {
  const r = await db.query<{ my_swipe: "like" | "pass" | null; liked_me: boolean; match_id: string | null }>(
    `select
       (select kind from public.likes where liker_id = $1 and target_id = $2) as my_swipe,
       exists (select 1 from public.likes where liker_id = $2 and target_id = $1 and kind = 'like') as liked_me,
       (select id from public.matches
         where user_a = least($1::uuid, $2::uuid) and user_b = greatest($1::uuid, $2::uuid) and unmatched_at is null) as match_id`,
    [userId, targetId],
  );
  return r.rows[0];
}

export async function listMatches(db: Db, userId: string): Promise<MatchItem[]> {
  const r = await db.query(
    `select m.id as match_id, m.created_at as matched_at, row_to_json(c) as profile
       from public.matches m
       join public.profile_cards c on c.id = case when m.user_a = $1 then m.user_b else m.user_a end
      where ($1 in (m.user_a, m.user_b)) and m.unmatched_at is null
      order by m.created_at desc limit 200`,
    [userId],
  );
  return r.rows.map((x) => ({ match_id: x.match_id, matched_at: iso(x.matched_at)!, profile: x.profile }));
}

export async function listLikes(db: Db, userId: string, direction: "received" | "sent"): Promise<LikeItem[]> {
  const sql =
    direction === "received"
      ? `select l.created_at, row_to_json(c) as profile from public.likes l
           join public.profile_cards c on c.id = l.liker_id
          where l.target_id = $1 and l.kind = 'like'
            and not exists (select 1 from public.likes mine where mine.liker_id = $1 and mine.target_id = l.liker_id)
          order by l.created_at desc limit 200`
      : `select l.created_at, row_to_json(c) as profile from public.likes l
           join public.profile_cards c on c.id = l.target_id
          where l.liker_id = $1 and l.kind = 'like'
            and not public.is_matched($1, l.target_id)
          order by l.created_at desc limit 200`;
  const r = await db.query(sql, [userId]);
  return r.rows.map((x) => ({ created_at: iso(x.created_at)!, profile: x.profile }));
}

export async function unmatch(db: Db, matchId: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>("select public.unmatch($1) as ok", [matchId]);
  return r.rows[0].ok;
}

// ---------------------------------------------------------------------------
// 사진
// ---------------------------------------------------------------------------
export async function listPhotos(db: Db, ownerId: string): Promise<Photo[]> {
  const r = await db.query<Photo>(
    `select id, user_id, position, width, height, visibility from public.profile_photos
      where user_id = $1 and removed_at is null order by position, created_at`,
    [ownerId],
  );
  return r.rows;
}

export async function insertPhoto(
  db: Db,
  p: { id: string; userId: string; path: string; width: number; height: number; bytes: number },
) {
  const next = await db.query<{ n: number }>(
    `select coalesce(max(position) + 1, 0)::int as n from public.profile_photos where user_id = $1 and removed_at is null`,
    [p.userId],
  );
  await db.query(
    `insert into public.profile_photos (id, user_id, storage_path, position, width, height, bytes)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [p.id, p.userId, p.path, Math.min(next.rows[0].n, 4), p.width, p.height, p.bytes],
  );
}

export async function photoStoragePath(db: Db, photoId: string): Promise<string | null> {
  const r = await db.query<{ storage_path: string }>(
    `select storage_path from public.profile_photos where id = $1 and (removed_at is null or user_id = auth.uid())`,
    [photoId],
  );
  return r.rows[0]?.storage_path ?? null;
}

export async function deletePhoto(db: Db, userId: string, photoId: string): Promise<string | null> {
  const r = await db.query<{ storage_path: string }>(
    `delete from public.profile_photos where id = $1 and user_id = $2 returning storage_path`,
    [photoId, userId],
  );
  if (r.rows[0]) await renumberPhotos(db, userId);
  return r.rows[0]?.storage_path ?? null;
}

async function renumberPhotos(db: Db, userId: string) {
  await db.query(
    `update public.profile_photos p set position = s.rn - 1
       from (select id, row_number() over (order by position, created_at) as rn
               from public.profile_photos where user_id = $1 and removed_at is null) s
      where p.id = s.id and p.position <> s.rn - 1`,
    [userId],
  );
}

export async function makePrimaryPhoto(db: Db, userId: string, photoId: string) {
  await db.query(
    `update public.profile_photos p set position = s.rn - 1
       from (select id, row_number() over (order by (id = $2) desc, position, created_at) as rn
               from public.profile_photos where user_id = $1 and removed_at is null) s
      where p.id = s.id`,
    [userId, photoId],
  );
}

export async function setPhotoVisibility(db: Db, userId: string, photoId: string, visibility: "public" | "matches") {
  await db.query(`update public.profile_photos set visibility = $3 where id = $2 and user_id = $1`, [
    userId,
    photoId,
    visibility,
  ]);
}

// ---------------------------------------------------------------------------
// 연락처
// ---------------------------------------------------------------------------
export async function listContacts(db: Db, ownerId: string): Promise<Contact[]> {
  const r = await db.query<Contact>(
    `select id, user_id, kind, value, visibility from public.contact_methods where user_id = $1 order by kind`,
    [ownerId],
  );
  return r.rows;
}

export async function upsertContact(
  db: Db,
  userId: string,
  kind: ContactKind,
  url: string,
  visibility: "public" | "matches",
) {
  await db.query(
    `insert into public.contact_methods (user_id, kind, value, visibility) values ($1, $2, $3, $4)
     on conflict (user_id, kind) do update set value = excluded.value, visibility = excluded.visibility`,
    [userId, kind, url, visibility],
  );
}

export async function deleteContact(db: Db, userId: string, kind: ContactKind) {
  await db.query(`delete from public.contact_methods where user_id = $1 and kind = $2`, [userId, kind]);
}

// ---------------------------------------------------------------------------
// 지금 만나기
// ---------------------------------------------------------------------------
export async function getActivity(db: Db, userId: string): Promise<ActivityStatus> {
  const r = await db.query(`select status, expires_at from public.activity_status where user_id = $1`, [userId]);
  const row = r.rows[0];
  if (!row) return { status: "off", expires_at: null };
  const expired = row.expires_at && new Date(row.expires_at) <= new Date();
  return expired ? { status: "off", expires_at: null } : { status: row.status, expires_at: iso(row.expires_at) };
}

export async function setActivity(db: Db, userId: string, status: ActivityStatus["status"], hours: number | null) {
  const expires =
    status === "now"
      ? new Date(Date.now() + (hours ?? 1) * 3_600_000)
      : status === "tonight"
        ? endOfToday()
        : status === "weekend"
          ? endOfWeekend()
          : null;
  await db.query(
    `insert into public.activity_status (user_id, status, expires_at) values ($1, $2, $3)
     on conflict (user_id) do update set status = excluded.status, expires_at = excluded.expires_at`,
    [userId, status, expires],
  );
}

// KST 기준 오늘 자정 / 이번 주 일요일 자정
function kstNow() {
  return new Date(Date.now() + 9 * 3_600_000);
}
function endOfToday(): Date {
  const k = kstNow();
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1) - 9 * 3_600_000);
}
function endOfWeekend(): Date {
  const k = kstNow();
  const daysToMonday = (8 - k.getUTCDay()) % 7 || 7;
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + daysToMonday) - 9 * 3_600_000);
}

// ---------------------------------------------------------------------------
// 차단 / 신고
// ---------------------------------------------------------------------------
export async function block(db: Db, userId: string, targetId: string) {
  await db.query(
    `insert into public.blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing`,
    [userId, targetId],
  );
}

export async function unblock(db: Db, userId: string, targetId: string) {
  await db.query(`delete from public.blocks where blocker_id = $1 and blocked_id = $2`, [userId, targetId]);
}

export async function listBlocked(db: Db, userId: string) {
  const r = await db.query<{ blocked_id: string; created_at: string }>(
    `select blocked_id, created_at from public.blocks where blocker_id = $1 order by created_at desc`,
    [userId],
  );
  return r.rows.map((x) => ({ blocked_id: x.blocked_id, created_at: iso(x.created_at)! }));
}

export async function report(db: Db, userId: string, targetId: string, reason: string, detail: string | null) {
  await db.query(
    `insert into public.reports (reporter_id, reported_id, reason, detail) values ($1, $2, $3, $4)`,
    [userId, targetId, reason, detail],
  );
}

// ---------------------------------------------------------------------------
// 저장된 필터
// ---------------------------------------------------------------------------
export async function listSavedFilters(db: Db, userId: string): Promise<SavedFilter[]> {
  const r = await db.query(
    `select id, name, filters, created_at from public.profile_preferences where user_id = $1 order by created_at desc`,
    [userId],
  );
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }));
}

export async function saveFilter(db: Db, userId: string, name: string, filters: ExploreFilters) {
  await db.query(
    `insert into public.profile_preferences (user_id, name, filters) values ($1, $2, $3)
     on conflict (user_id, name) do update set filters = excluded.filters`,
    [userId, name, JSON.stringify(filters)],
  );
}

export async function deleteSavedFilter(db: Db, userId: string, id: string) {
  await db.query(`delete from public.profile_preferences where id = $1 and user_id = $2`, [id, userId]);
}

// ---------------------------------------------------------------------------
// 운영자
// ---------------------------------------------------------------------------
export async function isAdmin(db: Db): Promise<boolean> {
  return (await db.query<{ ok: boolean }>("select public.is_admin() as ok")).rows[0].ok;
}

export async function reportQueue(db: Db, status: "open" | "all" = "open"): Promise<ReportRow[]> {
  const r = await db.query(
    `select r.id, r.reporter_id, r.reported_id, r.reason, r.detail, r.status, r.created_at,
            p.nickname as reported_nickname, p.status as reported_status,
            (select count(*)::int from public.reports x where x.reported_id = r.reported_id and x.status = 'open') as open_count
       from public.reports r
       left join public.profiles p on p.id = r.reported_id
      where ($1 = 'all' or r.status = 'open')
      order by (r.reason = 'minor') desc, r.created_at desc
      limit 200`,
    [status],
  );
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }));
}

export async function moderate(
  db: Db,
  a: { target: string; action: string; reason: string | null; hours: number | null; reportId: string | null; photoId: string | null },
) {
  await db.query("select public.moderate($1, $2::public.moderation_kind, $3, $4, $5, $6)", [
    a.target,
    a.action,
    a.reason,
    a.hours,
    a.reportId,
    a.photoId,
  ]);
}

export async function allPhotoPaths(db: Db, userId: string): Promise<string[]> {
  const r = await db.query<{ storage_path: string }>(
    `select storage_path from public.profile_photos where user_id = $1`,
    [userId],
  );
  return r.rows.map((x) => x.storage_path);
}
