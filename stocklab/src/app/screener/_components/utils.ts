/** 스크리너/오늘의 주식 공용 소형 유틸 (UI 전용) */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO 문자열 → "9월 3일 00:00" (KST) */
export function fmtKstDateTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "–";
  const k = new Date(t + KST_OFFSET_MS);
  const hh = String(k.getUTCHours()).padStart(2, "0");
  const mm = String(k.getUTCMinutes()).padStart(2, "0");
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${hh}:${mm}`;
}

export function naverFinanceHref(code: string): string {
  return `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`;
}

export const MARKET_LABEL: Record<string, string> = { KOSPI: "코스피", KOSDAQ: "코스닥" };

export const DATA_LABEL = "전일 종가 기준 지연 시세";
