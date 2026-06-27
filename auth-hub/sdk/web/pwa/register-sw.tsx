"use client";
import { useEffect } from "react";

// <RegisterSW/> — 루트 레이아웃에 한 번 렌더하면 서비스워커를 등록한다.
// public/sw.js 가 존재해야 한다(같은 PWA 키트의 sw.js 복사).
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // 개발 중 캐시 혼선 방지
    const onLoad = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
