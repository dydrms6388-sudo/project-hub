import { NextResponse, type NextRequest } from "next/server";
import { completeVerification } from "@/lib/identity/service";
import { toActionFailure } from "@/lib/auth/errors";
import { ROUTES } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

/**
 * 포트원 본인인증 리다이렉트 수신 (Phase 4 실연동 전 stub).
 *  - 사용자의 브라우저가 돌아오므로 세션 쿠키가 있다 → completeVerification() 이 서버-서버 조회로 최종 판정.
 *  - 결과는 /verify?result=… 또는 성공 시 /home 으로 302. 쿼리에 개인정보를 싣지 않는다.
 *  - 프로바이더가 오류를 붙여 보낸 경우(error=…) 그대로 /verify 로 전달만 한다.
 */
async function handle(request: NextRequest, params: URLSearchParams): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const providerError = params.get("error");
  if (providerError) return NextResponse.redirect(new URL(`${ROUTES.verify}?result=error&code=${encodeURIComponent(providerError)}`, origin));

  const payload: Record<string, unknown> = {};
  for (const key of ["identityVerificationId", "imp_uid", "merchant_uid", "token", "transactionType"]) {
    const v = params.get(key);
    if (v) payload[key] = v;
  }

  try {
    const result = await completeVerification(payload);
    if (result.ok) return NextResponse.redirect(new URL(result.data.redirectTo, origin));
    const to = result.redirectTo ?? `${ROUTES.verify}?result=error&code=${encodeURIComponent(result.code)}`;
    return NextResponse.redirect(new URL(to, origin));
  } catch (e) {
    const failure = toActionFailure(e);
    const to = failure.redirectTo ?? `${ROUTES.verify}?result=error&code=${encodeURIComponent(failure.code)}`;
    return NextResponse.redirect(new URL(to, origin));
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request, new URL(request.url).searchParams);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const params = new URLSearchParams();
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);
  } else if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(body)) if (typeof v === "string") params.set(k, v);
  }
  return handle(request, params);
}
