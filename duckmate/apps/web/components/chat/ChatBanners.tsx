"use client";

/**
 * 대화방 배너·바 모음. 문구는 05_trust_safety §10 / 12_flows §5.2 / 18_moderation SANCTION_COPY 확정본.
 */
import Link from "next/link";
import { SafetyBanner } from "@duckmate/ui";
import type { ChatRoom } from "@/lib/chat/types";
import { SANCTION_COPY } from "@/lib/moderation/constants";
import { OFFLINE_MEETING_GUIDE } from "@/components/safety/copy";
import { ENDED_LABEL, dateTimeLabel, type TopBanner } from "./model";

export function TopBannerView({ banner, matchId, onReport, onDismiss }: { banner: TopBanner; matchId: string; onReport: () => void; onDismiss: (kind: "mask" | "image" | "guide") => void }) {
  if (!banner) return null;
  switch (banner.kind) {
    case "scam":
      return (
        <SafetyBanner variant="danger" data-testid="chat-banner-scam" action={{ label: "신고하기", onClick: onReport }}>
          이 대화에서 금전·투자 관련 표현이 감지됐어요. 매칭 상대에게 돈을 보내거나 투자 앱을 설치하지 마세요. 의심되면 신고해 주세요.
        </SafetyBanner>
      );
    case "mask":
      return (
        <SafetyBanner variant={banner.repeated ? "warn" : "info"} data-testid="chat-banner-mask" onDismiss={banner.repeated ? undefined : () => onDismiss("mask")}>
          {banner.bothL3 ? (
            <>
              연락처·링크는 <strong className="font-semibold">{dateTimeLabel(banner.unmaskAt)}</strong>부터 보낼 수 있어요.
            </>
          ) : (
            <>연락처·링크는 매칭 3일 후, 양쪽 사진인증부터 보낼 수 있어요.</>
          )}
          {banner.repeated ? <span className="mt-1 block">연락처 공유 시도가 반복되면 자동으로 신고돼요.</span> : null}
        </SafetyBanner>
      );
    case "image":
      return (
        <SafetyBanner variant="info" data-testid="chat-banner-image" onDismiss={() => onDismiss("image")}>
          {banner.bothL3 ? (
            <>
              사진은 <strong className="font-semibold">{dateTimeLabel(banner.imageAllowedAt)}</strong>부터 보낼 수 있어요.
            </>
          ) : (
            <>사진은 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요.</>
          )}
        </SafetyBanner>
      );
    case "guide":
      return (
        <SafetyBanner variant="info" title="대화 전에 3가지만" data-testid="chat-banner-guide" onDismiss={() => onDismiss("guide")}>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>연락처는 매칭 3일 후부터 주고받을 수 있어요.</li>
            <li>돈 이야기(송금, 투자, 상품권)는 대화가 아니라 신호예요. 바로 신고해 주세요.</li>
            <li>불편하면 언제든 차단할 수 있어요. 상대에게 알림이 가지 않아요.</li>
          </ul>
          <span className="sr-only">매칭 ID {matchId}</span>
        </SafetyBanner>
      );
  }
}

/** A5 §10.2 오프라인 만남 배너 (매칭당 1회). 카피·링크는 `components/safety/copy.ts` — 링크 대상 `/safety-guide` 는 H2 가 신설(이전 404) */
export function OfflineMeetingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <SafetyBanner variant="warn" title={OFFLINE_MEETING_GUIDE.title} data-testid="chat-banner-offline" onDismiss={onDismiss}>
      <ul className="list-disc space-y-0.5 pl-4">
        {OFFLINE_MEETING_GUIDE.items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <Link href={OFFLINE_MEETING_GUIDE.href} className="mt-2 inline-block text-button-sm underline underline-offset-4">
        {OFFLINE_MEETING_GUIDE.more}
      </Link>
    </SafetyBanner>
  );
}

/** 내 제재 level 2 (채팅 제한 24h) — 읽기 가능·전송 불가 */
export function SanctionBanner({ endsAt }: { endsAt?: string | null }) {
  const copy = SANCTION_COPY[2];
  const title = endsAt ? copy.title({ categoryLabel: "", endsAt: dateTimeLabel(endsAt) }) : "채팅이 24시간 제한됐어요";
  return (
    <SafetyBanner variant="danger" data-testid="chat-banner-sanction" title={title}>
      메시지를 읽을 수는 있지만 보낼 수 없고, 새 좋아요도 보낼 수 없어요.
    </SafetyBanner>
  );
}

/** 종료 상태 고정 바 (입력창 대체). 열람 가능, 헤더 신고 유지 */
export function EndedBar({ status }: { status: Exclude<ChatRoom["status"], "active"> }) {
  return (
    <div role="status" data-testid="chat-ended" className="border-t border-border bg-muted px-4 py-4 text-center text-body-sm text-muted-foreground pb-safe">
      {ENDED_LABEL[status]}
    </div>
  );
}

/** Realtime 폴백 중 상단 얇은 바 */
export function PollingBar() {
  return (
    <div role="status" aria-live="polite" data-testid="chat-polling" className="bg-warning-soft px-4 py-1 text-center text-caption text-warning">
      연결 중… 5초마다 새 메시지를 확인하고 있어요
    </div>
  );
}
