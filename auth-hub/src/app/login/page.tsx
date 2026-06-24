import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

// 간편 로그인 페이지 — 카카오/네이버/구글 3종. 서버 액션으로 signIn 호출.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  if (session?.user) redirect(callbackUrl ?? "/dashboard");

  const redirectTo = callbackUrl ?? "/dashboard";

  const buttons: { id: string; label: string; bg: string; fg: string }[] = [
    { id: "kakao", label: "카카오로 시작하기", bg: "#FEE500", fg: "#191600" },
    { id: "naver", label: "네이버로 시작하기", bg: "#03C75A", fg: "#ffffff" },
    { id: "google", label: "Google로 시작하기", bg: "#ffffff", fg: "#1f1f1f" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>로그인 / 회원가입</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {buttons.map((b) => (
          <form
            key={b.id}
            action={async () => {
              "use server";
              await signIn(b.id, { redirectTo });
            }}
          >
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 10,
                border: "none",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                background: b.bg,
                color: b.fg,
              }}
            >
              {b.label}
            </button>
          </form>
        ))}
      </div>
      <p style={{ opacity: 0.5, fontSize: 12, marginTop: 24 }}>
        로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </p>
    </div>
  );
}
