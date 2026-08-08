import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap notfound">
      <h1>404</h1>
      <p>찾는 실험이 없습니다. 주소가 바뀌었거나 잘못 입력되었습니다.</p>
      <p>
        <Link href="/">← 소리실험실 홈으로</Link>
      </p>
    </main>
  );
}
