"use client";

// =============================================================================
// E4 · 이의제기 폼 (client) — lib/moderation submitAppeal [F-SAF-07]
// 통보 후 30일 이내 · 제재 건당 1회 (DB submit_appeal 이 강제, 여기선 안내만).
// /appeal 과 /sanctioned 두 화면에서 같은 컴포넌트를 쓴다(제재 중에도 접근 보장).
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@duckmate/ui";
import { submitAppeal } from "@/lib/moderation/actions";

export function AppealForm({ sanctionId }: { sanctionId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const errorId = React.useId();

  const tooShort = body.trim().length > 0 && body.trim().length < 10;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await submitAppeal({ sanctionId, body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
    router.refresh();
  };

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-success-tint px-4 py-3 text-body-sm text-success">
        이의제기를 접수했어요. 7일 이내에 처음 처리한 담당자가 아닌 다른 담당자가 검토하고 결과를
        알려드려요.
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <label className="flex flex-col gap-1">
        <span className="text-body-sm">어떤 점이 사실과 다른지 알려주세요 (10~2000자)</span>
        <Textarea
          rows={5}
          value={body}
          maxLength={2000}
          invalid={tooShort || error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setBody(e.target.value)}
          placeholder="상황과 근거를 적어 주세요."
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-caption text-ink-muted">
        검토 중에도 제재는 유지돼요. 인용되면 제재가 취소되고 이력에도 취소로 표시돼요.
      </p>
      <div>
        <Button type="submit" loading={pending} disabled={body.trim().length < 10}>
          이의제기 접수
        </Button>
      </div>
    </form>
  );
}
