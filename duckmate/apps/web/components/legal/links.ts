/** 클라이언트 컴포넌트에서도 쓰는 법적 문서 링크 7종 (lib/legal/index.ts 와 동일 값 — fs 의존 모듈을 클라이언트에 끌어오지 않기 위한 사본). */
export const LEGAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/legal/terms", label: "이용약관" },
  { href: "/legal/privacy", label: "개인정보처리방침" },
  { href: "/legal/location", label: "위치정보 이용약관" },
  { href: "/legal/youth", label: "청소년보호정책" },
  { href: "/legal/community", label: "커뮤니티 가이드라인" },
  { href: "/legal/refund", label: "환불정책" },
  { href: "/legal/business", label: "사업자 정보" },
];
