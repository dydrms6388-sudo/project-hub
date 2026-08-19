// =============================================================================
// E2 · (main) 상단 헤더 — 12_flows §3.1 "덕메이트  🔔  [친구모드]"
// 서버 컴포넌트. 모드 배지를 탭하면 /settings/mode, 종 아이콘은 /settings/notifications.
// (두 라우트는 E4 소관 — 여기서는 링크만 둔다)
// =============================================================================

import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import type { ProfileMode } from "@duckmate/db";

const MODE_LABEL: Record<ProfileMode, string> = {
  friend: "취미 친구 모드",
  dating: "데이팅 모드",
};

export interface AppHeaderProps {
  mode: ProfileMode;
}

export function AppHeader({ mode }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-sm items-center gap-3 px-4 py-3">
        <Link
          href="/home"
          className="text-h3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {BRAND_NAME}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings/notifications"
            aria-label="알림 설정"
            className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-primary/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 01-3.4 0" />
            </svg>
          </Link>

          <Link
            href="/settings/mode"
            className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-3 py-1.5 text-caption text-primary-tint-fg hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {MODE_LABEL[mode]}
          </Link>
        </div>
      </div>
    </header>
  );
}
