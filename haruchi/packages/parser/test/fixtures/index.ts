import { hyundaiCardFixture } from './hyundai-card.js';
import { kakaoBankFixture } from './kakao-bank.js';
import { kbBankFixture } from './kb-bank.js';
import { kbCardFixture } from './kb-card.js';
import { samsungCardFixture } from './samsung-card.js';
import { shinhanCardFixture } from './shinhan-card.js';
import { tossBankFixture } from './toss-bank.js';
import type { AdapterFixture } from './types.js';

export const fixtures: readonly AdapterFixture[] = [
  shinhanCardFixture,
  kbCardFixture,
  samsungCardFixture,
  hyundaiCardFixture,
  tossBankFixture,
  kakaoBankFixture,
  kbBankFixture,
];

export * from './types.js';
