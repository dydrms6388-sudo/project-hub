import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// Vercel Cron은 CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET>을 붙여 호출한다.
// 시크릿이 없으면 열린 엔드포인트가 되므로, 미설정 자체를 거부한다.
export function unauthorizedCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron] CRON_SECRET 미설정 — 요청 거부");
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  const ok =
    actual.length === expected.length && timingSafeEqual(actual, expected);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return null;
}

/** 크론 실행 결과 집계기 — 라우트마다 같은 형태의 JSON을 돌려준다. */
export class CronTally {
  sent = 0;
  failed = 0;
  skipped = 0;
  private readonly startedAt = Date.now();

  add(result: { ok: boolean; skipped?: boolean }): boolean {
    if (result.ok) this.sent++;
    else if (result.skipped) this.skipped++;
    else this.failed++;
    return result.ok;
  }

  toResponse(candidates: number, extra: Record<string, unknown> = {}) {
    const body = {
      candidates,
      sent: this.sent,
      failed: this.failed,
      skipped: this.skipped,
      elapsed_ms: Date.now() - this.startedAt,
      ...extra,
    };
    console.log("[cron]", JSON.stringify(body));
    return NextResponse.json(body);
  }
}
