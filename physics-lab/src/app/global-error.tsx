"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main
          style={{
            textAlign: "center",
            padding: "90px 20px",
            fontFamily: "sans-serif",
          }}
        >
          <h1>오류가 발생했습니다</h1>
          <p>일시적인 문제일 수 있습니다. 다시 시도해 주세요.</p>
          <button type="button" onClick={() => reset()}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
