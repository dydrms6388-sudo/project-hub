/**
 * 붙여넣은 텍스트 덩어리를 "메시지 1건 = 블록 1개"로 자른다.
 *
 * 한 번에 30건을 붙여넣어도, 여러 카드사 문자가 섞여 있어도 동작해야 한다.
 * 잘못 자르면 그 뒤의 모든 파싱이 틀어지므로 규칙을 좁고 명시적으로 유지한다.
 */

/** 새 메시지의 시작을 알리는 표지. 이 줄을 만나면 이전 블록을 끊는다. */
const MESSAGE_START =
  /^(?:\[Web발신\]|\[국제발신\]|\[토스뱅크\]|\[카카오뱅크\]|\[케이뱅크\]|(?:KB)?국민카드|신한카드|삼성카드|현대카드|롯데카드|BC카드|비씨카드|하나카드|우리카드|NH카드|농협카드|국민은행|신한은행|우리은행|하나은행|농협은행|기업은행|카카오뱅크|토스뱅크)/;

/** 발신 헤더 자체 — 이 줄로 시작한 블록 안에서는 다른 표지를 만나도 끊지 않는다. */
const ENVELOPE_HEADER = /^\[(?:Web발신|국제발신)\]/;

/**
 * 줄바꿈·공백·불가시 문자를 정규화한다.
 * \r\n, NBSP, 제로폭 문자는 카드사 문자에서 흔하게 섞여 들어온다.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[  -   　]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
}

/**
 * 정규화된 텍스트를 메시지 블록 배열로 자른다.
 *
 * 규칙:
 * 1. 빈 줄은 블록을 끊는다.
 * 2. `[Web발신]` 류 봉투 헤더는 언제나 새 블록을 연다.
 * 3. 그 밖의 발신처 표지(신한카드…)는 새 블록을 연다. 단 봉투 헤더 **바로 다음** 한 줄은
 *    예외다 — "[Web발신]" 다음 줄의 "신한카드(1234)승인" 은 같은 메시지의 첫 줄이기 때문이다.
 *    이 예외를 첫 줄로 한정하지 않으면, 봉투 하나에 문자 두 건이 이어 붙었을 때
 *    두 번째 메시지가 첫 번째 메시지의 가맹점명으로 빨려 들어가고 조용히 사라진다.
 */
export function splitBlocks(normalized: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let contentLines = 0;
  let currentIsEnveloped = false;

  const flush = (): void => {
    if (current.length > 0) blocks.push(current.join('\n').trim());
    current = [];
    contentLines = 0;
    currentIsEnveloped = false;
  };

  for (const line of normalized.split('\n')) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (ENVELOPE_HEADER.test(line)) {
      flush();
      current.push(line);
      currentIsEnveloped = true;
      continue;
    }
    const isEnvelopeFirstLine = currentIsEnveloped && contentLines === 0;
    if (MESSAGE_START.test(line) && current.length > 0 && !isEnvelopeFirstLine) {
      flush();
    }
    current.push(line);
    contentLines += 1;
  }
  flush();

  return blocks.filter((b) => b.length > 0);
}

/** 이 줄이 새 메시지의 시작처럼 보이는지. 가맹점 후보를 거를 때도 쓴다. */
export function looksLikeMessageStart(line: string): boolean {
  return ENVELOPE_HEADER.test(line) || MESSAGE_START.test(line);
}

/** 봉투 헤더를 떼어낸 본문. 어댑터는 본문만 보면 된다. */
export function stripEnvelope(block: string): string {
  return block
    .split('\n')
    .filter((line) => !ENVELOPE_HEADER.test(line))
    .join('\n')
    .trim();
}
