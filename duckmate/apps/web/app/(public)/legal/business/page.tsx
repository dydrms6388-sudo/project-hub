import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_NAME } from "@/config/company";
import { BusinessBlock } from "@/components/legal/BusinessBlock";
import { LegalTabs } from "@/components/legal/LegalTabs";

export const metadata: Metadata = {
  title: "사업자 정보",
  description: `${SERVICE_NAME}를 운영하는 사업자의 상호·대표자·사업자등록번호·통신판매업 신고번호·주소·고객센터·개인정보보호책임자·청소년보호책임자·호스팅 제공자 표시 항목입니다.`,
  alternates: { canonical: "/legal/business" },
  robots: { index: true, follow: true },
};

export default function BusinessPage() {
  return (
    <>
      <LegalTabs current="/legal/business" />
      <article className="mt-6">
        <header className="pb-5">
          <p className="text-label text-primary">법적 고지</p>
          <h1 className="text-h1 mt-1">사업자 정보</h1>
          <p className="text-body mt-3 text-muted-foreground">
            「전자상거래 등에서의 소비자보호에 관한 법률」 제13조에 따른 표시 항목이에요. 아직 입력되지 않은 항목은 그대로 표시되며 실서비스 전에 채워요.
          </p>
        </header>
        <BusinessBlock />
        <p className="text-body-sm mt-6 text-muted-foreground">
          개인정보 열람·정정·삭제·다운로드는 로그인 후{" "}
          <Link href="/settings/data" className="text-primary underline underline-offset-4">
            설정 &gt; 내 데이터
          </Link>
          에서 직접 할 수 있고, 계정 삭제 절차는{" "}
          <Link href="/account/delete" className="text-primary underline underline-offset-4">
            계정 삭제 안내
          </Link>
          를 참고해 주세요.
        </p>
      </article>
    </>
  );
}
