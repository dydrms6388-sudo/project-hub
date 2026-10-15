// =============================================================================
// E4 · /verify — 인증 레벨 안내 + 승급 [F-ONB-03]
// 게이트에 막힌 모든 지점(좋아요 한도·채팅 진입·데이팅 전환)이 도착하는 단일 화면.
// ?required=n 컨텍스트 문구 / ?status=... (Stub 콜백 결과) 처리.
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardContent, VerifyLevelBadge } from "@duckmate/ui";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { VerifyStart } from "./verify-start";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "본인인증",
  robots: { index: false, follow: false },
};

const LEVELS = [
  {
    level: 0 as const,
    label: "미인증",
    how: "가입 직후 상태",
    can: "프로필 작성",
  },
  {
    level: 1 as const,
    label: "휴대폰 인증",
    how: "가입 과정의 SMS 인증 (번호 1개 = 계정 1개)",
    can: "추천 탐색, 좋아요 하루 3회",
  },
  {
    level: 2 as const,
    label: "본인 인증",
    how: "PASS 등 본인확인 (이름·주민번호 원문은 저장하지 않아요)",
    can: "매칭·채팅, 데이팅 모드, 좋아요 제한 해제",
  },
  {
    level: 3 as const,
    label: "사진 인증",
    how: "얼굴이 나온 사진 1장 검수 승인",
    can: "인증 뱃지 표시, 추천 우선 노출",
  },
];

const REQUIRED_CONTEXT: Record<string, string> = {
  "2": "매칭·채팅과 데이팅 모드는 양쪽 모두 본인인증을 마쳐야 열려요.",
  "3": "이 기능은 사진 인증(Lv3)까지 마친 회원만 이용할 수 있어요.",
};

const STATUS_MESSAGE: Record<string, { text: string; tone: "success" | "danger" }> = {
  success: { text: "본인인증이 완료됐어요.", tone: "success" },
  CI_ALREADY_REGISTERED: {
    text: "이미 다른 계정에 등록된 본인 정보예요. 한 사람당 계정 1개만 만들 수 있어요.",
    tone: "danger",
  },
  CI_BLOCKED: { text: "이용이 제한된 정보예요.", tone: "danger" },
  UNDERAGE: { text: "만 19세 이상만 이용할 수 있어요.", tone: "danger" },
  VERIFY_FAILED: { text: "본인인증에 실패했어요. 다시 시도해 주세요.", tone: "danger" },
  VERIFIER_NOT_CONFIGURED: {
    text: "본인인증 기관 연동이 준비 중이에요.",
    tone: "danger",
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireOnboardingDone();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const required = one(sp.required);
  const status = STATUS_MESSAGE[one(sp.status)];

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6 text-ink">
      <nav className="text-body-sm">
        <Link href="/me" className="text-primary underline underline-offset-2">
          ← 내 프로필
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-h1">본인인증</h1>
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-ink-muted">현재 상태</span>
          <VerifyLevelBadge level={profile.verify_level} />
        </div>
        {REQUIRED_CONTEXT[required] && (
          <p className="rounded-xl bg-primary-tint px-4 py-3 text-body-sm text-primary-tint-fg">
            {REQUIRED_CONTEXT[required]}
          </p>
        )}
        {status && (
          <p
            role="status"
            className={
              status.tone === "success"
                ? "rounded-xl bg-success-tint px-4 py-3 text-body-sm text-success"
                : "rounded-xl bg-danger-tint px-4 py-3 text-body-sm text-danger"
            }
          >
            {status.text}
          </p>
        )}
      </header>

      <section aria-label="인증 레벨" className="flex flex-col gap-3">
        {LEVELS.map((item) => (
          <Card key={item.level}>
            <CardContent className="flex flex-col gap-1 py-4">
              <span className="flex items-center gap-2">
                <VerifyLevelBadge level={item.level} />
                {profile.verify_level >= item.level && <Badge variant="success">완료</Badge>}
              </span>
              <span className="text-body-sm text-ink-muted">승급 방법 · {item.how}</span>
              <span className="text-body-sm">할 수 있는 것 · {item.can}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      {profile.verify_level < 2 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">본인인증하고 매칭 열기</h2>
          <p className="text-body-sm text-ink-muted">
            본인확인기관에서 받은 정보 중 <strong>연계정보(CI)와 휴대폰 번호는 해시로만</strong>{" "}
            보관하고, 이름·주민등록번호 원문은 저장하지 않아요. 생년월일은 가입 시 입력한 값과
            대조해요.
          </p>
          <VerifyStart />
          <p className="text-caption text-ink-muted">
            자세한 처리 내용은{" "}
            <Link href="/legal/privacy" className="text-primary underline underline-offset-2">
              개인정보처리방침
            </Link>
            과{" "}
            <Link href="/legal/terms#제7조" className="text-primary underline underline-offset-2">
              이용약관 제7조
            </Link>
            에 있어요.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <p className="text-body">본인인증이 끝났어요. 매칭·채팅과 데이팅 모드를 모두 쓸 수 있어요.</p>
          {profile.verify_level < 3 && (
            <p className="text-body-sm text-ink-muted">
              사진 인증 뱃지를 원하면{" "}
              <Link href="/me/photos" className="text-primary underline underline-offset-2">
                사진 관리
              </Link>
              에서 얼굴이 나온 사진을 올려 주세요. 사진 없이도 전 기능을 이용할 수 있어요.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
