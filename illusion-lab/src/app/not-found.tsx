import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <h1>404</h1>
      <p>요청하신 페이지를 찾을 수 없습니다. 주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <p>
        <Link href="/">착시실험실 홈으로 돌아가기</Link>
      </p>
    </main>
  );
}
