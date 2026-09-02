"use server";

/**
 * 내 데이터 다운로드 — 사용자 권한(RLS)으로 자기 데이터만 조회해 JSON 을 돌려준다(Phase 1 자동 생성, 07_legal §0-21 "전송" 권리).
 * 섹션별 실패는 partial[] 에 남기고 나머지는 내려준다. service role 미사용.
 */
import { SERVICE_NAME } from "@/config/company";
import { ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction, type ActionContext } from "@/lib/auth/session";
import { buildExport, exportFileName, type DataExport, type RawExport } from "@/components/settings/data-export";

type Q<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

async function section<T>(name: string, partial: string[], q: () => Q<T>, fallback: T): Promise<T> {
  try {
    const { data, error } = await q();
    if (error) throw error;
    return (data ?? fallback) as T;
  } catch (e) {
    console.error(`[data-export] ${name} failed`, (e as { message?: string }).message);
    partial.push(name);
    return fallback;
  }
}

async function collect(ctx: ActionContext): Promise<RawExport> {
  const { supabase, profileId, user } = ctx;
  const partial: string[] = [];
  // 타입 미병합 뷰(v_my_matches 는 병합됨, v_messages 병합됨) — 나머지 테이블은 Database 타입 사용
  const untyped = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: unknown) => Q<unknown[]> } } };

  const profile = await section(
    "profile",
    partial,
    () => supabase.from("profiles").select("id, nickname, birth_date, gender, region_code, bio, now_into, verify_level, mode, seeking_gender, status, created_at, last_active_at").eq("id", profileId).single(),
    null as RawExport["profile"] | null,
  );
  if (!profile) throw new Error("profile missing");

  const ph = await section("hobbies", partial, () => supabase.from("profile_hobbies").select("hobby_id, rank, intensity, fav_note").eq("profile_id", profileId).order("rank"), []);
  const hobbyNames = ph.length
    ? await section(
        "hobbies",
        partial,
        () =>
          supabase
            .from("hobbies")
            .select("id, name")
            .in(
              "id",
              ph.map((h) => h.hobby_id),
            ),
        [],
      )
    : [];
  const nameById = new Map(hobbyNames.map((h) => [h.id, h.name]));

  const [quiz, avail, photos, likes, matches, messages, reports, sanctions, appeals, subs, payments, rsvps, game, quests, consents] = await Promise.all([
    section("quiz_answers", partial, () => supabase.from("quiz_answers").select("question_id, choice, answered_at").eq("profile_id", profileId), []),
    section("availability", partial, () => supabase.from("availability").select("weekday, slot").eq("profile_id", profileId), []),
    section("photos", partial, () => supabase.from("photos").select("id, path, is_primary, review_status, reject_code, created_at").eq("profile_id", profileId).order("sort_order"), []),
    section("likes_sent", partial, () => supabase.from("likes").select("id, type, created_at").eq("from_id", profileId), []),
    section("matches", partial, () => supabase.from("v_my_matches").select("match_id, mode, status, matched_at, ended_at, partner_nickname"), []),
    section("messages_sent", partial, () => supabase.from("v_messages").select("match_id, body, image_path, created_at, is_mine").eq("is_mine", true).order("created_at"), []),
    section("reports_submitted", partial, () => supabase.from("reports").select("id, reason_code, surface, detail, status, created_at, handled_at").eq("reporter_id", profileId), []),
    section("sanctions", partial, () => supabase.from("sanctions").select("id, level, reason, reason_code, starts_at, ends_at, revoked_at").eq("profile_id", profileId), []),
    section("appeals", partial, () => supabase.from("appeals").select("id, sanction_id, status, created_at, decided_at, decision_note").eq("profile_id", profileId), []),
    section("subscriptions", partial, () => supabase.from("subscriptions").select("id, tier, provider, status, current_period_start, current_period_end, canceled_at").eq("user_id", user.id), []),
    section("payments", partial, () => supabase.from("payments").select("id, provider, kind, sku, amount_krw, status, paid_at, refunded_amount_krw, refunded_at").eq("user_id", user.id), []),
    section("event_rsvps", partial, () => supabase.from("event_rsvps").select("event_id, status, created_at").eq("profile_id", profileId), []),
    section("game_profile", partial, () => supabase.from("game_profiles").select("level, xp, streak_days, coins, last_played_at").eq("profile_id", profileId).maybeSingle(), null),
    section("quest_progress", partial, () => supabase.from("quest_progress").select("quest_id, loop_date, progress, completed_at").eq("profile_id", profileId), []),
    section("consents", partial, () => untyped.from("consents").select("key, document_key, version, agreed, agreed_at, withdrawn_at, source").eq("user_id", user.id) as Q<RawExport["consents"]>, []),
  ]);

  return {
    profile,
    hobbies: ph.map((h) => ({ hobby_id: h.hobby_id, name: nameById.get(h.hobby_id) ?? null, rank: h.rank, intensity: h.intensity, fav_note: h.fav_note })),
    quiz_answers: quiz,
    availability: avail,
    photos,
    likes_sent: likes,
    matches: matches.map((m) => ({ match_id: m.match_id, mode: m.mode, status: m.status, matched_at: m.matched_at, ended_at: m.ended_at, partner_nickname: m.partner_nickname })),
    messages_sent: messages.map((m) => ({ match_id: m.match_id, body: m.body ?? "", image_attached: Boolean(m.image_path), created_at: m.created_at })),
    reports_submitted: reports,
    sanctions: sanctions.map((s) => ({ id: s.id, level: s.level, reason_code: s.reason_code, is_auto: s.reason.startsWith("AUTO:"), starts_at: s.starts_at, ends_at: s.ends_at, revoked_at: s.revoked_at })),
    appeals,
    subscriptions: subs,
    payments,
    event_rsvps: rsvps,
    game_profile: game,
    quest_progress: quests,
    consents,
    partial: [...new Set(partial)],
  };
}

export async function exportMyData(): Promise<ActionResult<{ fileName: string; data: DataExport }>> {
  try {
    const ctx = await requireProfileForAction(1);
    const raw = await collect(ctx);
    const now = new Date();
    return ok({ fileName: exportFileName(now), data: buildExport(raw, SERVICE_NAME, now) });
  } catch (e) {
    return toActionFailure(e);
  }
}
