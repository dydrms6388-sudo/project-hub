"use client";

import { useEffect, useState } from "react";

interface ProductView {
  id: string;
  name: string;
  amountKRW: number;
  kind: "SUBSCRIPTION" | "CREDITS";
  credits: number;
}

export default function PricingClient({
  products,
  userId,
  customerName,
}: {
  products: ProductView[];
  userId: string;
  customerName: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 토스 successUrl 리다이렉트 처리: 쿼리(paymentKey/orderId/amount)를 서버 confirm 으로 최종 승인.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("toss") !== "success") return;
    const paymentKey = q.get("paymentKey");
    const orderId = q.get("orderId");
    const amount = Number(q.get("amount"));
    const productId = q.get("productId");
    if (!paymentKey || !orderId || !amount || !productId) return;

    (async () => {
      setNotice("결제 승인 중...");
      const res = await fetch("/api/billing/toss/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount, productId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = "/dashboard?checkout=success";
      } else {
        setError(`토스 결제 승인 실패: ${data.error ?? res.status}`);
        setNotice(null);
      }
    })();
  }, []);

  // ── Stripe: 서버에서 Checkout Session 생성 후 리다이렉트 ──
  async function payWithStripe(productId: string) {
    setBusy(productId + ":stripe");
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "checkout_failed");
      window.location.href = data.url; // Stripe 결제 페이지로 이동
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  // ── 토스페이먼츠: 결제위젯 호출 → 성공 시 서버 confirm ──
  // 운영 시 @tosspayments/payment-sdk(또는 payment-widget) 를 동적 import 하여
  // requestPayment 를 호출한다. 아래는 연동 골격(런타임 키 사용, 에이전트가 호출하지 않음).
  async function payWithToss(p: ProductView) {
    setBusy(p.id + ":toss");
    setError(null);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey || clientKey.startsWith("PLACEHOLDER")) {
        throw new Error("토스 클라이언트 키가 설정되지 않았습니다(.env).");
      }
      const orderId = `toss_${p.id}_${userId}_${Date.now()}`;

      // 동적 import (SSR 회피). 패키지: @tosspayments/payment-sdk
      const { loadTossPayments } = await import("@tosspayments/payment-sdk");
      const toss = await loadTossPayments(clientKey);

      const successUrl = `${window.location.origin}/pricing?toss=success&productId=${p.id}`;
      const failUrl = `${window.location.origin}/pricing?toss=fail`;

      // requestPayment 는 성공 시 successUrl 로 리다이렉트되며
      // 쿼리로 paymentKey/orderId/amount 를 전달 → 그 페이지(또는 핸들러)에서 confirm 호출.
      await toss.requestPayment("카드", {
        amount: p.amountKRW,
        orderId,
        orderName: p.name,
        customerName,
        successUrl,
        failUrl,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
      {products.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #2a2a35",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div style={{ opacity: 0.7, margin: "4px 0 12px" }}>
            {p.amountKRW.toLocaleString("ko-KR")}원
            {p.kind === "CREDITS" ? ` · 크레딧 ${p.credits}개` : " · 구독"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => payWithStripe(p.id)} disabled={!!busy}>
              {busy === p.id + ":stripe" ? "처리 중..." : "Stripe 결제"}
            </button>
            <button onClick={() => payWithToss(p)} disabled={!!busy}>
              {busy === p.id + ":toss" ? "처리 중..." : "토스 결제"}
            </button>
          </div>
        </div>
      ))}
      {notice && <p style={{ color: "#7cc7ff" }}>{notice}</p>}
      {error && <p style={{ color: "#ff6b6b" }}>오류: {error}</p>}
    </div>
  );
}
