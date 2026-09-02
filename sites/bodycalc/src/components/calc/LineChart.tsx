"use client";

/**
 * 의존성 없는 SVG 선그래프.
 * recharts 같은 차트 라이브러리를 넣지 않고 직접 그린다 — 이 사이트에 필요한 것은
 * 선 1개 + 기준선 + 세로 마커뿐이라 번들을 늘릴 이유가 없다.
 * viewBox 로 그려서 320px 폭에서도 비율만 줄어들 뿐 깨지지 않는다.
 */

export type Point = { x: number; y: number };
export type Marker = { x: number; label: string; color?: string };
export type Threshold = { y: number; label: string; color?: string };

const W = 640;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 42, left: 52 };

export default function LineChart({
  points,
  xTicks,
  yUnit = "",
  markers = [],
  thresholds = [],
  ariaLabel,
  yMaxHint,
}: {
  points: Point[];
  /** x 축 눈금: 값 + 표시 문자열 */
  xTicks: { x: number; label: string }[];
  yUnit?: string;
  markers?: Marker[];
  thresholds?: Threshold[];
  ariaLabel: string;
  yMaxHint?: number;
}) {
  if (points.length < 2) return null;

  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yRaw = Math.max(
    ...points.map((p) => p.y),
    ...thresholds.map((t) => t.y),
    yMaxHint ?? 0,
    1,
  );
  // 눈금이 예쁘게 떨어지도록 위쪽 여유
  const yMax = niceMax(yRaw);

  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - (y / yMax) * (H - PAD.top - PAD.bottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${sx(x1).toFixed(1)},${sy(0).toFixed(1)} L${sx(x0).toFixed(1)},${sy(0).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));

  return (
    <div className="-mx-1 overflow-hidden px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y 눈금 */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={sy(t) + 5} textAnchor="end" fontSize={15} fill="#64748b">
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.left - 8} y={PAD.top - 4} textAnchor="end" fontSize={13} fill="#94a3b8">
          {yUnit}
        </text>

        {/* 기준선 */}
        {thresholds.map((t) => (
          <g key={`t${t.label}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={sy(t.y)}
              y2={sy(t.y)}
              stroke={t.color ?? "#f43f5e"}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text
              x={W - PAD.right}
              y={sy(t.y) - 6}
              textAnchor="end"
              fontSize={14}
              fill={t.color ?? "#f43f5e"}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* 면 + 선 */}
        <path d={area} fill="#0d9488" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="#0d9488" strokeWidth={2.5} strokeLinejoin="round" />

        {/* 세로 마커 */}
        {markers.map((m) => (
          <g key={`m${m.label}`}>
            <line
              x1={sx(m.x)}
              x2={sx(m.x)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={m.color ?? "#334155"}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <text
              x={sx(m.x)}
              y={PAD.top - 4}
              textAnchor="middle"
              fontSize={14}
              fill={m.color ?? "#334155"}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* 축 */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="#94a3b8"
          strokeWidth={1}
        />
        {xTicks.map((t) => (
          <text
            key={`x${t.label}`}
            x={sx(t.x)}
            y={H - PAD.bottom + 20}
            textAnchor="middle"
            fontSize={15}
            fill="#64748b"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= m * base) return m * base;
  }
  return 10 * base;
}
