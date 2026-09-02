/**
 * 내 데이터 다운로드 JSON 스키마 (07_legal §0-21 · A5 §11.2 항목표). 순수 함수 — 서버 액션이 raw 를 모아 넘기고, 테스트가 스키마를 고정한다.
 * 포함: 프로필·취미·퀴즈·시간대·사진 목록·내가 보낸 좋아요·매칭(상대는 닉네임만)·내가 보낸 메시지 원문·내가 낸 신고(상대 정보 제외)·내 제재·결제/구독·이벤트·게임·동의 이력.
 * 제외: 타인 메시지·사진, 추천 점수 내부값, 탐지 룰 hit, 타인이 낸 신고, 전화 해시·CI 해시.
 */
import type { Enums } from "@duckmate/db";

export const DATA_EXPORT_SCHEMA_VERSION = 1 as const;

export type RawExport = {
  profile: {
    id: string;
    nickname: string | null;
    birth_date: string | null;
    gender: Enums["gender"] | null;
    region_code: string | null;
    bio: string | null;
    now_into: string | null;
    verify_level: number;
    mode: Enums["profile_mode"];
    seeking_gender: Enums["seeking_gender"] | null;
    status: Enums["profile_status"];
    created_at: string;
    last_active_at: string;
  };
  hobbies: Array<{ hobby_id: number; name: string | null; rank: number; intensity: number; fav_note: string | null }>;
  quiz_answers: Array<{ question_id: number; choice: number; answered_at: string }>;
  availability: Array<{ weekday: number; slot: Enums["availability_slot"] }>;
  photos: Array<{ id: string; path: string; is_primary: boolean; review_status: Enums["review_status"]; reject_code: Enums["photo_reject_code"] | null; created_at: string }>;
  likes_sent: Array<{ id: string; type: Enums["like_type"]; created_at: string }>;
  matches: Array<{ match_id: string; mode: Enums["profile_mode"]; status: Enums["match_status"]; matched_at: string; ended_at: string | null; partner_nickname: string | null }>;
  messages_sent: Array<{ match_id: string; body: string; image_attached: boolean; created_at: string }>;
  reports_submitted: Array<{ id: string; reason_code: Enums["report_reason"]; surface: Enums["report_surface"]; detail: string | null; status: Enums["report_status"]; created_at: string; handled_at: string | null }>;
  sanctions: Array<{ id: string; level: number; reason_code: Enums["report_reason"] | null; is_auto: boolean; starts_at: string; ends_at: string | null; revoked_at: string | null }>;
  appeals: Array<{ id: string; sanction_id: string; status: Enums["appeal_status"]; created_at: string; decided_at: string | null; decision_note: string | null }>;
  subscriptions: Array<{ id: string; tier: string; provider: string; status: string; current_period_start: string; current_period_end: string; canceled_at: string | null }>;
  payments: Array<{ id: string; provider: string; kind: string; sku: string; amount_krw: number; status: string; paid_at: string | null; refunded_amount_krw: number; refunded_at: string | null }>;
  event_rsvps: Array<{ event_id: string; status: Enums["rsvp_status"]; created_at: string }>;
  game_profile: { level: number; xp: number; streak_days: number; coins: number; last_played_at: string | null } | null;
  quest_progress: Array<{ quest_id: number; loop_date: string; progress: number; completed_at: string | null }>;
  consents: Array<{ key: Enums["consent_key"]; document_key: Enums["legal_doc_key"] | null; version: string; agreed: boolean; agreed_at: string; withdrawn_at: string | null; source: Enums["consent_source"] }>;
  /** 조회에 실패한 섹션(권한·테이블 부재). 사용자에게 "일부 항목은 문의로" 안내 */
  partial: string[];
};

export type DataExport = {
  schema_version: typeof DATA_EXPORT_SCHEMA_VERSION;
  exported_at: string;
  service: string;
  subject: { profile_id: string };
  profile: RawExport["profile"];
  hobbies: RawExport["hobbies"];
  quiz_answers: RawExport["quiz_answers"];
  availability: RawExport["availability"];
  photos: RawExport["photos"];
  likes_sent: RawExport["likes_sent"];
  matches: RawExport["matches"];
  messages_sent: RawExport["messages_sent"];
  reports_submitted: RawExport["reports_submitted"];
  sanctions: RawExport["sanctions"];
  appeals: RawExport["appeals"];
  subscriptions: RawExport["subscriptions"];
  payments: RawExport["payments"];
  event_rsvps: RawExport["event_rsvps"];
  game_profile: RawExport["game_profile"];
  quest_progress: RawExport["quest_progress"];
  consents: RawExport["consents"];
  excluded: readonly string[];
  partial: string[];
};

export const DATA_EXPORT_EXCLUDED = [
  "상대방의 메시지·사진",
  "추천 점수·매칭 알고리즘 내부값",
  "탐지 룰 hit 상세",
  "다른 사람이 제출한 신고",
  "전화번호·본인인증 해시",
] as const;

export const DATA_EXPORT_SECTIONS = [
  "profile",
  "hobbies",
  "quiz_answers",
  "availability",
  "photos",
  "likes_sent",
  "matches",
  "messages_sent",
  "reports_submitted",
  "sanctions",
  "appeals",
  "subscriptions",
  "payments",
  "event_rsvps",
  "game_profile",
  "quest_progress",
  "consents",
] as const satisfies ReadonlyArray<keyof RawExport>;

export function buildExport(raw: RawExport, serviceName: string, now: Date = new Date()): DataExport {
  return {
    schema_version: DATA_EXPORT_SCHEMA_VERSION,
    exported_at: now.toISOString(),
    service: serviceName,
    subject: { profile_id: raw.profile.id },
    profile: raw.profile,
    hobbies: raw.hobbies,
    quiz_answers: raw.quiz_answers,
    availability: raw.availability,
    photos: raw.photos,
    likes_sent: raw.likes_sent,
    matches: raw.matches,
    messages_sent: raw.messages_sent,
    reports_submitted: raw.reports_submitted,
    sanctions: raw.sanctions,
    appeals: raw.appeals,
    subscriptions: raw.subscriptions,
    payments: raw.payments,
    event_rsvps: raw.event_rsvps,
    game_profile: raw.game_profile,
    quest_progress: raw.quest_progress,
    consents: raw.consents,
    excluded: DATA_EXPORT_EXCLUDED,
    partial: raw.partial,
  };
}

/** 다운로드 파일명: duckmate-data-YYYYMMDD.json (서비스명 리터럴 대신 slug 고정) */
export function exportFileName(now: Date = new Date()): string {
  const ymd = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `my-data-${ymd}.json`;
}
