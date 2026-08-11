import type { Adapter } from '../types.js';
import { hyundaiCard } from './hyundai-card.js';
import { kakaoBank } from './kakao-bank.js';
import { kbBank } from './kb-bank.js';
import { kbCard } from './kb-card.js';
import { samsungCard } from './samsung-card.js';
import { shinhanCard } from './shinhan-card.js';
import { tossBank } from './toss-bank.js';

/**
 * 등록된 어댑터. priority 오름차순으로 정렬해 두고, 먼저 detect 하는 쪽이 이긴다.
 * 새 발신처를 추가할 때 여기에 한 줄 추가하는 것 외에 다른 파일은 건드리지 않는다.
 */
export const adapters: readonly Adapter[] = [
  shinhanCard,
  kbCard,
  samsungCard,
  hyundaiCard,
  tossBank,
  kakaoBank,
  kbBank,
]
  .slice()
  .sort((a, b) => a.priority - b.priority);

export {
  hyundaiCard,
  kakaoBank,
  kbBank,
  kbCard,
  samsungCard,
  shinhanCard,
  tossBank,
};
