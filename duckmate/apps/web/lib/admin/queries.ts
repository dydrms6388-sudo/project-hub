import "server-only";

/**
 * 어드민 읽기 쿼리 (D8). service role 클라이언트(AdminContext.admin)로 직접 조회한다.
 *  - 호출자 검증은 페이지의 requireAdminPage() 가 먼저 수행(2차 게이트).
 *  - D5 admin_list_reports / admin_get_report / admin_search_profiles / admin_profile_detail RPC 가 확정되면
 *    api.ts 어댑터로 교체 가능(현재는 0001~0014 테이블 직접 조회 — 로컬 검증 가능).
 *  - 증거 열람은 audit_logs(evidence_viewed) 를 여기서 기록한다(05 §5.2, D1 §0-32).
 */
import type { Enums, ReportEvidence } from "@duckmate/db";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { normalizeKrPhone, phoneHash } from "@/lib/auth/otp";
import { metricsRpc, signedUrl, writeAudit } from "./api";
import { ADMIN_PAGE_SIZE, AUDIT_ACTIONS, REPORT_OPEN_STATUSES, SIGNED_URL_TTL_SEC, type AdminRole } from "./constants";
import { isAdminRole } from "./permissions";
import type {
  AuditFilters, AuditPage, MetricsBundle, PhotoAutoFlags, PhotoQueueFilters, PhotoQueuePage, ProfileSummary, QueueSummary, ReportDetail,
  ReportListItem, ReportQueueFilters, ReportQueuePage, UserDetail, UserSearchItem, UserSearchKind,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

function pageRange(page: number, size = ADMIN_PAGE_SIZE): [number, number] {
  const p = Math.max(0, page);
  return [p * size, p * size + size - 1];
}

async function activeSanctionLevels(admin: AdminSupabase, profileIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (profileIds.length === 0) return out;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("sanctions").select("profile_id,level,ends_at")
    .in("profile_id", profileIds).is("revoked_at", null).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) throw error;
  for (const s of data ?? []) {
    if (!s.profile_id) continue;
    out.set(s.profile_id, Math.max(out.get(s.profile_id) ?? 0, s.level));
  }
  return out;
}

const SUMMARY_COLS = "id,nickname,verify_level,status,mode,gender,birth_year,region_code,created_at,hidden_at" as const;

async function profileSummaries(admin: AdminSupabase, ids: string[]): Promise<Map<string, ProfileSummary>> {
  const out = new Map<string, ProfileSummary>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return out;
  const { data, error } = await admin.from("profiles").select(SUMMARY_COLS).in("id", uniq);
  if (error) throw error;
  const levels = await activeSanctionLevels(admin, uniq);
  for (const p of data ?? []) out.set(p.id, { ...p, active_sanction_level: levels.get(p.id) ?? 0 });
  return out;
}

// ---------------------------------------------------------------------------
// 큐 요약 / 지표
// ---------------------------------------------------------------------------
export async function getQueueSummary(admin: AdminSupabase): Promise<QueueSummary | null> {
  try {
    return await metricsRpc.queueSummary(admin);
  } catch (e) {
    console.error("[admin] queue summary failed", e);
    return null;
  }
}

export async function getMetrics(admin: AdminSupabase, days: number): Promise<MetricsBundle> {
  const [active, daily, funnel, verifyLevels, gender, sla, sanctions, photos] = await Promise.all([
    metricsRpc.activeUsers(admin),
    metricsRpc.daily(admin, days),
    metricsRpc.funnel(admin, days),
    metricsRpc.verifyLevels(admin),
    metricsRpc.gender(admin),
    metricsRpc.sla(admin, days),
    metricsRpc.sanctions(admin, days),
    metricsRpc.photos(admin, days),
  ]);
  return { days, active, daily, funnel, verifyLevels, gender, sla, sanctions, photos };
}

// ---------------------------------------------------------------------------
// 신고 큐
// ---------------------------------------------------------------------------
export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportQueueFilters {
  const one = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = one("status") ?? "open";
  const priority = one("priority") ?? "all";
  const reason = one("reason") ?? "all";
  const sort = one("sort") === "created_at" ? "created_at" : "due_at";
  const page = Math.max(0, Number.parseInt(one("page") ?? "0", 10) || 0);
  return {
    status: (["open", "all", "queued", "in_review", "need_info", "confirmed", "dismissed"].includes(status) ? status : "open") as ReportQueueFilters["status"],
    priority: (["P0", "P1", "P2", "P3"].includes(priority) ? priority : "all") as ReportQueueFilters["priority"],
    reason: reason as ReportQueueFilters["reason"],
    overdue: one("overdue") === "1",
    sort,
    page,
  };
}

export async function listReports(admin: AdminSupabase, f: ReportQueueFilters): Promise<ReportQueuePage> {
  let q = admin
    .from("reports")
    .select("id,reporter_id,target_id,surface,reason_code,priority,status,due_at,created_at,handled_by,handled_at,detector_hit_count,auto_actions,legal_hold", { count: "exact" });
  if (f.status === "open") q = q.in("status", [...REPORT_OPEN_STATUSES]);
  else if (f.status !== "all") q = q.eq("status", f.status);
  if (f.priority !== "all") q = q.eq("priority", f.priority);
  if (f.reason !== "all") q = q.eq("reason_code", f.reason);
  if (f.overdue) q = q.in("status", [...REPORT_OPEN_STATUSES]).lt("due_at", new Date().toISOString());
  q = f.sort === "created_at" ? q.order("created_at", { ascending: false }) : q.order("due_at", { ascending: true }).order("created_at", { ascending: true });
  const [from, to] = pageRange(f.page);
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  const rows = data ?? [];

  const ids = rows.flatMap((r) => [r.reporter_id, r.target_id]).filter((x): x is string => !!x);
  const names = await profileSummaries(admin, ids);
  const targetIds = [...new Set(rows.map((r) => r.target_id).filter((x): x is string => !!x))];
  const openCount = new Map<string, number>();
  const totalCount = new Map<string, number>();
  if (targetIds.length > 0) {
    const { data: agg, error: aErr } = await admin.from("reports").select("target_id,status").in("target_id", targetIds);
    if (aErr) throw aErr;
    for (const r of agg ?? []) {
      if (!r.target_id) continue;
      totalCount.set(r.target_id, (totalCount.get(r.target_id) ?? 0) + 1);
      if (REPORT_OPEN_STATUSES.includes(r.status)) openCount.set(r.target_id, (openCount.get(r.target_id) ?? 0) + 1);
    }
  }
  const items: ReportListItem[] = rows.map((r) => ({
    ...r,
    auto_actions: Array.isArray(r.auto_actions) ? (r.auto_actions as string[]) : [],
    reporter_nickname: r.reporter_id ? (names.get(r.reporter_id)?.nickname ?? null) : null,
    target_nickname: r.target_id ? (names.get(r.target_id)?.nickname ?? null) : null,
    target_open_reports: r.target_id ? (openCount.get(r.target_id) ?? 0) : 0,
    target_total_reports: r.target_id ? (totalCount.get(r.target_id) ?? 0) : 0,
  }));
  return { items, page: f.page, pageSize: ADMIN_PAGE_SIZE, total: count ?? items.length };
}

/** 상세 + 증거 열람(audit evidence_viewed). actor 는 감사 기록용 */
export async function getReportDetail(admin: AdminSupabase, reportId: string, actor: { id: string; role: AdminRole }): Promise<ReportDetail | null> {
  const { data: report, error } = await admin.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (error) throw error;
  if (!report) return null;
  const evidence = (report.evidence && typeof report.evidence === "object" ? (report.evidence as unknown as ReportEvidence) : null);

  const summaries = await profileSummaries(admin, [report.reporter_id, report.target_id].filter((x): x is string => !!x));
  const [matchRes, targetReportsRes, targetSanctionsRes, fromReportRes] = await Promise.all([
    report.match_id
      ? admin.from("matches").select("id,status,mode,matched_at,ended_at,first_message_at").eq("id", report.match_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report.target_id
      ? admin.from("reports").select("id,reason_code,priority,status,created_at,handled_at").eq("target_id", report.target_id).neq("id", report.id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    report.target_id
      ? admin.from("sanctions").select("id,level,reason,starts_at,ends_at,revoked_at,report_id").eq("profile_id", report.target_id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    admin.from("sanctions").select("id,level,reason,starts_at,ends_at,revoked_at").eq("report_id", report.id).order("created_at", { ascending: false }),
  ]);
  for (const r of [matchRes, targetReportsRes, targetSanctionsRes, fromReportRes]) if (r.error) throw r.error;

  // 사진 서명 URL: evidence 복사본 우선(D5 Edge Function 이 복사), 없으면 원본 photos 경로
  const photoUrls: Record<string, string | null> = {};
  for (const ph of evidence?.target_photos ?? []) {
    photoUrls[ph.photo_id] = (await signedUrl(admin, "evidence", ph.evidence_path, SIGNED_URL_TTL_SEC)) ?? (await signedUrl(admin, "photos", ph.path, SIGNED_URL_TTL_SEC));
  }

  let audited = false;
  try {
    await writeAudit(admin, {
      actorId: actor.id, actorRole: actor.role, action: AUDIT_ACTIONS.evidenceViewed, targetType: "report", targetId: report.id,
      meta: { messages: evidence?.messages?.length ?? 0, photos: evidence?.target_photos?.length ?? 0, target_id: report.target_id },
    });
    audited = true;
  } catch (e) {
    console.error("[admin] evidence_viewed audit failed", e);
  }

  return {
    report,
    evidence,
    reporter: report.reporter_id ? (summaries.get(report.reporter_id) ?? null) : null,
    target: report.target_id ? (summaries.get(report.target_id) ?? null) : null,
    match: matchRes.data ?? null,
    targetReports: targetReportsRes.data ?? [],
    targetSanctions: targetSanctionsRes.data ?? [],
    sanctionsFromReport: fromReportRes.data ?? [],
    photoUrls,
    audited,
  };
}

// ---------------------------------------------------------------------------
// 사진 검수 큐
// ---------------------------------------------------------------------------
export function parsePhotoFilters(sp: Record<string, string | string[] | undefined>): PhotoQueueFilters {
  const s = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const p = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  return { status: s === "pending" || s === "held" ? s : "both", page: Math.max(0, Number.parseInt(p ?? "0", 10) || 0) };
}

export async function listPhotoQueue(admin: AdminSupabase, f: PhotoQueueFilters): Promise<PhotoQueuePage> {
  const statuses: Enums["review_status"][] = f.status === "both" ? ["pending", "held"] : [f.status];
  const [from, to] = pageRange(f.page);
  const { data, error, count } = await admin
    .from("photos")
    .select("id,profile_id,path,is_primary,review_status,held_reason,face_count,face_confidence,auto_flags,created_at", { count: "exact" })
    .in("review_status", statuses)
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) throw error;
  const rows = data ?? [];
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const profiles = new Map<string, { nickname: string | null; verify_level: number }>();
  const recentRejects = new Map<string, number>();
  if (profileIds.length > 0) {
    const [{ data: ps, error: pErr }, { data: rj, error: rErr }] = await Promise.all([
      admin.from("profiles").select("id,nickname,verify_level").in("id", profileIds),
      admin.from("photos").select("profile_id").in("profile_id", profileIds).eq("review_status", "rejected").gte("reviewed_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);
    if (pErr) throw pErr;
    if (rErr) throw rErr;
    for (const p of ps ?? []) profiles.set(p.id, { nickname: p.nickname, verify_level: p.verify_level });
    for (const r of rj ?? []) recentRejects.set(r.profile_id, (recentRejects.get(r.profile_id) ?? 0) + 1);
  }
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      profile_id: r.profile_id,
      nickname: profiles.get(r.profile_id)?.nickname ?? null,
      profile_verify_level: (profiles.get(r.profile_id)?.verify_level ?? 0) as PhotoQueueItem["profile_verify_level"],
      path: r.path,
      is_primary: r.is_primary,
      review_status: r.review_status,
      held_reason: r.held_reason,
      face_count: r.face_count,
      face_confidence: r.face_confidence,
      auto_flags: (r.auto_flags && typeof r.auto_flags === "object" ? (r.auto_flags as PhotoAutoFlags) : {}),
      created_at: r.created_at,
      url: await signedUrl(admin, "photos", r.path, SIGNED_URL_TTL_SEC),
      recent_rejections: recentRejects.get(r.profile_id) ?? 0,
    })),
  );
  return { items, page: f.page, pageSize: ADMIN_PAGE_SIZE, total: count ?? items.length };
}
type PhotoQueueItem = PhotoQueuePage["items"][number];

// ---------------------------------------------------------------------------
// 유저 검색 / 상세
// ---------------------------------------------------------------------------
export function detectSearchKind(raw: string, explicit?: string): UserSearchKind {
  if (explicit === "nickname" || explicit === "phone_hash" || explicit === "profile_id" || explicit === "user_id") return explicit;
  const q = raw.trim();
  if (isUuid(q)) return "profile_id";
  if (/^[0-9a-f]{64}$/i.test(q)) return "phone_hash";
  if (normalizeKrPhone(q)) return "phone_hash";
  return "nickname";
}

export async function searchUsers(admin: AdminSupabase, raw: string, kind: UserSearchKind): Promise<UserSearchItem[]> {
  const q = raw.trim();
  if (!q) return [];
  const cols = `${SUMMARY_COLS},user_id,last_active_at,onboarding_step` as const;
  let query = admin.from("profiles").select(cols).limit(ADMIN_PAGE_SIZE);
  if (kind === "profile_id") {
    if (!isUuid(q)) return [];
    query = query.eq("id", q);
  } else if (kind === "user_id") {
    if (!isUuid(q)) return [];
    query = query.eq("user_id", q);
  } else if (kind === "phone_hash") {
    // 해시(64hex) 직접 입력 또는 전화번호 → 서버에서 해시(원문은 어디에도 저장·기록하지 않음)
    const e164 = normalizeKrPhone(q);
    const hash = /^[0-9a-f]{64}$/i.test(q) ? q.toLowerCase() : e164 ? await phoneHash(e164) : null;
    if (!hash) return [];
    query = query.eq("phone_hash", hash);
  } else {
    const escaped = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    query = query.ilike("nickname", `%${escaped}%`).order("last_active_at", { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const levels = await activeSanctionLevels(admin, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, active_sanction_level: levels.get(r.id) ?? 0 }));
}

export async function getUserDetail(admin: AdminSupabase, profileId: string): Promise<UserDetail | null> {
  const { data: profile, error } = await admin.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const uid = profile.user_id;
  const [authRes, identityRes, photosRes, sanctionsRes, appealsRes, sentRes, recvRes, blocksGivenRes, blocksRecvRes, consentsRes, auditRes, matchRes, adminRes] =
    await Promise.all([
      admin.auth.admin.getUserById(uid).catch((e: unknown) => ({ data: { user: null }, error: e as Error })),
      admin.from("identity_verifications").select("id,user_id,profile_id,provider,result,birth_date,gender,birth_date_verified,verified_at,reverify_due_at,is_active,provider_tx_id,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      admin.from("photos").select("id,path,is_primary,review_status,reject_code,reviewed_at,created_at,held_reason").eq("profile_id", profileId).order("sort_order"),
      admin.from("sanctions").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
      admin.from("appeals").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
      admin.from("reports").select("id,target_id,reason_code,priority,status,created_at").eq("reporter_id", profileId).order("created_at", { ascending: false }).limit(30),
      admin.from("reports").select("id,reporter_id,reason_code,priority,status,created_at").eq("target_id", profileId).order("created_at", { ascending: false }).limit(30),
      admin.from("blocks").select("*").eq("blocker_id", profileId),
      admin.from("blocks").select("*").eq("blocked_id", profileId),
      admin.from("consents").select("id,key,document_key,version,agreed,agreed_at,withdrawn_at,source").eq("user_id", uid).order("agreed_at", { ascending: false }).limit(50),
      admin.from("audit_logs").select("*").in("target_id", [profileId, uid]).order("created_at", { ascending: false }).limit(30),
      admin.from("matches").select("id", { count: "exact", head: true }).or(`a_id.eq.${profileId},b_id.eq.${profileId}`),
      admin.from("admin_users").select("role").eq("user_id", uid).maybeSingle(),
    ]);
  for (const r of [identityRes, photosRes, sanctionsRes, appealsRes, sentRes, recvRes, blocksGivenRes, blocksRecvRes, consentsRes, auditRes, matchRes, adminRes]) {
    if (r.error) throw r.error;
  }
  const au = authRes.data?.user ?? null;
  const sanctions = sanctionsRes.data ?? [];
  const levelOf = new Map(sanctions.map((s) => [s.id, s.level]));
  const photos = await Promise.all((photosRes.data ?? []).map(async (p) => ({ ...p, url: await signedUrl(admin, "photos", p.path, SIGNED_URL_TTL_SEC) })));
  const levels = await activeSanctionLevels(admin, [profileId]);
  const role = adminRes.data?.role;
  return {
    profile,
    authUser: au
      ? {
          id: au.id,
          phone_confirmed_at: au.phone_confirmed_at ?? null,
          last_sign_in_at: au.last_sign_in_at ?? null,
          banned_until: (au as { banned_until?: string | null }).banned_until ?? null,
          created_at: au.created_at ?? null,
          app_role: typeof au.app_metadata?.role === "string" ? au.app_metadata.role : null,
        }
      : null,
    identity: identityRes.data ?? [],
    photos,
    sanctions,
    appeals: (appealsRes.data ?? []).map((a) => ({ ...a, sanction_level: levelOf.get(a.sanction_id) ?? null })),
    reportsSent: sentRes.data ?? [],
    reportsReceived: recvRes.data ?? [],
    blocksGiven: blocksGivenRes.data ?? [],
    blocksReceived: blocksRecvRes.data ?? [],
    consents: consentsRes.data ?? [],
    recentAudit: auditRes.data ?? [],
    activeSanctionLevel: levels.get(profileId) ?? 0,
    matchCount: matchRes.count ?? 0,
    adminRole: isAdminRole(role) ? role : null,
  };
}

// ---------------------------------------------------------------------------
// 감사로그
// ---------------------------------------------------------------------------
export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (k: string): string => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return { actor: one("actor"), action: one("action"), target: one("target"), page: Math.max(0, Number.parseInt(one("page") || "0", 10) || 0) };
}

export async function listAudit(admin: AdminSupabase, f: AuditFilters): Promise<AuditPage> {
  let q = admin.from("audit_logs").select("*", { count: "exact" });
  if (f.actor) q = isUuid(f.actor) ? q.eq("actor_id", f.actor) : q.ilike("actor_role", `%${f.actor}%`);
  if (f.action) q = q.ilike("action", `%${f.action}%`);
  if (f.target) q = q.eq("target_id", f.target);
  const [from, to] = pageRange(f.page);
  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { items: data ?? [], page: f.page, pageSize: ADMIN_PAGE_SIZE, total: count ?? 0 };
}
