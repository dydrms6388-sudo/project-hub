import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import {
  applyCreditDelta,
  markWebhookProcessed,
  upsertSubscription,
} from "@/lib/billing/credits";
import type { SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";

// Stripe 웹훅은 raw body 로 서명 검증해야 하므로 본문을 직접 text() 로 읽는다.
export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature_verification_failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  // 멱등 가드: 동일 이벤트 재전송 무시.
  const fresh = await markWebhookProcessed("STRIPE", event.id, event.type);
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const userId = cs.metadata?.userId;
        const credits = Number(cs.metadata?.credits ?? 0);
        if (!userId) break;

        // 단건(크레딧) 결제: 즉시 크레딧 충전.
        if (cs.mode === "payment" && credits > 0) {
          await prisma.purchase.updateMany({
            where: { externalOrderId: cs.id },
            data: {
              status: "PAID",
              amount: cs.amount_total ?? 0,
              currency: cs.currency ?? "usd",
              externalPaymentId:
                typeof cs.payment_intent === "string"
                  ? cs.payment_intent
                  : null,
            },
          });
          await applyCreditDelta({
            userId,
            delta: credits,
            reason: "PURCHASE",
            idempotencyKey: `stripe:${cs.id}`,
          });
        }

        // 구독 결제: subscription 객체 갱신은 아래 subscription.* 이벤트가 담당.
        if (cs.mode === "subscription") {
          await prisma.purchase.updateMany({
            where: { externalOrderId: cs.id },
            data: {
              status: "PAID",
              amount: cs.amount_total ?? 0,
              currency: cs.currency ?? "usd",
            },
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await upsertSubscription({
          userId,
          provider: "STRIPE",
          externalSubscriptionId: sub.id,
          externalCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          status: mapStripeStatus(sub.status),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await upsertSubscription({
          userId,
          provider: "STRIPE",
          externalSubscriptionId: sub.id,
          status: "CANCELED",
        });
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId =
          typeof inv.subscription === "string" ? inv.subscription : null;
        if (subId) {
          await prisma.subscription.updateMany({
            where: { externalSubscriptionId: subId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      default:
        // 처리 안 하는 이벤트는 무시(200 으로 ack).
        break;
    }
  } catch (err) {
    // 처리 실패 시 500 → Stripe 가 재시도. 멱등 레코드는 이미 생성되었으므로
    // 재시도 시 중복 처리될 위험을 줄이려면 실패 시 WebhookEvent 를 롤백하는 전략도 가능.
    console.error("stripe webhook handler error", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}
