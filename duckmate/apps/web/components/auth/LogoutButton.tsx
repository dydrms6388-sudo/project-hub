"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@duckmate/ui";
import { signOut } from "@/app/(auth)/actions";
import { useOnboardingDraft } from "@/stores/onboardingDraft";
import { useSessionStore } from "@/stores/session";

/** 로그아웃 → 드래프트·세션 스토어 비우고 서버 redirectTo("/") */
export function LogoutButton({ label = "로그아웃", ...props }: Omit<ButtonProps, "onClick" | "children"> & { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const clearDraft = useOnboardingDraft((s) => s.clearAll);
  const clearSession = useSessionStore((s) => s.clear);
  return (
    <Button
      variant="outline"
      loading={pending}
      data-testid="logout"
      onClick={async () => {
        setPending(true);
        const res = await signOut();
        clearDraft();
        clearSession();
        router.replace(res.ok ? res.data.redirectTo : "/");
        router.refresh();
      }}
      {...props}
    >
      {label}
    </Button>
  );
}
