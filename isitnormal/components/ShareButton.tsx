"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import type { SurveyStats } from "@/lib/types";

interface Props {
  slug: string;
  stats: SurveyStats | null;
  selectedKey?: string | null;
}

/**
 * P3 최소 공유 버튼 — 현재 결과 페이지 링크 복사 + share_click 계측.
 * P4에서 /s/{shortId} 짧은링크 + 바이럴 카드 생성으로 승격한다.
 */
export default function ShareButton({ slug, stats, selectedKey }: Props) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    track("share_click", { slug, meta: { hasStats: Boolean(stats?.showStats), selectedKey } });
    const url = typeof window !== "undefined" ? `${window.location.origin}/q/${slug}` : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "정상인가요", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 사용자 취소 등 무시 */
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className="w-full rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-dark"
    >
      {copied ? "링크 복사됨 ✓" : "친구에게 물어보기 · 공유"}
    </button>
  );
}
