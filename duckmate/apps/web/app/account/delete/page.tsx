import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@duckmate/ui";
import { SERVICE_NAME } from "@/config/company";
import { LegalFooterBlock } from "@/components/legal/LegalFooterBlock";
import { RETENTION_ITEMS } from "@/components/settings/copy";

/**
 * /account/delete — 스토어 정책용 웹 계정 삭제 URL (09_store_policy 결정 3, 07_legal 결정 21).
 * 비로그인 안내 페이지: 절차 + 보존 항목 + [로그인하고 삭제 진행] → /login?next=/settings/data/delete. noindex.
 */
export const metadata: Metadata = {
  title: "계정 삭제 안내",
  description: `${SERVICE_NAME} 계정을 삭제하는 방법과 삭제 후 보관되는 항목을 안내합니다.`,
  robots: { index: false, follow: false },
};

const STEPS = [
  "휴대폰 번호로 로그인해요 (앱 또는 웹).",
  "설정 › 내 데이터 › 계정 삭제 로 이동해요 (2탭).",
  "안내를 확인하고 [탈퇴하기]를 누르면 바로 로그아웃돼요.",
  "7일 안에 다시 로그인하면 삭제가 취소돼요. 7일이 지나면 완전히 삭제돼요.",
];

export default function AccountDeletePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-safe">
      <header className="flex h-14 items-center">
        <Link href="/" className="text-label font-bold text-primary">
          {SERVICE_NAME}
        </Link>
      </header>
      <main id="main" className="flex-1 pb-10" data-testid="account-delete-page">
        <p className="text-label mt-4 text-primary">계정</p>
        <h1 className="text-h1 mt-1">계정 삭제 안내</h1>
        <p className="text-body mt-3 text-muted-foreground">계정 삭제는 앱 안에서 직접 할 수 있어요. 별도 문의 없이 아래 순서대로 진행돼요.</p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground" aria-hidden="true">
                {i + 1}
              </span>
              <span className="text-body">{s}</span>
            </li>
          ))}
        </ol>

        <Button asChild className="mt-6 w-full">
          <Link href="/login?next=/settings/data/delete">로그인하고 삭제 진행하기</Link>
        </Button>

        <section className="mt-8">
          <h2 className="text-h3">삭제 후에도 보관되는 항목</h2>
          <p className="text-body-sm mt-1 text-muted-foreground">법령과 분쟁 대응을 위해 아래 항목은 개인을 식별할 수 없는 형태로 보관돼요. 그 외 프로필·사진·매칭·대화는 모두 삭제돼요.</p>
          <ul className="mt-3 space-y-2">
            {RETENTION_ITEMS.map((r) => (
              <li key={r.label} className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2 text-body-sm">
                <span>{r.label}</span>
                <span className="tnum shrink-0 text-muted-foreground">{r.period}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm mt-3 text-muted-foreground">
            자세한 내용은{" "}
            <Link href="/legal/privacy" className="text-primary underline underline-offset-4">
              개인정보처리방침
            </Link>
            을 확인해 주세요. 로그인이 어려우면 사업자 정보의 개인정보보호책임자 이메일로 요청할 수 있어요(10일 이내 처리).
          </p>
        </section>
      </main>
      <LegalFooterBlock compact />
    </div>
  );
}
