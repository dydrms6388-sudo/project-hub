/** 문서 식별용 해시 — 순수 함수. FNV-1a 32bit. */

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * 파일 메타 + 본문 일부로 만드는 문서 키.
 * 같은 파일을 다시 올리면 같은 키가 나와 IndexedDB 의 임베딩 캐시를 재사용한다.
 */
export function docKey(name: string, size: number, text: string): string {
  const head = text.slice(0, 2000);
  const tail = text.slice(-2000);
  return `${fnv1a(`${name}|${size}|${text.length}`)}-${fnv1a(head + tail)}`;
}
