import Link from "next/link";
import { Badge, BRAND_NAME, Card } from "@duckmate/ui";

/**
 * SafetyPledge (C4 D-2 / §2.1 핵심 섹션 ③) — 안전 약속 4개 + 24h 배지.
 * 카피 원본: 13_company_site.md §2.1. 내부 탐지 룰·임계값은 노출 금지 (D-6).
 */
const PLEDGES = [
  {
    title: "만 19세 미만은 가입할 수 없습니다.",
    body: "가입 시 확인하고, 본인인증에서 다시 확인합니다.",
  },
  {
    title: "본인인증을 마치지 않은 회원끼리는 대화할 수 없습니다.",
    body: "매칭과 채팅은 양쪽 모두 인증을 완료했을 때만 열립니다.",
  },
  {
    title: "모든 신고는 24시간 이내에 처리합니다.",
    body: "긴급한 신고는 1시간 이내에 임시 조치합니다.",
  },
  {
    title: "대화 내용은 들여다보지 않습니다.",
    body: "채팅은 신고가 접수된 경우에만, 처리에 필요한 범위만 보존합니다.",
  },
];

export function SafetyPledge({ withDetailLink = true }: { withDetailLink?: boolean }) {
  return (
    <section id="safety" className="scroll-mt-20 py-14">
      <Badge variant="success">신고 24시간 이내 처리</Badge>
      <h2 className="mt-3 text-h1 text-ink">안전이 성장보다 먼저입니다</h2>
      <p className="mt-3 text-body text-ink-muted">{BRAND_NAME}는 이렇게 약속합니다.</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {PLEDGES.map((p) => (
          <li key={p.title}>
            <Card className="h-full">
              <p className="text-h3 text-ink">{p.title}</p>
              <p className="mt-2 text-body-sm text-ink-muted">{p.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      {withDetailLink && (
        <p className="mt-5 text-body-sm text-ink-muted">
          안전 정책 전문과 처리 절차는{" "}
          <Link href="/safety" className="text-ink underline">
            안전과 신뢰
          </Link>{" "}
          페이지에서 확인하실 수 있습니다.
        </p>
      )}
    </section>
  );
}
