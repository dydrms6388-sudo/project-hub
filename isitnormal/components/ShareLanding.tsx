"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track } from "@/lib/track";

/**
 * /s/ 랜딩 상호작용. 열면 share_landing 계측, "나도 투표하기" 클릭 시 share_to_vote 계측 후
 * 색인된 본 페이지(/q/{slug})로 보낸다(U3). K값(공유→유입→투표) 추적의 핵심.
 */
export default function ShareLanding({ slug }: { slug: string }) {
  useEffect(() => {
    track("share_landing", { slug });
  }, [slug]);

  return (
    <Link
      href={`/q/${slug}`}
      onClick={() => track("share_to_vote", { slug })}
      className="block w-full rounded-2xl bg-brand px-5 py-4 text-center text-base font-bold text-white shadow-sm transition hover:bg-brand-dark"
    >
      나도 투표하고 내 결과 보기 →
    </Link>
  );
}
