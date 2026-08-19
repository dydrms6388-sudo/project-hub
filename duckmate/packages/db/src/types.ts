// =============================================================================
// 덕메이트(DuckMate) DB 타입 — supabase/migrations 00001~00005 와 1:1 정합 (D1 확정)
// 추후 `supabase gen types typescript` 산출물로 교체 가능하도록 Row 단위 수기 정의.
// 규약: 컬럼 추가/변경은 반드시 마이그레이션과 이 파일을 함께 갱신한다.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// enum 리터럴 유니온 (00001_extensions_and_types.sql)
// ---------------------------------------------------------------------------

/** smallint + CHECK(0~3). 0=가입, 1=휴대폰, 2=본인인증, 3=사진 검수 (A5 §1.1) */
export type VerifyLevel = 0 | 1 | 2 | 3;

export type ProfileStatus = "active" | "paused" | "banned";
export type ProfileMode = "friend" | "dating";
export type Gender = "m" | "f" | "n";
export type ProfileRole = "user" | "admin";

export type OnboardingStep =
  | "age"
  | "phone"
  | "hobbies"
  | "quiz"
  | "duckcard"
  | "photo"
  | "mode"
  | "done";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type LikeType = "like" | "super";
export type MatchStatus = "active" | "closed";

export type ReportStatus =
  | "RECEIVED"
  | "AUTO_TRIAGED"
  | "IN_REVIEW"
  | "ACTIONED"
  | "DISMISSED"
  | "NOTIFIED";

export type ReportPriority = "P0" | "P1" | "P2";

/** A5 §2 신고 사유 택소노미 18코드 (text + CHECK) */
export type ReasonCode =
  | "HARASS_SEXUAL"
  | "HARASS_SEXUAL_IMAGE"
  | "HARASS_VERBAL"
  | "HARASS_STALKING"
  | "HARASS_THREAT"
  | "SCAM_ROMANCE"
  | "SCAM_MONEY"
  | "SCAM_EXTERNAL_LINK"
  | "FAKE_PROFILE"
  | "FAKE_INFO"
  | "SPAM_AD"
  | "SPAM_PROSTITUTION"
  | "SAFETY_MINOR"
  | "SAFETY_OFFLINE"
  | "CONTENT_HATE"
  | "CONTENT_ILLEGAL"
  | "CONTENT_SELF_HARM"
  | "OTHER";

export const REASON_CODES: readonly ReasonCode[] = [
  "HARASS_SEXUAL",
  "HARASS_SEXUAL_IMAGE",
  "HARASS_VERBAL",
  "HARASS_STALKING",
  "HARASS_THREAT",
  "SCAM_ROMANCE",
  "SCAM_MONEY",
  "SCAM_EXTERNAL_LINK",
  "FAKE_PROFILE",
  "FAKE_INFO",
  "SPAM_AD",
  "SPAM_PROSTITUTION",
  "SAFETY_MINOR",
  "SAFETY_OFFLINE",
  "CONTENT_HATE",
  "CONTENT_ILLEGAL",
  "CONTENT_SELF_HARM",
  "OTHER",
] as const;

/** A5 §3.1: 1=경고, 2=기능제한 72h, 3=정지 7일, 4=정지 30일, 5=영구정지 */
export type SanctionLevel = 1 | 2 | 3 | 4 | 5;
export type SanctionStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type AppealStatus = "NONE" | "PENDING" | "ACCEPTED" | "REJECTED";

/** A5 §5.1 자동 탐지 룰 7종 */
export type ModerationRuleCode =
  | "PAT_CONTACT_EARLY"
  | "PAT_MONEY"
  | "PAT_INVEST"
  | "PAT_EXTERNAL_LINK"
  | "PAT_SEXUAL"
  | "PAT_OFFPLATFORM_PUSH"
  | "PAT_SCRIPT_DUP";

/** A5 §5.2 조치 5단계 */
export type ModerationAction = "LOG" | "MASK" | "WARN" | "QUEUE" | "BLOCK_SEND";

export type SubscriptionTier = "free" | "plus" | "pro";
export type SubscriptionStatus =
  | "none"
  | "active"
  | "cancel_scheduled"
  | "past_due"
  | "expired"
  | "refunded";

export type ItemType = "superlike" | "boost";
export type LedgerBucket = "purchase" | "grant_sub" | "grant_reward";

export type QuestKind = "daily" | "weekly";
export type TimeSlot = "morning" | "afternoon" | "evening" | "night";
export type PushPlatform = "web" | "ios" | "android";
export type RefundRequestStatus = "requested" | "approved" | "rejected" | "done";

/** A2 §4 궁합 퀴즈 5축 */
export type QuizCategory = "immersion" | "meeting" | "tempo" | "explore" | "intent";

export type GameType = "battle" | "quiz";

// ---------------------------------------------------------------------------
// Row 타입 (00002_core_tables.sql)
// timestamptz/date → string (ISO), uuid → string, bigint identity → number
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  user_id: string;
  nickname: string;
  /** M1 중재: birth_year 대신 birth_date (만 19세 판정). PASS 인증 후 D2 가 덮어씀 */
  birth_date: string;
  gender: Gender;
  region_code: string;
  bio: string | null;
  verify_level: VerifyLevel;
  status: ProfileStatus;
  mode: ProfileMode;
  role: ProfileRole;
  onboarding_step: OnboardingStep;
  fav_note: string | null;
  current_obsession: string | null;
  boost_active_until: string | null;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface Hobby {
  id: string;
  slug: string;
  name: string;
  category: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProfileHobby {
  profile_id: string;
  hobby_id: string;
  /** 1~3 = 덕질카드 Top3, null = Top3 아님 */
  rank: 1 | 2 | 3 | null;
  intensity: 1 | 2 | 3 | 4 | 5;
  fav_note: string | null;
  created_at: string;
}

export interface QuizOption {
  label: string;
  /** -1.0 | -0.33 | 0.33 | 1.0 */
  value: number;
}

export interface QuizQuestion {
  id: number;
  category: QuizCategory;
  text: string;
  options: QuizOption[];
  /** meeting·intent = 1.2, 그 외 1.0 */
  weight: number;
  sort_order: number;
  is_active: boolean;
}

export interface QuizAnswer {
  profile_id: string;
  question_id: number;
  /** options 배열 인덱스 0~3 */
  choice: 0 | 1 | 2 | 3;
  answered_at: string;
}

export interface Photo {
  id: string;
  profile_id: string;
  path: string;
  is_primary: boolean;
  review_status: ReviewStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Availability {
  profile_id: string;
  /** 0 = 일요일 */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  slot: TimeSlot;
}

export interface DailyRecommendation {
  id: string;
  profile_id: string;
  target_id: string;
  score: number;
  /** 궁합 근거 3줄 */
  reasons: Json;
  for_date: string;
  seen_at: string | null;
  created_at: string;
}

export interface Like {
  from_id: string;
  to_id: string;
  type: LikeType;
  created_at: string;
}

export interface Match {
  id: string;
  /** a_id < b_id 정규화. 탈퇴 시 set null (상대 화면 대화방 유지) */
  a_id: string | null;
  b_id: string | null;
  matched_at: string;
  /** 첫 대화 제안 카드 3개 — D3 가 매칭 직후 채움 */
  first_suggestion: Json | null;
  status: MatchStatus;
  closed_at: string | null;
}

/**
 * 클라이언트가 SELECT 할 수 있는 메시지 형태.
 * body/mask_rules 는 컬럼 권한으로 차단 — service role 전용 (A5).
 */
export interface Message {
  id: number;
  match_id: string;
  sender_id: string | null;
  masked_body: string;
  image_path: string | null;
  read_at: string | null;
  created_at: string;
}

/** service role 전용 전체 행 (Edge Function 용) */
export interface MessageFull extends Message {
  body: string;
  /** [{rule, start, end}] */
  mask_rules: Json;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  target_id: string | null;
  match_id: string | null;
  reason_code: ReasonCode;
  detail: string | null;
  /** A5 §4.2 스냅샷 — 어떤 클라이언트도 SELECT 불가 (service role 전용) */
  evidence: Json | null;
  status: ReportStatus;
  priority: ReportPriority | null;
  sla_due_at: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sanction {
  id: string;
  profile_id: string | null;
  level: SanctionLevel;
  reason: string;
  report_id: string | null;
  status: SanctionStatus;
  appeal_status: AppealStatus;
  starts_at: string;
  /** null = 영구 (level 5) */
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModerationFlag {
  id: number;
  match_id: string | null;
  message_id: number | null;
  profile_id: string | null;
  rule_code: ModerationRuleCode;
  action: ModerationAction;
  meta: Json;
  created_at: string;
}

export interface Appeal {
  id: string;
  sanction_id: string;
  profile_id: string | null;
  body: string;
  status: AppealStatus;
  decided_by: string | null;
  decided_at: string | null;
  decided_reason: string | null;
  created_at: string;
}

export interface BlockedHash {
  hash_type: "ci" | "phone";
  hash: string;
  reason: string | null;
  sanction_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  provider: string | null;
  provider_sub_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemLedgerEntry {
  id: number;
  user_id: string;
  item_type: ItemType;
  delta: number;
  balance_after: number;
  bucket: LedgerBucket;
  /** null = 무만료(구매분) */
  expires_at: string | null;
  /** 멱등키 — (user_id, ref) unique */
  ref: string;
  created_at: string;
}

/** item_balances 뷰 (만료분 제외 실잔액) */
export interface ItemBalance {
  user_id: string;
  item_type: ItemType;
  balance: number;
}

export interface GameProfile {
  profile_id: string;
  level: number;
  xp: number;
  streak_days: number;
  last_played_at: string | null;
  coins: number;
  updated_at: string;
}

export interface GameSession {
  id: string;
  game_type: GameType;
  /** profile_id 문자열 배열 */
  participants: string[];
  state: Json;
  result: Json | null;
  created_at: string;
  updated_at: string;
}

export interface Quest {
  id: string;
  key: string;
  title: string;
  kind: QuestKind;
  reward: Json;
  is_active: boolean;
  created_at: string;
}

export interface QuestProgress {
  profile_id: string;
  quest_id: string;
  progress: number;
  completed_at: string | null;
  for_date: string;
}

export interface Event {
  id: string;
  hobby_id: string | null;
  title: string;
  description: string | null;
  region: string;
  starts_at: string;
  capacity: number | null;
  /** 호스트는 Lv3 만 (RLS) */
  host_id: string | null;
  created_at: string;
}

export interface EventRsvp {
  event_id: string;
  profile_id: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  meta: Json;
  created_at: string;
}

/** 퍼널 이벤트 — name 은 A3 §4.1 스네이크케이스 고정 (임의 개명 금지) */
export interface AnalyticsEvent {
  id: number;
  profile_id: string | null;
  name: string;
  props: Json;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  platform: PushPlatform;
  token: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  created_at: string;
  handled_at: string | null;
}

export interface RefundRequest {
  id: string;
  user_id: string | null;
  payment_ref: string;
  reason: string | null;
  amount: number | null;
  status: RefundRequestStatus;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 본인 상태 조회 뷰 (00003 — reports/sanctions 는 본문 접근 불가, 뷰로만)
// ---------------------------------------------------------------------------

export interface MyReport {
  id: string;
  reason_code: ReasonCode;
  status: ReportStatus;
  created_at: string;
  handled_at: string | null;
}

export interface MySanction {
  id: string;
  level: SanctionLevel;
  reason: string;
  status: SanctionStatus;
  appeal_status: AppealStatus;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 티어 한도 상수 재수출 (A4 §2 — 단일 진실은 ./tier-limits)
// ---------------------------------------------------------------------------
export { TIER_LIMITS, ITEM_PRICES, TIER_PRICES } from "./tier-limits";
export type { TierLimits, Tier } from "./tier-limits";
