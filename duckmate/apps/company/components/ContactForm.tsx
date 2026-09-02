"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button, buttonVariants, Checkbox, Input, Label, RadioCard, RadioGroup, SafetyBanner, Textarea, cn } from "@duckmate/ui";
import { SERVICE_NAME, company, isPlaceholder } from "@/config/company";

/**
 * 문의 폼 — company 유일한 클라이언트 컴포넌트(13_company_site §3.7).
 * 1차 경로 = NEXT_PUBLIC_CONTACT_ENDPOINT(Edge Function `contact`)에 JSON POST.
 * mailto 폴백은 "오류 상태 전용"(결정 8): 엔드포인트 미설정·POST 실패 시에만, CONTACT_EMAIL 이 플레이스홀더면 그것도 숨김.
 * 완료 화면은 별도 라우트가 아니라 내부 상태(결정 24). 전화·주민번호·주소 입력란 없음.
 */
export type InquiryType = "partnership" | "press" | "safety" | "other";

const TYPES: Array<{ value: InquiryType; label: string; description: string }> = [
  { value: "partnership", label: "제휴", description: "행사·커뮤니티·브랜드 협업" },
  { value: "press", label: "언론", description: "취재·인터뷰·자료 요청" },
  { value: "safety", label: "안전", description: "앱 밖에서 알려주고 싶은 안전 문제" },
  { value: "other", label: "기타", description: "채용·취미 태그 요청·그 밖의 이야기" },
];

const BODY_MIN = 10;
const BODY_MAX = 2000;
const NAME_MAX = 20;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Status = "idle" | "sending" | "done" | "error";
type ErrorKind = "no_endpoint" | "network" | "server";

function isInquiryType(v: string | null): v is InquiryType {
  return v === "partnership" || v === "press" || v === "safety" || v === "other";
}

export function ContactForm() {
  const ids = { name: useId(), email: useId(), body: useId(), consent: useId(), err: useId(), typeLabel: useId() };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<InquiryType | "">("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // 허니팟
  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"email" | "type" | "body" | "consent", string>>>({});

  // `?type=` 프리셀렉트 (정적 export: window 에서 직접 읽음)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (isInquiryType(t)) setType(t);
  }, []);

  const endpoint = company.CONTACT_ENDPOINT;
  const mailto = isPlaceholder(company.CONTACT_EMAIL) ? null : company.CONTACT_EMAIL;
  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? "기타";

  function validate(): boolean {
    const e: typeof fieldErrors = {};
    if (email && !EMAIL_RE.test(email)) e.email = "이메일 형식을 확인해 주세요.";
    if (!type) e.type = "문의 유형을 골라 주세요.";
    const len = body.trim().length;
    if (len < BODY_MIN) e.body = `내용은 ${BODY_MIN}자 이상 적어 주세요.`;
    else if (len > BODY_MAX) e.body = `내용은 ${BODY_MAX.toLocaleString()}자까지 적을 수 있어요.`;
    if (!consent) e.consent = "동의해야 문의를 보낼 수 있어요.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  function composedBody(): string {
    const trimmed = body.trim();
    const n = name.trim().slice(0, NAME_MAX);
    return n ? `[보내신 분: ${n}]\n${trimmed}` : trimmed;
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return; // 이중 제출 방지
    if (!validate()) return;
    if (!endpoint) {
      setErrorKind("no_endpoint");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorKind(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null, type, body: composedBody(), honeypot: website }),
      });
      if (!res.ok) {
        setErrorKind("server");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorKind("network");
      setStatus("error");
    }
  }

  function reset() {
    setName("");
    setEmail("");
    setType("");
    setBody("");
    setConsent(false);
    setWebsite("");
    setFieldErrors({});
    setErrorKind(null);
    setStatus("idle");
  }

  if (status === "done") {
    return (
      <div role="status" aria-live="polite" className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-h2">접수됐어요.</h2>
        <p className="text-body mt-2 text-muted-foreground">이메일을 남겨 주셨다면 영업일 기준 3일 안에 답장드려요. 안전 관련 문의는 더 빨리 봐요.</p>
        {type === "safety" ? <p className="text-body mt-2 text-foreground">앱 안에서 신고하면 증거가 자동 첨부돼요.</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className={buttonVariants()}>
            홈으로
          </Link>
          <Button variant="outline" onClick={reset}>
            하나 더 보내기
          </Button>
        </div>
      </div>
    );
  }

  const mailtoHref = mailto
    ? `mailto:${mailto}?subject=${encodeURIComponent(`[${SERVICE_NAME} 문의/${typeLabel}]`)}&body=${encodeURIComponent(composedBody())}`
    : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-describedby={status === "error" ? ids.err : undefined}>
      {type === "safety" ? (
        <SafetyBanner variant="warn" title="지금 위험한 상황이면 112">
          앱 안에서 신고하면 증거가 자동으로 보존돼요.
        </SafetyBanner>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name} hint={`${NAME_MAX}자`}>
          이름 또는 호칭
        </Label>
        <Input id={ids.name} value={name} maxLength={NAME_MAX} autoComplete="nickname" placeholder="예: 서윤 / OO팀" onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.email}>이메일</Label>
        <Input
          id={ids.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(fieldErrors.email)}
          aria-describedby={`${ids.email}-help${fieldErrors.email ? ` ${ids.email}-err` : ""}`}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p id={`${ids.email}-help`} className="text-caption text-muted-foreground">
          답변이 필요하면 적어 주세요. 답변 외 용도로 쓰지 않아요.
        </p>
        {fieldErrors.email ? (
          <p id={`${ids.email}-err`} className="text-caption text-destructive">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend id={ids.typeLabel} className="text-label text-foreground">
          유형 <span className="text-coral-700 dark:text-coral-300" aria-hidden="true">*</span>
          <span className="sr-only">(필수)</span>
        </legend>
        <RadioGroup value={type} onValueChange={(v) => setType(v as InquiryType)} aria-labelledby={ids.typeLabel} aria-invalid={Boolean(fieldErrors.type) || undefined} className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => (
            <RadioCard key={t.value} value={t.value} label={t.label} description={t.description} />
          ))}
        </RadioGroup>
        {fieldErrors.type ? <p className="text-caption text-destructive">{fieldErrors.type}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.body} required hint={<span className="tnum">{body.trim().length.toLocaleString()} / {BODY_MAX.toLocaleString()}</span>}>
          내용
        </Label>
        <Textarea
          id={ids.body}
          value={body}
          rows={7}
          maxLength={BODY_MAX}
          invalid={Boolean(fieldErrors.body)}
          aria-describedby={`${ids.body}-help${fieldErrors.body ? ` ${ids.body}-err` : ""}`}
          onChange={(e) => setBody(e.target.value)}
        />
        <p id={`${ids.body}-help`} className="text-caption text-muted-foreground">
          전화번호·주소·주민번호는 적지 마세요. 필요하면 저희가 따로 여쭤볼게요.
        </p>
        {fieldErrors.body ? (
          <p id={`${ids.body}-err`} className="text-caption text-destructive">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      {/* 허니팟: 사람에게 보이지 않음. 값이 있으면 서버가 200 반환 후 폐기 */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${ids.name}-website`}>Website</label>
        <input id={`${ids.name}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.consent} className="flex min-h-11 cursor-pointer items-start gap-3 text-body-sm text-foreground">
          <Checkbox id={ids.consent} checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-describedby={fieldErrors.consent ? `${ids.consent}-err` : undefined} className="mt-0.5" />
          <span>
            <strong>[필수]</strong> 문의 처리를 위해 이메일(입력 시)과 문의 내용을 수집하며, 처리 완료 후 1년간 보관 뒤 삭제합니다. 동의하지 않으면 문의를 보낼 수 없어요.{" "}
            <Link href="/legal/privacy/" className="text-primary underline underline-offset-4">
              개인정보처리방침
            </Link>
          </span>
        </label>
        {fieldErrors.consent ? (
          <p id={`${ids.consent}-err`} className="text-caption text-destructive">
            {fieldErrors.consent}
          </p>
        ) : null}
      </div>

      {status === "error" ? (
        <div id={ids.err} role="alert" className="rounded-md border border-destructive/40 bg-card p-4">
          <p className="text-body text-foreground">
            지금은 보낼 수 없어요.{" "}
            {mailtoHref ? "잠시 후 다시 시도하거나, 아래 메일로 직접 보내 주세요." : "잠시 후 다시 시도해 주세요."}
          </p>
          {errorKind === "no_endpoint" && !mailtoHref ? <p className="text-body-sm mt-1 text-muted-foreground">문의 채널을 준비 중이에요.</p> : null}
          {mailtoHref ? (
            <a href={mailtoHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
              메일로 직접 보내기
            </a>
          ) : null}
        </div>
      ) : null}

      <div>
        <Button type="submit" loading={status === "sending"} className="w-full sm:w-auto">
          {status === "sending" ? "보내는 중…" : "보내기"}
        </Button>
      </div>
    </form>
  );
}
