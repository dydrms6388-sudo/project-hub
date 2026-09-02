import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getDataSource } from "@/lib/data";
import { kstDateString } from "@/lib/kst";
import { pickDaily } from "@/lib/strategies";

/**
 * 매일 06:00 KST (= 21:00 UTC 전일, vercel.json crons) 실행.
 * - Vercel Cron 은 GET 으로 호출하며 CRON_SECRET 이 설정되어 있으면
 *   `Authorization: Bearer <CRON_SECRET>` 을 자동으로 붙인다.
 * - 운영(production)에서는 CRON_SECRET 필수. 개발 환경에서는 미설정 시 인증 생략.
 * - 같은 날짜의 기록이 이미 있으면 그대로 반환(멱등). `?force=1` 이면 재계산.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Auth = { ok: true } | { ok: false; status: number; reason: string };

function authorize(req: NextRequest): Auth {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return token === secret ? { ok: true } : { ok: false, status: 401, reason: "unauthorized" };
  }
  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, reason: "CRON_SECRET is not configured" };
  }
  return { ok: true }; // development without secret
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });

  const force = req.nextUrl.searchParams.has("force");
  const today = kstDateString();
  const ds = getDataSource();

  try {
    if (!force) {
      const existing = await ds.getPick(today);
      if (existing) return NextResponse.json({ ok: true, pick: existing, cached: true, mode: ds.mode });
    }

    const [rows, divRows] = await Promise.all([ds.allScreenRows(), ds.allDividendRows()]);
    const pick = pickDaily(rows, divRows, today);
    if (!pick) {
      return NextResponse.json({ ok: false, reason: "no-candidate", date: today, mode: ds.mode }, { status: 200 });
    }

    await ds.savePick(pick);
    revalidatePath("/today");
    revalidatePath("/");
    return NextResponse.json({ ok: true, pick, cached: false, mode: ds.mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: "error", message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
