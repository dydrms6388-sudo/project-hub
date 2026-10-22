import Link from "next/link";

export function DocPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main className="pt-safe mx-auto w-full max-w-2xl px-5 pb-20">
      <Link href="/" className="text-muted-foreground mt-6 inline-block text-sm">
        ← BETWEEN
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      {updated && <p className="text-muted-foreground mt-1 text-xs">시행일 {updated}</p>}
      <div className="text-foreground/90 [&_h2]:text-foreground mt-6 space-y-6 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}
