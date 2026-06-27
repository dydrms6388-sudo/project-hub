import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/request-user";
import {
  verifyIapReceipt,
  getIapEntitlement,
  type IapPlatform,
} from "@/lib/billing/iap";
import { applyCreditDelta, upsertSubscription } from "@/lib/billing/credits";

export const runtime = "nodejs";

// POST /api/billing/iap/validate
// 네이티브 앱(react-native-iap)이 스토어 결제 완료 후 영수증을 보내 엔타이틀먼트를 받는다.
// 인증: Authorization: Bearer <mobile JWT> (네이티브) 또는 세션 쿠키.
// body: { platform: "ios"|"android", productId: string, receipt: string }
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { platform, productId, receipt } = (await req
    .json()
    .catch(() => ({}))) as {
    platform?: IapPlatform;
    productId?: string;
    receipt?: string;
  };

  if (!platform || !productId || !receipt) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const entitlement = getIapEntitlement(productId);
  if (!entitlement) {
    return NextResponse.json({ error: "unknown_product" }, { status: 400 });
  }

  // 1) 스토어에 영수증 검증(위변조 방지). 키 미설정 시 valid:false 로 명확히 실패.
  const result = await verifyIapReceipt({ platform, productId, receipt });
  if (!result.valid) {
    return NextResponse.json(
      { error: "receipt_invalid", detail: result.error },
      { status: 402 }
    );
  }

  const provider = platform === "ios" ? "IAP_APPLE" : "IAP_GOOGLE";

  try {
    if (entitlement.kind === "CREDITS") {
      // 멱등키 = 스토어 트랜잭션 ID. 영수증 재전송 시 중복 적립 방지.
      const { balance, applied } = await applyCreditDelta({
        userId: user.id,
        delta: entitlement.credits ?? 0,
        reason: "PURCHASE",
        idempotencyKey: `iap:${provider}:${result.transactionId}`,
        service: "iap",
      });
      return NextResponse.json({ ok: true, kind: "CREDITS", balance, applied });
    }

    // SUBSCRIPTION
    await upsertSubscription({
      userId: user.id,
      provider,
      externalSubscriptionId: `${provider}:${result.transactionId}`,
      status: "ACTIVE",
      currentPeriodEnd: result.expiresAt,
    });
    return NextResponse.json({
      ok: true,
      kind: "SUBSCRIPTION",
      plan: "PRO",
      expiresAt: result.expiresAt ?? null,
    });
  } catch (err) {
    console.error("iap validate error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
