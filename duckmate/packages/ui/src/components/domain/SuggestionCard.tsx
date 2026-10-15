"use client";

import * as React from "react";
import { MapPin, MessageCircle, Monitor, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";

export type SuggestionKind = "online" | "offline" | "talk";

export interface SuggestionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** 제목 ("같이 뛰기") */
  title: string;
  /** 본문 = 첫 메시지 원문 (서버가 그대로 insert) */
  body: string;
  kind: SuggestionKind;
  /** 아이콘: lucide 컴포넌트 또는 이모지. 생략 시 kind 기본 아이콘 */
  icon?: LucideIcon | string;
  /** 3장 중 위치(1~3) */
  position?: number;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onSelect?: () => void;
  selectLabel?: string;
}

const KIND_META: Record<SuggestionKind, { label: string; Icon: LucideIcon }> = {
  online: { label: "온라인", Icon: Monitor },
  offline: { label: "오프라인", Icon: MapPin },
  talk: { label: "대화", Icon: MessageCircle },
};

/**
 * SuggestionCard — 매칭 직후 "같이 할 것" 제안 카드 (3장 중 1장). 12_flows §4.1.
 * 선택 → send_first_message(match_id, suggestion_id). 만남 압박 카피 금지, 제안은 이 카드로만.
 */
export const SuggestionCard = React.forwardRef<HTMLDivElement, SuggestionCardProps>(
  ({ title, body, kind, icon, position, selected = false, disabled = false, loading = false, onSelect, selectLabel = "이걸로 시작하기", className, ...props }, ref) => {
    const meta = KIND_META[kind];
    const Icon = typeof icon === "function" ? icon : meta.Icon;
    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors duration-(--duration-fast)",
          selected ? "border-primary" : "border-border",
          className,
        )}
        aria-label={position ? `제안 ${position}: ${title}` : title}
        {...props}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            {typeof icon === "string" ? (
              <span aria-hidden="true" className="text-[18px] leading-none">{icon}</span>
            ) : (
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 truncate">{title}</h3>
            <span className="text-caption text-muted-foreground">{meta.label}</span>
          </div>
        </div>
        <p className="text-body text-foreground">{body}</p>
        <Button variant={selected ? "default" : "outline"} onClick={onSelect} disabled={disabled} loading={loading} className="w-full">
          {selectLabel}
        </Button>
      </div>
    );
  },
);
SuggestionCard.displayName = "SuggestionCard";
