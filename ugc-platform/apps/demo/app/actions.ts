"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { shortHash } from "@ggu/ugc-core";
import { ugc } from "./ugc";

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
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  const honeypot = String(formData.get("website") ?? ""); // hidden field
  const startedAt = Number(formData.get("startedAt") ?? 0);
  const fillMs = startedAt ? Date.now() - startedAt : null;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const ipHash = shortHash(ip, 12);

  const result = await ugc.intake({
    raw: { title, body },
    authorId: null,
    ipHash,
    signals: { honeypot, fillMs },
    text: body,
  });

  revalidatePath("/");

  switch (result.stage) {
    case "published":
      return {
        ok: true,
        stage: "published",
        slug: result.content.slug,
        message: "게시되었습니다. 아래 목록과 상세 페이지에서 확인하세요.",
      };
    case "queued":
      return {
        ok: true,
        stage: "queued",
        message: "검수 대기열에 등록되었습니다. 관리자 확인 후 공개됩니다.",
      };
    case "blocked":
      return {
        ok: false,
        stage: "blocked",
        message: `자동 검수에서 차단되었습니다 (${result.moderation.categories.join(", ") || "정책 위반"}).`,
      };
    case "rejected": {
      const r = result.result;
      const reason =
        !r.ok && r.code === "invalid"
          ? r.issues.map((i) => i.message).join(", ")
          : !r.ok && r.code === "rate_limited"
            ? "요청이 너무 잦습니다. 잠시 후 다시 시도하세요."
            : !r.ok && r.code === "duplicate"
              ? "이미 유사한 글이 있습니다."
              : !r.ok && r.code === "bot"
                ? "자동 제출로 감지되었습니다."
                : "제출이 거부되었습니다.";
      return { ok: false, stage: "rejected", message: reason };
    }
    default:
      return { ok: false, message: "알 수 없는 오류" };
  }
}
