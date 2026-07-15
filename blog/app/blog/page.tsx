// app/blog/page.tsx — 블로그 목록.
import Link from "next/link";
import type { Metadata } from "next";
import { getSupabase, type BlogPostRow } from "@/lib/supabase";

export const revalidate = 600; // 10분 ISR

export const metadata: Metadata = {
  title: "블로그 | TomatoEggCat",
  description: "생활·금융·건강 계산과 관련해 자주 찾는 주제를 정리한 글 모음.",
  alternates: { canonical: "https://tomatoeggcat.com/blog" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function BlogListPage() {
  let posts: Pick<BlogPostRow, "slug" | "title" | "excerpt" | "tags" | "published_at">[] = [];
  let failed = false;
  try {
    const supabase = getSupabase();
    const res = await supabase
      .from("blog_posts")
      .select("slug,title,excerpt,tags,published_at")
      .order("published_at", { ascending: false })
      .limit(100);
    failed = !!res.error;
    posts = (res.data ?? []) as typeof posts;
  } catch {
    failed = true;
  }

  return (
    <main className="wrap">
      <header className="intro">
        <h1>블로그</h1>
        <p>
          연봉·세금·대출·건강처럼 한 번씩 찾아보게 되는 주제들을 실제로 도움이 되게
          정리합니다. 필요하면 관련 계산 도구로 바로 이어서 써볼 수 있어요.
        </p>
      </header>

      {failed && <p className="empty">글을 불러오지 못했습니다.</p>}
      {!failed && posts.length === 0 && <p className="empty">아직 발행된 글이 없습니다.</p>}

      <ul className="cards">
        {posts.map((p) => (
          <li key={p.slug} className="card">
            <Link href={`/blog/${p.slug}`}>
              <h2>{p.title}</h2>
              {p.excerpt && <p className="excerpt">{p.excerpt}</p>}
              <div className="meta">
                <time>{formatDate(p.published_at)}</time>
                {p.tags && p.tags.length > 0 && (
                  <span className="tags">
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} className="tag">
                        #{t}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
