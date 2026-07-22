/**
 * Canonical `ugc_` table names. Every service shares these physical tables and
 * is separated by the `app_slug` column — never by a per-service table.
 *
 * Keep in lockstep with supabase/migrations/0000_ugc_core.sql.
 */
export const UGC_TABLES = {
  submissions: "ugc_submissions",
  content: "ugc_content",
  moderations: "ugc_moderations",
  queue: "ugc_moderation_queue",
  engagements: "ugc_engagements",
  reports: "ugc_reports",
  rateCounters: "ugc_rate_counters",
} as const;

export type UgcTableName = (typeof UGC_TABLES)[keyof typeof UGC_TABLES];
