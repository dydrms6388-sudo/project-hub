"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main style={{ textAlign: "center", padding: "80px 20px", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 48, margin: 0 }}>500</h1>
          <p>일시적인 오류가 발생했습니다. 오디오는 자동으로 정지됩니다.</p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: "8px 20px", borderRadius: 8, cursor: "pointer" }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
