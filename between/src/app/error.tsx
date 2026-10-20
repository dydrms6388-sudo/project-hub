"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-semibold">일시적인 오류가 발생했어요</p>
      <p className="text-sm text-muted-foreground">잠시 후 다시 시도해 주세요.{error.digest && ` (코드: ${error.digest})`}</p>
      <button onClick={reset} className="mt-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">
        다시 시도
      </button>
    </main>
  );
}
