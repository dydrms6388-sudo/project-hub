import { isNativeApp, type WebOnlyProps } from "@/lib/payments/native";

/**
 * `<WebOnly>` — 웹 결제 유도 문구·Toss UI·가격 비교는 전부 이 안에만 둔다(09_store_policy 결정 10, 19_payments 결정 3).
 * `isNativeApp()` 이면 children 을 렌더하지 않고 fallback 만 보여준다(앱 빌드에서 3.1.1 위반 방지).
 */
export function WebOnly({ children, fallback = null }: WebOnlyProps) {
  if (isNativeApp()) return <>{fallback}</>;
  return <>{children}</>;
}
