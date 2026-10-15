// =============================================================================
// E4 · /legal/[slug] — 법적 문서 전문 렌더 [F-LGL-01]
//
// · content/legal/*.md 를 lib/legal 로 읽어 {{VAR}} 치환 후 자체 파서로 HTML 변환
//   (외부 마크다운 라이브러리 미사용 — 새 의존성 금지 규칙).
// · draft:true → "법률 검토 전 초안" 배너 의무 노출 (08_legal_docs 결정 ①).
// · 조항 앵커(#제13조) 딥링크 지원 — 제재 통보·구독 화면이 특정 조를 가리킨다.
// · robots index 허용: 공식 페이지이므로 UGC noindex 대상이 아니다.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@duckmate/ui";
import { LEGAL_SLUGS, getLegalDoc, isLegalSlug } from "@/lib/legal/documents";

export const dynamic = "force-static";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return { title: "약관", robots: { index: false, follow: false } };
  const doc = await getLegalDoc(slug);
  if (!doc) return { title: "약관", robots: { index: false, follow: false } };
  return {
    title: doc.title,
    description: `덕메이트 ${doc.title} 전문 (v${doc.version}).`,
    robots: { index: true, follow: true },
  };
}

/** 약관의 일부로 편입되는 문서 간 상호 링크 (08_legal_docs 결정 ③) */
const RELATED: Record<string, { slug: string; label: string }[]> = {
  terms: [
    { slug: "community", label: "커뮤니티 가이드라인 (제12·13조)" },
    { slug: "refund", label: "환불정책 (제15조)" },
    { slug: "privacy", label: "개인정보처리방침" },
  ],
  community: [{ slug: "terms", label: "이용약관 제12·13조" }],
  refund: [{ slug: "terms", label: "이용약관 제14·15조" }],
  privacy: [{ slug: "location", label: "위치정보 이용약관" }],
  location: [{ slug: "privacy", label: "개인정보처리방침" }],
  youth: [{ slug: "community", label: "커뮤니티 가이드라인" }],
};

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const doc = await getLegalDoc(slug);
  if (!doc) notFound();

  const related = RELATED[doc.slug] ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 text-ink">
      <nav className="text-body-sm">
        <Link href="/legal" className="text-primary underline underline-offset-2">
          ← 약관 및 정책
        </Link>
      </nav>

      <header className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-h1">{doc.title}</h1>
          {doc.draft && <Badge variant="warning">검토 전 초안</Badge>}
        </div>
        <p className="text-caption text-ink-muted">
          버전 v{doc.version} · 시행일 {doc.effectiveDateLabel}
        </p>
      </header>

      {doc.draft && (
        <div
          role="note"
          className="rounded-xl border border-line bg-warning-tint px-4 py-3 text-body-sm text-warning"
        >
          <strong>본 문서는 법률 검토 전 초안입니다.</strong> 정식 시행 전 변호사 검토를 거쳐 내용이
          바뀔 수 있으며, 확정본은 시행일 공지와 함께 다시 안내드립니다.
        </div>
      )}

      {doc.missingPlaceholders.length > 0 && (
        <div
          role="note"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-caption text-ink-muted"
        >
          사업자 정보(<code>[TODO_사업자정보…]</code>)와 시행일은 정식 오픈 전에 확정해 표기합니다.
        </div>
      )}

      {doc.headings.length > 2 && (
        <nav aria-label="조항 목차" className="rounded-xl border border-line bg-surface-raised p-4">
          <p className="mb-2 text-body-sm font-semibold">목차</p>
          <ul className="flex flex-col gap-1">
            {doc.headings
              .filter((h) => h.level === 2)
              .map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${encodeURIComponent(h.id)}`}
                    className="text-body-sm text-primary underline underline-offset-2"
                  >
                    {h.text}
                  </a>
                </li>
              ))}
          </ul>
        </nav>
      )}

      <article
        className="text-ink [&_strong]:font-semibold"
        // 원본은 우리 저장소의 md 파일뿐이며, 파서가 이스케이프 후 허용 태그만 생성한다.
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />

      {related.length > 0 && (
        <section className="border-t border-line pt-4">
          <h2 className="mb-2 text-h3">함께 보기</h2>
          <ul className="flex flex-col gap-1">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/legal/${r.slug}`}
                  className="text-body-sm text-primary underline underline-offset-2"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
