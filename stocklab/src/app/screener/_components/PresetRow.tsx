import Link from "next/link";

export interface PresetLink { key: string; label: string; description: string; href: string }

/** 프리셋 링크 줄 — 클릭하면 파라미터 + run=1 로 즉시 실행 */
export function PresetRow({ presets, activeKey }: { presets: PresetLink[]; activeKey: string | null }) {
  return (
    <nav aria-label="프리셋 조건" className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = p.key === activeKey;
        return (
          <Link
            key={p.key}
            href={p.href}
            title={p.description}
            aria-current={active ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-fg hover:bg-surface-2"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
