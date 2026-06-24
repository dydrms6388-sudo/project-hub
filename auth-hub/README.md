# auth-hub — 통합 SSO + 중앙 과금 허브

`tomatoeggcat.com` 허브가 단일 인증·과금 서버 역할을 하는 Next.js(App Router) 프로젝트.
한 계정으로 127개 마이크로서비스를 이용하고, 구독·크레딧·단건구매를 중앙에서 관리한다.

> 이 저장소에는 **실제 시크릿 키가 없다.** 모든 키는 `.env.example` 의 placeholder 이며,
> 사용자가 직접 발급해 `.env.local`(gitignore) 또는 Vercel 환경변수에 넣는다.

---

## 기술 스택

| 역할 | 선택 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) |
| 인증 | Auth.js (NextAuth v5) — Google(내장) + 카카오/네이버(커스텀 OAuth provider) |
| 세션 | JWT (stateless, 마이크로서비스에서 검증 가능) |
| DB | Prisma + Neon(Postgres) |
| 결제 | Stripe(글로벌) + 토스페이먼츠(국내) 병행 |

---

## 동작 개요

### 인증 (SSO)
- `/api/auth/[...nextauth]` 가 모든 인증 엔드포인트 처리(signin/callback/signout/session).
- 프로바이더 3종: `google`, `kakao`, `naver`. 카카오/네이버는 `src/lib/providers.ts` 에서
  authorization/token/userinfo 엔드포인트와 scope, profile 매핑을 직접 구성.
- 세션 전략 = **JWT**. JWT 콜백에서 `uid·plan·credits` 를 실어 stateless 검증을 지원
  (`src/auth.ts`). DB 어댑터(`@auth/prisma-adapter`)로 User/Account 는 영속.
- `src/middleware.ts` 가 `/dashboard`, `/account`, `/credits` 를 보호(비로그인 → `/login`).
- 서브도메인 SSO 가 필요하면 `AUTH_COOKIE_DOMAIN=.tomatoeggcat.com` 설정 → 쿠키 공유.

### 과금 (구독 / 크레딧 / 단건)
- 데이터 모델: `Subscription`, `CreditLedger`(append-only 원장), `Purchase`, `WebhookEvent`(멱등).
  `User.plan`, `User.creditBalance` 는 빠른 조회용 캐시(웹훅/원장이 트랜잭션으로 동기화).
- **Stripe**: `POST /api/billing/stripe/checkout` → Checkout Session 생성.
  `POST /api/billing/stripe/webhook` → 서명 검증 후 구독 상태/크레딧 반영
  (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`).
- **토스페이먼츠**: 클라이언트 결제위젯(`pricing-client.tsx`)으로 결제 →
  `POST /api/billing/toss/confirm` 에서 서버 승인 + 금액 검증 + 크레딧/구독 반영.
  `POST /api/billing/toss/webhook` 는 가상계좌 등 비동기 이벤트용.
- **크레딧 차감**: `POST /api/credits/deduct` (마이크로서비스가 호출). `applyCreditDelta`
  가 트랜잭션 + `idempotencyKey` 로 원자적·멱등 처리, 잔액 부족 시 402.
- 금액 위변조 방지: 서버 카탈로그(`src/lib/billing/catalog.ts`)가 권위 소스. 클라이언트가
  보낸 금액을 신뢰하지 않고 대조.

### 파일 구조
```
auth-hub/
├── prisma/schema.prisma          # User/Account/Session/Subscription/CreditLedger/Purchase/WebhookEvent
├── src/auth.ts                   # Auth.js v5 설정(프로바이더·어댑터·JWT 콜백)
├── src/middleware.ts             # 보호 라우트
├── src/types/next-auth.d.ts      # 세션/JWT 타입 확장(plan, credits)
├── src/lib/
│   ├── prisma.ts                 # Prisma 싱글톤
│   ├── providers.ts              # 카카오/네이버 커스텀 OAuth provider
│   └── billing/
│       ├── catalog.ts            # 상품 카탈로그(금액·크레딧 권위 소스)
│       ├── credits.ts            # 원장/구독/멱등 핵심 로직
│       ├── stripe.ts             # Stripe SDK 싱글톤
│       └── toss.ts               # 토스 승인 API 헬퍼
└── src/app/
    ├── page.tsx  login/  dashboard/  pricing/(+pricing-client.tsx)
    └── api/
        ├── auth/[...nextauth]/route.ts
        ├── me/route.ts
        ├── credits/deduct/route.ts
        └── billing/stripe/{checkout,webhook}/  billing/toss/{confirm,webhook}/
```

---

## 설치 → 빌드 → 배포 절차

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 준비
cp .env.example .env.local
#    → .env.local 에 실제 키 입력 (아래 "사용자가 직접 할 일" 참고)

# 3) DB 마이그레이션 (Neon 연결 후)
npx prisma migrate dev --name init      # 로컬/개발
#    배포 환경에서는:  npx prisma migrate deploy

# 4) 빌드 & 로컬 실행
npm run build       # prisma generate + next build
npm run dev         # http://localhost:3000

# 5) 배포 (Vercel) — 현재 한도 소진 상태이므로 추후 진행
#    - Vercel 프로젝트 연결 후 환경변수 등록(.env.local 값과 동일)
#    - Build Command: npm run build  (postinstall 로 prisma generate 자동)
#    - Stripe/Toss 웹훅 URL 을 배포 도메인으로 등록
```

---

## 사용자가 직접 할 일 (핵심)

1. **Google OAuth**: [console.cloud.google.com](https://console.cloud.google.com) → OAuth 클라이언트 ID 생성.
   승인된 리디렉션 URI에 `{AUTH_URL}/api/auth/callback/google` 등록 →
   `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
2. **카카오 OAuth**: [developers.kakao.com](https://developers.kakao.com) → 앱 생성, 카카오 로그인 활성화,
   Redirect URI `{AUTH_URL}/api/auth/callback/kakao`, 동의항목(닉네임·프로필·이메일),
   Client Secret 사용 → `KAKAO_CLIENT_ID`(REST API 키) / `KAKAO_CLIENT_SECRET`.
3. **네이버 OAuth**: [developers.naver.com](https://developers.naver.com) → 애플리케이션 등록,
   Callback URL `{AUTH_URL}/api/auth/callback/naver` → `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`.
4. **Neon DB**: [neon.tech](https://neon.tech) 프로젝트 생성 → `DATABASE_URL`(pooled),
   `DIRECT_URL`(direct) 설정 후 `npx prisma migrate deploy` 실행.
5. **Stripe**: [dashboard.stripe.com](https://dashboard.stripe.com) → API 키 + 상품/Price 생성 →
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`. 웹훅 엔드포인트 `{AUTH_URL}/api/billing/stripe/webhook`
   등록 후 서명 시크릿 → `STRIPE_WEBHOOK_SECRET`.
6. **토스페이먼츠**: [developers.tosspayments.com](https://developers.tosspayments.com) → 상점/키 발급 →
   `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`. 가상계좌 사용 시 웹훅 등록.
   카탈로그 금액(`catalog.ts`)을 실제 판매가에 맞게 조정.
7. **AUTH_SECRET**: `openssl rand -base64 32` 로 생성해 설정. 서브도메인 SSO면
   `AUTH_COOKIE_DOMAIN=.tomatoeggcat.com`.
8. **배포**: Vercel 프로젝트 연결 + 위 환경변수 등록 + 결제사 웹훅 URL을 배포 도메인으로 갱신.

> 주의: 시크릿 키는 절대 코드/깃에 커밋하지 말 것. `.env*.local` 은 `.gitignore` 에 포함되어 있다.
> 에이전트는 유료 API를 직접 호출/테스트하지 않으며, 위 키들은 서비스 런타임에서만 사용된다.
