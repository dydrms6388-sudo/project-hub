"use client";

// =============================================================================
// E3 · 입력창 (텍스트 + 이미지)
//
// 키보드 규약: Enter = 전송 / Shift+Enter = 줄바꿈. 한글 IME 조합 중(Enter 로 후보를
//   확정하는 순간)에는 전송하지 않는다(isComposing 가드) — 안 그러면 조합 확정이
//   그대로 전송돼 버린다.
// 이미지 규약(D4 §6.4-4 / 00006 storage 정책): 양측 verify_level ≥ 2 일 때만 활성.
//   비활성 시 버튼을 숨기지 않고 사유를 텍스트로 병기한다(색·비활성 단독 전달 금지).
//   파일은 클라이언트가 webp 로 변환해 chat-images/{match_id}/{uuid}.webp 로 직접
//   업로드하고, 메시지 행 insert 는 send-message Edge Function 이 한다(유일 경로).
// =============================================================================

import * as React from "react";
import { Button, Textarea } from "@duckmate/ui";
import { createClient } from "@/lib/supabase/client";

/** send-message Edge Function 의 MAX_BODY_LENGTH 와 동일 (lib/chat/queries.MAX_MESSAGE_LENGTH) */
const MAX_MESSAGE_LENGTH = 2000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1440;

export interface ComposerProps {
  matchId: string;
  /** 종료된 방·탈퇴 상대 → 발신 비활성 (12_flows §8.10) */
  disabled: boolean;
  disabledReason: string;
  canSendImage: boolean;
  imageBlockReason: string;
  sending: boolean;
  onSendText: (text: string) => void;
  /** Storage 업로드가 끝난 뒤의 image_path ("chat-images/{match_id}/{uuid}.webp") */
  onSendImage: (imagePath: string) => void;
}

async function toWebpBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("ENCODE_FAILED");
  return blob;
}

export function Composer({
  matchId,
  disabled,
  disabledReason,
  canSendImage,
  imageBlockReason,
  sending,
  onSendText,
  onSendImage,
}: ComposerProps) {
  const [value, setValue] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  // @duckmate/ui Textarea 는 ref 를 노출하지 않으므로 래퍼에서 찾아 포커스한다
  const rowRef = React.useRef<HTMLDivElement>(null);
  const hintId = React.useId();

  const blocked = disabled || sending || uploading;

  function submit() {
    const text = value.trim();
    if (blocked || text.length === 0 || text.length > MAX_MESSAGE_LENGTH) return;
    setValue("");
    onSendText(text);
    rowRef.current?.querySelector("textarea")?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    // IME 조합 확정용 Enter 는 전송이 아니다
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("사진 1장은 10MB까지 보낼 수 있어요.");
      return;
    }

    setUploading(true);
    try {
      const blob = await toWebpBlob(file);
      const objectKey = `${matchId}/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("chat-images")
        .upload(objectKey, blob, { contentType: "image/webp", upsert: false });
      if (error) {
        setUploadError("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      onSendImage(`chat-images/${objectKey}`);
    } catch {
      setUploadError("사진을 처리하지 못했어요. 다른 사진으로 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  if (disabled) {
    return (
      <div
        className="rounded-2xl border border-line bg-surface-raised px-4 py-3 text-body-sm text-ink-muted"
        data-testid="chat-composer-disabled"
      >
        {disabledReason}
      </div>
    );
  }

  const remaining = MAX_MESSAGE_LENGTH - value.length;

  return (
    <div className="flex flex-col gap-2">
      <div ref={rowRef} className="flex items-end gap-2">
        {canSendImage ? (
          <label
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line text-ink-muted hover:bg-primary/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
            data-testid="chat-image-button"
          >
            <span className="sr-only">사진 보내기</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 16l-5-5-6 6" />
            </svg>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={blocked}
              onChange={onPickImage}
              data-testid="chat-image-input"
            />
          </label>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-describedby={hintId}
            data-testid="chat-image-button-disabled"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted opacity-50"
          >
            <span className="sr-only">사진 보내기 (지금은 사용할 수 없어요)</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 16l-5-5-6 6" />
            </svg>
          </button>
        )}

        <Textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="메시지를 입력하세요"
          aria-label="메시지 입력"
          aria-describedby={hintId}
          className="max-h-40 min-h-11 flex-1 resize-y py-2.5"
          data-testid="chat-composer-input"
        />

        <Button
          variant="primary"
          size="md"
          loading={sending || uploading}
          disabled={value.trim().length === 0}
          onClick={submit}
          data-testid="chat-send"
        >
          전송
        </Button>
      </div>

      <p id={hintId} className="text-caption text-ink-muted">
        {canSendImage
          ? "Enter 로 전송, Shift+Enter 로 줄바꿈이에요."
          : `Enter 로 전송, Shift+Enter 로 줄바꿈이에요. ${imageBlockReason}`}
        {remaining < 200 ? ` · ${remaining}자 남았어요.` : ""}
      </p>

      <p role="alert" aria-live="assertive" className="empty:hidden text-body-sm text-danger">
        {uploadError}
      </p>
    </div>
  );
}
