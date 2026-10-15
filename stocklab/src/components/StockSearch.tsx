"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Stock } from "@/lib/types";

/**
 * 종목 검색 입력(클라이언트). /api/stocks/search 를 디바운스 호출해 드롭다운 표시.
 * onSelect 로 선택 종목을 부모에 전달. 개인정보 없음.
 */
export function StockSearch({ onSelect, placeholder = "종목명 또는 코드 검색 (예: 삼성전자, 005930)", autoFocus = false, label = "종목 검색" }:
  { onSelect: (s: Stock) => void; placeholder?: string; autoFocus?: boolean; label?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Stock[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const id = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 1) { setItems([]); return; }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ac = new AbortController(); abort.current = ac;
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q.trim())}`, { signal: ac.signal });
        const json = (await res.json()) as { items: Stock[] };
        setItems(json.items); setOpen(true); setActive(json.items.length ? 0 : -1);
      } catch { /* aborted */ } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function choose(s: Stock) { onSelect(s); setQ(""); setItems([]); setOpen(false); }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} className="field" value={q} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
        role="combobox" aria-expanded={open && items.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
        onChange={(e) => setQ(e.target.value)} onFocus={() => items.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0 && items[active]) { e.preventDefault(); choose(items[active]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {loading && <span className="absolute right-3 top-2.5 text-xs text-muted" aria-live="polite">검색 중…</span>}
      {open && items.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {items.map((s, i) => (
            <li key={s.code} role="option" aria-selected={i === active}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${i === active ? "bg-surface-2" : "hover:bg-surface-2"}`}
              onMouseDown={(e) => { e.preventDefault(); choose(s); }} onMouseEnter={() => setActive(i)}>
              <span><span className="font-semibold">{s.name}</span> <span className="ml-1 font-mono text-xs text-muted">{s.code}</span></span>
              <span className="text-xs text-muted">{s.market}{s.sector ? ` · ${s.sector}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && q.trim() && items.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted shadow-lg">일치하는 종목이 없습니다.</p>
      )}
    </div>
  );
}
