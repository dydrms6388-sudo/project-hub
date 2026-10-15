// =============================================================================
// D5 · 신고 접수 Route Handler — POST /api/reports
//
// Server Action(submitReport)과 동일 코어(lib/moderation/service.ts 의
// submitReportCore)를 공유한다 — 검증·레이트 리밋·service role insert·스냅샷
// 호출까지 전부 코어 한 곳. 이 파일은 HTTP 상태 코드 매핑만 한다.
//
// 요청:  POST { targetId, matchId?, reasonCode, detail? }
// 응답:  201 { ok:true, data:{ reportId, slaDueAt } }
//        4xx/5xx { ok:false, code, message }  (코드 = ModerationErrorCode)
// 레이트 리밋: 동일 신고자→동일 대상 24h 1회 → 429 RATE_LIMITED (병합 안내).
//
// ※ 미들웨어가 /api/** 비로그인 요청을 /login 으로 리다이렉트하는 이슈는 D2 가
//   오케스트레이터에 이관한 상태(15_auth) — 여기서도 자체적으로 401 을 반환한다.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { submitReportCore } from "@/lib/moderation/service";
import type { ModerationErrorCode } from "@/lib/moderation/schemas";

const STATUS_BY_CODE: Record<ModerationErrorCode, number> = {
  INVALID_INPUT: 400,
  AUTH_REQUIRED: 401,
  PROFILE_NOT_FOUND: 401,
  TARGET_NOT_FOUND: 404,
  SELF_ACTION: 400,
  MATCH_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  APPEAL_NOT_ALLOWED: 403,
  APPEAL_WINDOW_EXPIRED: 403,
  APPEAL_DUPLICATE: 409,
  DB_ERROR: 500,
};

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_INPUT", message: "JSON 본문이 필요해요." },
      { status: 400 }
    );
  }

  const result = await submitReportCore(raw);
  if (!result.ok) {
    return NextResponse.json(result, { status: STATUS_BY_CODE[result.code] ?? 500 });
  }
  return NextResponse.json(result, { status: 201 });
}
