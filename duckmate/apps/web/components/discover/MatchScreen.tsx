"use client";

/**
 * /match/[id] — 순서 고정: (첫 매칭이면 안전 모달) → MatchReveal simple ≤1.2s → 제안 카드 3장(가로 스냅) → 선택 시 첫 메시지 자동 전송 → /chat/[matchId].
 * 건너뛰기 → /chat/[matchId] (E3 방 상단에 접힌 카드 재노출), 닫기 ✕ → /chat. 리빌 앞뒤에 광고·결제 유도 없음.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button, EmptyState, MatchReveal, SuggestionCard, useToast } from "@duckmate/ui";
import { QK, serverApi } from "./api";
import { mapFailure, withRetry } from "./errors";
import { PersonCard } from "./PersonCard";
import { SafetyGuideModal } from "./SafetyGuideModal";
import { track } from "@/lib/analytics/track";
import { idHash } from "./track";
import type { DiscoverApi, MatchView } from "./types";

export type MatchScreenProps = {
  matchId: string;
  initial: MatchView | null;
  api?: DiscoverApi;
  onNavigate?: (href: string) => void;
  /** 개발 라우트 스크린샷용: 리빌을 건너뛰고 제안 카드부터 */
  skipReveal?: boolean;
};

export function MatchScreen({ matchId, initial, api = serverApi, onNavigate, skipReveal = false }: MatchScreenProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const go = React.useCallback((href: string) => (onNavigate ? onNavigate(href) : router.push(href)), [onNavigate, router]);

  const query = useQuery({
    queryKey: QK.match(matchId),
    queryFn: async () => {
      const r = await api.fetchMatch(matchId);
      if (!r.ok) throw Object.assign(new Error(r.message), { failure: r });
      return r.data;
    },
    ...(initial ? { initialData: initial } : {}),
    staleTime: 60_000,
  });
  const view = query.data ?? null;

  const [safetyDone, setSafetyDone] = React.useState(false);
  const [revealed, setRevealed] = React.useState(skipReveal);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (view) track("match_screen_viewed", { match_id_hash: idHash(view.matchId) });
  }, [view]);
  const shownRef = React.useRef(false);
  React.useEffect(() => {
    if (!view || !revealed || shownRef.current || view.firstSuggestion.length === 0) return;
    shownRef.current = true;
    track("suggestion_shown", { template_ids: view.firstSuggestion.map((c) => c.template_id), kinds: view.firstSuggestion.map((c) => c.kind) });
  }, [view, revealed]);

  const select = async (position: number) => {
    if (!view || busy) return;
    const card = view.firstSuggestion[position - 1];
    if (!card) return;
    setSelected(position);
    setBusy(true);
    const r = await api.sendFirst({ matchId: view.matchId, body: card.body });
    setBusy(false);
    if (!r.ok) {
      setSelected(null);
      const ux = mapFailure(r, { surface: "send" });
      if (ux.kind === "redirect") return go(ux.to);
      toast({ title: ux.kind === "refresh" ? (ux.message ?? "다시 시도해 주세요") : withRetry(ux.message, ux.kind === "toast" ? ux.retryAfterSec : undefined), variant: "error" });
      return;
    }
    track("suggestion_selected", { template_id: card.template_id, kind: card.kind, position });
    void qc.invalidateQueries({ queryKey: QK.matches });
    go(`/chat/${view.matchId}`);
  };

  const skip = () => {
    track("suggestion_skipped");
    go(`/chat/${matchId}`);
  };

  if (query.isError && !view) {
    const f = (query.error as { failure?: Parameters<typeof mapFailure>[0] }).failure;
    const ux = f ? mapFailure(f, { surface: "match" }) : null;
    if (ux?.kind === "redirect") {
      go(ux.to);
      return null;
    }
    return <EmptyState icon="👋" title="매칭을 찾을 수 없어요" description={f?.message} action={<Button onClick={() => go("/chat")}>채팅 목록으로</Button>} />;
  }
  if (!view) {
    return (
      <div className="px-4 pt-16" role="status" aria-label="매칭 불러오는 중">
        <div className="animate-skeleton h-64 rounded-lg bg-muted" />
      </div>
    );
  }

  const showSafety = view.showSafetyModal && !safetyDone;
  const partnerName = view.partner?.nickname ?? "상대";
  const alreadyStarted = Boolean(view.firstMessageAt);

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-8 pt-2" data-testid="match-screen">
      <div className="flex h-12 items-center justify-end">
        <Button variant="ghost" size="icon" aria-label="닫기" onClick={() => go("/chat")} data-testid="match-close">
          <X aria-hidden="true" />
        </Button>
      </div>

      <SafetyGuideModal open={showSafety} api={api} onDone={() => setSafetyDone(true)} />

      {!showSafety ? (
        <div data-testid="match-reveal">
          <MatchReveal
            variant="simple"
            headline="매칭됐어요 🎉"
            overlapLabels={view.overlapLabels}
            left={<PersonCard person={view.me} compact />}
            right={view.partner ? <PersonCard person={view.partner} compact /> : <div className="rounded-lg border border-border bg-card p-4 text-body-sm text-muted-foreground">상대 정보를 볼 수 없어요</div>}
            onDone={() => setRevealed(true)}
          />
          <p className="mt-3 text-center text-body text-muted-foreground">
            {partnerName}님도 좋아요를 보냈어요. 겹치는 취미 <span className="tnum">{view.overlapLabels.length}</span>개.
          </p>
        </div>
      ) : null}

      {revealed && !showSafety ? (
        <section className="mt-6 animate-fade-in" aria-labelledby="match-suggest-title" data-testid="match-suggestions">
          {alreadyStarted ? (
            <div className="text-center">
              <h2 id="match-suggest-title" className="text-h3">
                이미 대화가 시작됐어요
              </h2>
              <Button className="mt-4 w-full" onClick={() => go(`/chat/${view.matchId}`)} data-testid="match-open-chat">
                대화 보기
              </Button>
            </div>
          ) : (
            <>
              <h2 id="match-suggest-title" className="text-h3">
                이렇게 시작해 볼까요?
              </h2>
              <p className="mt-1 text-body-sm text-muted-foreground">고른 카드가 첫 메시지로 바로 전송돼요.</p>
              <ul className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" aria-label="첫 대화 제안 3장">
                {view.firstSuggestion.map((c, i) => (
                  <li key={c.id} className="w-72 shrink-0 snap-start">
                    <SuggestionCard
                      title={c.title}
                      body={c.body}
                      kind={c.kind}
                      position={i + 1}
                      selected={selected === i + 1}
                      loading={busy && selected === i + 1}
                      disabled={busy && selected !== i + 1}
                      onSelect={() => select(i + 1)}
                      data-testid={`suggestion-card-${i + 1}`}
                    />
                  </li>
                ))}
              </ul>
              <Button variant="ghost" className="mt-2 w-full" onClick={skip} disabled={busy} data-testid="match-skip">
                건너뛰고 채팅하기
              </Button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
