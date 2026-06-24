import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PRODUCTS } from "@/lib/billing/catalog";
import PricingClient from "./pricing-client";

export default async function PricingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pricing");

  return (
    <div>
      <h1 style={{ fontSize: 24 }}>멤버십 / 크레딧</h1>
      <p style={{ opacity: 0.7 }}>
        결제 수단을 선택하세요. 글로벌 카드는 Stripe, 국내 카드/간편결제는 토스페이먼츠.
      </p>
      <PricingClient
        products={Object.values(PRODUCTS).map((p) => ({
          id: p.id,
          name: p.name,
          amountKRW: p.amountKRW,
          kind: p.kind,
          credits: p.credits ?? 0,
        }))}
        userId={session.user.id}
        customerName={session.user.name ?? session.user.email ?? "고객"}
      />
    </div>
  );
}
