/**
 * (app) 그룹 layout — E2 소유.
 *  게이트: requireProfile(1) (①~⑤ 온보딩 완료 필수, 15_auth §0-14). L2 라우트(/home·/reco·/match·/chat)는 미들웨어 classifyRoute 가
 *  ⑥(/verify)을 1차 판정하고, 각 페이지가 requireProfile(2) 로 DB 를 다시 본다(E3 /chat 도 동일 계약).
 *  noindex(PRD §0-49) · AppShell 탭 4개(홈/채팅/프로필/설정) · 채팅 배지 = get_chat_list 미읽음 합(서버 1회, 실패 0) · 제재/모드 배너.
 */
import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getChatList } from "@/lib/chat/queries";
import { getMySanctions } from "@/lib/moderation/queries";
import { AppFrame, type SanctionInfo } from "@/components/discover/AppFrame";
import { ReconsentGate } from "@/components/legal/ReconsentGate";
import { getPendingReconsents } from "@/lib/legal/reconsent";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { state } = await requireProfile(1);

  let chatBadge = 0;
  if (state.verifyLevel >= 2) {
    try {
      const r = await getChatList();
      if (r.ok) chatBadge = r.data.reduce((n, c) => n + (c.unread_count > 0 ? c.unread_count : 0), 0);
    } catch {
      chatBadge = 0;
    }
  }

  let sanction: SanctionInfo | null = null;
  if (state.sanctionLevel > 0) {
    try {
      const s = await getMySanctions();
      sanction = {
        level: s.activeLevel,
        endsAt: s.top?.endsAt ?? null,
        reasonCode: s.top?.reasonCode ?? null,
        pendingWarning: s.pendingWarning ? { id: s.pendingWarning.id, reasonCode: s.pendingWarning.reasonCode } : null,
      };
    } catch {
      sanction = { level: state.sanctionLevel, endsAt: null, reasonCode: null, pendingWarning: null };
    }
  }

  // 법적 문서 MAJOR 변경 재동의 게이트(E4) — 닫기 불가 Dialog, 없으면 null
  let pendingReconsents: Awaited<ReturnType<typeof getPendingReconsents>> = [];
  try {
    pendingReconsents = await getPendingReconsents();
  } catch {
    pendingReconsents = [];
  }

  return (
    <AppFrame verifyLevel={state.verifyLevel} mode={state.mode} chatBadge={chatBadge} sanction={sanction}>
      <ReconsentGate pending={pendingReconsents} />
      {children}
    </AppFrame>
  );
}
