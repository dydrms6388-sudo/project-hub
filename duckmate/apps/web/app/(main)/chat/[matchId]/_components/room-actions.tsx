"use client";

// =============================================================================
// E3 · 대화방 헤더의 신고/차단 진입점 (⋮ 메뉴 + 신고 시트 + 차단 확인)
//
// 서브 헤더는 서버 컴포넌트(page.tsx)가 그리고, 상호작용이 필요한 이 조각만
// 클라이언트로 내린다.
//
// 안전 카드([신고하기])는 메시지 영역(chat-room.tsx)에 있어 컴포넌트 트리가 다르다.
// 신고 시트를 두 벌 만들지 않기 위해 window CustomEvent 하나로 연결한다:
//   chat-room.tsx  → dispatchEvent(new CustomEvent(REPORT_EVENT, {detail:{code}}))
//   여기           → 그 이벤트를 받아 시트를 프리필 상태로 연다
// (전역 상태 라이브러리를 새로 끌어오지 않기 위한 최소 결합 — 같은 라우트 안에서만 쓴다)
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ReasonCode } from "@duckmate/db";
import { RoomMenu } from "./room-menu";
import { ReportSheet } from "./report-sheet";

export const REPORT_EVENT = "duckmate:chat-report";

export interface RoomActionsProps {
  matchId: string;
  /** 탈퇴·차단 상대면 null → 신고/차단 비활성 */
  targetId: string | null;
  partnerNickname: string;
}

export function RoomActions({ matchId, targetId, partnerNickname }: RoomActionsProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<ReasonCode | null>(null);

  React.useEffect(() => {
    function onRequest(e: Event) {
      const detail = (e as CustomEvent<{ code?: ReasonCode }>).detail;
      setPrefill(detail?.code ?? null);
      setSheetOpen(true);
    }
    window.addEventListener(REPORT_EVENT, onRequest);
    return () => window.removeEventListener(REPORT_EVENT, onRequest);
  }, []);

  function goListAfterBlock() {
    setSheetOpen(false);
    router.replace("/chat?notice=blocked");
    router.refresh();
  }

  return (
    <>
      <RoomMenu
        targetId={targetId}
        partnerNickname={partnerNickname}
        onReport={() => {
          setPrefill(null);
          setSheetOpen(true);
        }}
        onBlocked={goListAfterBlock}
      />

      {targetId ? (
        <ReportSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          targetId={targetId}
          matchId={matchId}
          partnerNickname={partnerNickname}
          prefillCode={prefill}
          onBlocked={goListAfterBlock}
        />
      ) : null}
    </>
  );
}
