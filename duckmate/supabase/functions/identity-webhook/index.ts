/**
 * identity-webhook — 포트원 본인인증 웹훅 수신 stub (Phase 4 실연동, F-082).
 *
 * 현재 동작: 서명 검증(Standard Webhooks 규격: webhook-id / webhook-timestamp / webhook-signature, HMAC-SHA256 base64)
 *           → 통과 시 audit_logs(identity_webhook_received) 기록 후 200. 판정은 하지 않는다.
 * 최종 판정은 항상 apps/web 의 PortOneVerifier.verify()(서버-서버 조회) → apply_identity_verification 경로로만.
 * TODO(Phase 4): 이벤트 타입(IdentityVerification.Verified 등)별로 profile 조회 → verify 재시도 큐잉.
 */
import { adminClient } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";

const TOLERANCE_SEC = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifySignature(req: Request, rawBody: string, secret: string): Promise<boolean> {
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sigHeader = req.headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_SEC) return false;

  // secret 은 "whsec_" 접두어 + base64
  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`)));
  const expected = btoa(String.fromCharCode(...mac));

  // "v1,<sig> v1,<sig2>" 형식. 하나라도 일치하면 통과
  return sigHeader.split(" ").some((part) => {
    const [ver, sig] = part.split(",", 2);
    return ver === "v1" && sig === expected;
  });
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("PORTONE_WEBHOOK_SECRET");
  if (!secret) return json({ error: "not_configured" }, 503);

  const raw = await req.text();
  if (!(await verifySignature(req, raw, secret))) return json({ error: "invalid_signature" }, 401);

  let event: { type?: string; data?: Record<string, unknown> } = {};
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // 개인정보(이름·CI 등)는 절대 기록하지 않는다 — 이벤트 타입과 식별자만
  const identityVerificationId = typeof event.data?.identityVerificationId === "string" ? (event.data.identityVerificationId as string) : null;
  await adminClient().from("audit_logs").insert({
    actor_role: "service",
    action: "identity_webhook_received",
    target_type: "identity_verification",
    target_id: identityVerificationId,
    meta: { type: event.type ?? null, provider: "portone" },
  });

  // TODO(Phase 4): identityVerificationId → 대기 중 프로필 매핑 → 서버-서버 조회 후 apply_identity_verification
  return json({ ok: true, received: event.type ?? null });
});
