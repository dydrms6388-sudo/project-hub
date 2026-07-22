"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Action {
  label: string;
  kind: "survey" | "takedown" | "report";
  action: string;
  danger?: boolean;
}

export default function AdminActions({ id, actions }: { id: string; actions: Action[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (a: Action) => {
    setBusy(true);
    await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, kind: a.kind, action: a.action }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={busy}
          onClick={() => run(a)}
          className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
            a.danger ? "bg-red-50 text-red-600" : "bg-brand/10 text-brand"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
