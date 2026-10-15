// 가전 소비전력 참고표 (billcalc-kr)
// ⚠ 소비전력은 제품·용량·모드별 편차가 크다. 아래 값은 "일반적 참고 범위"이며
//   정확한 값은 제품 라벨/설명서의 정격 소비전력을 확인해 계산기에 직접 입력해야 한다.
// 출처(공통): 한국에너지공단 효율등급 제품 정보 https://eep.energy.or.kr (모델별 실측 표기),
//             각 제조사 제품 사양표. checkedAt: 2026-08-19

export const CHECKED_AT = "2026-08-19";
export const APPLIANCE_SOURCE = {
  name: "한국에너지공단 효율등급 제품정보 · 제조사 사양표 (참고 범위)",
  url: "https://eep.energy.or.kr",
  checkedAt: CHECKED_AT,
  note: "표기값은 참고 범위 평균이며 모델별로 다릅니다. 제품 라벨의 소비전력을 직접 입력하세요.",
};

// w: 대표 소비전력(W), range: [최소, 최대] 참고 범위, h: 하루 사용 시간 기본값
// cat: cool 냉방·계절 / kitchen 주방 / laundry 세탁 / media IT·미디어 / heat 난방 / etc 생활
export const APPLIANCES = [
  { slug: "air-conditioner", name: "에어컨 (벽걸이)", cat: "cool", w: 800, range: [500, 1200], h: 6, note: "인버터형은 설정온도 도달 후 소비전력이 크게 떨어집니다. 라벨의 냉방 소비전력 기준." },
  { slug: "stand-air-conditioner", name: "에어컨 (스탠드)", cat: "cool", w: 1800, range: [1300, 2500], h: 6, note: "거실용 스탠드형. 인버터 절전 효과 큼." },
  { slug: "electric-fan", name: "선풍기", cat: "cool", w: 45, range: [30, 70], h: 8, note: "약풍은 30W 이하인 제품도 많습니다." },
  { slug: "circulator", name: "서큘레이터", cat: "cool", w: 35, range: [25, 60], h: 8 },
  { slug: "air-purifier", name: "공기청정기", cat: "cool", w: 30, range: [10, 60], h: 24, note: "자동 모드 평균 기준. 최대 풍량 시 더 높음." },
  { slug: "dehumidifier", name: "제습기", cat: "cool", w: 250, range: [180, 350], h: 6 },
  { slug: "humidifier", name: "가습기 (초음파식)", cat: "cool", w: 30, range: [15, 45], h: 8, note: "가열식은 130~300W로 훨씬 높습니다." },

  { slug: "refrigerator", name: "냉장고 (양문형)", cat: "kitchen", w: 40, range: [25, 80], h: 24, note: "라벨의 '월간 소비전력량(kWh/월)'을 쓰는 것이 가장 정확합니다. 40W×24h ≈ 월 29kWh." },
  { slug: "kimchi-refrigerator", name: "김치냉장고", cat: "kitchen", w: 35, range: [20, 60], h: 24 },
  { slug: "freezer", name: "냉동고", cat: "kitchen", w: 45, range: [30, 80], h: 24 },
  { slug: "wine-cellar", name: "와인셀러", cat: "kitchen", w: 50, range: [30, 90], h: 24 },
  { slug: "microwave", name: "전자레인지", cat: "kitchen", w: 1100, range: [700, 1300], h: 0.2 },
  { slug: "electric-oven", name: "전기오븐", cat: "kitchen", w: 2000, range: [1500, 3000], h: 0.3 },
  { slug: "airfryer", name: "에어프라이어", cat: "kitchen", w: 1500, range: [1200, 1800], h: 0.4 },
  { slug: "induction", name: "인덕션 (1구 사용)", cat: "kitchen", w: 1800, range: [1200, 3000], h: 1, note: "화력 단계에 비례. 3구 동시 사용 시 최대 3kW 이상." },
  { slug: "electric-kettle", name: "전기포트", cat: "kitchen", w: 1800, range: [1500, 2200], h: 0.15 },
  { slug: "rice-cooker-cook", name: "전기밥솥 (취사)", cat: "kitchen", w: 1000, range: [900, 1400], h: 0.5 },
  { slug: "rice-cooker-warm", name: "전기밥솥 (보온)", cat: "kitchen", w: 100, range: [70, 150], h: 10, note: "보온을 오래 켜두면 취사보다 전기를 더 씁니다." },
  { slug: "dishwasher", name: "식기세척기", cat: "kitchen", w: 1200, range: [1000, 1500], h: 1, note: "물 가열 구간에서 전력 집중. 회당 약 1~1.5kWh." },
  { slug: "coffee-machine", name: "커피머신", cat: "kitchen", w: 1300, range: [1000, 1500], h: 0.15 },
  { slug: "toaster", name: "토스터", cat: "kitchen", w: 900, range: [700, 1200], h: 0.1 },
  { slug: "blender", name: "믹서기", cat: "kitchen", w: 400, range: [300, 600], h: 0.05 },
  { slug: "water-purifier", name: "냉온정수기", cat: "kitchen", w: 50, range: [30, 100], h: 24, note: "온수·냉수 유지 전력 포함 평균." },
  { slug: "electric-grill", name: "전기그릴", cat: "kitchen", w: 1400, range: [1200, 1600], h: 0.3 },
  { slug: "food-dehydrator", name: "식품건조기", cat: "kitchen", w: 500, range: [350, 700], h: 6 },

  { slug: "washing-machine", name: "세탁기 (통돌이)", cat: "laundry", w: 500, range: [300, 700], h: 0.7, note: "냉수 세탁 기준. 온수 사용 시 급증." },
  { slug: "drum-washer", name: "드럼세탁기", cat: "laundry", w: 700, range: [200, 2000], h: 0.7, note: "히터(온수·건조) 사용 여부에 따라 편차 매우 큼." },
  { slug: "dryer", name: "의류건조기 (히트펌프)", cat: "laundry", w: 1000, range: [600, 1500], h: 0.8, note: "히트펌프식 기준. 히터식은 2kW 이상." },
  { slug: "styler", name: "의류관리기", cat: "laundry", w: 200, range: [150, 300], h: 1 },
  { slug: "iron", name: "다리미", cat: "laundry", w: 1500, range: [1000, 2000], h: 0.2 },

  { slug: "tv-55", name: "TV (55인치)", cat: "media", w: 120, range: [80, 180], h: 5 },
  { slug: "tv-75", name: "TV (75인치 이상)", cat: "media", w: 200, range: [150, 350], h: 5, note: "OLED·밝기 설정에 따라 편차." },
  { slug: "desktop-pc", name: "데스크톱 PC", cat: "media", w: 150, range: [80, 400], h: 4 },
  { slug: "gaming-pc", name: "게이밍 PC", cat: "media", w: 400, range: [250, 700], h: 3, note: "게임 부하 기준. 고사양 그래픽카드 장착 시 상단." },
  { slug: "laptop", name: "노트북", cat: "media", w: 40, range: [20, 90], h: 5 },
  { slug: "monitor", name: "모니터 (27인치)", cat: "media", w: 30, range: [20, 50], h: 5 },
  { slug: "game-console", name: "게임 콘솔", cat: "media", w: 150, range: [80, 220], h: 2 },
  { slug: "router", name: "인터넷 공유기", cat: "media", w: 8, range: [5, 15], h: 24 },
  { slug: "settop-box", name: "셋톱박스", cat: "media", w: 15, range: [8, 20], h: 24, note: "끄지 않으면 24시간 소비 — 대표적 대기전력 기기." },
  { slug: "ai-speaker", name: "AI 스피커", cat: "media", w: 5, range: [3, 10], h: 24 },
  { slug: "printer", name: "프린터 (가정용)", cat: "media", w: 30, range: [20, 60], h: 0.2 },
  { slug: "cctv-cam", name: "홈캠·CCTV", cat: "media", w: 5, range: [3, 10], h: 24 },
  { slug: "phone-charger", name: "스마트폰 충전기", cat: "media", w: 10, range: [5, 25], h: 2 },

  { slug: "electric-heater", name: "전기히터·온풍기", cat: "heat", w: 1500, range: [1000, 2000], h: 4, note: "겨울철 누진 폭탄 1순위. 하루 4시간이면 월 180kWh." },
  { slug: "electric-mat", name: "전기장판 (더블)", cat: "heat", w: 150, range: [100, 250], h: 8 },
  { slug: "electric-blanket", name: "전기요 (싱글)", cat: "heat", w: 60, range: [40, 100], h: 8 },
  { slug: "water-mat", name: "온수매트", cat: "heat", w: 240, range: [200, 300], h: 8 },
  { slug: "radiator", name: "전기 라디에이터", cat: "heat", w: 1500, range: [1000, 2000], h: 5 },
  { slug: "boiler-pump", name: "보일러 (전기 소비분)", cat: "heat", w: 80, range: [60, 150], h: 5, note: "가스보일러의 순환펌프·제어부 전기 소비. 가스요금은 별도." },
  { slug: "water-heater", name: "전기온수기 (저장식)", cat: "heat", w: 2000, range: [1500, 3000], h: 1.5 },
  { slug: "bidet", name: "비데 (온수·변좌 유지)", cat: "heat", w: 30, range: [15, 60], h: 24, note: "순간온수식은 대기 소비가 훨씬 적습니다." },

  { slug: "vacuum", name: "청소기 (유선)", cat: "etc", w: 1000, range: [600, 1500], h: 0.2 },
  { slug: "robot-vacuum", name: "로봇청소기", cat: "etc", w: 30, range: [20, 50], h: 1, note: "충전 전력 포함 평균." },
  { slug: "hair-dryer", name: "헤어드라이어", cat: "etc", w: 1500, range: [1000, 2200], h: 0.15 },
  { slug: "massage-chair", name: "안마의자", cat: "etc", w: 150, range: [100, 250], h: 0.5 },
  { slug: "treadmill", name: "러닝머신", cat: "etc", w: 800, range: [500, 1500], h: 0.7 },
  { slug: "aquarium", name: "어항 (히터+여과기)", cat: "etc", w: 60, range: [30, 150], h: 24 },
  { slug: "ebike-charger", name: "전기자전거·킥보드 충전", cat: "etc", w: 150, range: [100, 300], h: 3 },
  { slug: "led-stand", name: "LED 스탠드", cat: "etc", w: 10, range: [5, 20], h: 5 },
  { slug: "living-light", name: "거실 LED 조명", cat: "etc", w: 50, range: [30, 100], h: 6 },
];

export const CATS = {
  cool: "냉방·공기",
  kitchen: "주방",
  laundry: "세탁·의류",
  media: "IT·미디어",
  heat: "난방·온수",
  etc: "생활·기타",
};
