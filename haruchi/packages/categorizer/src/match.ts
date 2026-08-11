/**
 * 매칭 유틸.
 *
 * 사용자 규칙의 regex 는 사용자가 직접 쓴 문자열이다. 서버에서 그대로 실행하면
 * 파국적 백트래킹으로 요청 하나가 CPU 를 붙잡을 수 있다. 여기서 걸러낸다.
 */

/**
 * 비교용 정규화. 카드사마다 띄어쓰기·괄호·대소문자가 다르다.
 * 상호명과 키워드 양쪽에 같은 함수를 적용해야 결과가 결정적이다.
 */
export function toComparable(value: string): string {
  return value
    .normalize('NFC')
    .toUpperCase()
    .replace(/[\s()（）·.\-_/*'"’,]/g, '');
}

/** 사용자 정규식 길이 상한. 이보다 긴 패턴은 규칙이 아니라 사고다. */
const MAX_PATTERN_LENGTH = 200;

/**
 * 파국적 백트래킹 탐지.
 *
 * 두 가지 형태를 잡는다. 둘 다 "수량자가 걸린 그룹 안에서 같은 입력을 여러 갈래로
 * 나눠 읽을 수 있는" 구조라 입력 길이에 지수적으로 반응한다.
 *   - 중첩 수량자:      (a+)+
 *   - 겹치는 교대:      (a|aa)*
 *
 * 완벽한 판별은 불가능하다. 의심스러우면 거부한다 — 규칙 하나를 못 쓰는 것보다
 * 요청 하나가 CPU 를 붙잡는 쪽이 훨씬 나쁘다.
 */
const NESTED_QUANTIFIER = /[(\[][^)\]]*[+*{|][^)\]]*[)\]]\s*[+*{]/;

const compiled = new Map<string, RegExp | null>();
const CACHE_LIMIT = 500;

/**
 * 사용자 정규식을 안전하게 컴파일한다. 위험하거나 잘못된 패턴이면 null.
 * null 을 받은 호출부는 그 규칙을 건너뛴다 — 규칙 하나 때문에 분류 전체가
 * 멈추면 안 된다.
 */
export function compileSafeRegex(pattern: string): RegExp | null {
  const cached = compiled.get(pattern);
  if (cached !== undefined) return cached;

  let result: RegExp | null = null;
  if (pattern.length > 0 && pattern.length <= MAX_PATTERN_LENGTH && !NESTED_QUANTIFIER.test(pattern)) {
    try {
      result = new RegExp(pattern, 'iu');
    } catch {
      result = null;
    }
  }

  if (compiled.size >= CACHE_LIMIT) compiled.clear();
  compiled.set(pattern, result);
  return result;
}

/** 정규식 매칭에 넘길 입력 길이 상한. 상호명은 이보다 길 수 없다. */
export const MAX_SUBJECT_LENGTH = 120;

export function matchesRegex(pattern: string, subject: string): boolean {
  if (subject.length > MAX_SUBJECT_LENGTH) return false;
  const regex = compileSafeRegex(pattern);
  if (!regex) return false;
  regex.lastIndex = 0;
  return regex.test(subject);
}
