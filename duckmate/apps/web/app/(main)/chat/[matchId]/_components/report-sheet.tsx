"use client";

// =============================================================================
// E3 · 신고 시트 [F-SAF-01] (12_flows §6 — 라우트가 아니라 모달)
//
// 4단: ① 카테고리 9 → ② reason_code 18 → ③ 상세(기타는 필수) → ④ 접수 확인.
//   - match_id 를 함께 보내면 서버가 대화 스냅샷(원문)을 evidence 로 자동 첨부한다
//     (A5 §4.2). 화면은 그 사실을 고지만 한다.
//   - ④ 는 24h SLA 안내 + "신고 사실은 상대에게 알리지 않아요" + 차단 원클릭.
//   - CONTENT_SELF_HARM 은 제재가 아니라 **보호 프로토콜** → ④ 대신 상담 리소스
//     안내(109)로 분기한다 [F-SAF-08].
// 접근성: @duckmate/ui Dialog(네이티브 <dialog>) = ESC·포커스 트랩·닫기 버튼 내장.
//   단계 전환 시 첫 컨트롤로 포커스를 옮기고, 닫으면 호출부가 트리거로 되돌린다.
// =============================================================================

import * as React from "react";
import { Button, Dialog, Textarea } from "@duckmate/ui";
import type { ReasonCode } from "@duckmate/db";
import { blockUser, submitReport } from "@/lib/moderation/actions";
import {
  REPORT_CATEGORIES,
  categoryOfCode,
  type ReasonCategory,
} from "./report-taxonomy";

type Step = "category" | "reason" | "detail" | "done" | "selfharm";

export interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  matchId: string;
  partnerNickname: string;
  /** 안전 카드에서 열었을 때의 프리필 사유 */
  prefillCode?: ReasonCode | null;
  /** 차단까지 마쳤을 때 (호출부가 목록으로 보낸다) */
  onBlocked: () => void;
}

const MAX_DETAIL = 1000;

export function ReportSheet({
  open,
  onClose,
  targetId,
  matchId,
  partnerNickname,
  prefillCode,
  onBlocked,
}: ReportSheetProps) {
  const [step, setStep] = React.useState<Step>("category");
  const [category, setCategory] = React.useState<ReasonCategory | null>(null);
  const [code, setCode] = React.useState<ReasonCode | null>(null);
  const [detail, setDetail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const stepRef = React.useRef<HTMLDivElement>(null);

  // 열릴 때 초기화(+ 안전 카드 프리필이면 ③ 상세부터 시작)
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setDetail("");
    if (prefillCode) {
      setCode(prefillCode);
      setCategory(categoryOfCode(prefillCode) ?? null);
      setStep("detail");
    } else {
      setCode(null);
      setCategory(null);
      setStep("category");
    }
  }, [open, prefillCode]);

  // 단계가 바뀌면 첫 컨트롤로 포커스 이동
  React.useEffect(() => {
    if (!open) return;
    const first = stepRef.current?.querySelector<HTMLElement>(
      "button, [href], textarea, input, select",
    );
    first?.focus();
  }, [open, step]);

  function submit() {
    if (!code) return;
    const trimmed = detail.trim();
    if (code === "OTHER" && trimmed.length < 5) {
      setError("기타 사유는 상세 내용을 5자 이상 적어 주세요.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await submitReport({
        targetId,
        matchId,
        reasonCode: code,
        detail: trimmed.length > 0 ? trimmed : null,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setStep(code === "CONTENT_SELF_HARM" ? "selfharm" : "done");
    });
  }

  function block() {
    startTransition(async () => {
      const res = await blockUser({ targetId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onBlocked();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissOnBackdrop={step !== "done" && step !== "selfharm"}
      title={
        step === "done"
          ? "접수됐어요"
          : step === "selfharm"
            ? "혼자 두지 않을게요"
            : "신고하기"
      }
    >
      <div ref={stepRef} className="flex flex-col gap-3" data-testid="chat-report-sheet" data-step={step}>
        {step === "category" ? (
          <>
            <p className="text-body-sm text-ink-muted">어떤 문제인가요?</p>
            <ul className="flex flex-col gap-2">
              {REPORT_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    data-testid="chat-report-category"
                    data-category={c.id}
                    onClick={() => {
                      setCategory(c);
                      const only = c.options.length === 1 ? c.options[0] : undefined;
                      if (only) {
                        setCode(only.code);
                        setStep("detail");
                      } else {
                        setCode(null);
                        setStep("reason");
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-body text-ink hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-ink-muted">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {step === "reason" && category ? (
          <>
            <p className="text-body-sm text-ink-muted">{category.label} — 조금 더 알려주세요</p>
            <ul className="flex flex-col gap-2">
              {category.options.map((o) => (
                <li key={o.code}>
                  <button
                    type="button"
                    data-testid="chat-report-reason"
                    data-code={o.code}
                    onClick={() => {
                      setCode(o.code);
                      setStep("detail");
                    }}
                    className="w-full rounded-xl border border-line px-4 py-3 text-left text-body text-ink hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="md" onClick={() => setStep("category")}>
              뒤로
            </Button>
          </>
        ) : null}

        {step === "detail" && code ? (
          <>
            <p className="text-body-sm text-ink-muted">
              상황을 적어 주세요{code === "OTHER" ? " (기타는 필수예요)" : " (선택)"}
            </p>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={MAX_DETAIL}
              invalid={Boolean(error)}
              aria-label="신고 상세 내용"
              aria-describedby="report-detail-help"
              data-testid="chat-report-detail"
            />
            <p id="report-detail-help" className="text-caption text-ink-muted">
              이 대화의 내용은 검토를 위해 자동으로 함께 첨부돼요. 신고 사실은 상대에게 알리지
              않아요.
            </p>
            {error ? (
              <p role="alert" className="text-body-sm text-danger" data-testid="chat-report-error">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="lg"
                loading={pending}
                onClick={submit}
                data-testid="chat-report-submit"
              >
                접수하기
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setStep(prefillCode ? "category" : category ? "reason" : "category")}
                disabled={pending}
              >
                뒤로
              </Button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <p className="text-body">
              24시간 이내에 검토·조치하고 결과를 알려드려요. 신고 사실은 상대에게 알리지 않아요.
            </p>
            <p className="text-body-sm text-ink-muted">
              {partnerNickname}님은 추천·목록에서 자동으로 숨겨져요.
            </p>
            {error ? (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="lg"
                loading={pending}
                onClick={block}
                data-testid="chat-report-block"
              >
                이 상대 차단하기
              </Button>
              <Button variant="ghost" size="md" onClick={onClose} disabled={pending}>
                닫기
              </Button>
            </div>
          </>
        ) : null}

        {step === "selfharm" ? (
          // A5 §2: CONTENT_SELF_HARM 은 제재 파이프라인이 아니라 보호 파이프라인
          <>
            <p className="text-body">
              알려 주셔서 고마워요. 지금 힘든 마음이 든다면 혼자 견디지 않아도 돼요.
            </p>
            <ul className="flex flex-col gap-1 text-body-sm text-ink-muted">
              <li>자살예방 상담전화 109 (24시간, 무료)</li>
              <li>정신건강 상담전화 1577-0199</li>
            </ul>
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" onClick={onClose} data-testid="chat-report-close">
                닫기
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
