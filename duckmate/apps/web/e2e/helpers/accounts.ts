// =============================================================================
// G1 · 테스트 계정 팩토리
//
// 규칙
//  · 실계정과 절대 섞이지 않도록 이메일은 항상 E2E_EMAIL_DOMAIN(기본
//    `e2e.duckmate.invalid` — RFC 6761 예약 TLD) 을 쓴다. 운영 DB 정리 시
//    `like 'dm-e2e-%'` 로 한 번에 골라낼 수 있게 로컬 파트에 접두어를 박는다.
//  · 민감정보(실명·실번호·주민번호) 금지 — 닉네임은 무의미 문자열, 휴대폰은
//    010 + 랜덤 8자리(스텁 검증이므로 실제 발송 없음).
//  · 생년월일은 항상 성인. 미성년 케이스는 age-gate.spec.ts 가 별도로 만든다.
// =============================================================================

export interface TestAccount {
  email: string;
  password: string;
  nickname: string;
  /** YYYY-MM-DD */
  birthDate: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: "f" | "m" | "n";
  regionCode: string;
  /** 하이픈 없는 11자리 */
  phone: string;
}

const EMAIL_DOMAIN = process.env.E2E_EMAIL_DOMAIN?.trim() || "e2e.duckmate.invalid";
const EMAIL_PREFIX = "dm-e2e";

let counter = 0;

function uniqueToken(): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

/** 010 + 8자리. 스텁 인증이라 실제 발송·중복 검사는 없지만 형식은 서버 정규식을 통과해야 한다. */
function randomPhone(): string {
  const tail = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `010${tail}`;
}

/**
 * 성인 계정 1개를 만든다(아직 가입 전 — 값만 생성).
 * @param label 리포트에서 A/B 를 구분하기 위한 짧은 라벨
 */
export function makeAccount(label = "u"): TestAccount {
  const token = uniqueToken();
  return {
    email: `${EMAIL_PREFIX}-${label}-${token}@${EMAIL_DOMAIN}`,
    password: "DuckMate-e2e-1234",
    // 닉네임 2~12자 제약 (signup-form) — 라벨 + 토큰 6자
    nickname: `덕${label}${token.slice(-4)}`.slice(0, 12),
    birthDate: "1995-03-21",
    birthYear: "1995",
    birthMonth: "03",
    birthDay: "21",
    gender: "n",
    regionCode: "seoul",
    phone: randomPhone(),
  };
}

/** 만 19세 미만이 되는 생년월일 (오늘 기준 만 17세) — 절대 규칙 2 검증용 */
export function underageBirth(): { year: string; month: string; day: string; date: string } {
  const now = new Date();
  const year = now.getUTCFullYear() - 17;
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return { year: String(year), month, day, date: `${year}-${month}-${day}` };
}

/** 만 19세 생일 **하루 전** — 경계값(만 18세 364일)도 차단돼야 한다 */
export function almostAdultBirth(): { year: string; month: string; day: string } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() - 19, now.getUTCMonth(), now.getUTCDate() + 1));
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}
