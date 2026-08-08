import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap err-page">
      <h1>404</h1>
      <p>요청한 페이지를 찾을 수 없습니다. 주소가 바뀌었거나 삭제된 실험일 수 있습니다.</p>
      <p>
        <Link href="/">실험 목록으로 돌아가기</Link>
      </p>
    </main>
  );
}
