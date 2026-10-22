import { describe, expect, it } from "vitest";
import { maxAdultBirthYear, onboardingSchema, profileUpdateSchema } from "@/lib/validation/profile";
import { cleanText, findPersonalInfo } from "@/lib/validation/text";

const base = { adultConfirmed: true, privacyConsent: true, sensitiveConsent: true };

describe("성인 기준", () => {
  it("만 19세가 되는 해부터 성인", () => {
    expect(maxAdultBirthYear(new Date("2026-01-01T00:00:00+09:00"))).toBe(2007);
    expect(maxAdultBirthYear(new Date("2026-12-31"))).toBe(2007);
  });
});

describe("onboardingSchema", () => {
  const ok = { ...base, nickname: "하늘", birthYear: 1995, sido: "서울", sigungu: "마포구" };
  it("최소 입력으로 통과", () => {
    expect(onboardingSchema.parse(ok)).toMatchObject({ nickname: "하늘", birthYear: 1995, dong: null });
  });
  it("동의 없이 시작할 수 없다", () => {
    for (const k of ["adultConfirmed", "privacyConsent", "sensitiveConsent"]) {
      expect(onboardingSchema.safeParse({ ...ok, [k]: false }).success).toBe(false);
    }
  });
  it("미성년 출생연도 거부", () => {
    expect(onboardingSchema.safeParse({ ...ok, birthYear: maxAdultBirthYear() + 1 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, birthYear: maxAdultBirthYear() }).success).toBe(true);
  });
  it("지역 정합성", () => {
    expect(onboardingSchema.safeParse({ ...ok, sido: "화성" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, sigungu: "해운대구" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, sigungu: "", dong: "역삼동" }).success).toBe(false);
  });
  it("닉네임에 HTML/연락처 불가", () => {
    expect(onboardingSchema.safeParse({ ...ok, nickname: "<b>x</b>" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ok, nickname: "01012345678" }).success).toBe(false);
  });
  it("허니팟이 채워지면 거부 (봇)", () => {
    expect(onboardingSchema.safeParse({ ...ok, website: "http://spam" }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  const ok = { nickname: "하늘", birthYear: 1995, sido: "서울" };
  it("빈 선택값은 null/[] 로 정규화", () => {
    expect(profileUpdateSchema.parse({ ...ok, height: "", bodyType: "", bio: "" })).toMatchObject({
      height: null,
      bodyType: null,
      bio: null,
      styles: [],
      visibility: {},
    });
  });
  it("범위·선택지 검사", () => {
    expect(profileUpdateSchema.safeParse({ ...ok, height: 300 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...ok, bodyType: "huge" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...ok, interests: Array(11).fill("cafe") }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...ok, expiresInDays: 7 }).success).toBe(false);
  });
  it("성향은 별도 동의가 있어야 저장", () => {
    expect(profileUpdateSchema.safeParse({ ...ok, position: "top" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...ok, position: "top", positionConsent: true }).success).toBe(true);
  });
  it("자기소개에 전화번호·이메일·주민번호·링크 불가", () => {
    for (const bio of ["연락 010-1234-5678", "mail me a@b.com", "900101-1234567", "https://x.com 오세요"]) {
      expect(profileUpdateSchema.safeParse({ ...ok, bio }).success).toBe(false);
    }
    expect(profileUpdateSchema.safeParse({ ...ok, bio: "키 180, 2025년부터 러닝 중" }).success).toBe(true);
  });
  it("공개 설정 키는 허용 목록만", () => {
    expect(profileUpdateSchema.safeParse({ ...ok, visibility: { height: "private" } }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ ...ok, visibility: { status: "public" } }).success).toBe(false);
  });
});

describe("text", () => {
  it("cleanText 는 제어/zero-width/bidi 문자를 제거", () => {
    expect(cleanText("  안​녕‮\u0007  ")).toBe("안녕");
  });
  it("findPersonalInfo", () => {
    expect(findPersonalInfo("+82 10 1234 5678")).toBe("phone");
    expect(findPersonalInfo("평범한 소개")).toBeNull();
  });
});
