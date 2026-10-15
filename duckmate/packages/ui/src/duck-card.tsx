import * as React from "react";
import { cn } from "./cn";
import { Avatar } from "./avatar";
import { HobbyChip } from "./hobby-chip";
import { VerifyLevelBadge, type VerifyLevel } from "./verify-level-badge";

/**
 * DuckCard — 덕질카드. 첫 화면은 사진이 아니라 이 카드다 (PRD §1 가치 제안 1).
 * 취미 Top3 + 최애 + 요즘 빠진 것을 표시. 사진(avatarSrc)은 가산점일 뿐
 * 없어도 완결돼 보여야 한다 (M6 — P4는 사진 없이 Lv2까지 전 기능 사용).
 * 외모 점수·매력 평가류 슬롯은 만들지 않는다 (C1 §4.1 원칙 5).
 */
export interface DuckCardProps {
  nickname: string;
  /** 취미 Top3 — 3개 초과분은 잘라서 표시 */
  topHobbies: readonly string[];
  /** 최애 (아티스트·작품·팀 등) */
  bias?: string;
  /** 요즘 빠진 것 */
  obsession?: string;
  verifyLevel?: VerifyLevel;
  avatarSrc?: string;
  /** 액션 영역 (좋아요 버튼 등) — 화면 소유 에이전트가 주입 */
  footer?: React.ReactNode;
  className?: string;
}

export function DuckCard({
  nickname,
  topHobbies,
  bias,
  obsession,
  verifyLevel,
  avatarSrc,
  footer,
  className,
}: DuckCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 text-ink shadow-sm",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <Avatar name={nickname} src={avatarSrc} size="md" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-h2">{nickname}</h3>
          {verifyLevel !== undefined && (
            <div>
              <VerifyLevelBadge level={verifyLevel} />
            </div>
          )}
        </div>
      </header>

      <ul aria-label="취미 Top 3" className="flex flex-wrap gap-2">
        {topHobbies.slice(0, 3).map((hobby) => (
          <li key={hobby}>
            <HobbyChip label={hobby} selectable={false} />
          </li>
        ))}
      </ul>

      {(bias || obsession) && (
        <dl className="flex flex-col gap-2">
          {bias && (
            <div className="flex flex-col">
              <dt className="text-caption text-ink-muted">최애</dt>
              <dd className="text-body">{bias}</dd>
            </div>
          )}
          {obsession && (
            <div className="flex flex-col">
              <dt className="text-caption text-ink-muted">요즘 빠진 것</dt>
              <dd className="text-body">{obsession}</dd>
            </div>
          )}
        </dl>
      )}

      {footer && <footer className="mt-1 flex items-center gap-2">{footer}</footer>}
    </article>
  );
}
