import { describe, expect, it } from 'vitest';
import { MAX_SUBJECT_LENGTH, compileSafeRegex, matchesRegex, toComparable } from '../src/match.js';

describe('toComparable', () => {
  it('대소문자·띄어쓰기·괄호를 없앤다', () => {
    expect(toComparable('(주) 스타 벅스')).toBe('주스타벅스');
    expect(toComparable('gs 25')).toBe('GS25');
  });

  it('같은 상호명의 표기 차이를 하나로 모은다', () => {
    expect(toComparable('S-OIL')).toBe(toComparable('S OIL'));
    expect(toComparable('CU 역삼점')).toBe(toComparable('CU역삼점'));
  });

  it('한글 자모 분리 입력을 흡수한다', () => {
    expect(toComparable('스타벅스'.normalize('NFD'))).toBe('스타벅스');
  });
});

describe('compileSafeRegex', () => {
  it('정상 패턴을 컴파일한다', () => {
    expect(compileSafeRegex('^스타벅스')).toBeInstanceOf(RegExp);
  });

  it('같은 패턴은 캐시된 인스턴스를 돌려준다', () => {
    expect(compileSafeRegex('^캐시테스트')).toBe(compileSafeRegex('^캐시테스트'));
  });

  it('문법이 깨진 패턴은 null 이다', () => {
    expect(compileSafeRegex('([')).toBeNull();
  });

  it('빈 패턴은 null 이다', () => {
    expect(compileSafeRegex('')).toBeNull();
  });

  it('지나치게 긴 패턴은 거부한다', () => {
    expect(compileSafeRegex('a'.repeat(201))).toBeNull();
  });

  it('중첩 수량자는 거부한다 — 파국적 백트래킹의 전형', () => {
    expect(compileSafeRegex('(a+)+')).toBeNull();
    expect(compileSafeRegex('(a|aa)*$')).toBeNull();
    expect(compileSafeRegex('[a-z]+*')).toBeNull();
  });

  it('캐시가 한도를 넘어도 계속 동작한다', () => {
    for (let i = 0; i < 600; i++) compileSafeRegex(`^패턴${i}`);
    expect(compileSafeRegex('^패턴599')).toBeInstanceOf(RegExp);
  });
});

describe('matchesRegex', () => {
  it('맞으면 true', () => {
    expect(matchesRegex('^스타벅스.*점$', '스타벅스강남2호점')).toBe(true);
  });

  it('대소문자를 가리지 않는다', () => {
    expect(matchesRegex('^gs25', 'GS25강남점')).toBe(true);
  });

  it('상호명 길이 상한을 넘는 입력은 아예 돌리지 않는다', () => {
    const tooLong = 'a'.repeat(MAX_SUBJECT_LENGTH + 1);
    expect(matchesRegex('^a+$', tooLong)).toBe(false);
  });

  it('위험한 패턴은 즉시 false 로 끊는다', () => {
    const started = Date.now();
    expect(matchesRegex('(a+)+$', `${'a'.repeat(100)}b`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
