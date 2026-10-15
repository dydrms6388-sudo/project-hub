// =============================================================================
// E4 · /sanctioned — 제재 안내 전용 화면 (12_flows §8.3)
//
// · (main) 가드가 level 3+ 활성 제재 회원을 전 라우트에서 여기로 보낸다.
// · 로그인 자체는 허용되고, **이 화면에서 곧바로 이의제기**할 수 있어야 한다
//   (A5 §3.3 이의제기 접근권 보장) — /appeal 로 튕기지 않고 폼을 인라인 제공한다.
// · 위반 기준·제재 단계·이의제기 방법 링크를 함께 노출한다(08_legal_docs §4-E4-5).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { MySanction, Profile } from "@duckmate/db";
import { createClient } from "@/lib/supabase/server";
import { SanctionList } from "../(main)/appeal/sanction-list";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이용 제한 안내",
  robots: { index: false, follow: false },
};

function isActive(sanction: MySanction): boolean {
  if (sanction.status !== "ACTIVE") return false;
  return sanction.ends_at === null || new Date(sanction.ends_at) > new Date();
}

export default async function SanctionedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRow as Profile | null;

  const { data } = await supabase
    .from("my_sanctions")
    .select("*")
    .order("created_at", { ascending: false });
  const sanctions = (data ?? []) as MySanction[];
  const blocking = sanctions.filter((s) => isActive(s) && s.level >= 3);

  // 제재가 풀렸는데 이 화면에 남아 있을 이유는 없다.
  if (blocking.length === 0 && profile?.status !== "banned") redirect("/home");

  const permanent = blocking.some((s) => s.level === 5) || profile?.status === "banned";
  const endsAt = blocking
    .map((s) => s.ends_at)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8 text-ink">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">이용이 제한됐어요</h1>
        <p className="text-body">
          {permanent
            ? "커뮤니티 가이드라인 위반으로 계정 이용이 영구적으로 제한됐어요. 같은 본인확인 정보로는 다시 가입할 수 없어요."
            : endsAt
              ? `${new Date(endsAt).toLocaleString("ko-KR")}까지 서비스 이용이 제한돼요.`
              : "서비스 이용이 일시적으로 제한됐어요."}
        </p>
        <p className="text-body-sm text-ink-muted">
          제재 내용이 사실과 다르다고 생각하면 아래에서 바로 이의를 제기할 수 있어요. 통보 후 30일
          이내, 제재 건당 1회예요.
        </p>
      </header>

      <SanctionList sanctions={blocking.length > 0 ? blocking : sanctions} />

      <section className="flex flex-col gap-2 border-t border-line pt-4 text-body-sm">
        <Link href="/legal/community" className="text-primary underline underline-offset-2">
          커뮤니티 가이드라인 전문
        </Link>
        <Link href="/legal/terms#제13조" className="text-primary underline underline-offset-2">
          이용약관 제13조 (신고·제재와 이의제기)
        </Link>
        {permanent && (
          <Link href="/legal/refund#제7조" className="text-primary underline underline-offset-2">
            환불정책 제7조 — 영구정지 회원도 미사용분은 환불돼요
          </Link>
        )}
      </section>

      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
