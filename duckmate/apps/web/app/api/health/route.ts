import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 배포 헬스체크. 비밀값·DB 상태 미노출 */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true, service: "duckmate-web", time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
