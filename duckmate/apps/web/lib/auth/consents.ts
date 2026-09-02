/**
 * 동의 기록 (consents) — B1 §13 · 08_legal_docs 재동의 MAJOR 규칙.
 *  - 가입 필수 5: age_19 · terms · privacy · evidence_snapshot · youth_policy, 선택: marketing_push
 *  - version = legal_documents 현재 버전(effective_at ≤ now 중 최신). ip/ua 는 sha256(+CONSENT_HASH_SALT).
 *  - update/delete 금지(RLS). 철회 = 새 행 agreed=false + withdrawn_at.
 */
import type { Enums, TablesInsert } from "@duckmate/db";
import type { ServerSupabase } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/auth/hash";
import { AuthError } from "@/lib/auth/errors";

/** consent_key → 근거 문서(legal_doc_key). marketing 문서가 없으면 version 은 FALLBACK_VERSION */
export const CONSENT_DOC_MAP: Readonly<Record<Enums["consent_key"], Enums["legal_doc_key"]>> = {
  age_19: "terms",
  terms: "terms",
  privacy: "privacy",
  evidence_snapshot: "terms",
  youth_policy: "youth",
  marketing_push: "marketing",
  dating_mode_public: "terms",
  auto_renew: "refund",
  digital_no_withdrawal: "refund",
  reconsent: "terms",
};
const FALLBACK_VERSION = "1.0.0";

export type OnboardingConsentInput = {
  terms: boolean;
  privacy: boolean;
  youthPolicy: boolean;
  /** 약관 요약 3줄(신고 시 대화 보관)에 대한 동의 — 체크박스는 terms 와 묶어도 되지만 저장은 개별 행 */
  evidenceSnapshot: boolean;
  marketingPush?: boolean;
};

export type ConsentContext = { ip: string; userAgent: string | null };

export async function consentHashes(ctx: ConsentContext): Promise<{ ip_hash: string; ua_hash: string | null }> {
  const salt = serverEnv().CONSENT_HASH_SALT ?? "";
  return {
    ip_hash: await sha256Hex(ctx.ip + salt),
    ua_hash: ctx.userAgent ? await sha256Hex(ctx.userAgent + salt) : null,
  };
}

/** legal_documents 현재 버전 표 (공개 읽기) */
export async function currentLegalVersions(supabase: ServerSupabase): Promise<Map<Enums["legal_doc_key"], { version: string; requiresReconsent: boolean }>> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("key, version, effective_at, requires_reconsent")
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false });
  if (error) throw new AuthError("INTERNAL", undefined, { cause: error });
  const map = new Map<Enums["legal_doc_key"], { version: string; requiresReconsent: boolean }>();
  for (const row of data ?? []) {
    if (!map.has(row.key)) map.set(row.key, { version: row.version, requiresReconsent: row.requires_reconsent });
  }
  return map;
}

/**
 * 가입 동의 5(+1) 행 insert. 필수 항목이 false 면 INVALID_INPUT. 재로그인·재시도 시 중복 행이 생겨도 이력이므로 무해.
 */
export async function recordOnboardingConsents(
  supabase: ServerSupabase,
  userId: string,
  input: OnboardingConsentInput,
  ctx: ConsentContext,
): Promise<void> {
  if (!input.terms || !input.privacy || !input.youthPolicy || !input.evidenceSnapshot) {
    throw new AuthError("INVALID_INPUT", "필수 약관에 동의해 주세요", { field: "consents" });
  }
  const versions = await currentLegalVersions(supabase);
  const hashes = await consentHashes(ctx);
  const at = new Date().toISOString();
  const row = (key: Enums["consent_key"], agreed: boolean): TablesInsert<"consents"> => {
    const doc = CONSENT_DOC_MAP[key];
    return {
      user_id: userId,
      key,
      document_key: doc,
      version: versions.get(doc)?.version ?? FALLBACK_VERSION,
      agreed,
      agreed_at: at,
      ip_hash: hashes.ip_hash,
      ua_hash: hashes.ua_hash,
      source: "onboarding",
    };
  };
  const rows: TablesInsert<"consents">[] = [
    row("age_19", true),
    row("terms", true),
    row("privacy", true),
    row("evidence_snapshot", true),
    row("youth_policy", true),
  ];
  if (input.marketingPush !== undefined) rows.push(row("marketing_push", input.marketingPush === true));
  const { error } = await supabase.from("consents").insert(rows);
  if (error) throw new AuthError("INTERNAL", undefined, { cause: error });
}

/** 마케팅 수신 등 단일 동의 갱신(설정 화면). 철회는 agreed=false + withdrawn_at */
export async function recordConsent(
  supabase: ServerSupabase,
  userId: string,
  key: Enums["consent_key"],
  agreed: boolean,
  source: Enums["consent_source"],
  ctx: ConsentContext,
  documentKey?: Enums["legal_doc_key"],
): Promise<void> {
  const versions = await currentLegalVersions(supabase);
  const hashes = await consentHashes(ctx);
  const doc = documentKey ?? CONSENT_DOC_MAP[key];
  const at = new Date().toISOString();
  const { error } = await supabase.from("consents").insert({
    user_id: userId,
    key,
    document_key: doc,
    version: versions.get(doc)?.version ?? FALLBACK_VERSION,
    agreed,
    agreed_at: at,
    withdrawn_at: agreed ? null : at,
    ip_hash: hashes.ip_hash,
    ua_hash: hashes.ua_hash,
    source,
  });
  if (error) throw new AuthError("INTERNAL", undefined, { cause: error });
}

function major(version: string): number {
  const n = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/** 가입 시 동의가 필요한 문서(재동의 판정 대상) */
export const RECONSENT_DOCS: ReadonlyArray<Enums["legal_doc_key"]> = ["terms", "privacy", "youth"];

/**
 * 재동의 필요 문서 목록: legal_documents.requires_reconsent=true 인 현재 버전의 MAJOR > 사용자의 최신 동의 MAJOR.
 * 08_legal_docs §0-9(MAJOR 비교) + D1 §0-18(requires_reconsent). 빈 배열 = 재동의 불필요.
 */
export async function pendingReconsents(supabase: ServerSupabase, userId: string): Promise<Array<{ documentKey: Enums["legal_doc_key"]; version: string }>> {
  const versions = await currentLegalVersions(supabase);
  const { data, error } = await supabase
    .from("consents")
    .select("key, document_key, version, agreed, agreed_at")
    .eq("user_id", userId)
    .eq("agreed", true)
    .order("agreed_at", { ascending: false });
  if (error) throw new AuthError("INTERNAL", undefined, { cause: error });

  const latestByDoc = new Map<Enums["legal_doc_key"], string>();
  for (const c of data ?? []) {
    const doc = c.document_key ?? CONSENT_DOC_MAP[c.key];
    if (!latestByDoc.has(doc)) latestByDoc.set(doc, c.version);
  }
  const out: Array<{ documentKey: Enums["legal_doc_key"]; version: string }> = [];
  for (const doc of RECONSENT_DOCS) {
    const cur = versions.get(doc);
    if (!cur || !cur.requiresReconsent) continue;
    const mine = latestByDoc.get(doc);
    if (!mine || major(mine) < major(cur.version)) out.push({ documentKey: doc, version: cur.version });
  }
  return out;
}
