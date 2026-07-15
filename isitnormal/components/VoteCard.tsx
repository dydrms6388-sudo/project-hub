"use client";

import { useEffect, useState, useCallback } from "react";
import StatsResult from "./StatsResult";
import ShareButton from "./ShareButton";
import NotifyOptin from "./NotifyOptin";
import { track } from "@/lib/track";
import { getFingerprint } from "@/lib/fingerprint";
import type { SurveyStats } from "@/lib/types";

interface Props {
  slug: string;
  options: { key: string; label: string }[];
}

const votedKeyOf = (slug: string) => `isn_vote_${slug}`;

/**
 * 참여 비용 계단의 1탭 지점. 투표 전엔 결과를 절대 안 보여준다(참여율 3배).
 * 단 "결과만 보기"는 항상 제공(강제 금지). R2: 내 선택 로컬 우선 저장.
 */
export default function VoteCard({ slug, options }: Props) {
  const [phase, setPhase] = useState<"vote" | "result">("vote");
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("view", { slug });
    try {
      const prev = localStorage.getItem(votedKeyOf(slug));
      if (prev) {
        setSelected(prev);
        // 이미 투표한 사용자는 결과를 보여준다
        void fetch(`/api/stats?slug=${encodeURIComponent(slug)}`)
          .then((r) => r.json())
          .then((d) => {
            setStats(d?.stats ?? null);
            setPhase("result");
          })
          .catch(() => setPhase("result"));
      }
    } catch {
      /* localStorage 불가 환경 무시 */
    }
  }, [slug]);

  const vote = useCallback(
    async (optionKey: string) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, optionKey, fingerprint: getFingerprint() }),
        });
        const data = await res.json();
        if (res.status === 429) {
          setError("오늘 투표 한도를 넘었어요. 내일 다시 참여해 주세요.");
          setLoading(false);
          return;
        }
        if (!data.ok) {
          setError("잠시 후 다시 시도해 주세요.");
          setLoading(false);
          return;
        }
        setSelected(optionKey);
        setStats(data.stats ?? null);
        setPhase("result");
        try {
          localStorage.setItem(votedKeyOf(slug), optionKey);
        } catch {
          /* noop */
        }
        track("vote", { slug, meta: { option: optionKey, already: data.alreadyVoted } });
        track("result_view", { slug });
      } catch {
        setError("네트워크 오류예요. 다시 시도해 주세요.");
      }
      setLoading(false);
    },
    [slug, loading],
  );

  const resultOnly = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/stats?slug=${encodeURIComponent(slug)}`);
      const d = await r.json();
      setStats(d?.stats ?? null);
    } catch {
      setStats(null);
    }
    setPhase("result");
    setLoading(false);
    track("result_view", { slug, meta: { peek: true } });
  }, [slug]);

  if (phase === "result") {
    return (
      <div className="space-y-4">
        <StatsResult options={options} stats={stats} selectedKey={selected} />
        <ShareButton slug={slug} stats={stats} selectedKey={selected} />
        <NotifyOptin slug={slug} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={loading}
            onClick={() => vote(o.key)}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-4 text-left text-base font-medium text-ink transition hover:border-brand hover:bg-brand/5 active:scale-[0.99] disabled:opacity-60"
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="button"
        onClick={resultOnly}
        disabled={loading}
        className="text-sm text-ink/50 underline underline-offset-2 hover:text-ink/70"
      >
        결과만 보기
      </button>
    </div>
  );
}
