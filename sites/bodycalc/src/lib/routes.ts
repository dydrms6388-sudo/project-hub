/**
 * 도구 외 추가 정적 경로(가이드 글 등). 사이트맵에 포함된다.
 */
export const extraRoutes: string[] = ["/guide/caffeine-and-sleep/"];

/** 홈·푸터에서 링크로 노출할 가이드 목록 */
export const guides: { path: string; title: string; description: string }[] = [
  {
    path: "/guide/caffeine-and-sleep/",
    title: "카페인과 수면 — 몇 시까지 마셔야 잠을 지킬 수 있나",
    description:
      "반감기 5시간이 실제로 뜻하는 것, 취침 6시간 전 커피가 왜 문제인지, 마지막 잔의 경계선을 직접 계산하는 법.",
  },
];
