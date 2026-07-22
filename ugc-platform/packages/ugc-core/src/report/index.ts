/**
 * Report + takedown. 신고 3회 누적 → 자동 비공개 + 검수 큐. 삭제 시 즉시
 * noindex + sitemap 제거 + 410 응답(호출 측에서 상태 확인 후 410 반환).
 */
import type { UgcConfig } from "../config.js";
import type { SeoSink, UgcStore } from "../ports.js";
import type { Report } from "../types.js";

export interface ReportInput {
  contentId: string;
  reason: string;
  reporterId: string | null;
  /** URL of the content, needed if a takedown deindex is triggered. */
  url: string;
}

export interface ReportDeps {
  store: UgcStore;
  seo?: SeoSink | null;
  /** Cumulative reports that trigger auto-hide. Default 3. */
  autoHideThreshold?: number;
}

export interface ReportOutcome {
  report: Report;
  totalReports: number;
  autoHidden: boolean;
}

export async function report(
  input: ReportInput,
  config: UgcConfig,
  deps: ReportDeps,
): Promise<ReportOutcome> {
  const threshold = deps.autoHideThreshold ?? 3;
  const rec = await deps.store.insertReport({
    appSlug: config.appSlug,
    contentId: input.contentId,
    reason: input.reason,
    reporterId: input.reporterId,
  });

  const total = await deps.store.countReports(config.appSlug, input.contentId);
  let autoHidden = false;
  if (total >= threshold) {
    autoHidden = true;
    await deps.store.setContentStatus(config.appSlug, input.contentId, "hidden");
    if (deps.seo) await deps.seo.deindex(input.url);
  }

  return { report: rec, totalReports: total, autoHidden };
}

/** Author/admin deletion: hard remove from index, mark deleted (serve 410). */
export async function takedown(
  input: { contentId: string; url: string },
  config: UgcConfig,
  deps: Pick<ReportDeps, "store" | "seo">,
): Promise<void> {
  await deps.store.setContentStatus(config.appSlug, input.contentId, "deleted");
  if (deps.seo) await deps.seo.deindex(input.url);
}
