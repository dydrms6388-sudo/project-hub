"use server";

// =============================================================================
// E4 · 탈퇴 Server Action [F-PRF-03]
//
// 처리 경로:
//  1) DB 함수 `delete_my_account()` 가 배포돼 있으면 그것으로 즉시 파기한다
//     (계정 파기 API 는 D2/D1 소관 — 07_legal_checklist D2 "회원 탈퇴 API에서
//     파기 큐 등록 + CI/번호 해시 이관". lib/auth 는 E4 수정 금지 영역이라
//     여기서는 호출만 한다).
//  2) 아직 배포 전이면 탈퇴 접수를 운영 큐(contact_messages)에 남기고 로그아웃한다.
//     화면은 어떤 경로였는지 정확히 알려준다 — "완료"를 사칭하지 않는다.
//
// 다크패턴 금지: 만류·혜택 제안·재확인 반복 없음. 확인 다이얼로그 1회로 끝난다.
// =============================================================================

import { createClient } from "@/lib/supabase/server";

export type DeleteAccountResult =
  | { ok: true; mode: "deleted" | "queued" }
  | { ok: false; message: string };

const REASON_LABELS: Record<string, string> = {
  no_match: "마음에 맞는 상대를 못 찾았어요",
  few_recs: "추천이 적었어요",
  safety: "불쾌한 경험이 있었어요",
  privacy: "개인정보가 걱정돼요",
  found_someone: "다른 곳에서 만났어요",
  other: "기타",
  none: "응답하지 않음",
};

export async function deleteMyAccount(reason?: string): Promise<DeleteAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  const reasonLabel = REASON_LABELS[reason ?? "none"] ?? REASON_LABELS.none ?? "응답하지 않음";

  // 1) 파기 RPC (배포돼 있으면 즉시 파기)
  const { error: rpcError } = await supabase.rpc("delete_my_account", { p_reason: reasonLabel });
  if (!rpcError) {
    await supabase.auth.signOut();
    return { ok: true, mode: "deleted" };
  }

  // 2) 폴백 — 탈퇴 접수 기록 후 로그아웃
  const { error: insertError } = await supabase.from("contact_messages").insert({
    name: (profile as { nickname?: string } | null)?.nickname ?? "회원",
    email: user.email ?? "unknown@duckmate.local",
    subject: "회원 탈퇴 요청",
    body: [
      "회원 탈퇴 요청",
      `user_id: ${user.id}`,
      `profile_id: ${(profile as { id?: string } | null)?.id ?? "-"}`,
      `사유: ${reasonLabel}`,
      `요청 시각: ${new Date().toISOString()}`,
    ].join("\n"),
  });
  if (insertError) {
    return { ok: false, message: "탈퇴 처리를 시작하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  await supabase.auth.signOut();
  return { ok: true, mode: "queued" };
}
