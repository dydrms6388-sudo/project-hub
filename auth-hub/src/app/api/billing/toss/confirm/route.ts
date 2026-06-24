import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confirmTossPayment } from "@/lib/billing/toss";
import { getProduct } from "@/lib/billing/catalog";
import { applyCreditDelta, upsertSubscription } from "@/lib/billing/credits";

export const runtime = "nodejs";

// POST /api/billing/toss/confirm
// 클라이언트 결제위젯 성공 콜백이 넘긴 값을 서버에서 최종 승인.
// body: { paymentKey, orderId, amount, productId }
// 흐름: 1) 주문 검증(서버 카탈로그 금액과 amount 일치) 2) 토스 승인 API 3) 크레딧/구독 반영
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
    productId?: string;
  };
  const { paymentKey, orderId, amount, productId } = body;

  if (!paymentKey || !orderId || typeof amount !== "number" || !productId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const product = getProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }

  // 금액 위변조 방지: 클라이언트가 보낸 amount 를 서버 카탈로그와 대조.
  if (amount !== product.amountKRW) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  // 멱등: 이미 처리된 orderId 면 중복 승인 금지.
  const existing = await prisma.purchase.findUnique({
    where: { externalOrderId: orderId },
  });
  if (existing?.status === "PAID") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // PENDING 구매 기록(없으면 생성).
  const purchase = await prisma.purchase.upsert({
    where: { externalOrderId: orderId },
    create: {
      userId,
      provider: "TOSS",
      kind: product.kind,
      status: "PENDING",
      amount: product.amountKRW,
      currency: "KRW",
      creditsGranted: product.credits ?? 0,
      externalOrderId: orderId,
    },
    update: {},
  });

  // 토스 서버 승인.
  let result;
  try {
    result = await confirmTossPayment({ paymentKey, orderId, amount });
  } catch (err) {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: "toss_confirm_failed", detail: (err as Error).message },
      { status: 402 }
    );
  }

  if (result.status !== "DONE") {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: "not_done", status: result.status }, { status: 402 });
  }

  // 결제 성공 반영.
  await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: "PAID", externalPaymentId: result.paymentKey },
  });

  if (product.kind === "CREDITS") {
    await applyCreditDelta({
      userId,
      delta: product.credits ?? 0,
      reason: "PURCHASE",
      idempotencyKey: `toss:${orderId}`,
      purchaseId: purchase.id,
    });
  } else if (product.kind === "SUBSCRIPTION") {
    // 토스 단건 승인으로 1기간 구독 활성화(정기결제는 빌링키로 확장).
    const now = new Date();
    const end = new Date(now);
    if (product.id === "pro_yearly") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    await upsertSubscription({
      userId,
      provider: "TOSS",
      externalSubscriptionId: `toss_${orderId}`,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: end,
    });
  }

  return NextResponse.json({ ok: true });
}
