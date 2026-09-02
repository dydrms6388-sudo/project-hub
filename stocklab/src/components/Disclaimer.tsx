import { SITE } from "@/lib/site";

/** 모든 화면 하단 필수 면책 고지. 문구 출처: docs/00-legal-expression-guide.md */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" aria-label="면책 고지"
      className={`rounded-xl border border-border bg-surface-2 text-muted ${compact ? "px-3 py-2 text-[11px] leading-5" : "px-4 py-3 text-xs leading-6"}`}>
      <p><strong className="text-fg/80">면책 고지</strong> · {SITE.disclaimer}</p>
      {!compact && <p className="mt-1">{SITE.dataDisclaimer} 과거 성과는 미래 수익을 보장하지 않습니다.</p>}
    </div>
  );
}
