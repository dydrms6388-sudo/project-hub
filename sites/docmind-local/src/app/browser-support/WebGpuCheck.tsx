"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detectWebGPU, isMobile, memoryHint } from "@/lib/capability";

type Result = {
  gpu: boolean;
  mobile: boolean;
  mem: number | null;
  adapter: string | null;
  adapterError: string | null;
};

export default function WebGpuCheck() {
  const [res, setRes] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    const base: Result = {
      gpu: detectWebGPU(),
      mobile: isMobile(),
      mem: memoryHint(),
      adapter: null,
      adapterError: null,
    };
    if (!base.gpu) {
      setRes(base);
      return;
    }
    // 어댑터를 실제로 요청해 본다 — navigator.gpu 가 있어도 어댑터가 없을 수 있다.
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    nav.gpu
      ?.requestAdapter()
      .then((a) => {
        if (!alive) return;
        setRes({ ...base, adapter: a ? "사용 가능" : null, adapterError: a ? null : "GPU 어댑터를 찾지 못했습니다." });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRes({ ...base, adapterError: e instanceof Error ? e.message : String(e) });
      });
    setRes(base);
    return () => {
      alive = false;
    };
  }, []);

  if (!res) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        확인 중…
      </div>
    );
  }

  const ok = res.gpu && !res.adapterError;

  return (
    <div
      className={`rounded-xl border p-4 ${ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
      role="status"
      aria-live="polite"
    >
      <p className={`font-semibold ${ok ? "text-green-800" : "text-red-800"}`}>
        {ok ? "이 브라우저에서 사용할 수 있습니다" : "이 브라우저에서는 사용할 수 없습니다"}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        <li>WebGPU(navigator.gpu): {res.gpu ? "있음" : "없음"}</li>
        <li>GPU 어댑터: {res.adapterError ? `실패 — ${res.adapterError}` : (res.adapter ?? "확인 중")}</li>
        <li>기기 종류: {res.mobile ? "모바일 (권장하지 않음)" : "데스크톱"}</li>
        <li>브라우저가 알려 준 메모리: {res.mem === null ? "알 수 없음" : `약 ${res.mem}GB`}</li>
      </ul>
      {ok ? (
        <Link
          href="/tools/summarize/"
          className="mt-3 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          aria-label="PDF 요약 도구로 이동"
        >
          PDF 요약 시작하기 →
        </Link>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-red-700">
          아래 표를 참고해 PC 의 크롬 또는 엣지 최신 버전에서 다시 열어 주세요.
        </p>
      )}
    </div>
  );
}
