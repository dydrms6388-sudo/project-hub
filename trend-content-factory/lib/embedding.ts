// 경량 결정론적 임베딩 — 문자 trigram 해싱 백오브워즈 → 고정 차원 벡터.
// 외부 임베딩 API 없이 중복/신선도 판정을 가능하게 한다.
// ⚠️ 프로덕션에서는 실제 임베딩 API 로 교체 권장 (인터페이스는 동일하게 유지).
// DECISIONS.md 의 "임베딩" 항목 참고.

const DIM = 256;

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** djb2 해시 (양수 반환) */
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function embed(text: string): Float64Array {
  const norm = normalizeText(text);
  const vec = new Float64Array(DIM);
  const grams = norm.length < 3 ? [norm] : [];
  for (let i = 0; i + 3 <= norm.length; i += 1) {
    grams.push(norm.slice(i, i + 3));
  }
  for (const g of grams) {
    const idx = hash(g) % DIM;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  // L2 정규화
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < DIM; i += 1) vec[i] = vec[i]! / mag;
  return vec;
}

export function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < DIM; i += 1) dot += a[i]! * b[i]!;
  return dot; // 이미 정규화된 벡터 → 내적 = 코사인
}

/** 텍스트 두 개의 코사인 유사도 (0~1) */
export function textSimilarity(a: string, b: string): number {
  return cosine(embed(a), embed(b));
}
