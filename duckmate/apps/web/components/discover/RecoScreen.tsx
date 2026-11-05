"use client";

/**
 * /reco — 오늘의 추천 카드 스택(세로 스냅 스크롤, 스와이프 없음).
 *  - 데이터: TanStack ['reco', loopDate] (initialData = 서버 페이지가 넘긴 값)
 *  - 액션: 낙관적 제거 → 실패 시 복구 + 에러 코드 매핑(errors.ts)
 *  - 상호 좋아요(matched) → /match/[id] · 모두 소진 → /reco/done
 *  - 되돌리기: 무료(canUndo=false)는 버튼 비활성 + "플러스에서" 문구, 300초 카운트(압박 카피 없음)
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button, cn, EmptyState, useToast } from "@duckmate/ui";
import { formatCountdown, undoRemainingSec, useRecoStore } from "@/stores/reco";
import { QK, serverApi } from "./api";
import { mapFailure, UNDO_PLUS_NOTE, withRetry } from "./errors";
import { personOfRecoCard, RESET_TEXT } from "./format";
import { ProfileSheet } from "./ProfileSheet";
import { RecoCardItem } from "./RecoCardItem";
import { track } from "@/lib/analytics/track";
import { bucketOf, idHash } from "./track";
import type { DiscoverApi, RecoCardView, TodayView } from "./types";

export type RecoScreenProps = {
  initial: TodayView | null;
  api?: DiscoverApi;
  /** 개발 라우트: 라우팅 대신 콜백 */
  onNavigate?: (href: string) => void;
};

export function RecoScreen({ initial, api = serverApi, onNavigate }: RecoScreenProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const go = React.useCallback(
    (href: string, replace = false) => {
      if (onNavigate) return onNavigate(href);
      if (replace) router.replace(href);
      else router.push(href);
    },
    [onNavigate, router],
  );

  const loopDate = initial?.loopDate ?? null;
  const query = useQuery({
    queryKey: QK.reco(loopDate),
    queryFn: async () => {
      const r = await api.fetchToday();
      if (!r.ok) throw Object.assign(new Error(r.message), { failure: r });
      return r.data;
    },
    ...(initial ? { initialData: initial } : {}),
    staleTime: 15_000,
  });
  const data = query.data ?? null;

  // reco 슬라이스: loop_date 바뀌면 초기화
  const dispatch = useRecoStore((s) => s.dispatch);
  const lastAction = useRecoStore((s) => s.lastAction);
  const undoUntil = useRecoStore((s) => s.undoUntil);
  React.useEffect(() => {
    if (data?.loopDate) dispatch({ type: "reset", loopDate: data.loopDate });
  }, [data?.loopDate, dispatch]);

  // 낙관적 제거된 카드 · 진행 중 카드 · 인라인 에러 · 시트
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [inlineError, setInlineError] = React.useState<{ recoId: string; field: string; message: string } | null>(null);
  const [undoNote, setUndoNote] = React.useState<string | null>(null);
  const [sheetCard, setSheetCard] = React.useState<RecoCardView | null>(null);
  const [superlikeRemaining, setSuperlikeRemaining] = React.useState<number | null>(initial?.superlike?.weekly_remaining ?? null);
  React.useEffect(() => {
    if (data?.superlike) setSuperlikeRemaining(data.superlike.weekly_remaining);
  }, [data?.superlike]);

  const cards = React.useMemo(() => (data?.cards ?? []).filter((c) => c.action === null && !hidden.has(c.recoId)), [data?.cards, hidden]);
  const total = data?.limit ?? 5;
  const actedCount = (data?.cards ?? []).filter((c) => c.action !== null || hidden.has(c.recoId)).length;

  // 마운트 1회: daily_reco_opened
  const openedRef = React.useRef(false);
  React.useEffect(() => {
    if (openedRef.current || !data) return;
    openedRef.current = true;
    track("daily_reco_opened", { reco_count: data.cards.length, from_like_count: 0, boosted_count: 0 });
  }, [data]);

  // 되돌리기 카운트다운(1초 틱)
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (undoUntil === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: "expire", now: t });
    }, 1000);
    return () => window.clearInterval(id);
  }, [undoUntil, dispatch]);
  const undoSec = undoRemainingSec({ loopDate, index: 0, lastAction, undoUntil }, now);

  // 모두 소진 → /reco/done
  React.useEffect(() => {
    if (!data || data.cards.length === 0) return;
    if (cards.length === 0 && pendingId === null) go("/reco/done", true);
  }, [cards.length, data, pendingId, go]);

  const onSeen = React.useCallback(
    (card: RecoCardView) => {
      track("reco_card_seen", { position: card.position, score_bucket: bucketOf(card.score), target_id_hash: idHash(card.profile.id) });
      void api.seen({ recoId: card.recoId });
    },
    [api],
  );

  const handleFailure = React.useCallback(
    (f: Parameters<typeof mapFailure>[0], card: RecoCardView) => {
      const ux = mapFailure(f, { surface: "act" });
      switch (ux.kind) {
        case "redirect":
          go(ux.to);
          return;
        case "inline":
          setInlineError({ recoId: card.recoId, field: ux.field, message: ux.message });
          return;
        case "toast":
          toast({ title: withRetry(ux.message, ux.retryAfterSec), variant: "error" });
          return;
        case "refresh":
          if (ux.message) toast({ title: ux.message });
          void qc.invalidateQueries({ queryKey: QK.reco(loopDate) });
          return;
      }
    },
    [go, toast, qc, loopDate],
  );

  const onAct = React.useCallback(
    async (card: RecoCardView, action: "like" | "super" | "pass") => {
      if (pendingId) return;
      setInlineError(null);
      setUndoNote(null);
      setPendingId(card.recoId);
      // 낙관적 제거 (슈퍼라이크는 쿼터 실패가 흔하므로 응답 후 제거)
      const optimistic = action !== "super";
      if (optimistic) setHidden((s) => new Set(s).add(card.recoId));
      const r = await api.act({ targetId: card.profile.id, action });
      setPendingId(null);
      if (!r.ok) {
        if (optimistic) setHidden((s) => { const n = new Set(s); n.delete(card.recoId); return n; });
        handleFailure(r, card);
        return;
      }
      setHidden((s) => new Set(s).add(card.recoId));
      if (r.data.superlike) setSuperlikeRemaining(r.data.superlike.weekly_remaining);
      dispatch({ type: "acted", recoId: card.recoId, targetId: card.profile.id, action, at: Date.now(), matched: r.data.matched });
      if (action === "pass") track("pass_sent", { position: card.position });
      else track("like_sent", { type: action, position: card.position, reasons_shown: card.reasons.slice(0, 2).map((x) => x.kind) });
      if (r.data.matched && r.data.matchId) {
        if (r.data.matchCreated) track("match_created", { match_id_hash: idHash(r.data.matchId), initiator: "me" });
        void qc.invalidateQueries({ queryKey: QK.matches });
        go(`/match/${r.data.matchId}`);
        return;
      }
      void qc.invalidateQueries({ queryKey: QK.home });
    },
    [api, dispatch, go, handleFailure, pendingId, qc],
  );

  const onUndo = React.useCallback(async () => {
    if (!data?.canUndo) {
      setUndoNote(UNDO_PLUS_NOTE);
      return;
    }
    const r = await api.undo();
    if (!r.ok) {
      const ux = mapFailure(r, { surface: "undo" });
      if (ux.kind === "redirect") go(ux.to);
      else if (ux.kind === "inline") setUndoNote(ux.message);
      else if (ux.kind === "toast") toast({ title: withRetry(ux.message, ux.retryAfterSec), variant: "error" });
      return;
    }
    dispatch({ type: "undone" });
    setHidden((s) => { const n = new Set(s); n.delete(r.data.recoId); return n; });
    void qc.invalidateQueries({ queryKey: QK.reco(loopDate) });
  }, [api, data?.canUndo, dispatch, go, loopDate, qc, toast]);

  const onBlocked = React.useCallback(
    (targetId: string) => {
      const card = (data?.cards ?? []).find((c) => c.profile.id === targetId);
      if (card) setHidden((s) => new Set(s).add(card.recoId));
      void qc.invalidateQueries({ queryKey: QK.reco(loopDate) });
    },
    [data?.cards, loopDate, qc],
  );

  // ---------- 렌더 ----------
  if (query.isError && !data) {
    const f = (query.error as { failure?: Parameters<typeof mapFailure>[0] }).failure;
    const ux = f ? mapFailure(f) : null;
    if (ux?.kind === "redirect") {
      go(ux.to, true);
      return null;
    }
    return (
      <EmptyState
        icon="✨"
        title="추천을 불러오지 못했어요"
        description={f?.message ?? "잠시 후 다시 시도해 주세요"}
        action={<Button onClick={() => query.refetch()}>다시 시도</Button>}
      />
    );
  }
  if (!data) return <RecoSkeleton />;

  if (data.cards.length === 0) {
    return (
      <div className="px-4 pt-3">
        <Header actedCount={0} total={total} go={go} />
        <EmptyState
          icon="✨"
          title="이 지역엔 아직 사람이 적어요"
          description={`${RESET_TEXT}에 다시 추천해요. 그동안 덕질 카드를 다듬어 두면 겹침이 늘어요.`}
          action={
            <Button asChild variant="outline">
              <Link href="/me/edit">카드 다듬기</Link>
            </Button>
          }
          data-testid="reco-empty"
        />
      </div>
    );
  }

  const showUndo = lastAction !== null && !lastAction.matched;

  return (
    <div className="flex flex-col">
      <Header actedCount={actedCount} total={total} go={go} />

      {showUndo ? (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-body-sm" data-testid="reco-undo-bar" role="status">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {lastAction.action === "pass" ? "패스했어요" : lastAction.action === "super" ? "슈퍼라이크를 보냈어요" : "좋아요를 보냈어요"}
            {undoSec > 0 ? <span className="tnum"> · {formatCountdown(undoSec)}</span> : null}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!data.canUndo || undoSec === 0}
            aria-disabled={!data.canUndo || undoSec === 0}
            data-testid="reco-undo"
            title={!data.canUndo ? UNDO_PLUS_NOTE : undefined}
          >
            <RotateCcw aria-hidden="true" />
            되돌리기
          </Button>
        </div>
      ) : null}
      {showUndo && (!data.canUndo || undoNote) ? (
        <p className="mx-4 mb-2 text-caption text-muted-foreground" data-testid="reco-undo-note">
          {undoNote ?? UNDO_PLUS_NOTE}
        </p>
      ) : null}

      <div className="snap-y snap-mandatory" data-testid="reco-stack">
        {cards.map((card, i) => (
          <RecoCardItem
            key={card.recoId}
            card={card}
            index={i}
            total={cards.length}
            pending={pendingId === card.recoId}
            superlikeRemaining={superlikeRemaining}
            inlineError={inlineError && inlineError.recoId === card.recoId ? inlineError : null}
            onSeen={onSeen}
            onAct={onAct}
            onOpenProfile={setSheetCard}
          />
        ))}
        {data.short ? (
          <section className="snap-start px-4 pb-8 pt-2" data-testid="reco-short">
            <div className="rounded-lg border border-dashed border-border bg-card p-5 text-center">
              <p className="text-body text-foreground">이 지역/취미에 아직 사람이 적어요</p>
              <p className="mt-1 text-body-sm text-muted-foreground">{RESET_TEXT} 다시 추천해요</p>
            </div>
          </section>
        ) : null}
      </div>

      <ProfileSheet
        person={sheetCard ? personOfRecoCard(sheetCard) : null}
        open={sheetCard !== null}
        onOpenChange={(o) => {
          if (!o) setSheetCard(null);
        }}
        api={api}
        compat={sheetCard?.scorePercent ?? null}
        reasons={sheetCard?.reasons.map((r) => r.label) ?? []}
        onBlocked={onBlocked}
      />
    </div>
  );
}

function Header({ actedCount, total, go }: { actedCount: number; total: number; go: (href: string) => void }) {
  const shown = Math.min(total, actedCount + 1);
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-background/95 px-2 backdrop-blur" data-testid="reco-header">
      <Button variant="ghost" size="icon" aria-label="홈으로" onClick={() => go("/home")}>
        <ArrowLeft aria-hidden="true" />
      </Button>
      <h1 className="text-h3">오늘의 추천</h1>
      <span className="tnum text-body-sm text-muted-foreground">
        {shown}/{total}
      </span>
      <ol className="ml-auto mr-2 flex gap-1" aria-label={`진행 ${actedCount} / ${total}`}>
        {Array.from({ length: total }).map((_, i) => (
          <li key={i} className={cn("size-2 rounded-full", i < actedCount ? "bg-primary" : "bg-border")} aria-hidden="true" />
        ))}
      </ol>
    </div>
  );
}

function RecoSkeleton() {
  return (
    <div className="px-4 pt-3" role="status" aria-label="추천 불러오는 중">
      <div className="h-14" />
      <div className="animate-skeleton h-80 rounded-lg bg-muted" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="animate-skeleton h-12 rounded-md bg-muted" />
        <div className="animate-skeleton h-12 rounded-md bg-muted" />
        <div className="animate-skeleton h-12 rounded-md bg-muted" />
      </div>
    </div>
  );
}
