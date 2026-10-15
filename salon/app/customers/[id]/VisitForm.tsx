"use client";

import { useActionState, useEffect, useRef } from "react";
import { createVisit, type FormState } from "@/app/actions";
import { SubmitButton } from "@/app/components/SubmitButton";
import { VisitFields } from "@/app/components/VisitFields";

export function VisitForm({
  customerId,
  today,
}: {
  customerId: string;
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createVisit, {});
  const formRef = useRef<HTMLFormElement>(null);

  // 저장에 성공하면 다음 예약을 바로 입력할 수 있게 폼을 비운다.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form className="plain card" action={action} ref={formRef} noValidate>
      <input type="hidden" name="customer_id" value={customerId} />
      <VisitFields today={today} dateRequired idPrefix="visit-" />

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="success" role="status">
          예약이 등록되었습니다.
        </p>
      )}

      <SubmitButton pendingLabel="저장 중…">예약 등록</SubmitButton>
    </form>
  );
}
