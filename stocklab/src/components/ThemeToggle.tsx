"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("sl-theme", next ? "dark" : "light"); } catch { /* private mode */ }
    setDark(next);
  }
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="btn-ghost h-9 w-9 !px-0" title="테마 전환">
      <span aria-hidden>{dark === null ? "◐" : dark ? "☀" : "☾"}</span>
    </button>
  );
}
