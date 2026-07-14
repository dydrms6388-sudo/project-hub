// blog-topics.ts — 자동 발행 주제 배열.
// 새 주제는 이 배열에 객체를 추가하기만 하면 크론이 자동으로 후보에 포함한다.
//   searchTopic : 사람이 읽는 글의 소재(검색되는 주제)
//   keyword     : 노리는 핵심 검색어
//   toolSlug    : 글 후반부에서 자연스럽게 연결할 tomatoeggcat.com 도구 slug
//   angle       : 글의 초점/차별화 포인트

export interface BlogTopic {
  searchTopic: string;
  keyword: string;
  toolSlug: string;
  angle: string;
}

export const blogTopics: BlogTopic[] = [
  { searchTopic: "연봉 실수령액 세전세후 차이", keyword: "연봉 실수령액", toolSlug: "salary", angle: "4대보험·세금공제" },
  { searchTopic: "BMI 정상 범위 총정리", keyword: "BMI 정상 범위", toolSlug: "bmi", angle: "구간별 의미" },
  { searchTopic: "DSR 쉽게 이해하기", keyword: "DSR 뜻", toolSlug: "dsr", angle: "DSR·DTI 차이" },
  { searchTopic: "만 나이 계산법 2023 변화", keyword: "만 나이 계산", toolSlug: "age", angle: "만나이 통일" },
  { searchTopic: "주휴수당 조건과 계산법", keyword: "주휴수당 조건", toolSlug: "alba-pay", angle: "발생 요건" },
  { searchTopic: "청약 가점 84점 뜯어보기", keyword: "청약 가점 계산", toolSlug: "cheongyak-score-calc", angle: "항목 구성" },
  { searchTopic: "전세대출 한도 몇 %", keyword: "전세대출 한도", toolSlug: "jeonse-loan", angle: "상품별 비교" },
  { searchTopic: "1주택 양도세 비과세 요건", keyword: "양도소득세 비과세", toolSlug: "yangdo", angle: "1세대1주택" },
  { searchTopic: "퍼스널컬러 웜쿨 구분법", keyword: "퍼스널컬러 진단", toolSlug: "personal-color-test", angle: "4계절 특징" },
  { searchTopic: "축의금 적정 금액", keyword: "축의금 적정 금액", toolSlug: "gift-money", angle: "관계별 관습" },
  { searchTopic: "술 깨는 시간", keyword: "술 깨는 시간", toolSlug: "sober-up-time", angle: "위드마크·개인차·안전강조" },
  { searchTopic: "MBTI 궁합 조합", keyword: "MBTI 궁합", toolSlug: "mbti-match", angle: "4축 해석" },
  { searchTopic: "디데이 세는 법", keyword: "디데이 계산", toolSlug: "dday", angle: "카운트다운 개념" },
  { searchTopic: "핸드드립 물 비율", keyword: "핸드드립 비율", toolSlug: "home-cafe-recipe", angle: "추출법별 비율" },
  { searchTopic: "종합소득세 프리랜서", keyword: "종합소득세 프리랜서", toolSlug: "gig-note-tax", angle: "3.3%·환급" },
];
