# auth-billing — 설계 스텁

tomatoeggcat.com 허브용 통합 SSO + 중앙 과금 설계 스캐폴딩.

**이 디렉터리는 설계 참고용입니다. 실제 SDK 연동·네트워크 호출·시크릿 키 없음.**

---

## 디렉터리 구조

```
auth-billing/
├── README.md                  # 이 파일
├── env.example                # 환경변수 키 이름 목록 (값 없음)
├── types/
│   ├── auth.types.md          # 인증 관련 타입 설계
│   └── billing.types.md       # 과금 관련 타입 설계
├── interfaces/
│   ├── auth-provider.md       # Auth Provider 인터페이스 설계
│   └── billing-provider.md    # Billing Provider 인터페이스 설계
└── flows/
    ├── sso-flow.md            # SSO 로그인 플로우 설계
    ├── subscription-flow.md   # 구독 결제 플로우 설계
    └── credits-flow.md        # 크레딧 충전/차감 플로우 설계
```

---

## 빠른 시작 (실제 구현 시)

1. `env.example`을 `.env.local`로 복사하고 값 채우기 (사용자 본인이 직접)
2. `types/` 파일을 기반으로 TypeScript 타입 정의
3. `interfaces/` 설계를 보고 실제 SDK 연동 구현
4. `flows/` 시퀀스 다이어그램 따라 API 라우트 작성

---

## 기술 스택 추천 (설계 기준)

| 역할 | 추천 | 대안 |
|---|---|---|
| Auth | Clerk | NextAuth, Supabase Auth |
| DB | Supabase (Postgres) | PlanetScale, Neon |
| 결제 (글로벌) | Stripe | - |
| 결제 (한국) | 토스페이먼츠 | 아임포트(iamport) |
| 이메일 알림 | Resend | SendGrid |
| 세션 캐시 | Upstash Redis | - |
