/**
 * `/dev/chat` 전용 인메모리 ChatApi 목 (Playwright 스크린샷·수동 확인). 프로덕션 번들에는 dev 페이지만 import 한다.
 * 시드 페르소나: 서윤(나) ↔ 민재·하은·도현·(탈퇴). 전화번호를 보내면 마스킹, "송금/투자" 는 상대 스캠 배너 시뮬레이션.
 */
import { maskContacts, scoreMessage } from "@duckmate/db/safety-rules";
import type { ActionResult } from "@/lib/auth/errors";
import type { ChatListItem, ChatMessage, ChatRoom, SentMessage } from "@/lib/chat/types";
import type { ChatApi } from "../api";

export const DEV_ME = "11111111-1111-4111-8111-111111111111";
export const DEV_MATCH_MINJAE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MINJAE = "22222222-2222-4222-8222-222222222222";
const HAEUN = "33333333-3333-4333-8333-333333333333";
const DOHYUN = "44444444-4444-4444-8444-444444444444";
const GONE = "55555555-5555-4555-8555-555555555555";

const H = 3_600_000;
const now = () => Date.now();
const iso = (msAgo: number) => new Date(now() - msAgo).toISOString();

function baseRoom(over: Partial<ChatRoom> & Pick<ChatRoom, "match_id" | "partner_id">): ChatRoom {
  return {
    status: "active",
    mode: "friend",
    matched_at: iso(20 * H),
    first_message_at: iso(19 * H),
    last_message_at: iso(12 * 60_000),
    ended_at: null,
    partner_nickname: "민재",
    partner_verify_level: 3,
    partner_status: "active",
    partner_age_band: "20대 후반",
    partner_sigungu: "성동구",
    partner_photo_path: null,
    unread_count: 2,
    last_preview: "토요일 아침 한강 5k 어때요? 제 번호는 [연락처 숨김] 이에요",
    contact_unmasked: false,
    unmask_at: iso(-52 * H),
    both_l3: true,
    image_allowed: false,
    image_allowed_at: iso(-4 * H),
    can_send: true,
    my_sanction_level: 0,
    my_contact_hits: 0,
    partner_scam_banner: false,
    first_suggestion: null,
    ...over,
  };
}

export const DEV_ROOMS: ChatRoom[] = [
  baseRoom({ match_id: DEV_MATCH_MINJAE, partner_id: MINJAE }),
  baseRoom({
    match_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    partner_id: HAEUN,
    partner_nickname: "하은",
    partner_verify_level: 2,
    partner_age_band: "30대 초반",
    partner_sigungu: "마포구",
    matched_at: iso(2 * H),
    first_message_at: null,
    last_message_at: null,
    unread_count: 0,
    last_preview: null,
    unmask_at: iso(-70 * H),
    image_allowed_at: iso(-22 * H),
    both_l3: false,
    first_suggestion: [
      { id: "c1", template_id: "boardgame_cafe", title: "보드게임 카페 정찰", body: "마포 쪽에 신작 많은 보드게임 카페 아세요? 저는 요즘 협력 게임에 빠져 있어요.", kind: "offline" },
      { id: "c2", template_id: "fav_talk", title: "최애 얘기부터", body: "프로필에 적으신 최애, 어떤 점이 제일 좋아요? 저는 입문한 지 얼마 안 돼서 궁금해요.", kind: "talk" },
      { id: "c3", template_id: "online_session", title: "온라인으로 한 판", body: "주말 저녁에 온라인 보드게임 한 판 어때요? 룰 설명은 제가 할게요.", kind: "online" },
    ],
  }),
  baseRoom({
    match_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    partner_id: DOHYUN,
    partner_nickname: "도현",
    partner_verify_level: 3,
    partner_age_band: "20대 중반",
    partner_sigungu: "송파구",
    matched_at: iso(30 * H),
    last_message_at: iso(26 * H),
    unread_count: 0,
    last_preview: "다음에 또 얘기해요!",
    status: "left",
    ended_at: iso(25 * H),
    can_send: false,
  }),
  baseRoom({
    match_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    partner_id: GONE,
    partner_nickname: null,
    partner_verify_level: 0,
    partner_status: "deleting",
    partner_age_band: null,
    partner_sigungu: null,
    matched_at: iso(96 * H),
    last_message_at: iso(80 * H),
    unread_count: 0,
    last_preview: null,
    status: "paused",
    can_send: false,
  }),
];

function msg(over: Partial<ChatMessage> & Pick<ChatMessage, "id" | "created_at" | "sender_id">): ChatMessage {
  const mine = over.sender_id === DEV_ME;
  const body = over.body ?? null;
  const masked = over.masked_body ?? body ?? "";
  return {
    match_id: DEV_MATCH_MINJAE,
    body: mine ? body : null,
    masked_body: masked,
    display_body: mine ? (body ?? masked) : masked,
    image_path: null,
    suggestion_template_id: null,
    is_held: false,
    read_at: null,
    is_mine: mine,
    ...over,
  };
}

export const DEV_MESSAGES: Record<string, ChatMessage[]> = {
  [DEV_MATCH_MINJAE]: [
    msg({ id: "m1", sender_id: DEV_ME, created_at: iso(19 * H), body: "성동구 근처 러닝 코스 추천해 주실 수 있어요? 주말에 같이 뛰어도 좋고요.", suggestion_template_id: "run_together", read_at: iso(18.9 * H) }),
    msg({ id: "m2", sender_id: MINJAE, created_at: iso(18.5 * H), masked_body: "오 저 서울숲 자주 뛰어요! 초보 코스도 있어요" }),
    msg({ id: "m3", sender_id: DEV_ME, created_at: iso(18 * H), body: "저는 5k 정도 천천히 뛰는 편이에요 🏃", read_at: iso(17 * H) }),
    msg({ id: "m4", sender_id: MINJAE, created_at: iso(3 * H), masked_body: "토요일 아침 한강 5k 어때요? 제 번호는 [연락처 숨김] 이에요" }),
    msg({ id: "m5", sender_id: DEV_ME, created_at: iso(2.5 * H), body: "좋아요! 근데 연락처는 여기서 3일 뒤에 주고받을 수 있대요. 그때까지 여기서 얘기해요", read_at: null }),
    msg({ id: "m6", sender_id: MINJAE, created_at: iso(12 * 60_000), masked_body: "ㅋㅋ 그러네요. 그럼 토요일 9시 뚝섬유원지역 2번 출구는 어때요?" }),
  ],
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc": [
    msg({ id: "d1", match_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", sender_id: DOHYUN, created_at: iso(28 * H), masked_body: "반가워요! 요즘 무슨 게임 하세요?" }),
    msg({ id: "d2", match_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", sender_id: DEV_ME, created_at: iso(27 * H), body: "요즘은 발더스 게이트 3 다시 돌고 있어요", read_at: iso(26.5 * H) }),
    msg({ id: "d3", match_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", sender_id: DOHYUN, created_at: iso(26 * H), masked_body: "다음에 또 얘기해요!" }),
  ],
};

const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type MockOptions = {
  /** 'polling' 이면 Realtime 실패 상태 시뮬레이션 */
  realtime?: "connected" | "polling";
  latencyMs?: number;
};

export function createMockChatApi(opts: MockOptions = {}): ChatApi {
  const latency = opts.latencyMs ?? 250;
  const rooms = DEV_ROOMS.map((r) => ({ ...r }));
  const messages: Record<string, ChatMessage[]> = Object.fromEntries(Object.entries(DEV_MESSAGES).map(([k, v]) => [k, v.map((m) => ({ ...m }))]));
  let sentCount = 0;

  const roomOf = (id: string) => rooms.find((r) => r.match_id === id);

  return {
    async fetchChatList() {
      await delay(latency);
      return ok(rooms.map((r) => ({ ...r, first_suggestion: null }) as ChatListItem));
    },
    async fetchChatRoom(matchId) {
      await delay(latency);
      const r = roomOf(matchId);
      return r ? ok(r) : { ok: false, code: "NOT_FOUND", message: "대화방을 찾을 수 없어요" };
    },
    async fetchMessages(matchId, o = {}) {
      await delay(latency);
      const limit = o.limit ?? 50;
      let list = [...(messages[matchId] ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      if (o.before) list = list.filter((m) => m.created_at < o.before!);
      const page = list.slice(0, limit);
      return ok({ items: page.reverse(), nextBefore: page.length === limit ? page[0]!.created_at : null });
    },
    async fetchPartnerRiskBanner() {
      return false;
    },
    async sendMessage({ matchId, body }) {
      await delay(latency);
      const room = roomOf(matchId);
      if (!room) return { ok: false, code: "NOT_FOUND", message: "대화방을 찾을 수 없어요" };
      if (room.status !== "active") return { ok: false, code: "NOT_ENTITLED", message: "대화가 종료되었어요" };
      if (body.includes("실패")) return { ok: false, code: "INTERNAL", message: "잠시 문제가 생겼어요. 다시 시도해 주세요" };
      if (body.includes("답장")) return { ok: false, code: "RATE_LIMITED", message: "상대의 답장을 기다려 주세요", retryAfterSec: 60 };
      const score = scoreMessage(body);
      const masked = room.contact_unmasked ? body : maskContacts(body).masked;
      const held = score.severity === "hold";
      const id = `s${++sentCount}-${Date.now().toString(36)}`;
      const created = new Date().toISOString();
      (messages[matchId] ??= []).push(msg({ id, match_id: matchId, sender_id: DEV_ME, created_at: created, body, masked_body: masked, is_held: held }));
      room.last_message_at = created;
      room.first_message_at ??= created;
      if (score.contactHits > 0) room.my_contact_hits += 1;
      const sent: SentMessage = {
        id,
        matchId,
        body,
        maskedBody: masked,
        imagePath: null,
        isHeld: held,
        createdAt: created,
        contactMasked: masked !== body,
        warnContact: room.my_contact_hits >= 3,
        warnRules: score.flags.map((f) => f.ruleId).filter((r) => ["BW_SEXUAL", "BW_HATE", "CT_LURE", "MN_SCHOOL"].includes(r)),
        offlineMeeting: score.offlineMeeting,
      };
      return ok(sent);
    },
    async markRead({ matchId }) {
      const room = roomOf(matchId);
      const n = room?.unread_count ?? 0;
      if (room) room.unread_count = 0;
      return ok({ matchId, marked: n });
    },
    async leaveMatch({ matchId }) {
      await delay(latency);
      const room = roomOf(matchId);
      if (room) {
        room.status = "left";
        room.can_send = false;
      }
      return ok({ matchId, status: "left", changed: true });
    },
    async blockProfile({ targetId }) {
      await delay(latency);
      const idx = rooms.findIndex((r) => r.partner_id === targetId);
      if (idx >= 0) rooms.splice(idx, 1);
      return ok({ targetId, blocked: true as const });
    },
    async createChatImageUploadUrl({ matchId }) {
      await delay(latency);
      const room = roomOf(matchId);
      if (!room?.image_allowed) return { ok: false, code: "NOT_ENTITLED", message: "이미지는 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요" };
      const messageId = crypto.randomUUID();
      return ok({ messageId, path: `${matchId}/${messageId}.webp`, token: "mock", signedUrl: "about:blank", maxBytes: 5 * 1024 * 1024, allowedMime: ["image/webp"] });
    },
    async uploadImage() {
      await delay(latency);
      return { ok: true };
    },
    async sendImageMessage({ matchId, messageId }) {
      await delay(latency);
      const created = new Date().toISOString();
      (messages[matchId] ??= []).push(msg({ id: messageId, match_id: matchId, sender_id: DEV_ME, created_at: created, body: null, masked_body: "[사진]", image_path: `${matchId}/${messageId}.webp` }));
      return ok({ id: messageId, matchId, body: null, maskedBody: "[사진]", imagePath: `${matchId}/${messageId}.webp`, isHeld: false, createdAt: created, contactMasked: false, warnContact: false, warnRules: [], offlineMeeting: false });
    },
    async getChatImageUrl() {
      await delay(latency);
      return { ok: false, code: "FORBIDDEN", message: "목 환경에서는 사진을 볼 수 없어요" };
    },
    subscribeToMatch(_matchId, h) {
      const t = setTimeout(() => h.onStatus?.(opts.realtime ?? "connected"), 50);
      return () => clearTimeout(t);
    },
    subscribeToInbox(_profileId, h) {
      const t = setTimeout(() => h.onStatus?.(opts.realtime ?? "connected"), 50);
      return () => clearTimeout(t);
    },
  };
}
