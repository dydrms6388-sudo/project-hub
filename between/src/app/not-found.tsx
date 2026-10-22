import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-brand text-5xl font-black">404</p>
      <p className="font-semibold">찾을 수 없는 페이지예요</p>
      <p className="text-muted-foreground text-sm">프로필이 숨김·삭제됐거나, 차단된 사용자일 수 있어요.</p>
      <Link href="/explore" className="bg-brand mt-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
        탐색으로
      </Link>
    </main>
  );
}
