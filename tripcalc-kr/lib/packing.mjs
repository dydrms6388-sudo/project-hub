// tripcalc-kr 짐 싸기 목록 생성 — 순수 규칙 기반(외부 API 없음)
// 기후·기간·여행유형·옵션에 따라 항목을 조합한다.

export const CLIMATES = [
  { id: "tropical", name: "더운 나라 (동남아·괌·하와이)", hint: "연중 20~35℃, 습하고 스콜" },
  { id: "temperate", name: "온화 (일본·대만·유럽 봄가을)", hint: "10~25℃, 일교차" },
  { id: "cold", name: "추운 곳 (겨울 유럽·홋카이도·북미)", hint: "영하~10℃" },
  { id: "desert", name: "건조·사막 (중동·이집트)", hint: "낮 더위·밤 추위, 건조" },
];

export const TRIP_TYPES = [
  { id: "city", name: "도시 관광" },
  { id: "resort", name: "휴양·리조트" },
  { id: "activity", name: "액티비티·트레킹" },
  { id: "business", name: "출장" },
  { id: "family", name: "아이 동반 가족여행" },
];

export const OPTIONS = [
  { id: "carryonly", name: "기내 수하물만" },
  { id: "swim", name: "수영·물놀이 있음" },
  { id: "camera", name: "카메라 촬영" },
  { id: "longhaul", name: "장거리 비행(8시간+)" },
  { id: "driving", name: "렌터카 운전" },
];

// 카테고리 순서
export const CATS = ["필수 서류·돈", "의류", "세면·위생", "전자기기", "건강·상비약", "그 외"];

const N = (name, cat, note = "") => ({ name, cat, note });

const BASE = [
  N("여권 (잔여 유효기간 6개월 이상)", "필수 서류·돈", "만료일 확인 필수"),
  N("항공권 예약번호 / 모바일 탑승권", "필수 서류·돈"),
  N("숙소 예약 확인서", "필수 서류·돈"),
  N("여행자보험 증서", "필수 서류·돈"),
  N("해외결제 되는 카드 2장 (분산 보관)", "필수 서류·돈"),
  N("현지 통화 소액 현금", "필수 서류·돈"),
  N("여권 사본 / 사진 백업", "필수 서류·돈", "분실 대비 클라우드에도 저장"),
  N("속옷·양말", "의류"),
  N("잠옷 또는 편한 실내복", "의류"),
  N("칫솔·치약", "세면·위생"),
  N("클렌징·스킨케어 (100mL 이하 용기)", "세면·위생"),
  N("휴대폰 충전기 / 케이블", "전자기기"),
  N("보조배터리 (기내 반입만 가능)", "전자기기", "위탁 수하물 금지"),
  N("멀티 어댑터 (플러그 규격 확인)", "전자기기"),
  N("상비약 (진통제·소화제·지사제)", "건강·상비약"),
  N("밴드·연고", "건강·상비약"),
  N("접이식 에코백 / 보조가방", "그 외"),
  N("지퍼백 몇 장", "그 외", "젖은 옷·액체류 정리"),
];

const BY_CLIMATE = {
  tropical: [
    N("반팔·린넨 셔츠", "의류"), N("얇은 긴팔 1벌 (냉방·햇빛 차단)", "의류"),
    N("샌들·슬리퍼", "의류"), N("모자·선글라스", "의류"),
    N("선크림 SPF50+", "세면·위생"), N("모기 기피제", "건강·상비약"),
    N("우산 또는 우비 (스콜 대비)", "그 외"), N("땀 흡수 좋은 수건", "세면·위생"),
  ],
  temperate: [
    N("얇은 겉옷 (가디건·자켓)", "의류", "일교차 대비"), N("긴바지·청바지", "의류"),
    N("편한 운동화", "의류"), N("접이 우산", "그 외"), N("선크림", "세면·위생"),
  ],
  cold: [
    N("패딩 또는 두꺼운 코트", "의류"), N("기모 내의·히트텍", "의류"),
    N("목도리·장갑·비니", "의류"), N("두꺼운 양말 (여분 넉넉히)", "의류"),
    N("방수 부츠 또는 미끄럼 방지 신발", "의류"), N("립밤·핸드크림", "세면·위생"),
    N("핫팩", "그 외"),
  ],
  desert: [
    N("얇고 긴 옷 (햇빛 차단)", "의류"), N("스카프 (모래·햇빛 차단)", "의류"),
    N("선크림 SPF50+ ·선글라스", "세면·위생"), N("보습 로션·립밤", "세면·위생"),
    N("보온용 겉옷 (밤 기온 급강하)", "의류"), N("물통 (수분 보충)", "그 외"),
  ],
};

const BY_TYPE = {
  city: [N("편한 걷기용 신발", "의류"), N("도시 교통카드·패스", "필수 서류·돈"), N("가벼운 크로스백", "그 외")],
  resort: [N("래시가드 또는 수영복", "의류"), N("비치타월", "그 외"), N("방수 파우치", "그 외")],
  activity: [N("트레킹화·등산양말", "의류"), N("기능성 속건 의류", "의류"), N("스포츠 테이프·근육통 파스", "건강·상비약"), N("헤드랜턴 또는 손전등", "그 외")],
  business: [N("정장·구두 (구김 방지 커버)", "의류"), N("명함", "필수 서류·돈"), N("노트북·충전기", "전자기기"), N("휴대용 다리미 스프레이", "그 외")],
  family: [N("아이 상비약·해열제", "건강·상비약"), N("물티슈·기저귀", "세면·위생"), N("아이 간식·간편식", "그 외"), N("유모차 또는 아기띠", "그 외"), N("아이 놀거리(태블릿·색칠북)", "그 외")],
};

const BY_OPTION = {
  carryonly: [N("액체류 100mL 이하 + 1L 지퍼백 1개", "세면·위생", "보안검색 규정"), N("기내 반입 규격 캐리어 확인", "그 외")],
  swim: [N("수영복·수경", "의류"), N("방수팩", "그 외"), N("귀 물빠짐 대비 면봉", "세면·위생")],
  camera: [N("카메라·여분 배터리", "전자기기"), N("메모리카드 여유분", "전자기기"), N("렌즈 클리너", "전자기기")],
  longhaul: [N("목베개·안대·귀마개", "그 외"), N("압박 스타킹 (부종 예방)", "건강·상비약"), N("보습 마스크·인공눈물", "세면·위생"), N("갈아입을 옷 1벌 기내 휴대", "의류")],
  driving: [N("국제운전면허증 + 국내 면허증 + 여권", "필수 서류·돈", "3종 모두 필요"), N("차량용 거치대·충전기", "전자기기")],
};

/** 기간에 따른 수량 가이드 */
export function quantities(days) {
  const d = Math.max(1, Math.round(days));
  const topsBase = Math.min(d, 7);
  return [
    { name: "상의", qty: `${topsBase}벌` + (d > 7 ? " (+세탁 1회 이상)" : "") },
    { name: "하의", qty: `${Math.min(Math.ceil(d / 2) + 1, 5)}벌` },
    { name: "속옷·양말", qty: `${Math.min(d + 1, 9)}세트` + (d > 8 ? " (세탁 전제)" : "") },
    { name: "신발", qty: d <= 3 ? "1~2켤레" : "2켤레 (걷기용 + 상황용)" },
  ];
}

/** 목록 생성 */
export function buildList({ climate = "temperate", days = 5, type = "city", options = [] } = {}) {
  const seen = new Map();
  const push = (arr) => { for (const it of arr || []) if (!seen.has(it.name)) seen.set(it.name, it); };
  push(BASE);
  push(BY_CLIMATE[climate]);
  push(BY_TYPE[type]);
  for (const o of options) push(BY_OPTION[o]);
  if (days >= 8) {
    push([{ name: "세탁세제 (소분)", cat: "세면·위생", note: "장기 여행 세탁 대비" },
          { name: "여분 지퍼백·압축팩", cat: "그 외", note: "" }]);
  }
  if (days <= 2) push([{ name: "짐 최소화: 1박 2일은 기내용 가방 하나로", cat: "그 외", note: "" }]);
  const items = [...seen.values()];
  const groups = CATS.map((c) => ({ cat: c, items: items.filter((i) => i.cat === c) })).filter((g) => g.items.length);
  return { groups, count: items.length, quantities: quantities(days) };
}

/** 공유용 압축 상태 인코딩(URL) */
export function encodeState(st) {
  const o = [st.climate, st.days, st.type, (st.options || []).join("."), (st.checked || []).join("~")].join("|");
  return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(o))) : Buffer.from(o, "utf8").toString("base64");
}
export function decodeState(str) {
  try {
    const o = typeof atob === "function" ? decodeURIComponent(escape(atob(str))) : Buffer.from(str, "base64").toString("utf8");
    const [climate, days, type, options, checked] = o.split("|");
    return { climate, days: +days || 5, type, options: options ? options.split(".") : [], checked: checked ? checked.split("~") : [] };
  } catch (e) { return null; }
}
