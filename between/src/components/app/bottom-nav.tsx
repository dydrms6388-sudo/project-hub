"use client";

import { Compass, Heart, Layers, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/explore", label: "탐색", icon: Compass },
  { href: "/swipe", label: "스와이프", icon: Layers },
  { href: "/likes", label: "좋아요", icon: Heart },
  { href: "/me", label: "내 프로필", icon: UserRound },
] as const;

export function BottomNav({ matchBadge = 0 }: { matchBadge?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주 메뉴"
      className="bg-background/85 pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/5 backdrop-blur-xl md:left-1/2 md:max-w-xl md:-translate-x-1/2 md:rounded-t-2xl md:border-x"
    >
      <ul className="grid h-16 grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", active && "text-primary")} strokeWidth={active ? 2.4 : 1.8} />
                  {href === "/likes" && matchBadge > 0 && (
                    <span className="bg-accent absolute -top-1 -right-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-bold text-white">
                      {matchBadge > 99 ? "99+" : matchBadge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
