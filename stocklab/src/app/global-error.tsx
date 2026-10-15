"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <h1>페이지를 표시할 수 없습니다</h1>
        <p>잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={reset} style={{ padding: "8px 16px", marginTop: 12 }}>다시 시도</button>
      </body>
    </html>
  );
}
