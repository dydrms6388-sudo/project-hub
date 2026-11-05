"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Check, ChevronLeft } from "lucide-react";
import type { Enums, VerifyLevel } from "@duckmate/db";
import { Button, Progress, VERIFY_LABELS, cn } from "@duckmate/ui";
import { track } from "@/lib/analytics/track";

type Props = {
  verifyLevel: VerifyLevel;
  mode: Enums["profile_mode"];
  photoCounts: { pending: number; approved: number; hasApprovedPrimary: boolean };
};

const STEPS: ReadonlyArray<{ level: VerifyLevel; can: string }> = [
  { level: 0, can: "가입 완료" },
  { level: 1, can: "온보딩 · 내 프로필 편집" },
  { level: 2, can: "오늘의 추천 · 좋아요 · 매칭 · 채팅 · 취미 친구 모드" },
  { level: 3, can: "데이팅 모드 · 채팅 이미지 보내기" },
];

export function VerifyCenterScreen({ verifyLevel, photoCounts }: Props) {
  useEffect(() => {
    track("verify_center_viewed", { verify_level: verifyLevel });
  }, [verifyLevel]);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="verify-center">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">인증 센터</h1>
      </header>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-label">
            현재 L{verifyLevel} · {VERIFY_LABELS[verifyLevel]}
          </p>
          <p className="tnum text-caption text-muted-foreground">{verifyLevel}/3</p>
        </div>
        <Progress value={(verifyLevel / 3) * 100} className="mt-2" aria-label="인증 진행" />
      </div>

      <ol className="mt-4 space-y-3">
        {STEPS.map(({ level, can }) => {
          const done = verifyLevel >= level;
          const isNext = verifyLevel + 1 === level;
          return (
            <li key={level} className={cn("rounded-lg border bg-card p-4", isNext ? "border-primary" : "border-border")} data-testid={`verify-step-${level}`}>
              <div className="flex items-center gap-3">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} aria-hidden="true">
                  {done ? <Check size={16} strokeWidth={2.5} /> : `L${level}`}
                </span>
                <div className="flex-1">
                  <p className="text-body font-medium">
                    L{level} {VERIFY_LABELS[level]}
                    {done ? <span className="sr-only"> 완료</span> : null}
                  </p>
                  <p className="text-body-sm text-muted-foreground">{can}</p>
                </div>
              </div>
              {level === 2 && !done ? (
                <Button asChild className="mt-3 w-full" data-testid="verify-cta-identity">
                  <Link href="/verify">본인인증 하기</Link>
                </Button>
              ) : null}
              {level === 3 && !done ? (
                <div className="mt-3">
                  <p className="text-body-sm text-muted-foreground">
                    {verifyLevel < 2
                      ? "본인인증을 먼저 마쳐 주세요."
                      : photoCounts.pending > 0
                        ? `사진 ${photoCounts.pending}장을 확인하고 있어요. 24시간 안에 확인해요.`
                        : "얼굴이 보이는 본인 사진 1장을 올리고 승인되면 사진인증이 돼요."}
                  </p>
                  <Button asChild variant={verifyLevel < 2 ? "outline" : "default"} className="mt-2 w-full" data-testid="verify-cta-photo">
                    <Link href="/me/photos">사진 관리로</Link>
                  </Button>
                </div>
              ) : null}
              {level === 1 && done ? <p className="text-caption mt-2 text-muted-foreground">휴대폰 번호를 바꾸면 다시 확인이 필요해요.</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
