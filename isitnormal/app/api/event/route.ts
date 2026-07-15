import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/server";
import { SESSION_COOKIE } from "@/lib/voter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** K값 추적용 이벤트 (계측). 실패해도 사용자 흐름을 막지 않는다. */
const ALLOWED = new Set([
  "view",
  "vote",
  "result_view",
  "card_render",
  "share_click",
  "share_landing",
  "share_to_vote",
  "ugc_submit",
  "notify_optin",
]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name;
  if (!name || !ALLOWED.has(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, offline: true });

  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value ?? null;

  const meta: Record<string, unknown> = {};
  if (body?.meta && typeof body.meta === "object") Object.assign(meta, body.meta);
  if (typeof body?.slug === "string") meta.slug = body.slug.slice(0, 80);

  await admin
    .from("events")
    .insert({
      name,
      session_id: sid,
      meta: Object.keys(meta).length ? meta : null,
    })
    .then(
      () => {},
      () => {},
    );

  return NextResponse.json({ ok: true });
}
