"use server";

// =============================================================================
// E4 · 내 데이터 내려받기 Server Action [F-PRF-03]
//
// 정보주체 열람권(개인정보처리방침 제8조)의 셀프서비스 구현.
// - 전부 **본인 세션(RLS)** 으로만 읽는다. service role 미사용.
// - 채팅 메시지 본문은 포함하지 않는다: 상대방의 개인정보가 섞이기 때문(마스킹 사본
//   제공은 방침 제8조의 별도 절차). 이 화면에서 그 사실을 그대로 고지한다.
// - 결과는 JSON 문자열로 반환하고, 브라우저가 파일로 저장한다(서버 저장 없음).
// =============================================================================

import { createClient } from "@/lib/supabase/server";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; message: string };

export async function exportMyData(): Promise<ExportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return { ok: false, message: "프로필을 찾을 수 없어요." };

  const profileId = (profile as { id: string }).id;

  const [hobbies, quiz, photos, availability, blocks, reports, sanctions, prefs, subscription] =
    await Promise.all([
      supabase
        .from("profile_hobbies")
        .select("hobby_id, rank, intensity, created_at, hobbies(name, category)")
        .eq("profile_id", profileId),
      supabase.from("quiz_answers").select("question_id, choice").eq("profile_id", profileId),
      supabase
        .from("photos")
        .select("id, path, is_primary, review_status, reject_reason, created_at")
        .eq("profile_id", profileId),
      supabase.from("availability").select("weekday, slot").eq("profile_id", profileId),
      supabase.from("blocks").select("blocked_id, created_at").eq("blocker_id", profileId),
      supabase.from("my_reports").select("*"),
      supabase.from("my_sanctions").select("*"),
      supabase.from("notification_prefs").select("*").eq("profile_id", profileId).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

  const payload = {
    안내: {
      생성시각: new Date().toISOString(),
      포함되지_않는_항목:
        "채팅 메시지 본문은 상대방의 개인정보가 함께 담겨 있어 포함하지 않습니다. 소송 등 정당한 목적의 대화 사본은 개인정보처리방침 제8조 절차로 신청할 수 있습니다.",
      본인확인정보:
        "연계정보(CI)와 휴대폰 번호는 해시로만 보관하므로 원문을 제공할 수 없습니다.",
    },
    계정: { user_id: user.id, email: user.email ?? null, created_at: user.created_at },
    프로필: profile,
    취미: hobbies.data ?? [],
    궁합퀴즈응답: quiz.data ?? [],
    사진: photos.data ?? [],
    활동시간대: availability.data ?? [],
    차단목록: blocks.data ?? [],
    내가_접수한_신고: reports.data ?? [],
    나에게_부과된_제재: sanctions.data ?? [],
    알림설정: prefs.data ?? null,
    구독: subscription.data ?? null,
  };

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return {
    ok: true,
    filename: `duckmate-mydata-${stamp}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}
