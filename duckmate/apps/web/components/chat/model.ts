/**
 * 채팅 화면 순수 로직 (E3). React·브라우저 의존성 0 → vitest 대상.
 *
 *   mergeMessages(existing, incoming)      id 기준 dedupe + created_at 오름차순 (낙관적 메시지는 clientId 로 서버 행과 합쳐진다)
 *   groupByDay(items, now)                 날짜 구분선 삽입 ("오늘"/"어제"/"9월 2일 (화)")
 *   mapSendFailure(failure)                ActionFailure → 입력창 UI 상태 (inline / disable / redirect / retry)
 *   splitMasked(text)                      "[연락처 숨김]" 등 placeholder 를 칩 세그먼트로 분리
 *   pickTopBanner(room, ctx)               상단 배너 우선순위 (scam > 마스킹 안내 > 이미지 가능 시각 > 첫 매칭 가이드)
 *   payloadToMessage(payload, myId)        Realtime 페이로드 → v_messages 행 형태
 */
import type { FirstSuggestion } from "@duckmate/db";
import { PLACEHOLDER } from "@duckmate/db/safety-rules";
import type { ActionFailure } from "@/lib/auth/errors";
import type { ChatMessage, ChatRoom, RealtimeMessagePayload, SentMessage } from "@/lib/chat/types";

export const CHAT_INPUT_MAX_LEN = 1000;
export const CHAT_POLL_INTERVAL_MS = 5000;
export const REPORT_ROUTE = "/report/new";

/** 화면 전용 확장: 낙관적 전송 상태·인라인 안내 */
export type UiMessage = ChatMessage & {
  /** 낙관적 전송 중 클라이언트 id (서버 확정 후에도 유지 → Realtime 중복 제거) */
  clientId?: string;
  sendState?: "sending" | "failed";
  /** 발신자 화면 인라인 안내: 연락처가 마스킹돼 상대에게 [연락처 숨김] 으로 보임 */
  contactMasked?: boolean;
  /** 낙관적 이미지 미리보기(blob URL) */
  localImageUrl?: string;
  errorMessage?: string;
};

export type DayGroupItem = { type: "date"; key: string; label: string } | { type: "msg"; key: string; message: UiMessage };

/* ------------------------------------------------------------------ merge */

function timeOf(m: { created_at: string }): number {
  const t = Date.parse(m.created_at);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 기존 목록에 신규 메시지를 합친다.
 * - 같은 `id` → 신규가 기존을 덮어쓰되, 기존의 화면 전용 필드(clientId·localImageUrl)는 유지
 * - 신규의 `clientId` 가 기존 낙관적 메시지와 같으면 그 자리를 교체(서버 확정)
 * - 결과는 created_at 오름차순, 같은 시각이면 기존 순서 유지
 */
export function mergeMessages(existing: readonly UiMessage[], incoming: readonly UiMessage[]): UiMessage[] {
  const byId = new Map<string, UiMessage>();
  const byClient = new Map<string, string>(); // clientId → id
  const order: string[] = [];
  const put = (m: UiMessage) => {
    const prevId = m.clientId ? byClient.get(m.clientId) : undefined;
    const targetId = byId.has(m.id) ? m.id : prevId;
    if (targetId !== undefined) {
      const prev = byId.get(targetId)!;
      const merged: UiMessage = { ...prev, ...m, clientId: m.clientId ?? prev.clientId, localImageUrl: m.localImageUrl ?? prev.localImageUrl };
      if (m.sendState === undefined) delete merged.sendState;
      if (m.errorMessage === undefined) delete merged.errorMessage;
      if (targetId !== m.id) {
        byId.delete(targetId);
        const idx = order.indexOf(targetId);
        if (idx >= 0) order[idx] = m.id;
      }
      byId.set(m.id, merged);
    } else {
      byId.set(m.id, { ...m });
      order.push(m.id);
    }
    if (m.clientId) byClient.set(m.clientId, m.id);
  };
  existing.forEach(put);
  incoming.forEach(put);
  const out = order.map((id) => byId.get(id)!);
  return out
    .map((m, i) => [m, i] as const)
    .sort((a, b) => timeOf(a[0]) - timeOf(b[0]) || a[1] - b[1])
    .map(([m]) => m);
}

export function removeMessage(list: readonly UiMessage[], id: string): UiMessage[] {
  return list.filter((m) => m.id !== id);
}

/** Realtime 페이로드(원문 없음) → 화면 행. 상대 메시지는 display_body = masked_body */
export function payloadToMessage(p: RealtimeMessagePayload, myProfileId: string): UiMessage {
  return {
    id: p.id,
    match_id: p.match_id,
    sender_id: p.sender_id,
    body: null,
    masked_body: p.masked_body,
    display_body: p.masked_body,
    image_path: p.image_path,
    suggestion_template_id: p.suggestion_template_id,
    is_held: false,
    created_at: p.created_at,
    read_at: null,
    is_mine: p.sender_id === myProfileId,
  };
}

/** 서버 액션 응답(SentMessage) → 확정 행 (발신자 화면은 원문 렌더) */
export function sentToMessage(s: SentMessage, myProfileId: string, clientId: string): UiMessage {
  return {
    id: s.id,
    match_id: s.matchId,
    sender_id: myProfileId,
    body: s.body,
    masked_body: s.maskedBody,
    display_body: s.body ?? s.maskedBody,
    image_path: s.imagePath,
    suggestion_template_id: null,
    is_held: s.isHeld,
    created_at: s.createdAt,
    read_at: null,
    is_mine: true,
    clientId,
    contactMasked: s.contactMasked,
  };
}

export function makeOptimistic(input: { matchId: string; myProfileId: string; body: string | null; clientId: string; localImageUrl?: string; now?: Date }): UiMessage {
  const created = (input.now ?? new Date()).toISOString();
  return {
    id: `tmp-${input.clientId}`,
    match_id: input.matchId,
    sender_id: input.myProfileId,
    body: input.body,
    masked_body: input.body ?? "[사진]",
    display_body: input.body ?? "[사진]",
    image_path: null,
    suggestion_template_id: null,
    is_held: false,
    created_at: created,
    read_at: null,
    is_mine: true,
    clientId: input.clientId,
    sendState: "sending",
    ...(input.localImageUrl ? { localImageUrl: input.localImageUrl } : {}),
  };
}

/* ------------------------------------------------------------------ dates */

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 날짜 구분선 라벨: 오늘 / 어제 / 9월 2일 (화) / 2025년 12월 31일 (수) */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = dayKey(d);
  if (key === today) return "오늘";
  if (key === yesterday) return "어제";
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
  return d.getFullYear() === now.getFullYear() ? base : `${d.getFullYear()}년 ${base}`;
}

/** 메시지 시각: 오후 3:24 */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 목록 행 상대 시각: 방금 / 12분 전 / 3시간 전 / 어제 / 3일 전 / 9월 2일 */
export function relativeLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now.getTime() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24 && dayKey(new Date(t)) === dayKey(now)) return `${hr}시간 전`;
  const label = dayLabel(iso, now);
  if (label === "어제") return label;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}일 전`;
  return label;
}

/** 절대 시각(배너용): 9월 5일 오전 10:20 */
export function dateTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = dayLabel(iso, now);
  const dayPart = day === "오늘" || day === "어제" ? day : `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${dayPart} ${timeLabel(iso)}`;
}

/** 시간 오름차순 목록에 날짜 구분선을 끼운다 */
export function groupByDay(items: readonly UiMessage[], now: Date = new Date()): DayGroupItem[] {
  const out: DayGroupItem[] = [];
  let lastKey: string | null = null;
  for (const m of items) {
    const d = new Date(m.created_at);
    const key = Number.isNaN(d.getTime()) ? "invalid" : dayKey(d);
    if (key !== lastKey) {
      out.push({ type: "date", key: `d-${key}`, label: dayLabel(m.created_at, now) });
      lastKey = key;
    }
    out.push({ type: "msg", key: m.id, message: m });
  }
  return out;
}

/* ------------------------------------------------------------------ masked segments */

const PLACEHOLDER_TOKENS: ReadonlyArray<{ token: string; reason: string }> = [
  { token: PLACEHOLDER.contact, reason: "연락처·메신저 ID 는 매칭 3일 후, 양쪽 사진인증부터 볼 수 있어요" },
  { token: PLACEHOLDER.link, reason: "링크는 매칭 3일 후, 양쪽 사진인증부터 볼 수 있어요" },
  { token: PLACEHOLDER.account, reason: "계좌번호는 가려져요. 돈 이야기는 신호예요 — 의심되면 신고해 주세요" },
];

export type TextSegment = { type: "text"; text: string } | { type: "masked"; token: string; reason: string };

/** "[연락처 숨김]" 류 placeholder 를 칩 세그먼트로 분리 */
export function splitMasked(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { idx: number; ph: (typeof PLACEHOLDER_TOKENS)[number] } | null = null;
    for (const ph of PLACEHOLDER_TOKENS) {
      const idx = rest.indexOf(ph.token);
      if (idx >= 0 && (best === null || idx < best.idx)) best = { idx, ph };
    }
    if (!best) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (best.idx > 0) out.push({ type: "text", text: rest.slice(0, best.idx) });
    out.push({ type: "masked", token: best.ph.token, reason: best.ph.reason });
    rest = rest.slice(best.idx + best.ph.token.length);
  }
  return out;
}

export function hasMaskedToken(text: string | null | undefined): boolean {
  if (!text) return false;
  return PLACEHOLDER_TOKENS.some((p) => text.includes(p.token));
}

/* ------------------------------------------------------------------ error mapping */

export type SendUiState =
  | { kind: "inline"; message: string; retryAfterSec?: number }
  | { kind: "disable"; message: string; reason: "ended" | "sanctioned" | "image_not_allowed" }
  | { kind: "redirect"; to: string; message: string }
  | { kind: "retry"; message: string };

const ENDED_DETAILS = ["MATCH_LEFT", "MATCH_BLOCKED", "MATCH_PAUSED", "BLOCKED"];

/** 서버 액션 실패 → 입력창 상태. 문구는 `ActionFailure.message`(17_chat §0-12 매핑 완료) 우선 */
export function mapSendFailure(f: ActionFailure): SendUiState {
  switch (f.code) {
    case "RATE_LIMITED": {
      const isDetail = f.message.includes("답장") || f.message.includes("오늘은");
      return isDetail ? { kind: "inline", message: f.message } : { kind: "inline", message: `요청이 많아요. ${f.retryAfterSec ?? 60}초 후 다시 보내 주세요`, retryAfterSec: f.retryAfterSec ?? 60 };
    }
    case "NOT_ENTITLED": {
      if (f.message.includes("이미지")) return { kind: "disable", message: f.message, reason: "image_not_allowed" };
      if (f.message.includes("종료") || ENDED_DETAILS.some((d) => f.message.startsWith(d))) return { kind: "disable", message: "대화가 종료되었어요", reason: "ended" };
      return { kind: "disable", message: f.message, reason: "ended" };
    }
    case "SANCTIONED":
      return { kind: "redirect", to: f.redirectTo ?? "/suspended", message: f.message || "채팅이 24시간 제한됐어요" };
    case "NOT_VERIFIED":
      return { kind: "redirect", to: f.redirectTo ?? "/verify", message: f.message };
    case "NOT_AUTHENTICATED":
      return { kind: "redirect", to: f.redirectTo ?? "/login", message: f.message };
    case "INVALID_INPUT":
      return { kind: "inline", message: f.message };
    case "NOT_FOUND":
      return { kind: "disable", message: "대화방을 찾을 수 없어요", reason: "ended" };
    default:
      return { kind: "retry", message: "전송하지 못했어요. 다시 시도해 주세요" };
  }
}

/* ------------------------------------------------------------------ banners */

export type TopBanner =
  | { kind: "scam" }
  | { kind: "mask"; unmaskAt: string; bothL3: boolean; repeated: boolean }
  | { kind: "image"; imageAllowedAt: string; bothL3: boolean }
  | { kind: "guide" }
  | null;

export type BannerContext = {
  /** Realtime scam_signal 또는 partner_risk_banner(D5) */
  scamSignal?: boolean;
  /** 이번 세션 SentMessage.warnContact */
  warnContact?: boolean;
  /** 첫 매칭 안전 가이드 이미 봤는지 */
  guideSeen: boolean;
  /** 사용자가 이번 방에서 닫은 배너 종류 */
  dismissed?: ReadonlyArray<"mask" | "image" | "guide">;
};

/** 방 상단 배너 1개 선택 (우선순위: scam > 마스킹 안내 > 이미지 가능 시각 > 첫 매칭 가이드 1회) */
export function pickTopBanner(room: Pick<ChatRoom, "partner_scam_banner" | "contact_unmasked" | "unmask_at" | "both_l3" | "my_contact_hits" | "image_allowed" | "image_allowed_at">, ctx: BannerContext): TopBanner {
  const dismissed = ctx.dismissed ?? [];
  if (room.partner_scam_banner || ctx.scamSignal) return { kind: "scam" };
  if (!room.contact_unmasked && !dismissed.includes("mask")) {
    return { kind: "mask", unmaskAt: room.unmask_at, bothL3: room.both_l3, repeated: room.my_contact_hits >= 3 || Boolean(ctx.warnContact) };
  }
  if (!room.image_allowed && !dismissed.includes("image")) return { kind: "image", imageAllowedAt: room.image_allowed_at, bothL3: room.both_l3 };
  if (!ctx.guideSeen && !dismissed.includes("guide")) return { kind: "guide" };
  return null;
}

/* ------------------------------------------------------------------ misc */

export function parseFirstSuggestion(raw: unknown): FirstSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is FirstSuggestion =>
      typeof c === "object" && c !== null && typeof (c as FirstSuggestion).id === "string" && typeof (c as FirstSuggestion).body === "string" && typeof (c as FirstSuggestion).title === "string",
  );
}

export function isEnded(status: ChatRoom["status"]): boolean {
  return status === "blocked" || status === "left" || status === "paused";
}

export const ENDED_LABEL: Record<Exclude<ChatRoom["status"], "active">, string> = {
  blocked: "대화가 종료되었어요",
  left: "상대가 대화를 떠났어요",
  paused: "대화가 일시정지됐어요",
};

/** 분석용 match_id 해시 (FNV-1a 32bit hex). 원문 id 는 이벤트에 넣지 않는다 */
export function hashId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function lengthBucket(len: number): "1-20" | "21-80" | "81-200" | "200+" {
  if (len <= 20) return "1-20";
  if (len <= 80) return "21-80";
  if (len <= 200) return "81-200";
  return "200+";
}

/** "양쪽 첫 메시지 충족" 판정 (conversation_reciprocated 1회) */
export function isReciprocated(items: readonly UiMessage[]): boolean {
  let mine = false;
  let theirs = false;
  for (const m of items) {
    if (m.sendState) continue;
    if (m.is_mine) mine = true;
    else theirs = true;
    if (mine && theirs) return true;
  }
  return false;
}

export function reportHref(targetId: string, matchId: string, reason?: string): string {
  const q = new URLSearchParams({ target: targetId, match: matchId, surface: "chat" });
  if (reason) q.set("reason", reason);
  return `${REPORT_ROUTE}?${q.toString()}`;
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
