"use client";

import { useActionState, useRef } from "react";
import { submitAction, type ActionState } from "./actions";

export function SubmitForm() {
  const started = useRef(Date.now());
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    submitAction,
    null,
  );

  return (
    <form action={action} className="card form" id="submit">
      <h2>사연 올리기</h2>
      <p className="muted">
        실명·연락처 등 개인 식별 정보는 쓰지 마세요 — 자동으로 차단됩니다.
      </p>

      <label>
        제목
        <input name="title" required minLength={5} maxLength={80}
          placeholder="예: 결혼식 축의금, 이게 맞나요?" />
      </label>

      <label>
        사연 (100자 이상)
        <textarea name="situation" required minLength={100} maxLength={5000} rows={6}
          placeholder="무슨 일이 있었는지 제3자가 이해할 수 있게 자세히 적어주세요." />
      </label>

      <div className="sides">
        <label>
          A 입장
          <textarea name="sideA" required minLength={10} maxLength={500} rows={3}
            placeholder="한쪽의 주장" />
        </label>
        <label>
          B 입장
          <textarea name="sideB" required minLength={10} maxLength={500} rows={3}
            placeholder="반대쪽의 주장" />
        </label>
      </div>

      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        className="honeypot" />
      <input type="hidden" name="startedAt" value={started.current} />

      <button type="submit" disabled={pending}>
        {pending ? "제출 중…" : "판결 요청"}
      </button>

      {state && (
        <p className={`result result-${state.ok ? "ok" : "no"}`}>
          {state.message}
          {state.stage === "published" && state.slug && (
            <> <a href={`/case/${state.slug}`}>사건 보러 가기 →</a></>
          )}
        </p>
      )}
    </form>
  );
}
