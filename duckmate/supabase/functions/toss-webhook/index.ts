// supabase/functions/toss-webhook — Toss Payments 웹훅 수신 (Phase 1 = 501 stub, 로직 없음)
//
// 배포: `supabase functions deploy toss-webhook --no-verify-jwt` (Toss 는 Supabase JWT 를 보내지 않는다)
// 시크릿: TOSS_SECRET_KEY, TOSS_WEBHOOK_SECRET(있을 때), SUPABASE_SERVICE_ROLE_KEY (전부 `supabase secrets set`)
//
// ── Phase 3 처리 설계 (19_payments.md §3 시퀀스와 동일) ─────────────────────────────────────────
// 0. 메서드 POST 만. rawBody 를 **문자열 그대로** 보관(파싱 전) — 서명 검증은 원문 바이트 기준.
// 1. 서명 검증 (`TossPaymentProvider.verifyWebhook(rawBody, signature)`):
//    a) `TOSS_WEBHOOK_SECRET` 가 설정돼 있고 Toss 가 서명 헤더를 보내면 HMAC-SHA256 상수시간 비교 → 실패 400.
//    b) 서명 유무와 무관하게 **항상** 결제 조회 API `GET https://api.tosspayments.com/v1/payments/{paymentKey}`
//       (Basic base64(TOSS_SECRET_KEY + ':')) 로 status·totalAmount·orderId 를 재확인한다. 웹훅 본문은 힌트일 뿐
//       진실은 조회 결과다. 불일치 → 400 WEBHOOK_INVALID + audit_logs.
// 2. idempotency: 정규화된 이벤트의 (provider='toss', providerEventId) 를 `payment_events` 테이블에
//    `insert ... on conflict do nothing returning id` — 0행이면 이미 처리됨 → **200** 즉시 반환(재시도 중단).
//    ※ 스펙의 `payments.provider_event_id unique` 는 결제 1건에 이벤트 N개(paid → partial refund → refund)가
//      오므로 단일 컬럼으로는 부족하다. Phase 3 마이그레이션(0015~)에서 `payment_events(provider, provider_event_id)`
//      unique 로 확정하고, `payments(provider, provider_payment_id)` unique 는 결제 dedupe 로 그대로 쓴다.
// 3. 금액 서버 재계산: orderId → payments 행 → `skus.price_krw` 와 totalAmount 비교. 환불 이벤트는
//    `refund_requests.computed_refund_krw` 와 cancelAmount 비교. 불일치 → 처리 중단 + AMOUNT_MISMATCH 운영 알림.
// 4. 한 트랜잭션(service role, RPC `apply_payment_event(jsonb)` 로 위임 권장):
//    - payments upsert (status/paid_at/refunded_amount_krw/receipt_url)
//    - subscriptions: `select ... for update` → `transition(state, event)` 와 동일한 SQL 전이표 검사
//      (INVALID_TRANSITION 이면 행 미변경 + audit_logs, 응답은 200)
//    - item_ledger: delta 만 insert (purchase:{payment_id} / refund_reversal:{refund_id}), balance_after 는 트리거
//    - subscriptions_one_live_per_user 위반(23505) → DUPLICATE_SUBSCRIPTION: 전액 환불 요청 + 운영 알림(B3 §4.2)
// 5. 응답: 처리 성공/중복 200, 검증 실패 400, 내부 오류 500(Toss 재시도 유도). 본문은 항상 최소 JSON.
// 6. 로깅: paymentKey·orderId·eventType 만. 카드번호/이름은 Toss 가 보내지 않으며 저장할 필드도 없다.
// 7. 타임아웃: 결제 조회 API 5s, 전체 25s. 초과 시 500 (Toss 가 재시도 → idempotency 가 흡수).
// ───────────────────────────────────────────────────────────────────────────────────────────────

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get(key: string): string | undefined };
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

Deno.serve((req: Request): Response => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: JSON_HEADERS });
  }
  // Phase 3 전: 어떤 본문도 처리하지 않는다. Toss 대시보드에 이 URL 을 등록하는 것 자체가 Phase 3 체크리스트 항목.
  return new Response(JSON.stringify({ error: "PAYMENTS_DISABLED: Phase 3" }), { status: 501, headers: JSON_HEADERS });
});
