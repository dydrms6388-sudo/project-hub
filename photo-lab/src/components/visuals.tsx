"use client";

// 공유 시각화 프리미티브 — 전부 인라인 SVG, 외부 라이브러리 없음.

import { SUN_BANDS, SUNRISE_ALT } from "@/lib/engine/sun";

/** 거리 축 위 심도 막대 (로그 스케일) */
export function DofBar({
  nearM,
  farM,
  subjectM,
  hyperM,
}: {
  nearM: number;
  farM: number; // Infinity 가능
  subjectM: number;
  hyperM: number;
}) {
  const minD = 0.2;
  const maxD = Math.max(
    subjectM * 4,
    hyperM * 1.5,
    isFinite(farM) ? farM * 1.3 : hyperM * 2,
    5
  );
  const X = (d: number) =>
    40 + (620 * (Math.log(d) - Math.log(minD))) / (Math.log(maxD) - Math.log(minD));
  const farX = isFinite(farM) ? X(farM) : 660;
  const ticks = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].filter(
    (t) => t >= minD && t <= maxD
  );
  return (
    <svg viewBox="0 0 700 120" className="viz" role="img" aria-label="심도 범위 시각화">
      <line x1={40} y1={70} x2={660} y2={70} className="axis" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={66} x2={X(t)} y2={74} className="axis" />
          <text x={X(t)} y={92} textAnchor="middle" className="tick">
            {t}m
          </text>
        </g>
      ))}
      <rect
        x={X(nearM)}
        y={56}
        width={Math.max(2, farX - X(nearM))}
        height={28}
        rx={4}
        className="dof-zone"
      />
      <line x1={X(subjectM)} y1={40} x2={X(subjectM)} y2={96} className="mark-subject" />
      <text x={X(subjectM)} y={32} textAnchor="middle" className="lbl">
        피사체
      </text>
      {hyperM <= maxD ? (
        <>
          <line x1={X(hyperM)} y1={48} x2={X(hyperM)} y2={92} className="mark-hyper" />
          <text x={X(hyperM)} y={110} textAnchor="middle" className="lbl-dim">
            H
          </text>
        </>
      ) : null}
      {!isFinite(farM) ? (
        <text x={664} y={64} className="lbl-dim">
          ∞
        </text>
      ) : null}
    </svg>
  );
}

/** 수평 비교 막대 */
export function CompareBars({
  items,
  unit,
}: {
  items: Array<{ label: string; value: number; display: string; tone?: "a" | "b" | "warn" }>;
  unit?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1e-9);
  const H = items.length * 44 + 8;
  return (
    <svg viewBox={`0 0 700 ${H}`} className="viz" role="img" aria-label={`비교 막대${unit ? ` (${unit})` : ""}`}>
      {items.map((it, i) => {
        const y = 8 + i * 44;
        const w = Math.max(3, (it.value / max) * 460);
        return (
          <g key={it.label}>
            <text x={0} y={y + 19} className="lbl" dominantBaseline="middle">
              {it.label}
            </text>
            <rect x={150} y={y} width={w} height={28} rx={5} className={`bar-${it.tone ?? "a"}`} />
            <text x={158 + w} y={y + 19} className="lbl" dominantBaseline="middle">
              {it.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 하루 태양 고도 곡선 + 촬영 구간 밴드 */
export function SunCurve({
  pts,
}: {
  pts: Array<{ hour: number; alt: number }>;
}) {
  const X = (h: number) => 40 + (h / 24) * 620;
  const Y = (a: number) => 90 - (a / 90) * 70; // -90..90 → 160..20
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${X(p.hour).toFixed(1)},${Y(p.alt).toFixed(1)}`)
    .join(" ");
  const bands = [
    { from: 6, to: -4, cls: "band-golden" },
    { from: -4, to: -6, cls: "band-blue" },
    { from: -6, to: -12, cls: "band-nautical" },
    { from: -12, to: -18, cls: "band-astro" },
  ];
  return (
    <svg viewBox="0 0 700 180" className="viz" role="img" aria-label="하루 태양 고도 곡선">
      {bands.map((b) => (
        <rect
          key={b.cls}
          x={40}
          y={Y(b.from)}
          width={620}
          height={Y(b.to) - Y(b.from)}
          className={b.cls}
        />
      ))}
      <line x1={40} y1={Y(SUNRISE_ALT)} x2={660} y2={Y(SUNRISE_ALT)} className="horizon" />
      <text x={44} y={Y(SUNRISE_ALT) - 4} className="lbl-dim">
        지평선
      </text>
      <path d={path} className="sun-path" fill="none" />
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line x1={X(h)} y1={20} x2={X(h)} y2={162} className="grid" />
          <text x={X(h)} y={176} textAnchor="middle" className="tick">
            {h}시
          </text>
        </g>
      ))}
      {[60, 30, 0, -18].map((a) => (
        <text key={a} x={36} y={Y(a) + 4} textAnchor="end" className="tick">
          {a}°
        </text>
      ))}
    </svg>
  );
}

export function SunLegend() {
  return (
    <div className="sun-legend">
      {SUN_BANDS.filter((b) => b.key !== "civil").map((b) => (
        <span key={b.key} className={`legend legend-${b.key}`}>
          {b.label} {b.from}°~{b.to}°
        </span>
      ))}
    </div>
  );
}

/** 화각 부채꼴 */
export function AngleWedge({ deg, label }: { deg: number; label: string }) {
  const r = 140;
  const half = (Math.min(deg, 178) / 2) * (Math.PI / 180);
  const cx = 350;
  const cy = 170;
  const x1 = cx - r * Math.sin(half);
  const y1 = cy - r * Math.cos(half);
  const x2 = cx + r * Math.sin(half);
  const large = deg > 180 ? 1 : 0;
  return (
    <svg viewBox="0 0 700 200" className="viz" role="img" aria-label={`화각 ${label}`}>
      <path
        d={`M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y1.toFixed(1)} Z`}
        className="wedge"
      />
      <circle cx={cx} cy={cy} r={5} className="wedge-eye" />
      <text x={cx} y={40} textAnchor="middle" className="lbl">
        {label}
      </text>
    </svg>
  );
}

/** 파노라마 분할 원 */
export function PanoArc({
  shots,
  stepDeg,
  fovDeg,
  totalDeg,
}: {
  shots: number;
  stepDeg: number;
  fovDeg: number;
  totalDeg: number;
}) {
  const cx = 350;
  const cy = 105;
  const r = 82;
  const wedges = [];
  for (let i = 0; i < Math.min(shots, 60); i++) {
    const a0 = ((i * stepDeg - 90) * Math.PI) / 180;
    const a1 = (((i * stepDeg + fovDeg) - 90) * Math.PI) / 180;
    if (i * stepDeg > totalDeg) break;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = fovDeg > 180 ? 1 : 0;
    wedges.push(
      <path
        key={i}
        d={`M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`}
        className={i % 2 ? "pano-b" : "pano-a"}
      />
    );
  }
  return (
    <svg viewBox="0 0 700 210" className="viz" role="img" aria-label="파노라마 분할 시각화">
      {wedges}
      <circle cx={cx} cy={cy} r={4} className="wedge-eye" />
      <text x={cx} y={202} textAnchor="middle" className="lbl">
        {shots}컷 × 스텝 {stepDeg.toFixed(1)}° (컷 화각 {fovDeg.toFixed(1)}°, 겹침 표시)
      </text>
    </svg>
  );
}
