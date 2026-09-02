/**
 * @duckmate/db — Database 타입 (supabase gen types 형식을 손으로 작성)
 * 소스: supabase/migrations/2026090200000{1..14}_*.sql
 * 스키마 변경 시 이 파일과 constants.ts 의 enum 배열을 함께 갱신한다.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// Enums (Postgres 타입명 = 키, 값 문자열 = SQL 과 동일)
// ---------------------------------------------------------------------------
export type Enums = {
  profile_status: "active" | "paused" | "banned" | "age_blocked" | "deleting";
  profile_mode: "friend" | "dating";
  gender: "female" | "male" | "unspecified";
  seeking_gender: "any" | "female" | "male";
  onboarding_step: "basic" | "hobbies" | "quiz" | "card" | "photos" | "verify" | "done";
  availability_slot: "morning" | "afternoon" | "evening" | "night";
  review_status: "pending" | "approved" | "rejected" | "held";
  photo_reject_code:
    | "reject_no_face"
    | "reject_not_self"
    | "reject_nudity"
    | "reject_text_contact"
    | "reject_minor"
    | "reject_group"
    | "reject_quality";
  consent_key:
    | "age_19"
    | "terms"
    | "privacy"
    | "evidence_snapshot"
    | "marketing_push"
    | "dating_mode_public"
    | "auto_renew"
    | "digital_no_withdrawal"
    | "reconsent"
    | "youth_policy";
  consent_source: "onboarding" | "settings" | "checkout" | "banner" | "recheck";
  legal_doc_key: "terms" | "privacy" | "location" | "youth" | "business" | "refund" | "marketing";
  identity_provider: "mock" | "portone";
  identity_result: "success" | "failed" | "minor" | "duplicate_ci" | "blocked_ci";
  like_type: "like" | "super";
  reco_action: "like" | "super" | "pass";
  match_status: "active" | "blocked" | "left" | "paused";
  report_reason:
    | "SEXUAL_HARASSMENT"
    | "ROMANCE_SCAM"
    | "MINOR_SUSPECT"
    | "IMPERSONATION"
    | "OFF_PLATFORM_LURE"
    | "COMMERCIAL_SPAM"
    | "HATE_SPEECH"
    | "STALKING"
    | "PII_REQUEST"
    | "INAPPROPRIATE_PHOTO"
    | "THREAT_VIOLENCE"
    | "FAKE_PROFILE"
    | "NO_SHOW"
    | "OTHER";
  report_priority: "P0" | "P1" | "P2" | "P3";
  report_status: "queued" | "in_review" | "need_info" | "confirmed" | "dismissed";
  report_surface: "profile" | "chat" | "system";
  appeal_status: "pending" | "accepted" | "rejected";
  admin_role: "moderator" | "admin";
  inquiry_category:
    | "general"
    | "privacy_export"
    | "data_export"
    | "legal_request"
    | "report"
    | "hobby_request"
    | "refund";
  inquiry_status: "open" | "answered" | "closed";
  subscription_tier: "free" | "plus" | "pro";
  subscription_status: "active" | "past_due" | "canceled" | "expired" | "refunded";
  payment_provider: "toss" | "apple" | "google";
  payment_kind: "subscription" | "item";
  payment_status: "pending" | "paid" | "failed" | "canceled" | "partially_refunded" | "refunded";
  item_type: "superlike" | "boost" | "rewind_pack" | "card_refill";
  refund_reason: "change_of_mind" | "service_fault" | "duplicate_charge" | "minor" | "other";
  refund_status: "requested" | "approved" | "rejected" | "executed";
  quest_kind: "daily" | "weekly";
  game_type: "daily_card" | "taste_battle" | "fandom_quiz" | "match_reveal";
  game_session_result: "pending" | "completed" | "expired" | "canceled";
  event_status: "draft" | "open" | "closed" | "canceled" | "done";
  rsvp_status: "going" | "waitlist" | "canceled" | "no_show" | "attended";
  push_kind: "transactional" | "service" | "marketing";
  push_slot: "A" | "B" | "instant";
};

/** smallint 0~3 (domain verify_level) */
export type VerifyLevel = 0 | 1 | 2 | 3;
/** smallint 1~6 (domain sanction_level). 0 = 제재 없음(행 없음) */
export type SanctionLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type AgeBand = "20_early" | "20_mid" | "20_late" | "30_early" | "30_mid" | "30_late" | "40_plus";

// ---------------------------------------------------------------------------
// 헬퍼: Row → Insert / Update
// ---------------------------------------------------------------------------
type InsertOf<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
type TableDef<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: InsertOf<Row, Optional>;
  Update: Partial<Row>;
  Relationships: [];
};
type ViewDef<Row> = { Row: Row; Relationships: [] };

// ---------------------------------------------------------------------------
// Row 타입
// ---------------------------------------------------------------------------
export type AppSettingsRow = { key: string; value: Json; updated_at: string };

export type RegionRow = {
  code: string;
  sido_code: string;
  sido: string;
  sigungu: string;
  is_active: boolean;
  sort_order: number;
};

export type AdminUserRow = { user_id: string; role: Enums["admin_role"]; note: string | null; created_at: string };

export type ProfileRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  nickname_changed_at: string | null;
  /** 본인 + service role 만. 타인은 v_profile_public 에서 age_band/birth_year 만 */
  birth_date: string | null;
  birth_year: number | null;
  gender: Enums["gender"] | null;
  seeking_gender: Enums["seeking_gender"] | null;
  region_code: string | null;
  bio: string | null;
  now_into: string | null;
  verify_level: VerifyLevel;
  status: Enums["profile_status"];
  mode: Enums["profile_mode"];
  onboarding_step: Enums["onboarding_step"];
  onboarding_started_at: string;
  onboarding_completed_at: string | null;
  safety_modal_seen_at: string | null;
  last_active_at: string;
  paused_at: string | null;
  delete_requested_at: string | null;
  banned_at: string | null;
  age_blocked_at: string | null;
  phone_hash: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type HobbyCategoryRow = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  is_initial: boolean;
  sort_order: number;
  is_active: boolean;
};

export type HobbyRow = {
  id: number;
  slug: string;
  name: string;
  category_id: number;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
};

export type ProfileHobbyRow = {
  profile_id: string;
  hobby_id: number;
  rank: 1 | 2 | 3 | 4 | 5;
  intensity: 1 | 2 | 3 | 4 | 5;
  fav_note: string | null;
  created_at: string;
};

export type QuizOption = { value: number; label: string };
export type QuizQuestionRow = {
  id: number;
  key: string;
  category: string;
  text: string;
  options: Json;
  weight: number;
  sort_order: number;
  is_active: boolean;
};

export type QuizAnswerRow = { profile_id: string; question_id: number; choice: number; answered_at: string };

export type AvailabilityRow = { profile_id: string; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; slot: Enums["availability_slot"] };

export type PhotoRow = {
  id: string;
  profile_id: string;
  path: string;
  is_primary: boolean;
  sort_order: number;
  review_status: Enums["review_status"];
  reject_code: Enums["photo_reject_code"] | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  face_count: number | null;
  face_confidence: number | null;
  held_reason: string | null;
  /** photo-review Edge Function 자동 검사 결과(참고값, 자동 반려 없음) */
  auto_flags: Json;
  created_at: string;
  updated_at: string;
};

export type ConsentRow = {
  id: number;
  user_id: string | null;
  subject_hash: string | null;
  key: Enums["consent_key"];
  document_key: Enums["legal_doc_key"] | null;
  version: string;
  agreed: boolean;
  agreed_at: string;
  withdrawn_at: string | null;
  ip_hash: string | null;
  ua_hash: string | null;
  source: Enums["consent_source"];
};

export type LegalDocumentRow = {
  key: Enums["legal_doc_key"];
  version: string;
  effective_at: string;
  content_hash: string;
  requires_reconsent: boolean;
  published_at: string;
};

export type IdentityVerificationRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  provider: Enums["identity_provider"];
  result: Enums["identity_result"];
  ci_hash: string | null;
  di_hash: string | null;
  birth_date: string | null;
  gender: Enums["gender"] | null;
  birth_date_verified: boolean | null;
  verified_at: string | null;
  reverify_due_at: string | null;
  is_active: boolean;
  provider_tx_id: string | null;
  meta: Json;
  created_at: string;
};

export type BlockedCiHashRow = {
  ci_hash: string;
  reason: string;
  source_profile_id: string | null;
  created_at: string;
  expires_at: string | null;
};

export type DailyRecommendationRow = {
  id: string;
  profile_id: string;
  target_id: string;
  loop_date: string;
  position: number;
  score: number;
  reasons: Json;
  is_from_liker: boolean;
  is_boosted: boolean;
  seen_at: string | null;
  acted_at: string | null;
  action: Enums["reco_action"] | null;
  created_at: string;
};

export type LikeRow = { id: string; from_id: string; to_id: string; type: Enums["like_type"]; created_at: string };

export type FirstSuggestion = {
  id: string;
  template_id: string;
  title: string;
  body: string;
  kind: "online" | "offline" | "talk";
};

export type MatchRow = {
  id: string;
  a_id: string;
  b_id: string;
  mode: Enums["profile_mode"];
  matched_at: string;
  first_suggestion: Json;
  status: Enums["match_status"];
  ended_at: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlockRow = { blocker_id: string; blocked_id: string; created_at: string };

export type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  /** authenticated 는 컬럼 select 불가(v_messages 사용). service role 전용 */
  body: string | null;
  masked_body: string;
  image_path: string | null;
  suggestion_template_id: string | null;
  is_held: boolean;
  created_at: string;
  read_at: string | null;
};

export type MessageFlagRow = {
  id: number;
  message_id: string;
  rule_id: string;
  matched: string | null;
  score: number;
  created_at: string;
};

export type ReportRow = {
  id: string;
  reporter_id: string | null;
  target_id: string | null;
  reporter_ci_hash: string | null;
  target_ci_hash: string | null;
  match_id: string | null;
  surface: Enums["report_surface"];
  reason_code: Enums["report_reason"];
  detail: string | null;
  priority: Enums["report_priority"];
  due_at: string;
  legal_hold: boolean;
  evidence: Json;
  detector_hit_count: number;
  status: Enums["report_status"];
  handled_by: string | null;
  handled_at: string | null;
  resolution_note: string | null;
  auto_actions: Json;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SanctionRow = {
  id: string;
  profile_id: string | null;
  profile_ci_hash: string | null;
  level: SanctionLevel;
  reason: string;
  reason_code: Enums["report_reason"] | null;
  report_id: string | null;
  starts_at: string;
  ends_at: string | null;
  acknowledged_at: string | null;
  issued_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
};

export type AppealRow = {
  id: string;
  sanction_id: string;
  profile_id: string | null;
  body: string;
  attachment_path: string | null;
  status: Enums["appeal_status"];
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before: Json | null;
  after: Json | null;
  meta: Json;
  created_at: string;
};

export type InquiryRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  category: Enums["inquiry_category"];
  body: string;
  status: Enums["inquiry_status"];
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
};

export type SkuRow = {
  sku: string;
  kind: Enums["payment_kind"];
  tier: Enums["subscription_tier"] | null;
  item_type: Enums["item_type"] | null;
  item_qty: number | null;
  price_krw: number;
  display_terms: string | null;
  is_active: boolean;
  experiment_group: string | null;
  retired_at: string | null;
  created_at: string;
};

export type SkuPriceHistoryRow = { id: number; sku: string; price_krw: number; starts_at: string; ends_at: string | null };

export type SubscriptionRow = {
  id: string;
  user_id: string | null;
  tier: Exclude<Enums["subscription_tier"], "free">;
  provider: Enums["payment_provider"];
  provider_sub_id: string | null;
  sku: string | null;
  status: Enums["subscription_status"];
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  user_id: string | null;
  provider: Enums["payment_provider"];
  provider_payment_id: string;
  kind: Enums["payment_kind"];
  sku: string;
  subscription_id: string | null;
  amount_krw: number;
  status: Enums["payment_status"];
  paid_at: string | null;
  refunded_amount_krw: number;
  refunded_at: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemLedgerRow = {
  id: number;
  user_id: string | null;
  item_type: Enums["item_type"];
  delta: number;
  balance_after: number | null;
  ref: string;
  expires_at: string | null;
  created_at: string;
};

export type BoostRow = {
  id: string;
  user_id: string;
  ledger_id: number | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

export type RefundRequestRow = {
  id: string;
  payment_id: string;
  user_id: string | null;
  reason_code: Enums["refund_reason"];
  computed_deduction_krw: number;
  computed_refund_krw: number;
  formula_snapshot: Json;
  status: Enums["refund_status"];
  handled_by: string | null;
  handled_at: string | null;
  executed_at: string | null;
  created_at: string;
};

export type GameProfileRow = {
  profile_id: string;
  level: number;
  xp: number;
  streak_days: number;
  last_played_at: string | null;
  coins: number;
  updated_at: string;
};

export type GameSessionRow = {
  id: string;
  game_type: Enums["game_type"];
  loop_date: string;
  participants: Json;
  state: Json;
  result: Enums["game_session_result"];
  created_at: string;
  updated_at: string;
};

export type QuestRow = { id: number; key: string; title: string; kind: Enums["quest_kind"]; reward: Json; is_active: boolean };

export type QuestProgressRow = {
  profile_id: string;
  quest_id: number;
  loop_date: string;
  progress: number;
  completed_at: string | null;
};

export type EventRow = {
  id: string;
  hobby_id: number | null;
  title: string;
  description: string | null;
  region_code: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  host_id: string | null;
  status: Enums["event_status"];
  created_at: string;
  updated_at: string;
};

export type EventRsvpRow = { event_id: string; profile_id: string; status: Enums["rsvp_status"]; created_at: string };

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  keys: Json;
  user_agent: string | null;
  slot_a_enabled: boolean;
  slot_b_enabled: boolean;
  instant_enabled: boolean;
  created_at: string;
  last_sent_at: string | null;
  disabled_at: string | null;
};

export type NotificationLogRow = {
  id: number;
  user_id: string;
  subscription_id: string | null;
  kind: Enums["push_kind"];
  slot: Enums["push_slot"];
  template: string;
  loop_date: string;
  budget_consumed: boolean;
  like_id: string | null;
  payload_hash: string | null;
  sent_at: string;
  opened_at: string | null;
  error: string | null;
};

/** D2 레이트리밋 카운터 (service role 전용) */
export type RateLimitRow = { key: string; window_start: string; count: number; updated_at: string };

export type AnalyticsEventRow = {
  id: number;
  user_id_hash: string | null;
  name: string;
  props: Json;
  loop_date: string;
  session_id: string | null;
  platform: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// View Row 타입
// ---------------------------------------------------------------------------
export type ProfilePublicView = {
  id: string;
  nickname: string | null;
  birth_year: number | null;
  age_band: AgeBand | null;
  gender: Enums["gender"] | null;
  region_code: string | null;
  sido: string | null;
  sigungu: string | null;
  bio: string | null;
  now_into: string | null;
  verify_level: VerifyLevel;
  mode: Enums["profile_mode"];
  last_active_at: string;
  created_at: string;
};

export type MessageView = {
  id: string;
  match_id: string;
  sender_id: string;
  /** 발신자 본인일 때만 원문, 그 외 null */
  body: string | null;
  masked_body: string;
  /** 렌더용: 본인이면 원문, 상대면 masked_body */
  display_body: string;
  image_path: string | null;
  suggestion_template_id: string | null;
  is_held: boolean;
  created_at: string;
  read_at: string | null;
  is_mine: boolean;
};

export type MyMatchView = {
  match_id: string;
  status: Enums["match_status"];
  mode: Enums["profile_mode"];
  matched_at: string;
  first_message_at: string | null;
  last_message_at: string | null;
  ended_at: string | null;
  partner_id: string;
  partner_nickname: string | null;
  partner_verify_level: VerifyLevel;
  partner_status: Enums["profile_status"];
  unread_count: number;
  last_masked_body: string | null;
  /** matched_at + 72h 경과 AND 양쪽 L3 */
  contact_unmasked: boolean;
};

export type WeeklyQuotaUsedView = { profile_id: string | null; week_start: string; superlike_used: number };

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      app_settings: TableDef<AppSettingsRow, "updated_at">;
      regions: TableDef<RegionRow, "sido_code" | "is_active" | "sort_order">;
      admin_users: TableDef<AdminUserRow, "note" | "created_at">;
      profiles: TableDef<
        ProfileRow,
        | "id" | "nickname" | "nickname_changed_at" | "birth_date" | "birth_year" | "gender" | "seeking_gender"
        | "region_code" | "bio" | "now_into" | "verify_level" | "status" | "mode" | "onboarding_step"
        | "onboarding_started_at" | "onboarding_completed_at" | "safety_modal_seen_at" | "last_active_at"
        | "paused_at" | "delete_requested_at" | "banned_at" | "age_blocked_at" | "phone_hash" | "hidden_at"
        | "hidden_reason" | "created_at" | "updated_at"
      >;
      hobby_categories: TableDef<HobbyCategoryRow, "icon" | "is_initial" | "sort_order" | "is_active">;
      hobbies: TableDef<HobbyRow, "icon" | "is_active" | "sort_order">;
      profile_hobbies: TableDef<ProfileHobbyRow, "intensity" | "fav_note" | "created_at">;
      quiz_questions: TableDef<QuizQuestionRow, "weight" | "sort_order" | "is_active">;
      quiz_answers: TableDef<QuizAnswerRow, "answered_at">;
      availability: TableDef<AvailabilityRow, never>;
      photos: TableDef<
        PhotoRow,
        | "id" | "is_primary" | "sort_order" | "review_status" | "reject_code" | "reviewed_by" | "reviewed_at"
        | "face_count" | "face_confidence" | "held_reason" | "auto_flags" | "created_at" | "updated_at"
      >;
      consents: TableDef<
        ConsentRow,
        "id" | "user_id" | "subject_hash" | "document_key" | "agreed_at" | "withdrawn_at" | "ip_hash" | "ua_hash"
      >;
      legal_documents: TableDef<LegalDocumentRow, "requires_reconsent" | "published_at">;
      identity_verifications: TableDef<
        IdentityVerificationRow,
        | "id" | "user_id" | "profile_id" | "ci_hash" | "di_hash" | "birth_date" | "gender" | "birth_date_verified"
        | "verified_at" | "reverify_due_at" | "is_active" | "provider_tx_id" | "meta" | "created_at"
      >;
      blocked_ci_hashes: TableDef<BlockedCiHashRow, "source_profile_id" | "created_at" | "expires_at">;
      daily_recommendations: TableDef<
        DailyRecommendationRow,
        | "id" | "position" | "reasons" | "is_from_liker" | "is_boosted" | "seen_at" | "acted_at" | "action"
        | "created_at"
      >;
      likes: TableDef<LikeRow, "id" | "type" | "created_at">;
      matches: TableDef<
        MatchRow,
        | "id" | "matched_at" | "first_suggestion" | "status" | "ended_at" | "first_message_at" | "last_message_at"
        | "created_at" | "updated_at"
      >;
      blocks: TableDef<BlockRow, "created_at">;
      messages: TableDef<
        MessageRow,
        "id" | "body" | "image_path" | "suggestion_template_id" | "is_held" | "created_at" | "read_at"
      >;
      message_flags: TableDef<MessageFlagRow, "id" | "matched" | "score" | "created_at">;
      reports: TableDef<
        ReportRow,
        | "id" | "reporter_id" | "target_id" | "reporter_ci_hash" | "target_ci_hash" | "match_id" | "surface"
        | "detail" | "legal_hold" | "detector_hit_count" | "status" | "handled_by" | "handled_at"
        | "resolution_note" | "auto_actions" | "expires_at" | "created_at" | "updated_at"
      >;
      sanctions: TableDef<
        SanctionRow,
        | "id" | "profile_id" | "profile_ci_hash" | "reason_code" | "report_id" | "starts_at" | "ends_at"
        | "acknowledged_at" | "issued_by" | "revoked_at" | "revoked_by" | "created_at"
      >;
      appeals: TableDef<
        AppealRow,
        "id" | "profile_id" | "attachment_path" | "status" | "decision_note" | "decided_by" | "decided_at" | "created_at"
      >;
      audit_logs: TableDef<
        AuditLogRow,
        "id" | "actor_id" | "actor_role" | "target_type" | "target_id" | "before" | "after" | "meta" | "created_at"
      >;
      inquiries: TableDef<
        InquiryRow,
        "id" | "user_id" | "email" | "category" | "status" | "handled_by" | "handled_at" | "created_at"
      >;
      skus: TableDef<
        SkuRow,
        "tier" | "item_type" | "item_qty" | "display_terms" | "is_active" | "experiment_group" | "retired_at" | "created_at"
      >;
      sku_price_history: TableDef<SkuPriceHistoryRow, "id" | "starts_at" | "ends_at">;
      subscriptions: TableDef<
        SubscriptionRow,
        "id" | "user_id" | "provider_sub_id" | "sku" | "cancel_at" | "canceled_at" | "created_at" | "updated_at"
      >;
      payments: TableDef<
        PaymentRow,
        | "id" | "user_id" | "subscription_id" | "status" | "paid_at" | "refunded_amount_krw" | "refunded_at"
        | "receipt_url" | "created_at" | "updated_at"
      >;
      item_ledger: TableDef<ItemLedgerRow, "id" | "user_id" | "balance_after" | "expires_at" | "created_at">;
      boosts: TableDef<BoostRow, "id" | "ledger_id" | "starts_at" | "created_at">;
      refund_requests: TableDef<
        RefundRequestRow,
        | "id" | "user_id" | "computed_deduction_krw" | "computed_refund_krw" | "status" | "handled_by" | "handled_at"
        | "executed_at" | "created_at"
      >;
      game_profiles: TableDef<GameProfileRow, "level" | "xp" | "streak_days" | "last_played_at" | "coins" | "updated_at">;
      game_sessions: TableDef<GameSessionRow, "id" | "participants" | "state" | "result" | "created_at" | "updated_at">;
      quests: TableDef<QuestRow, "reward" | "is_active">;
      quest_progress: TableDef<QuestProgressRow, "progress" | "completed_at">;
      events: TableDef<
        EventRow,
        | "id" | "hobby_id" | "description" | "region_code" | "ends_at" | "capacity" | "host_id" | "status"
        | "created_at" | "updated_at"
      >;
      event_rsvps: TableDef<EventRsvpRow, "status" | "created_at">;
      push_subscriptions: TableDef<
        PushSubscriptionRow,
        | "id" | "user_agent" | "slot_a_enabled" | "slot_b_enabled" | "instant_enabled" | "created_at" | "last_sent_at"
        | "disabled_at"
      >;
      notification_log: TableDef<
        NotificationLogRow,
        | "id" | "subscription_id" | "budget_consumed" | "like_id" | "payload_hash" | "sent_at" | "opened_at" | "error"
      >;
      analytics_events: TableDef<
        AnalyticsEventRow,
        "id" | "user_id_hash" | "props" | "session_id" | "platform" | "created_at"
      >;
      rate_limits: TableDef<RateLimitRow, "count" | "updated_at">;
    };
    Views: {
      v_profile_public: ViewDef<ProfilePublicView>;
      v_messages: ViewDef<MessageView>;
      v_my_matches: ViewDef<MyMatchView>;
      v_weekly_quota_used: ViewDef<WeeklyQuotaUsedView>;
    };
    Functions: {
      loop_date: { Args: { p_at?: string }; Returns: string };
      week_start_loop_date: { Args: { p_at?: string }; Returns: string };
      age_years_kst: { Args: { p_birth: string; p_at?: string }; Returns: number };
      is_adult: { Args: { p_birth: string; p_at?: string }; Returns: boolean };
      current_profile_id: { Args: Record<string, never>; Returns: string | null };
      app_role: { Args: Record<string, never>; Returns: string | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_moderator: { Args: Record<string, never>; Returns: boolean };
      active_sanction_level: { Args: { p_profile_id: string }; Returns: number };
      are_blocked: { Args: { p_a: string; p_b: string }; Returns: boolean };
      match_id_of: { Args: { p_a: string; p_b: string }; Returns: string | null };
      is_matched: { Args: { p_a: string; p_b: string }; Returns: boolean };
      is_match_participant: { Args: { p_match_id: string; p_profile_id: string }; Returns: boolean };
      is_recommended_recently: { Args: { p_viewer: string; p_target: string }; Returns: boolean };
      can_view_profile: { Args: { p_viewer: string; p_target: string }; Returns: boolean };
      can_like: { Args: { p_from: string; p_to: string }; Returns: boolean };
      can_send_message: { Args: { p_match_id: string; p_sender: string }; Returns: boolean };
      can_send_chat_image: { Args: { p_match_id: string; p_sender: string }; Returns: boolean };
      /** service role 전용 */
      recompute_verify_level: { Args: { p_profile_id: string }; Returns: number };
      get_effective_tier: { Args: { p_user_id: string }; Returns: Enums["subscription_tier"] };
      weekly_superlike_used: { Args: { p_profile_id: string }; Returns: number };
      report_default_priority: { Args: { p_reason: Enums["report_reason"] }; Returns: Enums["report_priority"] };
      report_sla_interval: { Args: { p_priority: Enums["report_priority"] }; Returns: string };
      /** service role 전용 */
      issue_sanction: {
        Args: {
          p_profile_id: string;
          p_level: number;
          p_reason: string;
          p_duration?: string | null;
          p_report_id?: string | null;
          p_reason_code?: Enums["report_reason"] | null;
          p_issued_by?: string | null;
        };
        Returns: string;
      };
      apply_block: { Args: { p_blocked_id: string }; Returns: undefined };
      remove_block: { Args: { p_blocked_id: string }; Returns: undefined };
      create_report: {
        Args: {
          p_target_id: string;
          p_reason_code: Enums["report_reason"];
          p_detail?: string | null;
          p_match_id?: string | null;
          p_surface?: Enums["report_surface"];
          p_reporter_id?: string | null;
        };
        Returns: Json;
      };
      // ---- D2 (0014) ----
      /** 세션 사용자의 게이트 판정 필드. 프로필 없으면 profile_id=null, 세션 없으면 null */
      get_gate_state: { Args: Record<string, never>; Returns: Json };
      /** OTP 성공 후 생년월일 확정(update). {profile_id,status,age_blocked,onboarding_step,already_set?} */
      create_profile: { Args: { p_birth_date: string; p_phone_hash?: string | null }; Returns: Json };
      /** dating 은 L3 + seeking_gender 필수 → NOT_ENTITLED */
      set_mode: { Args: { p_mode: Enums["profile_mode"]; p_seeking_gender?: Enums["seeking_gender"] | null }; Returns: Json };
      request_delete: { Args: Record<string, never>; Returns: Json };
      cancel_delete: { Args: Record<string, never>; Returns: Json };
      pause_account: { Args: Record<string, never>; Returns: Json };
      resume_account: { Args: Record<string, never>; Returns: Json };
      /** service role 전용. {allowed,count,limit,retry_after_sec} */
      check_rate_limit: { Args: { p_key: string; p_limit: number; p_window: string }; Returns: Json };
      /** service role 전용. code: OK | FAILED | BLOCKED_CI | MINOR | DUPLICATE_CI */
      apply_identity_verification: {
        Args: {
          p_user_id: string;
          p_provider: Enums["identity_provider"];
          p_result: Enums["identity_result"];
          p_ci_hash?: string | null;
          p_di_hash?: string | null;
          p_birth_date?: string | null;
          p_gender?: Enums["gender"] | null;
          p_provider_tx_id?: string | null;
          p_meta?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Enums;
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// 편의 타입 (supabase gen types 의 Tables<>/Enums<> 헬퍼와 동일 용법)
// ---------------------------------------------------------------------------
export type PublicSchema = Database["public"];
export type TableName = keyof PublicSchema["Tables"];
export type ViewName = keyof PublicSchema["Views"];
export type Tables<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends ViewName> = PublicSchema["Views"][T]["Row"];
export type EnumOf<T extends keyof Enums> = Enums[T];

/** create_report RPC 반환값 */
export type CreateReportResult = {
  report_id: string;
  deduped: boolean;
  priority: Enums["report_priority"];
  auto_actions?: string[];
};

/** reports.evidence (A5 §5.1, schema 1) */
export type ReportEvidence = {
  schema: 1;
  captured_at: string;
  match_id: string | null;
  messages: Array<
    Pick<MessageRow, "id" | "sender_id" | "body" | "masked_body" | "image_path" | "is_held" | "created_at" | "read_at">
  >;
  reporter: { profile_id: string; nickname: string | null; verify_level: VerifyLevel; mode: Enums["profile_mode"]; created_at: string } | null;
  target: {
    profile_id: string;
    nickname: string | null;
    birth_year: number | null;
    gender: Enums["gender"] | null;
    region_code: string | null;
    bio: string | null;
    now_into: string | null;
    verify_level: VerifyLevel;
    mode: Enums["profile_mode"];
    status: Enums["profile_status"];
    created_at: string;
    hobbies: Array<{ hobby: string; rank: number; intensity: number; fav_note: string | null }>;
  };
  target_photos: Array<{ photo_id: string; path: string; evidence_path: string; review_status: Enums["review_status"]; is_primary: boolean }>;
  relation: { like_from_target_at: string | null; like_from_reporter_at: string | null; matched_at: string | null; blocked: boolean };
  detector_hits: Array<{ rule_id: string; message_id: string; matched: string | null; score: number }>;
  prior_reports_count: number;
  prior_sanctions: Array<{ level: SanctionLevel; reason: string; starts_at: string; ends_at: string | null }>;
};
