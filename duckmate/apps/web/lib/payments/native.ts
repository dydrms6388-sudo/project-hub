/**
 * 플랫폼 플래그 (B3 §0-9·10) — 결제·웹 유도 문구·외부 링크 분기는 전부 이 파일만 참조한다.
 *
 * Phase 1~3: 웹만 존재 → `isNativeApp()` 은 항상 false.
 * Phase 4 (Capacitor 도입) 교체 지점: 아래 `isNativeApp` 본문을
 *   `return Capacitor.isNativePlatform() || buildTarget() !== "web";`
 * 로 바꾸고, `@capacitor/core` 를 apps/web 의존성에 추가한다. 다른 파일은 손대지 않는다.
 * (B3 는 `packages/db/src/platform.ts` 를 제안했지만 db 패키지는 런타임 의존성 0 원칙이라 apps/web 에 둔다.)
 */
import type { ReactNode } from "react";

export type BuildTarget = "web" | "ios" | "android";

/** 빌드타임 상수 `NEXT_PUBLIC_BUILD_TARGET` (정적 export 트리쉐이킹용). 미설정 = web */
export function buildTarget(): BuildTarget {
  const v = process.env.NEXT_PUBLIC_BUILD_TARGET;
  return v === "ios" || v === "android" ? v : "web";
}

/** 단일 런타임 플래그. Phase 1~3 항상 false. */
export function isNativeApp(): boolean {
  return false; // Phase 4: Capacitor.isNativePlatform() || buildTarget() !== "web"
}

/**
 * `<WebOnly>` 래퍼 계약 (E4 가 컴포넌트 구현): `isNativeApp()` 이면 children 을 **렌더 0**(fallback 만).
 * 웹 결제 유도 문구·Toss UI·가격 비교·"웹에서 더 싸게" 류는 전부 이 안에만 둔다(B3 §0-10, 3.1.1).
 */
export type WebOnlyProps = {
  children: ReactNode;
  /** 앱 빌드에서 대신 보여줄 것(예: "구독 관리는 App Store 에서"). 기본 null */
  fallback?: ReactNode;
};
export type WebOnlyComponent = (props: WebOnlyProps) => ReactNode;

/** 앱 번들 grep 가드(`scripts/check-store-copy.mjs`, Phase 4)가 잡을 금지어 */
export const STORE_COPY_FORBIDDEN_WORDS = ["웹에서", "홈페이지에서 결제", "toss", "토스"] as const;
