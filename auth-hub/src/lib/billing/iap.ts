// ─────────────────────────────────────────────────────────────
// 인앱결제(IAP) 영수증 검증.
// 모바일 앱(App Store / Google Play)은 디지털 상품을 스토어 IAP 로만 팔 수 있다
// (외부 PG 사용 시 정책 위반). 따라서 네이티브 앱은 react-native-iap 로 결제하고,
// 영수증을 허브로 보내 검증 → 검증 성공 시 크레딧/구독 엔타이틀먼트를 부여한다.
//
// 키/시크릿은 사용자가 발급(APPLE_SHARED_SECRET, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON).
// 에이전트는 실제 스토어 API 를 호출하지 않으며, 런타임에서만 동작한다.
// ─────────────────────────────────────────────────────────────

export type IapPlatform = "ios" | "android";

export interface IapVerifyResult {
  valid: boolean;
  productId: string;
  // 스토어 트랜잭션 식별자(멱등키로 사용).
  transactionId: string;
  // 구독 여부 / 만료(구독일 때).
  isSubscription: boolean;
  expiresAt?: Date;
  raw?: unknown;
  error?: string;
}

// 스토어 상품 ID → 허브 엔타이틀먼트 매핑(권위 소스).
// 사용자가 App Store Connect / Play Console 에서 만든 상품 ID 와 일치시켜야 한다.
export interface IapEntitlement {
  kind: "CREDITS" | "SUBSCRIPTION";
  credits?: number;
}

export const IAP_CATALOG: Record<string, IapEntitlement> = {
  "credits_10": { kind: "CREDITS", credits: 10 },
  "credits_50": { kind: "CREDITS", credits: 50 },
  "pro_monthly": { kind: "SUBSCRIPTION" },
  "pro_yearly": { kind: "SUBSCRIPTION" },
};

export function getIapEntitlement(productId: string): IapEntitlement | undefined {
  return IAP_CATALOG[productId];
}

/** Apple App Store 영수증 검증(verifyReceipt). 프로덕션 실패(21007) 시 샌드박스 재시도. */
async function verifyApple(
  receipt: string,
  productIdHint?: string
): Promise<IapVerifyResult> {
  const password = process.env.APPLE_SHARED_SECRET;
  if (!password) {
    return {
      valid: false,
      productId: productIdHint ?? "",
      transactionId: "",
      isSubscription: false,
      error: "APPLE_SHARED_SECRET not configured",
    };
  }

  const body = JSON.stringify({
    "receipt-data": receipt,
    password,
    "exclude-old-transactions": true,
  });

  async function call(host: string) {
    const res = await fetch(`https://${host}/verifyReceipt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    return res.json() as Promise<{
      status: number;
      receipt?: { in_app?: AppleLine[] };
      latest_receipt_info?: AppleLine[];
    }>;
  }

  type AppleLine = {
    product_id: string;
    transaction_id: string;
    original_transaction_id?: string;
    expires_date_ms?: string;
  };

  let data = await call("buy.itunes.apple.com");
  if (data.status === 21007) {
    // 샌드박스 영수증을 프로덕션에 보냈을 때.
    data = await call("sandbox.itunes.apple.com");
  }

  if (data.status !== 0) {
    return {
      valid: false,
      productId: productIdHint ?? "",
      transactionId: "",
      isSubscription: false,
      error: `apple_status_${data.status}`,
      raw: data,
    };
  }

  const lines = data.latest_receipt_info ?? data.receipt?.in_app ?? [];
  // productIdHint 가 주어지면 반드시 그 상품이 영수증에 존재해야 한다.
  // (마지막 라인으로 폴백하면 다른 상품 영수증으로 엉뚱한 엔타이틀먼트를 받게 되므로 금지.)
  const line = productIdHint
    ? lines.find((l) => l.product_id === productIdHint)
    : lines[lines.length - 1];
  if (!line) {
    return {
      valid: false,
      productId: productIdHint ?? "",
      transactionId: "",
      isSubscription: false,
      error: "no_transactions",
      raw: data,
    };
  }

  const expiresAt = line.expires_date_ms
    ? new Date(Number(line.expires_date_ms))
    : undefined;
  return {
    valid: true,
    productId: line.product_id,
    transactionId: line.original_transaction_id ?? line.transaction_id,
    isSubscription: Boolean(expiresAt),
    expiresAt,
    raw: data,
  };
}

/**
 * Google Play 영수증 검증.
 * 실제 검증은 Google Play Developer API(androidpublisher) + 서비스 계정 OAuth 가 필요.
 * 사용자가 GOOGLE_PLAY_SERVICE_ACCOUNT_JSON / GOOGLE_PLAY_PACKAGE_NAME 를 설정하고
 * googleapis 의존성을 추가하면 활성화된다. 미설정 시 명확한 에러를 반환.
 */
async function verifyGoogle(
  purchaseToken: string,
  productId: string
): Promise<IapVerifyResult> {
  if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    return {
      valid: false,
      productId,
      transactionId: "",
      isSubscription: false,
      error: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured",
    };
  }
  // 런타임 구현 자리: googleapis androidpublisher.purchases.products/subscriptions.get
  // 으로 purchaseToken 검증 후 결과 매핑. 키 미보유 상태이므로 호출하지 않는다.
  return {
    valid: false,
    productId,
    transactionId: purchaseToken.slice(0, 24),
    isSubscription: false,
    error: "google_verification_not_implemented_runtime",
  };
}

export async function verifyIapReceipt(params: {
  platform: IapPlatform;
  receipt: string; // ios: base64 receipt-data, android: purchaseToken
  productId: string;
}): Promise<IapVerifyResult> {
  if (params.platform === "ios") {
    return verifyApple(params.receipt, params.productId);
  }
  return verifyGoogle(params.receipt, params.productId);
}
