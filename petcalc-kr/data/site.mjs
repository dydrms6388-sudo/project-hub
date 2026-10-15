// 사이트 공통 설정 — canonical/og/sitemap 은 전부 이 상수 하나로 관리한다.
export const SITE_ORIGIN = "https://petcalc-kr.vercel.app";
export const SITE_NAME = "PetCalc 반려동물 계산기";
export const CHECKED_AT = "2026-08-19";
export const ADSENSE_CLIENT = "ca-pub-5567719201265106";

// tomatoeggcat.com 기존 도구 크로스링크 (절대 URL)
export const CROSS_LINKS = {
  petAge: { name: "반려동물 나이 계산기", url: "https://tomatoeggcat.com/pet-age-calc/", ic: "🐾" },
  petMeal: { name: "반려동물 사료량 계산기", url: "https://tomatoeggcat.com/pet-meal-calc/", ic: "🍚" },
  petVetCost: { name: "동물병원 진료비 참고", url: "https://tomatoeggcat.com/pet-vet-cost/", ic: "🏥" },
  petage2: { name: "펫나이 환산기", url: "https://tomatoeggcat.com/dydrms-petage/", ic: "🎂" },
  petSafe: { name: "반려동물 위험물 체크", url: "https://tomatoeggcat.com/dydrms-petsafe/", ic: "⚠️" },
  slimPet: { name: "반려동물 다이어트 도우미", url: "https://tomatoeggcat.com/dydrms-slimpet/", ic: "⚖️" },
  dogPersonality: { name: "강아지 성격 테스트", url: "https://tomatoeggcat.com/dog-personality-test/", ic: "🐶" },
};
