"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { Badge, Button, Label, RadioCard, RadioGroup, SafetyBanner, Textarea, useToast } from "@duckmate/ui";
import { submitAppeal } from "@/lib/moderation/actions";
import { APPEAL_COPY, categoryLabelOf, sanctionDurationDays } from "@/lib/moderation/constants";
import type { MyModerationState, SubmitAppealResult } from "@/lib/moderation/types";
import { formatDateKo, formatDateTimeKo } from "@/components/profile/format";
import { track } from "./track";

const BODY_MAX = 1000;

function sanctionTitle(level: number, reasonCode: MyModerationState["active"][number]["reasonCode"]): string {
  const days = sanctionDurationDays(level as 1 | 2 | 3 | 4 | 5 | 6);
  const cat = reasonCode ? categoryLabelOf(reasonCode) : "운영정책 위반";
  return level >= 6 ? `영구 이용 제한 · ${cat}` : `${days ?? ""}일 정지 · ${cat}`;
}

export function AppealScreen({ state }: { state: MyModerationState }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const appealable = state.active.filter((s) => s.canAppeal);
  const [sanctionId, setSanctionId] = useState<string | null>(appealable[0]?.id ?? null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitAppealResult | null>(null);
  const appeal = state.appeal;

  const submit = () =>
    start(async () => {
      if (!sanctionId) return;
      setError(null);
      const r = await submitAppeal({ sanctionId, body });
      if (!r.ok) {
        if (r.redirectTo) {
          router.replace(r.redirectTo);
          return;
        }
        setError(r.message);
        toast({ title: r.message, variant: "error" });
        return;
      }
      track("appeal_submitted");
      setSubmitted(r.data);
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="appeal-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/suspended" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">{APPEAL_COPY.title}</h1>
      </header>

      {/* 현재 상태 (합니다체 예외 없이 해요체 유지, 신고자 정보 미노출) */}
      {appeal ? (
        <section className="rounded-lg border border-border bg-card p-4" data-testid="appeal-status">
          <div className="flex items-center gap-2">
            <h2 className="text-h3">접수한 이의신청</h2>
            <Badge variant={appeal.status === "accepted" ? "success" : appeal.status === "rejected" ? "danger" : "info"} size="sm">
              {appeal.status === "pending" ? "검토 중" : appeal.status === "accepted" ? "받아들여짐" : "기각"}
            </Badge>
          </div>
          <p className="tnum text-body-sm mt-1 text-muted-foreground">접수 {formatDateTimeKo(appeal.createdAt)} · 답변 기한 {formatDateTimeKo(appeal.decisionDueAt)}</p>
          {appeal.status === "pending" ? <p className="text-body-sm mt-2">{APPEAL_COPY.slaNotice}</p> : null}
          {appeal.status === "accepted" ? <p className="text-body-sm mt-2">{APPEAL_COPY.accepted}</p> : null}
          {appeal.status === "rejected" ? <p className="text-body-sm mt-2">{APPEAL_COPY.rejected(appeal.decisionNote ?? "")}</p> : null}
        </section>
      ) : null}

      {submitted ? (
        <SafetyBanner variant="info" className="mt-4" title={APPEAL_COPY.submitted}>
          답변 기한 {formatDateTimeKo(submitted.decisionDueAt)}. 검토 중에도 제재는 유지돼요.
        </SafetyBanner>
      ) : appealable.length === 0 ? (
        <SafetyBanner variant="warn" className="mt-4">
          {appeal ? "제재 1건당 1회만 신청할 수 있어요." : state.status === "banned" && state.top?.reasonCode === "MINOR_SUSPECT" ? APPEAL_COPY.minorNotAllowed : APPEAL_COPY.windowClosed}
        </SafetyBanner>
      ) : (
        <section className="mt-4">
          <p className="text-body-sm text-muted-foreground">{APPEAL_COPY.windowNotice}</p>
          <RadioGroup value={sanctionId ?? undefined} onValueChange={setSanctionId} className="mt-3 space-y-2" aria-label="이의신청할 제재">
            {appealable.map((s) => (
              <RadioCard key={s.id} value={s.id} label={sanctionTitle(s.level, s.reasonCode)} description={`시작 ${formatDateKo(s.startsAt)} · 신청 기한 ${formatDateKo(s.appealDeadline)}${s.isAuto ? " · 자동 조치" : ""}`} data-testid={`appeal-sanction-${s.level}`} />
            ))}
          </RadioGroup>
          <div className="mt-4">
            <Label htmlFor="appeal-body" required hint={`${body.length}/${BODY_MAX}`}>
              {APPEAL_COPY.bodyLabel}
            </Label>
            <Textarea id="appeal-body" rows={6} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} invalid={Boolean(error)} placeholder="상황을 구체적으로 적어 주세요. 신고자 정보는 요청해도 알려드릴 수 없어요." data-testid="appeal-body" />
            {error ? <p className="text-caption mt-1 text-destructive">{error}</p> : null}
          </div>
          <p className="text-body-sm mt-3 text-muted-foreground">{APPEAL_COPY.slaNotice}</p>
          <Button className="mt-4 w-full" disabled={!sanctionId || body.trim().length === 0} loading={pending} onClick={submit} data-testid="appeal-submit">
            이의신청 접수하기
          </Button>
        </section>
      )}

      <p className="text-caption mt-6 text-muted-foreground">
        경고·채팅 제한(자동 조치)은 이의신청 대상이 아니에요. 설명이 필요하면 문의(신고·제재)로 남겨 주세요.{" "}
        <Link href="/legal/community" className="text-primary underline underline-offset-4">
          커뮤니티 가이드라인
        </Link>
      </p>
    </div>
  );
}
