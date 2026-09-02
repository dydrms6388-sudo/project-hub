"use client";

/**
 * 확인 모달 + 사유 필수 + 서버 액션 호출 (모든 어드민 쓰기 액션 공용).
 * 필드 스펙은 직렬화 가능한 값만(서버 컴포넌트 → 클라이언트 props). 액션은 서버 액션 참조.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@duckmate/ui";
import type { ActionResult } from "@/lib/auth/errors";
import { ADMIN_REASON_MAX } from "@/lib/admin/constants";

export type FieldSpec =
  | { name: string; label: string; type: "text"; required?: boolean; defaultValue?: string; placeholder?: string; maxLength?: number }
  | { name: string; label: string; type: "textarea"; required?: boolean; defaultValue?: string; placeholder?: string; maxLength?: number }
  | { name: string; label: string; type: "number"; required?: boolean; defaultValue?: number; min?: number; max?: number; hint?: string }
  | { name: string; label: string; type: "checkbox"; defaultValue?: boolean }
  | { name: string; label: string; type: "select"; required?: boolean; defaultValue?: string; options: Array<{ value: string; label: string; disabled?: boolean }>; coerce?: "number" };

export type ConfirmActionDialogProps = {
  triggerLabel: string;
  triggerVariant?: "default" | "secondary" | "accent" | "outline" | "ghost" | "destructive" | "link";
  triggerSize?: "sm" | "md" | "lg";
  title: string;
  description?: string;
  /** 서버 액션 (input 객체 1개) */
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  /** 폼 값과 합쳐질 고정 페이로드 */
  payload?: Record<string, unknown>;
  fields?: FieldSpec[];
  /** 사유 필드 키(기본 reason). null 이면 사유 필드 생략(다른 필수 텍스트가 있을 때만) */
  reasonKey?: string | null;
  reasonLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** 성공 후 이동 */
  successHref?: string;
  /** 성공 시 표시 문구 생성용 키(data 에서 꺼낼 필드) */
  className?: string;
};

function coerce(spec: FieldSpec, fd: FormData): unknown {
  const raw = fd.get(spec.name);
  switch (spec.type) {
    case "checkbox":
      return raw === "on" || raw === "true";
    case "number": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    }
    case "select": {
      const s = typeof raw === "string" ? raw : "";
      if (!s) return undefined;
      return spec.coerce === "number" ? Number(s) : s;
    }
    default: {
      const s = typeof raw === "string" ? raw.trim() : "";
      return s.length > 0 ? s : undefined;
    }
  }
}

export function ConfirmActionDialog(p: ConfirmActionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const reasonKey = p.reasonKey === undefined ? "reason" : p.reasonKey;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorField(null);
    const fd = new FormData(e.currentTarget);
    const input: Record<string, unknown> = { ...(p.payload ?? {}) };
    for (const f of p.fields ?? []) {
      const v = coerce(f, fd);
      if (v !== undefined) input[f.name] = v;
    }
    if (reasonKey) {
      const r = (fd.get(reasonKey) as string | null)?.trim() ?? "";
      if (!r) {
        setError("사유를 입력해 주세요");
        setErrorField(reasonKey);
        return;
      }
      input[reasonKey] = r;
    }
    startTransition(async () => {
      const res = await p.action(input);
      if (!res.ok) {
        setError(res.message);
        setErrorField(res.field ?? null);
        return;
      }
      setDone("처리됐어요");
      setOpen(false);
      if (p.successHref) router.push(p.successHref);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant={p.triggerVariant ?? (p.destructive ? "destructive" : "outline")}
        size={p.triggerSize ?? "sm"}
        disabled={p.disabled}
        onClick={() => {
          setDone(null);
          setError(null);
          setOpen(true);
        }}
        className={p.className}
      >
        {p.triggerLabel}
      </Button>
      {done ? (
        <span role="status" className="ml-2 text-caption text-success">
          {done}
        </span>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{p.title}</DialogTitle>
              {p.description ? <DialogDescription>{p.description}</DialogDescription> : null}
            </DialogHeader>
            {(p.fields ?? []).map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-label">
                    <input type="checkbox" name={f.name} defaultChecked={f.defaultValue} className="size-4 accent-[var(--primary)]" />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <Label htmlFor={`f-${f.name}`} required={f.required} hint={f.type === "number" ? f.hint : undefined}>
                      {f.label}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea id={`f-${f.name}`} name={f.name} required={f.required} defaultValue={f.defaultValue} placeholder={f.placeholder} maxLength={f.maxLength} invalid={errorField === f.name} />
                    ) : f.type === "select" ? (
                      <select
                        id={`f-${f.name}`}
                        name={f.name}
                        required={f.required}
                        defaultValue={f.defaultValue}
                        className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-body text-foreground"
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value} disabled={o.disabled}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "number" ? (
                      <Input id={`f-${f.name}`} name={f.name} type="number" required={f.required} defaultValue={f.defaultValue} min={f.min} max={f.max} invalid={errorField === f.name} />
                    ) : (
                      <Input id={`f-${f.name}`} name={f.name} required={f.required} defaultValue={f.defaultValue} placeholder={f.placeholder} maxLength={f.maxLength} invalid={errorField === f.name} />
                    )}
                  </>
                )}
              </div>
            ))}
            {reasonKey ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`f-${reasonKey}`} required hint={`최대 ${ADMIN_REASON_MAX}자 · audit_logs 에 기록`}>
                  {p.reasonLabel ?? "사유"}
                </Label>
                <Textarea id={`f-${reasonKey}`} name={reasonKey} required maxLength={ADMIN_REASON_MAX} invalid={errorField === reasonKey} placeholder="판단 근거를 구체적으로" />
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-body-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button type="submit" variant={p.destructive ? "destructive" : "default"} loading={pending}>
                {p.confirmLabel ?? "확인"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
