// ════════════════════════════════════════════════════════════════════
// hubBilling.ts — 네이티브 인앱결제(IAP) → 허브 엔타이틀먼트 연동
//
// 각 앱의 `lib/hubBilling.ts` 로 복사. 의존성: react-native-iap, 그리고 hubAuth.ts.
// 모바일은 디지털 상품을 스토어 IAP 로만 판매해야 하므로(정책), react-native-iap 로
// 결제하고 영수증을 허브 /api/billing/iap/validate 로 보내 크레딧/구독을 받는다.
//
// 스토어 상품 ID 는 허브 IAP_CATALOG 와 일치해야 한다:
//   credits_10, credits_50, pro_monthly, pro_yearly
// App Store Connect / Play Console 에서 동일 ID 로 상품을 등록(사용자 몫).
// ════════════════════════════════════════════════════════════════════

import { Platform } from "react-native";
import * as IAP from "react-native-iap";
import { hubFetch } from "./hubAuth";

export const CREDIT_SKUS = ["credits_10", "credits_50"] as const;
export const SUBSCRIPTION_SKUS = ["pro_monthly", "pro_yearly"] as const;
export const ALL_SKUS = [...CREDIT_SKUS, ...SUBSCRIPTION_SKUS];

export interface EntitlementResult {
  ok: boolean;
  kind?: "CREDITS" | "SUBSCRIPTION";
  balance?: number;
  plan?: "PRO";
  expiresAt?: string | null;
  error?: string;
}

let connected = false;

export async function initBilling(): Promise<void> {
  if (connected) return;
  await IAP.initConnection();
  connected = true;
}

export async function endBilling(): Promise<void> {
  if (!connected) return;
  await IAP.endConnection();
  connected = false;
}

/** 상점 상품 메타(가격 표시용) 조회. */
export async function loadProducts() {
  await initBilling();
  const subs = await IAP.getSubscriptions({ skus: SUBSCRIPTION_SKUS as unknown as string[] });
  const prods = await IAP.getProducts({ skus: CREDIT_SKUS as unknown as string[] });
  return { subscriptions: subs, products: prods };
}

/**
 * 구매 → 허브 검증 → 엔타이틀먼트.
 * 1) react-native-iap 로 결제 요청.
 * 2) 영수증(ios: transactionReceipt, android: purchaseToken)을 허브로 전송.
 * 3) 허브가 스토어에 영수증 검증 후 크레딧/구독 부여 → 결과 반환.
 * 4) finishTransaction 으로 거래 종료(중복 청구 방지).
 */
export async function purchaseAndEntitle(productId: string): Promise<EntitlementResult> {
  await initBilling();
  const isSub = (SUBSCRIPTION_SKUS as readonly string[]).includes(productId);

  const purchase = isSub
    ? await IAP.requestSubscription({ sku: productId })
    : await IAP.requestPurchase({ sku: productId });

  const p = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!p) return { ok: false, error: "no_purchase" };

  const receipt =
    Platform.OS === "ios"
      ? (p.transactionReceipt as string)
      : ((p as { purchaseToken?: string }).purchaseToken ??
         (p.transactionReceipt as string));

  const res = await hubFetch("/api/billing/iap/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: Platform.OS === "ios" ? "ios" : "android",
      productId,
      receipt,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as EntitlementResult;

  // 허브 검증 성공 시에만 거래 종료(서버 부여 보장).
  if (res.ok && data.ok) {
    try {
      await IAP.finishTransaction({ purchase: p, isConsumable: !isSub });
    } catch {
      /* 종료 실패는 다음 구동 시 재처리(멱등키로 중복 적립 방지됨) */
    }
    return { ok: true, ...data };
  }
  return { ok: false, error: data.error || `http_${res.status}` };
}

/** 앱 재구동 시 미완료 거래 재처리(영수증 재검증). 멱등키로 중복 적립 방지. */
export async function restorePending(): Promise<void> {
  await initBilling();
  const available = await IAP.getAvailablePurchases();
  for (const p of available) {
    const productId = (p as { productId?: string }).productId;
    if (!productId) continue;
    await purchaseAndEntitle(productId).catch(() => {});
  }
}
