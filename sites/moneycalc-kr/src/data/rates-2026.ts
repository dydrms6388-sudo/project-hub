/**
 * 2026년 재테크 계산에 쓰이는 모든 요율·구간의 단일 출처.
 *
 * 규칙
 *  - 모든 항목은 { value, source(URL), effectiveDate } 를 반드시 가진다.
 *  - `verified: true` 는 정부·공단의 1차 출처(go.kr / 공단 홈페이지 / 법령)에서 값을 확인한 항목.
 *  - `verified: false` 는 **확인하지 못한 값**이다. 계산에는 마지막으로 알려진 값을 쓰되,
 *    UI 에서 반드시 "확인 필요" 배지를 노출한다. 추측한 값을 확인한 척 적지 않는다.
 *  - 값을 고칠 때는 반드시 source 를 함께 갱신한다.
 */

export type Rate<T = number> = {
  /** 실제 계산에 쓰이는 값 */
  value: T;
  /** 사람이 읽는 항목명 */
  label: string;
  /** 값을 확인한(또는 확인해야 할) 공식 출처 URL */
  source: string;
  /** 출처 이름 */
  sourceLabel: string;
  /** 적용 시작일 YYYY-MM-DD */
  effectiveDate: string;
  /** 1차 출처에서 값을 확인했는가 */
  verified: boolean;
  /** 표시용 보충 설명 */
  note?: string;
};

export type Bracket = { upTo: number | null; rate: number; deduction?: number };

const r = <T>(x: Rate<T>): Rate<T> => x;

/* ------------------------------------------------------------------ */
/* 최저임금 / 근로시간                                                  */
/* ------------------------------------------------------------------ */

export const MIN_WAGE_HOURLY = r({
  value: 10320,
  label: "2026년 최저임금(시간급)",
  source: "https://www.minimumwage.go.kr/customer/notice/view.do?bultnId=4657",
  sourceLabel: "최저임금위원회 · 2026년 적용 최저임금 고시(고용노동부 고시 제2025-47호)",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "2025년 9,860원 대비 290원(2.9%) 인상. 업종 구분 없이 모든 사업장에 동일 적용.",
});

export const MIN_WAGE_MONTHLY = r({
  value: 2156880,
  label: "2026년 최저임금 월 환산액(주 40시간·월 209시간)",
  source: "https://www.minimumwage.go.kr/customer/notice/view.do?bultnId=4657",
  sourceLabel: "최저임금위원회 · 2026년 적용 최저임금 고시",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "10,320원 × 209시간. 주휴수당이 포함된 금액이다.",
});

export const MONTHLY_WORK_HOURS = r({
  value: 209,
  label: "월 소정근로시간(주 40시간 기준, 주휴 포함)",
  source: "https://www.law.go.kr/법령/근로기준법/제50조",
  sourceLabel: "근로기준법 제50조(근로시간)·제55조(휴일)",
  effectiveDate: "2021-07-01",
  verified: true,
  note: "(주 40시간 + 주휴 8시간) × 365 ÷ 7 ÷ 12 ≒ 209시간.",
});

export const WEEKLY_HOLIDAY_MIN_HOURS = r({
  value: 15,
  label: "주휴수당 발생 최소 주 소정근로시간",
  source: "https://www.law.go.kr/법령/근로기준법/제18조",
  sourceLabel: "근로기준법 제18조 제3항",
  effectiveDate: "2021-07-01",
  verified: true,
  note: "4주 평균 주 15시간 미만이면 주휴수당·연차휴가가 발생하지 않는다.",
});

/* ------------------------------------------------------------------ */
/* 4대보험                                                              */
/* ------------------------------------------------------------------ */

export const NPS_RATE_TOTAL = r({
  value: 0.095,
  label: "국민연금 보험료율(합계)",
  source: "https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do",
  sourceLabel: "국민연금공단 · 연금보험료",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "2025년 국민연금법 개정으로 2026년 9.5%, 이후 매년 0.5%p씩 올라 2033년 13%가 된다.",
});

export const NPS_RATE_EMPLOYEE = r({
  value: 0.0475,
  label: "국민연금 근로자 부담률(사업장가입자)",
  source: "https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do",
  sourceLabel: "국민연금공단 · 연금보험료",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "사업장가입자는 근로자와 사용자가 정확히 절반씩 부담한다.",
});

export const NPS_BASE_MAX = r({
  value: 6590000,
  label: "국민연금 기준소득월액 상한액(2026.7~2027.6)",
  source: "https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do",
  sourceLabel: "국민연금공단 · 기준소득월액 상·하한액 고시",
  effectiveDate: "2026-07-01",
  verified: false,
  note: "2026년 7월 조정분. 보건복지부 고시 원문을 확인하지 못했다. 상한을 넘는 소득은 상한액으로 보험료가 고정된다.",
});

export const NPS_BASE_MIN = r({
  value: 410000,
  label: "국민연금 기준소득월액 하한액(2026.7~2027.6)",
  source: "https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do",
  sourceLabel: "국민연금공단 · 기준소득월액 상·하한액 고시",
  effectiveDate: "2026-07-01",
  verified: false,
  note: "2026년 7월 조정분. 보건복지부 고시 원문을 확인하지 못했다.",
});

export const NPS_BASE_MAX_PREV = r({
  value: 6370000,
  label: "국민연금 기준소득월액 상한액(2025.7~2026.6)",
  source: "https://www.nps.or.kr/pnsgdnc/newgdnc/getOHAE0001M1.do",
  sourceLabel: "국민연금공단 · 기준소득월액 상·하한액 안내",
  effectiveDate: "2025-07-01",
  verified: true,
});

export const NPS_BASE_MIN_PREV = r({
  value: 400000,
  label: "국민연금 기준소득월액 하한액(2025.7~2026.6)",
  source: "https://www.nps.or.kr/pnsgdnc/newgdnc/getOHAE0001M1.do",
  sourceLabel: "국민연금공단 · 기준소득월액 상·하한액 안내",
  effectiveDate: "2025-07-01",
  verified: true,
});

export const NHIS_RATE_TOTAL = r({
  value: 0.0719,
  label: "건강보험료율(직장가입자 합계)",
  source: "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487279&mid=a10503000000",
  sourceLabel: "보건복지부 보도자료 · 2026년 건강보험료율 7.19%로 결정",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "2025년 7.09% 대비 0.10%p(1.48%) 인상.",
});

export const NHIS_RATE_EMPLOYEE = r({
  value: 0.03595,
  label: "건강보험 근로자 부담률(직장가입자)",
  source: "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487279&mid=a10503000000",
  sourceLabel: "보건복지부 보도자료 · 2026년 건강보험료율",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "7.19%의 절반. 나머지 절반은 사업주가 부담한다.",
});

export const LTC_RATE_OF_HEALTH = r({
  value: 0.1314,
  label: "장기요양보험료율(건강보험료 대비)",
  source: "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487817&mid=a10503000000",
  sourceLabel: "보건복지부 보도자료 · 2026년도 장기요양보험료율 0.9448%",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "장기요양보험료 = 건강보험료 × 13.14%. 소득 대비로 환산하면 0.9448%(7.19% × 13.14%)다.",
});

export const LTC_RATE_OF_INCOME = r({
  value: 0.009448,
  label: "장기요양보험료율(소득 대비 환산)",
  source: "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487817&mid=a10503000000",
  sourceLabel: "보건복지부 보도자료 · 2026년도 장기요양보험료율",
  effectiveDate: "2026-01-01",
  verified: true,
  note: "2025년 0.9182% 대비 0.0266%p 인상.",
});

export const EI_RATE_EMPLOYEE = r({
  value: 0.009,
  label: "고용보험(실업급여) 근로자 부담률",
  source: "https://www.comwel.or.kr/comwel/paym/insu/rate.jsp",
  sourceLabel: "근로복지공단 · 고용·산재보험 보험료율",
  effectiveDate: "2025-01-01",
  verified: false,
  note: "실업급여 계정 1.8%를 노사가 절반씩 부담해 근로자 0.9%. 2026년 요율 고시 원문을 확인하지 못했다. 고용안정·직업능력개발사업 분(0.25%~)은 전액 사업주 부담이라 근로자 공제액에는 들어가지 않는다.",
});

export const WC_RATE_NOTE = r({
  value: 0,
  label: "산재보험료(근로자 부담)",
  source: "https://www.comwel.or.kr/comwel/paym/insu/rate.jsp",
  sourceLabel: "근로복지공단 · 산재보험료율",
  effectiveDate: "2025-01-01",
  verified: true,
  note: "산재보험료는 전액 사업주가 부담한다. 근로자 급여에서 공제되지 않는다.",
});

/* ------------------------------------------------------------------ */
/* 소득세                                                               */
/* ------------------------------------------------------------------ */

export const INCOME_TAX_BRACKETS = r<Bracket[]>({
  value: [
    { upTo: 14_000_000, rate: 0.06, deduction: 0 },
    { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
    { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
    { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
    { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
    { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
    { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
    { upTo: null, rate: 0.45, deduction: 65_940_000 },
  ],
  label: "종합소득세 기본세율(8단계 초과누진)",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7667&mi=2227",
  sourceLabel: "국세청 · 종합소득세 세율",
  effectiveDate: "2023-01-01",
  verified: true,
  note: "산출세액 = 과세표준 × 세율 − 누진공제. 2023년 개정(1,400만/5,000만 구간 조정) 이후 2026년까지 동일하다.",
});

export const EARNED_INCOME_DEDUCTION = r<Bracket[]>({
  value: [
    { upTo: 5_000_000, rate: 0.7, deduction: 0 },
    { upTo: 15_000_000, rate: 0.4, deduction: 3_500_000 },
    { upTo: 45_000_000, rate: 0.15, deduction: 7_500_000 },
    { upTo: 100_000_000, rate: 0.05, deduction: 12_000_000 },
    { upTo: null, rate: 0.02, deduction: 14_750_000 },
  ],
  label: "근로소득공제 구간",
  source: "https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=1001060719&lsId=001565&chrClsCd=010202",
  sourceLabel: "소득세법 제47조(근로소득공제)",
  effectiveDate: "2020-01-01",
  verified: true,
  note: "각 구간은 (하한 초과분 × 요율) + 기본금액. 공제액이 2,000만원을 넘으면 2,000만원까지만 공제한다.",
});

export const EARNED_INCOME_DEDUCTION_CAP = r({
  value: 20_000_000,
  label: "근로소득공제 한도",
  source: "https://www.law.go.kr/LSW/lsLawLinkInfo.do?lsJoLnkSeq=1001060719&lsId=001565&chrClsCd=010202",
  sourceLabel: "소득세법 제47조 제2항",
  effectiveDate: "2020-01-01",
  verified: true,
});

export const PERSONAL_DEDUCTION = r({
  value: 1_500_000,
  label: "기본공제(1인당)",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6594&cntntsId=7873",
  sourceLabel: "국세청 · 과세표준과 산출세액",
  effectiveDate: "2009-01-01",
  verified: false,
  note: "본인·배우자·부양가족 1명당 연 150만원. 국세청 페이지 원문을 확인하지 못했다.",
});

export const EARNED_INCOME_TAX_CREDIT = r({
  value: { threshold: 1_300_000, lowRate: 0.55, highRate: 0.3 },
  label: "근로소득세액공제율",
  source: "https://www.law.go.kr/법령/소득세법/제59조",
  sourceLabel: "소득세법 제59조(근로소득세액공제)",
  effectiveDate: "2023-01-01",
  verified: false,
  note: "산출세액 130만원 이하분은 55%, 초과분은 30%를 공제한다. 총급여 구간별 공제 한도(74만/66만/50만원)는 원문을 확인하지 못했다.",
});

export const EARNED_INCOME_TAX_CREDIT_CAPS = r({
  value: [
    { upTo: 33_000_000, cap: 740_000 },
    { upTo: 70_000_000, cap: 660_000 },
    { upTo: 120_000_000, cap: 500_000 },
    { upTo: null as number | null, cap: 200_000 },
  ],
  label: "근로소득세액공제 한도(총급여 구간별)",
  source: "https://www.law.go.kr/법령/소득세법/제59조",
  sourceLabel: "소득세법 제59조 제2항",
  effectiveDate: "2023-01-01",
  verified: false,
  note: "총급여 구간에 따라 한도가 줄어드는 구조. 구간 사이의 체감 산식은 단순화했다.",
});

export const LOCAL_INCOME_TAX_RATE = r({
  value: 0.1,
  label: "지방소득세율(소득세액 대비)",
  source: "https://www.law.go.kr/법령/지방세법/제92조",
  sourceLabel: "지방세법 제92조·제103조의3",
  effectiveDate: "2014-01-01",
  verified: false,
  note: "소득세액의 10%를 지방소득세로 함께 낸다. 법령 원문을 확인하지 못했다.",
});

export const SIMPLE_TAX_TABLE_METHOD = r({
  value: 1,
  label: "근로소득 간이세액표 적용 방식",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6594&cntntsId=7873",
  sourceLabel: "국세청 · 근로소득 간이세액표",
  effectiveDate: "2026-01-01",
  verified: false,
  note:
    "국세청이 배포하는 간이세액표(엑셀 원본)는 월급여·공제대상가족수별 수천 행의 표라 이 사이트에 그대로 담지 않았다. " +
    "대신 간이세액표를 만드는 방식과 동일한 절차(연환산 → 근로소득공제 → 기본공제 → 기본세율 → 근로소득세액공제 → 12분할)로 추정한다. " +
    "실제 원천징수액과 월 수천 원 단위 차이가 날 수 있고, 연말정산으로 정산되므로 참고용으로만 쓴다.",
});

/* ------------------------------------------------------------------ */
/* 이자·기타 원천징수                                                    */
/* ------------------------------------------------------------------ */

export const INTEREST_TAX_RATE = r({
  value: 0.154,
  label: "이자소득 원천징수세율(지방소득세 포함)",
  source: "https://www.law.go.kr/법령/소득세법/제129조",
  sourceLabel: "소득세법 제129조(원천징수세율)",
  effectiveDate: "2005-01-01",
  verified: false,
  note: "소득세 14% + 지방소득세 1.4% = 15.4%. 법령 원문을 확인하지 못했다. 비과세·세금우대 상품은 다르다.",
});

export const FREELANCER_WITHHOLDING_RATE = r({
  value: 0.033,
  label: "사업소득(프리랜서) 원천징수세율",
  source: "https://www.law.go.kr/법령/소득세법/제129조",
  sourceLabel: "소득세법 제129조 제1항 제3호",
  effectiveDate: "2005-01-01",
  verified: false,
  note: "소득세 3% + 지방소득세 0.3% = 3.3%. 법령 원문을 확인하지 못했다. 인적용역 사업소득에 적용된다.",
});

/* ------------------------------------------------------------------ */
/* 부동산 / 금리                                                        */
/* ------------------------------------------------------------------ */

export const BOK_BASE_RATE = r({
  value: 0.0275,
  label: "한국은행 기준금리",
  source: "https://www.bok.or.kr/portal/main/contents.do?menuNo=200643",
  sourceLabel: "한국은행 · 기준금리 추이",
  effectiveDate: "2026-07-01",
  verified: false,
  note:
    "2026년 7월 기준 연 2.75%로 알려져 있으나 한국은행 원문을 확인하지 못했다. " +
    "기준금리는 금융통화위원회 회의마다 바뀌므로 계산기에서 직접 수정할 수 있게 두었다.",
});

export const JEONSE_CONVERSION_SPREAD = r({
  value: 0.02,
  label: "월차임 전환 산정률 가산금리(기준금리 + α)",
  source: "https://www.molit.go.kr/policy/rent/rent_f_02.jsp",
  sourceLabel: "국토교통부 · 전월세 전환율 하향 조정 / 주택임대차보호법 시행령 제9조 제2항",
  effectiveDate: "2020-09-29",
  verified: true,
  note: "시행령이 정한 이율은 연 2%. 법정 상한 = 한국은행 기준금리 + 2%.",
});

export const JEONSE_CONVERSION_CAP = r({
  value: 0.10,
  label: "월차임 전환 산정률 상한(연 1할)",
  source: "https://www.molit.go.kr/policy/rent/rent_f_02.jsp",
  sourceLabel: "주택임대차보호법 제7조의2 / 시행령 제9조 제1항",
  effectiveDate: "2016-11-30",
  verified: true,
  note: "법정 전환율은 연 10%와 (기준금리 + 2%) 중 낮은 쪽을 적용한다. 신규 계약이 아니라 기존 계약의 전세→월세 전환에 적용된다.",
});

export const ONE_HOUSE_EXEMPT_PRICE = r({
  value: 1_200_000_000,
  label: "1세대 1주택 양도세 비과세 기준(고가주택 기준가액)",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2568&cntntsId=7770",
  sourceLabel: "국세청 · 1세대 1주택 비과세",
  effectiveDate: "2021-12-08",
  verified: false,
  note: "양도가액 12억원까지 비과세, 초과분에만 과세한다. 국세청 페이지 원문을 확인하지 못했다.",
});

export const CAPITAL_GAINS_BASIC_DEDUCTION = r({
  value: 2_500_000,
  label: "양도소득 기본공제(연간)",
  source: "https://www.law.go.kr/법령/소득세법/제103조",
  sourceLabel: "소득세법 제103조(양도소득 기본공제)",
  effectiveDate: "2010-01-01",
  verified: false,
  note: "같은 해에 여러 건을 양도해도 연 250만원만 공제된다. 법령 원문을 확인하지 못했다.",
});

export const LTHD_TABLE = r({
  value: { perYearGeneral: 0.02, capGeneral: 0.30, perYearHold1H: 0.04, perYearLive1H: 0.04, cap1H: 0.80 },
  label: "장기보유특별공제율",
  source: "https://www.law.go.kr/법령/소득세법/제95조",
  sourceLabel: "소득세법 제95조(양도소득금액)",
  effectiveDate: "2021-01-01",
  verified: false,
  note:
    "일반 부동산은 3년 이상 보유 시 연 2%씩 최대 30%. 1세대 1주택(2년 이상 거주)은 보유 연 4% + 거주 연 4%로 최대 80%. " +
    "법령 원문을 확인하지 못했고 실제 적용에는 예외가 많다.",
});

/* ------------------------------------------------------------------ */
/* 증여세                                                               */
/* ------------------------------------------------------------------ */

export const GIFT_TAX_BRACKETS = r<Bracket[]>({
  value: [
    { upTo: 100_000_000, rate: 0.1, deduction: 0 },
    { upTo: 500_000_000, rate: 0.2, deduction: 10_000_000 },
    { upTo: 1_000_000_000, rate: 0.3, deduction: 60_000_000 },
    { upTo: 3_000_000_000, rate: 0.4, deduction: 160_000_000 },
    { upTo: null, rate: 0.5, deduction: 460_000_000 },
  ],
  label: "증여세 세율(5단계 초과누진)",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2340&cntntsId=7728",
  sourceLabel: "국세청 · 증여세 세액계산 흐름도",
  effectiveDate: "2000-01-01",
  verified: true,
  note: "상속세와 세율표가 동일하다. 산출세액 = 과세표준 × 세율 − 누진공제.",
});

export const GIFT_DEDUCTIONS = r({
  value: {
    spouse: 600_000_000,
    linealAscendantToAdult: 50_000_000,
    linealAscendantToMinor: 20_000_000,
    linealDescendant: 50_000_000,
    otherRelative: 10_000_000,
    stranger: 0,
  },
  label: "증여재산공제(10년 합산 한도)",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6529&cntntsId=7957",
  sourceLabel: "국세청 · 증여재산공제",
  effectiveDate: "2014-01-01",
  verified: true,
  note:
    "배우자 6억, 직계존속→성년 자녀 5천만(미성년 2천만), 직계비속→직계존속 5천만, 기타 친족 1천만원. " +
    "10년간 같은 그룹에서 받은 금액을 합산해 한도를 본다.",
});

export const GIFT_MARRIAGE_DEDUCTION = r({
  value: 100_000_000,
  label: "혼인·출산 증여재산공제",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6529&cntntsId=7957",
  sourceLabel: "국세청 · 혼인·출산 증여재산공제",
  effectiveDate: "2024-01-01",
  verified: true,
  note: "직계존속에게서 혼인신고 전후 2년 이내(또는 출생·입양신고 후 2년 이내) 증여받으면 기본공제와 별도로 최대 1억원. 혼인과 출산을 합쳐 평생 1억원 한도.",
});

export const GIFT_FILING_CREDIT = r({
  value: 0.03,
  label: "증여세 신고세액공제율",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2340&cntntsId=7728",
  sourceLabel: "국세청 · 증여세 세액계산 흐름도",
  effectiveDate: "2019-01-01",
  verified: true,
  note: "증여일이 속하는 달의 말일부터 3개월 이내에 신고하면 산출세액의 3%를 공제한다.",
});

export const GIFT_GENERATION_SKIP_SURCHARGE = r({
  value: 0.3,
  label: "세대생략 할증세율",
  source: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2340&cntntsId=7728",
  sourceLabel: "국세청 · 증여세 세액계산 흐름도",
  effectiveDate: "2016-01-01",
  verified: false,
  note: "조부모가 손자녀에게 바로 증여하면 산출세액의 30%(미성년자가 20억 초과를 받으면 40%)가 할증된다. 원문을 확인하지 못했다.",
});

/* ------------------------------------------------------------------ */
/* 자동차세                                                             */
/* ------------------------------------------------------------------ */

export const CAR_TAX_RATES = r({
  value: [
    { upTo: 1000, perCc: 80 },
    { upTo: 1600, perCc: 140 },
    { upTo: null as number | null, perCc: 200 },
  ],
  label: "비영업용 승용자동차 자동차세(cc당 연세액)",
  source: "https://www.law.go.kr/법령/지방세법/제127조",
  sourceLabel: "지방세법 제127조(자동차세 세율)",
  effectiveDate: "2011-01-01",
  verified: true,
  note: "1,000cc 이하 80원, 1,600cc 이하 140원, 1,600cc 초과 200원. 영업용은 별도 요율이다.",
});

export const CAR_EDU_TAX_RATE = r({
  value: 0.3,
  label: "자동차세분 지방교육세율",
  source: "https://www.law.go.kr/법령/지방세법/제151조",
  sourceLabel: "지방세법 제151조(지방교육세 과세표준과 세율)",
  effectiveDate: "2011-01-01",
  verified: true,
  note: "승용자동차 자동차세액의 30%가 지방교육세로 함께 부과된다.",
});

export const CAR_AGE_DISCOUNT = r({
  value: { startYear: 3, perYear: 0.05, max: 0.5 },
  label: "차령별 자동차세 경감",
  source: "https://www.law.go.kr/법령/지방세법시행령/제125조",
  sourceLabel: "지방세법 시행령 제125조(자동차세의 경감)",
  effectiveDate: "2011-01-01",
  verified: true,
  note: "차령 3년째부터 1년에 5%씩, 최대 50%까지 경감된다. 지방교육세는 경감 전 자동차세가 아니라 경감 후 자동차세를 기준으로 계산한다.",
});

export const CAR_EV_FLAT_TAX = r({
  value: 100_000,
  label: "전기·수소차 등 비영업용 승용 그 밖의 자동차 연세액",
  source: "https://www.law.go.kr/법령/지방세법/제127조",
  sourceLabel: "지방세법 제127조 별표",
  effectiveDate: "2011-01-01",
  verified: false,
  note: "배기량이 없는 승용차는 정액 10만원(비영업용). 지자체 감면이 별도로 있을 수 있어 원문 확인이 필요하다.",
});

export const CAR_ANNUAL_PREPAY_DISCOUNT = r({
  value: 0.05,
  label: "자동차세 연납(1월) 공제율",
  source: "https://www.law.go.kr/법령/지방세법/제128조",
  sourceLabel: "지방세법 제128조(납기와 징수방법)",
  effectiveDate: "2025-01-01",
  verified: false,
  note: "1월에 1년치를 미리 내면 일부를 공제해 준다. 공제율은 연도별로 축소되어 왔고 2026년 값을 확인하지 못했다.",
});

/* ------------------------------------------------------------------ */
/* 청약 가점                                                            */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTION_SCORE_MAX = r({
  value: { noHouse: 32, dependents: 35, account: 17, total: 84 },
  label: "청약 가점제 항목별 만점",
  source: "https://www.khug.or.kr/khmb/m/hg/lg/hglg000019.jsp",
  sourceLabel: "HUG 주택도시보증공사 · 주택청약도우미(청약가점제)",
  effectiveDate: "2018-12-11",
  verified: true,
  note: "무주택기간 32점 + 부양가족수 35점 + 청약통장 가입기간 17점 = 84점 만점.",
});

/* ------------------------------------------------------------------ */
/* 퇴직금 / 연차                                                        */
/* ------------------------------------------------------------------ */

export const SEVERANCE_MIN_MONTHS = r({
  value: 12,
  label: "퇴직금 발생 최소 계속근로기간",
  source: "https://www.law.go.kr/법령/근로자퇴직급여보장법/제4조",
  sourceLabel: "근로자퇴직급여 보장법 제4조",
  effectiveDate: "2012-07-26",
  verified: true,
  note: "계속근로기간 1년 이상, 4주 평균 주 15시간 이상인 근로자에게 퇴직급여를 지급해야 한다.",
});

export const SEVERANCE_DAYS_PER_YEAR = r({
  value: 30,
  label: "1년당 퇴직금 일수(평균임금 기준)",
  source: "https://www.law.go.kr/법령/근로자퇴직급여보장법/제8조",
  sourceLabel: "근로자퇴직급여 보장법 제8조(퇴직금제도의 설정)",
  effectiveDate: "2012-07-26",
  verified: true,
  note: "퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365).",
});

export const ANNUAL_LEAVE_RULES = r({
  value: {
    firstYearMonthly: 1,
    firstYearMax: 11,
    baseDays: 15,
    extraEveryYears: 2,
    extraFromYear: 3,
    maxDays: 25,
  },
  label: "연차유급휴가 발생 기준",
  source: "https://www.law.go.kr/법령/근로기준법/제60조",
  sourceLabel: "근로기준법 제60조(연차 유급휴가)",
  effectiveDate: "2018-05-29",
  verified: true,
  note:
    "1년 미만: 1개월 개근 시 1일씩 최대 11일. 1년 이상 80% 이상 출근: 15일. " +
    "3년 이상 계속근로하면 2년마다 1일씩 가산해 최대 25일.",
});

/* ------------------------------------------------------------------ */
/* 전체 목록 (확인 필요 배지·요율표 페이지용)                             */
/* ------------------------------------------------------------------ */

export type AnyRate = Rate<unknown>;

export const ALL_RATES: Record<string, AnyRate> = {
  MIN_WAGE_HOURLY,
  MIN_WAGE_MONTHLY,
  MONTHLY_WORK_HOURS,
  WEEKLY_HOLIDAY_MIN_HOURS,
  NPS_RATE_TOTAL,
  NPS_RATE_EMPLOYEE,
  NPS_BASE_MAX,
  NPS_BASE_MIN,
  NPS_BASE_MAX_PREV,
  NPS_BASE_MIN_PREV,
  NHIS_RATE_TOTAL,
  NHIS_RATE_EMPLOYEE,
  LTC_RATE_OF_HEALTH,
  LTC_RATE_OF_INCOME,
  EI_RATE_EMPLOYEE,
  WC_RATE_NOTE,
  INCOME_TAX_BRACKETS,
  EARNED_INCOME_DEDUCTION,
  EARNED_INCOME_DEDUCTION_CAP,
  PERSONAL_DEDUCTION,
  EARNED_INCOME_TAX_CREDIT,
  EARNED_INCOME_TAX_CREDIT_CAPS,
  LOCAL_INCOME_TAX_RATE,
  SIMPLE_TAX_TABLE_METHOD,
  INTEREST_TAX_RATE,
  FREELANCER_WITHHOLDING_RATE,
  BOK_BASE_RATE,
  JEONSE_CONVERSION_SPREAD,
  JEONSE_CONVERSION_CAP,
  ONE_HOUSE_EXEMPT_PRICE,
  CAPITAL_GAINS_BASIC_DEDUCTION,
  LTHD_TABLE,
  GIFT_TAX_BRACKETS,
  GIFT_DEDUCTIONS,
  GIFT_MARRIAGE_DEDUCTION,
  GIFT_FILING_CREDIT,
  GIFT_GENERATION_SKIP_SURCHARGE,
  CAR_TAX_RATES,
  CAR_EDU_TAX_RATE,
  CAR_AGE_DISCOUNT,
  CAR_EV_FLAT_TAX,
  CAR_ANNUAL_PREPAY_DISCOUNT,
  SUBSCRIPTION_SCORE_MAX,
  SEVERANCE_MIN_MONTHS,
  SEVERANCE_DAYS_PER_YEAR,
  ANNUAL_LEAVE_RULES,
};

/** 1차 출처에서 확인하지 못한 항목 목록 */
export const unverifiedRates = (): AnyRate[] =>
  Object.values(ALL_RATES).filter((x) => !x.verified);
