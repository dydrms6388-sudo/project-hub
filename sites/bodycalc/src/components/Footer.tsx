import Link from "next/link";
import { site } from "@/site.config";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-slate-500">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy/" className="hover:text-slate-800">개인정보처리방침</Link>
          <Link href="/terms/" className="hover:text-slate-800">이용약관</Link>
          <a href={`mailto:${site.email}`} className="hover:text-slate-800">문의</a>
          <Link href="/sitemap.xml" className="hover:text-slate-800">사이트맵</Link>
        </nav>
        <p className="mt-4 leading-relaxed">
          {site.name} — 모든 처리는 사용자의 브라우저 안에서 이루어지며, 입력한 내용과 파일은
          서버로 전송되지 않습니다.
        </p>
        <p className="mt-2">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  );
}
