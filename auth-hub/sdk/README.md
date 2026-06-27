# hub-sdk — 마이크로서비스 ↔ 허브(auth-hub) 연동 SDK

각 앱이 **통합 SSO(카카오/네이버/구글) + 중앙 과금(구독·크레딧·단건)** 을 쓰도록 붙이는 클라이언트.
허브(`tomatoeggcat.com`)가 인증·과금 권위 소스이고, 각 앱은 이 SDK 로 상태만 조회/소비한다.

> 키/계정/결제는 **사용자 몫**. SDK 는 placeholder ENV 만 쓴다(에이전트는 유료 API 직접 호출 안 함).

## 웹 (Next.js) — `web/hub-auth.ts`

앱의 `src/lib/hub-auth.ts` 로 복사. **프레임워크 비종속**(원격 `/api/me` 검증 → next-auth 의존성 불필요).

```ts
// 서버 컴포넌트/액션
import { getHubUser, requirePlan, requireCredits, deductCredits,
         hubLoginUrl, hubPricingUrl } from "@/lib/hub-auth";

const user = await getHubUser();              // HubUser | null  (SSO 쿠키 자동 전달)
if (user?.plan !== "PRO") redirect(hubPricingUrl());

await requireCredits(1);                       // 부족 시 throw HubAuthError
const r = await deductCredits({ amount: 1, service: "ai-tarot", idempotencyKey });
```

```ts
// middleware.ts
import { createHubMiddleware } from "@/lib/hub-auth";
export default createHubMiddleware({ protectedPrefixes: ["/premium", "/api/pro"] });
export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
```

ENV: `NEXT_PUBLIC_HUB_URL=https://tomatoeggcat.com`
SSO 쿠키 공유 전제 — 허브에 `AUTH_COOKIE_DOMAIN=.tomatoeggcat.com`, 앱은 같은 상위도메인/apex 서빙.

## 네이티브 (React Native / Expo) — `native/hubAuth.ts`, `native/hubBilling.ts`

앱의 `lib/` 로 복사. 의존성: `expo-web-browser expo-linking @react-native-async-storage/async-storage`
(+ 결제 시 `react-native-iap`).

```ts
import { loginWithHub, getMe, logout } from "@/lib/hubAuth";
const token = await loginWithHub();   // 인앱 브라우저 → 허브 SSO → 토큰 저장
const me = await getMe();             // HubUser | null

import { purchaseAndEntitle, restorePending } from "@/lib/hubBilling";
await purchaseAndEntitle("pro_monthly"); // 스토어 IAP → 허브 영수증검증 → 구독부여
```

설정:
- `app.json` 에 `"scheme": "<appscheme>"` 등록.
- 앱 ENV: `EXPO_PUBLIC_HUB_URL=https://tomatoeggcat.com`.
- 허브 ENV: `ALLOWED_MOBILE_SCHEMES` 에 `<appscheme>` 추가.
- 스토어 상품 ID 를 허브 `IAP_CATALOG`(credits_10/credits_50/pro_monthly/pro_yearly)와 일치.

## 허브 측 엔드포인트(이미 구현됨)

| 엔드포인트 | 용도 | 인증 |
|---|---|---|
| `/api/auth/[...nextauth]` | 카카오/네이버/구글 SSO | — |
| `/mobile/issue?redirect=` | 네이티브 로그인 브리지(토큰 발급) | 세션→토큰 |
| `/api/me` | 사용자 plan/credits 조회 | 쿠키 또는 Bearer |
| `/api/credits/deduct` | 크레딧 차감(멱등) | 쿠키 또는 Bearer |
| `/api/billing/iap/validate` | IAP 영수증 검증→엔타이틀먼트 | Bearer |
| `/api/billing/stripe/*`, `/api/billing/toss/*` | 웹 결제(구독/크레딧/단건) | 세션 |
| `/pricing` | 결제 페이지(토스/카카오페이/네이버페이 + Stripe) | — |

## 결제 수단 매핑

- **웹(국내 간편)**: 토스페이먼츠 결제위젯(카드/카카오페이/네이버페이/계좌). 허브 `/pricing`.
- **웹(해외)**: Stripe Checkout(구독·단건). PayPal 은 Stripe 또는 별도 연동으로 확장.
- **네이티브**: App Store/Play IAP(정책상 필수) → 허브 검증 → 동일 엔타이틀먼트.
