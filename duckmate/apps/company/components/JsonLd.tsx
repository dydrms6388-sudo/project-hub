/** JSON-LD 1개 출력. 데이터에 플레이스홀더가 섞이면 호출부가 렌더를 생략한다(13_company_site 결정 14). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
