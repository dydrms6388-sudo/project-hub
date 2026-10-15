// 취득세(주택 유상취득) 데이터 — 전부 법령 출처. 값 변경 시 checkedAt 갱신.
// 형식: { value, source(URL), checkedAt, todo?(불확실→UI '확인 필요' 배지) }
const CHECKED = "2026-08-19";

export const acquisition = {
  // 표준세율 (지방세법 제11조 제1항 제8호 — 주택 유상거래)
  standardRates: {
    value: {
      lowMax: 600_000_000,      // 6억 이하 → 1%
      lowRatePct: 1,
      midMax: 900_000_000,      // 6억 초과 9억 이하 → (가액×2/3억 − 3)% (소수점 넷째자리까지)
      midFormula: "취득가액 × 2/3억 − 3 (%)",
      highRatePct: 3,           // 9억 초과 → 3%
    },
    source: "https://www.law.go.kr/법령/지방세법/제11조",
    checkedAt: CHECKED,
  },
  // 다주택·법인 중과세율 (지방세법 제13조의2)
  // ⚠ 정부의 중과 완화(인하) 개정 논의가 있어 최신 개정 여부 확인 필요 → todo + 직접 입력 옵션 제공
  surchargeRates: {
    value: {
      adjusted2HomesPct: 8,     // 조정대상지역 2주택
      adjusted3HomesPct: 12,    // 조정대상지역 3주택 이상
      nonAdjusted3HomesPct: 8,  // 비조정 3주택
      nonAdjusted4HomesPct: 12, // 비조정 4주택 이상·법인
    },
    source: "https://www.law.go.kr/법령/지방세법/제13조의2",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "다주택 중과세율 완화 개정안이 논의된 바 있어 최신 개정·시행 여부 확인 필요. 직접 입력 옵션 사용 가능.",
  },
  // 지방교육세 (지방세법 제151조) — 주택 유상 표준세율분: 취득세율×1/2 의 20% (= 취득가액×취득세율×0.1)
  eduTaxRule: {
    value: {
      standardFactor: 0.1,      // 취득세율 × 0.1 (%p 기준: 1%→0.1%, 3%→0.3%)
      surchargedPct: 0.4,       // 중과(8·12%) 적용 시 0.4% 고정
    },
    source: "https://www.law.go.kr/법령/지방세법/제151조",
    checkedAt: CHECKED,
  },
  // 농어촌특별세 (농어촌특별세법 제5조) — 전용 85㎡ 초과 시
  ruralTaxRule: {
    value: {
      exemptMaxArea: 85,        // 전용 85㎡ 이하 비과세
      standardPct: 0.2,         // 표준세율분 0.2%
      surcharged8Pct: 0.6,      // 8% 중과 시 0.6%
      surcharged12Pct: 1.0,     // 12% 중과 시 1.0%
    },
    source: "https://www.law.go.kr/법령/농어촌특별세법",
    checkedAt: CHECKED,
  },
  // 생애최초 주택 취득세 감면 (지방세특례제한법 제36조의3) — 한도·요건 개정 잦음 → 안내만
  firstHomeRelief: {
    value: { maxReliefWon: 2_000_000, note: "12억 이하 생애최초 취득 시 200만원 한도 감면(요건 있음)" },
    source: "https://www.law.go.kr/법령/지방세특례제한법/제36조의3",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "감면 요건·한도는 개정이 잦아 신청 전 반드시 위택스·시군구 확인 필요.",
  },
};
