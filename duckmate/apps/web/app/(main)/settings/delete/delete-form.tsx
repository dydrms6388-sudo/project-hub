"use client";

// =============================================================================
// E4 · 탈퇴 폼 (client)
// 다크패턴 금지: 만류 페이지·혜택 팝업·재확인 반복 없음. 확인 다이얼로그는 1회.
// 사유 선택은 **선택 사항**이며 응답하지 않아도 탈퇴가 진행된다.
// =============================================================================

import * as React from "react";
import Link from "next/link";
import { Button, Dialog, Select } from "@duckmate/ui";
import { deleteMyAccount } from "./actions";

const REASONS = [
  { value: "none", label: "응답하지 않을래요" },
  { value: "no_match", label: "마음에 맞는 상대를 못 찾았어요" },
  { value: "few_recs", label: "추천이 적었어요" },
  { value: "safety", label: "불쾌한 경험이 있었어요" },
  { value: "privacy", label: "개인정보가 걱정돼요" },
  { value: "found_someone", label: "다른 곳에서 만났어요" },
  { value: "other", label: "기타" },
] as const;

export function DeleteForm() {
  const [reason, setReason] = React.useState<string>("none");
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"deleted" | "queued" | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    const res = await deleteMyAccount(reason);
    setPending(false);
    setConfirming(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setResult(res.mode);
  };

  if (result) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <h2 className="text-h2">
          {result === "deleted" ? "탈퇴가 완료됐어요." : "탈퇴 요청을 접수했어요."}
        </h2>
        <p className="text-body-sm text-ink-muted">
          {result === "deleted"
            ? "계정과 회원님이 올린 정보가 파기됐어요. 로그아웃 처리했어요."
            : "접수 즉시 로그아웃했고, 회원님이 올린 정보는 지체 없이 파기해요. 처리 결과는 가입한 이메일로 알려드려요."}
        </p>
        <Link href="/" className="text-body-sm text-primary underline underline-offset-2">
          첫 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-body">떠나는 이유를 알려주실 수 있나요? (선택)</span>
        <span className="text-caption text-ink-muted">
          답하지 않아도 탈퇴는 그대로 진행돼요.
        </span>
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </label>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <Button variant="danger" size="lg" onClick={() => setConfirming(true)}>
        탈퇴하기
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="정말 탈퇴할까요?"
        dismissOnBackdrop={false}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body-sm">
            탈퇴하면 계정과 회원님이 올린 정보(프로필·덕질카드·사진·보낸 메시지)가 지체 없이 파기되고,
            같은 계정으로 되돌릴 수 없어요.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              돌아가기
            </Button>
            <Button variant="danger" loading={pending} onClick={() => void run()}>
              탈퇴하기
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
