import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_NAME } from "@duckmate/ui";
import { ContactForm } from "@/components/contact-form";
import { COMPANY_URL } from "@/config/site";

export const metadata: Metadata = {
  title: "문의",
  description: `${BRAND_NAME} 제휴·언론·채용·권리침해 문의 창구. 앱 이용 중 신고는 앱 안의 신고 기능을 이용해 주세요.`,
  alternates: { canonical: `${COMPANY_URL}/contact` },
};

export default function ContactPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5">
      <section className="py-14">
        <h1 className="text-display text-ink">문의</h1>
        <p className="mt-4 text-body text-ink-muted">
          서비스 이용, 제휴, 언론 취재, 채용, 권리침해 관련 문의를 받습니다. 남겨주신 이메일로
          회신드립니다.
        </p>

        {/* 신고 채널 안내 — 폼 상단 고정 (C4 §4.1) */}
        <div
          role="note"
          className="mt-6 rounded-2xl bg-warning-tint p-4 text-body-sm text-warning"
        >
          앱 이용 중 발생한 신고는 앱 내 [신고하기]를 이용해 주세요. 앱 내 신고만 24시간 처리
          약속이 적용됩니다. 처리 절차는{" "}
          <Link href="/safety" className="underline">
            안전과 신뢰
          </Link>{" "}
          페이지에 있습니다.
        </div>

        <div className="mt-8">
          <ContactForm />
        </div>

        <p className="mt-8 text-caption text-ink-muted">
          첨부파일은 받지 않습니다. 자료가 필요한 경우 회신 메일로 안내드립니다. 사업자 정보는{" "}
          <Link href="/legal" className="underline">
            법적 고지
          </Link>
          에서 확인하실 수 있습니다.
        </p>
      </section>
    </main>
  );
}
