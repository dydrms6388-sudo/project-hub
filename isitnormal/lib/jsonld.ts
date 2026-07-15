import { SITE_URL, SITE_NAME } from "@/site.config";

export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function faqLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/**
 * 승격(색인)된 설문에만 Article 부여 (미승인/미승격이면 호출하지 않는다).
 * Review/AggregateRating 은 절대 쓰지 않는다 — 구조화 데이터 스팸(규칙).
 */
export function articleLd(a: { title: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    mainEntityOfPage: abs(a.path),
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function siteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

/**
 * 여러 LD 객체를 하나의 script 문자열로. dangerouslySetInnerHTML에 사용.
 * `<`/`>`/`&`를 이스케이프해 </script> 브레이크아웃(XSS)을 차단한다 — UGC 제목이 색인 페이지에
 * 들어와도 안전하도록.
 */
export function ldJson(...data: object[]): string {
  return JSON.stringify(data.length === 1 ? data[0] : data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
