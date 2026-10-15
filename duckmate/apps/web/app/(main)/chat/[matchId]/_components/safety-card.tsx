"use client";

// =============================================================================
// E3 · 수신자 안전 카드 [F-SAF-06] (A5 §5.2 · D4 §6.4-3)
//
// ⚠ 표시 조건은 호출부에서 이미 판정한다: `event.for_profile_id === 내 프로필` 일 때만.
//   발신자에게 띄우면 어떤 문구가 탐지를 유발했는지가 드러나 우회 학습이 가능해진다.
// 문구는 상대를 단정하지 않고("스캠일 수 있어요" 가 아니라 신호 설명) 행동 2개만 준다.
// =============================================================================

import * as React from "react";
import { Button } from "@duckmate/ui";

export type SafetyCardKind = "money" | "invest" | "sexual";

const CARD_COPY: Record<SafetyCardKind, { title: string; body: string }> = {
  money: {
    title: "금전 이야기가 오갔어요",
    body: "돈을 보내 달라거나 계좌를 알려 달라는 요청은 흔한 스캠 신호예요. 송금 전에 꼭 멈추고 신고해 주세요.",
  },
  invest: {
    title: "투자 권유가 감지됐어요",
    body: "코인·주식 리딩방, 고수익 보장 권유는 스캠에서 자주 쓰이는 방식이에요. 링크를 열기 전에 신고해 주세요.",
  },
  sexual: {
    title: "불편할 수 있는 내용이 있었어요",
    body: "원치 않는 성적 접근은 참지 않아도 돼요. 신고하면 24시간 이내에 검토하고 조치해요.",
  },
};

export function SafetyCard({
  kind,
  onReport,
  onDismiss,
}: {
  kind: SafetyCardKind;
  onReport: () => void;
  onDismiss: () => void;
}) {
  const copy = CARD_COPY[kind];
  return (
    <div
      role="alert"
      data-testid="chat-safety-card"
      data-kind={kind}
      className="rounded-2xl border border-line bg-warning-tint p-4 text-ink"
    >
      <p className="text-h3 text-warning">{copy.title}</p>
      <p className="mt-1 text-body-sm">{copy.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="danger" size="md" onClick={onReport} data-testid="chat-safety-report">
          신고하기
        </Button>
        <Button variant="ghost" size="md" onClick={onDismiss} data-testid="chat-safety-dismiss">
          닫기
        </Button>
      </div>
    </div>
  );
}
