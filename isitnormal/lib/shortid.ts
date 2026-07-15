import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** base62 랜덤 shortId. 파라미터 무한조합 색인을 막기 위해 서버 조회 전용 키로만 쓴다(U4). */
export function makeShortId(len = 9): string {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
