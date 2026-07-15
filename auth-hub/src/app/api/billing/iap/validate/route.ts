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

  // 1) 스토어에 영수증 검증(위변조 방지). 키 미설정 시 valid:false 로 명확히 실패.
  const result = await verifyIapReceipt({ platform, productId, receipt });
  if (!result.valid) {
    return NextResponse.json(
      { error: "receipt_invalid", detail: result.error },
      { status: 402 }
    );
  }

  // 2) 엔타이틀먼트는 "검증된 영수증의 상품"(result.productId)에서만 도출한다.
  //    클라이언트가 보낸 productId 를 신뢰하면 싼 상품 영수증으로 비싼 구독을 탈취할 수 있으므로,
  //    검증된 상품과 요청 상품이 일치하는지 확인하고, 매핑도 검증된 상품 기준으로 얻는다.
  if (result.productId !== productId) {
    return NextResponse.json({ error: "product_mismatch" }, { status: 400 });
  }
  const entitlement = getIapEntitlement(result.productId);
  if (!entitlement) {
    return NextResponse.json({ error: "unknown_product" }, { status: 400 });
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
    // 만료된 구독 영수증으로 ACTIVE(PRO) 를 부여하지 않는다 — 이미 만료된 영수증이
    // 무기한 PRO 로 이어지는 것을 막는다(검증된 만료시각 기준).
    if (result.expiresAt && result.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "subscription_expired", expiresAt: result.expiresAt },
        { status: 402 }
      );
    }
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
