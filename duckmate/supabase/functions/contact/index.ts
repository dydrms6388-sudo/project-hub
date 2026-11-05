/**
 * contact — company 사이트 문의 폼 수신 (13_company_site 결정 7·9·10). E5 소유.
 *
 * 요청: POST JSON { email?: string|null, type: "partnership"|"press"|"safety"|"other", body: string, honeypot?: string }
 *      (호출자는 브라우저 — anon 키·JWT 없음. 배포 시 `supabase functions deploy contact --no-verify-jwt` 필수)
 * 처리: 허니팟 값 있으면 200 반환 후 폐기 → IP 해시 기준 시간당 5건 제한(429) → 검증 →
 *       service role 로 `inquiries` insert(email, category, body) →
 *       RESEND_API_KEY + CONTACT_NOTIFY_EMAIL 이 있으면 메일 알림(실패해도 insert 결과에 영향 없음).
 * 저장 매핑: inquiries.category enum 에 partnership/press 가 없으므로 safety→report, 그 외→general 로 저장하고
 *       body 첫 줄에 `[유형: {type}]` 을 붙여 어드민(/admin/inquiries)에서 구분한다. `name` 컬럼이 없으므로
 *       클라이언트가 body 앞에 `[보내신 분: …]` 한 줄을 결합한다.
 * 레이트리밋은 isolate 메모리 기준(콜드 스타트 시 초기화) — Phase 2 에서 테이블 기반으로 승격 검토.
 */
import { adminClient } from "../_shared/supabase.ts";
import { json, preflight } from "../_shared/cors.ts";

type InquiryType = "partnership" | "press" | "safety" | "other";
const TYPES: readonly InquiryType[] = ["partnership", "press", "safety", "other"];
const TYPE_LABEL: Record<InquiryType, string> = { partnership: "제휴", press: "언론", safety: "안전", other: "기타" };
const CATEGORY: Record<InquiryType, "general" | "report"> = { partnership: "general", press: "general", safety: "report", other: "general" };

const BODY_MIN = 10;
const BODY_MAX = 2000; // inquiries.body check (1..2000)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

async function ipHash(ip: string): Promise<string> {
  const salt = Deno.env.get("CONTACT_IP_SALT") ?? "duckmate-contact";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  // 메모리 상한: 오래된 키 정리
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

async function notify(type: InquiryType, email: string | null, body: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("CONTACT_NOTIFY_EMAIL");
  if (!apiKey || !to) return;
  const from = Deno.env.get("CONTACT_FROM_EMAIL") ?? "onboarding@resend.dev";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        ...(email ? { reply_to: email } : {}),
        subject: `[문의/${TYPE_LABEL[type]}] 새 문의가 도착했어요`,
        text: `${email ? `답장 주소: ${email}\n\n` : ""}${body}`,
      }),
    });
  } catch (e) {
    console.warn("contact: notify failed", e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { email?: unknown; type?: unknown; body?: unknown; honeypot?: unknown } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // 허니팟: 봇에게는 성공처럼 보이게 200 후 폐기
  if (typeof payload.honeypot === "string" && payload.honeypot.trim() !== "") return json({ ok: true });

  const key = await ipHash(clientIp(req));
  if (rateLimited(key)) return json({ error: "rate_limited" }, 429, { "retry-after": "3600" });

  const type = typeof payload.type === "string" && (TYPES as string[]).includes(payload.type) ? (payload.type as InquiryType) : null;
  if (!type) return json({ error: "invalid_type" }, 400);

  const rawEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  if (rawEmail && !EMAIL_RE.test(rawEmail)) return json({ error: "invalid_email" }, 400);
  const email = rawEmail || null;

  const rawBody = typeof payload.body === "string" ? payload.body.trim() : "";
  if (rawBody.length < BODY_MIN || rawBody.length > BODY_MAX) return json({ error: "invalid_body" }, 400);

  // 유형 라벨 1줄 결합 후 DB 제약(≤2000) 안으로 자름
  const body = `[유형: ${type}]\n${rawBody}`.slice(0, BODY_MAX);

  const { error } = await adminClient().from("inquiries").insert({ email, category: CATEGORY[type], body });
  if (error) {
    console.error("contact: insert failed", error.message);
    return json({ error: "insert_failed" }, 500);
  }

  await notify(type, email, body);
  return json({ ok: true });
});
