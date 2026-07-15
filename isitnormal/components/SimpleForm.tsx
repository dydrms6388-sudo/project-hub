"use client";

import { useState } from "react";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "email" | "textarea";
  required?: boolean;
  placeholder?: string;
  help?: string;
}

interface Props {
  endpoint: string;
  fields: FormField[];
  submitLabel: string;
  successMessage: string;
  initial?: Record<string, string>;
}

export default function SimpleForm({ endpoint, fields, submitLabel, successMessage, initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const set = (name: string, v: string) => setValues((p) => ({ ...p, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required !== false && !(values[f.name] || "").trim()) {
        setErrMsg("필수 항목을 채워주세요.");
        setState("error");
        return;
      }
    }
    setState("loading");
    setErrMsg("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await res.json();
      if (d?.ok) {
        setState("done");
      } else {
        setErrMsg(
          d?.reason
            ? `접수할 수 없어요: ${d.reason}`
            : "접수에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
        setState("error");
      }
    } catch {
      setErrMsg("네트워크 오류예요. 다시 시도해 주세요.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5 text-sm text-ink/80">
        {successMessage}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="mb-1 block text-sm font-semibold text-ink">
            {f.label}
            {f.required !== false && <span className="ml-1 text-brand">*</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              rows={5}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          ) : (
            <input
              type={f.type ?? "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
          {f.help && <p className="mt-1 text-xs text-ink/50">{f.help}</p>}
        </div>
      ))}
      {state === "error" && <p className="text-sm text-red-500">{errMsg}</p>}
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {state === "loading" ? "보내는 중…" : submitLabel}
      </button>
    </form>
  );
}
