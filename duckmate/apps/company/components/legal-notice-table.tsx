import { company, display, TODO_PLACEHOLDER } from "@/config/company";

/**
 * LegalNoticeTable (C4 D-2 / §3.1) — 표시 항목은 company.ts 필드와 1:1.
 * 빈 값은 숨기지 않고 `[TODO_사업자정보]` 를 그대로 노출한다 (스펙 §0-4).
 */
const ROWS: Array<{ label: string; value: string; note?: string }> = [
  { label: "상호(법인명)", value: display(company.legalName) },
  { label: "대표자", value: display(company.ceoName) },
  { label: "사업자등록번호", value: display(company.bizRegNo) },
  {
    label: "통신판매업 신고번호",
    value: display(company.mailOrderNo),
    note: "유료 서비스 개시 전까지 미신고 상태입니다.",
  },
  { label: "사업장 소재지", value: display(company.address) },
  { label: "대표 전화", value: display(company.phone) },
  { label: "대표 이메일", value: display(company.contactEmail) },
  {
    label: "개인정보보호책임자",
    value: `${display(company.privacyOfficer.name)} (${display(company.privacyOfficer.email)})`,
  },
  {
    label: "청소년보호책임자",
    value: `${display(company.youthOfficer.name)} (${display(company.youthOfficer.email)})`,
  },
  { label: "호스팅 서비스 제공자", value: display(company.hostingProvider) },
];

export function LegalNoticeTable() {
  const hasTodo = ROWS.some((r) => r.value.includes(TODO_PLACEHOLDER));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">사업자 정보 표시 사항</caption>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-line align-top">
                <th
                  scope="row"
                  className="w-2/5 py-3 pr-4 text-body-sm font-semibold text-ink sm:w-1/3"
                >
                  {row.label}
                </th>
                <td className="py-3 text-body-sm text-ink-muted">
                  {row.value}
                  {row.note && <span className="mt-1 block text-caption">{row.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasTodo && (
        <p className="mt-4 text-caption text-ink-muted">
          {TODO_PLACEHOLDER} 로 표시된 항목은 사업자 등록 절차 진행에 따라 확정되는 대로 이곳에
          게시됩니다.
        </p>
      )}
    </div>
  );
}
