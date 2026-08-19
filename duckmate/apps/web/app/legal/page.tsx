// =============================================================================
// E4 · /legal — 법적 문서 6종 목록 (공식 페이지 = index 허용, UGC noindex 대상 아님)
// 진입: 설정 → 약관·정책, 가입 동의, 구독 관리(환불정책 1탭), 제재 통보 화면.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardContent } from "@duckmate/ui";
import { LEGAL_DOC_SUMMARY, listLegalDocs } from "@/lib/legal/documents";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "약관 및 정책",
  description:
    "덕메이트 이용약관·개인정보처리방침·위치정보 이용약관·청소년보호정책·커뮤니티 가이드라인·환불정책 전문.",
  robots: { index: true, follow: true },
};

export default async function LegalIndexPage() {
  const docs = await listLegalDocs();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 text-ink">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1">약관 및 정책</h1>
        <p className="text-body-sm text-ink-muted">
          서비스 이용의 기준이 되는 문서 6종입니다. 조항 번호로 바로 이동할 수 있어요.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {docs.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/legal/${doc.slug}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Card>
                <CardContent className="flex flex-col gap-1 py-4">
                  <span className="flex items-center gap-2">
                    <span className="text-h3">{doc.title}</span>
                    {doc.draft && <Badge variant="warning">검토 전 초안</Badge>}
                  </span>
                  <span className="text-body-sm text-ink-muted">{LEGAL_DOC_SUMMARY[doc.slug]}</span>
                  <span className="text-caption text-ink-muted">
                    v{doc.version} · 시행일 {doc.effectiveDateLabel}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-caption text-ink-muted">
        문서에 표시된 수치(신고 처리 24시간, 연락처 공개 72시간, 이의제기 30일 등)는 실제 서비스 운영
        기준과 동일합니다.
      </p>
    </main>
  );
}
