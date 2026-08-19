/**
 * `#s=<seed>&d=<lz>` 해시 파싱/조립.
 *
 * URLSearchParams 를 쓰지 않는 이유: lz-string 의 compressToEncodedURIComponent 출력에는
 * '+' 가 들어가는데, URLSearchParams 는 x-www-form-urlencoded 규칙대로 '+' 를 공백으로
 * 바꾼다. (lz-string 이 해제할 때 공백을 다시 '+' 로 되돌리므로 지금은 우연히 동작하지만,
 * 그 보정에 의존하지 않도록 여기서는 값을 손대지 않고 그대로 넘긴다.)
 */
export type HashState = { seed: string; data: string };

export function parseHash(hash: string): HashState | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  let seed = "";
  let data = "";
  for (const part of raw.split("&")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i);
    const val = part.slice(i + 1);
    if (key === "s") seed = decodeURIComponent(val);
    else if (key === "d") data = val; // lz 출력은 이미 URI 안전 — 디코딩하지 않는다
  }
  if (!seed) return null;
  return { seed, data };
}

export function buildHash(seed: string, data: string): string {
  return `#s=${encodeURIComponent(seed)}&d=${data}`;
}
