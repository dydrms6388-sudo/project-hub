import { describe, expect, it } from 'vitest';
import { parse } from '../src/index.js';
import { NOW, fixtures } from './fixtures/index.js';

describe('어댑터 픽스처', () => {
  for (const fixture of fixtures) {
    describe(fixture.adapterId, () => {
      it('픽스처가 8케이스 이상이다 (스펙 9장)', () => {
        expect(fixture.cases.length).toBeGreaterThanOrEqual(8);
      });

      for (const testCase of fixture.cases) {
        it(testCase.name, () => {
          const result = parse(testCase.text, { now: testCase.now ?? NOW });

          if (testCase.expect === 'unparsed') {
            expect(result.transactions).toHaveLength(0);
            // 실패는 반드시 사용자에게 보여야 한다. 조용히 버리는 경로는 없다.
            expect(result.unparsed.length).toBeGreaterThan(0);
            return;
          }

          expect(result.unparsed).toEqual([]);
          expect(result.transactions).toHaveLength(testCase.count ?? 1);
          expect(result.matchedAdapter).toBe(fixture.adapterId);

          const tx = result.transactions[0];
          expect(tx).toBeDefined();
          if (testCase.tx) {
            expect(tx).toMatchObject(testCase.tx);
          }
          // 금액은 언제나 양의 정수다. 방향과 취소는 별도 필드가 나타낸다.
          expect(Number.isInteger(tx?.amount)).toBe(true);
          expect(tx?.amount).toBeGreaterThan(0);
        });
      }
    });
  }
});
