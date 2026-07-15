// app/api/cron/blog/route.ts — Vercel Cron 이 주기적으로 호출.
// 저품질/봇 패턴 회피: 매번 발행하지 않고 확률적으로 스킵 + 하루 상한을 둔다.
import { NextResponse } from "next/server";
import { blogTopics } from "@/lib/blog-topics";
import { buildBlogPrompt } from "@/lib/blog-prompt";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── 발행 페이스 조절 상수 (나중에 값만 올리면 발행량이 늘어난다) ──
const PUBLISH_PROBABILITY = 0.35; // 크론 1회당 실제 발행 확률
const DAILY_MAX = 2; // 하루 최대 발행 수

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_MAX_TOKENS = 2500;

function randomSuffix(): string {
  // 슬러그 충돌 시 붙일 짧은 랜덤 접미사
  return Math.random().toString(36).slice(2, 7);
}

// Claude 응답에서 JSON 만 안전하게 추출 (```json 펜스 제거)
function parseModelJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function normalizeSlug(raw: unknown, fallback: string): string {
  const base = String(raw || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `post-${randomSuffix()}`;
}

export async function GET(req: Request) {
  // 1) 인증: Vercel Cron 은 Authorization: Bearer ${CRON_SECRET} 를 보낸다.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2) 확률적 스킵 — 발행 시각을 랜덤화(사람 같은 불규칙성)
  if (Math.random() > PUBLISH_PROBABILITY) {
    return NextResponse.json({ skipped: true, reason: "probability" });
  }

  const supabase = getSupabaseAdmin();

  // 3) 하루 상한 체크 — 오늘 0시 이후 발행 수
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error: countErr } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .gte("published_at", startOfDay.toISOString());
  if (countErr) {
    return NextResponse.json({ error: "count failed", detail: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= DAILY_MAX) {
    return NextResponse.json({ skipped: true, reason: "daily_max", count });
  }

  // 4) 주제 랜덤 선택
  const topic = blogTopics[Math.floor(Math.random() * blogTopics.length)];
  const { system, user, meta } = buildBlogPrompt(topic);

  // 5) Claude 호출
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  let modelText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: "anthropic error", status: res.status, detail }, { status: 502 });
    }
    const data = await res.json();
    // content 는 블록 배열 — text 블록을 이어붙인다.
    modelText = (data?.content ?? [])
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("");
  } catch (e: any) {
    return NextResponse.json({ error: "anthropic fetch failed", detail: String(e?.message || e) }, { status: 502 });
  }

  let parsed: any;
  try {
    parsed = parseModelJson(modelText);
  } catch (e: any) {
    return NextResponse.json({ error: "parse failed", detail: String(e?.message || e), raw: modelText.slice(0, 500) }, { status: 502 });
  }

  const title = String(parsed.title || topic.searchTopic).trim();
  const html = String(parsed.html || "").trim();
  if (!html) {
    return NextResponse.json({ error: "empty html from model" }, { status: 502 });
  }
  const excerpt = parsed.excerpt ? String(parsed.excerpt).trim() : null;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t)).slice(0, 10) : [];
  let slug = normalizeSlug(parsed.slug, topic.keyword);

  // 6) 슬러그 중복이면 랜덤 접미사
  const { data: existing } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${randomSuffix()}`;

  // 7) insert
  const { data: inserted, error: insErr } = await supabase
    .from("blog_posts")
    .insert({
      slug,
      title,
      html,
      excerpt,
      tags,
      tool_slug: topic.toolSlug,
      keyword: topic.keyword,
    })
    .select("slug")
    .single();

  if (insErr) {
    return NextResponse.json({ error: "insert failed", detail: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    published: true,
    url: `/blog/${inserted.slug}`,
    slug: inserted.slug,
    topic: topic.keyword,
    variant: meta,
  });
}
