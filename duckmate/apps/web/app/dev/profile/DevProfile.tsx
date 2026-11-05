"use client";

/**
 * /dev/profile 목 렌더 (클라이언트). screen=hub(기본) | mode | report — 로그인·Supabase 없이 E4 화면을 확인한다 (G1 스모크 재현).
 *  - mode  : ModeScreen(verifyLevel 3 목) → 데이팅 선택 → 미리보기 스크롤 끝 → [확인했어요] 활성. 제출은 실제 액션(로그인 리다이렉트).
 *  - report: ReportScreen 에 목 액션 주입 → 카테고리 → 사유 → 제출 → 완료(차단 체크) 까지 서버 없이 동작.
 */
import { MeScreen } from "@/components/profile/MeScreen";
import type { MyProfileView } from "@/components/profile/types";
import { ReportScreen, type ReportActions } from "@/components/report/ReportScreen";
import { ModeScreen } from "@/components/settings/ModeScreen";
import { SettingsHubScreen } from "@/components/settings/SettingsHubScreen";
import { REPORT_COPY, slaCopyFor } from "@/lib/moderation/constants";

export type DevProfileScreen = "hub" | "mode" | "report";

const MOCK: MyProfileView = {
  profileId: "00000000-0000-4000-8000-000000000001",
  nickname: "서윤",
  ageBand: "20대 후반",
  regionLabel: "마포구",
  verifyLevel: 2,
  mode: "friend",
  seekingGender: null,
  status: "active",
  bio: "주말 아침 한강 러닝, 저녁엔 보드게임 카페.",
  nowInto: "10k 완주 준비",
  hobbies: [
    { hobbyId: 1, name: "러닝", categorySlug: "fitness", rank: 1, intensity: 4, favNote: "한강 5k 루프" },
    { hobbyId: 2, name: "보드게임", categorySlug: "boardgame", rank: 2, intensity: 3, favNote: null },
    { hobbyId: 3, name: "카페투어", categorySlug: "cafe", rank: 3, intensity: 2, favNote: null },
  ],
  photos: [],
  photoCounts: { pending: 1, approved: 0, rejected: 0, held: 0 },
  hasApprovedPrimary: false,
  quizAnswered: 3,
  quizTotal: 10,
  availabilityCount: 6,
  nicknameChangedAt: null,
};

const MINJAE = "10000000-0000-4000-8000-000000000003";
const MATCH = "30000000-0000-4000-8000-000000000001";

const mockReportActions: ReportActions = {
  submitReport: async (input) => {
    const i = input as { reasonCode: string; detail: string | null };
    await new Promise((r) => setTimeout(r, 150));
    return {
      ok: true,
      data: {
        reportId: "40000000-0000-4000-8000-00000000dead",
        deduped: false,
        priority: i.reasonCode === "ROMANCE_SCAM" ? "P0" : "P2",
        autoActions: [],
        done: {
          title: REPORT_COPY.done.title,
          sla: slaCopyFor(i.reasonCode === "ROMANCE_SCAM" ? "P0" : "P2"),
          notify: REPORT_COPY.done.notify,
          blockDefaultChecked: true,
          blockCheckbox: REPORT_COPY.done.blockCheckbox,
          blockHint: REPORT_COPY.done.blockHint,
          message: null,
        },
      },
    };
  },
  blockProfile: async (input) => {
    const i = input as { targetId: string };
    await new Promise((r) => setTimeout(r, 100));
    return { ok: true, data: { targetId: i.targetId, blocked: true } };
  },
};

export function DevProfile({ screen }: { screen: DevProfileScreen }) {
  if (screen === "mode") return <ModeScreen view={{ ...MOCK, verifyLevel: 3, hasApprovedPrimary: true }} />;
  if (screen === "report") {
    return (
      <ReportScreen
        params={{ targetId: MINJAE, matchId: MATCH, surface: "chat", presetReason: null }}
        context={{
          nickname: "민재",
          recentMessages: [
            { id: "m1", text: "안녕하세요 [연락처 숨김]", isMine: false, at: new Date(Date.now() - 3600_000).toISOString() },
            { id: "m2", text: "네 반가워요", isMine: true, at: new Date(Date.now() - 3000_000).toISOString() },
          ],
          evidenceCount: 50,
        }}
        actions={mockReportActions}
      />
    );
  }
  return (
    <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
      <div className="border-r border-border">
        <MeScreen view={MOCK} />
      </div>
      <div>
        <SettingsHubScreen mode="friend" verifyLevel={2} blockCount={2} canAppeal={false} paymentsEnabled={false} companyContactUrl={null} appVersion="0.1.0-dev" />
      </div>
    </div>
  );
}
