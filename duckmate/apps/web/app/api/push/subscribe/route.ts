import { NextResponse } from "next/server";
import { HTTP_STATUS } from "@/lib/auth/errors";
import { subscribePush, unsubscribePush } from "@/lib/push/actions";

export const dynamic = "force-dynamic";

/**
 * 서비스워커 `pushsubscriptionchange` 재구독 경로 (sw 는 서버 액션을 못 부른다).
 * 쿠키 세션 기준 본인 구독만 갱신. 브라우저 UI 는 서버 액션 subscribePush 를 직접 쓴다.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
  }
  const result = await subscribePush(body as Parameters<typeof subscribePush>[0]);
  if (!result.ok) return NextResponse.json(result, { status: HTTP_STATUS[result.code] ?? 400 });
  return NextResponse.json({ ok: true, subscriptionId: result.data.subscriptionId }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
  }
  const result = await unsubscribePush(body as Parameters<typeof unsubscribePush>[0]);
  if (!result.ok) return NextResponse.json(result, { status: HTTP_STATUS[result.code] ?? 400 });
  return NextResponse.json({ ok: true, removed: result.data.removed }, { headers: { "cache-control": "no-store" } });
}
