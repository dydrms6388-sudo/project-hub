"use client";

/**
 * 가입 동의 (S2 하단 · 로그인 상태 연령 확인) — 필수 3 체크(약관·개인정보·청소년보호) + 선택 1(마케팅) + 전체 동의.
 * 15_auth §0-6: 필수는 사전 체크 금지, evidence_snapshot 은 약관 요약 3줄을 노출한 뒤 terms 와 함께 true 로 보낸다.
 * 법적 문서 링크(/legal/*)는 E4 라우트.
 */
import * as React from "react";
import Link from "next/link";
import { Checkbox, cn } from "@duckmate/ui";
import { COPY } from "./copy";

import type { ConsentValue } from "./consents";
export { EMPTY_CONSENTS, consentsComplete, toConsentPayload, type ConsentValue } from "./consents";

const ROWS: Array<{ key: keyof ConsentValue; label: string; href: string | null; required: boolean; testId: string }> = [
  { key: "terms", label: COPY.consents.terms, href: "/legal/terms", required: true, testId: "consent-terms" },
  { key: "privacy", label: COPY.consents.privacy, href: "/legal/privacy", required: true, testId: "consent-privacy" },
  { key: "youthPolicy", label: COPY.consents.youth, href: "/legal/youth", required: true, testId: "consent-youth" },
  { key: "marketingPush", label: COPY.consents.marketing, href: null, required: false, testId: "consent-marketing" },
];

export interface ConsentChecklistProps {
  value: ConsentValue;
  onChange: (next: ConsentValue) => void;
  error?: string | null;
  errorId?: string;
  className?: string;
}

export function ConsentChecklist({ value, onChange, error, errorId = "consents-error", className }: ConsentChecklistProps) {
  const allOn = ROWS.every((r) => value[r.key]);
  const someOn = ROWS.some((r) => value[r.key]);
  const allState: boolean | "indeterminate" = allOn ? true : someOn ? "indeterminate" : false;
  const allId = React.useId();

  return (
    <fieldset className={cn("rounded-lg border border-border bg-card", className)} aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="sr-only">약관 동의</legend>
      <label htmlFor={allId} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-label">
        <Checkbox
          id={allId}
          checked={allState}
          data-testid="consent-all"
          onCheckedChange={(c) => {
            const on = c === true;
            onChange({ terms: on, privacy: on, youthPolicy: on, marketingPush: on });
          }}
        />
        {COPY.consents.all}
      </label>
      <ul className="px-4 py-1">
        {ROWS.map((r) => (
          <li key={r.key}>
            <ConsentRow row={r} checked={value[r.key]} onChange={(on) => onChange({ ...value, [r.key]: on })} />
            {r.key === "terms" ? (
              <ul className="mb-2 ml-8 list-disc space-y-0.5 pl-4 text-caption text-muted-foreground" aria-label="약관 요약">
                {COPY.consents.evidenceSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p id={errorId} role="alert" className="px-4 pb-3 text-body-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function ConsentRow({ row, checked, onChange }: { row: (typeof ROWS)[number]; checked: boolean; onChange: (on: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex min-h-11 items-center gap-3 py-1.5">
      <Checkbox id={id} checked={checked} data-testid={row.testId} aria-required={row.required || undefined} onCheckedChange={(c) => onChange(c === true)} />
      <label htmlFor={id} className="flex-1 cursor-pointer text-body-sm text-foreground">
        <span className={cn("mr-1", row.required ? "text-coral-700 dark:text-coral-300" : "text-muted-foreground")}>{row.required ? COPY.consents.required : COPY.consents.optional}</span>
        {row.label}
      </label>
      {row.href ? (
        <Link href={row.href} target="_blank" rel="noopener" className="shrink-0 text-caption text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {COPY.consents.view} ›<span className="sr-only"> {row.label} 새 창</span>
        </Link>
      ) : null}
    </div>
  );
}
