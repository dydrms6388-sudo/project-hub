import type { ReactElement } from "react";

/**
 * 슬러그별 대표 도형(단순화 버전) — 허브/카테고리 썸네일과 OG 이미지에서 공용.
 * satori(ImageResponse) 호환을 위해 기본 SVG 요소만 사용한다 (defs/filter 금지).
 * viewBox는 모두 0 0 200 140.
 */

const INK = "#1f2430";
const ACCENT = "#dc2626";
const GRAYBG = "#e5e7eb";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** 회색 밝기값 → #rrggbb (satori의 SVG 파서는 rgb() 함수 표기와 충돌한다) */
const hx = (v: number) => {
  const h = Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, "0");
  return `#${h}${h}${h}`;
};

type Fig = () => ReactElement;

const figMullerLyer: Fig = () => (
  <g>
    <path d="M50 45 L150 45 M40 30 L50 45 L40 60 M160 30 L150 45 L160 60" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M50 95 L150 95 M60 80 L50 95 L60 110 M140 80 L150 95 L140 110" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
  </g>
);

const figPonzo: Fig = () => (
  <g>
    <path d="M55 135 L90 5 M145 135 L110 5" stroke="#6b7280" strokeWidth={3} fill="none" />
    <path d="M78 45 L122 45" stroke={ACCENT} strokeWidth={6} strokeLinecap="round" />
    <path d="M78 95 L122 95" stroke={ACCENT} strokeWidth={6} strokeLinecap="round" />
  </g>
);

const figEbbinghaus: Fig = () => (
  <g>
    {range(6).map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return <circle key={i} cx={55 + Math.cos(a) * 38} cy={70 + Math.sin(a) * 38} r={16} fill="#64748b" />;
    })}
    <circle cx={55} cy={70} r={12} fill="#ea580c" />
    {range(6).map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return <circle key={i} cx={150 + Math.cos(a) * 22} cy={70 + Math.sin(a) * 22} r={5} fill="#64748b" />;
    })}
    <circle cx={150} cy={70} r={12} fill="#ea580c" />
  </g>
);

const figDelboeuf: Fig = () => (
  <g>
    <circle cx={60} cy={70} r={25} fill="#0f766e" />
    <circle cx={60} cy={70} r={36} fill="none" stroke={INK} strokeWidth={2.5} />
    <circle cx={148} cy={70} r={25} fill="#0f766e" />
  </g>
);

const figVerticalHorizontal: Fig = () => (
  <path d="M50 105 L150 105 M100 105 L100 25" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
);

const figOppelKundt: Fig = () => (
  <g>
    {[30, 100, 170].map((x) => (
      <path key={x} d={`M${x} 45 L${x} 95`} stroke={INK} strokeWidth={3.5} />
    ))}
    {range(6).map((i) => (
      <path key={i} d={`M${110 + i * 10} 45 L${110 + i * 10} 95`} stroke={INK} strokeWidth={3.5} />
    ))}
  </g>
);

const figSander: Fig = () => (
  <g>
    <path d="M25 110 L145 110 L175 30 L55 30 Z" stroke={INK} strokeWidth={3} fill="none" />
    <path d="M115 110 L115 30" stroke={INK} strokeWidth={3} />
    <path d="M55 30 L115 110 L175 30" stroke={ACCENT} strokeWidth={3.5} fill="none" />
  </g>
);

const figJastrow: Fig = () => (
  <g>
    <path d="M60 45 A65 65 0 0 1 150 45 L138 68 A45 45 0 0 0 72 68 Z" fill="#f59e0b" stroke={INK} strokeWidth={2} />
    <path d="M50 85 A65 65 0 0 1 140 85 L128 108 A45 45 0 0 0 62 108 Z" fill="#3b82f6" stroke={INK} strokeWidth={2} />
  </g>
);

const figHelmholtz: Fig = () => (
  <g>
    {range(6).map((i) => (
      <rect key={i} x={25} y={30 + i * 14} width={70} height={7} fill={INK} />
    ))}
    {range(6).map((i) => (
      <rect key={i} x={110 + i * 14} y={30} width={7} height={80} fill={INK} />
    ))}
  </g>
);

const figZollner: Fig = () => (
  <g>
    {range(4).map((r) => {
      const y = 25 + r * 30;
      const dir = r % 2 === 0 ? 1 : -1;
      return (
        <g key={r}>
          <path d={`M20 ${y} L180 ${y}`} stroke={INK} strokeWidth={3} />
          {range(8).map((i) => {
            const x = 28 + i * 20;
            return (
              <path
                key={i}
                d={`M${x - 6} ${y - dir * 7} L${x + 6} ${y + dir * 7}`}
                stroke={INK}
                strokeWidth={2}
              />
            );
          })}
        </g>
      );
    })}
  </g>
);

const figHeringWundt: Fig = () => (
  <g>
    {range(16).map((i) => {
      const a = (i / 16) * Math.PI * 2;
      return (
        <path
          key={i}
          d={`M100 70 L${100 + Math.cos(a) * 130} ${70 + Math.sin(a) * 130}`}
          stroke="#9ca3af"
          strokeWidth={1.5}
        />
      );
    })}
    <path d="M75 10 L75 130 M125 10 L125 130" stroke={ACCENT} strokeWidth={4} />
  </g>
);

const figPoggendorff: Fig = () => (
  <g>
    <path d="M30 110 L80 60" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    <rect x={80} y={10} width={40} height={120} fill="#94a3b8" />
    <path d="M120 30 L170 -20 M120 45 L170 -5" stroke="none" />
    <path d="M120 35 L168 -13" stroke="none" />
    <path d="M120 38 L165 -7" stroke="none" />
    <path d="M120 40 L170 -10" stroke="none" />
    <path d="M120 48 L172 -4" stroke="none" />
    <path d="M120 50 L170 0" stroke={INK} strokeWidth={4} strokeLinecap="round" />
  </g>
);

const figOrbison: Fig = () => (
  <g>
    {range(14).map((i) => {
      const a = (i / 14) * Math.PI * 2;
      return (
        <path
          key={i}
          d={`M100 70 L${100 + Math.cos(a) * 130} ${70 + Math.sin(a) * 130}`}
          stroke="#9ca3af"
          strokeWidth={1.5}
        />
      );
    })}
    <rect x={65} y={40} width={70} height={70} fill="none" stroke={ACCENT} strokeWidth={3.5} />
  </g>
);

const figCafeWall: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#9ca3af" />
    {range(5).map((r) => {
      const off = r % 2 === 0 ? 0 : 14;
      return (
        <g key={r}>
          {range(8).map((c) => (
            <rect
              key={c}
              x={-14 + c * 28 + off}
              y={4 + r * 27}
              width={28}
              height={24}
              fill={c % 2 === 0 ? "#111827" : "#f8fafc"}
            />
          ))}
        </g>
      );
    })}
  </g>
);

const figFraserSpiral: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill={GRAYBG} />
    {[20, 36, 52].map((r) =>
      range(20).map((s) => {
        const a = (s / 20) * Math.PI * 2;
        const x = 100 + Math.cos(a) * r;
        const y = 70 + Math.sin(a) * r;
        const t = a + Math.PI / 2 + 0.5;
        const l = 8;
        return (
          <path
            key={`${r}-${s}`}
            d={`M${x - Math.cos(t) * l} ${y - Math.sin(t) * l} L${x + Math.cos(t) * l} ${y + Math.sin(t) * l}`}
            stroke={s % 2 === 0 ? "#0b0f19" : "#ffffff"}
            strokeWidth={4}
          />
        );
      })
    )}
  </g>
);

const figHermannGrid: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#ffffff" />
    {range(4).map((r) =>
      range(5).map((c) => (
        <rect key={`${r}-${c}`} x={8 + c * 39} y={8 + r * 33} width={31} height={25} fill="#111827" />
      ))
    )}
  </g>
);

const figSimultaneousContrast: Fig = () => (
  <g>
    <rect x={0} y={0} width={100} height={140} fill="#374151" />
    <rect x={100} y={0} width={100} height={140} fill="#d1d5db" />
    <rect x={30} y={50} width={40} height={40} fill="#808080" />
    <rect x={130} y={50} width={40} height={40} fill="#808080" />
  </g>
);

const figMachBands: Fig = () => (
  <g>
    <rect x={0} y={0} width={70} height={140} fill="#4b5563" />
    {range(12).map((i) => (
      <rect
        key={i}
        x={70 + i * 5}
        y={0}
        width={5.5}
        height={140}
        fill={hx(75 + i * 10)}
      />
    ))}
    <rect x={130} y={0} width={70} height={140} fill="#c7ccd4" />
  </g>
);

const figWhites: Fig = () => (
  <g>
    {range(7).map((i) => (
      <rect key={i} x={0} y={i * 20} width={200} height={10} fill="#0b0f19" />
    ))}
    {[1, 2, 3].map((i) => (
      <rect key={i} x={35} y={i * 20 + 20} width={45} height={10} fill="#808080" />
    ))}
    {[1, 2, 3].map((i) => (
      <rect key={i} x={120} y={i * 20 + 10} width={45} height={10} fill="#808080" />
    ))}
  </g>
);

const figCornsweet: Fig = () => (
  <g>
    <rect x={0} y={0} width={80} height={140} fill="#9aa1ab" />
    {range(10).map((i) => (
      <rect key={i} x={80 + i * 2} y={0} width={2.5} height={140} fill={hx(172 - i * 4)} />
    ))}
    {range(10).map((i) => (
      <rect key={i} x={100 + i * 2} y={0} width={2.5} height={140} fill={hx(118 + i * 4)} />
    ))}
    <rect x={120} y={0} width={80} height={140} fill="#9aa1ab" />
  </g>
);

const figCheckerShadow: Fig = () => (
  <g>
    {range(4).map((r) =>
      range(5).map((c) => {
        const dark = (r + c) % 2 === 0;
        const shadow = r >= 2 && c >= 1 && c <= 3;
        const v = dark ? (shadow ? 40 : 85) : shadow ? 88 : 190;
        return (
          <rect key={`${r}-${c}`} x={10 + c * 36} y={10 + r * 30} width={36} height={30} fill={hx(v)} />
        );
      })
    )}
  </g>
);

const figEhrenstein: Fig = () => (
  <g>
    {[
      [60, 45],
      [140, 45],
      [60, 100],
      [140, 100],
    ].map(([cx, cy], k) => (
      <g key={k}>
        {range(8).map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <path
              key={i}
              d={`M${cx + Math.cos(a) * 12} ${cy + Math.sin(a) * 12} L${cx + Math.cos(a) * 30} ${cy + Math.sin(a) * 30}`}
              stroke="#111827"
              strokeWidth={2.5}
            />
          );
        })}
      </g>
    ))}
  </g>
);

const figKanizsa: Fig = () => (
  <g>
    {[
      [100, 25, 90],
      [55, 105, -30],
      [145, 105, 210],
    ].map(([cx, cy, rot], i) => {
      const start = ((rot + 30) * Math.PI) / 180;
      const end = ((rot - 30) * Math.PI) / 180 + Math.PI * 2;
      const x1 = cx + Math.cos(start) * 24;
      const y1 = cy + Math.sin(start) * 24;
      const x2 = cx + Math.cos(end) * 24;
      const y2 = cy + Math.sin(end) * 24;
      return (
        <path
          key={i}
          d={`M${cx} ${cy} L${x1} ${y1} A24 24 0 1 1 ${x2} ${y2} Z`}
          fill="#111827"
        />
      );
    })}
  </g>
);

const figNeon: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#ffffff" />
    {range(7).map((i) =>
      range(5).map((j) => {
        const x = 15 + i * 28;
        const y = 15 + j * 28;
        const inside = Math.hypot(x - 100, y - 70) < 45;
        const col = inside ? "#3b82f6" : "#111827";
        return (
          <g key={`${i}-${j}`}>
            <path d={`M${x - 10} ${y} L${x + 10} ${y}`} stroke={col} strokeWidth={2.5} />
            <path d={`M${x} ${y - 10} L${x} ${y + 10}`} stroke={col} strokeWidth={2.5} />
          </g>
        );
      })
    )}
  </g>
);

const figWatercolor: Fig = () => (
  <g>
    <path
      d="M30 70 Q35 35 70 30 Q100 18 130 32 Q168 38 170 70 Q166 105 130 112 Q100 124 68 110 Q34 104 30 70 Z"
      fill="none"
      stroke="#4c1d95"
      strokeWidth={5}
    />
    <path
      d="M38 70 Q42 42 72 37 Q100 27 128 39 Q160 45 162 70 Q158 99 128 105 Q100 115 70 103 Q42 98 38 70 Z"
      fill="none"
      stroke="#fb923c"
      strokeWidth={4}
    />
  </g>
);

const figAfterimage: Fig = () => (
  <g>
    <circle cx={65} cy={70} r={40} fill="#16a34a" />
    <circle cx={148} cy={70} r={40} fill="#f0abfc" />
    <path d="M60 70 L70 70 M65 65 L65 75 M143 70 L153 70 M148 65 L148 75" stroke="#111827" strokeWidth={2} />
  </g>
);

const figBezold: Fig = () => (
  <g>
    <rect x={15} y={20} width={80} height={100} fill="#dc2626" />
    {range(6).map((i) => (
      <rect key={i} x={15} y={26 + i * 16} width={80} height={7} fill="#ffffff" />
    ))}
    <rect x={105} y={20} width={80} height={100} fill="#dc2626" />
    {range(6).map((i) => (
      <rect key={i} x={105} y={26 + i * 16} width={80} height={7} fill="#111827" />
    ))}
  </g>
);

const figTroxler: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#d7dae0" />
    {[
      [50, 40, "#d59aa3"],
      [150, 40, "#8ab8d0"],
      [50, 100, "#93cfa6"],
      [150, 100, "#ab9ad9"],
    ].map(([x, y, col], i) => (
      <g key={i}>
        <circle cx={x as number} cy={y as number} r={26} fill={col as string} opacity={0.35} />
        <circle cx={x as number} cy={y as number} r={17} fill={col as string} opacity={0.45} />
      </g>
    ))}
    <circle cx={100} cy={70} r={4} fill="#111827" />
  </g>
);

const figBlindSpot: Fig = () => (
  <g>
    <path d="M40 60 L60 60 M50 50 L50 70" stroke="#111827" strokeWidth={4} />
    <circle cx={155} cy={60} r={12} fill="#111827" />
    <path d="M50 100 L155 100" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4" />
  </g>
);

const figMAE: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    {range(5).map((i) => (
      <rect key={i} x={0} y={6 + i * 28} width={200} height={14} fill="#e5e7eb" />
    ))}
    <circle cx={100} cy={70} r={6} fill="#ef4444" />
  </g>
);

const figPhiBeta: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    <circle cx={60} cy={70} r={16} fill="#fbbf24" />
    <circle cx={140} cy={70} r={16} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 4" />
    <path d="M85 70 L115 70 M108 63 L115 70 L108 77" stroke="#e5e7eb" strokeWidth={2.5} fill="none" />
  </g>
);

const figTernus: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    {[45, 85, 125].map((x) => (
      <circle key={x} cx={x} cy={50} r={13} fill="#e5e7eb" />
    ))}
    {[85, 125, 165].map((x) => (
      <circle key={x} cx={x} cy={95} r={13} fill="none" stroke="#e5e7eb" strokeWidth={2} strokeDasharray="4 4" />
    ))}
  </g>
);

const figInducedMotion: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    <rect x={40} y={30} width={120} height={80} fill="none" stroke="#93c5fd" strokeWidth={4} />
    <circle cx={100} cy={70} r={9} fill="#fbbf24" />
    <path d="M55 20 L85 20 M62 14 L55 20 L62 26" stroke="#93c5fd" strokeWidth={2.5} fill="none" />
  </g>
);

const figBarberpole: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#f3f4f6" />
    {range(9).map((i) => (
      <path
        key={i}
        d={`M${40 + i * 18 - 40} 130 L${40 + i * 18 + 20} 10`}
        stroke="#dc2626"
        strokeWidth={9}
      />
    ))}
    <rect x={75} y={10} width={50} height={120} fill="none" stroke="#111827" strokeWidth={5} />
    <rect x={0} y={0} width={75} height={140} fill="#f3f4f6" />
    <rect x={125} y={0} width={75} height={140} fill="#f3f4f6" />
    <rect x={0} y={0} width={200} height={10} fill="#f3f4f6" />
    <rect x={0} y={130} width={200} height={10} fill="#f3f4f6" />
    <rect x={75} y={10} width={50} height={120} fill="none" stroke="#111827" strokeWidth={5} />
  </g>
);

const figKineticDepth: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    {range(40).map((i) => {
      const a = (i * 137.5 * Math.PI) / 180;
      const r = Math.sqrt((i + 1) / 40);
      const x = 100 + Math.cos(a) * r * 55;
      const y = 70 + Math.sin(a) * r * 48;
      return <circle key={i} cx={x} cy={y} r={2.5} fill="#e5e7eb" />;
    })}
    <circle cx={100} cy={70} r={56} fill="none" stroke="#374151" strokeWidth={1.5} />
  </g>
);

const figStereokinetic: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#0b0f19" />
    {range(5).map((i) => (
      <circle
        key={i}
        cx={100 + i * 5}
        cy={70}
        r={54 - i * 11}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={4}
      />
    ))}
  </g>
);

const figNecker: Fig = () => (
  <g>
    <rect x={55} y={45} width={70} height={70} fill="none" stroke={INK} strokeWidth={3.5} />
    <rect x={80} y={22} width={70} height={70} fill="none" stroke={INK} strokeWidth={3.5} />
    <path d="M55 45 L80 22 M125 45 L150 22 M55 115 L80 92 M125 115 L150 92" stroke={INK} strokeWidth={3.5} />
  </g>
);

const figSchroeder: Fig = () => (
  <g>
    <path
      d="M30 115 L60 115 L60 95 L90 95 L90 75 L120 75 L120 55 L150 55 L150 35 L170 35"
      stroke={INK}
      strokeWidth={3.5}
      fill="none"
    />
    <path d="M30 115 L50 35 L170 35 M30 115 L150 115" stroke={INK} strokeWidth={3} fill="none" />
  </g>
);

const figRubin: Fig = () => (
  <g>
    <rect x={0} y={0} width={200} height={140} fill="#111827" />
    <path
      d="M100 8 C70 18 88 34 74 46 C62 58 84 66 74 80 C64 96 88 100 84 116 C82 126 90 132 100 132 C110 132 118 126 116 116 C112 100 136 96 126 80 C116 66 138 58 126 46 C112 34 130 18 100 8 Z"
      fill="#f8fafc"
    />
  </g>
);

const figPenrose: Fig = () => (
  <g>
    <path d="M100 15 L145 95 L128 95 L100 45 Z" fill="#94a3b8" stroke={INK} strokeWidth={1.5} />
    <path d="M145 95 L55 95 L64 80 L128 80 Z" fill="#64748b" stroke={INK} strokeWidth={1.5} />
    <path d="M55 95 L100 15 L109 30 L72 95 Z" fill="#cbd5e1" stroke={INK} strokeWidth={1.5} />
  </g>
);

export const figures: Record<string, Fig> = {
  "muller-lyer": figMullerLyer,
  ponzo: figPonzo,
  ebbinghaus: figEbbinghaus,
  delboeuf: figDelboeuf,
  "vertical-horizontal": figVerticalHorizontal,
  "oppel-kundt": figOppelKundt,
  sander: figSander,
  jastrow: figJastrow,
  "helmholtz-squares": figHelmholtz,
  zollner: figZollner,
  "hering-wundt": figHeringWundt,
  poggendorff: figPoggendorff,
  orbison: figOrbison,
  "cafe-wall": figCafeWall,
  "fraser-spiral": figFraserSpiral,
  "hermann-grid": figHermannGrid,
  "simultaneous-contrast": figSimultaneousContrast,
  "mach-bands": figMachBands,
  "whites-illusion": figWhites,
  cornsweet: figCornsweet,
  "checker-shadow": figCheckerShadow,
  ehrenstein: figEhrenstein,
  "kanizsa-triangle": figKanizsa,
  "neon-color-spreading": figNeon,
  "watercolor-illusion": figWatercolor,
  "color-afterimage": figAfterimage,
  bezold: figBezold,
  troxler: figTroxler,
  "blind-spot": figBlindSpot,
  "motion-aftereffect": figMAE,
  "phi-beta": figPhiBeta,
  ternus: figTernus,
  "induced-motion": figInducedMotion,
  barberpole: figBarberpole,
  "kinetic-depth": figKineticDepth,
  stereokinetic: figStereokinetic,
  "necker-cube": figNecker,
  "schroeder-stairs": figSchroeder,
  "rubin-vase": figRubin,
  "penrose-triangle": figPenrose,
};

export function FigureSvg({
  slug,
  width,
  className,
}: {
  slug: string;
  width?: number;
  className?: string;
}) {
  const Fig = figures[slug];
  if (!Fig) return null;
  return (
    <svg
      viewBox="0 0 200 140"
      width={width}
      className={className}
      role="img"
      aria-hidden="true"
      style={{ display: "block", background: "#ffffff" }}
    >
      <Fig />
    </svg>
  );
}
