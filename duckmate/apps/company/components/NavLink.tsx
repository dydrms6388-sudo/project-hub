"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** 현재 경로면 aria-current="page" (헤더 내비 전용, 상태 없음). */
export function NavLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();
  const current = pathname === href || pathname === href.replace(/\/$/, "");
  return <Link href={href} aria-current={current ? "page" : undefined} {...props} />;
}
