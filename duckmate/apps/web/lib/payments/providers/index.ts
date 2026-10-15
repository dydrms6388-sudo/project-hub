/**
 * provider 선택 — 유일한 진입점. UI/서버 액션은 `getPaymentProvider()` 만 호출한다.
 *
 * 게이트 (모두 만족해야 활성):
 *  1. `PAYMENTS_ENABLED === 'true'` (서버 env. 클라이언트에는 노출하지 않고 서버 컴포넌트/액션에서만 판정)
 *  2. `app_settings.payments_enabled = true` (SQL 측 게이트 — get_effective_tier 가 읽음. 둘은 함께 켠다)
 *  3. 사업자 정보 완비: `COMPANY_NAME`·`ECOMMERCE_REG_NUMBER` 가 비어 있으면 강제 false (A4 §10, B2 §0-2).
 *     company config 는 E4 소유(`apps/web/config/company.ts`)라 여기서 import 하지 않고 `opts.companyInfoComplete` 로 주입한다.
 */
import { buildTarget, isNativeApp } from "../native";
import type { PaymentProvider } from "../types";
import { DisabledPaymentProvider } from "./disabled";
import { RevenueCatPaymentProvider } from "./revenuecat.stub";
import { TossPaymentProvider } from "./toss.stub";

export interface ProviderSelectOptions {
  /** 기본 process.env */
  env?: Record<string, string | undefined>;
  /** 기본 true (Phase 1 은 게이트 1 만으로 이미 disabled). E4 가 company config 로 채운다 */
  companyInfoComplete?: boolean;
  /** 테스트용. 기본 isNativeApp() */
  native?: boolean;
}

export function isPaymentsEnabled(opts: ProviderSelectOptions = {}): boolean {
  const env = opts.env ?? process.env;
  if (env.PAYMENTS_ENABLED !== "true") return false;
  if (opts.companyInfoComplete === false) return false;
  return true;
}

const disabled = new DisabledPaymentProvider();

export function getPaymentProvider(opts: ProviderSelectOptions = {}): PaymentProvider {
  if (!isPaymentsEnabled(opts)) return disabled;
  const native = opts.native ?? isNativeApp();
  if (native) return new RevenueCatPaymentProvider(buildTarget() === "ios" ? "apple" : "google");
  return new TossPaymentProvider();
}

export { DisabledPaymentProvider, RevenueCatPaymentProvider, TossPaymentProvider };
