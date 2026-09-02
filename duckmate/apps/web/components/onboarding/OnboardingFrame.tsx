"use client";

/**
 * 온보딩 공통 프레임 (12_flows §2): 상단 진행 바(6칸 고정, photos 도 6/6) + 뒤로가기(S1·S2·S3 제외) + 헤드라인·서브카피.
 * E1 결정: OnboardingProgress total=6, labels = 12_flows 6단계 라벨.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button, OnboardingProgress, cn } from "@duckmate/ui";
import { COPY } from "./copy";

export const ONBOARDING_TOTAL = 6;
export const ONBOARDING_LABELS = ["연령 확인", "휴대폰 인증", "기본 정보", "취미 선택", "궁합 퀴즈", "덕질 카드"];

export type OnboardingStepIndex = 1 | 2 | 3 | 4 | 5 | 6;

export interface OnboardingFrameProps {
  step: OnboardingStepIndex;
  headline: React.ReactNode;
  sub?: React.ReactNode;
  /** 뒤로가기 href. 생략 시 버튼 없음 */
  backHref?: string;
  /** 하단 고정 액션 영역 */
  footer?: React.ReactNode;
  /** 진행 바 숨김(인증 게이트 등) */
  hideProgress?: boolean;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export function OnboardingFrame({ step, headline, sub, backHref, footer, hideProgress, children, className, testId }: OnboardingFrameProps) {
  const router = useRouter();
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background", className)} data-testid={testId}>
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-4 pt-3 pb-2">
        {backHref ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={COPY.common.back}
            data-testid="onb-back"
            onClick={() => router.push(backHref)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
        ) : (
          <span className="size-11 shrink-0" aria-hidden="true" />
        )}
        {!hideProgress ? <OnboardingProgress current={step} total={ONBOARDING_TOTAL} labels={ONBOARDING_LABELS} className="flex-1" /> : <span className="flex-1" />}
      </header>
      <main className="flex flex-1 flex-col gap-6 px-5 pb-6 pt-2">
        <div>
          <h1 className="text-h1 text-foreground">{headline}</h1>
          {sub ? <p className="mt-2 text-body text-muted-foreground">{sub}</p> : null}
        </div>
        {children}
      </main>
      {footer ? <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-background px-5 pt-3 pb-safe pb-4">{footer}</div> : null}
    </div>
  );
}

/** 폼 오류 문구 — aria-describedby 로 연결 */
export function FieldError({ id, message }: { id: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-body-sm text-destructive">
      {message}
    </p>
  );
}
