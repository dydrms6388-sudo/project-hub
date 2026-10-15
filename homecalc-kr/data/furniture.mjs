// 가구 프리셋 치수(cm) — 표준 규격이 아닌 국내 유통 일반 치수(관행, 참고용)
export const FURNITURE_PRESETS = {
  value: [
    { id: "bed-s", name: "싱글 침대", w: 100, h: 200, color: "#7aa2ff" },
    { id: "bed-ss", name: "슈퍼싱글 침대", w: 110, h: 200, color: "#7aa2ff" },
    { id: "bed-q", name: "퀸 침대", w: 150, h: 200, color: "#7aa2ff" },
    { id: "bed-k", name: "킹 침대", w: 160, h: 200, color: "#7aa2ff" },
    { id: "sofa-2", name: "2인 소파", w: 160, h: 90, color: "#f0a35e" },
    { id: "sofa-3", name: "3인 소파", w: 200, h: 90, color: "#f0a35e" },
    { id: "desk", name: "책상", w: 120, h: 60, color: "#9ee7c8" },
    { id: "table-4", name: "4인 식탁", w: 120, h: 80, color: "#9ee7c8" },
    { id: "wardrobe", name: "옷장(2문)", w: 100, h: 60, color: "#caa8f5" },
    { id: "drawer", name: "서랍장", w: 80, h: 45, color: "#caa8f5" },
    { id: "bookshelf", name: "책장", w: 80, h: 30, color: "#caa8f5" },
    { id: "fridge", name: "냉장고(양문형)", w: 91, h: 75, color: "#8fd3f4" },
    { id: "washer", name: "세탁기(드럼)", w: 65, h: 70, color: "#8fd3f4" },
    { id: "tv", name: "TV 거실장", w: 150, h: 40, color: "#f2c94c" },
    { id: "vanity", name: "화장대", w: 90, h: 40, color: "#f2c94c" },
  ],
  source: "국내 유통 일반 치수 (제조사별 상이 — 실제 제품 제원 확인)",
  checkedAt: "2026-08-19",
  practice: true,
  note: "프리셋 치수는 참고용. 배치 전 실제 가구 제원(cm)을 직접 입력해 수정할 것.",
};
