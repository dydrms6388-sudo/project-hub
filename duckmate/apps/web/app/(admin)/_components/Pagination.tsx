import Link from "next/link";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  return (
    <div className="flex items-center justify-between text-body-sm text-muted-foreground">
      <span className="tnum">
        총 {total}건 · {page + 1}/{last + 1} 페이지
      </span>
      <div className="flex gap-2">
        {page > 0 ? (
          <Link href={hrefFor(page - 1)} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            이전
          </Link>
        ) : null}
        {page < last ? (
          <Link href={hrefFor(page + 1)} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            다음
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    sp.set(k, v === true ? "1" : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
