"use server";

/**
 * 채팅 이미지 (F-029). 조건 = 양쪽 L3 AND matched_at+24h (can_send_chat_image, DB·storage 정책·RPC 3중).
 *
 *   1. createChatImageUploadUrl({ matchId, contentType, sizeBytes }) → { messageId, path, token, signedUrl }
 *      클라이언트: supabase.storage.from("chat-images").uploadToSignedUrl(path, token, file, { contentType })
 *   2. sendImageMessage({ matchId, messageId })                      → SentMessage (send_message RPC, image_path)
 *   3. getChatImageUrl({ path })                                     → { url, expiresAt }  (수신자, 서명 1h, RLS 로 당사자만)
 *
 * 5MB · jpeg/png/webp · 경로 chat-images/{match_id}/{message_id}.webp (원본 확장자와 무관하게 .webp 고정, D1 §0-12).
 * EXIF 제거/재인코딩은 D7 파이프라인(미구현 시 원본 전달, 17_chat.md 병합 요청).
 */
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthError, fail, fromDbError, ok, toActionFailure, type ActionResult } from "@/lib/auth/errors";
import { requireProfileForAction } from "@/lib/auth/session";
import { enforceRateLimit, rateLimitKey } from "@/lib/auth/otp";
import {
  CHAT_IMAGE_ALLOWED_MIME,
  CHAT_IMAGE_BUCKET,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGE_URL_TTL_SEC,
  CHAT_RATE_PER_MIN,
  chatErrorMessage,
  chatImagePath,
  type SendMessageResult,
  type SentMessage,
} from "@/lib/chat/types";

const IMAGE_NOT_ALLOWED_MSG = "이미지는 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요";

const uploadSchema = z.object({
  matchId: z.string().uuid(),
  contentType: z.string().refine((m) => (CHAT_IMAGE_ALLOWED_MIME as readonly string[]).includes(m), "JPG/PNG/WebP 만 보낼 수 있어요"),
  sizeBytes: z.number().int().positive().max(CHAT_IMAGE_MAX_BYTES, "5MB 이하 이미지만 보낼 수 있어요"),
});
const sendSchema = z.object({ matchId: z.string().uuid(), messageId: z.string().uuid() });
const pathSchema = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i, "잘못된 경로예요") });

export type ChatImageTicket = { messageId: string; path: string; token: string; signedUrl: string; maxBytes: number; allowedMime: string[] };

export async function createChatImageUploadUrl(input: unknown): Promise<ActionResult<ChatImageTicket>> {
  try {
    const parsed = uploadSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message, { field: "file" });
    const ctx = await requireProfileForAction(3);
    if (ctx.state.sanctionLevel >= 2) return fail("SANCTIONED", "채팅이 24시간 제한됐어요");
    const { matchId } = parsed.data;

    const { data: allowed, error: allowedErr } = await ctx.supabase.rpc("can_send_chat_image", { p_match_id: matchId, p_sender: ctx.profileId });
    if (allowedErr) throw allowedErr;
    if (!allowed) return fail("NOT_ENTITLED", IMAGE_NOT_ALLOWED_MSG);

    const messageId = crypto.randomUUID();
    const path = chatImagePath(matchId, messageId);
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(CHAT_IMAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("signed upload url missing");
    return ok({ messageId, path: data.path, token: data.token, signedUrl: data.signedUrl, maxBytes: CHAT_IMAGE_MAX_BYTES, allowedMime: [...CHAT_IMAGE_ALLOWED_MIME] });
  } catch (e) {
    return toActionFailure(e);
  }
}

export async function sendImageMessage(input: unknown): Promise<ActionResult<SentMessage>> {
  const admin = createAdminClient();
  let cleanupPath: string | null = null;
  try {
    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT");
    const { matchId, messageId } = parsed.data;
    const ctx = await requireProfileForAction(3);
    const path = chatImagePath(matchId, messageId);
    cleanupPath = path;

    // 업로드 실체·용량·MIME 확인
    const { data: objs, error: listErr } = await admin.storage.from(CHAT_IMAGE_BUCKET).list(matchId, { limit: 5, search: messageId });
    if (listErr) throw listErr;
    const obj = (objs ?? []).find((o) => o.name === `${messageId}.webp`);
    if (!obj) return fail("NOT_FOUND", "업로드된 파일을 찾을 수 없어요. 다시 올려 주세요");
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
    if ((typeof meta.size === "number" && meta.size > CHAT_IMAGE_MAX_BYTES) || (typeof meta.mimetype === "string" && !(CHAT_IMAGE_ALLOWED_MIME as readonly string[]).includes(meta.mimetype))) {
      await admin.storage.from(CHAT_IMAGE_BUCKET).remove([path]);
      return fail("INVALID_INPUT", "이 파일은 보낼 수 없어요 (JPG/PNG/WebP, 5MB 이하)");
    }

    await enforceRateLimit(admin, await rateLimitKey("chat_send", ctx.profileId), CHAT_RATE_PER_MIN, 60);
    const sent = await admin.rpc("send_message", {
      p_match_id: matchId,
      p_sender_id: ctx.profileId,
      p_body: null,
      p_image_path: path,
      p_flags: [],
      p_message_id: messageId,
    });
    if (sent.error) throw sent.error;
    const r = sent.data as unknown as SendMessageResult;
    cleanupPath = null;
    return ok({
      id: r.message_id, matchId, body: null, maskedBody: r.masked_body, imagePath: path, isHeld: r.is_held, createdAt: r.created_at,
      contactMasked: false, warnContact: r.warn_contact, warnRules: [], offlineMeeting: false,
    });
  } catch (e) {
    if (cleanupPath) await admin.storage.from(CHAT_IMAGE_BUCKET).remove([cleanupPath]).catch(() => undefined);
    if (e instanceof AuthError) return toActionFailure(e);
    const err = fromDbError(e);
    if (err.code === "INTERNAL") return toActionFailure(e);
    return fail(err.code, chatErrorMessage(err.message, err.code === "NOT_ENTITLED" ? IMAGE_NOT_ALLOWED_MSG : err.message));
  }
}

/** 수신자/발신자 공용: 서명 다운로드 URL(1h). 사용자 권한 클라이언트 → storage RLS(당사자·held 제외)가 최종 판정 */
export async function getChatImageUrl(input: unknown): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  try {
    const parsed = pathSchema.safeParse(input);
    if (!parsed.success) return fail("INVALID_INPUT", parsed.error.issues[0]?.message);
    const ctx = await requireProfileForAction(2);
    const { data, error } = await ctx.supabase.storage.from(CHAT_IMAGE_BUCKET).createSignedUrl(parsed.data.path, CHAT_IMAGE_URL_TTL_SEC);
    if (error || !data) return fail("FORBIDDEN", "이미지를 볼 수 없어요");
    return ok({ url: data.signedUrl, expiresAt: new Date(Date.now() + CHAT_IMAGE_URL_TTL_SEC * 1000).toISOString() });
  } catch (e) {
    return toActionFailure(e);
  }
}
