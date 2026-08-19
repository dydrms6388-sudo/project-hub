// =============================================================================
// E4 · /settings/data — 내 데이터 다운로드 [F-PRF-03]
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { DownloadButton } from "./download-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 데이터 다운로드",
  robots: { index: false, follow: false },
};

export default async function DataSettingsPage() {
  await requireOnboardingDone();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/settings" className="text-primary underline underline-offset-2">
          ← 설정
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">내 데이터 다운로드</h1>
        <p className="text-body-sm text-ink-muted">
          내가 등록한 정보를 JSON 파일로 바로 받을 수 있어요.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-body-sm">
          <p className="font-semibold">담기는 것</p>
          <ul className="ml-4 list-disc space-y-1 text-ink-muted">
            <li>계정 정보(이메일·가입일)와 프로필·덕질카드</li>
            <li>선택한 취미와 강도, 궁합 퀴즈 응답</li>
            <li>사진 목록과 검수 상태, 활동 시간대</li>
            <li>차단 목록, 내가 접수한 신고 상태, 나에게 부과된 제재</li>
            <li>알림 설정, 구독 상태</li>
          </ul>
          <p className="mt-2 font-semibold">담기지 않는 것</p>
          <ul className="ml-4 list-disc space-y-1 text-ink-muted">
            <li>
              채팅 메시지 본문 — 상대방의 개인정보가 함께 담기기 때문이에요. 소송 등 정당한 목적의
              대화 사본은 개인정보처리방침 제8조 절차로 신청할 수 있어요.
            </li>
            <li>본인확인 정보(CI)·휴대폰 번호 — 해시로만 보관해 원문이 없어요.</li>
          </ul>
        </CardContent>
      </Card>

      <DownloadButton />

      <p className="text-caption text-ink-muted">
        파일은 서버에 저장하지 않고 이 기기로만 내려받아요. 처리 근거는{" "}
        <Link href="/legal/privacy#제8조" className="text-primary underline underline-offset-2">
          개인정보처리방침 제8조
        </Link>
        에 있어요.
      </p>
    </main>
  );
}
