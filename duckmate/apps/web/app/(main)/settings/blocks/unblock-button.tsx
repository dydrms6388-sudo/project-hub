"use client";

// =============================================================================
// E4 · 차단 해제 버튼 (client) — lib/moderation unblockUser 사용
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@duckmate/ui";
import { unblockUser } from "@/lib/moderation/actions";

export function UnblockButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    const result = await unblockUser({ targetId });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="sm" variant="ghost" loading={pending} onClick={() => void run()}>
        차단 해제
      </Button>
      {error && (
        <span role="alert" className="text-caption text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
