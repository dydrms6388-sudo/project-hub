import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — 페이지를 찾을 수 없습니다",
  description: "요청하신 주소에 해당하는 패턴 페이지가 없습니다. 홈에서 40가지 수학 패턴을 다시 찾아보세요.",
};

export default function NotFound() {
  return (
    <main className="center-page">
      <h1>404</h1>
      <p>요청하신 페이지를 찾을 수 없습니다. 주소가 바뀌었거나 삭제된 페이지입니다.</p>
      <p>
        <Link href="/">패턴연구소 홈으로 돌아가기</Link>
      </p>
    </main>
  );
}
