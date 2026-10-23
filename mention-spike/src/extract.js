// 본문에서 코인 언급 추출. 한 게시물은 코인당 최대 1회로 센다.
// - $BTC / #BTC 캐시태그는 항상 인정
// - 대문자 티커(3자 이상)는 단어 경계 일치 시 인정 (2자 이하는 일반 단어와 충돌이 커서 캐시태그만)
// - 별칭(bitcoin, 비트코인 …)은 대소문자 무시 부분 일치 (한글은 단어 경계가 없으므로)

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildExtractor(coins) {
  const rules = coins.map(c => {
    const sym = escapeRe(c.symbol);
    const tag = new RegExp(`[$#]${sym}\\b`, "i");
    const bare = c.symbol.length >= 3 ? new RegExp(`(^|[^A-Za-z0-9$#])${sym}([^A-Za-z0-9]|$)`) : null;
    const aliases = (c.aliases || []).map(a =>
      /^[a-z0-9]+$/i.test(a) ? new RegExp(`\\b${escapeRe(a)}\\b`, "i") : new RegExp(escapeRe(a), "i"));
    return { symbol: c.symbol, tag, bare, aliases };
  });
  return text => {
    if (!text) return [];
    const out = [];
    for (const r of rules) {
      if (r.tag.test(text) || (r.bare && r.bare.test(text)) || r.aliases.some(a => a.test(text))) out.push(r.symbol);
    }
    return out;
  };
}

// 복붙 스팸 판정용 정규화: 소문자, URL/멘션/숫자/구두점/공백 제거
export function normalizeForDup(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/[\p{P}\p{S}\s\d]+/gu, "");
}
