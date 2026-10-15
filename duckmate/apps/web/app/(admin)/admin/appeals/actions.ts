"use server";

// D8 · 이의제기 처리 Server Action — 인용(ACCEPTED)/기각(REJECTED).
// 4-eyes(원 제재 처리자 제외)는 lib/admin/appeals.decideAppeal 안에서 세션 기준으로
// 재검증한다 — 화면의 비활성 처리는 안내일 뿐 권한 경계가 아니다.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { decideAppeal } from "@/lib/admin/appeals";

const QUEUE = "/admin/appeals";

function back(params: string): never {
  redirect(`${QUEUE}?${params}`);
}

export async function decideAppealAction(formData: FormData): Promise<void> {
  const appealId = String(formData.get("appealId") ?? "");
  const decisionRaw = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!appealId) back(`e=${encodeURIComponent("이의제기 ID가 없어요.")}`);
  if (decisionRaw !== "ACCEPTED" && decisionRaw !== "REJECTED") {
    back(`e=${encodeURIComponent("인용 또는 기각을 선택해 주세요.")}`);
  }
  const decision: "ACCEPTED" | "REJECTED" = decisionRaw;

  const res = await decideAppeal({ appealId, decision, reason });

  revalidatePath(QUEUE);
  revalidatePath("/admin");

  if (!res.ok) back(`e=${encodeURIComponent(res.message)}`);
  back(
    `m=${encodeURIComponent(
      decision === "ACCEPTED"
        ? "이의제기를 인용하고 제재를 해제했어요."
        : "이의제기를 기각했어요."
    )}`
  );
}
