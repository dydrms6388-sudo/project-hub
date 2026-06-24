import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { consumeCredits, InsufficientCreditsError } from "@/lib/billing/credits";

export const runtime = "nodejs";

// POST /api/credits/deduct
// 마이크로서비스가 사용자 크레딧을 차감할 때 호출.
// 인증: 허브 세션(쿠키) 또는 마이크로서비스가 전달한 JWT 가 미들웨어/auth 로 검증됨.
// body: { amount: number, service: string, idempotencyKey?: string }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { amount, service, idempotencyKey } = (await req
    .json()
    .catch(() => ({}))) as {
    amount?: number;
    service?: string;
    idempotencyKey?: string;
  };

  if (!amount || amount <= 0 || !service) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const { balance, applied } = await consumeCredits({
      userId: session.user.id,
      amount,
      service,
      idempotencyKey,
    });
    return NextResponse.json({ ok: true, balance, applied });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          required: err.required,
          available: err.available,
        },
        { status: 402 }
      );
    }
    console.error("deduct error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
