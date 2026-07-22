import { pickBucket, renderCardText } from "@/content/card-copy";
import type { SurveyStats } from "./types";

export interface CardData {
  title: string;
  headline: string;
  subline: string;
  tag: string;
  showStats: boolean;
  n: number;
}

/**
 * 공유 카드 데이터. 공유자가 고른 선택지(optKey)의 비율로 "해석 문구"를 만든다.
 * C2: 숫자만 넣지 않고 해석 한 줄이 핵심. 숫자는 실제 집계값만(환각 금지).
 * n<30이면 퍼센트를 만들지 않고 참여 유도 카드로 대체(가짜 숫자 금지).
 */
export function buildCard(
  title: string,
  stats: SurveyStats | null,
  optKey: string | null,
): CardData {
  if (stats?.showStats && optKey) {
    const total = stats.options.reduce((a, o) => a + o.votes, 0);
    const mine = stats.options.find((o) => o.key === optKey);
    const count = mine?.votes ?? 0;
    const ratio = total > 0 ? count / total : 0;
    const bucket = pickBucket(ratio);
    const t = renderCardText(bucket, { count, total });
    return { title, headline: t.headline, subline: t.subline, tag: t.tag, showStats: true, n: stats.n };
  }
  return {
    title,
    headline: "아직 집계 중",
    subline: "30명이 넘으면 결과가 열려요. 당신 생각은 어느 쪽인가요?",
    tag: "🗳️ 지금 한 표 던지면 바로 확인",
    showStats: false,
    n: stats?.n ?? 0,
  };
}
