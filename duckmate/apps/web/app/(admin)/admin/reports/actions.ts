"use server";

// D8 · 신고 조치 Server Action — 폼(FormData) → lib/admin/reports (service role).
// lib 함수가 첫 줄에서 requireAdmin 을 재검증하므로 이 래퍼는 파싱·리다이렉트만 한다.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SanctionLevel } from "@duckmate/db";
import { resolveReport } from "@/lib/admin/reports";

export async function resolveReportAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get("reportId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const levelRaw = Number(formData.get("sanctionLevel") ?? 0);
  const reason = String(formData.get("reason") ?? "");
  const coApproverNickname = String(formData.get("coApproverNickname") ?? "");

  if (!reportId) redirect(`/admin/reports?e=${encodeURIComponent("신고 ID가 없어요.")}`);

  const res = await resolveReport({
    reportId,
    decision: decision === "dismiss" ? "dismiss" : "sanction",
    sanctionLevel:
      levelRaw >= 1 && levelRaw <= 5 ? (levelRaw as SanctionLevel) : undefined,
    reason,
    coApproverNickname: coApproverNickname || undefined,
  });

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
  revalidatePath("/admin");

  if (!res.ok) {
    redirect(`/admin/reports/${reportId}?e=${encodeURIComponent(res.message)}`);
  }
  redirect(
    `/admin/reports?m=${encodeURIComponent(
      decision === "dismiss" ? "신고를 기각했어요." : "제재를 부과하고 신고를 종결했어요."
    )}`
  );
}
