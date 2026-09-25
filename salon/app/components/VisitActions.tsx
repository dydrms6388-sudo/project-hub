"use client";

import { useActionState } from "react";
import { completeVisit, undoCompleteVisit, type FormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

/** 오늘 예약 카드의 "시술 완료" / "완료 취소" 버튼 */
export function VisitActions({
  visitId,
  completed,
}: {
  visitId: string;
  completed: boolean;
}) {
  const action = completed ? undoCompleteVisit : completeVisit;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  return (
    <div className="stack" style={{ alignItems: "flex-end" }}>
      <form className="plain" action={formAction}>
        <input type="hidden" name="visit_id" value={visitId} />
        {completed ? (
          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
            완료 취소
          </SubmitButton>
        ) : (
          <SubmitButton className="btn" pendingLabel="처리 중…">
            시술 완료
          </SubmitButton>
        )}
      </form>
      {state.error && (
        <span className="error error-inline" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}
