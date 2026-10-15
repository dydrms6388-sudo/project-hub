"use client";

import * as React from "react";
import { AppFrame } from "@/components/discover/AppFrame";
import { HomeScreen } from "@/components/discover/HomeScreen";
import { MatchScreen } from "@/components/discover/MatchScreen";
import { RecoDoneScreen } from "@/components/discover/RecoDoneScreen";
import { RecoScreen } from "@/components/discover/RecoScreen";
import { createMockApi, MOCK_HOME, MOCK_MATCH, MOCK_TODAY } from "@/components/discover/mock";

export type DevScreen = "reco" | "match" | "home" | "done";

const PATH: Record<DevScreen, string> = { reco: "/reco", match: `/match/${MOCK_MATCH.matchId}`, home: "/home", done: "/reco/done" };

export function DevDiscover({ screen, safety }: { screen: DevScreen; safety: boolean }) {
  const [api] = React.useState(() => createMockApi({ safetyModal: safety }));
  const [nav, setNav] = React.useState<string | null>(null);
  const onNavigate = (href: string) => setNav(href);
  return (
    <AppFrame verifyLevel={2} mode="friend" chatBadge={2} sanction={null} pathnameOverride={PATH[screen]}>
      {nav ? (
        <p className="m-4 rounded-md bg-muted px-3 py-2 text-body-sm" data-testid="dev-nav">
          navigate → <code>{nav}</code>{" "}
          <button type="button" className="underline" onClick={() => setNav(null)}>
            되돌리기
          </button>
        </p>
      ) : null}
      {screen === "reco" ? <RecoScreen initial={MOCK_TODAY} api={api} onNavigate={onNavigate} /> : null}
      {screen === "match" ? <MatchScreen matchId={MOCK_MATCH.matchId} initial={{ ...MOCK_MATCH, showSafetyModal: safety }} api={api} onNavigate={onNavigate} skipReveal /> : null}
      {screen === "home" ? <HomeScreen initial={{ ...MOCK_HOME, showSafetyModal: safety }} api={api} nickname="서윤" /> : null}
      {screen === "done" ? <RecoDoneScreen summary={{ ...MOCK_HOME.summary, reco_remaining: 0 }} /> : null}
    </AppFrame>
  );
}
