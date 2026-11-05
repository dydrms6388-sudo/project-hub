import { Badge } from "@duckmate/ui";
import type { LegalDoc } from "@/lib/legal";

/** 마크다운 문서 1편: 헤더(시행일·버전·개정 예정)·목차·본문(legal-prose)·하단 안내 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const { meta, toc } = doc;
  return (
    <article className="mt-6" data-testid={`legal-doc-${doc.routeSlug}`}>
      <header className="border-b border-border pb-5">
        <p className="text-label text-primary">법적 고지</p>
        <h1 className="text-h1 mt-1">{meta.title}</h1>
        <dl className="text-body-sm mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
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
        <details className="mt-5 rounded-lg border border-border bg-card p-4" open={toc.length <= 12}>
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

      <div className="legal-prose mt-6" dangerouslySetInnerHTML={{ __html: doc.html }} />

      <footer className="text-body-sm mt-10 rounded-lg bg-muted p-4 text-muted-foreground">
        <p>
          현행 버전 {meta.version} · 시행일 {meta.effective_date}. 이전 버전은 변경 이력 표와 git 태그(<code>legal/{meta.slug}@버전</code>)로 열람할 수 있어요.
        </p>
      </footer>
    </article>
  );
}
