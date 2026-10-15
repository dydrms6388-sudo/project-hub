// =============================================================================
// E4 · /settings/delete — 탈퇴 [F-PRF-03] (12_flows §5.3)
//
// 규약: 설정(1) → 탈퇴(2) = 2뎁스로 끝. 화면 1장에서 ① 파기 안내 ② 사유(선택)
// ③ 탈퇴 버튼 + 확인 다이얼로그 1회. 만류 화면·혜택 팝업·재확인 반복 금지.
// 데이터 다운로드 버튼을 탈퇴 확인 **전에** 노출한다 (08_legal_docs §4-E4-6).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, CardContent } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { DeleteForm } from "./delete-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "탈퇴하기",
  robots: { index: false, follow: false },
};

export default async function DeleteAccountPage() {
  await requireOnboardingDone();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">탈퇴하기</h1>
        <p className="text-body-sm text-ink-muted">
          탈퇴하면 어떤 정보가 어떻게 처리되는지 먼저 확인해 주세요.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 text-body-sm">
          <div>
            <p className="font-semibold">지체 없이 파기하는 것</p>
            <ul className="ml-4 list-disc space-y-1 text-ink-muted">
              <li>계정, 프로필·덕질카드, 취미·퀴즈 응답, 사진</li>
              <li>회원님이 보낸 메시지 본문</li>
              <li>활동 지역 코드, 알림 설정</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">법령·안전상 남는 것</p>
            <ul className="ml-4 list-disc space-y-1 text-ink-muted">
              <li>신고가 접수된 대화의 증거 스냅샷 — 분쟁 종결 후 1년</li>
              <li>전자상거래법상 거래·결제 기록 — 법정 보존기간</li>
              <li>영구정지 이력이 있는 경우 재가입 차단용 해시(원문 아님)</li>
              <li>상대방 화면에 남은 대화 사본 — 상대가 탈퇴할 때까지</li>
            </ul>
          </div>
          <p className="text-caption text-ink-muted">
            자세한 기준은{" "}
            <Link href="/legal/privacy#제3조" className="text-primary underline underline-offset-2">
              개인정보처리방침 제3조
            </Link>
            에 있어요.
          </p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3">떠나기 전에 내 데이터를 받아둘 수 있어요</h2>
        <Link href="/settings/data">
          <Button variant="ghost">내 데이터 다운로드</Button>
        </Link>
      </section>

      <DeleteForm />
    </main>
  );
}
