"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { REPORT_DETAIL_MAX, type Enums } from "@duckmate/db";
import { Button, Checkbox, Label, RadioCard, RadioGroup, SafetyBanner, Textarea, cn, useToast } from "@duckmate/ui";
import { blockProfile, submitReport } from "@/lib/moderation/actions";
import { REPORT_CATEGORIES, REPORT_COPY, categoryOf, reasonMeta, type ReportCategoryKey } from "@/lib/moderation/constants";
import type { SubmitReportResult } from "@/lib/moderation/types";
import { track } from "@/lib/analytics/track";
import { formatDateTimeKo } from "@/components/profile/format";
import { afterReportHref, type ReportParams } from "./params";

export type ReportContext = {
  nickname: string | null;
  recentMessages: Array<{ id: string; text: string; isMine: boolean; at: string }>;
  evidenceCount: number;
};

type Step = 1 | 2 | "done";

/** 서버 액션 주입점 — 기본은 실제 액션. 개발 목 라우트(/dev/profile?screen=report)·테스트가 목을 넘긴다 (G1) */
export type ReportActions = { submitReport: typeof submitReport; blockProfile: typeof blockProfile };
const REAL_ACTIONS: ReportActions = { submitReport, blockProfile };

export function ReportScreen({ params, context, actions = REAL_ACTIONS }: { params: ReportParams; context: ReportContext; actions?: ReportActions }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const targetId = params.targetId as string;
  const [category, setCategory] = useState<ReportCategoryKey | null>(params.presetReason ? categoryOf(params.presetReason) : null);
  const [step, setStep] = useState<Step>(params.presetReason ? 2 : 1);
  const [reason, setReason] = useState<Enums["report_reason"] | null>(params.presetReason);
  const [detail, setDetail] = useState("");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitReportResult | null>(null);
  const [blockChecked, setBlockChecked] = useState(true);

  useEffect(() => {
    track("report_opened", { surface: params.surface, preset: Boolean(params.presetReason) });
  }, [params.surface, params.presetReason]);

  const cat = REPORT_CATEGORIES.find((c) => c.key === category) ?? null;
  const meta = reason ? reasonMeta(reason) : null;
  const detailRequired = Boolean(meta?.requiresDetail);
  const canSubmit = Boolean(reason) && (!detailRequired || detail.trim().length > 0) && detail.length <= REPORT_DETAIL_MAX;

  const submit = () =>
    start(async () => {
      if (!reason) return;
      setDetailError(null);
      const r = await actions.submitReport({ targetId, matchId: params.matchId, reasonCode: reason, detail: detail.trim() || null, surface: params.surface });
      if (!r.ok) {
        if (r.redirectTo) {
          router.replace(r.redirectTo);
          return;
        }
        if (r.field === "detail") setDetailError(r.message);
        toast({ title: r.code === "INTERNAL" ? REPORT_COPY.failed : r.message, variant: "error" });
        return;
      }
      track("report_submitted", { reason_code: reason, surface: params.surface, deduped: r.data.deduped });
      setResult(r.data);
      setBlockChecked(r.data.done.blockDefaultChecked);
      setStep("done");
    });

  const finish = () =>
    start(async () => {
      if (blockChecked) {
        const b = await actions.blockProfile({ targetId });
        if (!b.ok) {
          if (b.redirectTo) {
            router.replace(b.redirectTo);
            return;
          }
          toast({ title: b.message, variant: "error" });
          return;
        }
        track("block_submitted", { surface: params.surface, from: "report_done" });
      }
      router.replace(afterReportHref(params.surface));
      router.refresh();
    });

  const close = () => router.back();

  if (step === "done" && result) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-safe" data-testid="report-done">
        <header className="flex h-14 items-center" />
        <div className="flex-1">
          <h1 className="text-h1 mt-6">{result.done.title}</h1>
          <p className="text-body mt-3">{result.done.sla}</p>
          <p className="text-body text-muted-foreground">{result.done.notify}</p>
          {result.done.message ? <p className="text-body-sm mt-2 text-muted-foreground">{result.done.message}</p> : null}
          <p className="text-body-sm mt-2 text-muted-foreground">증거는 자동으로 첨부됐어요. 신고한 사실은 상대에게 알리지 않아요.</p>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <Checkbox id="block-too" checked={blockChecked} onCheckedChange={(v) => setBlockChecked(v === true)} data-testid="report-block-check" />
            <div>
              <Label htmlFor="block-too" className="text-body">
                {result.done.blockCheckbox}
              </Label>
              <p className="text-caption mt-0.5 text-muted-foreground">{result.done.blockHint}</p>
            </div>
          </div>
        </div>
        <Button className="mt-6 w-full" onClick={finish} loading={pending} data-testid="report-finish">
          {REPORT_COPY.done.cta}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-safe" data-testid="report-screen">
      <header className="flex h-14 items-center gap-2">
        {step === 1 ? (
          <button type="button" onClick={close} aria-label="닫기" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
            <X size={24} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={() => setStep(1)} aria-label="이전" className="flex size-11 items-center justify-center rounded-md hover:bg-muted" data-testid="report-back">
            <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        <h1 className="text-h2 flex-1">{REPORT_COPY.title}</h1>
        <span className="tnum text-body-sm text-muted-foreground">{step}/2</span>
      </header>

      {step === 1 ? (
        <div className="flex-1">
          <h2 className="text-h3 mt-2">{REPORT_COPY.step1Question}</h2>
          {context.nickname ? <p className="text-body-sm mt-1 text-muted-foreground">대상: {context.nickname}</p> : null}
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {REPORT_CATEGORIES.map((c, i) => (
              <li key={c.key}>
                <button
                  type="button"
                  className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted", category === c.key && "bg-violet-50 dark:bg-secondary")}
                  onClick={() => {
                    setCategory(c.key);
                    setReason(null);
                    setStep(2);
                  }}
                  data-testid={`report-category-${i + 1}`}
                >
                  <span className="text-body flex-1">{c.label}</span>
                  <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-body-sm mt-5 flex gap-2 text-muted-foreground">
            <Info size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
            {REPORT_COPY.snapshotNotice}
          </p>
        </div>
      ) : (
        <div className="flex-1">
          <h2 className="text-h3 mt-2">{cat?.label}</h2>
          <RadioGroup value={reason ?? undefined} onValueChange={(v) => setReason(v as Enums["report_reason"])} className="mt-4 space-y-2" aria-label="세부 사유">
            {(cat?.codes ?? []).map((code) => {
              const m = reasonMeta(code);
              return <RadioCard key={code} value={code} label={m.label} description={m.description} data-testid={`report-reason-${code}`} />;
            })}
          </RadioGroup>

          <div className="mt-5">
            <Label htmlFor="detail" required={detailRequired} hint={`${detail.length}/${REPORT_DETAIL_MAX}`}>
              {detailRequired ? "자세히 (필수, 500자)" : REPORT_COPY.detailLabel}
            </Label>
            <Textarea id="detail" rows={4} maxLength={REPORT_DETAIL_MAX} value={detail} onChange={(e) => setDetail(e.target.value)} invalid={Boolean(detailError)} placeholder={detailRequired ? REPORT_COPY.detailRequiredForOther : "언제, 어떤 일이 있었는지 적어 주시면 더 빨리 확인할 수 있어요"} data-testid="report-detail" />
            {detailError ? <p className="text-caption mt-1 text-destructive">{detailError}</p> : null}
          </div>

          <SafetyBanner variant="info" className="mt-5" title={REPORT_COPY.evidenceNotice}>
            {params.matchId ? `최근 메시지 ${context.evidenceCount}개와 프로필·사진이 운영팀에만 전달돼요.` : "프로필·사진이 운영팀에만 전달돼요."}
            {context.recentMessages.length > 0 ? (
              <ul className="mt-2 space-y-1 rounded-md bg-card/70 p-2" aria-label="첨부될 최근 메시지 미리보기" data-testid="report-evidence-preview">
                {context.recentMessages.map((m) => (
                  <li key={m.id} className="text-caption flex gap-2">
                    <span className="tnum shrink-0 text-muted-foreground">{formatDateTimeKo(m.at)}</span>
                    <span className="truncate">
                      <span className="text-muted-foreground">{m.isMine ? "나" : context.nickname ?? "상대"}: </span>
                      {m.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SafetyBanner>

          <Button className="mt-6 w-full" variant="destructive" disabled={!canSubmit} loading={pending} onClick={submit} data-testid="report-submit">
            {REPORT_COPY.submit}
          </Button>
        </div>
      )}
    </div>
  );
}
