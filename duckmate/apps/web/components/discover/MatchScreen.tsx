"use client";

/**
 * /match/[id] — 순서 고정: (첫 매칭이면 안전 모달) → MatchReveal simple ≤1.2s → 제안 카드 3장(E3 `SuggestionPicker`) → 선택 시 첫 메시지 자동 전송 → /chat/[matchId].
 * 건너뛰기 → /chat/[matchId] (E3 방 상단에 접힌 카드 재노출), 닫기 ✕ → /chat. 리빌 앞뒤에 광고·결제 유도 없음.
 *
 * H2: 제안 카드 선택 로직은 E3 `components/chat/SuggestionPicker` 로 단일화했다(중복 제거, `send={api.sendFirst}` 주입 →
 *     개발 목 라우트도 그대로 동작). 전송 성공 → `['matches']` invalidate → /chat/[matchId].
 *     리빌 뒤 첫 매칭 1회 푸시 소프트 프롬프트(20_notifications §0-4) · 화면 제목 h1(sr-only, G1 §19).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button, EmptyState, MatchReveal, useToast } from "@duckmate/ui";
import { SuggestionPicker } from "@/components/chat/SuggestionPicker";
import { PushSoftPrompt } from "@/components/push/PushSoftPrompt";
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

  React.useEffect(() => {
    if (view) track("match_screen_viewed", { match_id_hash: idHash(view.matchId) });
  }, [view]);
  const shownRef = React.useRef(false);
  React.useEffect(() => {
    if (!view || !revealed || shownRef.current || view.firstSuggestion.length === 0) return;
    shownRef.current = true;
    track("suggestion_shown", { template_ids: view.firstSuggestion.map((c) => c.template_id), kinds: view.firstSuggestion.map((c) => c.kind) });
  }, [view, revealed]);

  const skip = () => {
    track("suggestion_skipped");
    go(`/chat/${matchId}`);
  };

  /** 제안 카드 전송 성공(SuggestionPicker) → 채팅 목록 무효화 후 대화방으로. `suggestion_selected` 는 Picker 가 발화 */
  const onSent = () => {
    void qc.invalidateQueries({ queryKey: QK.matches });
    go(`/chat/${matchId}`);
  };

  const onSendFailure = (f: Parameters<typeof mapFailure>[0]) => {
    const ux = mapFailure(f, { surface: "send" });
    if (ux.kind === "redirect") go(ux.to);
    else if (ux.kind === "toast") toast({ title: withRetry(ux.message, ux.retryAfterSec), variant: "error" });
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
      {/* 리빌 헤드라인은 MatchReveal 안의 h2 라 화면 제목이 없었다 → 시각적으로 숨긴 h1 (G1 §19 · H2) */}
      <h1 className="sr-only">{partnerName}님과 매칭됐어요</h1>
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
        <section className="mt-6 animate-fade-in" aria-label="첫 대화 제안" data-testid="match-suggestions">
          {alreadyStarted ? (
            <div className="text-center">
              <h2 className="text-h3">
                이미 대화가 시작됐어요
              </h2>
              <Button className="mt-4 w-full" onClick={() => go(`/chat/${view.matchId}`)} data-testid="match-open-chat">
                대화 보기
              </Button>
            </div>
          ) : (
            <>
              <p className="text-body-sm text-muted-foreground">고른 카드가 첫 메시지로 바로 전송돼요. 마음에 드는 게 없으면 건너뛰어도 괜찮아요.</p>
              <SuggestionPicker
                className="mt-3"
                matchId={view.matchId}
                cards={view.firstSuggestion}
                surface="match"
                title="이렇게 시작해 볼까요?"
                send={api.sendFirst}
                onSent={onSent}
                onFailure={onSendFailure}
              />
              <Button variant="ghost" className="mt-2 w-full" onClick={skip} data-testid="match-skip">
                건너뛰고 채팅하기
              </Button>
            </>
          )}
        </section>
      ) : null}

      {/* 첫 매칭 직후 1회 소프트 프롬프트 → [알림 켜기] 클릭 안에서만 브라우저 권한 요청 (20_notifications §0-4) */}
      {revealed && !showSafety ? <PushSoftPrompt surface="match" className="mt-6" /> : null}
    </div>
  );
}
