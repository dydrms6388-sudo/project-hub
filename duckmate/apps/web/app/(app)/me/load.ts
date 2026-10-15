import "server-only";

/**
 * /me · /me/edit · /me/photos · /settings/* 공용 서버 로더 (사용자 권한 RLS + 사진 서명 URL 은 admin storage).
 * 서명 URL 은 본인 프로필 폴더(`{profileId}/…`)의 경로만 만들므로 타인 사진이 노출될 여지가 없다.
 */
import { QUIZ_QUESTION_COUNT, type Enums, type ProfileRow, type QuizOption } from "@duckmate/db";
import { ageYearsKst } from "@/lib/onboarding/schemas";
import { PHOTO_BUCKET } from "@/lib/photos/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { ageBandLabel } from "@/components/profile/format";
import type { MyHobby, MyPhoto, MyProfileView, PhotoCounts, ProfileEditData } from "@/components/profile/types";

const SIGNED_URL_TTL_SEC = 600;

export async function signPhotoUrls(profileId: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const own = paths.filter((p) => p.startsWith(`${profileId}/`));
  if (own.length === 0) return out;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(own, SIGNED_URL_TTL_SEC);
    if (error) throw error;
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  } catch (e) {
    console.error("[me] signed urls failed", e);
  }
  return out;
}

export async function loadMyPhotos(supabase: ServerSupabase, profileId: string): Promise<MyPhoto[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, path, is_primary, review_status, reject_code, created_at")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const urls = await signPhotoUrls(
    profileId,
    rows.map((r) => r.path),
  );
  return rows.map((r) => ({ id: r.id, path: r.path, url: urls.get(r.path) ?? null, isPrimary: r.is_primary, reviewStatus: r.review_status, rejectCode: r.reject_code, createdAt: r.created_at }));
}

export function countPhotos(photos: MyPhoto[]): PhotoCounts {
  const c: PhotoCounts = { pending: 0, approved: 0, rejected: 0, held: 0 };
  for (const p of photos) c[p.reviewStatus] += 1;
  return c;
}

export async function loadMyHobbies(supabase: ServerSupabase, profileId: string): Promise<MyHobby[]> {
  const { data: ph, error } = await supabase.from("profile_hobbies").select("hobby_id, rank, intensity, fav_note").eq("profile_id", profileId).order("rank");
  if (error) throw error;
  const rows = ph ?? [];
  if (rows.length === 0) return [];
  const { data: hobbies } = await supabase
    .from("hobbies")
    .select("id, name, category_id")
    .in(
      "id",
      rows.map((r) => r.hobby_id),
    );
  const catIds = [...new Set((hobbies ?? []).map((h) => h.category_id))];
  const { data: cats } = catIds.length ? await supabase.from("hobby_categories").select("id, slug").in("id", catIds) : { data: [] };
  const catSlug = new Map((cats ?? []).map((c) => [c.id, c.slug]));
  const byId = new Map((hobbies ?? []).map((h) => [h.id, h]));
  return rows.map((r) => {
    const h = byId.get(r.hobby_id);
    return { hobbyId: r.hobby_id, name: h?.name ?? `#${r.hobby_id}`, categorySlug: (h && catSlug.get(h.category_id)) ?? "fandom", rank: r.rank, intensity: r.intensity, favNote: r.fav_note };
  });
}

export async function loadRegionLabel(supabase: ServerSupabase, code: string | null): Promise<string> {
  if (!code) return "";
  const { data } = await supabase.from("regions").select("sido, sigungu").eq("code", code).maybeSingle();
  return data ? data.sigungu || data.sido : "";
}

export async function loadMyProfileView(supabase: ServerSupabase, profile: ProfileRow): Promise<MyProfileView> {
  const [hobbies, photos, regionLabel, quiz, quizTotal, avail] = await Promise.all([
    loadMyHobbies(supabase, profile.id),
    loadMyPhotos(supabase, profile.id),
    loadRegionLabel(supabase, profile.region_code),
    supabase.from("quiz_answers").select("question_id", { count: "exact", head: true }).eq("profile_id", profile.id),
    supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("availability").select("weekday", { count: "exact", head: true }).eq("profile_id", profile.id),
  ]);
  const age = profile.birth_date ? ageYearsKst(profile.birth_date) : profile.birth_year ? new Date().getFullYear() - profile.birth_year : 0;
  return {
    profileId: profile.id,
    nickname: profile.nickname ?? "",
    ageBand: age > 0 ? ageBandLabel(age) : "",
    regionLabel,
    verifyLevel: profile.verify_level,
    mode: profile.mode,
    seekingGender: profile.seeking_gender,
    status: profile.status,
    bio: profile.bio,
    nowInto: profile.now_into,
    hobbies,
    photos,
    photoCounts: countPhotos(photos),
    hasApprovedPrimary: photos.some((p) => p.isPrimary && p.reviewStatus === "approved"),
    quizAnswered: quiz.count ?? 0,
    quizTotal: quizTotal.count ?? QUIZ_QUESTION_COUNT,
    availabilityCount: avail.count ?? 0,
    nicknameChangedAt: profile.nickname_changed_at,
  };
}

function parseOptions(raw: unknown): Array<{ value: number; label: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => o as Partial<QuizOption>)
    .filter((o) => typeof o.value === "number" && typeof o.label === "string")
    .map((o) => ({ value: o.value as number, label: o.label as string }));
}

export async function loadProfileEditData(supabase: ServerSupabase, profile: ProfileRow): Promise<ProfileEditData> {
  const [av, mine, hobbies, cats, regions, questions, answers] = await Promise.all([
    supabase.from("availability").select("weekday, slot").eq("profile_id", profile.id),
    supabase.from("profile_hobbies").select("hobby_id, rank, intensity, fav_note").eq("profile_id", profile.id).order("rank"),
    supabase.from("hobbies").select("id, name, category_id").eq("is_active", true).order("sort_order"),
    supabase.from("hobby_categories").select("id, slug, name").eq("is_active", true).order("sort_order"),
    supabase.from("regions").select("code, sido, sigungu").eq("is_active", true).order("sort_order"),
    supabase.from("quiz_questions").select("id, text, options").eq("is_active", true).order("sort_order"),
    supabase.from("quiz_answers").select("question_id, choice").eq("profile_id", profile.id),
  ]);
  const catById = new Map((cats.data ?? []).map((c) => [c.id, c]));
  return {
    profile: {
      nickname: profile.nickname ?? "",
      gender: profile.gender,
      regionCode: profile.region_code,
      bio: profile.bio,
      nowInto: profile.now_into,
      nicknameChangedAt: profile.nickname_changed_at,
    },
    availability: (av.data ?? []).map((a) => ({ weekday: a.weekday, slot: a.slot as Enums["availability_slot"] })),
    myHobbies: (mine.data ?? []).map((h) => ({ hobbyId: h.hobby_id, rank: h.rank, intensity: h.intensity, favNote: h.fav_note })),
    hobbies: (hobbies.data ?? []).map((h) => {
      const c = catById.get(h.category_id);
      return { id: h.id, name: h.name, categoryId: h.category_id, categorySlug: c?.slug ?? "fandom", categoryName: c?.name ?? "" };
    }),
    regions: (regions.data ?? []).map((r) => ({ code: r.code, sido: r.sido, sigungu: r.sigungu })),
    quiz: {
      questions: (questions.data ?? []).map((q) => ({ id: q.id, text: q.text, options: parseOptions(q.options) })),
      answers: Object.fromEntries((answers.data ?? []).map((a) => [a.question_id, a.choice])),
    },
  };
}
