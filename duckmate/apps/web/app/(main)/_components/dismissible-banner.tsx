"use client";

// =============================================================================
// E2 · 1회성 홈 배너 (12_flows §8.8 — 사진 반려 안내 등)
// 세션 동안만 닫힘 상태를 기억한다(sessionStorage). 푸시로는 보내지 않는 정보.
// 닫기 버튼은 항상 노출 — 빠져나갈 길을 숨기지 않는다.
// =============================================================================

import * as React from "react";
import { LinkButton } from "./link-button";

export interface DismissibleBannerProps {
  /** sessionStorage 키 (배너 종류별 고유) */
  storageKey: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}

export function DismissibleBanner({
  storageKey,
  message,
  actionHref,
  actionLabel,
}: DismissibleBannerProps) {
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    try {
      setHidden(window.sessionStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  if (hidden) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-warning-tint px-4 py-3">
      <p className="min-w-0 flex-1 text-body-sm text-ink">{message}</p>
      <LinkButton href={actionHref} variant="ghost" size="sm">
        {actionLabel}
      </LinkButton>
      <button
        type="button"
        aria-label="배너 닫기"
        onClick={() => {
          try {
            window.sessionStorage.setItem(storageKey, "1");
          } catch {
            // 저장 실패해도 이번 렌더에서는 닫는다
          }
          setHidden(true);
        }}
        className="flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-primary/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
