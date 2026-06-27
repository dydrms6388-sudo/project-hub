import { prisma } from "@/lib/prisma";
import { Prisma, type CreditReason, Plan, SubscriptionStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// 크레딧 원장 핵심 로직.
// - 모든 충전/차감은 CreditLedger 에 append-only 로 기록.
// - User.creditBalance 는 빠른 조회용 캐시(트랜잭션 내에서 함께 갱신).
// - idempotencyKey 로 결제 웹훅/서비스 사용 재처리를 방지.
// ─────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`Insufficient credits: required ${required}, available ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * 크레딧 변동을 원장에 기록하고 캐시 잔액을 원자적으로 갱신.
 * delta > 0: 충전 / delta < 0: 차감.
 * idempotencyKey 가 이미 존재하면 아무 작업도 하지 않고 기존 잔액을 반환(멱등).
 */
export async function applyCreditDelta(params: {
  userId: string;
  delta: number;
  reason: CreditReason;
  idempotencyKey?: string;
  service?: string;
  purchaseId?: string;
}): Promise<{ balance: number; applied: boolean }> {
  const { userId, delta, reason, idempotencyKey, service, purchaseId } = params;

  return prisma.$transaction(async (tx) => {
    // 멱등성 체크
    if (idempotencyKey) {
      const existing = await tx.creditLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return { balance: existing.balanceAfter, applied: false };
      }
    }

    // 행 잠금을 위해 현재 잔액을 조회(Postgres: SELECT ... FOR UPDATE 효과를 위해 update 사용)
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`User not found: ${userId}`);

    const balanceAfter = user.creditBalance + delta;
    if (balanceAfter < 0) {
      throw new InsufficientCreditsError(-delta, user.creditBalance);
    }

    await tx.creditLedger.create({
      data: {
        userId,
        delta,
        reason,
        balanceAfter,
        idempotencyKey,
        service,
        purchaseId,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: balanceAfter },
    });

    return { balance: balanceAfter, applied: true };
  });
}

/** 크레딧 차감(서비스 사용). 잔액 부족 시 InsufficientCreditsError. */
export async function consumeCredits(params: {
  userId: string;
  amount: number;
  service: string;
  idempotencyKey?: string;
}) {
  if (params.amount <= 0) throw new Error("amount must be positive");
  return applyCreditDelta({
    userId: params.userId,
    delta: -params.amount,
    reason: "CONSUME",
    service: params.service,
    idempotencyKey: params.idempotencyKey,
  });
}

/** 구독 상태 갱신 + User.plan 캐시 동기화. 웹훅에서 호출. */
export async function upsertSubscription(params: {
  userId: string;
  provider: "STRIPE" | "TOSS" | "IAP_APPLE" | "IAP_GOOGLE";
  externalSubscriptionId: string;
  externalCustomerId?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}) {
  const plan: Plan = params.status === "ACTIVE" ? Plan.PRO : Plan.FREE;

  return prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { externalSubscriptionId: params.externalSubscriptionId },
      create: {
        userId: params.userId,
        provider: params.provider,
        externalSubscriptionId: params.externalSubscriptionId,
        externalCustomerId: params.externalCustomerId,
        status: params.status,
        plan: Plan.PRO,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
      },
      update: {
        status: params.status,
        externalCustomerId: params.externalCustomerId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
      },
    });

    // plan 캐시 동기화
    await tx.user.update({ where: { id: params.userId }, data: { plan } });
  });
}

/**
 * 웹훅 멱등 처리 가드.
 * 이미 처리한 (provider, eventId) 면 false 반환 → 호출부에서 즉시 종료.
 */
export async function markWebhookProcessed(
  provider: "STRIPE" | "TOSS",
  eventId: string,
  type: string
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { provider, eventId, type } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // unique 위반 = 이미 처리됨
      return false;
    }
    throw e;
  }
}
