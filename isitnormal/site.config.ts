/**
 * 정상인가요 — 사이트 전역 설정 (단일 진실원천)
 *
 * 도메인 결정: tomatoeggcat.com 거절 이력과 완전 격리하기 위해 **별도 도메인**으로 심사받는다.
 * 실제 등록 도메인은 배포 시 NEXT_PUBLIC_SITE_URL 로 주입한다. 아래 기본값은 등록 전 플레이스홀더다.
 * (플레이스홀더인 채로 색인/애드센스 제출 금지 — P7 자가진단의 "도메인 인증" 항목에서 확인.)
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://isitnormal.example";

export const SITE_NAME = "정상인가요";
export const SITE_TAGLINE = "우리집만 이래? — 익명 투표로 1탭에 확인하는 통계 커뮤니티";

/** 전 UGC 페이지 하단 고정 고지 (L5) */
export const UGC_DISCLAIMER =
  "이용자 작성 콘텐츠이며 운영자는 진위를 보증하지 않습니다.";

/** robots Disallow 경로 (U1) */
export const ROBOTS_DISALLOW = ["/s/", "/api/", "/pending/", "/vote/"];
