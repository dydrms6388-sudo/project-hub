// 자유 입력 텍스트 정리 + 개인정보/스팸 패턴 검사

// 제어문자·zero-width·양방향 제어문자 제거 (줄바꿈은 유지)
export function cleanText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PATTERNS: { re: RegExp; issue: PersonalInfoIssue }[] = [
  // 주민등록번호 형태
  { re: /\d{6}\s*[-–]?\s*[1-4]\d{6}/, issue: "rrn" },
  // 휴대전화/일반전화 (공백·하이픈·점 구분 포함)
  { re: /(?:\+?82[\s.-]?|0)1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/, issue: "phone" },
  { re: /\b0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4}\b/, issue: "phone" },
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, issue: "email" },
  { re: /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|kr|io|me|ly|gg)\b/i, issue: "link" },
];

export type PersonalInfoIssue = "rrn" | "phone" | "email" | "link";

export const PERSONAL_INFO_MESSAGES: Record<PersonalInfoIssue, string> = {
  rrn: "주민등록번호로 보이는 내용은 입력할 수 없어요.",
  phone: "전화번호는 자기소개에 적을 수 없어요. 연락 수단은 '연락 방법'에서 매칭 상대에게만 공개할 수 있어요.",
  email: "이메일 주소는 자기소개에 적을 수 없어요.",
  link: "링크는 자기소개 대신 '연락 방법'에 등록해 주세요.",
};

export function findPersonalInfo(text: string): PersonalInfoIssue | null {
  const compact = text.replace(/[　]/g, " ");
  for (const { re, issue } of PATTERNS) if (re.test(compact)) return issue;
  return null;
}
