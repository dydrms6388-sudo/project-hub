// =============================================================================
// D7 · 푸시 구독 등록/해제 Route Handler — /api/push
//
// 요청:
//   POST   { subscription: PushSubscription.toJSON() }  → 201 { ok, data:{ tokenId } }
//   DELETE { endpoint: string }                          → 200 { ok }
//   GET                                                  → 200 { ok, data:{ subscribed, count } }
//
// 로직은 전부 `@/lib/notifications/actions` 의 Server Action 을 재사용한다
// (D5 의 /api/reports ↔ submitReportCore 와 같은 "코어 1곳" 규약).
// 이 파일이 추가로 하는 일은 두 가지뿐:
//   ① 프로필 게이트 — 미들웨어는 세션 유무만 보고 401 을 낸다(D2 규약). 그 위에서
//      profiles 행 존재 + status='active' 를 확인해 정지/차단 계정의 토큰 등록을 막는다.
//      (해제(DELETE)는 게이트를 적용하지 않는다 — 수신 중단은 언제나 허용해야 하므로.
//       정보통신망법 §50 "수신거부는 무료·즉시" 와 정합)
//   ② ActionResult.code → HTTP 상태코드 매핑.
//
// 클라이언트 진입점은 `lib/notifications/subscribe.ts` (fetch 경로 고정).
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerPushToken, unregisterPushToken } from "@/lib/notifications/actions";
import type { ActionErrorCode } from "@/lib/auth/schemas";

// 세션 쿠키를 읽으므로 정적 최적화 대상에서 제외
export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<ActionErrorCode, number> = {
  INVALID_INPUT: 400,
  UNDERAGE: 403,
  AUTH_REQUIRED: 401,
  AUTH_FAILED: 401,
  EMAIL_TAKEN: 409,
  PROFILE_NOT_FOUND: 401,
  STEP_ORDER: 409,
  CONTACT_INFO_BLOCKED: 400,
  VERIFY_LEVEL_REQUIRED: 403,
  PHONE_BLOCKED: 403,
  CI_BLOCKED: 403,
  CI_ALREADY_REGISTERED: 409,
  VERIFIER_NOT_CONFIGURED: 503,
  VERIFY_FAILED: 400,
  DB_ERROR: 500,
};

/** 도메인 전용 코드 (lib/auth/schemas.ts 는 D2 소유 파일이라 확장하지 않는다 — D5-7 선례) */
type PushApiErrorCode = ActionErrorCode | "PROFILE_NOT_ACTIVE";

function errorResponse(code: PushApiErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

type ProfileGate =
  | { ok: true; profileId: string }
  | { ok: false; response: NextResponse };

/**
 * 프로필 게이트 — 미들웨어 401 위에 얹는 2차 검증.
 * banned/suspended 프로필은 토큰을 새로 등록하지 못한다(발송 대상 선정 함수도
 * status='active' 만 고르므로 등록해봐야 무의미 + 제재 회피성 재구독 방지).
 */
async function requireActiveProfile(): Promise<ProfileGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: errorResponse("AUTH_REQUIRED", "로그인이 필요해요.", 401) };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return { ok: false, response: errorResponse("DB_ERROR", "프로필 조회에 실패했어요.", 500) };
  }
  const profile = data as { id: string; status: string } | null;
  if (!profile) {
    return { ok: false, response: errorResponse("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.", 401) };
  }
  if (profile.status !== "active") {
    return {
      ok: false,
      response: errorResponse("PROFILE_NOT_ACTIVE", "지금은 알림을 설정할 수 없는 계정 상태예요.", 403),
    };
  }
  return { ok: true, profileId: profile.id };
}

async function readJson(request: NextRequest): Promise<{ ok: true; raw: unknown } | { ok: false }> {
  try {
    return { ok: true, raw: await request.json() };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// POST — 구독 등록 (멱등: push_tokens (user_id, token) unique upsert)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const gate = await requireActiveProfile();
  if (!gate.ok) return gate.response;

  const body = await readJson(request);
  if (!body.ok) return errorResponse("INVALID_INPUT", "JSON 본문이 필요해요.", 400);

  const result = await registerPushToken(body.raw);
  if (!result.ok) {
    return NextResponse.json(result, { status: STATUS_BY_CODE[result.code] ?? 500 });
  }
  return NextResponse.json(result, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — 구독 해제 (endpoint 일치 토큰 is_active=false)
// 브라우저 구독 취소(subscription.unsubscribe())는 클라이언트가 먼저 수행한다.
// sw.js 의 pushsubscriptionchange 폴백도 이 경로로 옛 endpoint 를 정리한다.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return errorResponse("INVALID_INPUT", "JSON 본문이 필요해요.", 400);

  const result = await unregisterPushToken(body.raw);
  if (!result.ok) {
    return NextResponse.json(result, { status: STATUS_BY_CODE[result.code] ?? 500 });
  }
  return NextResponse.json(result, { status: 200 });
}

// ---------------------------------------------------------------------------
// GET — 서버 기준 구독 상태 (E4 알림 설정 화면의 토글 초기값 교차 확인용).
// 브라우저 구독 존재 여부는 isPushSubscribed()(클라이언트)가, 서버 등록 여부는
// 이쪽이 답한다. 둘이 어긋나면 화면은 "다시 켜기"(재구독)를 노출하면 된다.
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", "로그인이 필요해요.", 401);

  const { count, error } = await supabase
    .from("push_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("platform", "web")
    .eq("is_active", true);
  if (error) return errorResponse("DB_ERROR", "구독 상태 조회에 실패했어요.", 500);

  const active = count ?? 0;
  return NextResponse.json({ ok: true, data: { subscribed: active > 0, count: active } });
}
