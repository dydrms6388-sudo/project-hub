import Link from "next/link";

export function DocPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-safe pb-20">
      <Link href="/" className="mt-6 inline-block text-sm text-muted-foreground">
        ← BETWEEN
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      {updated && <p className="mt-1 text-xs text-muted-foreground">시행일 {updated}</p>}
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}
