"use client";

/**
 * /reco/done — 오늘 루프 끝. 광고·카운트다운·스트릭 없음. 리셋 시각은 정적 텍스트("내일 07:00").
 * 이벤트: daily_reco_exhausted + daily_loop_completed (같은 loop_date 1회, sessionStorage).
 */
import * as React from "react";
import Link from "next/link";
import { Button } from "@duckmate/ui";
import type { HomeSummary } from "@/lib/matching/rpc";
import { RESET_TEXT } from "./format";
import { track } from "@/lib/analytics/track";

export function RecoDoneScreen({ summary, mountedAt }: { summary: HomeSummary | null; mountedAt?: number }) {
  React.useEffect(() => {
    if (!summary) return;
    const key = `dm_loop_done_${summary.loop_date}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage 불가 환경: 이벤트만 발화 */
    }
    const liked = summary.pending_results + summary.matches_today;
    const passed = Math.max(0, summary.reco_total - summary.reco_remaining - liked);
    track("daily_reco_exhausted", { liked, passed, unseen: summary.reco_remaining });
    track("daily_loop_completed", {
      likes: liked,
      matches: summary.matches_today,
      pending_results: summary.pending_results,
      duration_ms: mountedAt ? Math.max(0, Date.now() - mountedAt) : 0,
    });
  }, [summary, mountedAt]);

  const total = summary?.reco_total ?? 0;
  const pending = summary?.pending_results ?? 0;
  const matches = summary?.matches_today ?? 0;

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center" data-testid="reco-done">
      <p className="text-[40px] leading-none" aria-hidden="true">
        ✨
      </p>
      <h1 className="mt-4 text-h1">
        오늘 <span className="tnum">{total}</span>명을 모두 봤어요
      </h1>
      <p className="mt-3 text-body text-muted-foreground">
        결과 기다리는 중 <span className="tnum text-foreground">{pending}</span>건 · 매칭 <span className="tnum text-foreground">{matches}</span>건
      </p>
      <p className="mt-1 text-body text-muted-foreground">
        <span className="tnum">{RESET_TEXT}</span>에 새 추천이 와요
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button asChild data-testid="done-chat">
          <Link href="/chat">채팅으로 가기</Link>
        </Button>
        {matches === 0 ? (
          <Button asChild variant="outline" data-testid="done-edit">
            <Link href="/me/edit">덕질 카드 다듬기</Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href="/home">홈으로</Link>
        </Button>
      </div>
    </div>
  );
}
