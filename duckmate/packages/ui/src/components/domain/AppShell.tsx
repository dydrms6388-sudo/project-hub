"use client";

import * as React from "react";
import { House, MessageCircle, Settings, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type AppTab = "home" | "chat" | "me" | "settings";

export interface AppTabItem {
  id: AppTab;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const DEFAULT_APP_TABS: readonly AppTabItem[] = [
  { id: "home", label: "홈", href: "/home", icon: House },
  { id: "chat", label: "채팅", href: "/chat", icon: MessageCircle },
  { id: "me", label: "프로필", href: "/me", icon: UserRound },
  { id: "settings", label: "설정", href: "/settings", icon: Settings },
];

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** 활성 탭 */
  active: AppTab;
  tabs?: readonly AppTabItem[];
  /** 탭별 배지 수(미읽음). 0/undefined 이면 미표시. 99 초과는 "99+" */
  badges?: Partial<Record<AppTab, number>>;
  /**
   * 링크 렌더러(Next `<Link>` 주입용). 생략 시 <a href>.
   * 반드시 className·aria-current·children 을 그대로 전달할 것.
   */
  renderLink?: (item: AppTabItem, props: { className: string; "aria-current"?: "page"; children: React.ReactNode }) => React.ReactNode;
  /** 상단 헤더 슬롯(선택) */
  header?: React.ReactNode;
  /** 하단 탭 숨김(채팅방·풀스크린) */
  hideTabs?: boolean;
  /** main 영역 className */
  mainClassName?: string;
}

/**
 * AppShell — 모바일 하단 탭 4개(홈/채팅/프로필/설정). lucide 아이콘, 활성 primary, safe-area 하단 패딩.
 * 탭 터치 영역 ≥ 44pt. nav aria-label="주 메뉴", 활성 탭 aria-current="page".
 */
export const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ children, active, tabs = DEFAULT_APP_TABS, badges, renderLink, header, hideTabs = false, mainClassName, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex min-h-dvh flex-col bg-background text-foreground", className)} {...props}>
      {header ? <header className="pt-safe sticky top-0 z-30 bg-background/95 backdrop-blur">{header}</header> : null}
      <main className={cn("flex-1", !hideTabs && "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]", mainClassName)}>{children}</main>
      {!hideTabs ? (
        <nav aria-label="주 메뉴" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
          <ul className="mx-auto flex h-16 max-w-lg items-stretch">
            {tabs.map((item) => {
              const isActive = item.id === active;
              const count = badges?.[item.id] ?? 0;
              const Icon = item.icon;
              const linkCls = cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-caption transition-colors duration-(--duration-fast)",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              );
              const content = (
                <>
                  <span className="relative">
                    <Icon size={24} strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
                    {count > 0 ? (
                      <span className="tnum absolute -right-2.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground" aria-hidden="true">
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                  {count > 0 ? <span className="sr-only">, 새 알림 {count}개</span> : null}
                </>
              );
              const linkProps = { className: linkCls, "aria-current": isActive ? ("page" as const) : undefined, children: content };
              return (
                <li key={item.id} className="flex-1">
                  {renderLink ? renderLink(item, linkProps) : <a href={item.href} {...linkProps} />}
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  ),
);
AppShell.displayName = "AppShell";
