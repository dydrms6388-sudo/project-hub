// 예방접종·기생충 예방 스케줄 데이터
// 근거: WSAVA Vaccination Guidelines(코어 백신·접종 간격),
// AAHA Canine Vaccination Guidelines, AAFP/AAHA Feline Vaccination Guidelines,
// American Heartworm Society(심장사상충 매월 예방),
// 광견병 국내 의무 접종: 농림축산검역본부.
const SRC_WSAVA = "https://wsava.org/global-guidelines/vaccination-guidelines/";
const SRC_AAHA = "https://www.aaha.org/resources/2022-aaha-canine-vaccination-guidelines/";
const SRC_AAFP = "https://catvets.com/guidelines/practice-guidelines/";
const SRC_AHS = "https://www.heartwormsociety.org/heartworms";
const SRC_QIA = "https://www.qia.go.kr/";
const CHECKED = "2026-08-19";

// weeks: 생후 주령(시작 시점). 국내 병원마다 간격·조합이 다르므로 "권장 시기" 안내용.
export const DOG_SCHEDULE = [
  { weeks: 6, name: "종합백신(DHPPi) 1차", note: "홍역·간염·파보·파라인플루엔자. 생후 6~8주에 시작", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 9, name: "종합백신(DHPPi) 2차", note: "1차 후 2~4주 간격", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 12, name: "종합백신(DHPPi) 3차", note: "2~4주 간격으로 계속", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 16, name: "종합백신(DHPPi) 마지막 차수", note: "마지막 접종은 생후 16주 이후에 이뤄져야 함", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 12, name: "광견병 백신", note: "국내는 생후 3개월(약 12주) 이상 개는 광견병 예방접종 의무 대상. 이후 보강 주기는 병원·지자체 안내에 따름", core: true, source: SRC_QIA, checkedAt: CHECKED },
  { weeks: 9, name: "켄넬코프(보데텔라) 등 비코어", note: "생활 환경(애견카페·호텔 등 접촉 많음)에 따라 수의사와 상담 후 선택", core: false, source: SRC_AAHA, checkedAt: CHECKED },
  { weeks: 26, name: "보강 접종(부스터)", note: "마지막 유년기 접종 후 6개월~1년 사이 보강, 이후 코어 백신은 3년 이상 간격 재접종(항체검사로 대체 가능)", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 8, name: "심장사상충 예방 시작", note: "생후 8주부터 시작 가능, 이후 매월 1회 연중 예방 권장", core: true, source: SRC_AHS, checkedAt: CHECKED },
];

export const CAT_SCHEDULE = [
  { weeks: 6, name: "종합백신(FVRCP) 1차", note: "허피스·칼리시·범백혈구감소증. 생후 6~8주에 시작", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 9, name: "종합백신(FVRCP) 2차", note: "2~4주 간격", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 12, name: "종합백신(FVRCP) 3차", note: "2~4주 간격으로 계속", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 16, name: "종합백신(FVRCP) 마지막 차수", note: "마지막 접종은 생후 16주 이후 권장", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 12, name: "광견병 백신", note: "외출·다묘 환경 등 위험도에 따라 수의사와 상담 (지역 규정 확인)", core: true, source: SRC_AAFP, checkedAt: CHECKED },
  { weeks: 9, name: "백혈병(FeLV) 등 비코어", note: "외출 여부·동거묘에 따라 수의사와 상담 후 선택", core: false, source: SRC_AAFP, checkedAt: CHECKED },
  { weeks: 26, name: "보강 접종(부스터)", note: "유년기 접종 완료 6개월~1년 후 보강, 이후 재접종 주기는 수의사와 상담", core: true, source: SRC_WSAVA, checkedAt: CHECKED },
  { weeks: 8, name: "심장사상충 예방 시작", note: "고양이도 감염됨. 매월 1회 예방 권장", core: true, source: SRC_AHS, checkedAt: CHECKED },
];

export const HEARTWORM = {
  value: "매월 1회, 연중(12개월) 예방 권장",
  source: SRC_AHS,
  checkedAt: CHECKED,
};
