"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_INPUT,
  KR_INTEREST_TAX_PCT,
  LIMITS,
  encodeParams,
  exactDoublingYears,
  fmtManWon,
  fmtWonFull,
  normalizeInput,
  requiredMonthly,
  ruleOf72,
  simulate,
  type CompoundInput,
  type CompoundResult,
} from "@/lib/compound";
import { Disclaimer } from "@/components/Disclaimer";
import { AdSlot } from "@/components/AdSlot";

const SHARE_PATH = "/calc/compound";
const WATERMARK = "tomatoeggcat.com/stocklab/calc/compound";

interface Props {
  initial: CompoundInput;
  /** URL 에 공유 파라미터가 있었는지 (공유 유입) */
  shared: boolean;
}

/* ───────────────── 작은 입력 컴포넌트 ───────────────── */

function parseMoney(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function MoneyField({ id, label, value, onChange, min, max, hint }: {
  id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; hint?: string;
}) {
  const [text, setText] = useState(() => value.toLocaleString("ko-KR"));
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value.toLocaleString("ko-KR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input id={id} className="field tnum pr-8" inputMode="numeric" autoComplete="off" value={text}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const n = Math.min(max, Math.max(min, parseMoney(raw)));
            onChange(Math.round(n));
          }}
          onBlur={() => setText(value.toLocaleString("ko-KR"))} />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">원</span>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted tnum">{hint}</p>}
    </div>
  );
}

function NumberField({ id, label, value, onChange, min, max, step, unit }: {
  id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  const [text, setText] = useState(() => String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input id={id} type="number" className="field tnum pr-10" inputMode="decimal" value={text} min={min} max={max} step={step}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n) && e.target.value !== "") onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setText(String(value))} />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{unit}</span>
      </div>
    </div>
  );
}

function Chips<T extends number | string>({ items, current, onPick, label, format }: {
  items: readonly T[]; current: T; onPick: (v: T) => void; label: string; format: (v: T) => string;
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

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly { value: T; label: string; desc?: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label key={o.value} className={`cursor-pointer rounded-md px-3 py-1.5 text-center text-sm transition-colors ${active ? "bg-surface font-semibold text-fg shadow-sm" : "text-muted hover:text-fg"}`}>
              <input type="radio" name={label} value={o.value} checked={active} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
              {o.desc && <span className="block text-[11px] font-normal text-muted">{o.desc}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ───────────────── 차트 ───────────────── */

function compactWon(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e9 ? 0 : 1)}억`;
  if (a >= 1e4) return `${Math.round(n / 1e4).toLocaleString("ko-KR")}만`;
  return `${Math.round(n).toLocaleString("ko-KR")}`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function GrowthChart({ result }: { result: CompoundResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = result.rows;
  const W = 640, H = 280, padL = 56, padR = 12, padT = 16, padB = 32;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxVal = niceMax(Math.max(...rows.map((r) => Math.max(r.balance, r.invested)), 1));
  const n = rows.length;
  const slot = innerW / n;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => padT + innerH - (Math.max(0, v) / maxVal) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);
  const labelEvery = n > 30 ? 10 : n > 12 ? 5 : n > 6 ? 2 : 1;
  const hovered = hover !== null ? rows[hover] : undefined;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full" aria-labelledby="chart-title chart-desc"
        onMouseLeave={() => setHover(null)}>
        <title id="chart-title">연도별 자산 성장 차트</title>
        <desc id="chart-desc">
          {`${n}년 동안 누적 투자원금과 누적 이자(수익)를 연도별 막대로 표시합니다. 최종 세전 잔액 ${fmtManWon(result.totals.balance)}, 그중 투자원금 ${fmtManWon(result.totals.invested)}, 이자 ${fmtManWon(result.totals.interest)}.`}
        </desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted)" className="tnum">{compactWon(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const yInv = y(r.invested);
          const yBal = y(r.balance);
          const interestPositive = r.balance >= r.invested;
          const isHover = hover === i;
          return (
            <g key={r.year} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
              <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
              <rect x={x} y={yInv} width={barW} height={Math.max(0, padT + innerH - yInv)} fill="var(--muted)" opacity={isHover ? 0.9 : 0.55} rx={1.5} />
              {interestPositive ? (
                <rect x={x} y={yBal} width={barW} height={Math.max(0, yInv - yBal)} fill="var(--brand)" opacity={isHover ? 1 : 0.85} rx={1.5} />
              ) : (
                <rect x={x} y={yBal} width={barW} height={Math.max(0, yInv - yBal)} fill="var(--down)" opacity={0.6} rx={1.5} />
              )}
              {(r.year % labelEvery === 0 || r.year === 1) && (
                <text x={x + barW / 2} y={H - padB + 14} textAnchor="middle" fontSize={10} fill="var(--muted)" className="tnum">{r.year}년</text>
              )}
              <title>{`${r.year}년차 · 잔액 ${fmtManWon(r.balance)} (원금 ${fmtManWon(r.invested)} + 이자 ${fmtManWon(r.interest)})`}</title>
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="var(--border)" />
      </svg>
      {hovered && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs shadow-sm tnum">
          <strong>{hovered.year}년차</strong> · 잔액 {fmtManWon(hovered.balance)} <span className="text-muted">= 원금 {fmtManWon(hovered.invested)} + 이자 {fmtManWon(hovered.interest)}</span>
        </div>
      )}
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-muted/60" />누적 투자원금</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />누적 이자(수익, 세전)</span>
      </figcaption>
    </figure>
  );
}

/* ───────────────── PNG 카드(canvas) ───────────────── */

function drawResultCard(result: CompoundResult): HTMLCanvasElement {
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const font = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  const { input, totals, rows } = result;

  // 배경 (다크 고정 — 카드 이미지는 테마 무관)
  ctx.fillStyle = "#0b0e13"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(96,165,250,0.18)"); g.addColorStop(1, "rgba(96,165,250,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 헤더
  ctx.fillStyle = "#60a5fa"; ctx.fillRect(56, 56, 22, 22);
  ctx.fillStyle = "#e8ecf1"; ctx.font = `700 26px ${font}`; ctx.textBaseline = "middle";
  ctx.fillText("스톡랩 복리 계산기", 90, 67);
  ctx.fillStyle = "#9aa5b4"; ctx.font = `400 20px ${font}`;
  const cond = `원금 ${fmtManWon(input.principal)} · 월 ${fmtManWon(input.monthly)} · 연 ${input.annualRatePct}% · ${input.years}년 · ${input.compounding === "monthly" ? "월복리" : "연복리"}`;
  ctx.fillText(cond, 56, 112);

  // 핵심 숫자
  ctx.fillStyle = "#9aa5b4"; ctx.font = `500 20px ${font}`;
  ctx.fillText("최종 자산(세전)", 56, 175);
  ctx.fillStyle = "#e8ecf1"; ctx.font = `800 64px ${font}`;
  ctx.fillText(fmtManWon(totals.balance), 56, 225);
  const sub: [string, string][] = [
    ["총 투자원금", fmtManWon(totals.invested)],
    ["총 이자(수익)", fmtManWon(totals.interest)],
    ["원금 대비", `${totals.multiple.toFixed(2)}배`],
  ];
  if (input.taxRatePct) sub.push([`세후(${input.taxRatePct}%)`, fmtManWon(totals.afterTaxBalance)]);
  if (input.inflationPct) sub.push([`실질가치(물가 ${input.inflationPct}%)`, fmtManWon(totals.realBalance)]);
  let sy = 300;
  for (const [k, v] of sub) {
    ctx.fillStyle = "#9aa5b4"; ctx.font = `400 19px ${font}`; ctx.fillText(k, 56, sy);
    ctx.fillStyle = "#e8ecf1"; ctx.font = `700 24px ${font}`; ctx.fillText(v, 300, sy);
    sy += 40;
  }

  // 미니 차트 (우측)
  const cx = 640, cy = 160, cw = 500, ch = 340;
  const maxV = Math.max(...rows.map((r) => r.balance), 1);
  const slot = cw / rows.length;
  const bw = Math.max(2, slot * 0.7);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const x = cx + i * slot + (slot - bw) / 2;
    const hInv = (r.invested / maxV) * ch;
    const hBal = (Math.max(r.balance, r.invested) / maxV) * ch;
    ctx.fillStyle = "rgba(154,165,180,0.55)"; ctx.fillRect(x, cy + ch - hInv, bw, hInv);
    ctx.fillStyle = "#60a5fa"; ctx.fillRect(x, cy + ch - hBal, bw, hBal - hInv);
  }
  ctx.strokeStyle = "#263040"; ctx.beginPath(); ctx.moveTo(cx, cy + ch + 0.5); ctx.lineTo(cx + cw, cy + ch + 0.5); ctx.stroke();
  ctx.fillStyle = "#9aa5b4"; ctx.font = `400 16px ${font}`;
  ctx.fillText("1년", cx, cy + ch + 20); ctx.textAlign = "right"; ctx.fillText(`${input.years}년`, cx + cw, cy + ch + 20); ctx.textAlign = "left";
  ctx.fillStyle = "rgba(154,165,180,0.55)"; ctx.fillRect(cx, cy - 30, 14, 14);
  ctx.fillStyle = "#9aa5b4"; ctx.fillText("투자원금", cx + 20, cy - 23);
  ctx.fillStyle = "#60a5fa"; ctx.fillRect(cx + 110, cy - 30, 14, 14);
  ctx.fillStyle = "#9aa5b4"; ctx.fillText("이자(수익)", cx + 130, cy - 23);

  // 하단 고지 + 워터마크
  ctx.fillStyle = "#9aa5b4"; ctx.font = `400 16px ${font}`;
  ctx.fillText("가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다. 세금·수수료·물가는 옵션 선택 시에만 반영.", 56, 560);
  ctx.fillStyle = "#e8ecf1"; ctx.font = `600 18px ${font}`;
  ctx.fillText(WATERMARK, 56, 592);
  return c;
}

/* ───────────────── 메인 ───────────────── */

const P_CHIPS = [1_000_000, 10_000_000, 100_000_000] as const;
const M_CHIPS = [100_000, 300_000, 500_000, 1_000_000] as const;
const R_CHIPS = [3, 5, 7, 10] as const;
const Y_CHIPS = [10, 20, 30] as const;

export function CompoundCalculator({ initial, shared }: Props) {
  const [input, setInput] = useState<CompoundInput>(() => normalizeInput(initial));
  const [taxOn, setTaxOn] = useState<boolean>(() => (initial.taxRatePct ?? 0) > 0);
  const [taxRate, setTaxRate] = useState<number>(() => initial.taxRatePct ?? KR_INTEREST_TAX_PCT);
  const [inflation, setInflation] = useState<number>(() => initial.inflationPct ?? 0);
  const [target, setTarget] = useState<number>(100_000_000);
  const [toast, setToast] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const effective = useMemo<CompoundInput>(() => normalizeInput({
    ...input,
    inflationPct: inflation > 0 ? inflation : undefined,
    taxRatePct: taxOn && taxRate > 0 ? taxRate : undefined,
  }), [input, inflation, taxOn, taxRate]);

  const result = useMemo(() => simulate(effective), [effective]);
  const query = useMemo(() => encodeParams(effective), [effective]);

  // URL 동기화 (디바운스) — 공유 가능한 링크 유지
  useEffect(() => {
    const t = window.setTimeout(() => {
      const url = `${window.location.pathname}?${query}`;
      if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const set = useCallback(<K extends keyof CompoundInput>(k: K, v: CompoundInput[K]) => {
    setInput((prev) => ({ ...prev, [k]: v }));
  }, []);

  const shareUrl = useCallback(() => `${window.location.origin}${SHARE_PATH}?${query}`, [query]);

  async function copyText(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(ok);
    } catch {
      setToast("복사에 실패했습니다. 주소창에서 직접 복사해 주세요.");
    }
  }

  function communityText(): string {
    const { input: i, totals: t } = result;
    const lines = [
      `📈 복리 계산 결과 (스톡랩)`,
      `조건: 원금 ${fmtManWon(i.principal)} · 월 ${fmtManWon(i.monthly)} 적립 · 연 ${i.annualRatePct}% · ${i.years}년 · ${i.compounding === "monthly" ? "월복리" : "연복리"}`,
      `최종 자산(세전): ${fmtManWon(t.balance)}`,
      `총 투자원금: ${fmtManWon(t.invested)} / 총 이자: ${fmtManWon(t.interest)} (원금의 ${t.multiple.toFixed(2)}배)`,
    ];
    if (i.taxRatePct) lines.push(`세후(${i.taxRatePct}%): ${fmtManWon(t.afterTaxBalance)}`);
    if (i.inflationPct) lines.push(`실질가치(물가 ${i.inflationPct}%): ${fmtManWon(t.realBalance)}`);
    lines.push(`직접 계산: ${shareUrl()}`);
    lines.push(`※ 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다.`);
    return lines.join("\n");
  }

  async function share() {
    const url = shareUrl();
    const text = `복리 계산 결과: ${result.input.years}년 후 ${fmtManWon(result.totals.balance)} (원금 ${fmtManWon(result.totals.invested)}) — 가정에 따른 단순 계산`;
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: "스톡랩 복리 계산기", text, url }); return; } catch { /* 취소 */ return; }
    }
    await copyText(url, "공유를 지원하지 않는 브라우저여서 링크를 복사했습니다.");
  }

  function savePng() {
    try {
      const canvas = drawResultCard(result);
      canvas.toBlob((blob) => {
        if (!blob) { setToast("이미지 생성에 실패했습니다."); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `stocklab-compound-${result.input.years}y-${Math.round(result.totals.balance)}.png`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setToast("결과 카드 PNG 를 저장했습니다.");
      }, "image/png");
    } catch {
      setToast("이미지 생성에 실패했습니다.");
    }
  }

  function resetToDefault() {
    setInput(DEFAULT_INPUT);
    setTaxOn(false); setInflation(0);
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const { totals, rows } = result;
  const r72 = ruleOf72(effective.annualRatePct);
  const exact = exactDoublingYears(effective.annualRatePct);
  const need = requiredMonthly(target, effective.years, effective.annualRatePct, {
    principal: effective.principal, compounding: effective.compounding, contributionTiming: effective.contributionTiming,
  });

  return (
    <div className="space-y-6">
      {shared && (
        <div role="status" className="card flex flex-col gap-3 border-brand/40 bg-brand/5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <strong>공유된 계산 조건</strong>이 입력돼 있습니다 — 숫자를 바꿔 바로 다시 계산하거나, 기본값으로 새로 시작할 수 있습니다.
          </p>
          <button type="button" onClick={resetToDefault} className="btn-primary shrink-0">나도 해보기</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 입력 */}
        <form ref={formRef} className="card space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="복리 계산 입력">
          <div>
            <MoneyField id="principal" label="원금(거치금)" value={input.principal} onChange={(v) => set("principal", v)}
              min={LIMITS.principal.min} max={LIMITS.principal.max} hint={fmtManWon(input.principal)} />
            <Chips items={P_CHIPS} current={input.principal} onPick={(v) => set("principal", v)} label="원금 빠른 선택" format={fmtManWon} />
          </div>
          <div>
            <MoneyField id="monthly" label="월 적립액" value={input.monthly} onChange={(v) => set("monthly", v)}
              min={LIMITS.monthly.min} max={LIMITS.monthly.max} hint={`${fmtManWon(input.monthly)} × 12개월 = 연 ${fmtManWon(input.monthly * 12)}`} />
            <Chips items={M_CHIPS} current={input.monthly} onPick={(v) => set("monthly", v)} label="월 적립액 빠른 선택" format={fmtManWon} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <NumberField id="rate" label="연 수익률" value={input.annualRatePct} onChange={(v) => set("annualRatePct", v)}
                min={LIMITS.rate.min} max={LIMITS.rate.max} step={0.1} unit="%" />
              <Chips items={R_CHIPS} current={input.annualRatePct} onPick={(v) => set("annualRatePct", v)} label="수익률 빠른 선택" format={(v) => `${v}%`} />
            </div>
            <div>
              <NumberField id="years" label="기간" value={input.years} onChange={(v) => set("years", Math.round(v))}
                min={LIMITS.years.min} max={LIMITS.years.max} step={1} unit="년" />
              <Chips items={Y_CHIPS} current={input.years} onPick={(v) => set("years", v)} label="기간 빠른 선택" format={(v) => `${v}년`} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Segmented label="복리 주기" value={input.compounding} onChange={(v) => set("compounding", v)}
              options={[{ value: "monthly", label: "월복리", desc: "매월 이자 계산" }, { value: "yearly", label: "연복리", desc: "연 1회 이자 계산" }]} />
            <Segmented label="적립 시점" value={input.contributionTiming} onChange={(v) => set("contributionTiming", v)}
              options={[{ value: "begin", label: "기초(선납)", desc: "기간 시작에 입금" }, { value: "end", label: "기말(후납)", desc: "기간 끝에 입금" }]} />
          </div>

          <details className="rounded-xl border border-border bg-surface-2 p-3 [&_summary]:cursor-pointer" open={taxOn || inflation > 0}>
            <summary className="text-sm font-semibold">고급 옵션 <span className="font-normal text-muted">— 세금 · 물가 (선택)</span></summary>
            <div className="mt-3 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} className="h-4 w-4 accent-brand" />
                  이자(수익)에 세율 적용 <span className="text-muted">— 기본 {KR_INTEREST_TAX_PCT}% (이자소득세 14% + 지방소득세 1.4%)</span>
                </label>
                {taxOn && (
                  <div className="mt-2 max-w-[12rem]">
                    <NumberField id="tax" label="세율" value={taxRate} onChange={setTaxRate} min={LIMITS.tax.min} max={LIMITS.tax.max} step={0.1} unit="%" />
                  </div>
                )}
                <p className="mt-1 text-xs text-muted">최종 누적 이자에 세율을 한 번 곱해 빼는 단순 계산입니다. 비과세·분리과세·금융소득종합과세 등 실제 과세 방식은 반영하지 않습니다.</p>
              </div>
              <div className="max-w-[12rem]">
                <NumberField id="inflation" label="연 물가상승률(실질가치 계산)" value={inflation} onChange={setInflation} min={LIMITS.inflation.min} max={LIMITS.inflation.max} step={0.1} unit="%" />
                <p className="mt-1 text-xs text-muted">0 이면 미반영. 한국은행 물가안정목표는 2% 입니다.</p>
              </div>
            </div>
          </details>
        </form>

        {/* 결과 */}
        <section aria-label="계산 결과" aria-live="polite" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card col-span-2 !border-brand/40">
              <p className="text-xs font-medium text-muted">{effective.years}년 후 최종 자산 <span className="font-normal">(세전)</span></p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight tnum sm:text-4xl">{fmtManWon(totals.balance)}</p>
              <p className="mt-1 text-xs text-muted tnum">{fmtWonFull(totals.balance)} · 총 투자원금의 <strong className="text-fg">{totals.multiple.toFixed(2)}배</strong></p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-muted">총 투자원금</p>
              <p className="mt-1 text-lg font-bold tnum sm:text-xl">{fmtManWon(totals.invested)}</p>
              <p className="mt-0.5 text-[11px] text-muted tnum">원금 {fmtManWon(effective.principal)} + 적립 {fmtManWon(totals.invested - effective.principal)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-muted">총 이자(수익, 세전)</p>
              <p className={`mt-1 text-lg font-bold tnum sm:text-xl ${totals.interest < 0 ? "text-down" : "text-brand"}`}>{fmtManWon(totals.interest)}</p>
              <p className="mt-0.5 text-[11px] text-muted tnum">투자원금 대비 {totals.interestRatioPct.toFixed(1)}%</p>
            </div>
            {effective.taxRatePct !== undefined && (
              <div className="card">
                <p className="text-xs font-medium text-muted">세후 자산 (세율 {effective.taxRatePct}%)</p>
                <p className="mt-1 text-lg font-bold tnum sm:text-xl">{fmtManWon(totals.afterTaxBalance)}</p>
                <p className="mt-0.5 text-[11px] text-muted tnum">세금 {fmtManWon(totals.tax)}</p>
              </div>
            )}
            {effective.inflationPct !== undefined && (
              <div className="card">
                <p className="text-xs font-medium text-muted">실질가치 (물가 {effective.inflationPct}%/년)</p>
                <p className="mt-1 text-lg font-bold tnum sm:text-xl">{fmtManWon(totals.realBalance)}</p>
                <p className="mt-0.5 text-[11px] text-muted">현재 구매력 기준{effective.taxRatePct !== undefined ? " · 세후" : ""}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">연도별 성장 (원금 vs 이자)</h2>
            <GrowthChart result={result} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card">
              <h2 className="text-sm font-semibold">72의 법칙</h2>
              {r72 !== null && exact !== null ? (
                <p className="mt-1 text-sm leading-6 text-fg/90 tnum">
                  연 {effective.annualRatePct}% 라면 자산이 2배가 되는 데 약 <strong>{r72.toFixed(1)}년</strong> (72 ÷ {effective.annualRatePct}).
                  정확한 값은 <strong>{exact.toFixed(1)}년</strong> 입니다.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">수익률이 0% 이하이면 2배 도달 연수를 계산할 수 없습니다.</p>
              )}
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold">목표 금액까지 필요한 월 적립액 (역산)</h2>
              <div className="mt-2">
                <MoneyField id="target" label="목표 금액(세전)" value={target} onChange={setTarget} min={0} max={1e12} />
                <Chips items={[50_000_000, 100_000_000, 300_000_000, 1_000_000_000] as const} current={target} onPick={setTarget} label="목표 금액 빠른 선택" format={fmtManWon} />
              </div>
              <p className="mt-3 text-sm leading-6 tnum">
                {need === null ? (
                  <span className="text-muted">현재 조건(상한 월 {fmtManWon(LIMITS.monthly.max)})으로는 도달할 수 없습니다.</span>
                ) : need === 0 ? (
                  <>원금 {fmtManWon(effective.principal)} 만으로 {effective.years}년 뒤 목표를 넘습니다. 추가 적립 없이 <strong>월 0원</strong>.</>
                ) : (
                  <>연 {effective.annualRatePct}% · {effective.years}년 · 원금 {fmtManWon(effective.principal)} 조건이면 <strong className="text-brand">월 {fmtManWon(need)}</strong> 적립이 필요합니다.</>
                )}
              </p>
              {need !== null && need > 0 && (
                <button type="button" className="btn-ghost mt-2 !py-1 text-xs" onClick={() => set("monthly", Math.min(LIMITS.monthly.max, need))}>이 금액으로 월 적립액 채우기</button>
              )}
            </div>
          </div>

          {/* 연도별 표 */}
          <div className="card">
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} aria-controls="year-table" className="flex w-full items-center justify-between text-left text-sm font-semibold">
              연도별 상세 표 ({rows.length}행)
              <span aria-hidden className="text-muted">{showTable ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>
            <div id="year-table" hidden={!showTable} className="mt-3 overflow-x-auto">
              <table className="w-full text-xs tnum sm:text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-2 font-medium">연차</th>
                    <th scope="col" className="py-2 pr-2 font-medium">누적 원금</th>
                    <th scope="col" className="py-2 pr-2 font-medium">누적 이자</th>
                    <th scope="col" className="py-2 pr-2 font-medium">잔액(세전)</th>
                    {effective.taxRatePct !== undefined && <th scope="col" className="py-2 pr-2 font-medium">세후</th>}
                    {effective.inflationPct !== undefined && <th scope="col" className="py-2 font-medium">실질가치</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year} className="border-b border-border/60">
                      <td className="py-1.5 pr-2">{r.year}년</td>
                      <td className="py-1.5 pr-2">{fmtManWon(r.invested)}</td>
                      <td className={`py-1.5 pr-2 ${r.interest < 0 ? "text-down" : ""}`}>{fmtManWon(r.interest)}</td>
                      <td className="py-1.5 pr-2 font-semibold">{fmtManWon(r.balance)}</td>
                      {effective.taxRatePct !== undefined && <td className="py-1.5 pr-2">{fmtManWon(r.afterTaxBalance)}</td>}
                      {effective.inflationPct !== undefined && <td className="py-1.5">{fmtManWon(r.realBalance)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 공유 */}
          <div className="card">
            <h2 className="text-sm font-semibold">결과 공유</h2>
            <p className="mt-1 text-xs text-muted">현재 URL 에 입력 조건이 담겨 있어 링크만 보내면 같은 결과가 열립니다.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => copyText(shareUrl(), "링크를 복사했습니다.")}>링크 복사</button>
              <button type="button" className="btn-ghost" onClick={share}>공유</button>
              <button type="button" className="btn-ghost" onClick={savePng}>결과 카드 PNG 저장</button>
              <button type="button" className="btn-ghost" onClick={() => copyText(communityText(), "커뮤니티용 텍스트를 복사했습니다.")}>커뮤니티용 텍스트 복사</button>
            </div>
            {toast && <p role="status" className="mt-3 text-xs font-medium text-brand">{toast}</p>}
          </div>

          <p className="text-xs leading-5 text-muted">
            ※ 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다. 수수료·거래비용은 반영하지 않으며, 세금·물가는 고급 옵션을 켠 경우에만 단순 반영합니다. 실제 투자 성과는 매년 달라지므로 일정한 수익률 가정과 다를 수 있습니다.
          </p>
          <Disclaimer compact />
          <AdSlot />
        </section>
      </div>
    </div>
  );
}
