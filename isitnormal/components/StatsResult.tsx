import { MIN_SAMPLE_FOR_STATS } from "@/lib/promotion-gate";
import type { SurveyStats } from "@/lib/types";

interface Props {
  /** 시드 선택지 (라벨 fallback + 순서) */
  options: { key: string; label: string }[];
  stats: SurveyStats | null;
  selectedKey?: string | null;
}

/**
 * 통계 시각화. n<30(또는 stats 없음)이면 % 대신 "집계 중" (V3, 절대 규칙: 가짜 숫자 금지).
 * 표본수를 항상 병기한다.
 */
export default function StatsResult({ options, stats, selectedKey }: Props) {
  const showStats = Boolean(stats?.showStats);
  const n = stats?.n ?? 0;

  if (!showStats) {
    return (
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span>집계 중</span>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          표본 {n}명 · {MIN_SAMPLE_FOR_STATS}명이 넘으면 통계를 공개합니다.
          {selectedKey && " 참여 완료 — 결과가 모이면 이 자리에 비율이 뜹니다."}
        </p>
        <ul className="mt-4 space-y-2">
          {options.map((o) => (
            <li
              key={o.key}
              className={`rounded-lg border px-4 py-3 text-sm ${
                selectedKey === o.key
                  ? "border-brand bg-brand/5 font-semibold text-brand"
                  : "border-black/5 text-ink/70"
              }`}
            >
              {o.label}
              {selectedKey === o.key && <span className="ml-2 text-xs">내 선택</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const rows = stats!.options;
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <div className="mb-3 text-sm font-semibold text-ink/80">
        표본 {n.toLocaleString()}명 기준
      </div>
      <ul className="space-y-3">
        {rows.map((o) => {
          const mine = selectedKey === o.key;
          return (
            <li key={o.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className={mine ? "font-semibold text-brand" : "text-ink/80"}>
                  {o.label}
                  {mine && <span className="ml-2 text-xs">내 선택</span>}
                </span>
                <span className={mine ? "font-bold text-brand" : "font-semibold text-ink/70"}>
                  {o.pct}%
                </span>
              </div>
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-soft"
                role="img"
                aria-label={`${o.label} ${o.pct}퍼센트`}
              >
                <div
                  className={`h-full rounded-full ${mine ? "bg-brand" : "bg-brand/40"}`}
                  style={{ width: `${o.pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
