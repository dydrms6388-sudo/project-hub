// =============================================================================
// D2 · verify_level 승급 처리 — ⚠ 서버 전용 (service role)
//
// D1 규약: verify_level·birth_date·status 는 service role 로만 갱신된다(컬럼 권한).
// 이 파일의 함수는 Route Handler / Server Action 서버 경로에서만 호출할 것.
// "server-only" 패키지가 의존성에 없으므로(신규 의존성 금지) 주석 + 함수 단위
// 런타임 검증(assertServiceContext)으로 대체한다. SUPABASE_SERVICE_ROLE_KEY 를
// 클라이언트 번들에 노출하는 import 경로가 생기면 즉시 예외가 난다.
//
// 승급 규칙 (A5 §1.1):
//   Lv0 → Lv1 : 휴대폰 SMS OTP 인증 완료 → promotePhoneVerified()
//   Lv1 → Lv2 : 본인인증 confirm(CI 확보) → promoteIdentityVerified()
//               - blocked_hashes(ci) 조회로 영구정지 재가입 차단 (A5 §3.1 level 5)
//               - identity_hashes(00007) 조회로 1인 1계정 강제 — 타 프로필에 등록된
//                 CI 면 CI_ALREADY_REGISTERED 거부, 통과 시 upsert 후 승급
//               - PASS 생년월일로 birth_date 덮어쓰기 (진실의 원천)
//               - 만 19세 미만 → 즉시 status=banned + 파기 큐 등록(audit_log) (A5 §1.3-2)
//               - Lv2 도달 update 만으로 보류 매칭이 자동 성립된다 (D1-9 트리거 —
//                 여기서 try_create_match 를 직접 호출하지 않는다)
//   Lv2 → Lv3 : 사진 검수 승인 — ★ D8(어드민) 소관. 이 파일에서 구현하지 않는다.
//               (D8 이 service role 로 photos.review_status=approved 확정 시
//                verify_level=3 승급·전체 반려 시 3→2 강등을 함께 처리한다)
// =============================================================================

import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@duckmate/db";

export type PromotionResult =
  | { ok: true; verifyLevel: number }
  | {
      ok: false;
      code:
        | "PROFILE_NOT_FOUND"
        | "PHONE_BLOCKED"
        | "CI_BLOCKED"
        | "CI_ALREADY_REGISTERED"
        | "UNDERAGE"
        | "DB_ERROR";
      message: string;
    };

/** 서버 실행 컨텍스트 강제 — 클라이언트 번들 유입 시 즉시 실패 */
function assertServiceContext(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/auth/verify.ts 는 서버 전용이다 — 클라이언트에서 import 금지");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정 — service role 서버 환경에서만 호출 가능");
  }
}

/** CI/휴대폰 해시 — 원문은 저장하지 않는다 (blocked_hashes 규약: 해시만) */
export function hashIdentity(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

async function isBlockedHash(hashType: "ci" | "phone", value: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("blocked_hashes")
    .select("hash")
    .eq("hash_type", hashType)
    .eq("hash", hashIdentity(value))
    .maybeSingle();
  return data !== null;
}

async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

async function writeAuditLog(actorProfileId: string | null, action: string, target: string, meta: Record<string, unknown>): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("audit_logs").insert({ actor_id: actorProfileId, action, target, meta });
}

/** 만 나이 (00004 calc_age 와 동일 판정) */
function calcAge(birthDate: string): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Lv0 → Lv1 : 휴대폰 인증 완료
//   호출 전제: OTP 검증이 이미 성공했다(호출자 = phone OTP confirm 서버 경로).
// ---------------------------------------------------------------------------
export async function promotePhoneVerified(userId: string, phone: string): Promise<PromotionResult> {
  assertServiceContext();

  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, code: "PROFILE_NOT_FOUND", message: "프로필이 없어요." };

  // 영구정지 재가입 차단 — 휴대폰 해시 블랙리스트 (A5 §3.1 level 5)
  if (await isBlockedHash("phone", phone)) {
    await writeAuditLog(profile.id, "verify.phone.blocked", `profile:${profile.id}`, {
      reason: "blocked_hashes(phone) hit",
    });
    return { ok: false, code: "PHONE_BLOCKED", message: "이용이 제한된 번호예요. 고객센터에 문의해 주세요." };
  }

  const supabase = createServiceClient();
  const nextLevel = Math.max(profile.verify_level, 1);
  const update: Record<string, unknown> = { verify_level: nextLevel };
  // 온보딩 phone 스텝 진행 중이면 다음 스텝(hobbies)으로 (12_flows §결정-4)
  if (profile.onboarding_step === "phone") update.onboarding_step = "hobbies";

  const { error } = await supabase.from("profiles").update(update).eq("id", profile.id);
  if (error) return { ok: false, code: "DB_ERROR", message: error.message };

  await writeAuditLog(profile.id, "verify.level1", `profile:${profile.id}`, {
    phone_hash: hashIdentity(phone), // 원문 미저장
  });
  return { ok: true, verifyLevel: nextLevel };
}

// ---------------------------------------------------------------------------
// Lv1 → Lv2 : 본인인증 confirm 결과 반영
// ---------------------------------------------------------------------------
export async function promoteIdentityVerified(
  userId: string,
  input: { ci: string; birthDate: string; phone?: string; bypass?: boolean }
): Promise<PromotionResult> {
  assertServiceContext();

  const profile = await getProfileByUserId(userId);
  if (!profile) return { ok: false, code: "PROFILE_NOT_FOUND", message: "프로필이 없어요." };

  const supabase = createServiceClient();

  // 1) 영구정지 재가입 차단 — CI 해시 블랙리스트 (A5 §3.1 level 5)
  if (await isBlockedHash("ci", input.ci)) {
    await supabase.from("profiles").update({ status: "banned" }).eq("id", profile.id);
    await writeAuditLog(profile.id, "verify.ci.blocked", `profile:${profile.id}`, {
      reason: "blocked_hashes(ci) hit — 영구정지 계정 재가입 시도",
      ci_hash: hashIdentity(input.ci),
    });
    return { ok: false, code: "CI_BLOCKED", message: "이용이 제한된 계정이에요. 고객센터에 문의해 주세요." };
  }

  // 2) 1인 1계정 — identity_hashes(00007, service 전용)에서 CI 해시 중복 조회.
  //    이미 "다른" 프로필에 매핑돼 있으면 승급 거부 (A5 §1.1 Lv2: 기존 계정 안내).
  //    같은 프로필의 재인증(동일 CI)은 통과.
  const ciHash = hashIdentity(input.ci);
  {
    const { data: existing, error: dupError } = await supabase
      .from("identity_hashes")
      .select("profile_id")
      .eq("ci_hash", ciHash)
      .maybeSingle();
    if (dupError) return { ok: false, code: "DB_ERROR", message: dupError.message };
    if (existing && (existing as { profile_id: string }).profile_id !== profile.id) {
      await writeAuditLog(profile.id, "verify.ci.duplicate", `profile:${profile.id}`, {
        reason: "identity_hashes(ci) 중복 — 이미 본인인증된 계정 존재 (1인 1계정)",
        ci_hash: ciHash,
      });
      return {
        ok: false,
        code: "CI_ALREADY_REGISTERED",
        message: "이미 본인인증된 계정이 있어요. 기존 계정으로 로그인해 주세요.",
      };
    }
  }

  // 3) 만 19세 미만 → 즉시 banned + 파기 큐 등록 (A5 §1.3 게이트 2)
  //    ※ profiles.birth_date CHECK 가 미성년 저장을 막으므로 덮어쓰기 전에 판정한다.
  //    실제 개인정보 파기 실행은 D5/D7 의 파기 잡이 audit_logs 의
  //    action='verify.underage.purge_queued' 를 큐로 소비한다(규약).
  if (calcAge(input.birthDate) < 19) {
    await supabase.from("profiles").update({ status: "banned" }).eq("id", profile.id);
    await writeAuditLog(profile.id, "verify.underage.purge_queued", `profile:${profile.id}`, {
      reason: "PASS 생년월일 만 19세 미만 — 계정 정지 + 데이터 파기 큐",
    });
    return { ok: false, code: "UNDERAGE", message: "만 19세 이상만 이용할 수 있어요." };
  }

  // 4) CI 해시 등록 (upsert — 재인증 시 자기 행 갱신). unique(ci_hash) 가 동시성
  //    레이스의 최후 방어선 — 위반 시 다른 계정이 먼저 등록한 것이므로 거부.
  {
    const { error: upsertError } = await supabase
      .from("identity_hashes")
      .upsert({ profile_id: profile.id, ci_hash: ciHash }, { onConflict: "profile_id" });
    if (upsertError) {
      if (upsertError.code === "23505") {
        // uq_identity_hashes_ci 위반 = 타 프로필이 선점
        return {
          ok: false,
          code: "CI_ALREADY_REGISTERED",
          message: "이미 본인인증된 계정이 있어요. 기존 계정으로 로그인해 주세요.",
        };
      }
      return { ok: false, code: "DB_ERROR", message: upsertError.message };
    }
  }

  // 5) 승급 + PASS 생년월일 덮어쓰기 (자기신고와 불일치해도 성인이면 PASS 값으로 계속)
  //    verify_level 은 단조 유지: 이미 3이면 3 유지 (사진 뱃지 보존)
  const nextLevel = Math.max(profile.verify_level, 2);
  const { error } = await supabase
    .from("profiles")
    .update({ verify_level: nextLevel, birth_date: input.birthDate })
    .eq("id", profile.id);
  if (error) return { ok: false, code: "DB_ERROR", message: error.message };
  // ↑ 이 update 가 Lv2 도달이면 trg_profiles_verify_match 트리거가 보류 매칭을
  //   자동 성립시킨다 (D1-9). 여기서 추가 호출 불필요.

  await writeAuditLog(profile.id, "verify.level2", `profile:${profile.id}`, {
    ci_hash: ciHash, // 원문 미저장 (identity_hashes 등록 해시와 동일)
    birth_date_overwritten: input.birthDate !== profile.birth_date,
    bypass: input.bypass === true, // 심사 바이패스 경로 감사 추적 (B3 오픈이슈 6)
  });

  return { ok: true, verifyLevel: nextLevel };
}

// ---------------------------------------------------------------------------
// Lv2 → Lv3 (사진 검수 승인) / Lv3 → Lv2 (전체 반려 강등)
//   ★ 여기서 구현하지 않는다 — D8(어드민)이 검수 확정 서버 라우트(service role)에서
//     photos.review_status 확정과 함께 처리한다. (A5 §1.1 강등 규칙 포함)
// ---------------------------------------------------------------------------
