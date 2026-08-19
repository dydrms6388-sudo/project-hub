"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@duckmate/ui";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        setPending(true);
        void signOut().then(() => {
          router.push("/");
          router.refresh();
        });
      }}
    >
      로그아웃
    </Button>
  );
}
