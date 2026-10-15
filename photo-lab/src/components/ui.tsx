"use client";

import { ReactNode } from "react";

/** 슬라이더 + 스테퍼 결합 입력. 현장에서 폰 조작을 전제로 터치 타깃 크게. */
export function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  log = false,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  log?: boolean;
  onChange: (v: number) => void;
}) {
  const toSlider = (v: number) => (log ? Math.log(v) : v);
  const fromSlider = (v: number) => (log ? Math.exp(v) : v);
  const sMin = toSlider(min);
  const sMax = toSlider(max);
  const sStep = log ? (sMax - sMin) / 200 : step;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const nudge = (dir: 1 | -1) => {
    if (log) {
      onChange(clamp(fromSlider(toSlider(value) + sStep * 4 * dir)));
    } else {
      onChange(clamp(+(value + step * dir).toFixed(6)));
    }
  };
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        <span className="field-value">{display}</span>
      </div>
      <div className="field-row">
        <button type="button" className="step-btn" aria-label={`${label} 감소`} onClick={() => nudge(-1)}>
          −
        </button>
        <input
          type="range"
          min={sMin}
          max={sMax}
          step={sStep}
          value={toSlider(value)}
          onChange={(e) => onChange(clamp(fromSlider(Number(e.target.value))))}
          aria-label={label}
        />
        <button type="button" className="step-btn" aria-label={`${label} 증가`} onClick={() => nudge(1)}>
          +
        </button>
      </div>
    </div>
  );
}

/** 배열 인덱스 기반 슬라이더 (f클릭·셔터클릭·ISO 등 이산 계열용) */
export function ClickField<T>({
  label,
  items,
  index,
  format,
  onChange,
}: {
  label: string;
  items: readonly T[];
  index: number;
  format: (v: T) => string;
  onChange: (index: number) => void;
}) {
  const i = Math.min(items.length - 1, Math.max(0, index));
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        <span className="field-value">{format(items[i])}</span>
      </div>
      <div className="field-row">
        <button type="button" className="step-btn" aria-label={`${label} 이전`} onClick={() => onChange(Math.max(0, i - 1))}>
          −
        </button>
        <input
          type="range"
          min={0}
          max={items.length - 1}
          step={1}
          value={i}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <button type="button" className="step-btn" aria-label={`${label} 다음`} onClick={() => onChange(Math.min(items.length - 1, i + 1))}>
          +
        </button>
      </div>
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SegmentField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
      </div>
      <div className="segment" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? "seg-on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">
          {label}
          {unit ? ` (${unit})` : ""}
        </span>
      </div>
      <div className="field-row">
        <button type="button" className="step-btn" onClick={() => onChange(Math.max(min, +(value - step).toFixed(6)))} aria-label={`${label} 감소`}>
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          aria-label={label}
        />
        <button type="button" className="step-btn" onClick={() => onChange(Math.min(max, +(value + step).toFixed(6)))} aria-label={`${label} 증가`}>
          +
        </button>
      </div>
    </div>
  );
}

export function ResultGrid({ children }: { children: ReactNode }) {
  return <div className="result-grid">{children}</div>;
}

export function ResultItem({
  label,
  value,
  sub,
  emph = false,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  emph?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`result-item${emph ? " result-emph" : ""}${warn ? " result-warn" : ""}`}>
      <div className="result-label">{label}</div>
      <div className="result-value">{value}</div>
      {sub ? <div className="result-sub">{sub}</div> : null}
    </div>
  );
}
