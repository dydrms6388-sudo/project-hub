"use client";

// =============================================================================
// E1 · 모드 선택 폼 — 친구 / 데이팅 (라디오 그룹, 키보드 조작 가능)
// 데이팅 + Lv<2 → VERIFY_LEVEL_REQUIRED → friend 로 자동 저장 후 /verify CTA 노출.
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, BRAND_NAME, Button, Card } from "@duckmate/ui";
import { saveMode } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

type Mode = "friend" | "dating";

const MODES: readonly { value: Mode; title: string; description: string }[] = [
  {
    value: "friend",
    title: "취미 친구 모드",
    description: "성별 상관없이 가볍게 덕메이트를 찾아요.",
  },
  {
    value: "dating",
    title: "데이팅 모드",
    description: "본인인증을 마친 회원끼리 만나요.",
  },
] as const;

export function ModeForm({
  recommended,
  verifyLevel,
}: {
  recommended: Mode;
  verifyLevel: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(recommended === "dating" && verifyLevel < 2 ? "friend" : recommended);
  const [error, setError] = useState<string | null>(null);
  const [verifyCta, setVerifyCta] = useState(false);

  const datingLocked = verifyLevel < 2;

  function finish() {
    window.dispatchEvent(
      new CustomEvent("duckmate:analytics", { detail: { event: "onboarding_complete" } })
    );
    router.replace("/home");
    router.refresh();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveMode({ mode });
      if (!res.ok) {
        if (res.code === "VERIFY_LEVEL_REQUIRED") {
          // 흐름을 끊지 않는다: friend 로 시작하고 인증 CTA 를 남긴다
          const fallback = await saveMode({ mode: "friend" });
          if (!fallback.ok) {
            setError(messageForActionError(fallback.code, fallback.message));
            return;
          }
          setMode("friend");
          setVerifyCta(true);
          return;
        }
        const to = redirectForActionError(res.code, res.message);
        if (to) {
          router.replace(to);
          return;
        }
        setError(messageForActionError(res.code, res.message));
        return;
      }
      finish();
    });
  }

  if (verifyCta) {
    return (
      <Card className="mt-5" data-testid="mode-verify-cta">
        <h2 className="text-h2">친구 모드로 먼저 시작했어요</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          데이팅 모드는 본인인증을 마치면 바로 열려요. 인증은 1분이면 끝나요.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Link href="/verify" className="w-full" data-testid="mode-verify-link">
            <Button size="lg" className="w-full">
              본인인증 하러 가기
            </Button>
          </Link>
          <Button variant="ghost" size="md" onClick={finish} data-testid="mode-start-home">
            먼저 둘러볼래요
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form className="mt-5 flex flex-col gap-5" onSubmit={onSubmit} noValidate data-testid="mode-form">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">시작할 모드 선택</legend>
        {MODES.map((m) => {
          const selected = mode === m.value;
          const locked = m.value === "dating" && datingLocked;
          return (
            <label
              key={m.value}
              className={[
                "flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                selected
                  ? "border-primary bg-primary-tint text-primary-tint-fg"
                  : "border-line bg-surface-raised text-ink",
              ].join(" ")}
              data-testid={`mode-option-${m.value}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  checked={selected}
                  onChange={() => setMode(m.value)}
                  className="size-5 accent-primary"
                  data-testid={`mode-radio-${m.value}`}
                />
                <span className="text-h3">{m.title}</span>
                {recommended === m.value ? <Badge variant="brand">추천</Badge> : null}
                {locked ? <Badge variant="neutral">본인인증 후 열려요</Badge> : null}
              </span>
              <span className="pl-7 text-body-sm">{m.description}</span>
            </label>
          );
        })}
      </fieldset>

      <p className="text-caption text-ink-muted">
        추천 배지는 퀴즈 응답을 참고한 제안이에요. 원하는 쪽으로 고르면 돼요.
      </p>

      <p
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <Button type="submit" size="lg" loading={pending} data-testid="mode-submit">
        {BRAND_NAME} 시작하기
      </Button>
    </form>
  );
}
