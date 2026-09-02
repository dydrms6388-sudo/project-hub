import { notFound } from "next/navigation";
import { DevProfile, type DevProfileScreen } from "./DevProfile";

/**
 * /dev/profile — 로그인 없이 E4 화면을 목 데이터로 렌더하는 개발용 라우트 (스크린샷·시각 점검·G1 스모크). 프로덕션 404.
 *   /dev/profile            설정 허브 + 내 프로필
 *   /dev/profile?screen=mode    모드 전환(미리보기 스크롤 → 확인 활성)
 *   /dev/profile?screen=report  신고 2단계(목 액션: 카테고리 → 사유 → 제출 → 완료)
 * 서버 액션은 목이 아닌 화면(mode 제출 등)에서만 호출되며 로그인 리다이렉트로 끝난다.
 */
export const dynamic = "force-dynamic";

const SCREENS: DevProfileScreen[] = ["hub", "mode", "report"];

export default async function DevProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const raw = typeof sp.screen === "string" ? sp.screen : "hub";
  const screen = (SCREENS.includes(raw as DevProfileScreen) ? raw : "hub") as DevProfileScreen;
  return <DevProfile screen={screen} />;
}
