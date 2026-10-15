// 반려동물 양육비 기본값 (참고용 — 실제 지출은 편집해서 계산)
// 근거: KB금융지주 경영연구소 「2023 한국 반려동물 보고서」 — 반려가구 월평균
// 양육비 약 15.4만원(치료비 제외), 농림축산식품부 동물복지 국민의식조사.
// 항목별 배분은 위 총액을 참고해 편집 가능한 기본값으로 제시한 것이며 정답이 아님.
const SRC_KB = "https://www.kbfg.com/kbresearch/";
const SRC_MAFRA = "https://www.mafra.go.kr/";
const CHECKED = "2026-08-19";

export const COST_ITEMS = [
  { key: "food", label: "사료", monthly: 60000, source: SRC_KB, checkedAt: CHECKED },
  { key: "snack", label: "간식·영양제", monthly: 30000, source: SRC_KB, checkedAt: CHECKED },
  { key: "litter", label: "위생용품(배변패드·모래)", monthly: 20000, source: SRC_KB, checkedAt: CHECKED },
  { key: "grooming", label: "미용·목욕", monthly: 20000, source: SRC_KB, checkedAt: CHECKED },
  { key: "toy", label: "장난감·용품", monthly: 10000, source: SRC_KB, checkedAt: CHECKED },
  { key: "prevention", label: "예방(심장사상충·외부기생충)", monthly: 15000, source: SRC_MAFRA, checkedAt: CHECKED },
  { key: "checkup", label: "정기검진·의료 적립", monthly: 30000, source: SRC_MAFRA, checkedAt: CHECKED },
  { key: "etc", label: "기타(호텔·유치원 등)", monthly: 0, source: SRC_KB, checkedAt: CHECKED },
];

export const COST_META = {
  note: "KB 2023 한국 반려동물 보고서 기준 반려가구 월평균 양육비는 약 15.4만원(치료비 제외). 위 항목별 금액은 이를 참고한 편집용 기본값.",
  source: SRC_KB,
  checkedAt: CHECKED,
};
