import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/billing/stripe";
import { getProduct } from "@/lib/billing/catalog";

export const runtime = "nodejs";

// POST /api/billing/stripe/checkout
// body: { productId: "pro_monthly" | "pro_yearly" | "credits_10" }
// Stripe Checkout Session 을 생성하고 결제 URL 을 반환한다.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { productId } = (await req.json().catch(() => ({}))) as {
    productId?: string;
  };
  const product = productId ? getProduct(productId) : undefined;
  if (!product || !product.stripePriceEnv) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }

  const priceId = process.env[product.stripePriceEnv];
  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // 결제 성공 후 크레딧/구독을 누구에게 반영할지: metadata 로 userId·product 운반.
  const checkout = await stripe.checkout.sessions.create({
    mode: product.kind === "SUBSCRIPTION" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: session.user.email ?? undefined,
    client_reference_id: session.user.id,
    metadata: {
      userId: session.user.id,
      productId: product.id,
      credits: String(product.credits ?? 0),
    },
    // 구독 모드에서도 metadata 가 subscription 으로 전파되도록.
    subscription_data:
      product.kind === "SUBSCRIPTION"
        ? { metadata: { userId: session.user.id, productId: product.id } }
        : undefined,
    success_url: `${siteUrl}/dashboard?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancel`,
  });

  // PENDING 구매 기록(웹훅이 PAID 로 갱신).
  await prisma.purchase.create({
    data: {
      userId: session.user.id,
      provider: "STRIPE",
      kind: product.kind === "SUBSCRIPTION" ? "SUBSCRIPTION" : "CREDITS",
      status: "PENDING",
      amount: 0, // 실제 금액은 웹훅에서 amount_total 로 확정
      currency: "usd",
      creditsGranted: product.credits ?? 0,
      externalOrderId: checkout.id,
    },
  });

  return NextResponse.json({ url: checkout.url });
}
