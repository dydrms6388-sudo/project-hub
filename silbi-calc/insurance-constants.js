/*
 * silbi-calc/insurance-constants.js — 실손의료보험 세대별 판별 기준·공제 규칙 상수 (단일 소스)
 * ─────────────────────────────────────────────────────────────────────────────
 * 기준: 2026-09 편집 검토. 금융감독원 실손의료보험 표준약관(2009-10 표준화 이후) 및
 *       금융위원회 보도자료(4세대 2021-07 / 5세대 2026-05) 기준. 1세대는 표준화 이전이라 회사·상품별 상이.
 * 출처(1차):
 *   - 금융감독원 보험다모아·표준약관: https://www.fss.or.kr  (실손의료보험 표준약관 개정 이력)
 *   - 금융위원회 보도자료 「4세대 실손의료보험 출시」(2021-06) / 「실손보험 개혁방안·5세대 실손」(2025-01·2026-04)
 *   - 생명·손해보험협회 실손의료보험 세대별 비교 안내
 * ⚠️ 각 세대 값은 '표준약관 기본형·선택형(자기부담 낮은 형)' 기준 대표값이다. 실제 지급액은 가입 상품·특약·
 *    갱신 약관, 한도 소진 여부, 면책 항목에 따라 달라진다. 배포 전 출처에서 재확인하고 모델 기억으로 임의 수정 금지.
 *    confidence: "standard"(표준약관 확인) / "typical"(회사별 상이, 대표값) / "press"(보도자료 기준, 출시 초기)
 */
window.INSURANCE_CONSTANTS = {
  reviewed: "2026-09",
  sources: [
    { label: "금융감독원", url: "https://www.fss.or.kr" },
    { label: "금융위원회 보도자료(실손의료보험)", url: "https://www.fsc.go.kr" },
    { label: "손해보험협회", url: "https://www.knia.or.kr" },
    { label: "생명보험협회", url: "https://www.klia.or.kr" },
  ],
  // ── 세대 판별: 가입(최초 계약 또는 전환) 연월 기준 ──
  generations: [
    {
      id: "g1", gen: 1, name: "1세대 (표준화 이전)", from: "1963-01", to: "2009-09", confidence: "typical",
      summary: "회사별 약관 상이. 손보사 상품은 입원 자기부담 0%·통원 회당 5천 원 공제가 대표적, 생보사 상품은 입원 20% 자기부담. 갱신 주기 1~5년, 재가입 없음(80·100세 만기).",
      inpatient: { payRate: 0, nonpayRate: 0, annualLimit: 100000000 },              // 자기부담 0% (손보 기준), 연 1억 한도(상품별 3천만~1억)
      outpatient: { mode: "flat", deductible: 5000, perVisitLimit: 100000, annualVisits: 30, includesPharmacy: true }, // 통원 회당 5천 공제, 회당 10만 한도(상품별 10~30만)
      renewPeriod: "1~5년 갱신 · 재가입 없음",
    },
    {
      id: "g2a", gen: 2, name: "2세대 (표준화 실손, 2009.10~2013.3)", from: "2009-10", to: "2013-03", confidence: "standard",
      summary: "전 보험사 약관 통일. 입원 자기부담 10%(연 200만 원 상한), 통원은 병원 종류별 정액 공제(의원 1만·병원 1.5만·종합/상급 2만), 처방 8천 원 공제. 통원 회당 25만(외래)+5만(처방) 한도, 연 180회.",
      inpatient: { payRate: 0.10, nonpayRate: 0.10, annualLimit: 50000000, copayCap: 2000000 },
      outpatient: { mode: "flat", flat: { clinic: 10000, hospital: 15000, general: 20000, tertiary: 20000 }, pharmacy: 8000, perVisitLimit: 250000, pharmacyLimit: 50000, annualVisits: 180 },
      renewPeriod: "1·3년 갱신 · 15년 재가입",
    },
    {
      id: "g2b", gen: 2, name: "2세대 (선택형 Ⅱ, 2013.4~2017.3)", from: "2013-04", to: "2017-03", confidence: "standard",
      summary: "실손 단독상품화. 선택형은 급여 10%·비급여 20% 자기부담(2015.9 이후), 표준형은 20%. 통원은 정액 공제(1만/1.5만/2만)와 정률(급여 10%+비급여 20%) 중 큰 금액 공제. 15년 재가입.",
      inpatient: { payRate: 0.10, nonpayRate: 0.20, annualLimit: 50000000, copayCap: 2000000 },
      outpatient: { mode: "maxFlatRate", flat: { clinic: 10000, hospital: 15000, general: 20000, tertiary: 20000 }, payRate: 0.10, nonpayRate: 0.20, pharmacy: 8000, perVisitLimit: 250000, pharmacyLimit: 50000, annualVisits: 180 },
      renewPeriod: "1년 갱신 · 15년 재가입",
    },
    {
      id: "g3", gen: 3, name: "3세대 (착한실손, 2017.4~2021.6)", from: "2017-04", to: "2021-06", confidence: "standard",
      summary: "기본형(급여 10%·비급여 20%)에 도수·체외충격파·증식치료 / 비급여 주사 / 비급여 MRI 3대 비급여를 특약으로 분리(자기부담 30%, 최소 2만 원 공제, 도수 연 50회·350만 원 등). 2년 무사고 시 보험료 10% 할인.",
      inpatient: { payRate: 0.10, nonpayRate: 0.20, annualLimit: 50000000, copayCap: 2000000 },
      outpatient: { mode: "maxFlatRate", flat: { clinic: 10000, hospital: 15000, general: 20000, tertiary: 20000 }, payRate: 0.10, nonpayRate: 0.20, pharmacy: 8000, perVisitLimit: 250000, pharmacyLimit: 50000, annualVisits: 180 },
      special3: { rate: 0.30, minDeductible: 20000, limits: { manual: { visits: 50, amount: 3500000 }, injection: { visits: 50, amount: 2500000 }, mri: { amount: 3000000 } } },
      renewPeriod: "1년 갱신 · 15년 재가입",
    },
    {
      id: "g4", gen: 4, name: "4세대 (2021.7~2026.5)", from: "2021-07", to: "2026-05", confidence: "standard",
      summary: "급여(주계약)·비급여(특약) 완전 분리. 급여 자기부담 20%(통원 최소 1만 원 의원·병원 / 2만 원 종합·상급), 비급여 30%(통원 최소 3만 원). 연 5천만+5천만 한도, 통원 회당 20만+20만, 비급여 통원 연 100회. 비급여 이용량에 따라 보험료 할인·할증. 5년 재가입.",
      inpatient: { payRate: 0.20, nonpayRate: 0.30, annualLimit: 50000000, nonpayAnnualLimit: 50000000 },
      outpatient: { mode: "split", payFlat: { clinic: 10000, hospital: 10000, general: 20000, tertiary: 20000 }, payRate: 0.20, nonpayFlat: 30000, nonpayRate: 0.30, payPerVisitLimit: 200000, nonpayPerVisitLimit: 200000, nonpayAnnualVisits: 100 },
      special3: { rate: 0.30, minDeductible: 30000, limits: { manual: { visits: 50, amount: 3500000 }, injection: { visits: 50, amount: 2500000 }, mri: { amount: 3000000 } } },
      surcharge: [ // 직전 1년 비급여 보험금 수령액 → 다음 1년 비급여 보험료 조정 (2024-07 시행)
        { label: "0원", from: 0, to: 0, adj: "약 5% 할인" },
        { label: "100만 원 미만", from: 1, to: 999999, adj: "유지" },
        { label: "100만~150만 원", from: 1000000, to: 1499999, adj: "+100% 할증" },
        { label: "150만~300만 원", from: 1500000, to: 2999999, adj: "+200% 할증" },
        { label: "300만 원 이상", from: 3000000, to: Infinity, adj: "+300% 할증" },
      ],
      renewPeriod: "1년 갱신 · 5년 재가입",
    },
    {
      id: "g5", gen: 5, name: "5세대 (2026.5.6~)", from: "2026-05", to: "2099-12", confidence: "press",
      summary: "2026년 5월 6일 출시. 급여 외래 자기부담을 건강보험 본인부담률과 연동(의원 30%~상급종합 60%, 입원 20%)하고, 비급여를 중증(특약1)·비중증(특약2, 자기부담 50%·회당·연간 한도 강화)으로 분리. 임신·출산 급여 의료비 신규 보장. 비중증 비급여 특약은 순차 출시로 약관 확정 후 계산 지원 예정.",
      inpatient: { payRate: 0.20, nonpayRate: 0.30, annualLimit: 50000000 },
      outpatient: { mode: "linked", payRateByHospital: { clinic: 0.30, hospital: 0.40, general: 0.50, tertiary: 0.60 }, payFlat: { clinic: 10000, hospital: 10000, general: 20000, tertiary: 20000 }, payPerVisitLimit: 200000, nonpayRate: 0.50, nonpayFlat: 50000, nonpayPerVisitLimit: 200000, nonpayAnnualLimit: 10000000 },
      renewPeriod: "1년 갱신 · 5년 재가입",
      calcSupported: false,
    },
  ],
  hospitalTypes: [
    { id: "clinic", label: "의원 (동네 병원·치과·한의원)" },
    { id: "hospital", label: "병원 (30병상 이상)" },
    { id: "general", label: "종합병원" },
    { id: "tertiary", label: "상급종합병원 (대학병원)" },
  ],
  claimDeadlineYears: 3, // 보험금 청구권 소멸시효 3년 (상법 §662)
};
