/**
 * 정상인가요 — 바이럴 카드 해석 문구 12종 (P1 산출물)
 *
 * 카드 명제: "당신은 상위 N% 소수파" — 숫자가 아니라 "나에 대한 해석 한 줄"이 핵심.
 * 규칙(C2): 12종이 어미만 다르면 실패. 아래 12종은 문장 구조·페르소나·프레이밍이 전부 다르다.
 *
 * bucket = 응답자 중 "당신과 같은 선택"의 비율(shareRatio). 낮을수록 희귀(=더 잘 퍼진다).
 * 카드 렌더러(P4)는 shareRatio로 bucket을 골라 headline/subline을 채운다.
 * 치환 토큰(전부 실제 DB 집계값에서만 계산, 환각 금지):
 *   {count}=당신편 인원, {total}=총 응답자, {pct}=반올림 %,
 *   {per100}=100명당 당신편, {per10}=10명당 당신편.
 * headline/subline 자체(고정 문구)가 "고유 해석"이고, 치환 숫자는 근거다.
 */

export interface CardCopyBucket {
  id: string;
  /** 이 구간에 해당하는 shareRatio 범위 [min, max) — 0~1 */
  min: number;
  max: number;
  /** 카드 상단 큰 글자 — 페르소나/판정 */
  headline: string;
  /** 카드 중단 해석 한 줄 — {count}/{total}/{pct} 치환 */
  subline: string;
  /** 카드 하단 한 줄 태그(공유 시 창피하지 않은 톤) */
  tag: string;
}

/**
 * 12 구간. 구조가 서로 다름:
 * 절대수 강조 / 인증 프레임 / 비율 은유 / 경계선 / 다수 커밍아웃 / 국룰 판정 등.
 */
export const CARD_BUCKETS: CardCopyBucket[] = [
  {
    id: "unicorn",
    min: 0,
    max: 0.01,
    headline: "전국 0%대 희귀종",
    subline: "응답자 {total}명 중 당신과 같은 선택은 단 {count}명. 이건 취향이 아니라 거의 유전자예요.",
    tag: "🦄 멸종위기 소수파",
  },
  {
    id: "top4",
    min: 0.01,
    max: 0.04,
    headline: "상위 {pct}% 소수파 인증",
    subline: "'나만 이런가' 싶었죠? {total}명이 증명했습니다. 통계적으로 당신이 맞았어요.",
    tag: "🏅 공식 소수파 배지",
  },
  {
    id: "rare7",
    min: 0.04,
    max: 0.1,
    headline: "100명 중 {per100}명 클럽",
    subline: "백 명을 모아도 당신 편은 한 자릿수. 흔치 않아서 오히려 더 당신다운 선택이에요.",
    tag: "✨ 흔치 않은 취향",
  },
  {
    id: "oneoffive",
    min: 0.1,
    max: 0.2,
    headline: "다섯 중 하나 마이너",
    subline: "소수지만 외롭진 않은 딱 좋은 비율. 다섯 명 모이면 당신 같은 사람이 꼭 한 명 있어요.",
    tag: "🧩 아늑한 소수파",
  },
  {
    id: "third",
    min: 0.2,
    max: 0.35,
    headline: "생각보다 동지가 많음",
    subline: "혼자인 줄 알았는데 셋 중 하나가 같은 편. {pct}%면 조용한 세력이라 부를 만해요.",
    tag: "🤝 숨은 동지들",
  },
  {
    id: "tense",
    min: 0.35,
    max: 0.48,
    headline: "여론이 팽팽한 쪽",
    subline: "이건 정답이 없는 논쟁. {pct}%로 갈린 이 싸움에서 당신은 당당한 한 축이에요.",
    tag: "⚖️ 갈리는 논쟁",
  },
  {
    id: "edge",
    min: 0.48,
    max: 0.52,
    headline: "세상을 가르는 경계선",
    subline: "정확히 반반. 사람들을 두 편으로 쪼개는 문제 위에 당신이 딱 서 있어요.",
    tag: "🪓 반반 논쟁의 중심",
  },
  {
    id: "quietmajority",
    min: 0.52,
    max: 0.65,
    headline: "은근한 다수파",
    subline: "대놓고 주장한 적 없지만 사실 절반이 넘는 쪽. {pct}%가 조용히 당신과 같아요.",
    tag: "🌊 조용한 과반",
  },
  {
    id: "commonsense",
    min: 0.65,
    max: 0.8,
    headline: "상식 편에 섰습니다",
    subline: "열 명 중 {per10}명 꼴로 같은 생각. 논쟁하면 이길 확률이 높은 안전한 쪽이에요.",
    tag: "🧭 다수의 상식",
  },
  {
    id: "almostrule",
    min: 0.8,
    max: 0.9,
    headline: "거의 국룰 수준",
    subline: "열에 여덟이 당신처럼 해요. 이쯤 되면 취향이 아니라 암묵적 규칙에 가깝습니다.",
    tag: "📏 국룰 근접",
  },
  {
    id: "textbook",
    min: 0.9,
    max: 0.96,
    headline: "표준값 그 자체",
    subline: "열에 아홉이 같은 편. 당신 선택은 사전에 '정상'이라고 적어도 될 만큼 표준이에요.",
    tag: "📚 교과서적 표준",
  },
  {
    id: "everyone",
    min: 0.96,
    max: 1.0001,
    headline: "사실상 만장일치",
    subline: "응답자 {pct}%가 당신과 같은 선택. 여기서 반대하는 사람이 오히려 소수파가 돼요.",
    tag: "🧱 거의 전원 일치",
  },
];

/** shareRatio(0~1)로 버킷 선택. 범위 밖 방어. */
export function pickBucket(shareRatio: number): CardCopyBucket {
  const r = Math.min(Math.max(shareRatio, 0), 1);
  return (
    CARD_BUCKETS.find((b) => r >= b.min && r < b.max) ??
    CARD_BUCKETS[CARD_BUCKETS.length - 1]
  );
}

/** 치환: 실제 집계값만 전달할 것(시드/가짜 숫자 주입 금지). */
export function renderCardText(
  bucket: CardCopyBucket,
  agg: { count: number; total: number },
): { headline: string; subline: string; tag: string } {
  const ratio = agg.total > 0 ? agg.count / agg.total : 0;
  const pct = Math.round(ratio * 100);
  const per10 = Math.max(1, Math.round(ratio * 10));
  const per100 = Math.max(1, Math.round(ratio * 100));
  const fill = (s: string) =>
    s
      .replaceAll("{per100}", String(per100))
      .replaceAll("{per10}", String(per10))
      .replaceAll("{count}", String(agg.count))
      .replaceAll("{total}", String(agg.total))
      .replaceAll("{pct}", String(pct));
  return {
    headline: fill(bucket.headline),
    subline: fill(bucket.subline),
    tag: bucket.tag,
  };
}

export const CARD_BUCKET_COUNT = CARD_BUCKETS.length; // 12
