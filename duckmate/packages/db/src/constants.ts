/**
 * @duckmate/db — 도메인 상수 (PRD/A5/B1 의 수치·enum 을 그대로 옮김)
 * SQL enum 과 1:1. 변경은 마이그레이션 + 문서를 먼저 고친다.
 */
import type { Enums, SanctionLevel, VerifyLevel } from "./types";

// ---------------------------------------------------------------------------
// 시간 축
// ---------------------------------------------------------------------------
/** 일일 리셋 = 07:00 KST (loop_date 경계). 자정 리셋 아님 */
export const RESET_HOUR_KST = 7;
/** 주간 리셋 = 월요일 07:00 KST (ISO weekday 1) */
export const WEEK_RESET_WEEKDAY = 1;
export const KST_OFFSET_MINUTES = 9 * 60;

/** SQL loop_date() 와 동일한 계산 (KST 07:00 이 하루의 시작) → 'YYYY-MM-DD' */
export function loopDate(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + KST_OFFSET_MINUTES * 60_000 - RESET_HOUR_KST * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 인증 레벨 (A5 §1)
// ---------------------------------------------------------------------------
export const VERIFY_LEVELS: Readonly<Record<VerifyLevel, { key: string; label: string; description: string }>> = {
  0: { key: "signup", label: "가입", description: "과도 상태(age_blocked 등). Phase 1 은 OTP 즉시 L1" },
  1: { key: "phone", label: "휴대폰 확인", description: "휴대폰 OTP 완료. 온보딩·자기 프로필 편집만" },
  2: { key: "identity", label: "본인인증", description: "추천·좋아요·매칭·채팅·취미 친구 모드" },
  3: { key: "photo", label: "사진인증", description: "L2 + 승인 대표 사진 1장. 데이팅 모드·채팅 이미지" },
};
export const MIN_LEVEL_FOR_FEED: VerifyLevel = 2;
export const MIN_LEVEL_FOR_DATING: VerifyLevel = 3;
export const MIN_LEVEL_FOR_CHAT_IMAGE: VerifyLevel = 3;
export const ADULT_AGE = 19;

// ---------------------------------------------------------------------------
// 온보딩 단계 (C3 §0-9) — 값은 "다음에 보여줄 화면"
// ---------------------------------------------------------------------------
export const ONBOARDING_STEPS = ["basic", "hobbies", "quiz", "card", "photos", "verify", "done"] as const satisfies ReadonlyArray<
  Enums["onboarding_step"]
>;
export const ONBOARDING_STEP_ROUTES: Readonly<Record<Enums["onboarding_step"], string>> = {
  basic: "/onboarding/basic",
  hobbies: "/onboarding/hobbies",
  quiz: "/onboarding/quiz",
  card: "/onboarding/card",
  photos: "/onboarding/photos",
  verify: "/verify",
  done: "/home",
};

// ---------------------------------------------------------------------------
// 프로필 제약
// ---------------------------------------------------------------------------
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 10;
export const NICKNAME_CHANGE_INTERVAL_DAYS = 30;
export const BIO_MAX = 200;
export const NOW_INTO_MAX = 40;
export const FAV_NOTE_MAX = 30;
export const HOBBY_MIN = 3;
export const HOBBY_MAX = 5;
export const HOBBY_TOP_RANKS = 3;
export const PHOTO_MAX = 6;
export const QUIZ_QUESTION_COUNT = 10;
export const QUIZ_MIN_FOR_SCORE = 3;
export const AVAILABILITY_SLOTS = ["morning", "afternoon", "evening", "night"] as const satisfies ReadonlyArray<
  Enums["availability_slot"]
>;
export const INTENSITY_LABELS: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: "관심 있음",
  2: "가끔",
  3: "주 1회",
  4: "거의 매일",
  5: "이게 인생",
};

// ---------------------------------------------------------------------------
// 취미 대분류 12 (A1 §4.2 Top 8 = isInitial). 세부 60 은 DB 시드(hobbies)가 소스
// ---------------------------------------------------------------------------
export const HOBBY_CATEGORIES = [
  { id: 1, slug: "performance", name: "공연·페스티벌·아이돌", icon: "🎤", isInitial: true },
  { id: 2, slug: "boardgame", name: "보드게임·TRPG", icon: "🎲", isInitial: true },
  { id: 3, slug: "fitness", name: "러닝·클라이밍·헬스", icon: "🏃", isInitial: true },
  { id: 4, slug: "anime", name: "애니·웹툰·서브컬처", icon: "📺", isInitial: true },
  { id: 5, slug: "gaming", name: "게임", icon: "🎮", isInitial: true },
  { id: 6, slug: "cafe", name: "카페투어·디저트·베이킹", icon: "☕", isInitial: true },
  { id: 7, slug: "reading", name: "독서·북클럽·글쓰기", icon: "📚", isInitial: true },
  { id: 8, slug: "photo", name: "사진·전시·영화", icon: "📷", isInitial: true },
  { id: 9, slug: "coding", name: "코딩·메이킹·디자인", icon: "💻", isInitial: false },
  { id: 10, slug: "travel", name: "여행·산책·캠핑", icon: "🧳", isInitial: false },
  { id: 11, slug: "music", name: "음악·악기·댄스", icon: "🎵", isInitial: false },
  { id: 12, slug: "pets", name: "반려동물·식물", icon: "🐾", isInitial: false },
] as const;
export type HobbyCategorySlug = (typeof HOBBY_CATEGORIES)[number]["slug"];
export const HOBBY_CATEGORY_CAP = 12;
export const HOBBY_CAP = 60;

// ---------------------------------------------------------------------------
// 지역 코드 규칙 (B1 §2) — 행정표준코드 앞 5자리, GPS/IP 미수집
// ---------------------------------------------------------------------------
export const REGION = {
  /** 시도(2) + 시군구(3) */
  pattern: /^[0-9]{5}$/,
  sidoCodeOf: (code: string): string => code.slice(0, 2),
  /** 시도 단위 폴백 행(세부 미등록): 'XX000' */
  isSidoFallback: (code: string): boolean => code.endsWith("000"),
  /** 수도권 = 서울(11) 인천(28) 경기(41) — 런칭 리전 */
  capitalAreaSido: ["11", "28", "41"] as const,
  /** 리전 풀 < 300 이면 전국 폴백(D3) */
  poolFallbackThreshold: 300,
} as const;

// ---------------------------------------------------------------------------
// 신고 사유 14 (A5 §3) — 라벨·보조문구·기본 심각도·자동 조치
// ---------------------------------------------------------------------------
export type ReportReasonMeta = {
  code: Enums["report_reason"];
  label: string;
  description: string;
  priority: Enums["report_priority"];
  /** 첫 확정 시 기본 제재 레벨(null = 수동 판단) */
  defaultSanction: SanctionLevel | null;
  autoAction: string | null;
  category: "safety" | "sexual_hate" | "profile" | "lure_commercial" | "other";
};

export const REPORT_REASONS: ReadonlyArray<ReportReasonMeta> = [
  { code: "ROMANCE_SCAM", label: "사기·로맨스 스캠", description: "금전 요구, 투자 권유, 급한 사정 호소, 송금 유도", priority: "P0", defaultSanction: 6, autoAction: "채팅 제한 24h + 경고 배너", category: "safety" },
  { code: "THREAT_VIOLENCE", label: "협박·폭력", description: "위해 협박, 자해 유도, 폭력 예고", priority: "P0", defaultSanction: 5, autoAction: "채팅 제한 24h", category: "safety" },
  { code: "STALKING", label: "스토킹·집착", description: "반복 연락, 매칭 종료 후 재접근, 위치 추궁", priority: "P0", defaultSanction: 4, autoAction: "신고자↔피신고자 자동 차단", category: "safety" },
  { code: "MINOR_SUSPECT", label: "미성년 의심", description: "학생 신분·나이 언급 등 미성년으로 보이는 정황", priority: "P0", defaultSanction: 6, autoAction: "프로필 비공개 + 재인증 요구", category: "safety" },
  { code: "SEXUAL_HARASSMENT", label: "성희롱·성적 발언", description: "원치 않는 성적 메시지, 신체 언급, 성적 사진 요구", priority: "P1", defaultSanction: 3, autoAction: "채팅 제한 24h(신고 2건 누적)", category: "sexual_hate" },
  { code: "HATE_SPEECH", label: "혐오·차별 발언", description: "성별·지역·장애·인종·성적지향 비하", priority: "P1", defaultSanction: 2, autoAction: null, category: "sexual_hate" },
  { code: "INAPPROPRIATE_PHOTO", label: "부적절한 사진", description: "노출, 불법촬영물, 폭력적 이미지", priority: "P0", defaultSanction: 3, autoAction: "이미지 held + 채팅 제한 24h", category: "sexual_hate" },
  { code: "IMPERSONATION", label: "사칭·타인 사진", description: "연예인/타인 사진, 다른 사람 행세", priority: "P1", defaultSanction: 3, autoAction: "해당 사진 held", category: "profile" },
  { code: "FAKE_PROFILE", label: "허위 프로필", description: "나이·성별·취미 등 명백한 거짓", priority: "P2", defaultSanction: 1, autoAction: null, category: "profile" },
  { code: "OFF_PLATFORM_LURE", label: "외부 연락 유도", description: "카톡/인스타/텔레그램/링크로 이동 유도", priority: "P2", defaultSanction: 1, autoAction: "3회 누적 시 경고", category: "lure_commercial" },
  { code: "COMMERCIAL_SPAM", label: "영업·광고", description: "상품 판매, 업소 홍보, 다단계", priority: "P1", defaultSanction: 3, autoAction: "채팅 제한 24h(2건 누적)", category: "lure_commercial" },
  { code: "PII_REQUEST", label: "개인정보 요구", description: "주소·직장·실명·신분증·계좌 요구", priority: "P1", defaultSanction: 1, autoAction: null, category: "lure_commercial" },
  { code: "NO_SHOW", label: "노쇼·약속 불이행", description: "이벤트/만남 약속 무단 불참", priority: "P3", defaultSanction: 1, autoAction: "3회 누적 시 이벤트 참가 제한 30일", category: "other" },
  { code: "OTHER", label: "기타", description: "위 항목에 없는 문제(자유 서술 필수)", priority: "P3", defaultSanction: null, autoAction: null, category: "other" },
];
export const REPORT_REASON_CODES = REPORT_REASONS.map((r) => r.code) as ReadonlyArray<Enums["report_reason"]>;
export const REPORT_DETAIL_MAX = 500;
export const REPORT_DEDUPE_HOURS = 24;
export const REPORT_EVIDENCE_MESSAGE_COUNT = 50;

/** SLA: 접수 → 최초 판정 (A5 §6) */
export const REPORT_SLA_HOURS: Readonly<Record<Enums["report_priority"], number>> = { P0: 1, P1: 6, P2: 24, P3: 72 };

/** 증거 보존 (A5 §5.2) */
export const EVIDENCE_RETENTION_DAYS = { dismissed: 90, confirmed: 180, permanentBan: 365 * 5, legalHoldRelease: 90 } as const;

// ---------------------------------------------------------------------------
// 제재 레벨 (A5 §4.1)
// ---------------------------------------------------------------------------
export const SANCTION_LEVELS: Readonly<
  Record<SanctionLevel, { key: string; label: string; durationHours: number | null; auto: boolean; approver: "system" | "moderator" | "admin" }>
> = {
  1: { key: "warning", label: "경고", durationHours: 0, auto: true, approver: "system" },
  2: { key: "chat_restricted", label: "채팅 제한 24시간", durationHours: 24, auto: true, approver: "system" },
  3: { key: "suspended_3d", label: "임시정지 3일", durationHours: 72, auto: false, approver: "moderator" },
  4: { key: "suspended_7d", label: "임시정지 7일", durationHours: 168, auto: false, approver: "admin" },
  5: { key: "suspended_30d", label: "임시정지 30일", durationHours: 720, auto: false, approver: "admin" },
  6: { key: "permanent", label: "영구정지", durationHours: null, auto: false, approver: "admin" },
};
export const MAX_AUTO_SANCTION_LEVEL: SanctionLevel = 2;
export const MODERATOR_MAX_SANCTION_LEVEL: SanctionLevel = 3;
export const APPEAL_WINDOW_DAYS = 7;
export const APPEAL_DECISION_HOURS = 72;
export const AUTO_SANCTION_PREFIX = "AUTO:";

// ---------------------------------------------------------------------------
// 채팅 규칙 (A5 §7 / PRD §0-7·8)
// ---------------------------------------------------------------------------
export const CONTACT_UNMASK_HOURS = 72;
export const CHAT_IMAGE_MIN_HOURS = 24;
export const CONTACT_RULE_HITS_BEFORE_AUTO_REPORT = 3;
export const SCAM_SCORE_BANNER = 5;
export const SCAM_SCORE_RESTRICT = 8;
export const MESSAGE_RATE_PER_MIN = 30;

// ---------------------------------------------------------------------------
// 추천/재노출 (A3 §6)
// ---------------------------------------------------------------------------
export const REEXPOSE_AFTER_PASS_DAYS = 30;
export const REEXPOSE_AFTER_SEEN_ONLY_DAYS = 7;
export const REEXPOSE_AFTER_UNBLOCK_DAYS = 30;
export const NEW_USER_BOOST_HOURS = 72;
export const INACTIVE_EXCLUDE_DAYS = 14;

// ---------------------------------------------------------------------------
// 푸시 (A3 §7, B1 §0-24)
// ---------------------------------------------------------------------------
export const PUSH_DAILY_BUDGET = 2;
export const PUSH_SLOT_A_KST = "07:30";
export const PUSH_SLOT_B_WINDOW_KST = ["19:30", "21:00"] as const;
export const PUSH_QUIET_HOURS_KST = ["23:00", "07:00"] as const;
export const MARKETING_PUSH_WINDOW_KST = ["08:00", "21:00"] as const;
export const MARKETING_CONSENT_RECHECK_DAYS = 730;

// ---------------------------------------------------------------------------
// 보존/삭제 (A5 §11.1, B1 §14)
// ---------------------------------------------------------------------------
export const RETENTION_DAYS = {
  deleteGraceDays: 7,
  ageBlockedDays: 30,
  phoneHashDays: 30,
  messagesAfterMatchEndDays: 90,
  matchLeftDays: 90,
  identityVerificationsYears: 1,
  identityVerificationsBannedYears: 5,
  auditLogsYears: 2,
  inquiriesYears: 3,
  consentsPseudonymizedYears: 5,
  paymentsYears: 5,
  analyticsYears: 2,
  accessLogDays: 90,
  skuPriceHistoryMonths: 6,
} as const;

// ---------------------------------------------------------------------------
// 동의 항목 (B1 §13)
// ---------------------------------------------------------------------------
export const CONSENT_KEYS = [
  "age_19",
  "terms",
  "privacy",
  "evidence_snapshot",
  "marketing_push",
  "dating_mode_public",
  "auto_renew",
  "digital_no_withdrawal",
  "reconsent",
] as const satisfies ReadonlyArray<Enums["consent_key"]>;
export const REQUIRED_ONBOARDING_CONSENTS = ["age_19", "terms", "privacy", "evidence_snapshot"] as const satisfies ReadonlyArray<
  Enums["consent_key"]
>;
export const LEGAL_DOC_KEYS = ["terms", "privacy", "location", "youth", "business", "refund"] as const satisfies ReadonlyArray<
  Enums["legal_doc_key"]
>;

// ---------------------------------------------------------------------------
// enum 값 배열 (클라이언트 select/validation 용, SQL enum 순서 동일)
// ---------------------------------------------------------------------------
export const PROFILE_STATUSES = ["active", "paused", "banned", "age_blocked", "deleting"] as const satisfies ReadonlyArray<Enums["profile_status"]>;
export const PROFILE_MODES = ["friend", "dating"] as const satisfies ReadonlyArray<Enums["profile_mode"]>;
export const GENDERS = ["female", "male", "unspecified"] as const satisfies ReadonlyArray<Enums["gender"]>;
export const SEEKING_GENDERS = ["any", "female", "male"] as const satisfies ReadonlyArray<Enums["seeking_gender"]>;
export const REVIEW_STATUSES = ["pending", "approved", "rejected", "held"] as const satisfies ReadonlyArray<Enums["review_status"]>;
export const PHOTO_REJECT_CODES = [
  "reject_no_face",
  "reject_not_self",
  "reject_nudity",
  "reject_text_contact",
  "reject_minor",
  "reject_group",
  "reject_quality",
] as const satisfies ReadonlyArray<Enums["photo_reject_code"]>;
export const PHOTO_REJECT_MESSAGES: Readonly<Record<Enums["photo_reject_code"], string>> = {
  reject_no_face: "대표 사진은 얼굴이 잘 보이는 본인 사진이어야 해요",
  reject_not_self: "본인 사진만 올릴 수 있어요",
  reject_nudity: "노출이 있는 사진은 올릴 수 없어요",
  reject_text_contact: "연락처·SNS·링크가 보이는 사진은 올릴 수 없어요",
  reject_minor: "확인이 필요한 사진이에요. 본인인증 후 다시 올려 주세요",
  reject_group: "대표 사진은 본인이 누구인지 알 수 있어야 해요",
  reject_quality: "화질이 낮거나 필터가 강한 사진은 올릴 수 없어요",
};
export const MATCH_STATUSES = ["active", "blocked", "left", "paused"] as const satisfies ReadonlyArray<Enums["match_status"]>;
export const REPORT_STATUSES = ["queued", "in_review", "need_info", "confirmed", "dismissed"] as const satisfies ReadonlyArray<Enums["report_status"]>;
export const SUBSCRIPTION_TIERS = ["free", "plus", "pro"] as const satisfies ReadonlyArray<Enums["subscription_tier"]>;
export const ITEM_TYPES = ["superlike", "boost", "rewind_pack", "card_refill"] as const satisfies ReadonlyArray<Enums["item_type"]>;
export const SKU_IDS = ["plus_monthly", "pro_monthly", "superlike_5", "boost_1h", "rewind_3", "card_refill_3"] as const;

// ---------------------------------------------------------------------------
// Storage 버킷/경로 규칙 (0012)
// ---------------------------------------------------------------------------
export const STORAGE_BUCKETS = { photos: "photos", chatImages: "chat-images", evidence: "evidence" } as const;
export const storagePaths = {
  /** photos 버킷: {profile_id}/{photo_id}.webp */
  photo: (profileId: string, photoId: string): string => `${profileId}/${photoId}.webp`,
  /** chat-images 버킷: {match_id}/{message_id}.webp */
  chatImage: (matchId: string, messageId: string): string => `${matchId}/${messageId}.webp`,
  /** evidence 버킷: {report_id}/{photo_id}.webp (service role 전용) */
  evidencePhoto: (reportId: string, photoId: string): string => `${reportId}/${photoId}.webp`,
} as const;

// ---------------------------------------------------------------------------
// 서버 에러 코드 (C3 §0-21) — RPC 가 raise 하는 메시지 접두어와 동일
// ---------------------------------------------------------------------------
export const ERROR_CODES = ["NOT_VERIFIED", "NOT_ENTITLED", "SANCTIONED", "ALREADY_ACTED", "RATE_LIMITED", "NOT_AUTHENTICATED"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
