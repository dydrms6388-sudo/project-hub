import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/sha256.js';

describe('sha256Hex', () => {
  it('빈 문자열', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('abc', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('블록 경계를 넘는 입력 (56바이트)', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  // dedupe_key 는 한글 상호명을 포함한다. UTF-8 인코딩이 node:crypto 와 일치해야
  // 서버에서 다시 계산해도 같은 키가 나온다.
  it('한글 입력이 node:crypto 와 일치한다', () => {
    const input = '1234|202608111230|12000|스타벅스강남2호|N';
    const expected = createHash('sha256').update(input, 'utf8').digest('hex');
    expect(sha256Hex(input)).toBe(expected);
  });

  it('긴 입력도 node:crypto 와 일치한다', () => {
    const input = '가'.repeat(500) + 'x'.repeat(123);
    const expected = createHash('sha256').update(input, 'utf8').digest('hex');
    expect(sha256Hex(input)).toBe(expected);
  });

  it('한 글자만 달라도 결과가 완전히 달라진다', () => {
    expect(sha256Hex('12000')).not.toBe(sha256Hex('12001'));
  });
});
