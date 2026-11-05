"use client";

/**
 * /suspended — 제재 레벨별 카피 (12_flows §0-28·§8, lib/moderation/constants SANCTION_COPY 재사용).
 *  level 1 : 경고(확인 필수) → acknowledgeSanction  (게이트 ③ 대상은 아니지만 pendingWarning 이 있으면 여기서도 처리)
 *  level 3~5 : 정지 N일 · 사유 · 해제 일시 · [이의신청](7일 내 1회) · [로그아웃]
 *  level 6 / banned : 영구 · 사유 · [이의신청](미성년 확정은 불가) · 개인정보처리방침 링크
 *  15_auth §0-10: MINOR 는 세션 유지 상태로 이 화면에 온다(로그아웃 버튼 제공).
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, SafetyBanner } from "@duckmate/ui";
import { REPORT_REASONS, type SanctionLevel } from "@duckmate/db";
import { acknowledgeSanction } from "@/lib/moderation/actions";
import { SANCTION_COPY, sanctionDurationDays } from "@/lib/moderation/constants";
import type { MyModerationState } from "@/lib/moderation/types";
import { COPY } from "@/components/onboarding/copy";
import { useActionResult } from "@/components/onboarding/useActionResult";
import { LogoutButton } from "./LogoutButton";

function categoryLabel(code: string | null): string {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? "운영 정책 위반";
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(d);
}

export function SuspendedScreen({ state }: { state: MyModerationState }) {
  const router = useRouter();
  const { handle, run, pending } = useActionResult();
  const top = state.top;
  const level = (top?.level ?? (state.status === "banned" ? 6 : 0)) as SanctionLevel | 0;
  const isPermanent = level === 6 || state.status === "banned";
  const isMinor = top?.isAuto === true && top?.reasonCode === "MINOR_SUSPECT";
  const canAppeal = !isMinor && state.appeal === null && (state.active.find((s) => s.id === top?.id)?.canAppeal ?? false);
  const category = categoryLabel(top?.reasonCode ?? null);

  const copy = level >= 1 && level <= 6 ? SANCTION_COPY[level as SanctionLevel] : null;
  const days = level >= 3 && level <= 5 ? sanctionDurationDays(level as SanctionLevel) : null;
  const headline = isPermanent ? COPY.suspended.bannedHeadline : copy ? copy.title({ categoryLabel: category, endsAt: fmt(top?.endsAt), days: days ?? undefined }) : COPY.suspended.generic;
  const body = (copy?.body ?? "").replace("{category}", category);

  const ack = async () => {
    if (!state.pendingWarning) return;
    const res = await run(() => acknowledgeSanction({ sanctionId: state.pendingWarning?.id }));
    handle(res, { onSuccess: () => router.replace("/home") });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pt-12 pb-8" data-testid={`suspended-${isPermanent ? "permanent" : level}`}>
      <h1 className="text-h1 text-foreground">{headline}</h1>
      <SafetyBanner variant="danger" className="mt-4" title={`${COPY.suspended.reason}: ${category}`}>
        {body || COPY.suspended.bannedSub}
      </SafetyBanner>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
        {top?.endsAt && !isPermanent ? (
          <>
            <dt>{COPY.suspended.endsAt}</dt>
            <dd className="tnum text-foreground">{fmt(top.endsAt)}</dd>
          </>
        ) : null}
        {state.appeal ? (
          <>
            <dt>이의신청</dt>
            <dd>{COPY.suspended.appealed}</dd>
          </>
        ) : null}
      </dl>
      {isMinor ? <p className="mt-2 text-caption text-muted-foreground">{COPY.suspended.minorNote}</p> : null}

      <div className="mt-8 flex flex-col gap-2">
        {state.pendingWarning && level < 3 && !isPermanent ? (
          <Button size="lg" loading={pending} data-testid="sanction-ack" onClick={ack}>
            {COPY.suspended.ack}
          </Button>
        ) : null}
        {canAppeal ? (
          <Button asChild size="lg">
            <Link href="/appeal" data-testid="sanction-appeal">
              {COPY.suspended.appeal}
            </Link>
          </Button>
        ) : null}
        <LogoutButton label={COPY.suspended.logout} size="lg" />
        {isPermanent ? (
          <Link href="/legal/privacy" className="mt-2 text-center text-caption text-muted-foreground underline-offset-4 hover:underline">
            {COPY.suspended.privacy}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
