// 탐색/스와이프 SQL 빌더 (순수 함수, 파라미터 바인딩만 사용 — 문자열 보간 금지)
// 대상은 항상 접근제어·마스킹이 적용된 public.profile_cards 뷰다.
import type { ExploreFilters } from "./filters";

export type Viewer = { id: string; sido: string; sigungu: string | null; interests: string[] };
export type SqlQuery = { text: string; values: unknown[] };

export const PAGE_SIZE = 24;
export const MAX_OFFSET = 2400;

export const CARD_COLUMNS = `c.id, c.nickname, c.age, c.sido, c.sigungu, c.dong, c.height, c.weight, c.body_type,
  c.position, c.styles, c.personality, c.interests, c.bio, c.purposes, c.active_times, c.smoking, c.drinking,
  c.availability, c.presence, c.is_new, c.primary_photo_id, c.photo_count`;

class Params {
  values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

function recommendedScore(p: Params, viewer: Viewer): string {
  const sido = p.add(viewer.sido);
  const sigungu = p.add(viewer.sigungu);
  const interests = p.add(viewer.interests);
  return `(
    (c.sido = ${sido})::int * 2
    + (c.sigungu is not null and c.sigungu = ${sigungu})::int * 3
    + (c.photo_count > 0)::int * 2
    + (c.availability = 'now')::int * 2
    + (case c.presence when 'online' then 2 when 'today' then 1 else 0 end)
    + least(3, cardinality(array(select unnest(c.interests) intersect select unnest(${interests}::text[]))))
  )`;
}

export function buildWhere(f: ExploreFilters, viewer: Viewer, p: Params, now = new Date()): string[] {
  const where: string[] = [`c.id <> ${p.add(viewer.id)}`];
  const year = now.getFullYear();

  if (f.sido.length || f.sigungu.length) {
    // 시/도 선택과 시/군/구 선택은 OR (예: "부산 전체 또는 서울 마포구")
    const ors: string[] = [];
    if (f.sido.length) ors.push(`c.sido = any(${p.add(f.sido)}::text[])`);
    if (f.sigungu.length) ors.push(`(c.sido || ':' || c.sigungu) = any(${p.add(f.sigungu)}::text[])`);
    where.push(`(${ors.join(" or ")})`);
  }
  if (f.dong) where.push(`c.dong = ${p.add(f.dong)}`);
  if (f.ageMax) where.push(`c.birth_year >= ${p.add(year - f.ageMax)}`);
  if (f.ageMin) where.push(`c.birth_year <= ${p.add(year - f.ageMin)}`);
  if (f.heightMin) where.push(`c.height >= ${p.add(f.heightMin)}`);
  if (f.heightMax) where.push(`c.height <= ${p.add(f.heightMax)}`);
  if (f.bodyTypes.length) where.push(`c.body_type = any(${p.add(f.bodyTypes)}::text[])`);
  if (f.positions.length) where.push(`c.position = any(${p.add(f.positions)}::text[])`);
  if (f.styles.length) where.push(`c.styles && ${p.add(f.styles)}::text[]`);
  if (f.purposes.length) where.push(`c.purposes && ${p.add(f.purposes)}::text[]`);
  if (f.interests.length) {
    where.push(`c.interests ${f.interestsMode === "all" ? "@>" : "&&"} ${p.add(f.interests)}::text[]`);
  }
  if (f.hasPhoto) where.push(`c.photo_count > 0`);
  if (f.activeWithin === "online") where.push(`c.presence = 'online'`);
  if (f.activeWithin === "today") where.push(`c.presence in ('online', 'today')`);
  if (f.activeWithin === "week") where.push(`c.presence in ('online', 'today', 'week')`);
  if (f.availability.length) where.push(`c.availability::text = any(${p.add(f.availability)}::text[])`);
  return where;
}

function orderBy(f: ExploreFilters, viewer: Viewer, p: Params): string {
  switch (f.sort) {
    case "recent":
      return `c.active_hour desc, c.id`;
    case "new":
      return `c.joined_day desc, c.active_hour desc, c.id`;
    case "age_asc":
      return `c.birth_year desc, c.active_hour desc, c.id`;
    case "age_desc":
      return `c.birth_year asc, c.active_hour desc, c.id`;
    case "region": {
      const sido = p.add(viewer.sido);
      const sigungu = p.add(viewer.sigungu);
      return `(c.sido = ${sido} and c.sigungu = ${sigungu}) desc nulls last, (c.sido = ${sido}) desc, c.sido, c.sigungu nulls last, c.active_hour desc, c.id`;
    }
    case "recommended":
    default:
      return `${recommendedScore(p, viewer)} desc, c.active_hour desc, c.id`;
  }
}

export function buildExploreQuery(
  f: ExploreFilters,
  viewer: Viewer,
  offset: number,
  limit = PAGE_SIZE,
  now = new Date(),
): SqlQuery {
  const p = new Params();
  const where = buildWhere(f, viewer, p, now);
  const order = orderBy(f, viewer, p);
  const lim = p.add(Math.min(Math.max(limit, 1), 60) + 1); // +1 로 다음 페이지 존재 확인
  const off = p.add(Math.min(Math.max(offset, 0), MAX_OFFSET));
  return {
    text: `select ${CARD_COLUMNS} from public.profile_cards c where ${where.join(" and ")} order by ${order} limit ${lim} offset ${off}`,
    values: p.values,
  };
}

/** 스와이프 후보: 이미 좋아요/패스한 사람 제외, 추천순 */
export function buildSwipeQuery(f: ExploreFilters, viewer: Viewer, limit = 20, now = new Date()): SqlQuery {
  const p = new Params();
  const where = buildWhere(f, viewer, p, now);
  where.push(`not exists (select 1 from public.likes l where l.liker_id = ${p.add(viewer.id)} and l.target_id = c.id)`);
  const score = recommendedScore(p, viewer);
  const lim = p.add(Math.min(Math.max(limit, 1), 50));
  return {
    text: `select ${CARD_COLUMNS} from public.profile_cards c where ${where.join(" and ")} order by ${score} desc, c.active_hour desc, c.id limit ${lim}`,
    values: p.values,
  };
}
