import { notFound } from "next/navigation";
import { MeScreen } from "@/components/profile/MeScreen";
import { SettingsHubScreen } from "@/components/settings/SettingsHubScreen";
import type { MyProfileView } from "@/components/profile/types";

/**
 * /dev/profile — 로그인 없이 E4 화면을 목 데이터로 렌더하는 개발용 라우트 (스크린샷·시각 점검). 프로덕션 404.
 * 서버 액션은 호출되지 않도록 화면만 렌더한다(버튼을 누르면 로그인 리다이렉트).
 */
export const dynamic = "force-static";

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

export default function DevProfilePage() {
  if (process.env.NODE_ENV === "production") notFound();
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
