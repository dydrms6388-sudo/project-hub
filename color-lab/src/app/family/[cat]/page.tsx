import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { colorsInFamily, FAMILIES } from "@/lib/data";

export function generateStaticParams() {
  return Object.keys(FAMILIES).map((cat) => ({ cat }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const fam = FAMILIES[cat];
  if (!fam) return {};
  return {
    title: `${fam.nameKo} 색상 모음`,
    description: `${fam.nameKo}에 속한 색들의 코드값·배색·접근성 정보. ${fam.desc}`,
  };
}

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const fam = FAMILIES[cat];
  const list = colorsInFamily(cat);
  if (!fam || list.length === 0) notFound();

  return (
    <main>
      <nav className="crumbs" aria-label="현재 위치">
        <Link href="/">색채 실험실</Link> › {fam.nameKo}
      </nav>
      <h1>{fam.nameKo}</h1>
      <p>{fam.desc}</p>
      <ul className="swatch-grid" style={{ marginTop: 18 }}>
        {list.map((c) => (
          <li key={c.slug}>
            <Link href={`/color/${c.slug}/`} className="swatch-card">
              <div className="chip" style={{ background: c.hex }} />
              <div className="meta">
                <div>
                  {c.nameKo}{" "}
                  <span className="muted" style={{ fontSize: "0.76rem" }}>
                    {c.nameEn}
                  </span>
                </div>
                <div className="hex">{c.hex}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ marginTop: 20 }}>
        각 색상 페이지에서 밝기·채도를 조정하고, 배색 조합과 WCAG 대비비를
        실시간으로 확인할 수 있습니다.
      </p>
    </main>
  );
}
