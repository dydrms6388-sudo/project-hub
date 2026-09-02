"use client";

/**
 * 메시지 리스트 (가상화 없음, 최근 50 + 위로 스크롤 페이지네이션은 부모가 처리).
 * - 수신 = display_body(masked) 렌더, placeholder 는 [연락처 가림] 칩 + 툴팁 이유
 * - 발신 = 원문 + (contactMasked) A5 §10.4 인라인 안내, (is_held) "검토 중" 표시
 * - 이미지 = 수신은 블러 + [보기] 탭 후 getChatImageUrl lazy 로드, 탭 시 확대 시트
 */
import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@duckmate/ui";
import { useChatStore } from "@/stores/chat";
import { useChatApi } from "./api";
import { ClockIcon, EyeOffIcon, RefreshIcon } from "./icons";
import { groupByDay, hasMaskedToken, splitMasked, timeLabel, type UiMessage } from "./model";

export function MaskedText({ text, mine }: { text: string; mine: boolean }) {
  const segments = useMemo(() => splitMasked(text), [text]);
  if (!hasMaskedToken(text)) return <>{text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="chat-masked-chip"
                aria-label={`${s.token.replace(/[[\]]/g, "")}: ${s.reason}`}
                className={cn(
                  "mx-0.5 inline-flex h-6 items-center gap-1 rounded-full border px-2 align-middle text-caption",
                  mine ? "border-primary-foreground/40 text-primary-foreground" : "border-border bg-muted text-muted-foreground",
                )}
              >
                <EyeOffIcon size={12} />
                {s.token.replace("숨김", "가림").replace(/[[\]]/g, "")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{s.reason}</TooltipContent>
          </Tooltip>
        ),
      )}
    </>
  );
}

function ImageBubble({ m, onOpen }: { m: UiMessage; onOpen: (url: string) => void }) {
  const api = useChatApi();
  const revealed = useChatStore((s) => s.revealedImageIds.includes(m.id));
  const revealImage = useChatStore((s) => s.revealImage);
  const [url, setUrl] = useState<string | null>(m.localImageUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldLoad = (m.is_mine || revealed) && !url && m.image_path && !m.sendState;

  useEffect(() => {
    if (!shouldLoad || !m.image_path) return;
    let cancelled = false;
    setLoading(true);
    void api.getChatImageUrl({ path: m.image_path }).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setUrl(r.data.url);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, m.image_path, api]);

  const box = "relative flex size-48 max-w-full items-center justify-center overflow-hidden rounded-lg bg-muted";
  if (url) {
    return (
      <button type="button" onClick={() => onOpen(url)} className={cn(box, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")} aria-label="사진 크게 보기">
        <img src={url} alt="대화 사진" className="size-full object-cover" />
      </button>
    );
  }
  if (!m.is_mine && !revealed) {
    return (
      <div className={box} data-testid="chat-image-blurred">
        <div aria-hidden="true" className="absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--color-muted),var(--color-muted)_8px,var(--color-border)_8px,var(--color-border)_16px)] opacity-60" />
        <button type="button" onClick={() => revealImage(m.id)} className="relative z-10 inline-flex h-10 items-center rounded-md bg-card px-4 text-button-sm text-foreground shadow-md">
          보기
        </button>
        <span className="absolute bottom-2 left-0 right-0 z-10 text-center text-caption text-muted-foreground">사진은 탭해서 확인해요</span>
      </div>
    );
  }
  return (
    <div className={box} role="status" aria-label={loading ? "사진 불러오는 중" : "사진"}>
      {error ? <span className="px-3 text-center text-caption text-muted-foreground">{error}</span> : <span className="text-caption text-muted-foreground">{loading ? "불러오는 중…" : "사진"}</span>}
    </div>
  );
}

function Bubble({ m, lastReadMineId, onRetry, onOpenImage }: { m: UiMessage; lastReadMineId: string | null; onRetry: (m: UiMessage) => void; onOpenImage: (url: string) => void }) {
  const mine = m.is_mine;
  const isImage = Boolean(m.image_path) || Boolean(m.localImageUrl);
  return (
    <li className={cn("flex w-full flex-col gap-1", mine ? "items-end" : "items-start")} data-testid="chat-message" data-mine={mine ? "true" : "false"} data-message-id={m.id}>
      <div className={cn("flex max-w-[80%] items-end gap-1.5", mine ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-body",
            mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card text-card-foreground shadow-sm",
            m.sendState === "failed" && "opacity-70",
            isImage && "p-1",
          )}
        >
          {isImage ? <ImageBubble m={m} onOpen={onOpenImage} /> : <MaskedText text={m.display_body} mine={mine} />}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-0.5 pb-0.5 text-caption text-muted-foreground">
          {m.sendState === "sending" ? (
            <ClockIcon size={12} aria-label="전송 중" />
          ) : m.sendState === "failed" ? null : (
            <>
              {mine && lastReadMineId === m.id ? <span className="text-primary">읽음</span> : null}
              <time dateTime={m.created_at}>{timeLabel(m.created_at)}</time>
            </>
          )}
        </div>
      </div>
      {m.sendState === "failed" ? (
        <div className="flex items-center gap-2 text-caption text-destructive" role="alert">
          <span>{m.errorMessage ?? "전송하지 못했어요"}</span>
          <button type="button" onClick={() => onRetry(m)} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-foreground" data-testid="chat-retry">
            <RefreshIcon size={12} /> 다시 보내기
          </button>
        </div>
      ) : null}
      {mine && m.is_held ? (
        <p className="max-w-[80%] text-caption text-warning" role="status">
          검토 중이라 상대에게 전달되지 않았어요
        </p>
      ) : null}
      {mine && m.contactMasked && !m.is_held ? (
        <p className="max-w-[80%] text-caption text-muted-foreground" data-testid="chat-masked-note">
          연락처·링크는 매칭 3일 후부터 보낼 수 있어요. 상대에게는 [연락처 숨김]으로 보여요.
        </p>
      ) : null}
    </li>
  );
}

export function MessageList({ items, onRetry, onOpenImage, now }: { items: readonly UiMessage[]; onRetry: (m: UiMessage) => void; onOpenImage: (url: string) => void; now?: Date }) {
  const groups = useMemo(() => groupByDay(items, now), [items, now]);
  const lastReadMineId = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const m = items[i]!;
      if (m.is_mine && m.read_at && !m.sendState) return m.id;
    }
    return null;
  }, [items]);
  return (
    <TooltipProvider delayDuration={200}>
      <ol className="flex flex-col gap-2 px-4 py-3" aria-label="메시지">
        {groups.map((g) =>
          g.type === "date" ? (
            <li key={g.key} className="my-2 flex items-center gap-3 text-caption text-muted-foreground" aria-label={`${g.label} 구분선`}>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <span data-testid="chat-date-separator">{g.label}</span>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </li>
          ) : (
            <Bubble key={g.key} m={g.message} lastReadMineId={lastReadMineId} onRetry={onRetry} onOpenImage={onOpenImage} />
          ),
        )}
      </ol>
    </TooltipProvider>
  );
}
