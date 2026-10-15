import * as React from "react";
import { cn } from "./cn";

/**
 * MatchReveal — 매칭 리빌 컨테이너 (Phase 1 = 단순 모달 콘텐츠, M8).
 * 스크래치 등 인터랙션 연출은 Phase 2 F그룹 소관 — 여기는 CSS 애니메이션만.
 * 총 재생 시간 약 1.1초 (5초 제한 내), prefers-reduced-motion 존중.
 * 배경은 딥 바이올렛(brand-800→900) — 매칭 리빌 전용 딥 배경 (C1 §2.2 용도 규약).
 * 닫기/나중에 버튼은 화면 쪽에서 CTA 대비 70% 이상 크기로 항상 제공할 것 (D-4).
 */
export interface MatchRevealProps {
  /** 헤드라인 — 해요체, 재촉 금지 (C1 §4.2 "취향이 통했어요!") */
  headline?: string;
  /** 보조 문구 (선택) */
  subline?: string;
  /** 궁합 게이지·상대 덕질카드·첫 대화 제안 CTA 등 */
  children: React.ReactNode;
  className?: string;
}

export function MatchReveal({
  headline = "취향이 통했어요!",
  subline,
  children,
  className,
}: MatchRevealProps) {
  return (
    <section
      aria-label="매칭 성공"
      className={cn(
        "relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl",
        "bg-linear-to-b from-brand-800 to-brand-900 p-8 text-center",
        className,
      )}
    >
      <div className="animate-reveal-pop flex flex-col gap-2 motion-reduce:animate-none">
        <h2 className="text-display text-white">{headline}</h2>
        {subline && <p className="text-body text-brand-200">{subline}</p>}
      </div>
      <div className="animate-reveal-rise w-full motion-reduce:animate-none">{children}</div>
    </section>
  );
}
