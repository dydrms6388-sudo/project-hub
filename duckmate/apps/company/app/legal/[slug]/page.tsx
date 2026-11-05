import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@duckmate/ui";
import { SERVICE_NAME, company, companyUrl, isPlaceholder } from "@/config/company";
import { LEGAL_DOCS, LEGAL_ROUTE_SLUGS, loadLegalDoc, type LegalRouteSlug } from "@/lib/legal";
import { Container } from "@/components/Container";
import { JsonLd } from "@/components/JsonLd";
import { LegalTabs } from "@/components/LegalTabs";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_ROUTE_SLUGS.map((slug) => ({ slug }));
}

function isRoute(s: string): s is LegalRouteSlug {
  return (LEGAL_ROUTE_SLUGS as string[]).includes(s);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isRoute(slug)) return {};
  const doc = loadLegalDoc(slug);
  return {
    title: doc.meta.title,
    description: LEGAL_DOCS[slug].description,
    // canonical 은 web 도메인(복제 콘텐츠 회피). WEB_APP_URL 미설정이면 self-canonical.
    alternates: { canonical: doc.canonical ?? `/legal/${slug}/` },
  };
}

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isRoute(slug)) notFound();
  const doc = loadLegalDoc(slug);
  const { meta, toc } = doc;
  const webLegal = isPlaceholder(company.WEB_APP_URL) ? null : `${company.WEB_APP_URL.replace(/\/$/, "")}/legal/${meta.slug}`;

  return (
    <Container className="py-8 md:py-12">
      <LegalTabs current={`/legal/${slug}/`} />
      <article className="mx-auto mt-8 max-w-3xl">
        <header className="border-b border-border pb-6">
          <p className="text-label text-primary">법적 고지</p>
          <h1 className="text-h1 mt-1">{meta.title}</h1>
          <dl className="text-body-sm mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt>시행일</dt>
              <dd className="tnum font-medium text-foreground">{meta.effective_date}</dd>
              {doc.upcoming ? (
                <dd>
                  <Badge variant="info" size="sm">
                    개정 예정
                  </Badge>
                </dd>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <dt>버전</dt>
              <dd className="tnum">{meta.version}</dd>
            </div>
            {meta.last_updated ? (
              <div className="flex items-center gap-1.5">
                <dt>마지막 편집</dt>
                <dd className="tnum">{meta.last_updated}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        {toc.length ? (
          <details className="mt-6 rounded-lg border border-border bg-card p-4" open={toc.length <= 16}>
            <summary className="text-label cursor-pointer select-none text-foreground">목차</summary>
            <ol className="text-body-sm mt-3 space-y-1.5">
              {toc.map((t) => (
                <li key={t.id} className={t.depth === 3 ? "pl-4" : "font-medium"}>
                  <a href={`#${t.id}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        <div className="legal-prose mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />

        <footer className="text-body-sm mt-12 rounded-lg bg-muted p-4 text-muted-foreground">
          {webLegal ? (
            <p>
              이 문서는{" "}
              <a href={webLegal} className="text-primary underline underline-offset-4">
                {webLegal}
              </a>
              과 동일한 내용이에요. 변경 시 시행일이 갱신돼요.
            </p>
          ) : (
            <p>이 문서는 {SERVICE_NAME} 앱 안의 법적 고지와 동일한 내용이에요. 변경 시 시행일이 갱신돼요.</p>
          )}
        </footer>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: meta.title,
          url: companyUrl(`/legal/${slug}/`),
          inLanguage: "ko",
          ...(meta.last_updated ? { dateModified: meta.last_updated } : {}),
          ...(isPlaceholder(company.COMPANY_NAME) ? {} : { publisher: { "@type": "Organization", name: company.COMPANY_NAME } }),
        }}
      />
    </Container>
  );
}
