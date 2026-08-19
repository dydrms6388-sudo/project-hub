// =============================================================================
// D2 · 본인인증 시작/콜백 Route Handler — /api/auth/verify-identity
//
// POST { action: "request" }
//   → 활성 verifier 로 인증 세션 시작. { redirectUrl? , token? } 반환.
//     - StubVerifier 경로: token 만 반환 → 클라이언트가 곧바로 confirm 호출.
//     - PortOneVerifier(Phase 4): 인증창 redirectUrl 반환.
// POST { action: "confirm", payload }
//   → verifier.confirmVerification → 성공 시 service role 로 Lv2 승급
//     (blocked_hashes 차단·미성년 banned 처리 포함 — lib/auth/verify.ts).
// GET ?token=...   (Stub/E2E 콜백 편의 경로)
//   → confirm 과 동일 처리 후 /verify?status=... 로 리다이렉트.
//
// 인증 필수 — 미들웨어의 /login 리다이렉트와 별개로 여기서도 401 을 반환한다.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIdentityVerifier, isReviewBypassEmail } from "@/lib/auth/identity-verifier";
import { promoteIdentityVerified } from "@/lib/auth/verify";
import { verifyConfirmSchema } from "@/lib/auth/schemas";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function runConfirm(
  userId: string,
  email: string | null | undefined,
  payload: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 프로덕션 stub 차단(G2-01)은 팩토리에서 throw 로 나온다 — 503 으로 매핑.
  let verifier;
  try {
    verifier = getIdentityVerifier(email);
  } catch (e) {
    const message = e instanceof Error ? e.message : "verifier error";
    return { status: 503, body: { ok: false, code: "VERIFIER_NOT_CONFIGURED", message } };
  }

  let result;
  try {
    result = await verifier.confirmVerification(userId, payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "verifier error";
    const code = message.includes("NOT_CONFIGURED") ? "VERIFIER_NOT_CONFIGURED" : "VERIFY_FAILED";
    return { status: 503, body: { ok: false, code, message } };
  }

  // G2-01(b): 생년월일은 **신뢰 출처(PortOne/PASS)** 응답에서만 요구·사용한다.
  //   stub 은 birthDate 를 반환하지 않으므로 여기서 필수로 걸면 안 된다.
  const trusted = verifier.name === "portone";
  if (!result.ok || !result.ci || (trusted && !result.birthDate)) {
    return {
      status: 400,
      body: { ok: false, code: "VERIFY_FAILED", message: result.reason ?? "본인인증에 실패했어요." },
    };
  }

  const promotion = await promoteIdentityVerified(userId, {
    ci: result.ci,
    birthDate: result.birthDate ?? null,
    trusted,
    phone: result.phone,
    // 화이트리스트 이메일이 Stub 경로를 탄 경우 감사로그에 bypass 표기 (B3 오픈이슈 6)
    bypass: verifier.name === "stub" && isReviewBypassEmail(email),
  });

  if (!promotion.ok) {
    const status =
      promotion.code === "DB_ERROR" ? 500 : promotion.code === "CI_ALREADY_REGISTERED" ? 409 : 403;
    return { status, body: { ok: false, code: promotion.code, message: promotion.message } };
  }
  return { status: 200, body: { ok: true, verifyLevel: promotion.verifyLevel } };
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "로그인이 필요해요." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "JSON 본문이 필요해요." }, { status: 400 });
  }
  const parsed = verifyConfirmSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "action 을 확인해 주세요." }, { status: 400 });
  }

  if (parsed.data.action === "request") {
    try {
      const verifier = getIdentityVerifier(user.email);
      const session = await verifier.requestVerification(user.id);
      return NextResponse.json({ ok: true, verifier: verifier.name, ...session });
    } catch (e) {
      const message = e instanceof Error ? e.message : "verifier error";
      const code = message.includes("NOT_CONFIGURED") ? "VERIFIER_NOT_CONFIGURED" : "VERIFY_FAILED";
      return NextResponse.json({ ok: false, code, message }, { status: 503 });
    }
  }

  // action === "confirm"
  const { status, body } = await runConfirm(user.id, user.email, parsed.data.payload ?? {});
  return NextResponse.json(body, { status });
}

/** Stub/E2E 콜백 편의 경로 — ?token=stub:{userId} 를 confirm 으로 처리 후 /verify 로 복귀 */
export async function GET(request: NextRequest) {
  const user = await getAuthedUser();
  const url = request.nextUrl.clone();
  url.search = "";

  if (!user) {
    url.pathname = "/login";
    url.searchParams.set("next", "/verify");
    return NextResponse.redirect(url);
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const { body } = await runConfirm(user.id, user.email, { token });

  url.pathname = "/verify";
  url.searchParams.set("status", body.ok === true ? "success" : String(body.code ?? "VERIFY_FAILED"));
  return NextResponse.redirect(url);
}
