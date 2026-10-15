// =============================================================================
// E4 · 제재 목록 + 이의제기 진입 (server component — /appeal 과 /sanctioned 공용)
// =============================================================================

import Link from "next/link";
import { Badge, Card, CardContent } from "@duckmate/ui";
import type { MySanction } from "@duckmate/db";
import { AppealForm } from "./appeal-form";

export const SANCTION_LEVEL: Record<number, { name: string; detail: string }> = {
  1: { name: "경고", detail: "기능 제한은 없어요. 가이드라인을 다시 확인해 주세요." },
  2: {
    name: "기능 제한",
    detail: "새 좋아요·매칭·채팅 발신이 잠시 멈춰요. 기존 대화 열람은 가능해요.",
  },
  3: { name: "일시 정지", detail: "정지 기간 동안 프로필이 노출되지 않아요." },
  4: { name: "장기 정지", detail: "정지 기간 동안 프로필이 노출되지 않아요." },
  5: {
    name: "영구 정지",
    detail: "계정을 다시 이용할 수 없고, 같은 본인확인 정보로는 재가입할 수 없어요.",
  },
};

const APPEAL_STATUS: Record<string, string> = {
  NONE: "이의제기 없음",
  PENDING: "검토 중 (접수 후 7일 이내 결과 안내)",
  ACCEPTED: "인용 — 제재가 취소됐어요",
  REJECTED: "기각",
};

const APPEAL_WINDOW_DAYS = 30;

function withinAppealWindow(sanction: MySanction): boolean {
  const created = new Date(sanction.created_at).getTime();
  return Date.now() - created <= APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function SanctionList({ sanctions }: { sanctions: MySanction[] }) {
  if (sanctions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-6 text-center">
          <p className="text-body">현재 부과된 제재가 없어요.</p>
          <p className="text-body-sm text-ink-muted">
            제재를 받으면 이 화면에서 내용과 기간을 확인하고 이의제기할 수 있어요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {sanctions.map((sanction) => {
        const level = SANCTION_LEVEL[sanction.level];
        const canAppeal =
          sanction.appeal_status === "NONE" &&
          sanction.status !== "REVOKED" &&
          withinAppealWindow(sanction);

        return (
          <li key={sanction.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant={sanction.level >= 3 ? "danger" : "warning"}>
                    {level?.name ?? `제재 ${sanction.level}단계`}
                  </Badge>
                  <Badge variant="neutral">
                    {sanction.status === "ACTIVE"
                      ? "진행 중"
                      : sanction.status === "REVOKED"
                        ? "취소됨"
                        : "종료됨"}
                  </Badge>
                </span>

                <p className="text-body-sm">{level?.detail}</p>
                <dl className="flex flex-col gap-1 text-body-sm text-ink-muted">
                  <div className="flex gap-2">
                    <dt>사유</dt>
                    <dd className="text-ink">{sanction.reason}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>시작</dt>
                    <dd>{new Date(sanction.starts_at).toLocaleString("ko-KR")}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>해제</dt>
                    <dd>
                      {sanction.ends_at
                        ? new Date(sanction.ends_at).toLocaleString("ko-KR")
                        : "기한 없음 (영구)"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>이의제기</dt>
                    <dd>{APPEAL_STATUS[sanction.appeal_status] ?? sanction.appeal_status}</dd>
                  </div>
                </dl>

                <p className="text-caption text-ink-muted">
                  어떤 기준을 어겼는지는{" "}
                  <Link
                    href="/legal/community#제2조"
                    className="text-primary underline underline-offset-2"
                  >
                    커뮤니티 가이드라인 제2조
                  </Link>
                  , 제재 단계는{" "}
                  <Link
                    href="/legal/community#제4조"
                    className="text-primary underline underline-offset-2"
                  >
                    제4조
                  </Link>
                  에 있어요.
                </p>

                {canAppeal ? (
                  <AppealForm sanctionId={sanction.id} />
                ) : sanction.appeal_status === "NONE" ? (
                  <p className="text-body-sm text-ink-muted">
                    이의제기는 통보 후 30일 이내에 제재 건당 1회 접수할 수 있어요.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
