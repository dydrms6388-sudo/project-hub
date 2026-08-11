import type { ParsedTransaction } from '@haruchi/schema';

/** 테스트 기준 시각: KST 2026-08-20 12:00 */
export const NOW = new Date('2026-08-20T03:00:00.000Z');

export interface ParseCase {
  name: string;
  text: string;
  /**
   * parsed  = 거래 1건 이상으로 정확히 읽혀야 함
   * unparsed = 읽지 못하고 unparsed 로 남아야 함 (오파싱보다 낫다)
   */
  expect: 'parsed' | 'unparsed';
  /** 기대 거래. 지정한 필드만 비교한다. */
  tx?: Partial<ParsedTransaction>;
  /** 기대 거래 건수 (기본 1) */
  count?: number;
  now?: Date;
}

export interface AdapterFixture {
  adapterId: string;
  cases: ParseCase[];
}
