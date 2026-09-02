"use client";

/**
 * /home — 오늘 요약(추천 남은 수·새 매칭·미답장·나를 좋아한 사람 수: 숫자만, 블러 없음) + "오늘의 추천 보기" CTA.
 * 첫 매칭 안전 모달(홈 보완 노출: 매칭 ≥1 & safety_modal_seen_at null). 가짜 수·압박 카피 없음.
 */
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Sparkles, Users } from "lucide-react";
import { Button, EmptyState } from "@duckmate/ui";
import { QK, serverApi } from "./api";
import { mapFailure } from "./errors";
import { RESET_TEXT } from "./format";
import { SafetyGuideModal } from "./SafetyGuideModal";
import type { DiscoverApi, HomeView } from "./types";

function todayLabel(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일(${days[kst.getUTCDay()]})`;
}

export function HomeScreen({ initial, api = serverApi, nickname }: { initial: HomeView | null; api?: DiscoverApi; nickname?: string | null }) {
  const query = useQuery({
    queryKey: QK.home,
    queryFn: async () => {
      const r = await api.fetchHome();
      if (!r.ok) throw Object.assign(new Error(r.message), { failure: r });
      return r.data;
    },
    ...(initial ? { initialData: initial } : {}),
    staleTime: 15_000,
  });
  const view = query.data ?? null;
  const [safetyDone, setSafetyDone] = React.useState(false);

  if (query.isError && !view) {
    const f = (query.error as { failure?: Parameters<typeof mapFailure>[0] }).failure;
    const ux = f ? mapFailure(f) : null;
    if (ux?.kind === "redirect" && typeof window !== "undefined") window.location.assign(ux.to);
    return <EmptyState icon="✨" title="오늘 요약을 불러오지 못했어요" description={f?.message} action={<Button onClick={() => query.refetch()}>다시 시도</Button>} />;
  }

  const s = view?.summary ?? null;
  const remaining = s?.reco_remaining ?? 0;
  const total = s?.reco_total ?? 0;
  const noReco = s !== null && total === 0;
  const done = s !== null && total > 0 && remaining === 0;

  return (
    <div className="px-4 pb-6 pt-4" data-testid="home">
      <header className="flex items-baseline justify-between">
        <h1 className="text-h2">
          오늘 · <span className="tnum">{todayLabel()}</span>
        </h1>
        {nickname ? <span className="text-body-sm text-muted-foreground">{nickname} 님</span> : null}
      </header>

      {/* 오늘의 추천 카드 */}
      <section className="mt-4 rounded-lg border border-border bg-card p-4" aria-labelledby="home-reco-title">
        {noReco ? (
          <>
            <h2 id="home-reco-title" className="text-h3">
              이 지역엔 아직 사람이 적어요
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">{RESET_TEXT}에 다시 추천해요. 그동안 덕질 카드를 다듬어 두면 겹침이 늘어요.</p>
            <Button asChild variant="outline" className="mt-4 w-full" data-testid="home-cta">
              <Link href="/me/edit">카드 다듬기</Link>
            </Button>
          </>
        ) : done ? (
          <>
            <h2 id="home-reco-title" className="text-h3">
              오늘 <span className="tnum">{total}</span>명을 모두 봤어요
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">{RESET_TEXT}에 새 추천이 와요</p>
            <Button asChild variant="outline" className="mt-4 w-full" data-testid="home-cta">
              <Link href="/reco/done">오늘 결과 보기</Link>
            </Button>
          </>
        ) : (
          <>
            <h2 id="home-reco-title" className="text-h3">
              오늘의 추천 {s ? <span className="tnum">{remaining}</span> : <span className="tnum">…</span>}명 남음
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">취미가 겹치는 순서예요. {RESET_TEXT}에 새로 와요.</p>
            <Button asChild className="mt-4 w-full" data-testid="home-cta">
              <Link href="/reco">오늘의 추천 보기</Link>
            </Button>
          </>
        )}
      </section>

      {/* 요약 숫자 4개 — 실제 수치만 */}
      <section className="mt-4 grid grid-cols-2 gap-2" aria-label="오늘 요약">
        <Stat icon={Sparkles} label="결과 기다리는 중" value={s?.pending_results ?? 0} unit="건" testId="home-pending" />
        <Stat icon={Heart} label="오늘 새 매칭" value={s?.matches_today ?? 0} unit="건" testId="home-matches" href="/chat" />
        <Stat icon={MessageCircle} label="미답장 대화" value={view?.unansweredChats ?? 0} unit="개" testId="home-unanswered" href="/chat" />
        <Stat icon={Users} label="나를 좋아한 사람" value={s?.likers_count ?? 0} unit="명" testId="home-likers" />
      </section>

      {s ? (
        <p className="mt-3 text-caption text-muted-foreground">
          슈퍼라이크 <span className="tnum">{s.superlike.weekly_remaining}</span>개 남음 · 월요일 07:00에 <span className="tnum">{s.superlike.weekly_quota}</span>개 충전
        </p>
      ) : null}

      {view?.matchCount === 0 && s && s.pending_results >= 0 && !noReco ? (
        <section className="mt-6">
          <EmptyState
            icon="👋"
            title="아직 매칭이 없어요"
            description={`좋아요는 상대가 보는 데 시간이 걸려요. 결과 기다리는 중 ${s.pending_results}건.`}
            className="py-8"
            data-testid="home-empty-match"
          />
        </section>
      ) : null}

      <SafetyGuideModal open={Boolean(view?.showSafetyModal) && !safetyDone} api={api} onDone={() => setSafetyDone(true)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, unit, testId, href }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true" }>; label: string; value: number; unit: string; testId: string; href?: string }) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1 block text-h2">
        <span className="tnum">{value}</span>
        <span className="ml-0.5 text-body-sm text-muted-foreground">{unit}</span>
      </span>
    </>
  );
  const cls = "block rounded-lg border border-border bg-card p-3 text-left";
  return href ? (
    <Link href={href} className={cls} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}
