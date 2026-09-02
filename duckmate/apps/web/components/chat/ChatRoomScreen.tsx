"use client";

/**
 * 대화방 화면 `/chat/[matchId]` (12_flows §5.2, 17_chat §0-1~15).
 * 서버 page 가 초기 room·최근 50개·partner_risk_banner 를 props 로 넘긴다. 이후는 TanStack ['messages', matchId] + Realtime(폴백 5초 폴링).
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OFFLINE_MEETING_RE } from "@duckmate/db/safety-rules";
import { Button, SkeletonList, useToast } from "@duckmate/ui";
import type { ActionFailure } from "@/lib/auth/errors";
import type { MessagesPage } from "@/lib/chat/queries";
import { CHAT_PAGE_SIZE, type ChatRoom, type RealtimeMatchStatusPayload, type SentMessage } from "@/lib/chat/types";
import { useChatStore } from "@/stores/chat";
import { useChatApi } from "./api";
import { EndedBar, OfflineMeetingBanner, PollingBar, SanctionBanner, TopBannerView } from "./ChatBanners";
import { BlockConfirmDialog, ChatMenuSheet, ImageZoomSheet, LeaveConfirmDialog, PartnerProfileSheet } from "./ChatDialogs";
import { ChatHeader } from "./ChatHeader";
import { prepareChatImage, isAllowedImageFile } from "./image";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import {
  CHAT_POLL_INTERVAL_MS,
  hashId,
  isEnded,
  isReciprocated,
  lengthBucket,
  makeOptimistic,
  mapSendFailure,
  mergeMessages,
  newClientId,
  parseFirstSuggestion,
  payloadToMessage,
  pickTopBanner,
  removeMessage,
  reportHref,
  sentToMessage,
  type SendUiState,
  type UiMessage,
} from "./model";
import { SuggestionPicker } from "./SuggestionPicker";
import { trackChat } from "./track";
import { useMounted } from "./useMounted";

export type ChatRoomScreenProps = {
  matchId: string;
  myProfileId: string;
  initialRoom: ChatRoom;
  initialMessages: MessagesPage;
  /** D5 partner_risk_banner (서버에서 1회) */
  riskBanner: boolean;
  /** 궁합 % (get_chat_list 미제공 — 넘기면 헤더에 게이지) */
  compat?: number | null;
  /** 내 채팅 제한 해제 시각 (level 2, E4 getMySanctions 연동 시) */
  sanctionEndsAt?: string | null;
};

type MessagesData = { items: UiMessage[]; nextBefore: string | null };

const WARN_TOAST = "커뮤니티 가이드에 맞지 않는 표현이 있어요";

export function ChatRoomScreen({ matchId, myProfileId, initialRoom, initialMessages, riskBanner, compat, sanctionEndsAt }: ChatRoomScreenProps) {
  const api = useChatApi();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = useMemo(() => ["messages", matchId] as const, [matchId]);

  const [room, setRoom] = useState<ChatRoom>(initialRoom);
  const [scamSignal, setScamSignal] = useState(riskBanner);
  const [warnContact, setWarnContact] = useState(false);
  const [inline, setInline] = useState<SendUiState | null>(null);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  const realtimeStatus = useChatStore((s) => s.realtimeStatus);
  const setRealtimeStatus = useChatStore((s) => s.setRealtimeStatus);
  const setActiveMatchId = useChatStore((s) => s.setActiveMatchId);
  const draft = useChatStore((s) => s.draftByMatch[matchId] ?? "");
  const setDraft = useChatStore((s) => s.setDraft);
  const clearDraft = useChatStore((s) => s.clearDraft);
  const guideSeen = useChatStore((s) => s.guideSeen);
  const markGuideSeen = useChatStore((s) => s.markGuideSeen);
  const dismissed = useChatStore((s) => s.dismissedByMatch[matchId]);
  const dismissBanner = useChatStore((s) => s.dismissBanner);
  const offlineShown = useChatStore((s) => s.safetyBannerShownMatchIds.includes(matchId));
  const markSafetyBannerShown = useChatStore((s) => s.markSafetyBannerShown);
  const markReadLocally = useChatStore((s) => s.markReadLocally);
  const [offlineBannerOpen, setOfflineBannerOpen] = useState(false);

  /* ---------------------------------------------------------------- messages query */
  const query = useQuery<MessagesData>({
    queryKey: key,
    initialData: { items: initialMessages.items as UiMessage[], nextBefore: initialMessages.nextBefore },
    staleTime: Infinity,
    queryFn: async () => {
      const prev = qc.getQueryData<MessagesData>(key);
      const r = await api.fetchMessages(matchId, { limit: CHAT_PAGE_SIZE });
      if (!r.ok) {
        if (r.code === "NOT_FOUND" || r.code === "NOT_ENTITLED") setDisabledReason("대화가 종료되었어요");
        return prev ?? { items: [], nextBefore: null };
      }
      const pending = (prev?.items ?? []).filter((m) => m.sendState);
      return { items: mergeMessages(prev?.items ?? [], [...(r.data.items as UiMessage[]), ...pending]), nextBefore: prev?.nextBefore ?? r.data.nextBefore };
    },
  });
  const items = query.data.items;
  const nextBefore = query.data.nextBefore;

  const patch = useCallback(
    (fn: (cur: MessagesData) => MessagesData) => {
      qc.setQueryData<MessagesData>(key, (cur) => fn(cur ?? { items: [], nextBefore: null }));
    },
    [qc, key],
  );
  const merge = useCallback((incoming: UiMessage[]) => patch((cur) => ({ ...cur, items: mergeMessages(cur.items, incoming) })), [patch]);

  /* ---------------------------------------------------------------- read / analytics */
  const openedAt = useRef(Date.now());
  const reciprocatedFired = useRef(isReciprocated(initialMessages.items as UiMessage[]));
  const doMarkRead = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const r = await api.markRead({ matchId });
    if (r.ok) {
      markReadLocally(matchId);
      if (r.data.marked > 0) trackChat("message_read", { match_id_hash: hashId(matchId), latency_min: Math.round((Date.now() - openedAt.current) / 60_000) });
    }
  }, [api, matchId, markReadLocally]);

  useEffect(() => {
    setActiveMatchId(matchId);
    trackChat("chat_opened", { match_id_hash: hashId(matchId), message_count: initialMessages.items.length, status: initialRoom.status });
    void doMarkRead();
    const onVis = () => {
      if (document.visibilityState === "visible") void doMarkRead();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      setActiveMatchId(null);
    };
    // 마운트 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (!reciprocatedFired.current && isReciprocated(items)) {
      reciprocatedFired.current = true;
      trackChat("conversation_reciprocated", { match_id_hash: hashId(matchId), hours_since_match: Math.round((Date.now() - Date.parse(room.matched_at)) / 3_600_000) });
    }
  }, [items, matchId, room.matched_at]);

  /* ---------------------------------------------------------------- realtime + polling */
  const onMatchStatus = useCallback((p: RealtimeMatchStatusPayload) => setRoom((r) => ({ ...r, status: p.status, ended_at: p.ended_at, can_send: p.status === "active" && r.can_send })), []);
  useEffect(() => {
    const unsub = api.subscribeToMatch(matchId, {
      onMessage: (p) => {
        merge([payloadToMessage(p, myProfileId)]);
        if (p.scam_signal && p.sender_id !== myProfileId) setScamSignal(true);
        if (p.sender_id !== myProfileId) void doMarkRead();
      },
      onStatus: setRealtimeStatus,
      onResync: () => void qc.invalidateQueries({ queryKey: key }),
      onMatchStatus,
    });
    return () => {
      unsub();
      setRealtimeStatus("connecting");
    };
  }, [api, matchId, myProfileId, merge, doMarkRead, setRealtimeStatus, qc, key, onMatchStatus]);

  useEffect(() => {
    if (realtimeStatus !== "polling") return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: key }), CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [realtimeStatus, qc, key]);

  /* ---------------------------------------------------------------- scroll */
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCount = useRef(items.length);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (items.length !== lastCount.current) {
      lastCount.current = items.length;
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    }
  }, [items]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 40 && nextBefore && !loadingOlder) void loadOlder();
  }
  async function loadOlder() {
    const el = scrollRef.current;
    if (!nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    const prevHeight = el?.scrollHeight ?? 0;
    const r = await api.fetchMessages(matchId, { before: nextBefore, limit: CHAT_PAGE_SIZE });
    setLoadingOlder(false);
    if (!r.ok) return;
    patch((cur) => ({ items: mergeMessages(r.data.items as UiMessage[], cur.items), nextBefore: r.data.nextBefore }));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  /* ---------------------------------------------------------------- send */
  function applyFailure(f: ActionFailure, clientMsg: UiMessage) {
    const ui = mapSendFailure(f);
    switch (ui.kind) {
      case "inline":
        patch((cur) => ({ ...cur, items: removeMessage(cur.items, clientMsg.id) }));
        setInline(ui);
        if (clientMsg.body) setDraft(matchId, clientMsg.body);
        break;
      case "disable":
        patch((cur) => ({ ...cur, items: removeMessage(cur.items, clientMsg.id) }));
        if (ui.reason === "image_not_allowed") {
          setRoom((r) => ({ ...r, image_allowed: false }));
          setInline({ kind: "inline", message: ui.message });
        } else {
          setDisabledReason(ui.message);
          if (clientMsg.body) setDraft(matchId, clientMsg.body);
        }
        break;
      case "redirect":
        toast({ title: ui.message, variant: "error" });
        router.replace(ui.to);
        break;
      case "retry":
        merge([{ ...clientMsg, sendState: "failed", errorMessage: ui.message }]);
        break;
    }
  }

  function afterSent(sent: SentMessage, clientId: string, isImage: boolean, bodyLen: number) {
    const confirmed = sentToMessage(sent, myProfileId, clientId);
    merge([confirmed]);
    trackChat("message_sent", { match_id_hash: hashId(matchId), is_first: items.filter((m) => !m.sendState).length === 0, has_image: isImage, length_bucket: lengthBucket(bodyLen) });
    if (isImage) trackChat("image_sent", { match_id_hash: hashId(matchId) });
    if (sent.warnRules.length > 0) toast({ title: WARN_TOAST });
    if (sent.warnContact) setWarnContact(true);
    if (sent.offlineMeeting && !offlineShown) {
      setOfflineBannerOpen(true);
      markSafetyBannerShown(matchId);
    }
  }

  async function send(body: string, clientId = newClientId()) {
    if (sending) return;
    setInline(null);
    const optimistic = makeOptimistic({ matchId, myProfileId, body, clientId });
    merge([optimistic]);
    clearDraft(matchId);
    stickToBottom.current = true;
    setSending(true);
    const r = await api.sendMessage({ matchId, body });
    setSending(false);
    if (r.ok) afterSent(r.data, clientId, false, body.length);
    else applyFailure(r, optimistic);
    if (!offlineShown && OFFLINE_MEETING_RE.test(body) && r.ok && !r.data.offlineMeeting) {
      setOfflineBannerOpen(true);
      markSafetyBannerShown(matchId);
    }
  }

  async function sendImage(file: File) {
    if (sending) return;
    if (!isAllowedImageFile(file)) {
      setInline({ kind: "inline", message: "JPG/PNG/WebP 만 보낼 수 있어요" });
      return;
    }
    setInline(null);
    const clientId = newClientId();
    const localImageUrl = URL.createObjectURL(file);
    const optimistic = makeOptimistic({ matchId, myProfileId, body: null, clientId, localImageUrl });
    merge([optimistic]);
    stickToBottom.current = true;
    setSending(true);
    const prepared = await prepareChatImage(file);
    const ticket = await api.createChatImageUploadUrl({ matchId, contentType: prepared.contentType, sizeBytes: prepared.blob.size });
    if (!ticket.ok) {
      setSending(false);
      applyFailure(ticket, optimistic);
      return;
    }
    const up = await api.uploadImage(ticket.data, prepared.blob, prepared.contentType);
    if (!up.ok) {
      setSending(false);
      merge([{ ...optimistic, sendState: "failed", errorMessage: up.message }]);
      return;
    }
    const r = await api.sendImageMessage({ matchId, messageId: ticket.data.messageId });
    setSending(false);
    if (r.ok) afterSent(r.data, clientId, true, 0);
    else applyFailure(r, optimistic);
  }

  function retry(m: UiMessage) {
    patch((cur) => ({ ...cur, items: removeMessage(cur.items, m.id) }));
    if (m.body) void send(m.body, m.clientId);
    else setInline({ kind: "inline", message: "사진은 다시 선택해서 보내 주세요" });
  }

  /* ---------------------------------------------------------------- menu actions */
  async function block() {
    setBusy(true);
    const r = await api.blockProfile({ targetId: room.partner_id });
    setBusy(false);
    if (r.ok) {
      trackChat("block_submitted", { surface: "chat" });
      toast({ title: "차단했어요", description: "서로 보이지 않아요. 상대에게 알림은 가지 않아요.", variant: "success" });
      qc.removeQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["matches"] });
      router.replace("/chat");
    } else {
      setBlockOpen(false);
      toast({ title: r.message, variant: "error" });
      if (r.redirectTo) router.replace(r.redirectTo);
    }
  }
  async function leave() {
    setBusy(true);
    const r = await api.leaveMatch({ matchId });
    setBusy(false);
    if (r.ok) {
      trackChat("chat_left", { match_id_hash: hashId(matchId) });
      void qc.invalidateQueries({ queryKey: ["matches"] });
      router.replace("/chat");
    } else {
      setLeaveOpen(false);
      toast({ title: r.message, variant: "error" });
    }
  }
  function goReport(reason?: string) {
    router.push(reportHref(room.partner_id, matchId, reason));
  }

  /* ---------------------------------------------------------------- derived */
  const ended = isEnded(room.status);
  const sanctioned = room.my_sanction_level >= 2;
  const firstSuggestion = useMemo(() => parseFirstSuggestion(room.first_suggestion), [room.first_suggestion]);
  const showPicker = !ended && !sanctioned && items.length === 0 && firstSuggestion.length > 0;
  const topBanner = pickTopBanner(room, { scamSignal, warnContact, guideSeen, dismissed });
  useEffect(() => {
    if (topBanner?.kind === "guide") markGuideSeen();
    // guide 는 1회 노출 후 seen — 닫기 전까지는 dismissedByMatch 로 유지된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topBanner?.kind]);
  const inputDisabledReason = ended ? null : sanctioned ? "채팅이 24시간 제한됐어요. 메시지는 읽을 수 있어요" : disabledReason ?? (room.can_send ? null : "지금은 메시지를 보낼 수 없어요");
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="flex h-dvh flex-col bg-background" data-testid="chat-room">
        <ChatHeader room={room} compat={compat} onOpenMenu={() => setMenuOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
        <SkeletonList rows={4} className="flex-1 px-4 py-4" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background" data-testid="chat-room">
      <ChatHeader room={room} compat={compat} onOpenMenu={() => setMenuOpen(true)} onOpenProfile={() => setProfileOpen(true)} />
      {realtimeStatus === "polling" ? <PollingBar /> : null}
      <div className="flex flex-col gap-2 px-4 pt-2 empty:hidden">
        {sanctioned ? <SanctionBanner endsAt={sanctionEndsAt} /> : null}
        <TopBannerView banner={topBanner} matchId={matchId} onReport={() => goReport("ROMANCE_SCAM")} onDismiss={(k) => dismissBanner(matchId, k)} />
        {offlineBannerOpen ? <OfflineMeetingBanner onDismiss={() => setOfflineBannerOpen(false)} /> : null}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain" data-testid="chat-scroll">
        {nextBefore ? (
          <div className="flex justify-center pt-3">
            <Button variant="ghost" size="sm" onClick={() => void loadOlder()} loading={loadingOlder} data-testid="chat-load-older">
              이전 대화 보기
            </Button>
          </div>
        ) : null}
        {showPicker ? (
          <div className="px-4 pt-3">
            <SuggestionPicker
              matchId={matchId}
              cards={firstSuggestion}
              surface="chat"
              collapsible
              title="첫 마디, 이렇게 시작해 볼까요?"
              onSent={(sent) => afterSent(sent, newClientId(), false, sent.body?.length ?? 0)}
              onFailure={(f) => applyFailure(f, makeOptimistic({ matchId, myProfileId, body: null, clientId: "picker" }))}
            />
          </div>
        ) : null}
        {items.length === 0 && !showPicker ? (
          <p className="px-6 py-10 text-center text-body-sm text-muted-foreground">
            {ended ? "남은 대화가 없어요" : `${room.partner_nickname ?? "상대"}님과 매칭됐어요. 첫 마디를 건네 보세요.`}
          </p>
        ) : null}
        <MessageList items={items} onRetry={retry} onOpenImage={setZoomUrl} />
      </div>
      {ended ? (
        <EndedBar status={room.status as Exclude<ChatRoom["status"], "active">} />
      ) : (
        <MessageInput
          value={draft}
          onChange={(v) => setDraft(matchId, v)}
          onSend={(body) => void send(body)}
          onPickImage={(f) => void sendImage(f)}
          sending={sending}
          disabledReason={inputDisabledReason}
          imageAllowed={room.image_allowed && room.both_l3}
          imageAllowedAt={room.image_allowed_at}
          bothL3={room.both_l3}
          inline={inline}
          onClearInline={() => setInline(null)}
        />
      )}

      <ChatMenuSheet open={menuOpen} onOpenChange={setMenuOpen} room={room} onProfile={() => { setMenuOpen(false); setProfileOpen(true); }} onBlock={() => { setMenuOpen(false); setBlockOpen(true); }} onLeave={() => { setMenuOpen(false); setLeaveOpen(true); }} />
      <PartnerProfileSheet open={profileOpen} onOpenChange={setProfileOpen} room={room} />
      <BlockConfirmDialog open={blockOpen} onOpenChange={setBlockOpen} nickname={room.partner_nickname ?? "상대"} loading={busy} onConfirm={() => void block()} />
      <LeaveConfirmDialog open={leaveOpen} onOpenChange={setLeaveOpen} loading={busy} onConfirm={() => void leave()} />
      <ImageZoomSheet url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </div>
  );
}
