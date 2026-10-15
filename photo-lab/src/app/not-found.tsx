import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <h1>404 — 페이지가 없습니다</h1>
      <p style={{ color: "var(--text-dim)" }}>
        주소가 바뀌었거나 존재하지 않는 페이지입니다.
      </p>
      <p>
        <Link href="/">계산기 목록으로 돌아가기</Link>
      </p>
    </div>
  );
}
