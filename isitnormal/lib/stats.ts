import { getServerSupabase } from "./supabase/server";
import type { SurveyStats, OptionStat } from "./types";

interface StatRow {
  option_id: string;
  opt_key: string;
  label: string;
  votes: number | string;
  n: number | string;
  show_stats: boolean;
}

function shape(rows: StatRow[]): SurveyStats {
  const n = Number(rows[0]?.n) || 0;
  const showStats = Boolean(rows[0]?.show_stats);
  const options: OptionStat[] = rows.map((r) => ({
    key: r.opt_key,
    label: r.label,
    votes: Number(r.votes) || 0,
    pct: 0,
  }));
  const total = options.reduce((a, o) => a + o.votes, 0);
  for (const o of options) o.pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
  return { n, showStats, options };
}

/**
 * slug로 통계 조회. Supabase 미설정/에러/미승인이면 null → 소비 측이 "집계 중"으로 렌더.
 * n<30이면 show_stats=false로 반환되어 % 노출을 서버에서 차단한다 (V3).
 */
export async function getStatsBySlug(slug: string): Promise<SurveyStats | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("get_survey_stats_by_slug", { p_slug: slug });
  if (error || !data || (data as StatRow[]).length === 0) return null;
  return shape(data as StatRow[]);
}
