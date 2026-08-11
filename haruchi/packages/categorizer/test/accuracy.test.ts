/**
 * 분류 정확도 실측 (스펙 12장 Phase 2 DoD: 80% 이상).
 *
 * 라벨링한 상호명 세트로 잰다. 시드 규칙에서 그대로 베껴 온 이름만 넣으면
 * 100% 가 나오고 측정이 무의미해지므로, 실제 카드 문자에 찍히는 형태
 * (지점명이 붙은 체인점)와 시드에 없는 동네 가게를 함께 넣었다.
 *
 * 오분류(틀린 카테고리)와 미분류(null)를 따로 센다. 미분류는 사용자가 고치면
 * 그만이지만, 오분류는 사용자가 알아채지 못한 채 통계가 틀어진다.
 */
import { describe, expect, it } from 'vitest';
import type { TransactionKind } from '@haruchi/schema';
import { categorize } from '../src/index.js';

interface LabeledMerchant {
  merchant: string;
  expected: string;
  kind?: TransactionKind;
}

const LABELED: readonly LabeledMerchant[] = [
  // 체인점 — 실제 문자에 찍히는 형태 그대로
  { merchant: '스타벅스강남2호점', expected: 'food.cafe' },
  { merchant: '투썸플레이스역삼', expected: 'food.cafe' },
  { merchant: '메가엠지씨커피', expected: 'food.cafe' },
  { merchant: '이디야커피선릉점', expected: 'food.cafe' },
  { merchant: '파리바게뜨논현', expected: 'food.cafe' },
  { merchant: '배스킨라빈스', expected: 'food.cafe' },
  { merchant: '배달의민족', expected: 'food.delivery' },
  { merchant: '쿠팡이츠', expected: 'food.delivery' },
  { merchant: '요기요', expected: 'food.delivery' },
  { merchant: 'GS25강남점', expected: 'food.convenience' },
  { merchant: 'CU역삼점', expected: 'food.convenience' },
  { merchant: '세븐일레븐논현', expected: 'food.convenience' },
  { merchant: '이마트24신사', expected: 'food.convenience' },
  { merchant: '맘스터치강남', expected: 'food.dining' },
  { merchant: '버거킹역삼점', expected: 'food.dining' },
  { merchant: '교촌치킨', expected: 'food.dining' },
  { merchant: '김밥천국', expected: 'food.dining' },
  { merchant: '명륜진사갈비', expected: 'food.dining' },
  { merchant: '이마트성수점', expected: 'food.grocery' },
  { merchant: '홈플러스', expected: 'food.grocery' },
  { merchant: '코스트코양재', expected: 'food.grocery' },
  { merchant: '마켓컬리', expected: 'food.grocery' },
  { merchant: '우리동네정육점', expected: 'food.grocery' },
  { merchant: '카카오T', expected: 'transport.taxi' },
  { merchant: '티머니', expected: 'transport.transit' },
  { merchant: 'KTX서울역', expected: 'transport.transit' },
  { merchant: 'SK에너지주유소', expected: 'transport.fuel' },
  { merchant: '하이패스', expected: 'transport.parking' },
  { merchant: '아이파킹', expected: 'transport.parking' },
  { merchant: '한국전력공사', expected: 'home.utility' },
  { merchant: 'SK텔레콤', expected: 'home.telecom' },
  { merchant: 'KT요금', expected: 'home.telecom' },
  { merchant: '쿠팡', expected: 'shopping.online' },
  { merchant: '11번가', expected: 'shopping.online' },
  { merchant: '무신사', expected: 'shopping.online' },
  { merchant: '올리브영강남', expected: 'shopping.beauty' },
  { merchant: '유니클로', expected: 'shopping.fashion' },
  { merchant: 'ABC마트', expected: 'shopping.fashion' },
  { merchant: '다이소역삼점', expected: 'shopping.household' },
  { merchant: '하이마트', expected: 'shopping.electronics' },
  { merchant: '넷플릭스', expected: 'leisure.subscription' },
  { merchant: '유튜브프리미엄', expected: 'leisure.subscription' },
  { merchant: '멜론', expected: 'leisure.subscription' },
  { merchant: 'CHATGPT', expected: 'leisure.subscription' },
  { merchant: 'CGV강남', expected: 'leisure.movie' },
  { merchant: '메가박스코엑스', expected: 'leisure.movie' },
  { merchant: 'STEAM', expected: 'leisure.game' },
  { merchant: '교보문고광화문', expected: 'leisure.book' },
  { merchant: '야놀자', expected: 'leisure.travel' },
  { merchant: '대한항공', expected: 'leisure.travel' },
  { merchant: '필라테스스튜디오', expected: 'leisure.fitness' },
  { merchant: '강남정형외과', expected: 'health.clinic' },
  { merchant: '서울대치과의원', expected: 'health.clinic' },
  { merchant: '온누리약국', expected: 'health.pharmacy' },
  { merchant: '행복동물병원', expected: 'pet' },
  { merchant: '펫프렌즈', expected: 'pet' },
  { merchant: '메가스터디', expected: 'education' },
  { merchant: '삼성화재', expected: 'finance.insurance' },
  { merchant: '하나은행수수료', expected: 'finance.fee' },
  { merchant: '카카오톡선물하기', expected: 'social' },
  { merchant: '아기용품점', expected: 'baby' },

  // 수입·이체
  { merchant: '급여', expected: 'income.salary', kind: 'income' },
  { merchant: '국세청환급', expected: 'income.refund', kind: 'income' },
  { merchant: '자동이체', expected: 'transfer' },

  // 시드에 없는 동네 가게 — 여기서 미분류가 나오는 것이 정상이다
  { merchant: '미쓰윤의라면', expected: 'food.dining' },
  { merchant: '소문난감자탕', expected: 'food.dining' },
  { merchant: '대박호프', expected: 'food.dining' },
  { merchant: '언니네떡볶이', expected: 'food.dining' },
  { merchant: '백소정신사', expected: 'food.dining' },
  { merchant: '스시오마카세', expected: 'food.dining' },
  { merchant: '해운대암소', expected: 'food.dining' },
  { merchant: '형제상회', expected: 'food.grocery' },
  { merchant: '청담수선집', expected: 'shopping.household' },
  { merchant: '나나스꽃집', expected: 'social' },
  { merchant: '토스랩', expected: 'etc' },
];

describe('분류 정확도 실측', () => {
  const outcomes = LABELED.map((sample) => {
    const result = categorize({
      merchantNormalized: sample.merchant,
      kind: sample.kind ?? 'expense',
    });
    const actual = result.categoryKey ?? result.categoryId;
    return {
      ...sample,
      actual,
      correct: actual === sample.expected,
      // 카테고리를 붙였는데 틀린 경우. 사용자가 알아채지 못하는 종류의 실패다.
      wrong: actual !== null && actual !== sample.expected,
    };
  });

  const correct = outcomes.filter((o) => o.correct).length;
  const wrong = outcomes.filter((o) => o.wrong);
  const accuracy = correct / outcomes.length;

  it(`정확도가 80% 이상이다 (실측 ${(accuracy * 100).toFixed(1)}%, ${correct}/${outcomes.length})`, () => {
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });

  it('오분류는 5% 이하다 — 미분류보다 오분류가 나쁘다', () => {
    if (wrong.length > 0) {
      // 실패 시 어떤 상호명이 어디로 잘못 갔는지 바로 보이게 한다.
      console.error(
        '오분류:',
        wrong.map((o) => `${o.merchant}: ${o.expected} → ${o.actual}`).join(', '),
      );
    }
    expect(wrong.length / outcomes.length).toBeLessThanOrEqual(0.05);
  });

  it('측정 세트가 충분히 크고 시드에 없는 상호명을 포함한다', () => {
    expect(outcomes.length).toBeGreaterThanOrEqual(70);
    const unmatched = outcomes.filter((o) => o.actual === null);
    expect(unmatched.length).toBeGreaterThanOrEqual(5);
  });
});

describe('오분류 함정', () => {
  const cases: Array<[string, string | null, TransactionKind?]> = [
    // 짧은 조각이 엉뚱한 단어에 걸리는 전형적인 사고들
    ['카펫전문점', null],
    ['이삿짐센터', null],
    ['DOCUMENTCENTER', null],
    // 긴 키워드가 짧은 키워드를 이겨야 하는 쌍들
    ['행복동물병원', 'pet'],
    ['이마트24역삼', 'food.convenience'],
    ['KTX광명역', 'transport.transit'],
    ['쿠팡이츠', 'food.delivery'],
    ['마켓컬리', 'food.grocery'],
    ['송금수수료', 'finance.fee'],
    // 술집 이자카야가 이자수입으로 가면 안 된다
    ['역전이자카야', 'food.dining'],
  ];

  for (const [merchant, expected, kind] of cases) {
    it(`${merchant} → ${expected ?? '미분류'}`, () => {
      const result = categorize({ merchantNormalized: merchant, kind: kind ?? 'expense' });
      expect(result.categoryKey).toBe(expected);
    });
  }
});
