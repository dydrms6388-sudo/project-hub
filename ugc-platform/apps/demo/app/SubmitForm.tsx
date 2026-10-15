"use client";

import { useActionState, useRef } from "react";
import { submitAction, type ActionState } from "./actions";

// React 19: useActionState drives the server action + returns its result.
export function SubmitForm() {
  const started = useRef(Date.now());
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    submitAction,
    null,
  );

  return (
    <form action={action} className="card form">
      <h2>글 작성</h2>

      <label>
        제목
        <input name="title" required minLength={2} maxLength={80} placeholder="제목을 입력하세요" />
      </label>

      <label>
        본문
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          placeholder="10자 이상 입력하세요. 전화번호·주민번호 등 개인정보는 자동 차단됩니다."
        />
      </label>

      {/* honeypot: 사람에겐 안 보이는 필드. 채워지면 봇으로 간주. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="honeypot"
      />
      <input type="hidden" name="startedAt" value={started.current} />

      <button type="submit" disabled={pending}>
        {pending ? "제출 중…" : "제출"}
      </button>

      {state && (
        <p className={`result result-${state.ok ? "ok" : "no"}`}>
          {state.message}
          {state.stage === "published" && state.slug && (
            <>
              {" "}
              <a href={`/case/${state.slug}`}>상세 보기 →</a>
            </>
          )}
        </p>
      )}
    </form>
  );
}
