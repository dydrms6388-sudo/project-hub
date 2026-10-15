// 대출 규제(DSR·LTV) 데이터 — 감독규정·금융위 발표 출처.
// 지역·시점별로 자주 바뀌는 값은 todo + 직접 입력 옵션으로 처리.
const CHECKED = "2026-08-19";

export const loanRules = {
  // 차주단위 DSR 한도 (은행업감독규정 / 상호금융업감독규정 등)
  dsrLimit: {
    value: { bankPct: 40, nonBankPct: 50 },
    source: "https://www.law.go.kr/행정규칙/은행업감독규정",
    checkedAt: CHECKED,
  },
  // 스트레스 DSR 가산금리 — 단계별 시행으로 적용 가산치가 변동. 최신 고시 확인 필요.
  stressRate: {
    value: { defaultAddPct: 1.5, note: "스트레스 금리 가산치는 시행 단계·지역·상품에 따라 다름" },
    source: "https://www.fsc.go.kr/no010101",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "스트레스 DSR 가산금리는 금융위 단계별 시행값이 바뀔 수 있어 최신 발표 확인 필요. 아래 입력란에서 직접 조정.",
  },
  // DSR 산정 시 기타대출 만기 가정(신용대출 등) — 세부 산정방식은 은행별·규정별 상이 → 참고 안내
  dsrAssumptions: {
    value: { creditLoanYears: 5, note: "신용대출은 통상 5년 분할상환 가정으로 연 원리금 환산(세부 기준은 감독규정·은행별 상이)" },
    source: "https://www.fsc.go.kr/no010101",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "대출 종류별 연 원리금 환산 방식은 감독규정 세칙에 따라 다름 — 정확한 한도는 은행 심사 기준.",
  },
  // LTV 상한 — 지역·주택수·차주 유형별로 수시 변경 → 대표값 + todo + 직접 입력
  ltvPresets: {
    value: [
      { key: "nonreg",   label: "비규제지역 (무주택·1주택 처분조건)", pct: 70 },
      { key: "reg",      label: "규제지역 (무주택·1주택 처분조건)",   pct: 50 },
      { key: "first",    label: "생애최초 구입자",                    pct: 80 },
      { key: "multi",    label: "규제지역 다주택자",                  pct: 30 },
    ],
    source: "https://www.law.go.kr/행정규칙/은행업감독규정",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "LTV 상한은 지역 규제 지정·해제와 함께 수시로 바뀜. 최신 규제지역 여부와 함께 은행 확인 필요 — 직접 입력 옵션 제공.",
  },
  // 방공제(소액임차보증금) — 지역별 금액, 주택임대차보호법 시행령. 개정 잦음 → todo
  smallDeposit: {
    value: [
      { region: "서울", won: 55_000_000 },
      { region: "과밀억제권역·용인·화성·세종·김포", won: 48_000_000 },
      { region: "광역시·안산·광주·파주·이천·평택", won: 28_000_000 },
      { region: "그 밖의 지역", won: 25_000_000 },
    ],
    source: "https://www.law.go.kr/법령/주택임대차보호법시행령/제10조",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "소액임차보증금(방공제) 금액은 시행령 개정으로 바뀔 수 있음 — 직접 입력 확인 필요.",
  },
};
