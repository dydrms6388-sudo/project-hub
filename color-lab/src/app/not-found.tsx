import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ textAlign: "center", paddingTop: 80 }}>
      <div
        aria-hidden
        style={{
          width: 96,
          height: 96,
          margin: "0 auto 20px",
          borderRadius: "50%",
          background:
            "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
          filter: "saturate(.4)",
        }}
      />
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="muted">
        주소가 바뀌었거나 존재하지 않는 페이지입니다.
      </p>
      <p>
        <Link href="/" className="btn" style={{ textDecoration: "none" }}>
          색채 실험실 홈으로
        </Link>
      </p>
    </main>
  );
}
