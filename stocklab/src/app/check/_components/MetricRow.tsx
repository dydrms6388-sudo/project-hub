/** 지표 한 줄 — 값 + (있으면) 전체 백분위 막대. 판단 문구 없이 위치만 표시한다. */
export function MetricRow({
  label,
  value,
  percentile,
  scaleNote,
  note,
}: {
  label: string;
  value: string;
  percentile?: number | null;
  /** 백분위 100 이 무엇을 뜻하는지 (예: "100에 가까울수록 PER 이 높은 쪽") */
  scaleNote?: string;
  note?: string;
}) {
  const p = typeof percentile === "number" && Number.isFinite(percentile) ? Math.min(100, Math.max(0, percentile)) : null;
  return (
    <div className="border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="tnum text-base font-semibold">{value}</span>
      </div>
      {p !== null && (
        <div className="mt-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label} 전체 백분위 ${p}`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${p}%` }} />
          </div>
          <p className="tnum mt-1 text-[11px] text-muted">
            전체 백분위 {p}
            {scaleNote ? ` · ${scaleNote}` : ""}
          </p>
        </div>
      )}
      {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
