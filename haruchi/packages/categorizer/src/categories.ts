/**
 * 시스템 기본 카테고리 트리.
 *
 * DB 의 categories 테이블에 ledger_id = null 로 시드된다. 앱은 여기 key 를 uuid 로
 * 매핑해서 쓰고, 이 패키지는 uuid 를 모른다 (순수성 유지).
 *
 * isFixed 는 예산 계산에서 갈린다. 고정비를 burn rate 에 넣으면 월초 월세 때문에
 * "월말 예상 800만원" 같은 헛소리가 나온다 (스펙 4-4).
 */
import type { TransactionKind } from '@haruchi/schema';

export interface SeedCategory {
  /** 안정적인 슬러그. DB 마이그레이션과 시드 규칙이 이 값으로 서로를 가리킨다. */
  key: string;
  name: string;
  kind: TransactionKind;
  /** 상위 카테고리 key. 최상위면 null. */
  parent: string | null;
  isFixed: boolean;
  sortOrder: number;
}

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  // 지출 — 식비
  { key: 'food', name: '식비', kind: 'expense', parent: null, isFixed: false, sortOrder: 10 },
  { key: 'food.cafe', name: '카페·음료', kind: 'expense', parent: 'food', isFixed: false, sortOrder: 11 },
  { key: 'food.delivery', name: '배달', kind: 'expense', parent: 'food', isFixed: false, sortOrder: 12 },
  { key: 'food.convenience', name: '편의점', kind: 'expense', parent: 'food', isFixed: false, sortOrder: 13 },
  { key: 'food.dining', name: '외식', kind: 'expense', parent: 'food', isFixed: false, sortOrder: 14 },
  { key: 'food.grocery', name: '장보기', kind: 'expense', parent: 'food', isFixed: false, sortOrder: 15 },

  // 지출 — 교통
  { key: 'transport', name: '교통', kind: 'expense', parent: null, isFixed: false, sortOrder: 20 },
  { key: 'transport.transit', name: '대중교통', kind: 'expense', parent: 'transport', isFixed: false, sortOrder: 21 },
  { key: 'transport.taxi', name: '택시', kind: 'expense', parent: 'transport', isFixed: false, sortOrder: 22 },
  { key: 'transport.fuel', name: '주유', kind: 'expense', parent: 'transport', isFixed: false, sortOrder: 23 },
  { key: 'transport.parking', name: '주차·통행료', kind: 'expense', parent: 'transport', isFixed: false, sortOrder: 24 },

  // 지출 — 주거·통신 (대부분 고정비)
  { key: 'home', name: '주거·통신', kind: 'expense', parent: null, isFixed: true, sortOrder: 30 },
  { key: 'home.rent', name: '월세·관리비', kind: 'expense', parent: 'home', isFixed: true, sortOrder: 31 },
  { key: 'home.utility', name: '공과금', kind: 'expense', parent: 'home', isFixed: true, sortOrder: 32 },
  { key: 'home.telecom', name: '통신비', kind: 'expense', parent: 'home', isFixed: true, sortOrder: 33 },

  // 지출 — 쇼핑
  { key: 'shopping', name: '쇼핑', kind: 'expense', parent: null, isFixed: false, sortOrder: 40 },
  { key: 'shopping.online', name: '온라인쇼핑', kind: 'expense', parent: 'shopping', isFixed: false, sortOrder: 41 },
  { key: 'shopping.fashion', name: '의류·패션', kind: 'expense', parent: 'shopping', isFixed: false, sortOrder: 42 },
  { key: 'shopping.beauty', name: '뷰티·미용', kind: 'expense', parent: 'shopping', isFixed: false, sortOrder: 43 },
  { key: 'shopping.electronics', name: '가전·디지털', kind: 'expense', parent: 'shopping', isFixed: false, sortOrder: 44 },
  { key: 'shopping.household', name: '생활용품', kind: 'expense', parent: 'shopping', isFixed: false, sortOrder: 45 },

  // 지출 — 문화·여가
  { key: 'leisure', name: '문화·여가', kind: 'expense', parent: null, isFixed: false, sortOrder: 50 },
  { key: 'leisure.subscription', name: '구독', kind: 'expense', parent: 'leisure', isFixed: true, sortOrder: 51 },
  { key: 'leisure.movie', name: '영화·공연', kind: 'expense', parent: 'leisure', isFixed: false, sortOrder: 52 },
  { key: 'leisure.game', name: '게임', kind: 'expense', parent: 'leisure', isFixed: false, sortOrder: 53 },
  { key: 'leisure.book', name: '도서', kind: 'expense', parent: 'leisure', isFixed: false, sortOrder: 54 },
  { key: 'leisure.travel', name: '여행·숙박', kind: 'expense', parent: 'leisure', isFixed: false, sortOrder: 55 },
  { key: 'leisure.fitness', name: '운동', kind: 'expense', parent: 'leisure', isFixed: false, sortOrder: 56 },

  // 지출 — 의료·교육
  { key: 'health', name: '의료·건강', kind: 'expense', parent: null, isFixed: false, sortOrder: 60 },
  { key: 'health.clinic', name: '병원', kind: 'expense', parent: 'health', isFixed: false, sortOrder: 61 },
  { key: 'health.pharmacy', name: '약국', kind: 'expense', parent: 'health', isFixed: false, sortOrder: 62 },
  { key: 'education', name: '교육', kind: 'expense', parent: null, isFixed: false, sortOrder: 70 },

  // 지출 — 금융 (대부분 고정비)
  { key: 'finance', name: '보험·금융', kind: 'expense', parent: null, isFixed: true, sortOrder: 80 },
  { key: 'finance.insurance', name: '보험료', kind: 'expense', parent: 'finance', isFixed: true, sortOrder: 81 },
  { key: 'finance.loan', name: '대출이자', kind: 'expense', parent: 'finance', isFixed: true, sortOrder: 82 },
  { key: 'finance.fee', name: '수수료', kind: 'expense', parent: 'finance', isFixed: false, sortOrder: 83 },

  // 지출 — 기타
  { key: 'social', name: '경조사·선물', kind: 'expense', parent: null, isFixed: false, sortOrder: 90 },
  { key: 'pet', name: '반려동물', kind: 'expense', parent: null, isFixed: false, sortOrder: 91 },
  { key: 'baby', name: '육아', kind: 'expense', parent: null, isFixed: false, sortOrder: 92 },
  { key: 'etc', name: '기타', kind: 'expense', parent: null, isFixed: false, sortOrder: 99 },

  // 수입
  { key: 'income', name: '수입', kind: 'income', parent: null, isFixed: false, sortOrder: 100 },
  { key: 'income.salary', name: '급여', kind: 'income', parent: 'income', isFixed: false, sortOrder: 101 },
  { key: 'income.refund', name: '환급·환불', kind: 'income', parent: 'income', isFixed: false, sortOrder: 102 },
  { key: 'income.etc', name: '기타수입', kind: 'income', parent: 'income', isFixed: false, sortOrder: 103 },

  // 이체 — 내 계좌 간 이동. 통계에서 제외 대상이다.
  { key: 'transfer', name: '이체', kind: 'transfer', parent: null, isFixed: false, sortOrder: 110 },
];

const BY_KEY = new Map(SEED_CATEGORIES.map((category) => [category.key, category]));

export function findCategory(key: string): SeedCategory | undefined {
  return BY_KEY.get(key);
}

export function isKnownCategory(key: string): boolean {
  return BY_KEY.has(key);
}
