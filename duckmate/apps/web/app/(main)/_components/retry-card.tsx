"use client";

// =============================================================================
// E2 · 인라인 재시도 카드 (12_flows §8.4 네트워크 오류)
// 전면 오류 페이지 대신 화면 안에서 다시 시도한다. 카피는 중립 — 사용자 탓 금지.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardDescription, CardTitle } from "@duckmate/ui";

export interface RetryCardProps {
  title?: string;
  description?: string;
}

export function RetryCard({
  title = "연결이 불안정해요",
  description = "잠시 후 다시 시도해 주세요.",
}: RetryCardProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription className="mt-1">{description}</CardDescription>
      <div className="mt-4">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          다시 시도
        </Button>
      </div>
    </Card>
  );
}
