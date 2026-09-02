"use client";

/**
 * 입력창: 1~1000자, IME 조합 중 Enter 무시, Enter 전송(Shift+Enter 줄바꿈), 이미지 버튼(조건 미충족 시 비활성+툴팁),
 * 인라인 안내(RATE_LIMITED 등), 비활성 사유(NOT_ENTITLED/SANCTIONED).
 */
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@duckmate/ui";
import { CHAT_IMAGE_ALLOWED_MIME } from "@/lib/chat/types";
import { ImageIcon, SendIcon } from "./icons";
import { CHAT_INPUT_MAX_LEN, dateTimeLabel, type SendUiState } from "./model";

export type MessageInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: (body: string) => void;
  onPickImage: (file: File) => void;
  sending: boolean;
  /** null 이면 활성. 문자열이면 입력 비활성 + 사유 표시 */
  disabledReason: string | null;
  imageAllowed: boolean;
  imageAllowedAt: string;
  bothL3: boolean;
  inline: SendUiState | null;
  onClearInline: () => void;
};

export function MessageInput({ value, onChange, onSend, onPickImage, sending, disabledReason, imageAllowed, imageAllowedAt, bothL3, inline, onClearInline }: MessageInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  const disabled = disabledReason !== null;
  const trimmed = value.trim();
  const canSend = !disabled && !sending && trimmed.length > 0 && trimmed.length <= CHAT_INPUT_MAX_LEN;

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);

  function submit() {
    if (!canSend) return;
    onSend(trimmed);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (composing || e.nativeEvent.isComposing) return; // IME 조합 중 Enter 무시
    e.preventDefault();
    submit();
  }
  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onPickImage(f);
  }

  const imageReason = imageAllowed ? null : bothL3 ? `사진은 ${dateTimeLabel(imageAllowedAt)}부터 보낼 수 있어요` : "이미지는 매칭 24시간 후, 양쪽 사진인증부터 보낼 수 있어요";
  const imageDisabled = disabled || !imageAllowed || sending;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="border-t border-border bg-background px-3 pb-safe pt-2">
        {inline ? (
          <div role="alert" className={cn("mb-2 flex items-start justify-between gap-2 rounded-md px-3 py-2 text-caption", inline.kind === "retry" ? "bg-[#FDECEC] text-[#B02E2E]" : "bg-warning-soft text-warning")} data-testid="chat-inline-error">
            <span>{inline.message}</span>
            <button type="button" onClick={onClearInline} className="shrink-0 underline underline-offset-2" aria-label="안내 닫기">
              닫기
            </button>
          </div>
        ) : null}
        {disabled ? (
          <p role="status" className="mb-2 rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground" data-testid="chat-input-disabled">
            {disabledReason}
          </p>
        ) : null}
        <div className="flex items-end gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" tabIndex={imageDisabled ? 0 : -1}>
                <Button variant="ghost" size="icon" aria-label={imageAllowed ? "사진 보내기" : `사진 보내기 (비활성) ${imageReason ?? ""}`} disabled={imageDisabled} onClick={() => fileRef.current?.click()} data-testid="chat-image" className="size-11">
                  <ImageIcon size={22} />
                </Button>
              </span>
            </TooltipTrigger>
            {imageReason ? <TooltipContent>{imageReason}</TooltipContent> : null}
          </Tooltip>
          <input ref={fileRef} type="file" accept={CHAT_IMAGE_ALLOWED_MIME.join(",")} className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
          <label className="sr-only" htmlFor="chat-input">
            메시지
          </label>
          <textarea
            id="chat-input"
            ref={taRef}
            data-testid="chat-input"
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, CHAT_INPUT_MAX_LEN))}
            onKeyDown={onKeyDown}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            disabled={disabled}
            rows={1}
            maxLength={CHAT_INPUT_MAX_LEN}
            placeholder={disabled ? "" : "메시지를 입력하세요"}
            enterKeyHint="send"
            className="min-h-11 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-body text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-60"
          />
          <Button size="icon" aria-label="전송" onClick={submit} disabled={!canSend} loading={sending} data-testid="chat-send" className="size-11">
            <SendIcon size={20} />
          </Button>
        </div>
        {value.length >= CHAT_INPUT_MAX_LEN - 200 ? (
          <p className={cn("mt-1 text-right text-caption", value.length >= CHAT_INPUT_MAX_LEN ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {value.length}/{CHAT_INPUT_MAX_LEN}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
