/* GenLab 공용 유틸 — 외부 라이브러리 없음, 전부 자체 구현 */
(function () {
  'use strict';
  var G = {};

  /* ---------- 난수 ----------
   * 기본: crypto.getRandomValues (암호학적 난수)
   * seed 입력 시: mulberry32 (결정론적, 같은 seed → 같은 결과) */
  function xmur3(str) { // 문자열 → 32bit seed 해시
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  G.seededRng = function (seedStr) { return mulberry32(xmur3(String(seedStr))()); };
  G.cryptoRng = function () {
    var buf = new Uint32Array(128), idx = buf.length;
    return function () {
      if (idx >= buf.length) { crypto.getRandomValues(buf); idx = 0; }
      return buf[idx++] / 4294967296;
    };
  };
  /* seed가 비어 있으면 crypto, 있으면 결정론적 */
  G.makeRng = function (seedStr) {
    var s = seedStr == null ? '' : String(seedStr).trim();
    return s ? G.seededRng(s) : G.cryptoRng();
  };
  /* 균등 정수 [0, n) — 모듈로 편향 제거(기각 샘플링) */
  G.randInt = function (rng, n) {
    if (n <= 1) return 0;
    var limit = Math.floor(4294967296 / n) * n, x;
    do { x = Math.floor(rng() * 4294967296); } while (x >= limit);
    return x % n;
  };
  G.pick = function (rng, arr) { return arr[G.randInt(rng, arr.length)]; };
  G.shuffle = function (rng, arr) { // Fisher–Yates, 원본 복사
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = G.randInt(rng, i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* ---------- 클립보드 & 토스트 ---------- */
  G.toast = function (msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1800);
  };
  G.copy = function (text, msg) {
    function done() { G.toast(msg || '복사되었습니다'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); done(); });
    } else { fallback(); done(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  };

  /* ---------- 한글 유틸 ---------- */
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var R_CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  var R_JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  var R_JONG = ['','k','k','k','n','n','n','t','l','k','m','p','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

  G.isHangul = function (ch) { var c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3; };
  /* 받침 유무 (조사 선택용) */
  G.hasBatchim = function (word) {
    if (!word) return false;
    var c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return false;
    return (c - 0xAC00) % 28 !== 0;
  };
  /* josa('사과','을/를') → '사과를' */
  G.josa = function (word, pair) {
    var p = pair.split('/');
    return word + (G.hasBatchim(word) ? p[0] : p[1]);
  };
  /* 국어의 로마자 표기법(개정) 단순 적용 — 음운 동화 미반영 근사치 */
  G.romanize = function (str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        var s = c - 0xAC00;
        var cho = Math.floor(s / 588), jung = Math.floor((s % 588) / 28), jong = s % 28;
        out += R_CHO[cho] + R_JUNG[jung] + R_JONG[jong];
      } else {
        out += str[i];
      }
    }
    return out;
  };
  G.CHO = CHO;

  /* ---------- 기타 ---------- */
  G.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };
  G.$ = function (sel, root) { return (root || document).querySelector(sel); };
  G.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  window.G = G;
})();
