// 전세보증금 반환보증 데이터 — HUG/HF/SGI. 요율은 공시 변경 가능 → todo + 직접 입력.
const CHECKED = "2026-08-19";

export const jeonseInsurance = {
  // HUG 전세보증금반환보증 보증료율(연) — 주택유형·부채비율·우대에 따라 차등.
  // 공시 요율이 개정될 수 있어 확정값으로 고정하지 않음 → 예시값 + 직접 입력.
  hugRates: {
    value: [
      { type: "아파트", examplePct: 0.122 },
      { type: "아파트 외(다세대·오피스텔 등)", examplePct: 0.128 },
    ],
    source: "https://www.khug.or.kr/hug/web/ig/dr/igdr000001.jsp",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "HUG 보증료율은 부채비율·주택유형·우대(사회배려계층 할인 등)에 따라 달라지고 공시가 개정될 수 있음 — 공식 요율표 확인 후 직접 입력.",
  },
  // 가입 한도: 수도권/비수도권 보증금 상한 — 개정 이력 있음 → todo
  limits: {
    value: { note: "보증금 상한 및 전세가율(담보인정비율) 요건은 공고로 변경됨" },
    source: "https://www.khug.or.kr/hug/web/ig/dr/igdr000001.jsp",
    checkedAt: CHECKED,
    todo: true,
    todoNote: "가입 가능 보증금 상한·전세가율 요건은 최신 공고 확인 필요.",
  },
  providers: {
    value: [
      { name: "HUG 주택도시보증공사", url: "https://www.khug.or.kr" },
      { name: "HF 한국주택금융공사", url: "https://www.hf.go.kr" },
      { name: "SGI서울보증", url: "https://www.sgic.co.kr" },
    ],
    source: "https://www.khug.or.kr",
    checkedAt: CHECKED,
  },
};
