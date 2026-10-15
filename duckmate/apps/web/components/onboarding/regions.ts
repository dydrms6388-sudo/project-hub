/**
 * 지역 상수 — supabase/migrations/20260902000013 `regions` 시드 미러 (B1 §2: 행정표준코드 앞 5자리, 시도2+시군구3).
 * 런타임은 서버 페이지가 DB `regions` 를 우선 읽고, 실패·빈 결과일 때 이 표로 폴백한다.
 * 시도 폴백 행(`XX000`)은 REGION.isSidoFallback 으로 구분 — 해당 시도는 시군구 셀렉트가 "전체" 1개.
 */
import { REGION } from "@duckmate/db";

export type RegionItem = { code: string; sido: string; sigungu: string; sortOrder: number };

const R = (code: string, sido: string, sigungu: string, sortOrder: number): RegionItem => ({ code, sido, sigungu, sortOrder });

export const REGIONS_FALLBACK: readonly RegionItem[] = [
  R("11110", "서울", "종로구", 1), R("11140", "서울", "중구", 2), R("11170", "서울", "용산구", 3), R("11200", "서울", "성동구", 4),
  R("11215", "서울", "광진구", 5), R("11230", "서울", "동대문구", 6), R("11260", "서울", "중랑구", 7), R("11290", "서울", "성북구", 8),
  R("11305", "서울", "강북구", 9), R("11320", "서울", "도봉구", 10), R("11350", "서울", "노원구", 11), R("11380", "서울", "은평구", 12),
  R("11410", "서울", "서대문구", 13), R("11440", "서울", "마포구", 14), R("11470", "서울", "양천구", 15), R("11500", "서울", "강서구", 16),
  R("11530", "서울", "구로구", 17), R("11545", "서울", "금천구", 18), R("11560", "서울", "영등포구", 19), R("11590", "서울", "동작구", 20),
  R("11620", "서울", "관악구", 21), R("11650", "서울", "서초구", 22), R("11680", "서울", "강남구", 23), R("11710", "서울", "송파구", 24),
  R("11740", "서울", "강동구", 25),
  R("28110", "인천", "중구", 1), R("28140", "인천", "동구", 2), R("28177", "인천", "미추홀구", 3), R("28185", "인천", "연수구", 4),
  R("28200", "인천", "남동구", 5), R("28237", "인천", "부평구", 6), R("28245", "인천", "계양구", 7), R("28260", "인천", "서구", 8),
  R("28710", "인천", "강화군", 9), R("28720", "인천", "옹진군", 10),
  R("41110", "경기", "수원시", 1), R("41130", "경기", "성남시", 2), R("41150", "경기", "의정부시", 3), R("41170", "경기", "안양시", 4),
  R("41190", "경기", "부천시", 5), R("41210", "경기", "광명시", 6), R("41220", "경기", "평택시", 7), R("41250", "경기", "동두천시", 8),
  R("41270", "경기", "안산시", 9), R("41280", "경기", "고양시", 10), R("41290", "경기", "과천시", 11), R("41310", "경기", "구리시", 12),
  R("41360", "경기", "남양주시", 13), R("41370", "경기", "오산시", 14), R("41390", "경기", "시흥시", 15), R("41410", "경기", "군포시", 16),
  R("41430", "경기", "의왕시", 17), R("41450", "경기", "하남시", 18), R("41460", "경기", "용인시", 19), R("41480", "경기", "파주시", 20),
  R("41500", "경기", "이천시", 21), R("41550", "경기", "안성시", 22), R("41570", "경기", "김포시", 23), R("41590", "경기", "화성시", 24),
  R("41610", "경기", "광주시", 25), R("41630", "경기", "양주시", 26), R("41650", "경기", "포천시", 27), R("41670", "경기", "여주시", 28),
  R("41800", "경기", "연천군", 29), R("41820", "경기", "가평군", 30), R("41830", "경기", "양평군", 31),
  R("26000", "부산", "부산 전체", 1), R("27000", "대구", "대구 전체", 1), R("29000", "광주", "광주 전체", 1), R("30000", "대전", "대전 전체", 1),
  R("31000", "울산", "울산 전체", 1), R("36000", "세종", "세종 전체", 1), R("51000", "강원", "강원 전체", 1), R("43000", "충북", "충북 전체", 1),
  R("44000", "충남", "충남 전체", 1), R("52000", "전북", "전북 전체", 1), R("46000", "전남", "전남 전체", 1), R("47000", "경북", "경북 전체", 1),
  R("48000", "경남", "경남 전체", 1), R("50000", "제주", "제주 전체", 1),
];

export type SidoItem = { code: string; name: string; capitalArea: boolean };

/** 시도 목록: 수도권(서울·인천·경기) 먼저, 나머지는 시드 등장 순 */
export function sidoList(regions: readonly RegionItem[]): SidoItem[] {
  const seen = new Map<string, SidoItem>();
  for (const r of regions) {
    const code = REGION.sidoCodeOf(r.code);
    if (!seen.has(code)) {
      seen.set(code, { code, name: r.sido, capitalArea: (REGION.capitalAreaSido as readonly string[]).includes(code) });
    }
  }
  const all = Array.from(seen.values());
  return [...all.filter((s) => s.capitalArea), ...all.filter((s) => !s.capitalArea)];
}

export function sigunguList(regions: readonly RegionItem[], sidoCode: string): RegionItem[] {
  return regions.filter((r) => REGION.sidoCodeOf(r.code) === sidoCode).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findRegion(regions: readonly RegionItem[], code: string | null | undefined): RegionItem | undefined {
  if (!code) return undefined;
  return regions.find((r) => r.code === code);
}

/** 카드 표기: 구 단위까지만 ("마포구", 폴백 행은 "부산") */
export function regionLabel(regions: readonly RegionItem[], code: string | null | undefined): string {
  const r = findRegion(regions, code);
  if (!r) return "";
  return REGION.isSidoFallback(r.code) ? r.sido : r.sigungu;
}
