// 상품 카탈로그(서버 권위 소스). 토스 결제 금액 검증·크레딧 지급량을 여기서 결정.
// 클라이언트가 보내는 금액을 신뢰하지 않고 이 표와 대조한다.

export type ProductId = "pro_monthly" | "pro_yearly" | "credits_10";

export interface Product {
  id: ProductId;
  kind: "SUBSCRIPTION" | "CREDITS";
  name: string;
  amountKRW: number; // 토스(원)
  credits?: number; // CREDITS 일 때 지급량
  stripePriceEnv?: string; // Stripe Price ID 가 들어있는 ENV 이름
}

export const PRODUCTS: Record<ProductId, Product> = {
  pro_monthly: {
    id: "pro_monthly",
    kind: "SUBSCRIPTION",
    name: "Pro 월간 구독",
    amountKRW: 4900,
    stripePriceEnv: "STRIPE_PRICE_PRO_MONTHLY",
  },
  pro_yearly: {
    id: "pro_yearly",
    kind: "SUBSCRIPTION",
    name: "Pro 연간 구독",
    amountKRW: 49000,
    stripePriceEnv: "STRIPE_PRICE_PRO_YEARLY",
  },
  credits_10: {
    id: "credits_10",
    kind: "CREDITS",
    name: "크레딧 10개",
    amountKRW: 3300,
    credits: 10,
    stripePriceEnv: "STRIPE_PRICE_CREDITS_10",
  },
};

export function getProduct(id: string): Product | undefined {
  return PRODUCTS[id as ProductId];
}
