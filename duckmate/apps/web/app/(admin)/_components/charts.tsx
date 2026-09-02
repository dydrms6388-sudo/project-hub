/** 외부 라이브러리 없는 서버 SVG 차트 (D8 지표). 색은 시맨틱 토큰 클래스만 사용. */
import { cn } from "@duckmate/ui";

export type BarDatum = { label: string; value: number; hint?: string };

export function BarChart({ data, height = 160, className, valueFormat }: { data: BarDatum[]; height?: number; className?: string; valueFormat?: (v: number) => string }) {
  const w = Math.max(240, data.length * 28);
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = w / Math.max(1, data.length);
  const fmt = valueFormat ?? ((v: number) => String(v));
  return (
    <svg viewBox={`0 0 ${w} ${height + 24}`} className={cn("h-auto w-full", className)} role="img" aria-label={`막대 차트: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(", ")}`}>
      {data.map((d, i) => {
        const h = Math.round((d.value / max) * (height - 16));
        return (
          <g key={`${d.label}-${i}`}>
            <title>{`${d.label}: ${fmt(d.value)}${d.hint ? ` (${d.hint})` : ""}`}</title>
            <rect x={i * bw + bw * 0.2} y={height - h} width={bw * 0.6} height={h} rx={3} className="fill-primary" />
            {data.length <= 16 || i % Math.ceil(data.length / 8) === 0 ? (
              <text x={i * bw + bw / 2} y={height + 16} textAnchor="middle" className="fill-[var(--muted-foreground)] text-[10px]">
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export type LineSeries = { name: string; points: number[]; tone?: "primary" | "accent" | "success" | "muted" };

const STROKE: Record<NonNullable<LineSeries["tone"]>, string> = {
  primary: "stroke-primary",
  accent: "stroke-accent",
  success: "stroke-success",
  muted: "stroke-[var(--muted-foreground)]",
};

export function LineChart({ labels, series, height = 160, className }: { labels: string[]; series: LineSeries[]; height?: number; className?: string }) {
  const w = 480;
  const n = Math.max(1, labels.length);
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * (w - 16) + 8);
  const y = (v: number) => height - 8 - (v / max) * (height - 24);
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${height + 20}`} className="h-auto w-full" role="img" aria-label={`선 차트: ${series.map((s) => s.name).join(", ")}`}>
        <line x1={8} x2={w - 8} y1={height - 8} y2={height - 8} className="stroke-border" />
        {series.map((s) => (
          <g key={s.name}>
            <title>{`${s.name}: ${s.points.join(", ")}`}</title>
            <polyline fill="none" strokeWidth={2} className={STROKE[s.tone ?? "primary"]} points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
          </g>
        ))}
        {labels.map((l, i) =>
          n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
            <text key={l} x={x(i)} y={height + 12} textAnchor="middle" className="fill-[var(--muted-foreground)] text-[10px]">
              {l}
            </text>
          ) : null,
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-3 text-caption text-muted-foreground">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1">
            <span className={cn("inline-block h-0.5 w-4", s.tone === "accent" ? "bg-accent" : s.tone === "success" ? "bg-success" : s.tone === "muted" ? "bg-[var(--muted-foreground)]" : "bg-primary")} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** KPI 게이지 (0~1) + 목표선 */
export function Gauge({ value, target, label, format }: { value: number | null; target: number; label: string; format?: (v: number) => string }) {
  const fmt = format ?? ((v: number) => `${(v * 100).toFixed(1)}%`);
  const v = value ?? 0;
  const pctW = Math.min(100, Math.max(0, v * 100));
  const ok = value !== null && value >= target;
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctW)} aria-label={label} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-label">{label}</span>
        <span className={cn("tnum text-h3", value === null ? "text-muted-foreground" : ok ? "text-success" : "text-coral-700 dark:text-coral-300")}>{value === null ? "—" : fmt(value)}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", ok ? "bg-success" : "bg-accent")} style={{ width: `${pctW}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-foreground/60" style={{ left: `${Math.min(100, target * 100)}%` }} aria-hidden="true" />
      </div>
      <span className="text-caption text-muted-foreground">목표 {fmt(target)}</span>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" | "success" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className={cn("tnum text-h2", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground")}>{value}</div>
      {hint ? <div className="text-caption text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
