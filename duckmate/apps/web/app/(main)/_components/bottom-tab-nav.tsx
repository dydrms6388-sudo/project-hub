"use client";

// =============================================================================
// E2 · 하단 탭 4개 고정 (12_flows §결정-1)
//   홈 /home · 탐색 /discover · 채팅 /chat · 프로필 /me
// - /likes 는 탭이 아니라 홈·탐색의 엔트리 카드로만 진입한다.
// - 채팅(Lv2)·프로필 라우트는 다른 E 에이전트 소관 — 여기서는 링크만 둔다.
// - 활성 탭은 색 + 굵기 + aria-current 3중 전달(색 단독 금지, C1 D-4-4).
// =============================================================================

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@duckmate/ui";

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TABS: TabItem[] = [
  {
    href: "/home",
    label: "홈",
    icon: (
      <svg aria-hidden="true" className="size-6" {...iconProps}>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.8V21h14V9.8" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "탐색",
    icon: (
      <svg aria-hidden="true" className="size-6" {...iconProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "채팅",
    icon: (
      <svg aria-hidden="true" className="size-6" {...iconProps}>
        <path d="M21 12a8 8 0 01-8 8H7l-4 3v-6.5A8 8 0 1121 12z" />
      </svg>
    ),
  },
  {
    href: "/me",
    label: "프로필",
    icon: (
      <svg aria-hidden="true" className="size-6" {...iconProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
];

export function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-screen-sm">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-caption",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                  active ? "font-semibold text-primary" : "text-ink-muted",
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
