import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 보호 라우트(미들웨어가 비로그인 차단). 구독·크레딧 원장 요약 표시.
export default async function DashboardPage() {
  const session = await auth();
  // 미들웨어가 보호하지만, 직접 접근 안전장치.
  if (!session?.user?.id) {
    return <p>로그인이 필요합니다. <Link href="/login">로그인</Link></p>;
  }

  const [subscription, ledger] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creditLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24 }}>대시보드</h1>
      <p style={{ opacity: 0.8 }}>
        플랜 <strong>{session.user.plan}</strong> · 크레딧{" "}
        <strong>{session.user.credits}</strong>
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>구독</h2>
        {subscription ? (
          <p>
            {subscription.provider} · {subscription.plan} · {subscription.status}
            {subscription.currentPeriodEnd
              ? ` · 만료 ${subscription.currentPeriodEnd.toLocaleDateString("ko-KR")}`
              : ""}
          </p>
        ) : (
          <p style={{ opacity: 0.7 }}>
            활성 구독 없음. <Link href="/pricing">Pro 구독하기</Link>
          </p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>최근 크레딧 내역</h2>
        {ledger.length === 0 ? (
          <p style={{ opacity: 0.7 }}>내역 없음.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {ledger.map((l) => (
              <li key={l.id}>
                {l.delta > 0 ? "+" : ""}
                {l.delta} ({l.reason}) → 잔액 {l.balanceAfter}{" "}
                <span style={{ opacity: 0.5 }}>
                  {l.createdAt.toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/pricing">멤버십/크레딧 구매</Link>
      </p>
    </div>
  );
}
