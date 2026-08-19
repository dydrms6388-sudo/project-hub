// 사업자 정보는 이 파일 한 곳에서만 관리한다 (스펙 §7).
// 값 미입력 시 빌드 경고를 띄우되 차단하지는 않는다 (절대 규칙 4).

export const company = {
  serviceName: "덕메이트",
  legalName: "[TODO_사업자정보:법인명]",
  ceo: "[TODO_사업자정보:대표자]",
  bizRegNo: "[TODO_사업자정보:사업자등록번호]",
  mailOrderNo: "[TODO_사업자정보:통신판매업신고번호]",
  address: "[TODO_사업자정보:사업장주소]",
  privacyOfficer: "[TODO_사업자정보:개인정보보호책임자]",
  youthOfficer: "[TODO_사업자정보:청소년보호책임자]",
  contactEmail: "[TODO_사업자정보:대표이메일]",
  phone: "[TODO_사업자정보:대표전화]",
} as const;

export const hasPlaceholders = Object.values(company).some((v) =>
  v.includes("[TODO_사업자정보")
);

if (hasPlaceholders && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️  [duckmate] 사업자 정보가 플레이스홀더 상태입니다. apps/company/config/company.ts 를 채우세요."
  );
}
