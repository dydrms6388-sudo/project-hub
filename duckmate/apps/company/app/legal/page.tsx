import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import { LegalNoticeTable } from "@/components/legal-notice-table";
import { COMPANY_URL, LEGAL_DOCS, WEB_URL } from "@/config/site";

export const metadata: Metadata = {
  title: "법적 고지",
  description: `${BRAND_NAME} 서비스 운영 사업자 정보와 약관·정책 문서 목록을 표시합니다.`,
  alternates: { canonical: `${COMPANY_URL}/legal` },
};

export default function LegalPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5">
      <section className="py-14">
        <h1 className="text-display text-ink">법적 고지</h1>
        <h2 className="mt-10 text-h2 text-ink">사업자 정보</h2>
        <p className="mt-3 text-body text-ink-muted">
          {BRAND_NAME} 서비스는 아래 사업자가 운영합니다. 전자상거래 등에서의 소비자보호에 관한
          법률 및 정보통신망법에 따라 다음 사항을 표시합니다.
        </p>
        <div className="mt-6">
          <LegalNoticeTable />
        </div>
      </section>

      <section className="border-t border-line py-12" aria-labelledby="docs">
        <h2 id="docs" className="text-h2 text-ink">
          약관 및 정책
        </h2>
        <p className="mt-3 text-body text-ink-muted">
          약관·정책의 원문은 서비스 사이트에 게시되며, 개정 시에도 그곳이 최신본입니다. 이 회사
          사이트에는 사본을 두지 않습니다.
        </p>
        <ul className="mt-5 flex flex-col gap-2">
          {LEGAL_DOCS.map((doc) => (
            <li key={doc.path}>
              <a
                href={`${WEB_URL}${doc.path}`}
                className="text-body text-ink underline underline-offset-4"
              >
                {doc.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line py-12" aria-labelledby="notice">
        <h2 id="notice" className="text-h2 text-ink">
          권리침해 신고 및 문의
        </h2>
        <p className="mt-3 text-body text-ink-muted">
          저작권·초상권 등 권리침해 신고, 법적 요청은{" "}
          <Link href="/contact" className="text-ink underline">
            문의
          </Link>{" "}
          페이지의 “권리침해·법적 요청” 유형으로 접수해 주세요. 앱 이용 중 발생한 회원 신고는 앱
          안의 신고 기능을 이용해 주셔야 24시간 처리 약속이 적용됩니다.
        </p>
      </section>
    </main>
  );
}
