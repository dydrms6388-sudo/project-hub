"use server";

// =============================================================================
// D5 · 모더레이션 Server Actions (유저용: 신고 / 차단 / 내 신고 조회 / 이의제기)
//
// 규약 (15_auth ActionResult 패턴):
// - 전부 zod 검증 + ModerationResult 반환 ({ok,data}|{ok:false,code,message}).
//   E3(채팅 신고/차단 UI)·E4(마이페이지 신고 내역·제재/이의제기 화면)는 code 로 분기.
// - 신고 insert 는 클라이언트 권한이 없으므로(00003) service role 경유(service.ts).
//   스냅샷·자동 분류·자동 제재는 전부 DB 트리거/함수 몫 — 액션은 접수만 한다.
// - 차단/조회/이의제기는 본인 세션(RLS)으로 수행 — service role 불필요.
// - 차단은 상대에게 통지하지 않는다 (A5 부록 — 양방향 비노출은 RLS is_blocked 가 집행).
// =============================================================================

import { createClient } from "@/lib/supabase/server";
import type { MyReport } from "@duckmate/db";
import {
  modFail,
  blockUserSchema,
  submitAppealSchema,
  type ModerationResult,
  type BlockUserInput,
  type SubmitAppealInput,
  type SubmitReportInput,
} from "./schemas";
import { submitReportCore, type SubmitReportData } from "./service";

// ---------------------------------------------------------------------------
// 내부 헬퍼 ("use server" 파일은 async 함수만 export — 헬퍼는 비공개)
// ---------------------------------------------------------------------------
async function getOwnProfileId(): Promise<ModerationResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return modFail("AUTH_REQUIRED", "로그인이 필요해요.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return modFail("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요.");
  return { ok: true, data: (profile as { id: string }).id };
}

// ---------------------------------------------------------------------------
// 신고 접수 — 매칭 상대·프로필 열람 화면에서 (A5 §2 운영 규칙)
//   접수 성공 시 E3 은 "접수됨 + 24h 내 처리" 즉시 안내(A5 §6-①) 후
//   차단 원클릭(blockUser)을 제안한다 (A5 §6 신고자 보호).
// ---------------------------------------------------------------------------
export async function submitReport(
  input: SubmitReportInput
): Promise<ModerationResult<SubmitReportData>> {
  return submitReportCore(input);
}

// ---------------------------------------------------------------------------
// 차단 / 차단 해제 — RLS blocks_own (본인 blocker 행 CRUD)
// ---------------------------------------------------------------------------
export async function blockUser(input: BlockUserInput): Promise<ModerationResult> {
  const parsed = blockUserSchema.safeParse(input);
  if (!parsed.success) {
    return modFail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "대상을 확인해 주세요.");
  }

  const me = await getOwnProfileId();
  if (!me.ok) return me;
  if (parsed.data.targetId === me.data) {
    return modFail("SELF_ACTION", "자기 자신은 차단할 수 없어요.");
  }

  const supabase = await createClient();
  // 멱등: 이미 차단돼 있으면 성공 취급 (PK 충돌 무시)
  const { error } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: me.data, blocked_id: parsed.data.targetId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
    );
  if (error) return modFail("DB_ERROR", error.message);

  return { ok: true, data: undefined };
}

export async function unblockUser(input: BlockUserInput): Promise<ModerationResult> {
  const parsed = blockUserSchema.safeParse(input);
  if (!parsed.success) {
    return modFail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "대상을 확인해 주세요.");
  }

  const me = await getOwnProfileId();
  if (!me.ok) return me;

  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", me.data)
    .eq("blocked_id", parsed.data.targetId);
  if (error) return modFail("DB_ERROR", error.message);

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 내 신고 내역 — my_reports 뷰 (A5: 본인에게는 status 진행 상태만)
// ---------------------------------------------------------------------------
export async function getMyReports(): Promise<ModerationResult<MyReport[]>> {
  const me = await getOwnProfileId();
  if (!me.ok) return me;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return modFail("DB_ERROR", error.message);

  return { ok: true, data: (data ?? []) as MyReport[] };
}

// ---------------------------------------------------------------------------
// 이의제기 접수 — DB submit_appeal() RPC (본인 세션, 00010)
//   30일 내·제재 건당 1회는 DB 가 강제. 처리 기한 7일·결정은 D8(resolve_appeal).
// ---------------------------------------------------------------------------
export async function submitAppeal(
  input: SubmitAppealInput
): Promise<ModerationResult<{ appealId: string }>> {
  const parsed = submitAppealSchema.safeParse(input);
  if (!parsed.success) {
    return modFail("INVALID_INPUT", parsed.error.issues[0]?.message ?? "이의제기 내용을 확인해 주세요.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_appeal", {
    p_sanction_id: parsed.data.sanctionId,
    p_body: parsed.data.body,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("DUCKMATE_APPEAL_AUTH_REQUIRED")) {
      return modFail("AUTH_REQUIRED", "로그인이 필요해요.");
    }
    if (msg.includes("DUCKMATE_APPEAL_WINDOW_EXPIRED")) {
      return modFail("APPEAL_WINDOW_EXPIRED", "이의제기는 제재 통보 후 30일 이내에만 가능해요.");
    }
    if (msg.includes("DUCKMATE_APPEAL_DUPLICATE")) {
      return modFail("APPEAL_DUPLICATE", "이 제재에는 이미 이의제기를 접수했어요. (제재 건당 1회)");
    }
    if (msg.includes("DUCKMATE_APPEAL_NOT_ALLOWED")) {
      return modFail("APPEAL_NOT_ALLOWED", "이의제기할 수 있는 제재가 아니에요.");
    }
    if (msg.includes("DUCKMATE_APPEAL_BODY_INVALID")) {
      return modFail("INVALID_INPUT", "이의제기 내용은 10자 이상 2000자 이하로 적어 주세요.");
    }
    return modFail("DB_ERROR", msg);
  }

  return { ok: true, data: { appealId: data as string } };
}
