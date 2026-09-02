import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SERVICE_NAME } from "@/config/company";
import { LEGAL_DOCS, LEGAL_ROUTE_SLUGS, loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "법적 고지",
  description: `${SERVICE_NAME} 이용약관·개인정보처리방침·위치정보 이용약관·청소년보호정책·커뮤니티 가이드라인·환불정책·사업자 정보.`,
  alternates: { canonical: "/legal" },
};

export default function LegalIndexPage() {
  const items = LEGAL_ROUTE_SLUGS.map((slug) => ({ slug, def: LEGAL_DOCS[slug], doc: loadLegalDoc(slug) }));
  return (
    <div className="mt-4">
      <h1 className="text-h1">법적 고지</h1>
      <p className="text-body mt-2 text-muted-foreground">{SERVICE_NAME}를 이용하기 전에 확인할 수 있는 문서예요. 로그인 없이 누구나 볼 수 있어요.</p>
      <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
        {items.map(({ slug, def, doc }) => (
          <li key={slug}>
            <Link href={`/legal/${slug}`} className="flex items-center gap-3 px-4 py-4 hover:bg-muted">
              <span className="flex-1">
                <span className="text-body block font-medium">{def.label}</span>
                <span className="text-caption tnum mt-0.5 block text-muted-foreground">
                  v{doc.meta.version} · 시행 {doc.meta.effective_date}
                </span>
              </span>
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <Link href="/legal/business" className="flex items-center gap-3 px-4 py-4 hover:bg-muted">
            <span className="flex-1">
              <span className="text-body block font-medium">사업자 정보</span>
              <span className="text-caption mt-0.5 block text-muted-foreground">전자상거래법 제13조 표시 항목</span>
            </span>
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
          </Link>
        </li>
      </ul>
    </div>
  );
}
