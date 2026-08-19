"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: "#0d0f12",
          color: "#e6e9ee",
          fontFamily:
            "Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>오류가 발생했습니다</h1>
          <p style={{ color: "#9aa3b0" }}>
            페이지를 그리는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid #2a303a",
              background: "#1e232b",
              color: "#e6e9ee",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          <p style={{ marginTop: 16 }}>
            <a href="/" style={{ color: "#5b9bd5" }}>
              처음으로 돌아가기
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
