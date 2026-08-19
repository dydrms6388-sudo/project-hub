// =============================================================================
// E3 · /chat/[matchId] — 대화방 (서버 컴포넌트) [F-CHT-01~04] (12_flows §4.2)
//
// 서버가 준비해서 내려주는 것:
//   ① 초기 메시지 1페이지 — (match_id, id desc) keyset (D4-6)
//   ② 상대 정보 — chat_rooms 뷰 + 취미 Top3(best-effort). 탈퇴/차단이면 partner=null
//      → "대화를 종료한 상대예요" 상태로 입력 비활성 (12_flows §8.10)
//   ③ 첫 대화 제안 카드 3개 — **대화가 비어 있을 때만**(room.isNew). ?remix=1 이면
//      7일 무응답 방의 "제안 카드 다시 보내기" 맥락으로 한 번 더 노출 [F-CHT-05]
//   ④ 마스킹 안내 바 — contactUnlocked 분기(표시 전용, masking-notice.tsx 주석 참조)
//
// 원문 body 는 어떤 경로로도 이 화면에 오지 않는다. 렌더 대상은 masked_body 뿐(D4 §6.4-1).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, VerifyLevelBadge } from "@duckmate/ui";
import { requireVerifyLevel } from "@/lib/auth/guards";
import { getChatRoom, getMessages } from "@/lib/chat/queries";
import { getFirstSuggestions, type SuggestionCard } from "@/lib/chat/suggestion";
import { createClient } from "@/lib/supabase/server";
import { RetryCard } from "../../_components/retry-card";
import { MaskingNotice } from "./_components/masking-notice";
import { ChatRoomClient } from "./_components/chat-room";

export const metadata: Metadata = {
  title: "대화",
  robots: { index: false, follow: false },
};

const MODE_LABEL: Record<string, string> = {
  friend: "취미친구",
  dating: "데이팅",
  both: "둘 다",
};

/** 상대 취미 Top3 — 실패해도 방은 완결돼 보여야 한다(사진·취미는 가산점) */
async function getPartnerTopHobbies(partnerId: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile_hobbies")
      .select("rank, hobbies(name)")
      .eq("profile_id", partnerId)
      .not("rank", "is", null)
      .order("rank", { ascending: true })
      .limit(3);

    const rows = (data ?? []) as { rank: number | null; hobbies: { name: string } | null }[];
    return rows
      .map((r) => r.hobbies?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
  } catch {
    return [];
  }
}

export default async function ChatRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ remix?: string }>;
}) {
  const { matchId } = await params;
  const { remix } = await searchParams;
  const { profile } = await requireVerifyLevel(2);

  const roomRes = await getChatRoom(matchId, profile.id);
  if (!roomRes.ok) {
    // 차단/비참여/삭제를 구분해 노출하지 않는다 (D4 §6.3 MATCH_NOT_FOUND)
    if (roomRes.code === "MATCH_NOT_FOUND") redirect("/chat?notice=match-not-found");
    return (
      <RetryCard
        title="대화방을 불러오지 못했어요"
        description="연결이 불안정할 수 있어요. 잠시 후 다시 시도해 주세요."
      />
    );
  }
  const room = roomRes.data;

  const messagesRes = await getMessages(matchId, profile.id, {});
  if (!messagesRes.ok) {
    return (
      <RetryCard
        title="메시지를 불러오지 못했어요"
        description="연결이 불안정할 수 있어요. 잠시 후 다시 시도해 주세요."
      />
    );
  }
  const page = messagesRes.data;

  // 제안 카드: 대화가 비어 있을 때 기본 노출, ?remix=1 이면 재노출 [F-CHT-05]
  const wantSuggestions = room.isNew || remix === "1";
  let suggestions: SuggestionCard[] = [];
  if (wantSuggestions) {
    const sugRes = await getFirstSuggestions(matchId, profile.id);
    if (sugRes.ok) suggestions = sugRes.data.cards;
  }

  const topHobbies = room.partnerId ? await getPartnerTopHobbies(room.partnerId) : [];
  const nickname = room.partner?.nickname ?? "탈퇴한 사용자";
  const closed = room.status !== "active" || room.partner === null;
  const partnerVerified = (room.partner?.verifyLevel ?? 0) >= 2;
  const canSendImage = profile.verify_level >= 2 && partnerVerified && !closed;

  return (
    <div className="flex flex-col gap-3" data-testid="chat-room" data-match-id={matchId}>
      {/* 서브 헤더 — 뒤로가기 · 상대 · 카드요약 · ⋮(신고/차단) */}
      <div className="flex items-center gap-2">
        <Link
          href="/chat"
          aria-label="대화 목록으로"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-primary/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          data-testid="chat-back"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 2L4 8l6 6" />
          </svg>
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-h2">{nickname}</h1>
        {room.partner ? <VerifyLevelBadge level={room.partner.verifyLevel} compact /> : null}
        {closed ? <Badge variant="neutral">종료</Badge> : null}
      </div>

      {/* 상대 덕질카드 요약 — 기본 접힘(네이티브 details = 키보드/스크린리더 기본 지원) */}
      {room.partner ? (
        <details className="rounded-2xl border border-line bg-surface-raised px-4 py-3">
          <summary className="cursor-pointer text-body-sm font-semibold text-ink">
            카드 요약
          </summary>
          <dl className="mt-2 flex flex-col gap-1 text-body-sm text-ink-muted">
            {topHobbies.length > 0 ? (
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-ink">Top3</dt>
                <dd>{topHobbies.join(" · ")}</dd>
              </div>
            ) : null}
            {room.partner.favNote ? (
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-ink">최애</dt>
                <dd className="min-w-0 break-words">{room.partner.favNote}</dd>
              </div>
            ) : null}
            {room.partner.currentObsession ? (
              <div className="flex gap-2">
                <dt className="shrink-0 font-semibold text-ink">요즘 빠진 것</dt>
                <dd className="min-w-0 break-words">{room.partner.currentObsession}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-ink">모드</dt>
              <dd>{MODE_LABEL[room.partner.mode] ?? room.partner.mode}</dd>
            </div>
          </dl>
        </details>
      ) : null}

      <MaskingNotice contactUnlocked={room.contactUnlocked} />

      <ChatRoomClient
        matchId={matchId}
        myProfileId={profile.id}
        partnerId={room.partnerId}
        partnerNickname={nickname}
        initialMessages={page.messages}
        initialHasMore={page.hasMore}
        initialCursor={page.nextCursor}
        suggestions={suggestions}
        suggestionsRemix={!room.isNew && remix === "1"}
        closed={closed}
        canSendImage={canSendImage}
        imageBlockReason={
          closed
            ? "종료된 대화방에서는 사진을 보낼 수 없어요."
            : profile.verify_level < 2
              ? "본인인증을 마치면 사진을 보낼 수 있어요."
              : "상대가 본인인증을 마치면 사진을 주고받을 수 있어요."
        }
      />
    </div>
  );
}
