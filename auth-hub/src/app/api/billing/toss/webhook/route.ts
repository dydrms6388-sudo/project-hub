import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markWebhookProcessed } from "@/lib/billing/credits";

export const runtime = "nodejs";

// 토스 웹훅(가상계좌 입금완료/결제취소 등 비동기 이벤트).
// 토스는 표준 HMAC 서명 헤더 대신, 등록한 IP/시크릿으로 검증하는 방식을 쓴다.
// 여기서는 TOSS_WEBHOOK_SECRET 를 헤더 토큰으로 대조하는 단순 가드를 제공(운영 시 토스 문서에 맞춰 강화).
export async function POST(req: Request) {
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  const provided = req.headers.get("x-toss-webhook-secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as
    | { eventType?: string; data?: { orderId?: string; status?: string; paymentKey?: string } }
    | null;
  if (!payload?.data?.orderId) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }

  const eventId = `${payload.data.orderId}:${payload.data.status ?? payload.eventType ?? "evt"}`;
  const fresh = await markWebhookProcessed("TOSS", eventId, payload.eventType ?? "unknown");
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

  // 가상계좌 입금완료 등으로 PENDING → PAID 전환 시 크레딧 반영 로직을 여기에 추가.
  // (confirm 라우트와 동일 멱등키 stratey 사용 권장)
  if (payload.data.status === "DONE") {
    await prisma.purchase.updateMany({
      where: { externalOrderId: payload.data.orderId, status: "PENDING" },
      data: { status: "PAID", externalPaymentId: payload.data.paymentKey ?? null },
    });
    // NOTE: 크레딧/구독 반영은 confirm 라우트에서 동기 처리되는 것이 일반적.
    // 가상계좌 전용 흐름이면 여기서 applyCreditDelta 를 호출하도록 확장.
  }

  return NextResponse.json({ received: true });
}
