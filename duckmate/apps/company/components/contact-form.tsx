"use client";

import * as React from "react";
import { Button, Input, Select, Textarea } from "@duckmate/ui";
import { company, isFilled } from "@/config/company";
import { CONTACT_ENDPOINT } from "@/config/site";

/**
 * ContactForm — Phase 1 문의 폼 (C4 §4).
 *
 * 정적 export(`output: "export"`)라 Server Action·Route Handler 를 쓸 수 없다.
 * 따라서 전송은 **클라이언트에서** 처리하며 두 가지 모드로 동작한다.
 *
 *  1) `NEXT_PUBLIC_CONTACT_ENDPOINT` 가 설정된 경우 → 그 엔드포인트
 *     (Supabase Edge Function `company-contact`)로 `fetch` POST. C4 D-4 의 목표 상태.
 *  2) 미설정(현재 기본값) → 입력값을 그대로 담은 **mailto 폴백**으로 메일 클라이언트를 연다.
 *     엔드포인트가 배포되기 전까지 문의 채널이 비어 있지 않게 하기 위한 임시 경로다.
 *
 * 두 경우 모두 전송 실패 시 mailto 보조 링크를 노출한다(C4 D-4).
 */

const CATEGORIES = [
  "서비스 이용",
  "제휴·비즈니스",
  "언론·보도",
  "채용",
  "권리침해·법적 요청",
  "기타",
] as const;

const NAME_MAX = 50;
const BODY_MAX = 2000;

type Status = "idle" | "sending" | "sent" | "error";

interface FormValues {
  name: string;
  email: string;
  category: string;
  body: string;
}

function buildMailto(v: FormValues): string {
  const subject = `[문의:${v.category || "기타"}] ${v.name || "이름 미기재"}`;
  const lines = [
    `이름/닉네임: ${v.name}`,
    `회신 이메일: ${v.email}`,
    `문의 유형: ${v.category}`,
    "",
    v.body,
  ];
  return `mailto:${company.contactEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function ContactForm() {
  const hasEndpoint = CONTACT_ENDPOINT.length > 0;
  const hasEmail = isFilled(company.contactEmail);

  const [values, setValues] = React.useState<FormValues>({
    name: "",
    email: "",
    category: "",
    body: "",
  });
  const [agreed, setAgreed] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  // 접수 채널이 아직 하나도 준비되지 않은 상태 — 폼 대신 안내만 노출한다.
  if (!hasEndpoint && !hasEmail) {
    return (
      <div className="rounded-2xl border border-line bg-surface-raised p-5">
        <p className="text-body text-ink">문의 접수 채널을 준비 중입니다.</p>
        <p className="mt-2 text-body-sm text-ink-muted">
          대표 이메일이 확정되는 대로 이 페이지에 문의 폼이 열립니다. 그전까지는 앱 안의 고객센터를
          이용해 주세요.
        </p>
      </div>
    );
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    // honeypot — 값이 있으면 조용히 성공 처리 (C4 §4.1)
    const honeypot = new FormData(form).get("website");
    if (typeof honeypot === "string" && honeypot.length > 0) {
      setStatus("sent");
      return;
    }

    if (!hasEndpoint) {
      // mailto 폴백 모드
      window.location.href = buildMailto(values);
      setStatus("sent");
      return;
    }

    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          category: values.category,
          body: values.body,
          website: "",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-line bg-surface-raised p-5 text-ink"
      >
        <p className="text-h3">문의가 접수되었습니다.</p>
        <p className="mt-2 text-body-sm text-ink-muted">
          {hasEndpoint
            ? "영업일 기준 3일 이내에 남겨주신 이메일로 회신드립니다."
            : "메일 앱이 열리지 않았다면 아래 주소로 직접 보내주세요."}
        </p>
        {!hasEndpoint && hasEmail && (
          <p className="mt-2 text-body-sm">
            <a href={`mailto:${company.contactEmail}`} className="text-ink underline">
              {company.contactEmail}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="cf-name" className="mb-1.5 block text-body-sm font-semibold text-ink">
          이름 또는 닉네임
        </label>
        <Input
          id="cf-name"
          name="name"
          required
          maxLength={NAME_MAX}
          autoComplete="nickname"
          placeholder="실명이 아니어도 괜찮습니다"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="cf-email" className="mb-1.5 block text-body-sm font-semibold text-ink">
          회신받을 이메일
        </label>
        <Input
          id="cf-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="example@email.com"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="cf-category" className="mb-1.5 block text-body-sm font-semibold text-ink">
          문의 유형
        </label>
        <Select
          id="cf-category"
          name="category"
          required
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="" disabled>
            유형을 선택해 주세요
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="cf-body" className="mb-1.5 block text-body-sm font-semibold text-ink">
          내용
        </label>
        <Textarea
          id="cf-body"
          name="body"
          required
          maxLength={BODY_MAX}
          rows={7}
          aria-describedby="cf-body-help"
          placeholder="문의 내용을 적어주세요."
          value={values.body}
          onChange={(e) => set("body", e.target.value)}
        />
        <p id="cf-body-help" className="mt-1.5 text-caption text-ink-muted">
          {values.body.length} / {BODY_MAX}자 · 주민등록번호 등 민감한 개인정보는 적지 말아 주세요.
        </p>
      </div>

      {/* honeypot — 사람에게는 보이지 않음 */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="cf-website">웹사이트</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-raised p-4">
        <input
          id="cf-agree"
          name="agree"
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-5 accent-primary"
        />
        <label htmlFor="cf-agree" className="text-body-sm text-ink-muted">
          개인정보 수집·이용에 동의합니다. 수집 항목은 이름·이메일·문의 내용이며, 문의 처리 목적으로만
          사용하고 처리 완료 후 1년간 보관 뒤 파기합니다. 동의를 거부하실 수 있으나 이 경우 문의
          접수가 어렵습니다.
        </label>
      </div>

      {status === "error" && (
        <div role="alert" className="rounded-2xl bg-danger-tint p-4 text-body-sm text-danger">
          <p>문의 전송에 실패했습니다. ({errorMsg})</p>
          {hasEmail && (
            <p className="mt-2">
              <a href={buildMailto(values)} className="underline">
                이메일로 직접 보내기
              </a>
            </p>
          )}
        </div>
      )}

      <div>
        <Button type="submit" size="lg" loading={status === "sending"}>
          문의 보내기
        </Button>
      </div>
    </form>
  );
}
