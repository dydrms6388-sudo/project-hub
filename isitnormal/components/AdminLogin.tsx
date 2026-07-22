"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) location.reload();
    else setErr(true);
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xs space-y-3 py-16">
      <h1 className="text-lg font-bold text-ink">관리자</h1>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ADMIN_TOKEN"
        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {err && <p className="text-sm text-red-500">토큰이 올바르지 않아요.</p>}
      <button type="submit" className="w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
        로그인
      </button>
    </form>
  );
}
