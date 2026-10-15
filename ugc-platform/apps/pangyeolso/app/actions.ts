"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { shortHash } from "@ggu/ugc-core";
import { caseText, getContentById, store, submissionText, ugc } from "./ugc";

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  return shortHash(ip, 12);
}

export interface ActionState {
  ok: boolean;
  message: string;
  stage?: "rejected" | "blocked" | "queued" | "published";
  slug?: string;
}

export async function submitAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    title: String(formData.get("title") ?? ""),
    situation: String(formData.get("situation") ?? ""),
    sideA: String(formData.get("sideA") ?? ""),
    sideB: String(formData.get("sideB") ?? ""),
  };
  const honeypot = String(formData.get("website") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  const fillMs = startedAt ? Date.now() - startedAt : null;

  const result = await ugc.intake({
    raw,
    authorId: null,
    ipHash: await clientIpHash(),
    signals: { honeypot, fillMs },
    text: caseText(raw),
  });

  revalidatePath("/");

  switch (result.stage) {
    case "published":
      return {
        ok: true,
        stage: "published",
        slug: result.content.slug,
        message: "사연이 공개되었습니다. 이제 대중의 판결을 받아보세요.",
      };
    case "queued":
      return {
        ok: true,
        stage: "queued",
        message: "사연이 검수 대기열에 들어갔습니다. 확인 후 공개됩니다.",
      };
    case "blocked":
      return {
        ok: false,
        stage: "blocked",
        message: `자동 검수에서 차단되었습니다 (${result.moderation.categories.join(", ") || "정책 위반"}). 개인 식별 정보를 지우고 다시 시도해 보세요.`,
      };
    case "rejected": {
      const r = result.result;
      const message =
        !r.ok && r.code === "invalid"
          ? r.issues.map((i) => i.message).join(", ")
          : !r.ok && r.code === "rate_limited"
            ? "제출이 너무 잦습니다. 잠시 후 다시 시도하세요."
            : !r.ok && r.code === "duplicate"
              ? "이미 비슷한 사연이 있습니다."
              : !r.ok && r.code === "bot"
                ? "자동 제출로 감지되었습니다."
                : "제출이 거부되었습니다.";
      return { ok: false, stage: "rejected", message };
    }
    default:
      return { ok: false, message: "알 수 없는 오류" };
  }
}

// ── 판결(투표): A 또는 B. IP당 사연 1회. ─────────────────────────────────────
export async function voteAction(formData: FormData): Promise<void> {
  const contentId = String(formData.get("contentId") ?? "");
  const side = String(formData.get("side") ?? "");
  if (side !== "A" && side !== "B") return;

  const content = getContentById(contentId);
  if (!content || content.status !== "published") return;

  // 1-vote-per-IP guard: 같은 (사연, IP) 쌍의 두 번째 카운트부터 무시.
  const ipHash = await clientIpHash();
  const votes = await store.bumpCounter("pangyeolso", `vote:${contentId}:${ipHash}`, 31536000);
  if (votes > 1) return;

  await ugc.engage(
    { contentId, kind: "vote", authorId: null, body: side },
    content,
    caseText(content.content as { situation?: unknown }),
  );
  revalidatePath(content.url);
}

// ── 신고 (3회 누적 자동 비공개) ──────────────────────────────────────────────
export async function reportAction(formData: FormData): Promise<void> {
  const contentId = String(formData.get("contentId") ?? "");
  const reason = String(formData.get("reason") ?? "미기재");
  const content = getContentById(contentId);
  if (!content || content.status !== "published") return;

  await ugc.report({ contentId, reason, reporterId: await clientIpHash(), url: content.url });
  revalidatePath(content.url);
  revalidatePath("/");
  revalidatePath("/admin");
}

// ── 관리자 검수 — 데모 단계라 무인증. 실배포 전 관리자 인증 필수. ─────────────
export async function approveAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  await ugc.reviewApprove({
    submissionId,
    text: submissionText(submissionId),
    resolvedBy: "admin",
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function rejectAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  await ugc.reviewReject({ submissionId, resolvedBy: "admin" });
  revalidatePath("/admin");
  revalidatePath("/");
}
