// 선택지 코드 ↔ 한국어 라벨. 코드는 DB CHECK 제약(supabase/migrations/*core_schema.sql)과 동기화된다.
// tests/unit/options-sync.test.ts 가 두 정의의 일치를 검사한다.

type Options<T extends string> = readonly { value: T; label: string }[];

function opts<const T extends string>(list: readonly (readonly [T, string])[]): Options<T> {
  return list.map(([value, label]) => ({ value, label }));
}

export const BODY_TYPES = opts([
  ["slim", "마른"],
  ["slender", "슬림"],
  ["average", "보통"],
  ["toned", "슬림탄탄"],
  ["muscular", "근육"],
  ["chubby", "통통"],
  ["big", "듬직"],
] as const);

export const POSITIONS = opts([
  ["top", "탑"],
  ["bottom", "바텀"],
  ["versatile", "올"],
  ["other", "기타"],
  ["undisclosed", "비공개"],
] as const);

export const STYLES = opts([
  ["clean", "깔끔"],
  ["cute", "귀여운"],
  ["manly", "남성적"],
  ["dandy", "댄디"],
  ["sporty", "스포티"],
  ["street", "스트릿"],
  ["glasses", "안경"],
  ["beard", "수염"],
  ["tattoo", "타투"],
  ["bear", "곰"],
] as const);

export const PERSONALITIES = opts([
  ["calm", "차분한"],
  ["cheerful", "밝은"],
  ["sweet", "다정한"],
  ["funny", "유머러스"],
  ["shy", "낯가림"],
  ["honest", "솔직한"],
  ["thoughtful", "배려심"],
  ["homebody", "집돌이"],
  ["outgoing", "외향적"],
  ["introvert", "내향적"],
] as const);

export const INTERESTS = opts([
  ["workout", "헬스"],
  ["running", "러닝"],
  ["hiking", "등산"],
  ["travel", "여행"],
  ["food", "맛집"],
  ["cafe", "카페"],
  ["cooking", "요리"],
  ["movies", "영화"],
  ["music", "음악"],
  ["concert", "공연"],
  ["games", "게임"],
  ["reading", "독서"],
  ["art", "전시"],
  ["photo", "사진"],
  ["fashion", "패션"],
  ["pets", "반려동물"],
  ["drink", "술"],
  ["dance", "댄스"],
  ["swim", "수영"],
  ["kpop", "K-POP"],
] as const);

export const PURPOSES = opts([
  ["friend", "친구"],
  ["dating", "데이트"],
  ["relationship", "연애"],
  ["chat", "대화"],
  ["meal", "밥친구"],
  ["drink", "술친구"],
  ["workout_buddy", "운동친구"],
  ["travel", "여행친구"],
] as const);

export const ACTIVE_TIMES = opts([
  ["morning", "아침"],
  ["afternoon", "낮"],
  ["evening", "저녁"],
  ["night", "밤"],
  ["late_night", "새벽"],
  ["weekend", "주말"],
] as const);

export const SMOKING = opts([
  ["no", "비흡연"],
  ["sometimes", "가끔"],
  ["yes", "흡연"],
] as const);

export const DRINKING = opts([
  ["no", "안 마심"],
  ["sometimes", "가끔"],
  ["often", "자주"],
] as const);

export const AVAILABILITY = opts([
  ["now", "지금 가능"],
  ["tonight", "오늘 저녁"],
  ["weekend", "이번 주말"],
  ["flexible", "일정 조율"],
  ["off", "비활성"],
] as const);

export const PRESENCE = opts([
  ["online", "접속 중"],
  ["today", "오늘 활동"],
  ["week", "이번 주 활동"],
  ["away", "오래 전"],
] as const);

export const REPORT_REASONS = opts([
  ["spam", "스팸·광고"],
  ["fake", "사칭·도용 사진"],
  ["minor", "미성년자 의심"],
  ["harassment", "괴롭힘·혐오"],
  ["explicit", "음란·부적절한 사진"],
  ["scam", "금전 요구·사기"],
  ["other", "기타"],
] as const);

export const CONTACT_KINDS = opts([
  ["kakao_openchat", "카카오톡 오픈채팅"],
  ["line", "LINE"],
  ["instagram", "Instagram"],
  ["telegram", "Telegram"],
  ["link", "기타 링크"],
] as const);

export const NOW_DURATIONS = [
  { hours: 1, label: "1시간" },
  { hours: 2, label: "2시간" },
  { hours: 3, label: "3시간" },
  { hours: 6, label: "6시간" },
] as const;

export const EXPIRY_CHOICES = [
  { days: 0, label: "만료 없음" },
  { days: 30, label: "30일 후 자동 숨김" },
  { days: 90, label: "90일 후 자동 숨김" },
  { days: 180, label: "180일 후 자동 숨김" },
] as const;

export type BodyType = (typeof BODY_TYPES)[number]["value"];
export type Position = (typeof POSITIONS)[number]["value"];
export type Style = (typeof STYLES)[number]["value"];
export type Personality = (typeof PERSONALITIES)[number]["value"];
export type Interest = (typeof INTERESTS)[number]["value"];
export type Purpose = (typeof PURPOSES)[number]["value"];
export type ActiveTime = (typeof ACTIVE_TIMES)[number]["value"];
export type Smoking = (typeof SMOKING)[number]["value"];
export type Drinking = (typeof DRINKING)[number]["value"];
export type Availability = (typeof AVAILABILITY)[number]["value"];
export type Presence = (typeof PRESENCE)[number]["value"];
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ContactKind = (typeof CONTACT_KINDS)[number]["value"];

export function values<T extends string>(o: Options<T>): [T, ...T[]] {
  return o.map((x) => x.value) as [T, ...T[]];
}

export function labelOf<T extends string>(o: Options<T>, v: T | null | undefined): string {
  if (!v) return "";
  return o.find((x) => x.value === v)?.label ?? v;
}

// 공개/비공개를 개별 설정할 수 있는 선택 필드. 기본값은 DB public.field_public() 과 같다.
export const VISIBILITY_FIELDS = [
  "sigungu",
  "dong",
  "height",
  "weight",
  "body_type",
  "position",
  "styles",
  "personality",
  "interests",
  "bio",
  "purposes",
  "active_times",
  "smoking",
  "drinking",
] as const;
export type VisibilityField = (typeof VISIBILITY_FIELDS)[number];
export const PRIVATE_BY_DEFAULT: readonly VisibilityField[] = ["weight", "position", "dong"];

export function isFieldPublic(vis: Partial<Record<VisibilityField, "public" | "private">>, f: VisibilityField) {
  return (vis[f] ?? (PRIVATE_BY_DEFAULT.includes(f) ? "private" : "public")) === "public";
}
