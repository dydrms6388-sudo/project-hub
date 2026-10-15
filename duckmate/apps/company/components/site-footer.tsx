import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import { company, display } from "@/config/company";
import { LEGAL_DOCS, WEB_URL } from "@/config/site";

/**
 * SiteFooter (C4 D-2 / §3.3) — 사업자 정보 요약 1줄은 `config/company.ts` 자동 렌더,
 * 약관 6종은 apps/web 원문으로 링크만 한다(사본 게시 금지).
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-line bg-surface-raised">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/" className="text-body-sm text-ink hover:underline">
            회사 소개
          </Link>
          <Link href="/safety" className="text-body-sm text-ink hover:underline">
            안전과 신뢰
          </Link>
          <Link href="/legal" className="text-body-sm text-ink hover:underline">
            법적 고지
          </Link>
          <Link href="/contact" className="text-body-sm text-ink hover:underline">
            문의
          </Link>
        </div>

        <div>
          <p className="text-caption text-ink-muted">약관 및 정책 (서비스 사이트에 게시)</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {LEGAL_DOCS.map((doc) => (
              <li key={doc.path}>
                <a
                  href={`${WEB_URL}${doc.path}`}
                  className="text-caption text-ink-muted hover:text-ink hover:underline"
                >
                  {doc.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line pt-6 text-caption leading-5 text-ink-muted">
          <p>
            {display(company.legalName)} · 대표 {display(company.ceoName)} · 사업자등록번호{" "}
            {display(company.bizRegNo)}
          </p>
          <p className="mt-1">
            사업자 정보 전문은{" "}
            <Link href="/legal" className="underline">
              법적 고지
            </Link>
            에서 확인하실 수 있습니다.
          </p>
          <p className="mt-3">
            © {year} {BRAND_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
