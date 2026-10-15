"use client";

import { useCallback, useEffect, useState } from "react";

/* ───────────────── 숫자 파싱/입력 ───────────────── */

export function parseMoney(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 금액 입력 — 천 단위 콤마 표시. allowNegative 이면 손실(음수) 입력 가능. */
export function MoneyField({ id, label, value, onChange, min, max, hint, placeholder, srLabel }: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;
  placeholder?: string;
  /** 라벨을 화면에 숨기고 스크린리더에만 노출 (표 안 입력용) */
  srLabel?: boolean;
}) {
  const [text, setText] = useState(() => value.toLocaleString("ko-KR"));
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value.toLocaleString("ko-KR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label htmlFor={id} className={srLabel ? "sr-only" : "mb-1 block text-sm font-medium"}>{label}</label>
      <div className="relative">
        <input
          id={id}
          className="field tnum pr-8"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            onChange(Math.round(Math.min(max, Math.max(min, parseMoney(raw)))));
          }}
          onBlur={() => setText(value.toLocaleString("ko-KR"))}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">원</span>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted tnum">{hint}</p>}
    </div>
  );
}

export function NumberField({ id, label, value, onChange, min, max, step, unit, hint, srLabel }: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  srLabel?: boolean;
}) {
  const [text, setText] = useState(() => String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label htmlFor={id} className={srLabel ? "sr-only" : "mb-1 block text-sm font-medium"}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type="number"
          className="field tnum pr-10"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n) && e.target.value !== "") onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setText(String(value))}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{unit}</span>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted tnum">{hint}</p>}
    </div>
  );
}

export function TextField({ id, label, value, onChange, maxLength, placeholder, srLabel }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  srLabel?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={srLabel ? "sr-only" : "mb-1 block text-sm font-medium"}>{label}</label>
      <input id={id} className="field" autoComplete="off" value={value} maxLength={maxLength} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))} />
    </div>
  );
}

export function Chips<T extends number | string>({ items, current, onPick, label, format }: {
  items: readonly T[];
  current: T | null;
  onPick: (v: T) => void;
  label: string;
  format: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {items.map((v) => {
        const active = v === current;
        return (
          <button key={String(v)} type="button" onClick={() => onPick(v)} aria-pressed={active}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium tnum transition-colors ${active ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}>
            {format(v)}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ label, name, options, value, onChange, cols = 2 }: {
  label: string;
  name: string;
  options: readonly { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">{label}</legend>
      <div className={`grid gap-1 rounded-lg border border-border bg-surface-2 p-1 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label key={o.value} className={`cursor-pointer rounded-md px-2 py-1.5 text-center text-sm transition-colors ${active ? "bg-surface font-semibold text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
              <input type="radio" name={name} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
              {o.desc && <span className="block text-[11px] font-normal text-muted">{o.desc}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toggle({ id, label, desc, checked, onChange }: {
  id: string; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="font-medium">{label}</span>
      </label>
      {desc && <p className="mt-1 pl-6 text-xs leading-5 text-muted">{desc}</p>}
    </div>
  );
}

/* ───────────────── 훅 ───────────────── */

/** 계산 조건을 주소창에 디바운스 동기화 — URL 자체가 공유 링크가 된다. */
export function useUrlSync(query: string): void {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);
}

export function useToast(): [string | null, (m: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);
  const push = useCallback((m: string) => setToast(m), []);
  return [toast, push];
}

/* ───────────────── 공유 ───────────────── */

export function ShareBar({ path, query, communityText, shareTitle, shareText, note }: {
  path: string;
  query: string;
  /** 커뮤니티 붙여넣기용 여러 줄 텍스트 (링크 포함은 내부에서 처리) */
  communityText: (url: string) => string;
  shareTitle: string;
  shareText: string;
  note?: string;
}) {
  const [toast, push] = useToast();
  const url = useCallback(() => `${window.location.origin}${path}${query ? `?${query}` : ""}`, [path, query]);

  const copy = useCallback(async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      push(ok);
    } catch {
      push("복사에 실패했습니다. 주소창에서 직접 복사해 주세요.");
    }
  }, [push]);

  const doShare = useCallback(async () => {
    const u = url();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: u });
      } catch {
        /* 사용자가 취소한 경우 — 아무것도 하지 않는다 */
      }
      return;
    }
    await copy(u, "공유를 지원하지 않는 브라우저여서 링크를 복사했습니다.");
  }, [url, shareTitle, shareText, copy]);

  return (
    <div className="card">
      <h2 className="text-sm font-semibold">계산 조건 공유</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {note ?? "입력한 조건이 주소창 URL 에 담겨 있어 링크만 보내면 같은 계산 결과가 열립니다. 서버에 저장되는 값은 없습니다."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => void copy(url(), "링크를 복사했습니다.")}>링크 복사</button>
        <button type="button" className="btn-ghost" onClick={() => void copy(communityText(url()), "커뮤니티용 텍스트를 복사했습니다.")}>커뮤니티용 텍스트 복사</button>
        <button type="button" className="btn-ghost" onClick={() => void doShare()}>공유</button>
      </div>
      {toast && <p role="status" className="mt-3 text-xs font-medium text-brand">{toast}</p>}
    </div>
  );
}

/** 공유 링크로 들어온 사용자에게 보여 주는 "나도 해보기" 배너 */
export function SharedBanner({ onReset, children }: { onReset: () => void; children: React.ReactNode }) {
  return (
    <div role="status" className="card flex flex-col gap-3 border-brand/40 bg-brand/5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6">{children}</p>
      <button type="button" onClick={onReset} className="btn-primary shrink-0">나도 해보기</button>
    </div>
  );
}

/* ───────────────── 표시용 카드 ───────────────── */

export function StatCard({ label, value, sub, tone = "default", wide = false }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "brand" | "warn" | "muted";
  wide?: boolean;
}) {
  const valueTone = tone === "brand" ? "text-brand" : tone === "warn" ? "text-warn" : tone === "muted" ? "text-muted" : "";
  return (
    <div className={`card ${wide ? "col-span-2 !border-brand/40" : ""}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-extrabold tracking-tight tnum ${wide ? "text-3xl sm:text-4xl" : "text-lg font-bold sm:text-xl"} ${valueTone}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-5 text-muted tnum">{sub}</p>}
    </div>
  );
}
