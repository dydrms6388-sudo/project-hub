// =============================================================================
// E3 · 신고 사유 2단 택소노미 (A5 §2 표 그대로 — 카테고리 9 → reason_code 18)
//
// reason_code 의 단일 진실은 @duckmate/db 의 REASON_CODES 다. 이 파일은 **라벨과
// 2단 그룹핑만** 담는다 — 코드 문자열을 새로 만들거나 바꾸지 말 것(서버 zod enum 이
// 그대로 검증한다).
// =============================================================================

import type { ReasonCode } from "@duckmate/db";

export interface ReasonOption {
  code: ReasonCode;
  label: string;
}

export interface ReasonCategory {
  id: string;
  label: string;
  options: ReasonOption[];
}

export const REPORT_CATEGORIES: ReasonCategory[] = [
  {
    id: "harass-sexual",
    label: "성희롱 / 성적 침해",
    options: [
      { code: "HARASS_SEXUAL", label: "성적 발언·원치 않는 성적 접근" },
      { code: "HARASS_SEXUAL_IMAGE", label: "음란 이미지 전송" },
    ],
  },
  {
    id: "harass",
    label: "괴롭힘",
    options: [
      { code: "HARASS_VERBAL", label: "욕설·모욕·비하" },
      { code: "HARASS_STALKING", label: "집요한 재접촉·미행 언급" },
      { code: "HARASS_THREAT", label: "협박·폭력 예고·신상 유포 협박" },
    ],
  },
  {
    id: "scam",
    label: "사기",
    options: [
      { code: "SCAM_MONEY", label: "금전 요구·대출·투자 권유" },
      { code: "SCAM_ROMANCE", label: "로맨스 스캠" },
      { code: "SCAM_EXTERNAL_LINK", label: "피싱·외부 사이트 유도" },
    ],
  },
  {
    id: "fake",
    label: "프로필 위조",
    options: [
      { code: "FAKE_PROFILE", label: "타인 사진 도용·AI 생성 사진·사칭" },
      { code: "FAKE_INFO", label: "나이·성별 등 핵심 정보 허위" },
    ],
  },
  {
    id: "spam",
    label: "상업 행위",
    options: [
      { code: "SPAM_AD", label: "광고·홍보·타 서비스 유도" },
      { code: "SPAM_PROSTITUTION", label: "성매매 제안·조건만남" },
    ],
  },
  {
    id: "minor",
    label: "미성년 관련",
    options: [{ code: "SAFETY_MINOR", label: "미성년자로 의심돼요" }],
  },
  {
    id: "offline",
    label: "오프라인 위해",
    options: [{ code: "SAFETY_OFFLINE", label: "만남에서의 위협·폭력·범죄" }],
  },
  {
    id: "content",
    label: "부적절 콘텐츠",
    options: [
      { code: "CONTENT_HATE", label: "혐오 발언" },
      { code: "CONTENT_ILLEGAL", label: "불법 촬영물·마약 등 불법 정보" },
      { code: "CONTENT_SELF_HARM", label: "자해·자살 암시" },
    ],
  },
  {
    id: "other",
    label: "기타",
    options: [{ code: "OTHER", label: "위에 없는 문제 (상세 입력 필수)" }],
  },
];

/** 안전 카드 → 신고 시트 프리필 (수신자가 카드에서 바로 신고할 때) */
export const SAFETY_CARD_PREFILL: Record<string, ReasonCode> = {
  money: "SCAM_MONEY",
  invest: "SCAM_MONEY",
  sexual: "HARASS_SEXUAL",
};

export function categoryOfCode(code: ReasonCode): ReasonCategory | undefined {
  return REPORT_CATEGORIES.find((c) => c.options.some((o) => o.code === code));
}
