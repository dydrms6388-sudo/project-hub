import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>tomatoeggcat 허브</h1>
      <p style={{ opacity: 0.7, marginBottom: 32 }}>
        한 계정으로 모든 서비스. 통합 SSO + 중앙 과금.
      </p>

      {session?.user ? (
        <div>
          <p>
            안녕하세요, <strong>{session.user.name ?? session.user.email}</strong> 님
          </p>
          <p style={{ opacity: 0.8 }}>
            플랜: <strong>{session.user.plan}</strong> · 크레딧:{" "}
            <strong>{session.user.credits}</strong>
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <Link href="/dashboard">대시보드</Link>
            <Link href="/pricing">멤버십/크레딧</Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit">로그아웃</button>
            </form>
          </div>
        </div>
      ) : (
        <Link href="/login">
          <button style={{ padding: "10px 20px" }}>로그인</button>
        </Link>
      )}
    </div>
  );
}
