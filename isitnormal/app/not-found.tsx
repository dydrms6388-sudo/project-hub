import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-4xl">🤔</p>
      <h1 className="mt-4 text-xl font-bold text-ink">여긴 없는 페이지예요</h1>
      <p className="mt-2 text-sm text-ink/60">주소가 바뀌었거나 삭제된 설문일 수 있어요.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
