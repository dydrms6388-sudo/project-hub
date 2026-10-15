"use client";

// =============================================================================
// E4 · 본인인증 시작 버튼 (client) — /api/auth/verify-identity 연결
//  · action:"request" → PortOne 인증창 redirectUrl 이 오면 이동,
//    Stub(개발/E2E) 경로면 token 을 그대로 confirm 으로 되돌려 승급 처리.
//  · 실연동(PASS/다날)은 Phase 4 — 미구성이면 503 VERIFIER_NOT_CONFIGURED 안내.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@duckmate/ui";

interface VerifyResponse {
  ok?: boolean;
  code?: string;
  message?: string;
  verifier?: "portone" | "stub";
  redirectUrl?: string;
  token?: string;
}

const MESSAGES: Record<string, string> = {
  VERIFIER_NOT_CONFIGURED:
    "본인인증 기관 연동이 아직 준비 중이에요. 준비되면 이 화면에서 바로 인증할 수 있어요.",
  CI_ALREADY_REGISTERED: "이미 다른 계정에 등록된 본인 정보예요. 한 사람당 계정 1개만 만들 수 있어요.",
  CI_BLOCKED: "이용이 제한된 정보예요. 문의가 필요하면 이의제기로 알려주세요.",
  PHONE_BLOCKED: "이용이 제한된 번호예요. 문의가 필요하면 이의제기로 알려주세요.",
  UNDERAGE: "만 19세 이상만 이용할 수 있어요.",
  VERIFY_FAILED: "본인인증에 실패했어요. 잠시 후 다시 시도해 주세요.",
  AUTH_REQUIRED: "로그인이 필요해요.",
};

export function VerifyStart({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      const requestRes = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      const requested = (await requestRes.json()) as VerifyResponse;

      if (!requestRes.ok || requested.ok === false) {
        setError(MESSAGES[requested.code ?? ""] ?? requested.message ?? "인증을 시작하지 못했어요.");
        setPending(false);
        return;
      }

      if (requested.redirectUrl) {
        window.location.href = requested.redirectUrl;
        return;
      }

      const confirmRes = await fetch("/api/auth/verify-identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm", payload: { token: requested.token ?? "" } }),
      });
      const confirmed = (await confirmRes.json()) as VerifyResponse;

      if (!confirmRes.ok || confirmed.ok === false) {
        setError(MESSAGES[confirmed.code ?? ""] ?? confirmed.message ?? "본인인증에 실패했어요.");
        setPending(false);
        return;
      }

      setDone(true);
      setPending(false);
      router.refresh();
    } catch {
      setError("네트워크가 불안정해요. 다시 시도해 주세요.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" loading={pending} disabled={disabled} onClick={() => void start()}>
        본인인증 시작하기
      </Button>
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-body-sm text-success">
          본인인증이 완료됐어요.
        </p>
      )}
    </div>
  );
}
