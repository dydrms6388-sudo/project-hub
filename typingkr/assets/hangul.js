/* typingkr — 한글 자모 분해기 (유니코드 산술, 외부 라이브러리 없음)
 * 타수(타) 규칙: 두벌식 키 입력 횟수 기준.
 *  - 쌍자음(ㄲㄸㅃㅆㅉ)과 ㅐㅔㅒㅖ 는 키 1개 → 1타
 *  - 복합모음(ㅘㅙㅚㅝㅞㅟㅢ)·겹받침(ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ)은 구성 자모 수만큼 카운트
 *  예) "값" → ㄱ,ㅏ,ㅂ,ㅅ = 4타 / "귀" → ㄱ,ㅜ,ㅣ = 3타
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.TKHangul = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  // 복합 자모 → 구성 키 자모
  var SPLIT = {
    'ㅘ':['ㅗ','ㅏ'], 'ㅙ':['ㅗ','ㅐ'], 'ㅚ':['ㅗ','ㅣ'],
    'ㅝ':['ㅜ','ㅓ'], 'ㅞ':['ㅜ','ㅔ'], 'ㅟ':['ㅜ','ㅣ'], 'ㅢ':['ㅡ','ㅣ'],
    'ㄳ':['ㄱ','ㅅ'], 'ㄵ':['ㄴ','ㅈ'], 'ㄶ':['ㄴ','ㅎ'],
    'ㄺ':['ㄹ','ㄱ'], 'ㄻ':['ㄹ','ㅁ'], 'ㄼ':['ㄹ','ㅂ'], 'ㄽ':['ㄹ','ㅅ'],
    'ㄾ':['ㄹ','ㅌ'], 'ㄿ':['ㄹ','ㅍ'], 'ㅀ':['ㄹ','ㅎ'], 'ㅄ':['ㅂ','ㅅ']
  };

  function splitJamo(j) { return SPLIT[j] ? SPLIT[j].slice() : [j]; }

  function isSyllable(code) { return code >= 0xAC00 && code <= 0xD7A3; }
  // 호환 자모 영역 (ㄱ~ㅣ)
  function isCompatJamo(code) { return code >= 0x3131 && code <= 0x3163; }

  /** 문자 1개 → 키 자모 배열. 한글 아니면 [ch] 그대로. */
  function decompose(ch) {
    var code = ch.charCodeAt(0);
    if (isSyllable(code)) {
      var idx = code - 0xAC00;
      var cho = CHO[Math.floor(idx / 588)];
      var jung = JUNG[Math.floor((idx % 588) / 28)];
      var jong = JONG[idx % 28];
      var out = splitJamo(cho).concat(splitJamo(jung));
      if (jong) out = out.concat(splitJamo(jong));
      return out;
    }
    if (isCompatJamo(code)) return splitJamo(ch);
    return [ch];
  }

  /** 문자열 전체 → 키 자모 배열(공백·문장부호 포함, 각 1타) */
  function decomposeAll(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) out = out.concat(decompose(str[i]));
    return out;
  }

  /** 문자 1개의 타수 */
  function strokes(ch) { return decompose(ch).length; }

  /** 문자열 전체 타수 */
  function strokesAll(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n += decompose(str[i]).length;
    return n;
  }

  function isHangulChar(ch) {
    var c = ch.charCodeAt(0);
    return isSyllable(c) || isCompatJamo(c);
  }

  return {
    decompose: decompose,
    decomposeAll: decomposeAll,
    strokes: strokes,
    strokesAll: strokesAll,
    isHangulChar: isHangulChar,
    CHO: CHO, JUNG: JUNG, JONG: JONG, SPLIT: SPLIT
  };
});
