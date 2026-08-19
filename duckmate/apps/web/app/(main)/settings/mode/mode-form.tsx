"use client";

// =============================================================================
// E4 · 모드 전환 (client) — friend ↔ dating. dating 은 Lv2 필요(A5 §1.2).
// saveMode 가 VERIFY_LEVEL_REQUIRED 를 주면 /verify 로 안내만 한다(자동 강제 없음).
// =============================================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@duckmate/ui";
import type { ProfileMode } from "@duckmate/db";
import { saveMode } from "@/lib/auth/actions";

const OPTIONS: { value: ProfileMode; title: string; body: string }[] = [
  {
    value: "friend",
    title: "🤝 취미 친구 모드",
    body: "성별 무관하게 같은 취미를 가진 사람을 추천해요.",
  },
  {
    value: "dating",
    title: "💘 데이팅 모드",
    body: "본인인증을 마친 회원끼리만 추천해요.",
  },
];

export function ModeForm({ mode, verifyLevel }: { mode: ProfileMode; verifyLevel: number }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<ProfileMode>(mode);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const datingLocked = verifyLevel < 2;

  const save = async () => {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await saveMode({ mode: selected });
    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }
    setPending(false);
    setSaved(true);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">모드 선택</legend>
        {OPTIONS.map((option) => {
          const locked = option.value === "dating" && datingLocked;
          return (
            <Card key={option.value}>
              <CardContent className="py-4">
                <label className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="mode"
                    className="mt-1 size-5 accent-current text-primary"
                    value={option.value}
                    checked={selected === option.value}
                    disabled={locked}
                    onChange={() => {
                      setSelected(option.value);
                      setSaved(false);
                    }}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-body font-semibold">{option.title}</span>
                    <span className="text-body-sm text-ink-muted">{option.body}</span>
                    {locked && (
                      <span className="text-body-sm">
                        🔒 본인인증 후 열려요 ·{" "}
                        <Link
                          href="/verify?required=2"
                          className="text-primary underline underline-offset-2"
                        >
                          인증하러 가기
                        </Link>
                      </span>
                    )}
                  </span>
                </label>
              </CardContent>
            </Card>
          );
        })}
      </fieldset>

      <p className="text-caption text-ink-muted">
        모드를 바꾸면 다음 추천부터 새 기준으로 계산돼요. 언제든 다시 바꿀 수 있어요.
      </p>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-body-sm text-success">
          모드를 저장했어요.
        </p>
      )}

      <Button size="lg" loading={pending} disabled={selected === mode} onClick={() => void save()}>
        저장
      </Button>
    </div>
  );
}
