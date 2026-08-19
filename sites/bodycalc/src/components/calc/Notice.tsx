"use client";

import { MEDICAL_DISCLAIMER, type Warn } from "@/lib/health";

/** 모든 계산기 상단에 고정 노출되는 의료 조언 아님 고지 */
export function MedicalDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
    >
      <span className="font-bold">의료 조언이 아닙니다 · </span>
      {MEDICAL_DISCLAIMER}
    </p>
  );
}

/** 극단 입력 경고 — 수치 목표를 제시하지 않고 상담만 안내한다 */
export function Warnings({ items }: { items: Warn[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {items.map((w) => (
        <p
          key={w.text}
          className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${
            w.level === "warn"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : "border-slate-300 bg-slate-50 text-slate-700"
          }`}
        >
          <span className="mr-1 font-bold">{w.level === "warn" ? "확인 필요 ·" : "참고 ·"}</span>
          {w.text}
        </p>
      ))}
    </div>
  );
}

/** 이 사이트가 절대 하지 않는 것 — 계산기 안에서 한 번 더 못박는다 */
export function NoCoachingNote() {
  return (
    <p className="text-xs leading-relaxed text-slate-500">
      이 계산기는 목표 체중이나 하루 섭취 열량을 처방하지 않습니다. 감량·증량 계획은 건강 상태를
      확인할 수 있는 의료 전문가와 함께 세우세요.
    </p>
  );
}
