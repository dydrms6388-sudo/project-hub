import Stripe from "stripe";

// Stripe SDK 싱글톤. 키는 런타임 ENV 에서만 읽는다(에이전트가 직접 호출하지 않음).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });
  return _stripe;
}

// 크레딧 상품 정의: Price ID → 지급 크레딧 매핑.
// Stripe 대시보드의 Price metadata 에 credits 를 넣어도 되지만, 여기서는 정적 매핑.
export const CREDIT_PACKS: Record<string, number> = {
  [process.env.STRIPE_PRICE_CREDITS_10 ?? "__credits10"]: 10,
};

export const SUBSCRIPTION_PRICES = new Set(
  [
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_PRO_YEARLY,
  ].filter(Boolean) as string[]
);
