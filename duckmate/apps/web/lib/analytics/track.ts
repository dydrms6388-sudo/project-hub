/**
 * 분석 이벤트 발화 헬퍼 (E1 소유, E2~E5 공용) — 12_flows §10 · PRD §0-51 · A3 §8 이름 그대로.
 *
 *   import { track } from "@/lib/analytics/track";
 *   track("onboarding_step_completed", { step: "basic", duration_ms: 1200 });
 *
 * Phase 1 어댑터 = no-op 성격:
 *   - 브라우저: `window.dataLayer.push({ event, ...props, ...common })` + (개발 환경) `console.debug`.
 *   - 서버(SSR/액션)에서 호출되면 아무것도 하지 않는다(서버 생성 이벤트는 D 그룹이 DB 에 남긴다).
 * 규칙(12_flows §10): 원문 메시지·닉네임·전화번호·사진 경로·생년월일을 props 에 넣지 않는다.
 * 공통 속성(session_id·source·push_slot)은 이 파일이 자동 부착한다 — `analytics` Zustand 슬라이스 대체(sessionStorage).
 *
 * 이 파일은 "use client" 지시어가 없지만 클라이언트·서버 어디서든 import 가능(런타임 분기).
 */

/** A2 의 `onb_*` 이름은 PRD §0-51 에 따라 아래 `onboarding_*` 로 매핑한다. */
export type AnalyticsEvent =
  // 온보딩 (E1)
  | "onboarding_step_completed"
  | "onboarding_step_skipped"
  | "onboarding_completed"
  | "verify_gate_viewed"
  | "verify_succeeded"
  | "verify_failed"
  // 홈·추천 (E2)
  | "app_opened"
  | "push_permission_prompted"
  | "push_permission_granted"
  | "daily_reco_opened"
  | "reco_card_seen"
  | "reco_card_flipped"
  | "like_sent"
  | "pass_sent"
  | "daily_reco_exhausted"
  | "daily_loop_completed"
  | "match_screen_viewed"
  | "suggestion_shown"
  | "suggestion_selected"
  | "suggestion_skipped"
  // 채팅 (E3)
  | "message_sent"
  | "message_read"
  | "conversation_reciprocated"
  // 프로필·설정·신고 (E4)
  | "report_submitted"
  | "block_submitted"
  | "mode_changed"
  | "account_paused"
  | "account_delete_requested"
  | "account_delete_canceled"
  | "push_opened";

export type OnboardingStepName = "age_gate" | "phone" | "basic" | "availability" | "hobbies" | "quiz" | "card" | "photos";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined | ReadonlyArray<string | number>>;

export type AnalyticsCommon = {
  session_id: string;
  /** 진입 경로: direct | push | pwa | link */
  source: string;
  push_slot: string | null;
};

const SESSION_KEY = "dm_analytics_session";
const SOURCE_KEY = "dm_analytics_source";

/** 개인정보성 키는 어댑터 단계에서 제거(방어선). */
const FORBIDDEN_KEYS = new Set(["phone", "nickname", "birth_date", "birthDate", "message", "body", "path", "email"]);

type DataLayerWindow = Window & { dataLayer?: unknown[] };

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* 사파리 프라이빗 등 */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 세션 공통 속성. 첫 호출 시 sessionStorage 에 세션 ID·진입 경로를 고정한다. */
export function analyticsCommon(): AnalyticsCommon | null {
  if (!isBrowser()) return null;
  let sessionId = readStorage(SESSION_KEY);
  if (!sessionId) {
    sessionId = newId();
    writeStorage(SESSION_KEY, sessionId);
  }
  let source = readStorage(SOURCE_KEY);
  let pushSlot: string | null = null;
  if (!source) {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src");
    source = src === "push" || src === "pwa" ? src : document.referrer ? "link" : "direct";
    writeStorage(SOURCE_KEY, source);
  }
  const slot = new URLSearchParams(window.location.search).get("slot");
  if (slot) pushSlot = slot;
  return { session_id: sessionId, source, push_slot: pushSlot };
}

function sanitize(props: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.has(k) || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * 단일 진입점. 실패해도 절대 throw 하지 않는다(UI 를 막지 않음).
 * @param event 12_flows §10 표의 이벤트명
 * @param props snake_case 속성. 원문·개인정보 금지
 */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  try {
    if (!isBrowser()) return;
    const common = analyticsCommon();
    const payload = { event, ...sanitize(props), ...common, ts: Date.now() };
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(payload);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[track]", event, payload);
    }
  } catch {
    /* no-op */
  }
}

/**
 * 화면 체류 시간 측정 — `const timer = stepTimer()` 로 마운트 시 시작, 완료 시 `timer.elapsed()` 를 `duration_ms` 로.
 */
export function stepTimer(now: () => number = () => Date.now()): { elapsed: () => number; reset: () => void } {
  let start = now();
  return {
    elapsed: () => Math.max(0, now() - start),
    reset: () => {
      start = now();
    },
  };
}

/** 뷰포트 내 테스트·디버그용: 지금까지 쌓인 dataLayer 이벤트 (브라우저 전용) */
export function readDataLayer(): unknown[] {
  if (!isBrowser()) return [];
  return ((window as DataLayerWindow).dataLayer ?? []).slice();
}
