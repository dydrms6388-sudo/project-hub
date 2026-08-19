"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "90px 20px" }}>
        <h1>문제가 발생했습니다</h1>
        <p>일시적인 오류입니다. 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: "10px 20px", cursor: "pointer" }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
