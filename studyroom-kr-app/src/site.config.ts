export type CategoryKey = "text" | "image" | "file" | "calc" | "fun" | "dev";

export const site = {
  name: "스터디룸",
  shortName: "스터디룸",
  description: "시간표 만들기, 학점 계산기, 시험 디데이, 뽀모도로 타이머. 로그인 없이 브라우저에 저장됩니다.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://studyroom.kr",
  locale: "ko_KR",
  contactEmail: "hello@example.com",
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "",
};

export const categories: Record<CategoryKey, { label: string; color: string; bg: string }> = {
  text:  { label: "텍스트",  color: "#1F5F8B", bg: "#E8F1F8" },
  image: { label: "이미지",  color: "#8B3A62", bg: "#F8E8F0" },
  file:  { label: "파일",    color: "#5B6B1F", bg: "#F0F3E4" },
  calc:  { label: "계산기",  color: "#8B5A1F", bg: "#F8EFE3" },
  fun:   { label: "재미",    color: "#6B3A8B", bg: "#F1E8F8" },
  dev:   { label: "개발",    color: "#2F4858", bg: "#E9EEF1" },
};
