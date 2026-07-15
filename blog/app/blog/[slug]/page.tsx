// app/blog/[slug]/page.tsx — 글 상세.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabase, type BlogPostRow } from "@/lib/supabase";

export const revalidate = 600; // 10분 ISR

const SITE = "https://tomatoeggcat.com";
const OG_IMAGE = `${SITE}/og.png`;

async function getPost(slug: string): Promise<BlogPostRow | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return (data as BlogPostRow) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "글을 찾을 수 없습니다 | TomatoEggCat" };

  const url = `${SITE}/blog/${post.slug}`;
  const description = post.excerpt || post.title;
  return {
    title: `${post.title} | TomatoEggCat`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description,
      siteName: "TomatoEggCat",
      publishedTime: post.published_at,
      images: [{ url: OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [OG_IMAGE],
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const url = `${SITE}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    datePublished: post.published_at,
    dateModified: post.published_at,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: "TomatoEggCat" },
    publisher: {
      "@type": "Organization",
      name: "TomatoEggCat",
      logo: { "@type": "ImageObject", url: OG_IMAGE },
    },
  };

  return (
    <main className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="post">
        <p className="breadcrumb">
          <Link href="/blog">← 블로그</Link>
        </p>
        <h1>{post.title}</h1>
        <div className="meta">
          <time>{formatDate(post.published_at)}</time>
          {post.tags && post.tags.length > 0 && (
            <span className="tags">
              {post.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* 본문 HTML 은 크론이 Claude 로 생성해 저장한 것 */}
        <div className="content" dangerouslySetInnerHTML={{ __html: post.html }} />

        {post.tool_slug && (
          <div className="tool-cta">
            <Link className="tool-btn" href={`${SITE}/${post.tool_slug}/`}>
              관련 계산기로 직접 확인해보기 →
            </Link>
          </div>
        )}
      </article>
    </main>
  );
}
