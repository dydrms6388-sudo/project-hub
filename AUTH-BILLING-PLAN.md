# Auth & Billing Architecture Plan
# tomatoeggcat.com — 127 마이크로서비스 허브

작성일: 2026-06-24  
대상: 설계 참고용. 실제 키/계정/결제는 사용자 직접 처리.

---

## 배경 및 제약

- **허브**: tomatoeggcat.com (Vercel, project-hub)
- **마이크로서비스**: 127개, 각자 독립 Vercel 앱
- **수익 모델 병행**: Google AdSense (무료 트래픽) + 프리미엄 과금
- **주요 사용자**: 한국
- **결제 후보**: Stripe (글로벌), 토스페이먼츠 (한국 특화)

---

## 안 1 — 통합 SSO + 중앙 과금

### 개요

허브(tomatoeggcat.com)가 단일 인증·과금 서버 역할. 사용자는 한 계정으로 전 서비스 이용. 구독 및 크레딧을 중앙에서 관리.

### 아키텍처 흐름

```
사용자 브라우저
    │
    ▼
tomatoeggcat.com (허브)
    ├─ Auth Server (NextAuth / Supabase Auth / Clerk 중 택일)
    │       └─ JWT / Session 발급
    ├─ Billing API (Stripe / 토스페이먼츠 웹훅 수신)
    │       └─ 구독 상태 / 크레딧 잔액 → 중앙 DB
    └─ 공유 쿠키(도메인: .tomatoeggcat.com) 또는 JWT 전달
            │
            ▼
    마이크로서비스 (sub.tomatoeggcat.com 또는 별도 도메인)
            └─ JWT 검증만 → 허브 Auth API 호출 없이 stateless 검증
```

### 구독/크레딧 모델 설계 (계획만)

```
[사용자] → [허브 결제 페이지] → [Stripe Checkout / 토스페이먼츠 결제창]
    └─ 결제 완료 → 웹훅(POST /api/billing/webhook)
            └─ DB 업데이트: users.plan = 'pro' / credits += N
                    └─ 각 마이크로서비스: JWT claim 또는 API로 권한 확인
```

**웹훅 이벤트 처리 (설계)**
| 이벤트 | 처리 |
|---|---|
| `checkout.session.completed` | 구독 활성화 / 크레딧 충전 |
| `invoice.payment_succeeded` | 구독 갱신 확인 |
| `invoice.payment_failed` | 다운그레이드 / 알림 발송 |
| `customer.subscription.deleted` | 플랜 free로 복귀 |

### 장점

- **UX 최상**: 한 번 로그인으로 127개 서비스 이용
- **과금 중앙화**: 구독 상태 한 곳에서 관리, 환불·정지·업그레이드 단순
- **AdSense 병행 용이**: 비로그인 무료 트래픽은 그대로 AdSense 수익, 로그인 시 프리미엄 전환
- **분석 일원화**: 사용자당 전체 서비스 이용 패턴 통합 추적
- **브랜드 통일**: tomatoeggcat.com 계정 = 신뢰 자산

### 단점

- **허브 단일 장애점**: Auth 서버 다운 시 전 서비스 영향
- **도메인 정책**: 쿠키 공유는 서브도메인(`*.tomatoeggcat.com`)이어야 유효. 마이크로서비스가 별도 도메인이면 JWT 전달 방식으로 우회 필요
- **초기 구축 비용**: Auth 서버, DB, 웹훅 엔드포인트 구축 필요
- **Vercel 서버리스 제약**: 웹훅 수신 함수는 타임아웃·멱등성 설계 필요

### 구현 난이도

중상. Auth 라이브러리(Clerk, Supabase, NextAuth) 사용 시 2~4주 MVP 가능.

### 비용 추정

| 항목 | 비용 |
|---|---|
| Clerk (최대 10,000 MAU) | 무료 티어 → 월 $25~100 |
| Supabase Auth + DB | 무료 티어 → 월 $25~ |
| Stripe 거래 수수료 | 2.9% + $0.30 / 건 |
| 토스페이먼츠 | 약 2.2~3.3% / 건 |
| Vercel Pro (웹훅 함수) | 월 $20~ |

---

## 안 2 — 서비스별 개별 로그인 + 서비스별 과금

### 개요

각 마이크로서비스가 독립적으로 인증·과금. 사용자는 서비스마다 별도 계정(또는 소셜 로그인) 사용.

### 아키텍처 흐름

```
사용자 브라우저
    │
    ▼
마이크로서비스 A (dydrms-xxx.vercel.app)
    ├─ 자체 Auth (Google OAuth / 소셜 로그인)
    └─ 자체 결제 (Stripe Checkout 직접 연동)

마이크로서비스 B (dydrms-yyy.vercel.app)
    ├─ 자체 Auth (독립)
    └─ 자체 결제 (독립)

... × 127
```

### 장점

- **서비스별 독립성**: 한 서비스 장애가 타 서비스에 영향 없음
- **구현 단순**: 각 서비스에 Firebase Auth / Supabase Auth를 개별 붙이면 됨
- **점진적 적용**: 수익 가능성 있는 서비스만 선택해 과금 추가

### 단점

- **UX 최악**: 사용자가 서비스마다 가입·로그인 반복 (한국 사용자 이탈률 높음)
- **운영 지옥**: 127개 Auth 인스턴스 관리, 각각 보안 패치·세션 만료 정책
- **과금 분산**: 환불, 구독 취소가 서비스마다 달라 CS 대응 불가능 수준
- **AdSense 병행 복잡**: 서비스별 로그인 여부와 광고 표시 로직이 분산
- **데이터 분석 불가**: 사용자 행동을 서비스 간 연결 불가

### 구현 난이도

각 서비스는 쉬움. 그러나 127개 전체 운영은 사실상 불가능.

### 비용 추정

서비스당 Auth 비용 × 127 → 규모 커질수록 안 1보다 압도적으로 비쌈.

---

## 비교 요약

| 항목 | 안 1 (통합 SSO) | 안 2 (서비스별) |
|---|---|---|
| 사용자 경험 | 최상 (1계정) | 최악 (N계정) |
| 운영 부담 | 중앙 1곳 | 127곳 분산 |
| 과금 관리 | 중앙화, 단순 | 분산, 복잡 |
| AdSense 병행 | 자연스러움 | 가능하나 복잡 |
| 초기 구축 | 2~4주 | 서비스당 수일 |
| 장기 비용 | 낮음 | 높음 |
| 장애 범위 | Auth 다운 시 전체 | 서비스별 격리 |
| 보안 관리 | 1곳 집중 | 127곳 분산 관리 |
| 한국 서비스 적합성 | 높음 (카카오·네이버 SSO 연동 가능) | 낮음 |

---

## 추천안: 안 1 (통합 SSO + 중앙 과금)

**근거**:

1. **규모 효과**: 127개 서비스에서 개별 Auth를 운영하는 것은 현실적으로 불가능. SSO는 유지보수 비용을 1/127로 줄임.
2. **한국 사용자 특성**: 소셜 로그인(카카오·구글·네이버) 1회로 전 서비스 이용 가능한 UX가 이탈률을 크게 낮춤.
3. **AdSense 병행 최적**: 비로그인=AdSense 수익, 로그인=프리미엄 전환 퍼널이 자연스럽게 형성됨.
4. **과금 중앙화**: Stripe/토스페이먼츠 웹훅을 한 곳에서 처리, CS·환불·분석이 단순해짐.
5. **브랜드 자산**: `tomatoeggcat.com 계정` 자체가 서비스 락인 요소로 작동.

**단일 장애점 대책**: Auth 서버에 레디스 세션 캐시 + JWT stateless 검증 조합. 허브 다운 시에도 기발급 JWT로 단기 서비스 유지 가능하게 설계.

---

## 단계적 실행 로드맵

### Phase 0 — 준비 (1~2일)

- [ ] 도메인 구조 결정: 마이크로서비스를 `*.tomatoeggcat.com` 서브도메인으로 통일할지, 별도 도메인 유지할지
- [ ] Auth 라이브러리 선택 (권장: **Clerk** — 한국어 지원, 소셜 로그인, 웹훅 내장)
- [ ] DB 선택 (권장: **Supabase** — 무료 티어, Postgres, Row-Level Security)
- [ ] 결제 수단 선택: Stripe(글로벌) + 토스페이먼츠(한국 카드) 병행 권장

### Phase 1 — MVP Auth (1~2주)

- [ ] 허브에 Auth 엔드포인트 구축 (`/api/auth/*`)
- [ ] 소셜 로그인 연동: Google OAuth, 카카오 OAuth (사용자가 앱 키 직접 발급)
- [ ] JWT 발급 로직: `{ userId, plan, credits, exp }` 포함
- [ ] 마이크로서비스 1개에 JWT 검증 미들웨어 적용 (파일럿)
- [ ] 쿠키 도메인 정책 설정 (`Domain=.tomatoeggcat.com` 또는 JWT 헤더 방식)

### Phase 2 — MVP 과금 (1~2주)

- [ ] 허브에 결제 페이지 구축 (`/pricing`, `/checkout`)
- [ ] Stripe Checkout 세션 생성 API (사용자가 Stripe 계정·키 직접 발급)
- [ ] 웹훅 엔드포인트 (`/api/billing/webhook`) — 서명 검증 + DB 업데이트
- [ ] 구독 플랜 테이블 설계: `free | pro | credits`
- [ ] 토스페이먼츠 연동 시: 별도 결제 위젯 + 웹훅 병행 (사용자가 상점 키 직접 발급)

### Phase 3 — 마이크로서비스 전체 연동 (2~4주)

- [ ] JWT 검증 공통 미들웨어 패키지화 (내부 npm 패키지 또는 공유 유틸)
- [ ] 각 마이크로서비스에 미들웨어 적용 (서비스당 30분~1시간)
- [ ] 권한 게이트: `requirePlan('pro')`, `requireCredits(1)` 래퍼 함수
- [ ] AdSense 병행 로직: 비로그인 사용자에게만 광고 표시, 프리미엄 사용자 광고 제거

### Phase 4 — 운영 강화 (지속)

- [ ] 어드민 대시보드: 구독 현황, 크레딧 잔액, 웹훅 로그
- [ ] 이메일 알림: 구독 만료 D-7, 결제 실패 (SendGrid / Resend — 사용자 계정 직접)
- [ ] 레이트 리밋: 비로그인/free 사용자 요청 제한
- [ ] 모니터링: Sentry 에러 추적, Vercel Analytics
- [ ] 보안: CSRF 토큰, JWT 로테이션, 웹훅 서명 검증 재확인

---

## 결제 연동 설계 (계획만)

### Stripe 구독 플로우

```
1. 사용자 → /pricing 클릭 "Pro 구독"
2. 허브 API: POST /api/billing/create-checkout-session
   └─ Stripe SDK: stripe.checkout.sessions.create({ mode: 'subscription', ... })
   └─ 반환: { url: 'https://checkout.stripe.com/...' }
3. 사용자 → Stripe Checkout 페이지 (Stripe 호스팅)
4. 결제 완료 → Stripe가 웹훅 POST /api/billing/webhook
5. 허브: 서명 검증 → DB users 테이블 업데이트
6. 다음 JWT 발급 시 plan: 'pro' 포함
```

### 토스페이먼츠 단건 결제 (크레딧 충전)

```
1. 사용자 → /credits 페이지 "크레딧 10개 충전"
2. 허브: 토스페이먼츠 결제 위젯 로드 (클라이언트 사이드)
3. 결제 완료 → 클라이언트가 orderId + paymentKey 수신
4. 허브 API: POST /api/billing/toss-confirm
   └─ 토스 서버 API 호출로 결제 승인
   └─ DB credits += N
5. JWT 재발급 또는 credits 필드 갱신
```

### 크레딧 차감 설계

```
마이크로서비스 서버 함수:
  1. JWT 파싱 → userId, credits
  2. credits < 필요량 → 403 + "크레딧 부족" 응답
  3. 허브 API: POST /api/credits/deduct { userId, amount }
     └─ 원자적 DB 업데이트 (SELECT FOR UPDATE 또는 DB 트랜잭션)
  4. 성공 시 서비스 로직 실행
```

---

## 중요 고지

- 이 문서는 **설계 계획**이며, 실제 Stripe/토스페이먼츠 키 발급, 계정 생성, 결제 실행은 **사용자(개발자) 본인이 직접** 수행해야 합니다.
- 소셜 OAuth 앱 등록(Google Cloud Console, 카카오 개발자 센터)도 사용자 책임입니다.
- 실제 시크릿 키는 절대 코드에 커밋하지 말고, Vercel 환경변수 또는 `.env.local`(gitignore)에만 보관하세요.
