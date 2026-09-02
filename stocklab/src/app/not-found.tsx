import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg py-12 text-center">
      <p className="text-3xl" aria-hidden>🔍</p>
      <h1 className="mt-2 text-xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-muted">주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <Link href="/" className="btn-primary mt-5">홈으로</Link>
    </div>
  );
}
