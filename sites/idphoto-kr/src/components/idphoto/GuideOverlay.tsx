"use client";

import type { PhotoSpec } from "@/data/specs";

/**
 * 크롭 영역 위에 겹치는 얼굴 가이드.
 * 좌표는 전부 "사진 세로(mm) 대비 비율" 로 계산하므로 규격이 바뀌어도 그대로 맞는다.
 *  - 실선 타원  : 목표 머리 길이(정수리~턱)
 *  - 점선 2줄   : 턱 위치 허용 범위(머리 길이 최소/최대)
 *  - 가로 실선  : 눈높이 (공식 수치가 있으면 규정선, 없으면 참고선)
 */
export default function GuideOverlay({
  spec,
  width,
  height,
}: {
  spec: PhotoSpec;
  width: number;
  height: number;
}) {
  const H = spec.mm.h;
  const crown = spec.topMargin.target / H; // 정수리 y (0~1)
  const chin = (spec.topMargin.target + spec.head.target) / H; // 턱 y
  const chinMin = (spec.topMargin.target + spec.head.min) / H;
  const chinMax = (spec.topMargin.target + spec.head.max) / H;
  const eye = spec.eyeFromBottom
    ? 1 - spec.eyeFromBottom.target / H
    : crown + (chin - crown) * 0.45;

  const cy = ((crown + chin) / 2) * height;
  const ry = ((chin - crown) / 2) * height;
  // 성인 얼굴 가로:세로 ≈ 0.72 : 1 — 가이드 타원의 가로 반지름
  const rx = Math.min(ry * 0.72, width * 0.42);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      {/* 허용 범위 밴드 */}
      <rect
        x={0}
        y={chinMin * height}
        width={width}
        height={Math.max(0, (chinMax - chinMin) * height)}
        fill="rgba(37, 99, 235, 0.10)"
      />
      {/* 세로 중심선 */}
      <line
        x1={width / 2}
        y1={0}
        x2={width / 2}
        y2={height}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1}
        strokeDasharray="4 5"
      />
      {/* 정수리 선 */}
      <line
        x1={0}
        y1={crown * height}
        x2={width}
        y2={crown * height}
        stroke="rgba(37,99,235,0.85)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      {/* 턱 허용 최소/최대 */}
      <line
        x1={0}
        y1={chinMin * height}
        x2={width}
        y2={chinMin * height}
        stroke="rgba(37,99,235,0.45)"
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      <line
        x1={0}
        y1={chinMax * height}
        x2={width}
        y2={chinMax * height}
        stroke="rgba(37,99,235,0.45)"
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      {/* 목표 머리 타원 */}
      <ellipse
        cx={width / 2}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth={2}
      />
      <ellipse
        cx={width / 2}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="rgba(37,99,235,0.9)"
        strokeWidth={1}
        strokeDasharray="7 5"
      />
      {/* 눈높이 선 */}
      <line
        x1={width * 0.06}
        y1={eye * height}
        x2={width * 0.94}
        y2={eye * height}
        stroke="#f59e0b"
        strokeWidth={1.5}
      />
      <text
        x={width * 0.06}
        y={eye * height - 4}
        fontSize={10}
        fill="#f59e0b"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 2 }}
      >
        눈높이
      </text>
      <text
        x={width * 0.06}
        y={crown * height - 4}
        fontSize={10}
        fill="#93c5fd"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.45)", strokeWidth: 2 }}
      >
        정수리
      </text>
    </svg>
  );
}
