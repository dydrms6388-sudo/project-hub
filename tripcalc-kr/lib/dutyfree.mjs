// tripcalc-kr 여행자 휴대품 면세 한도 (대한민국 입국 기준)
// 규율: 확실한 값만 관세청 출처로 싣고, 불확실한 값은 todo:true → 화면에 "확인 필요" 배지.
const CUSTOMS = "https://www.customs.go.kr/";           // 관세청
const CUSTOMS_TRAVEL = "https://www.customs.go.kr/kcs/main.do"; // 관세청 > 여행자 휴대품 안내
const CHECKED = "2026-08-19";

const s = (v, extra = {}) => ({ value: v, source: CUSTOMS_TRAVEL, checkedAt: CHECKED, ...extra });

export const DUTY = {
  meta: {
    source: CUSTOMS, sourceLabel: "관세청", checkedAt: CHECKED,
    note: "입국 시 여행자 휴대품 기준. 면세점 구매분·해외 구매분을 모두 합산한다.",
  },
  // 기본 면세한도: 미화 800달러 (2022년 9월 600 → 800달러 인상)
  basic: s(800, { unit: "USD", label: "기본 면세한도(별도면세 품목 제외 전체 물품 합산)" }),
  // 별도 면세(기본한도와 별개로 각각 면세)
  alcohol: s(2, {
    unit: "병", label: "주류",
    detail: "총 2병 이하 + 합계 2L 이하 + 합계 미화 400달러 이하를 모두 만족해야 별도 면세",
    bottles: 2, liters: 2, usd: 400,
  }),
  tobacco: s(200, {
    unit: "개비", label: "궐련(담배)",
    detail: "궐련 200개비(1보루). 전자담배 등 다른 유형과 합산 시 한 종류만 면세되며 유형별 한도가 별도로 있다.",
  }),
  perfume: s(100, {
    unit: "mL", label: "향수",
    detail: "향수 100mL (2023년 60mL → 100mL 확대)",
  }),
  // 세율
  simpleRate: s(0.2, {
    unit: "비율", label: "간이세율(대표값)",
    detail: "대부분의 여행자 휴대품에 20% 간이세율이 적용된다. 다만 품목에 따라 별도 세율이 적용되는 경우가 있어 실제 세액은 달라질 수 있다.",
  }),
  // 자진신고 감면: 관세의 30% 경감. 감면 한도액은 개정 이력이 있어 확정 표기하지 않는다.
  selfReport: {
    value: 0.3, unit: "비율", label: "자진신고 감면율",
    detail: "성실 자진신고 시 관세의 30%를 경감받는다. 경감 한도액(최대 감면액)은 개정 이력이 있어 이 사이트에서 확정값으로 표기하지 않는다.",
    capTodo: true, capHint: 200000,
    source: CUSTOMS_TRAVEL, checkedAt: CHECKED, todo: true,
  },
  // 미신고 가산세
  penalty: {
    value: 0.4, unit: "비율", label: "미신고 가산세",
    detail: "신고하지 않고 반입하다 적발되면 납부세액의 40%(2년 내 반복 시 60%)가 가산세로 부과된다.",
    source: CUSTOMS_TRAVEL, checkedAt: CHECKED,
  },
  reference: [
    { name: "관세청 — 여행자 휴대품 통관 안내", url: CUSTOMS_TRAVEL },
    { name: "관세청 여행자 세관신고(모바일 신고)", url: CUSTOMS },
  ],
};

/**
 * 예상 세액(추정) 계산.
 * goods: 별도면세 대상(주류·담배·향수)을 제외한 물품 합계(USD)
 * extraAlcoholUsd / extraTobaccoUsd / extraPerfumeUsd: 별도면세 한도를 넘겨 과세 대상이 되는 금액(USD)
 * usdKrw: 적용 환율(과세환율은 별도 고시되지만 여기서는 사용자가 입력/조회한 환율로 추정)
 */
export function estimateDuty({
  goodsUsd = 0, extraAlcoholUsd = 0, extraTobaccoUsd = 0, extraPerfumeUsd = 0,
  usdKrw = 0, selfReport = true, rate = DUTY.simpleRate.value, cap = 200000,
} = {}) {
  const limit = DUTY.basic.value;
  const overBasic = Math.max(0, goodsUsd - limit);
  const taxableUsd = overBasic + Math.max(0, extraAlcoholUsd) + Math.max(0, extraTobaccoUsd) + Math.max(0, extraPerfumeUsd);
  const taxableKrw = taxableUsd * usdKrw;
  const gross = taxableKrw * rate;
  const discount = selfReport ? Math.min(gross * DUTY.selfReport.value, cap) : 0;
  const penalty = selfReport ? 0 : gross * DUTY.penalty.value;
  const tax = Math.max(0, gross - discount + penalty);
  return {
    limit, overBasic, taxableUsd, taxableKrw,
    gross: Math.round(gross), discount: Math.round(discount), penalty: Math.round(penalty),
    tax: Math.round(tax), rate, selfReport,
    free: taxableUsd <= 0,
  };
}

/** 주류/담배/향수 별도면세 한도 충족 여부 판정 */
export function checkAllowance({ bottles = 0, liters = 0, alcoholUsd = 0, cigarettes = 0, perfumeMl = 0 } = {}) {
  const a = DUTY.alcohol;
  return {
    alcohol: {
      ok: bottles <= a.bottles && liters <= a.liters && alcoholUsd <= a.usd,
      detail: a.detail,
      over: [
        bottles > a.bottles ? `병 수 초과(${bottles}병 > ${a.bottles}병)` : null,
        liters > a.liters ? `용량 초과(${liters}L > ${a.liters}L)` : null,
        alcoholUsd > a.usd ? `금액 초과($${alcoholUsd} > $${a.usd})` : null,
      ].filter(Boolean),
    },
    tobacco: { ok: cigarettes <= DUTY.tobacco.value, detail: DUTY.tobacco.detail },
    perfume: { ok: perfumeMl <= DUTY.perfume.value, detail: DUTY.perfume.detail },
  };
}
