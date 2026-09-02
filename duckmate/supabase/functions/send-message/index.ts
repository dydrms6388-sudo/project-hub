// =============================================================================
// D4 · send-message Edge Function (Deno)
//
// 메시지 발신의 유일한 경로. 클라이언트는 messages 에 INSERT 권한 자체가 없다
// (00003 컬럼 권한 — D1 규약 ④). 파이프라인:
//
//   ① JWT 인증 → ② 발신자 프로필/제재(can_engage 동등) → ③ 매칭 참여자 검증
//   → ④ 이미지 첨부 검증(양측 Lv≥2 + chat-images/{match_id}/{uuid}.webp)
//   → ⑤ 마스킹 R1~R5 (해제: matched_at+72h && 양측 Lv≥2 → R1·R2 만)
//   → ⑥ 자동 탐지 조치(LOG→MASK→WARN→QUEUE→BLOCK_SEND, A5 §5.2)
//   → ⑦ body/masked_body/mask_rules insert (service role)
//   → ⑧ moderation_flags 기록 → ⑨ WARN 시 수신자 안전 카드 broadcast(best-effort)
//
// Realtime: new_message broadcast 는 00009 의 messages AFTER INSERT 트리거가
// realtime.send() 로 수행한다(마스킹된 컬럼만 담은 payload). 이 함수는 별도
// broadcast 를 하지 않는다 — 안전 카드(safety_card) 이벤트만 예외.
//
// 응답: ActionResult 형태 { ok, data | code, message } (D2 규약과 동일 패턴).
// =============================================================================

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { maskMessage } from "./masking.ts";
import { decideModeration, normalizeForDupCheck, type Flag } from "./moderation.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BODY_LENGTH = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** D2 §5 규약: messages.image_path = "chat-images/{match_id}/{uuid}.webp" */
const CHAT_IMAGE_PATH_RE =
  /^chat-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// 응답 헬퍼 (ActionResult 패턴 — 15_auth D2-1)
// ---------------------------------------------------------------------------

type ErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "PROFILE_NOT_FOUND"
  | "VERIFY_LEVEL_REQUIRED"
  | "SANCTIONED"
  | "MATCH_NOT_FOUND"
  | "MATCH_CLOSED"
  | "PARTNER_LEFT"
  | "BLOCKED"
  | "IMAGE_NOT_FOUND"
  | "MESSAGE_BLOCKED"
  | "DB_ERROR";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: ErrorCode, message: string): Response {
  return jsonResponse(status, { ok: false, code, message });
}

// ---------------------------------------------------------------------------
// 행 타입 (Edge 는 워크스페이스 패키지를 import 하지 않는다 — 필요한 필드만 로컬 정의)
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  status: string;
  verify_level: number;
  birth_date: string;
}

interface MatchRow {
  id: string;
  a_id: string | null;
  b_id: string | null;
  matched_at: string;
  status: string;
}

/** 클라이언트에 반환하는 안전한 메시지 형태 (packages/db Message 와 동일 스키마) */
interface SafeMessage {
  id: number;
  match_id: string;
  sender_id: string | null;
  masked_body: string;
  image_path: string | null;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 검증 단계
// ---------------------------------------------------------------------------

function isAdult(birthDate: string): boolean {
  const d = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 19);
  return d.getTime() <= cutoff.getTime();
}

/** can_engage() 동등 검사 — service role 은 auth.uid() 가 없어 RLS 헬퍼를 못 쓴다 */
async function hasActiveSanction(
  svc: SupabaseClient,
  profileId: string,
  minLevel: number
): Promise<boolean> {
  const { data } = await svc
    .from("sanctions")
    .select("id, ends_at")
    .eq("profile_id", profileId)
    .eq("status", "ACTIVE")
    .gte("level", minLevel);
  const now = Date.now();
  return (data ?? []).some(
    (s: { ends_at: string | null }) => s.ends_at === null || new Date(s.ends_at).getTime() > now
  );
}

async function isBlockedEitherWay(svc: SupabaseClient, a: string, b: string): Promise<boolean> {
  const { data } = await svc
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return (data ?? []).length > 0;
}

/** PAT_SCRIPT_DUP: 동일 발신자가 24h 내 서로 다른 매칭 3곳 이상에 동일/유사 본문 */
async function isScriptDuplicated(
  svc: SupabaseClient,
  senderId: string,
  matchId: string,
  body: string
): Promise<boolean> {
  if (body.trim().length < 20) return false; // 짧은 인사말 오탐 방지
  const normalized = normalizeForDupCheck(body);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await svc
    .from("messages")
    .select("match_id, body")
    .eq("sender_id", senderId)
    .neq("match_id", matchId)
    .gte("created_at", since)
    .order("id", { ascending: false })
    .limit(200);
  const otherMatches = new Set<string>();
  for (const row of (data ?? []) as { match_id: string; body: string }[]) {
    if (normalizeForDupCheck(row.body) === normalized) otherMatches.add(row.match_id);
  }
  return otherMatches.size >= 2; // 현재 매칭 포함 3곳 이상
}

/** 24h 내 기존 PAT_MONEY/PAT_INVEST 히트 수 (WARN → QUEUE 승급 판정) */
async function countRecentMoneyInvestHits(svc: SupabaseClient, profileId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await svc
    .from("moderation_flags")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .in("rule_code", ["PAT_MONEY", "PAT_INVEST"])
    .gte("created_at", since);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// 수신자 안전 카드 broadcast (A5 §5.2 WARN — 피해 가능자에게 명시적 안내)
// 트리거 broadcast 와 별개 채널 이벤트. 실패해도 발신은 성공 처리 (best-effort).
// ---------------------------------------------------------------------------
async function broadcastSafetyCard(
  matchId: string,
  card: "money" | "invest" | "sexual",
  forProfileId: string,
  messageId: number | null
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `match:${matchId}`,
            event: "safety_card",
            private: true,
            payload: { match_id: matchId, card, for_profile_id: forProfileId, message_id: messageId },
          },
        ],
      }),
    });
  } catch (_e) {
    // best-effort — 안전 카드 실패가 발신 자체를 막지 않는다
  }
}

// ---------------------------------------------------------------------------
// 메인 핸들러
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "INVALID_INPUT", "POST 만 지원해요.");

  // ---- 입력 파싱 -----------------------------------------------------------
  let input: { match_id?: string; body?: string; image_path?: string };
  try {
    input = await req.json();
  } catch {
    return fail(400, "INVALID_INPUT", "JSON 본문이 필요해요.");
  }

  const matchId = typeof input.match_id === "string" ? input.match_id : "";
  const body = typeof input.body === "string" ? input.body : "";
  const imagePath = typeof input.image_path === "string" ? input.image_path : null;

  if (!UUID_RE.test(matchId)) return fail(400, "INVALID_INPUT", "match_id 가 올바르지 않아요.");
  if (!body.trim() && !imagePath) {
    return fail(400, "INVALID_INPUT", "메시지 내용 또는 이미지가 필요해요.");
  }
  if (body.length > MAX_BODY_LENGTH) {
    return fail(400, "INVALID_INPUT", `메시지는 ${MAX_BODY_LENGTH}자까지 보낼 수 있어요.`);
  }

  // ---- ① 인증 --------------------------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return fail(401, "AUTH_REQUIRED", "로그인이 필요해요.");

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ---- ② 발신자 프로필 + can_engage 동등 검사 -------------------------------
  const { data: me } = await svc
    .from("profiles")
    .select("id, status, verify_level, birth_date")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();
  if (!me) return fail(403, "PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");
  if (me.status !== "active" || !isAdult(me.birth_date)) {
    return fail(403, "SANCTIONED", "메시지를 보낼 수 없는 계정 상태예요.");
  }
  if (me.verify_level < 2) {
    return fail(403, "VERIFY_LEVEL_REQUIRED", "본인인증(Lv2) 후 채팅할 수 있어요.");
  }
  // 활성 제재 level ≥ 2 = 발신 정지 (기존 대화 열람은 RLS 가 허용 — A5 §3.1)
  if (await hasActiveSanction(svc, me.id, 2)) {
    return fail(403, "SANCTIONED", "일시적으로 메시지 발신이 제한됐어요.");
  }

  // ---- ③ 매칭 참여자 검증 ---------------------------------------------------
  const { data: match } = await svc
    .from("matches")
    .select("id, a_id, b_id, matched_at, status")
    .eq("id", matchId)
    .maybeSingle<MatchRow>();
  if (!match) return fail(404, "MATCH_NOT_FOUND", "매칭을 찾을 수 없어요.");
  if (match.a_id !== me.id && match.b_id !== me.id) {
    return fail(403, "MATCH_NOT_FOUND", "매칭을 찾을 수 없어요."); // 존재 노출 방지
  }
  if (match.status !== "active") return fail(409, "MATCH_CLOSED", "종료된 대화방이에요.");

  const partnerId = match.a_id === me.id ? match.b_id : match.a_id;
  if (!partnerId) return fail(409, "PARTNER_LEFT", "대화를 종료한 상대예요."); // 12_flows §8.10

  const { data: partner } = await svc
    .from("profiles")
    .select("id, status, verify_level, birth_date")
    .eq("id", partnerId)
    .maybeSingle<ProfileRow>();
  if (!partner || partner.status !== "active") {
    return fail(409, "PARTNER_LEFT", "지금은 메시지를 보낼 수 없는 상대예요.");
  }
  if (await isBlockedEitherWay(svc, me.id, partnerId)) {
    return fail(403, "BLOCKED", "메시지를 보낼 수 없어요."); // 차단 사실 비노출
  }

  // ---- ④ 이미지 첨부 검증 (A5: 이미지 전송은 양측 Lv≥2) ----------------------
  if (imagePath) {
    const m = CHAT_IMAGE_PATH_RE.exec(imagePath);
    if (!m || m[1] !== matchId) {
      return fail(400, "INVALID_INPUT", "이미지 경로 규약(chat-images/{match_id}/{uuid}.webp) 위반이에요.");
    }
    if (partner.verify_level < 2) {
      return fail(403, "VERIFY_LEVEL_REQUIRED", "양측 모두 본인인증을 완료해야 이미지를 보낼 수 있어요.");
    }
    // 실제 업로드된 객체인지 확인 (00006 정책상 참여자만 업로드 가능했던 경로)
    const objectKey = imagePath.slice("chat-images/".length);
    const { error: signErr } = await svc.storage.from("chat-images").createSignedUrl(objectKey, 60);
    if (signErr) return fail(400, "IMAGE_NOT_FOUND", "업로드된 이미지를 찾을 수 없어요.");
  }

  // ---- ⑤ 마스킹 파이프라인 --------------------------------------------------
  const matchedAtMs = new Date(match.matched_at).getTime();
  const contactUnlocked =
    Date.now() >= matchedAtMs + 72 * 3600 * 1000 &&
    me.verify_level >= 2 &&
    partner.verify_level >= 2;

  const masking = maskMessage({ body, contactUnlocked });

  // ---- ⑥ 자동 탐지 조치 결정 ------------------------------------------------
  const [recentHits, scriptDup] = await Promise.all([
    countRecentMoneyInvestHits(svc, me.id),
    isScriptDuplicated(svc, me.id, matchId, body),
  ]);
  const decision = decideModeration({
    body,
    masking,
    contactUnlocked,
    within24hOfMatch: Date.now() < matchedAtMs + 24 * 3600 * 1000,
    recentMoneyInvestHits: recentHits,
    scriptDuplicated: scriptDup,
  });

  const insertFlags = async (flags: Flag[], messageId: number | null) => {
    if (flags.length === 0) return;
    await svc.from("moderation_flags").insert(
      flags.map((f) => ({
        match_id: matchId,
        message_id: messageId,
        profile_id: me.id,
        rule_code: f.rule_code,
        action: f.action,
        meta: f.meta,
      }))
    );
  };

  // BLOCK_SEND: 메시지 insert 없이 flags 만 기록. 발신자 문구는 탐지 로직 비노출
  // (A5 §5.2 수신자 보호 원칙 — 우회 학습 방지).
  if (decision.blockSend) {
    await insertFlags(decision.flags, null);
    return fail(422, "MESSAGE_BLOCKED", "커뮤니티 가이드라인에 맞지 않아 전송할 수 없는 내용이에요.");
  }

  // ---- ⑦ 저장 (service role — body/masked_body/mask_rules) ------------------
  const { data: inserted, error: insertErr } = await svc
    .from("messages")
    .insert({
      match_id: matchId,
      sender_id: me.id,
      body,
      masked_body: masking.maskedBody,
      mask_rules: masking.maskRules,
      image_path: imagePath,
    })
    .select("id, match_id, sender_id, masked_body, image_path, read_at, created_at")
    .single<SafeMessage>();
  if (insertErr || !inserted) {
    return fail(500, "DB_ERROR", "메시지 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
  // ※ new_message Realtime broadcast 는 00009 의 AFTER INSERT 트리거가 수행

  // ---- ⑧ moderation_flags 기록 ---------------------------------------------
  await insertFlags(decision.flags, inserted.id);

  // ---- ⑨ 수신자 안전 카드 (WARN/QUEUE — best-effort) ------------------------
  const needsSafetyCard = decision.flags.some(
    (f) => f.action === "WARN" || (f.action === "QUEUE" && f.rule_code !== "PAT_EXTERNAL_LINK")
  );
  if (decision.safetyCard && needsSafetyCard) {
    await broadcastSafetyCard(matchId, decision.safetyCard, partnerId, inserted.id);
  }

  // 발신자 배너(WARN): 탐지 로직을 특정하지 않는 일반 문구 (A5 §5.2)
  const warned = decision.flags.some((f) => f.action === "WARN" || f.action === "QUEUE");
  return jsonResponse(200, {
    ok: true,
    data: {
      message: inserted,
      warn: warned ? { message: "안전한 대화를 위해 커뮤니티 가이드라인을 지켜 주세요." } : null,
    },
  });
});
