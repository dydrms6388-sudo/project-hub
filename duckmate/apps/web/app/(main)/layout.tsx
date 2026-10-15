// =============================================================================
// E2 · (main) 레이아웃 — 다른 E 에이전트가 이 레이아웃 아래에 라우트를 추가한다.
//
// 【3층 가드 중 2층】 (12_flows §결정-3)
//   1층 middleware.ts       세션 유무만 판정 (수정 금지)
//   2층 여기 layout.tsx     requireOnboardingDone() = 제재(level≥3 → /sanctioned)
//                           + 온보딩 미완(→ 저장된 onboarding_step) 판정
//   3층 RLS(D1)             최종 방어
//   ※ verify_level 게이트는 라우트별로 다르다 → Lv2 이상이 필요한 라우트
//     (/chat, /chat/[matchId] 등)는 그 라우트의 layout/page 에서
//     requireVerifyLevel(2) 를 추가로 호출할 것. 여기서는 Lv1 기준만 통과시킨다.
//
// 【이 레이아웃이 제공하는 것 — 하위 라우트는 중복 구현 금지】
//   · 상단 헤더(브랜드·알림·모드 배지) / 하단 탭 4개(홈·탐색·채팅·프로필)
//   · 본문 컨테이너: max-w-screen-sm · px-4 · 하단 탭 높이만큼 pb-24
//     (페이지는 자기 화면 콘텐츠만 렌더하면 된다. 화면별 서브 헤더는 각 페이지에서)
//   · 전역 매칭 리빌 모달 <MatchRevealHost /> — 띄우려면 클라이언트에서
//     useMatchRevealStore.getState().enqueue({...}) 호출 (match-reveal-store.ts)
//   · 퍼널 계측 <TrackEvent name="..." /> + logAppEvent() (analytics.ts)
// =============================================================================

import type { Metadata } from "next";
import { requireOnboardingDone } from "@/lib/auth/guards";
import { AppHeader } from "./_components/app-header";
import { BottomTabNav } from "./_components/bottom-tab-nav";
import { MatchRevealHost } from "./_components/match-reveal-host";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOnboardingDone();

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        본문으로 건너뛰기
      </a>

      <AppHeader mode={profile.mode} />

      <main
        id="main-content"
        className="mx-auto w-full max-w-screen-sm flex-1 px-4 pb-24 pt-4"
      >
        {children}
      </main>

      <BottomTabNav />
      <MatchRevealHost />
    </div>
  );
}
