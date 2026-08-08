import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  CategoryKey,
  calcsInCategory,
  guidesInCategory,
} from "@/lib/data";

const CAT_DESC: Record<CategoryKey, string> = {
  depth:
    "심도·과초점거리·착란원 — '어디까지 선명한가'를 정확식으로 다루는 도구들입니다. 모두 같은 착란원 정의를 공유하므로 결과를 서로 넘나들며 쓸 수 있습니다.",
  exposure:
    "노출의 산술입니다. 등가 조합, EV, ND 연장, 접사 감광, 움직임 흐림까지 — 전부 실제 카메라에 존재하는 클릭값 위에서 계산합니다.",
  astro:
    "천체와 자연광 계산. NPF 셔터, 별 궤적, 태양 고도각 기반 골든아워·박명 — 외부 API 없이 브라우저 안에서 천문 알고리즘을 직접 돌립니다.",
  framing:
    "화각과 구도의 기하. 방향별 화각, 센서 간 환산, 파노라마 분할까지 같은 투영 기하에서 나오는 계산들입니다.",
  sharpness:
    "해상도와 디테일의 물리적 한계. 회절과 화소 피치 — 장비 선택과 조리개 결정의 정량 근거가 됩니다.",
  flash: "플래시 광량의 규격인 가이드넘버와 그 주변 물리를 다룹니다.",
  planning: "촬영 전 산수를 끝내 두는 계획 도구입니다.",
};

export function generateStaticParams() {
  return CATEGORY_KEYS.map((cat) => ({ cat }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  if (!(cat in CATEGORIES)) return {};
  const key = cat as CategoryKey;
  return {
    title: `${CATEGORIES[key]} 계산기·해설`,
    description: CAT_DESC[key],
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  if (!(cat in CATEGORIES)) notFound();
  const key = cat as CategoryKey;
  const calcs = calcsInCategory(key);
  const guides = guidesInCategory(key);

  return (
    <>
      <nav className="breadcrumb">
        <Link href="/">PhotoLab</Link> › {CATEGORIES[key]}
      </nav>
      <h1>{CATEGORIES[key]}</h1>
      <p className="page-desc">{CAT_DESC[key]}</p>

      {calcs.length > 0 && (
        <section className="cat-section">
          <h2>계산기</h2>
          <div className="card-grid">
            {calcs.map((c) => (
              <Link key={c.slug} href={`/calc/${c.slug}/`} className="card">
                <div className="card-name">{c.name}</div>
                <div className="card-desc">{c.formula.split(";")[0]}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="cat-section">
          <h2>해설</h2>
          <div className="card-grid">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guide/${g.slug}/`} className="card">
                <div className="card-name">{g.name}</div>
                <div className="card-desc">{g.topic.slice(0, 72)}…</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
