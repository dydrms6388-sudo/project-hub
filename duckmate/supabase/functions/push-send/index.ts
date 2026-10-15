/**
 * push-send — 단건 즉시 발송 (service role 전용).
 *   POST { profile_id, kind?, template_key, params? }
 *   → notify_profile(정책 검사 후 큐) → 즉시 전송 가능하면 그 행만 dispatch → 결과 반환
 * 호출자: 서버 액션(functions.invoke, Bearer service role) 또는 x-webhook-secret = PUSH_DISPATCH_SECRET.
 * D3/D4/D5 는 보통 SQL 훅 notify_profile() 만 호출하면 되고(5분 내 dispatch), 즉시성이 필요할 때만 이 함수를 쓴다.
 * secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT / PUSH_DISPATCH_SECRET (SERVICE_NAME 선택)
 */
import { json, preflight } from "../_shared/cors.ts";
import { adminClient, isTrustedCaller } from "../_shared/supabase.ts";
import { dispatchQueue } from "./lib/send.ts";
import { isPushTemplateKey, PUSH_TEMPLATES } from "./lib/templates.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotifyResult = { queued: boolean; queue_id?: number; action: string; reason: string; merged?: boolean; scheduled_at?: string };

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!isTrustedCaller(req, "PUSH_DISPATCH_SECRET")) return json({ error: "unauthorized" }, 401);

  let body: { profile_id?: unknown; kind?: unknown; template_key?: unknown; params?: unknown; dispatch?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const profileId = typeof body.profile_id === "string" && UUID_RE.test(body.profile_id) ? body.profile_id : null;
  const template = isPushTemplateKey(body.template_key) ? body.template_key : null;
  if (!profileId || !template) return json({ error: "profile_id(uuid) / template_key required" }, 400);
  const meta = PUSH_TEMPLATES[template];
  if (body.kind !== undefined && body.kind !== meta.kind) return json({ error: `kind mismatch: ${template} is ${meta.kind}` }, 400);
  const params = body.params && typeof body.params === "object" && !Array.isArray(body.params) ? (body.params as Record<string, unknown>) : {};

  const admin = adminClient();
  const { data, error } = await admin.rpc("notify_profile", { p_profile_id: profileId, p_template_key: template, p_params: params });
  if (error) return json({ error: error.message }, 500);
  const res = (data ?? {}) as NotifyResult;

  const wantDispatch = body.dispatch !== false;
  if (wantDispatch && res.queued && res.action === "send" && res.queue_id) {
    const stats = await dispatchQueue(admin, { onlyId: res.queue_id, limit: 1 });
    return json({ ...res, dispatch: stats });
  }
  return json(res);
});
