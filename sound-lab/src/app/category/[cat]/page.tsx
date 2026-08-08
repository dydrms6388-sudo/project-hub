import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { byCategory, categories, getCategory } from "@/lib/sounds";

export function generateStaticParams() {
  return categories.map((c) => ({ cat: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) return {};
  return {
    title: `${c.label} 실험 목록`,
    description: `${c.description}. 슬라이더로 조작하는 인터랙티브 소리 실험 ${byCategory(cat).length}가지.`,
    alternates: { canonical: `/category/${cat}/` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const c = getCategory(cat);
  if (!c) notFound();
  const items = byCategory(cat);
  return (
    <main className="wrap">
      <p className="breadcrumb">
        <Link href="/">홈</Link> › {c.label}
      </p>
      <h1>{c.label}</h1>
      <p className="lead">{c.description}</p>
      <ul className="card-grid">
        {items.map((s) => (
          <li key={s.slug} className="card">
            <Link href={`/sound/${s.slug}/`}>{s.name}</Link>
            <p>{s.principle.split(". ")[0].slice(0, 110)}…</p>
            <span className="meta">
              {s.needsHeadphones && (
                <span className="badge badge-phones">🎧 이어폰</span>
              )}
              {s.hearingRisk === "주의" && (
                <span className="badge badge-risk">청력 주의</span>
              )}
              <span className="badge">CPU {s.cpuCost}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
