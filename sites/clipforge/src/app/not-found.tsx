import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-slate-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-3 text-slate-600">주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
        홈으로 가기
      </Link>
    </div>
  );
}
