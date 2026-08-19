"use server";

// =============================================================================
// E2 · 퍼널 이벤트 로깅 Server Action
//
// 이벤트명은 03_core_loop §4.1 표 그대로 사용한다 (임의 개명 금지 — D7/D8/F3 가
// 같은 이름으로 집계). props 도 표의 주요 props 이름을 따른다.
// RLS: analytics_insert_own (본인 profile_id 로만 insert 가능).
// 계측 실패는 절대 화면을 막지 않는다 (조용히 무시).
// =============================================================================

import { createClient } from "@/lib/supabase/server";

export async function logAppEvent(
  name: string,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("analytics_events").insert({
      profile_id: (profile?.id as string | undefined) ?? null,
      name,
      props,
    });
  } catch {
    // 계측 실패는 무시 — 화면 동작에 영향 없음
  }
}
