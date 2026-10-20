"use client";

import { Heart, Info, Layers, Loader2, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { swipeAction, undoSwipeAction } from "@/app/actions/social";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { FilterSheet } from "@/components/explore/filter-sheet";
import { Button } from "@/components/ui/button";
import { activeFilterCount, filtersToSearchParams, type ExploreFilters } from "@/lib/explore/filters";
import type { ProfileCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MatchDialog } from "./match-dialog";
import { CardFace, SwipeCard, type SwipeCardHandle, type SwipeDir } from "./swipe-card";

export function SwipeDeck({ filters, initial }: { filters: ExploreFilters; initial: ProfileCard[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [queue, setQueue] = useState<ProfileCard[]>(initial);
  const [last, setLast] = useState<{ card: ProfileCard; kind: SwipeDir } | null>(null);
  const [match, setMatch] = useState<ProfileCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [refilling, setRefilling] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seen = useRef(new Set(initial.map((p) => p.id)));
  const topRef = useRef<SwipeCardHandle>(null);
  const qs = useMemo(() => filtersToSearchParams(filters).toString(), [filters]);

  const refill = useCallback(async () => {
    setRefilling(true);
    try {
      const res = await fetch(`/api/swipe-deck?${qs}`, { headers: { accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "카드를 불러오지 못했어요.");
      const fresh = (body.items as ProfileCard[]).filter((p) => !seen.current.has(p.id));
      fresh.forEach((p) => seen.current.add(p.id));
      if (fresh.length === 0) setExhausted(true);
      setQueue((q) => [...q, ...fresh]);
    } catch (e) {
      toast.error((e as Error).message);
      setExhausted(true);
    } finally {
      setRefilling(false);
    }
  }, [qs]);

  useEffect(() => {
    if (queue.length > 3 || refilling || exhausted) return;
    const t = setTimeout(() => void refill(), 0);
    return () => clearTimeout(t);
  }, [queue.length, refilling, exhausted, refill]);

  const onSwiped = useCallback(async (dir: SwipeDir) => {
    const card = queue[0];
    if (!card) return;
    setQueue((q) => q.slice(1)); // 낙관적 제거
    setBusy(true);
    const r = await swipeAction({ targetId: card.id, kind: dir });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      setQueue((q) => [card, ...q]); // 복구
      return;
    }
    if (r.data.matched) {
      setMatch(card);
      setLast(null); // 매칭 후에는 되돌리기 불가
    } else {
      setLast({ card, kind: dir });
    }
  }, [queue]);

  const undo = async () => {
    if (!last) return;
    const prev = last;
    setLast(null);
    const r = await undoSwipeAction(prev.card.id);
    if (!r.ok) return toast.error(r.error);
    setQueue((q) => [prev.card, ...q]);
    setExhausted(false);
  };

  const press = (dir: SwipeDir) => {
    if (!queue[0] || busy) return;
    topRef.current?.fling(dir);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (match || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") topRef.current?.fling("like");
      if (e.key === "ArrowLeft") topRef.current?.fling("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match]);

  const apply = (f: ExploreFilters) => {
    const s = filtersToSearchParams(f).toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  const count = activeFilterCount(filters);
  const filterTrigger = (
    <Button variant="secondary" size="sm" className="rounded-full" data-testid="filter-button">
      <SlidersHorizontal />
      필터
      {count > 0 && (
        <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[10px] leading-4 font-bold text-white">{count}</span>
      )}
    </Button>
  );

  const top = queue[0];
  const next = queue[1];

  return (
    <div className="mx-auto flex max-w-md flex-col">
      <PageHeader title={<span className="text-brand">스와이프</span>}>
        <FilterSheet value={filters} onApply={apply} trigger={filterTrigger} allowSave={false} />
      </PageHeader>

      <div className="relative mx-auto aspect-[3/4] max-h-[calc(100dvh-15rem)] w-full">
        {top ? (
          <>
            {next && (
              <div
                key={`next-${next.id}`}
                className="absolute inset-0 scale-95 overflow-hidden rounded-3xl bg-card opacity-70 ring-1 ring-white/5"
                aria-hidden
              >
                <CardFace p={next} />
              </div>
            )}
            <SwipeCard key={top.id} ref={topRef} p={top} onSwiped={onSwiped} />
          </>
        ) : refilling ? (
          <div className="flex h-full items-center justify-center rounded-3xl bg-card ring-1 ring-white/5">
            <Loader2 className="size-8 animate-spin text-primary" aria-label="불러오는 중" />
          </div>
        ) : (
          <div className="flex h-full items-center rounded-3xl bg-card ring-1 ring-white/5" data-testid="swipe-empty">
            <EmptyState
              icon={<Layers />}
              title="주변의 새 프로필을 모두 봤어요"
              description="필터를 넓히거나 탐색에서 더 많은 사람을 둘러보세요. 새로운 사람이 오면 다시 보여드릴게요."
              action={
                <div className="flex gap-2">
                  <Button asChild variant="secondary">
                    <Link href="/explore">탐색으로</Link>
                  </Button>
                  <FilterSheet value={filters} onApply={apply} trigger={<Button>필터 바꾸기</Button>} allowSave={false} />
                </div>
              }
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4" role="group" aria-label="스와이프 버튼">
        <RoundButton label="되돌리기" onClick={undo} disabled={!last} size="sm" testId="swipe-undo">
          <RotateCcw className="size-5 text-amber-300" />
        </RoundButton>
        <RoundButton label="패스" onClick={() => press("pass")} disabled={!top || busy} testId="swipe-pass">
          <X className="size-8 text-destructive" strokeWidth={2.6} />
        </RoundButton>
        <RoundButton label="좋아요" onClick={() => press("like")} disabled={!top || busy} testId="swipe-like" brand>
          <Heart className="size-8 fill-white text-white" />
        </RoundButton>
        {top ? (
          <Link
            href={`/p/${top.id}`}
            aria-label="프로필 자세히 보기"
            className="flex size-12 items-center justify-center rounded-full bg-secondary ring-1 ring-white/10 transition active:scale-90"
          >
            <Info className="size-5 text-sky-300" />
          </Link>
        ) : (
          <span className="size-12" />
        )}
      </div>
      <p className="mt-3 hidden text-center text-xs text-muted-foreground md:block">키보드 ← 패스 · → 좋아요</p>

      <MatchDialog profile={match} onClose={() => setMatch(null)} />
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  children,
  size = "lg",
  brand,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: "sm" | "lg";
  brand?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex items-center justify-center rounded-full shadow-lg ring-1 transition active:scale-90 disabled:opacity-40",
        size === "lg" ? "size-16" : "size-12",
        brand ? "bg-brand shadow-accent/30 ring-transparent" : "bg-secondary ring-white/10",
      )}
    >
      {children}
    </button>
  );
}
