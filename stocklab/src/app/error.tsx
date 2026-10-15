"use client";
import Link from "next/link";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg py-12 text-center">
      <p className="text-3xl" aria-hidden>⚠️</p>
      <h1 className="mt-2 text-xl font-bold">일시적인 오류가 발생했습니다</h1>
      <p className="mt-2 text-sm text-muted">데이터 소스 응답이 지연되거나 잠시 연결이 끊겼을 수 있습니다. 다시 시도해 주세요.</p>
      {error.digest && <p className="mt-1 font-mono text-xs text-muted">ref: {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={reset}>다시 시도</button>
        <Link href="/" className="btn-ghost">홈으로</Link>
      </div>
    </div>
  );
}
