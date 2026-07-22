// 카테고리 기반 인라인 SVG 아이콘 세트.
// 이모지(제각각 색·플랫폼별 렌더 차이)를 일관된 라인 아이콘으로 대체한다.
// 모두 24x24, stroke=currentColor(호출부에서 카테고리 색 지정), 굵기 2, 라운드.
// 개별 도구가 아니라 카테고리 단위로 매칭 → 키워드 규칙으로 내장/데일리 라벨 모두 커버.

const P = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const ICONS = {
  health: P('<path d="M3 12h4l2 6 4-13 2.5 7H21"/>'),                                   // 맥박(건강·운동)
  finance: P('<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>'), // 건물(금융·부동산)
  calc: P('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/>'), // 계산기
  edu: P('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M7 9.5V15c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5V9.5"/>'), // 학사모(교육)
  fun: P('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 15l.7 1.8L20.5 17l-1.8.7L18 19.5l-.7-1.8L15.5 17l1.8-.7z"/>'), // 반짝임(엔터)
  luck: P('<path d="M20.5 13.5A8 8 0 1 1 10.5 3.5a6 6 0 0 0 10 10z"/><path d="M18 4l.6 1.6L20 6l-1.4.4L18 8l-.6-1.6L16 6l1.4-.4z"/>'), // 달·별(운세·심리)
  career: P('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>'), // 서류가방(취업)
  love: P('<path d="M12 20s-6.5-4.2-9-8C1.3 9 2.7 5.5 6 5.5c2 0 3.3 1.3 4 2.5 0.7-1.2 2-2.5 4-2.5 3.3 0 4.7 3.5 3 6.5-2.5 3.8-9 8-9 8z"/>'), // 하트(연애)
  pet: P('<path d="M11 21c-4 0-7-3-7-7 0-6 4-10 15-10 0 11-4 17-8 17z"/><path d="M4.5 20.5C8 18 11 15 13 11"/>'), // 잎(반려·식물)
  beauty: P('<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9.5" r="1.1"/><circle cx="12" cy="8" r="1.1"/><circle cx="15.5" cy="9.5" r="1.1"/><path d="M9 15c1 1 5 1 6 0"/>'), // 팔레트(뷰티)
  travel: P('<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>'), // 지도핀(여행)
  life: P('<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.3 2.3-2.3-.4-.4-2.3z"/>'), // 렌치(생활 도구)
  grid: P('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'), // 폴백
};

// 카테고리 라벨(이모지·구두점 포함 가능) → 아이콘 키. 내장·데일리 라벨 모두 커버.
export function iconKeyFor(label = "") {
  const s = String(label);
  if (/건강|운동|다이어트|의료|헬스|바디|영양|수면/.test(s)) return "health";
  if (/부동산|대출|전세|양도|청약|세금|연봉|급여|금융/.test(s)) return "finance";
  if (/계산|숫자|변환|단위|날짜|나이|평수/.test(s)) return "calc";
  if (/교육|학습|시험|공부|수능|토익|한자|자격/.test(s)) return "edu";
  if (/엔터|바이럴|재미|게임|놀이/.test(s)) return "fun";
  if (/운세|심리|타로|사주|점|테스트|mbti/i.test(s)) return "luck";
  if (/취업|생산성|커리어|자소서|이력|업무/.test(s)) return "career";
  if (/연애|관계|사랑|커플|썸/.test(s)) return "love";
  if (/반려|식물|펫|동물|화분/.test(s)) return "pet";
  if (/뷰티|패션|미용|컬러|스타일/.test(s)) return "beauty";
  if (/여행|문화|관광|맛집/.test(s)) return "travel";
  if (/생활|도구|유틸/.test(s)) return "life";
  return "grid";
}

export function iconFor(label) { return ICONS[iconKeyFor(label)]; }
