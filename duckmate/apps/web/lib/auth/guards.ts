// =============================================================================
// D2 · 서버 컴포넌트 가드 헬퍼 — 12_flows §결정-3 "3층 가드" 중 2층(레이아웃 계층)
//
//   1층 middleware.ts : 세션 유무만 판정 (오케스트레이터 관리 — 여기서 수정 금지)
//   2층 layout.tsx    : ★ 이 파일 — 온보딩 완료·verify_level·제재 상태 판정 후 리다이렉트
//   3층 RLS(D1)       : 최종 방어
//
// 사용처:
//   (main)/layout.tsx  → requireOnboardingDone()
//   chat 등 Lv2 라우트  → requireVerifyLevel(2)  (12_flows §0 표의 Lv 값이 단일 기준)
//   (admin)/layout.tsx → requireAdmin()
//
// 전부 서버 컴포넌트/서버 전용 — redirect() 는 next/navigation 서버 구현.
// =============================================================================

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, MySanction, VerifyLevel } from "@duckmate/db";

export interface GuardContext {
  user: User;
  profile: Profile;
}

/** 세션 필수 — 없으면 /login (미들웨어 통과 후 세션 만료 케이스 방어) */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

async function getContext(): Promise<GuardContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  // 프로필 없음 = handle_new_user 이전/이상 상태 → 재로그인 유도
  if (!profile) redirect("/login");

  return { user, profile: profile as Profile };
}

/** 활성 제재 level 3+ 면 /sanctioned (본인 조회는 my_sanctions 뷰 — D1 규약) */
async function redirectIfSanctioned(profile: Profile): Promise<void> {
  if (profile.status === "banned") redirect("/sanctioned");

  const supabase = await createClient();
  const { data } = await supabase
    .from("my_sanctions")
    .select("level, status, ends_at")
    .eq("status", "ACTIVE")
    .gte("level", 3);
  const rows = (data ?? []) as Pick<MySanction, "level" | "status" | "ends_at">[];
  const active = rows.some((s) => s.ends_at === null || new Date(s.ends_at) > new Date());
  if (active) redirect("/sanctioned");
}

/**
 * (main) 레이아웃용: 로그인 + 제재 판정 + 온보딩 완료.
 * 온보딩 미완이면 저장된 onboarding_step 화면으로 (12_flows §결정-4 재개 규칙).
 */
export async function requireOnboardingDone(): Promise<GuardContext> {
  const ctx = await getContext();
  await redirectIfSanctioned(ctx.profile);
  if (ctx.profile.onboarding_step !== "done") {
    redirect(`/onboarding/${ctx.profile.onboarding_step}`);
  }
  return ctx;
}

/**
 * verify_level ≥ n 요구 라우트용 (chat=2, events RSVP=2, 호스팅=3 …).
 * 미달 시 /verify — 12_flows §1 "단일 승급 화면" 원칙.
 */
export async function requireVerifyLevel(n: VerifyLevel): Promise<GuardContext> {
  const ctx = await requireOnboardingDone();
  if (ctx.profile.verify_level < n) {
    redirect(`/verify?required=${n}`);
  }
  return ctx;
}

/**
 * (admin) 레이아웃용: profiles.role = 'admin' (D1-2 확정 — role 은 service role 만
 * 부여 가능해 권한 상승 불가). admin 아님 → /home.
 * 온보딩/제재 판정은 하지 않는다 — 어드민 큐 접근은 별개 경로.
 */
export async function requireAdmin(): Promise<GuardContext> {
  const ctx = await getContext();
  if (ctx.profile.role !== "admin" || ctx.profile.status !== "active") {
    redirect("/home");
  }
  return ctx;
}
