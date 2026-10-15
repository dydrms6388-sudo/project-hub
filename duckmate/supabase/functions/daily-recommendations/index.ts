// =============================================================================
// 덕메이트(DuckMate) · D3 Edge Function — daily-recommendations
//
// KST 06:00 cron 이 호출하는 일일 추천 발행 잡.
//   1) 서비스 키 검증 (Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>)
//   2) for_date 결정 — KST 변환 책임은 발행자(D1 규약): KST(UTC+9) 달력 날짜.
//      body { "for_date": "YYYY-MM-DD" } 로 재실행/백필 시 날짜를 지정할 수 있다.
//   3) public.build_daily_recommendations(for_date) 실행 (service role — RLS 우회)
//   4) 결과 통계(수신자 수·발행 건수·백필 건수·소요 ms)를 로그 + 응답으로 반환.
//
// cron 등록 SQL 은 이 파일 하단 주석 참고 — D7 이 00011 에서 통합 등록한다.
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * KST 서비스 데이 (03_core_loop §결정-2: 하루 = KST 06:00 ~ 다음날 05:59).
 * cron 은 06:00 KST 에 돌지만, 수동 재실행이 05:59 이전에 와도 "직전 서비스 데이"
 * 로 계산되도록 (UTC + 9h − 6h) 의 달력 날짜를 쓴다.
 */
function kstServiceDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  // ---- 서비스 키 검증: cron(service role)만 호출 가능 — anon 키 호출 거부 ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[daily-recommendations] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return json(500, { ok: false, error: "NOT_CONFIGURED" });
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceKey}`) {
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  // ---- for_date 결정 (기본: 오늘의 KST 서비스 데이) ----
  let forDate = kstServiceDate();
  try {
    const body = await req.json();
    if (typeof body?.for_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.for_date)) {
      forDate = body.for_date;
    }
  } catch {
    // body 없음(cron 기본 호출) — 무시
  }

  // ---- 발행 실행 ----
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const t0 = Date.now();
  const { data: stats, error } = await supabase.rpc("build_daily_recommendations", {
    p_for_date: forDate,
  });

  if (error) {
    console.error(
      `[daily-recommendations] for_date=${forDate} FAILED: ${error.message}`,
    );
    return json(500, { ok: false, error: "BUILD_FAILED", message: error.message });
  }

  // 결과 통계 로그 (Supabase Functions 로그에서 일자별 발행량 추적)
  console.log(
    `[daily-recommendations] for_date=${forDate} ` +
      `recipients=${stats?.recipients} issued=${stats?.issued} ` +
      `backfilled=${stats?.backfilled} db_ms=${stats?.duration_ms} total_ms=${Date.now() - t0}`,
  );

  return json(200, { ok: true, stats });
});

/* -----------------------------------------------------------------------------
cron 등록 SQL (D7 이 00011 에서 통합 등록 — 여기서는 참고 주석만):

  -- KST 06:00 = UTC 21:00 (전일). pg_cron + pg_net 필요 (Supabase 대시보드 활성화).
  select cron.schedule(
    'daily-recommendations-kst-0600',
    '0 21 * * *',
    $$
    select net.http_post(
      url     := current_setting('app.settings.supabase_url') || '/functions/v1/daily-recommendations',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    )
    $$
  );

수동 재실행(백필):
  curl -X POST "$SUPABASE_URL/functions/v1/daily-recommendations" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -d '{"for_date":"2026-08-19"}'
----------------------------------------------------------------------------- */
