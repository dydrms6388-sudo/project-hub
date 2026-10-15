/**
 * Slug generation: 한글 → 로마자(개정 로마자 근사) + 짧은 해시.
 * Deterministic — the same input yields the same slug, so collision handling is
 * a suffix bump, not a random retry.
 */

// 개정 로마자 표기(근사): 초성/중성/종성 매핑.
const CHO = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj",
  "ch", "k", "t", "p", "h",
];
const JUNG = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe",
  "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const JONG = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "l",
  "l", "m", "p", "l", "t", "t", "ng", "t", "t", "k", "t", "p", "h",
];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/** Romanize a Korean/mixed string to ASCII-ish syllables. */
export function romanize(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= HANGUL_BASE && code <= HANGUL_END) {
      const s = code - HANGUL_BASE;
      const cho = Math.floor(s / 588);
      const jung = Math.floor((s % 588) / 28);
      const jong = s % 28;
      out += CHO[cho]! + JUNG[jung]! + JONG[jong]!;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Kebab-case an already-romanized string. */
export function kebab(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Tiny non-cryptographic hash (FNV-1a, 32-bit) rendered base36. Used only to
 * disambiguate slugs — no security properties intended.
 */
export function shortHash(input: string, len = 6): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(len, "0").slice(0, len);
}

/**
 * Build a slug from title text. Appends a short content hash so two different
 * submissions with the same title don't collide on the human-readable stem.
 */
export function makeSlug(title: string, seed = title): string {
  const stem = kebab(romanize(title)) || "post";
  return `${stem}-${shortHash(seed)}`;
}
