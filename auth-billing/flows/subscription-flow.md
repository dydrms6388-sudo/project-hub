# 구독 결제 플로우 설계

---

## Stripe 구독 플로우 (Pro 월간/연간)

```
사용자              허브 API                    Stripe               Supabase DB
  │                    │                           │                      │
  │── /pricing 방문 ──>│                           │                      │
  │<── 플랜 목록 ───────│                           │                      │
  │                    │                           │                      │
  │── "Pro 구독" 클릭 ->│                           │                      │
  │                    │── checkout.sessions.create │                      │
  │                    │   { priceId, customerId } >│                      │
  │                    │<── { url: checkout_url } ──│                      │
  │<── 리디렉트 ────────│                           │                      │
  │                    │                           │                      │
  │── Stripe Checkout 결제 완료 ────────────────>│                      │
  │                    │                           │                      │
  │                    │<── 웹훅 POST /api/billing/webhook                │
  │                    │    checkout.session.completed                    │
  │                    │── 서명 검증 (STRIPE_WEBHOOK_SECRET)              │
  │                    │── users.plan = 'pro' 업데이트 ──────────────────>│
  │                    │── subscriptions.upsert() ───────────────────────>│
  │                    │<── 200 OK ──────────────────────────────────────│
  │                    │                           │                      │
  │── 허브 /dashboard ->│                           │                      │
  │                    │── 새 JWT 발급 (plan: 'pro')                      │
  │<── 프리미엄 접근 ───│                           │                      │
```

---

## 구독 갱신 (자동)

```
Stripe (매월 자동)          허브 API                  Supabase DB
      │                         │                          │
      │── 웹훅 invoice.payment_succeeded ──────────────>│
      │                         │── 구독 상태 active 유지  │
      │                         │── updated_at 갱신 ───────>│
      │<── 200 OK ──────────────│                          │
```

---

## 결제 실패 처리

```
Stripe                      허브 API                  사용자
  │                            │                          │
  │── 웹훅 invoice.payment_failed ────────────────────>│
  │                            │── users.plan = 'free'    │
  │                            │── 이메일 알림 발송 ──────>│
  │<── 200 OK ──────────────── │                          │
  │                            │                          │
  │                            │                     사용자 로그인 시
  │                            │<── "결제 실패, 재결제 필요" 배너
```

---

## 구독 취소

```
사용자              허브 API                  Stripe             Supabase DB
  │                    │                        │                     │
  │── "구독 취소" 클릭->│                        │                     │
  │                    │── stripe.subscriptions.update                │
  │                    │   { cancel_at_period_end: true } ───────────>│
  │                    │<── subscription 객체 ───│                     │
  │                    │── subscriptions 업데이트 ────────────────────>│
  │<── "기간 종료 후 취소 예정" 안내 ─────────────────────────────────│
  │                    │                        │                     │
  │              (기간 만료 시)                  │                     │
  │                    │<── 웹훅 customer.subscription.deleted ────>│
  │                    │── users.plan = 'free' ───────────────────────>│
```

---

## 토스페이먼츠 구독 (정기결제) 설계 메모

토스페이먼츠 정기결제는 빌링키 발급 후 서버에서 직접 결제 요청하는 방식.
Stripe Checkout과 달리 클라이언트 + 서버 양쪽 작업 필요.

```
1. 클라이언트: 토스 결제 위젯으로 카드 등록 → 빌링키 수신
2. 서버: POST /api/billing/toss-register { billingKey, customerId }
   → toss_customer_key를 DB에 저장
3. 매월 서버 크론 또는 스케줄러:
   → POST https://api.tosspayments.com/v1/billing/{billingKey}
   → 결제 성공 시 구독 연장, 실패 시 다운그레이드
```

**중요**: 실제 토스페이먼츠 상점 키 발급 및 빌링키 등록은 사용자 본인이 직접 수행.
