/**
 * E2E 계정 픽스처.
 *  - phase1: 신규 가입 2명(A·B). 번호는 seed.sql 예약 번호대(010-0000-xxxx)에서 시드 계정과 겹치지 않는 11·12.
 *    고정 OTP 는 supabase/config.toml `[auth.sms.test_otp]` (821000000011 → 000011, 821000000012 → 000012) — 로컬/스테이징 전용.
 *  - 시드 계정(서윤 01 / 민재 03 등)은 이미 온보딩 완료 상태라 가입 플로우 검증에는 쓰지 않는다.
 * 실명·이메일 등 민감정보 없음. 닉네임은 2~10자·`가-힣 a-z A-Z 0-9 _ .` 규칙(15_auth §0-12).
 */
export type E2EUser = {
  key: "A" | "B";
  /** 화면 입력용 (서버가 E.164 로 정규화) */
  phoneInput: string;
  /** E.164 숫자만 (service role 헬퍼에서 auth.users.phone 과 대조) */
  phoneE164: string;
  otp: string;
  birth: { year: string; month: string; day: string };
  nickname: string;
  gender: "female" | "male";
  sido: string;
  sigungu: string;
  /** 취미 카테고리(DB slug) + 칩 slug — A·B 가 겹치도록 같은 카테고리/같은 첫 칩 */
  hobbyCategory: string;
  hobbyChips: string[];
  favNote: string;
  nowInto: string;
};

export const USER_A: E2EUser = {
  key: "A",
  phoneInput: "010-0000-0011",
  phoneE164: "821000000011",
  otp: process.env.E2E_OTP_A ?? "000011",
  birth: { year: "1996", month: "3", day: "14" },
  nickname: "테스터A",
  gender: "female",
  sido: "서울",
  sigungu: "마포구",
  hobbyCategory: "performance",
  hobbyChips: ["idol", "concert", "musical"],
  favNote: "컴백 무대",
  nowInto: "컴백 무대 정주행",
};

export const USER_B: E2EUser = {
  key: "B",
  phoneInput: "010-0000-0012",
  phoneE164: "821000000012",
  otp: process.env.E2E_OTP_B ?? "000012",
  birth: { year: "1995", month: "11", day: "20" },
  nickname: "테스터B",
  gender: "male",
  sido: "서울",
  sigungu: "마포구",
  hobbyCategory: "performance",
  hobbyChips: ["idol", "musical", "concert"],
  favNote: "같은 최애",
  nowInto: "콘서트 티켓팅",
};

/** 마스킹 검증용 본문 (D4 CT_PHONE 룰). 실제 번호 아님 */
export const PHONE_MESSAGE = "제 번호는 010-1234-5678 이에요";
