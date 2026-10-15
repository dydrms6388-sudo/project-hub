/*
 * inheritance-gift-tax/tax-constants.js — 상속세·증여세 세율·공제 상수 (단일 소스)
 * ─────────────────────────────────────────────────────────────────────────────
 * 기준: 2026년 귀속(2026-09 편집 검토). 「상속세 및 증여세법」(이하 상증법) 현행 조문.
 *   - 2024·2025년 정부 개정안(최고세율 40% 인하, 자녀공제 5억 상향 등)은 국회에서 통과되지 않아
 *     2026년 신고·납부는 아래 현행 체계를 그대로 적용한다.
 *   - 유산취득세(상속인별 과세) 전환은 논의 중이며 시행 전. 시행 시 이 파일만 갱신하면 된다.
 * 출처(1차): 국세청 상속세·증여세 항목별 설명(nts.go.kr) / 국가법령정보센터 상증법(law.go.kr)
 *   - 세율·누진공제: 상증법 §26(상속세), §56(증여세 — 상속세율 준용)
 *   - 기초공제 §18, 배우자상속공제 §19, 그 밖의 인적공제·일괄공제 §20·§21, 금융재산공제 §22
 *   - 장례비용: 상증법 시행령 §9  / 증여재산공제 §53, 혼인·출산 공제 §53의2
 *   - 신고세액공제 §69 / 세대생략 할증 §27(상속)·§57(증여)
 * ⚠️ 이 파일의 값은 배포 전 위 출처에서 직접 재확인할 것. 모델 기억으로 임의 수정 금지.
 *    각 항목의 confidence: "law"(조문 수치 확인) / "derived"(조문에서 산술 도출) 로 표기.
 */
window.TAX_CONSTANTS = {
  year: 2026,
  reviewed: "2026-09",
  sources: [
    { label: "국세청 상속세 항목별 설명", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6528&cntntsId=7956" },
    { label: "국세청 증여세 항목별 설명", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6533&cntntsId=7960" },
    { label: "국가법령정보센터 — 상속세 및 증여세법", url: "https://www.law.go.kr/법령/상속세및증여세법" },
    { label: "찾기쉬운 생활법령정보 — 상속세 계산 및 납부", url: "https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=255&ccfNo=7&cciNo=2&cnpClsNo=1" },
  ],

  // ── 세율표 (상속세·증여세 공통, 상증법 §26·§56) — 5단계 초과누진 ──
  // 누진공제는 구간 경계에서 산술 도출: 1억×(20−10)%=1천만, +5억×10%=6천만, +10억×10%=1.6억, +30억×10%=4.6억
  brackets: [
    { upTo: 100000000,   rate: 0.10, deduct: 0,         label: "1억 이하",     confidence: "law" },
    { upTo: 500000000,   rate: 0.20, deduct: 10000000,  label: "1억~5억",      confidence: "derived" },
    { upTo: 1000000000,  rate: 0.30, deduct: 60000000,  label: "5억~10억",     confidence: "derived" },
    { upTo: 3000000000,  rate: 0.40, deduct: 160000000, label: "10억~30억",    confidence: "derived" },
    { upTo: Infinity,    rate: 0.50, deduct: 460000000, label: "30억 초과",    confidence: "derived" },
  ],
  minTaxableBase: 500000, // 과세표준 50만원 미만이면 상속세·증여세 부과 안 함 (§25②, §55②)

  // ── 신고세액공제 (§69) : 법정 신고기한 내 신고 시 산출세액(할증 포함, 기납부세액 차감 후)의 3% ──
  filingCreditRate: 0.03, // 2019년 이후 상속·증여분

  // ── 세대생략 할증 (§27 상속 / §57 증여) ──
  generationSkip: { rate: 0.30, minorLargeRate: 0.40, minorLargeThreshold: 2000000000 }, // 미성년자가 20억 초과 취득 시 40%

  inheritance: {
    basicDeduction: 200000000,          // 기초공제 2억 (§18①)
    lumpSumDeduction: 500000000,        // 일괄공제 5억 (§21) — 기초+그 밖의 인적공제 합계와 비교해 큰 금액 선택
    childDeduction: 50000000,           // 자녀공제 1인당 5천만 (§20①1)
    minorPerYear: 10000000,             // 미성년자공제 1천만 × (19세 도달까지 연수) (§20①2)
    minorAge: 19,
    elderlyDeduction: 50000000,         // 연로자공제(65세 이상 동거가족) 1인당 5천만 (§20①3)
    elderlyAge: 65,
    disabledPerYear: 10000000,          // 장애인공제 1천만 × 기대여명 연수 (§20①4)
    spouse: { min: 500000000, max: 3000000000, shareVsChild: 1.5 }, // 배우자공제 최소 5억·최대 30억, 법정상속분 배우자 1.5 : 자녀 1 (§19, 민법 §1009)
    // 금융재산상속공제 (§22): 순금융재산 2천만 이하 전액 / 2천만~1억 → 2천만 / 1억~10억 → 20% / 10억 초과 → 2억
    financial: { fullBelow: 20000000, fixedBelow: 100000000, fixedAmount: 20000000, rate: 0.20, cap: 200000000 },
    // 장례비용 (시행령 §9): 증빙 없어도 500만, 증빙 시 최대 1,000만 + 봉안시설·자연장지 비용 별도 500만 한도
    funeral: { min: 5000000, max: 10000000, columbarium: 5000000 },
    priorGiftYearsHeir: 10, // 상속개시 전 상속인에게 증여한 재산 10년 합산 (§13) — 상속인 외는 5년
  },

  gift: {
    // 증여재산공제 (§53): 수증자 기준, 동일 그룹 증여자 합산 10년 누계
    deductions: {
      spouse:        { amount: 600000000, label: "배우자" },
      lineal_asc:    { amount: 50000000,  label: "직계존속(성년 수증자)" },
      lineal_asc_minor: { amount: 20000000, label: "직계존속(미성년 수증자)" },
      lineal_desc:   { amount: 50000000,  label: "직계비속" },
      relative:      { amount: 10000000,  label: "기타 친족(6촌 이내 혈족·4촌 이내 인척)" },
      other:         { amount: 0,         label: "타인(공제 없음)" },
    },
    // 혼인·출산 증여재산공제 (§53의2, 2024-01-01 이후 증여분): 직계존속으로부터 혼인신고 전후 2년 / 출생·입양 후 2년 내 증여, 통합 한도 1억(기본공제와 별도)
    marriageBirth: { amount: 100000000 },
    aggregationYears: 10, // 동일인(직계존속은 배우자 포함) 10년 내 합산 1천만 이상 시 합산 (§47②)
  },
};
