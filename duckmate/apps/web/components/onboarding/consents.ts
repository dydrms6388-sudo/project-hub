/** 동의 상태 (순수 모듈 — 테스트·서버에서 import 가능). 화면은 ConsentChecklist.tsx */
export type ConsentValue = { terms: boolean; privacy: boolean; youthPolicy: boolean; marketingPush: boolean };

export const EMPTY_CONSENTS: ConsentValue = { terms: false, privacy: false, youthPolicy: false, marketingPush: false };

export function consentsComplete(v: ConsentValue): boolean {
  return v.terms && v.privacy && v.youthPolicy;
}

/** 서버 액션 페이로드 (15_auth §0-6: evidenceSnapshot = terms, 약관 요약 3줄 노출 후) */
export function toConsentPayload(v: ConsentValue) {
  return { terms: v.terms, privacy: v.privacy, youthPolicy: v.youthPolicy, evidenceSnapshot: v.terms, marketingPush: v.marketingPush };
}
