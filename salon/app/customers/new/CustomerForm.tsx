"use client";

import { useActionState } from "react";
import { createCustomer, type FormState } from "@/app/actions";
import { SubmitButton } from "@/app/components/SubmitButton";
import { VisitFields } from "@/app/components/VisitFields";

export function CustomerForm({ today }: { today: string }) {
  const [state, action] = useActionState<FormState, FormData>(createCustomer, {});

  return (
    <form className="plain" action={action} noValidate>
      <div className="field">
        <label htmlFor="name">이름 *</label>
        <input id="name" name="name" type="text" required maxLength={50} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="phone">연락처 *</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="numeric"
          placeholder="010-0000-0000"
          autoComplete="off"
        />
      </div>

      <VisitFields today={today} />

      <label className="check">
        <input type="checkbox" name="consent_marketing" />
        마케팅 수신 동의 (리터치·이벤트 안내)
      </label>
      <label className="check">
        <input type="checkbox" name="consent_photo" />
        사진 활용 동의
      </label>
      <p className="hint">
        동의는 고객에게 구두로 확인한 뒤 체크해주세요. 마케팅 미동의 고객에게는 리터치
        안내가 발송되지 않습니다.
      </p>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="등록 중…">등록하기</SubmitButton>
    </form>
  );
}
