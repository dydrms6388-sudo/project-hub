import type { Metadata } from "next";
import Link from "next/link";
import { RestoreForm } from "@/components/start/restore-form";
import { env } from "@/lib/server/env";

export const metadata: Metadata = { title: "계정 복구" };

export default function RestorePage() {
  const provider = env().AUTH_PROVIDER;
  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10">
      <Link href="/start" className="text-muted-foreground mt-6 text-sm">
        ← 처음으로
      </Link>
      <h1 className="mt-6 text-2xl font-bold">이전 계정 복구</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {provider === "local"
          ? "내 프로필 → 계정 복구에서 저장해 둔 복구 코드를 입력하세요. 복구 코드가 없으면 기존 익명 계정은 되찾을 수 없어요."
          : "내 프로필에서 연결해 둔 이메일로 로그인 링크를 보내드려요. 이메일을 연결하지 않았다면 기존 익명 계정은 되찾을 수 없어요."}
      </p>
      <RestoreForm provider={provider} />
    </main>
  );
}
