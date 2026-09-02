/* lottolab-kr 공용 유틸 — 헤더/푸터 주입 없음, 순수 헬퍼만 */
(function (global) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function comma(n) {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR');
  }

  /* 공 색상 그룹: 1-10 노랑, 11-20 파랑, 21-30 빨강, 31-40 회색, 41-45 초록 */
  function ballGroup(n) { return Math.min(5, Math.ceil(n / 10)); }

  function ballHTML(n, small) {
    return '<span class="ball g' + ballGroup(n) + (small ? ' sm' : '') + '">' + n + '</span>';
  }

  function ballLineHTML(numbers, bonus, small) {
    var h = numbers.map(function (n) { return ballHTML(n, small); }).join('');
    if (bonus != null) h += '<span class="ball bonus-sep">+</span>' + ballHTML(bonus, small);
    return '<span class="ball-line">' + h + '</span>';
  }

  /* draws.json 로드 — tools/<slug>/ 기준 상대경로. 실패/빈 데이터 모두 [] 반환 */
  function loadDraws(path) {
    return fetch(path || '../../data/draws.json', { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (arr) {
        if (!Array.isArray(arr)) return [];
        return arr.slice().sort(function (a, b) { return a.round - b.round; });
      })
      .catch(function () { return []; });
  }

  var EMPTY_MSG = '회차 데이터 수집 준비 중입니다 — 매주 토요일 자동 갱신';
  function emptyDataHTML(extra) {
    return '<div class="empty-data">🍀 ' + EMPTY_MSG + (extra ? '<br><span class="muted">' + extra + '</span>' : '') + '</div>';
  }

  /* 등수 판정: 1등 6개 / 2등 5개+보너스 / 3등 5개 / 4등 4개 / 5등 3개 */
  function judge(myNums, drawNums, bonus) {
    var m = myNums.filter(function (n) { return drawNums.indexOf(n) >= 0; }).length;
    var hasBonus = myNums.indexOf(bonus) >= 0;
    if (m === 6) return { rank: 1, match: m, bonus: false };
    if (m === 5 && hasBonus) return { rank: 2, match: m, bonus: true };
    if (m === 5) return { rank: 3, match: m, bonus: false };
    if (m === 4) return { rank: 4, match: m, bonus: false };
    if (m === 3) return { rank: 5, match: m, bonus: false };
    return { rank: 0, match: m, bonus: hasBonus };
  }

  /* crypto 기반 정수 난수 [0, max) — 모듈로 편향 제거 */
  function cryptoInt(max) {
    var buf = new Uint32Array(1);
    var limit = Math.floor(4294967296 / max) * max;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  /* 1~45 중 6개 무작위 (제외/고정 제약) */
  function pick6(fixed, excluded) {
    fixed = fixed || []; excluded = excluded || [];
    var pool = [];
    for (var i = 1; i <= 45; i++) {
      if (fixed.indexOf(i) < 0 && excluded.indexOf(i) < 0) pool.push(i);
    }
    var out = fixed.slice();
    var p = pool.slice();
    while (out.length < 6) {
      if (!p.length) return null;
      out.push(p.splice(cryptoInt(p.length), 1)[0]);
    }
    return out.sort(function (a, b) { return a - b; });
  }

  /* 문자열 → 32bit 해시 (결정론적 seed용) */
  function strHash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* mulberry32 시드 PRNG (dream 등 결정론적 용도 전용 — 생성기는 crypto 사용) */
  function seededRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededPick6(rng) {
    var pool = [];
    for (var i = 1; i <= 45; i++) pool.push(i);
    var out = [];
    for (var k = 0; k < 6; k++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out.sort(function (a, b) { return a - b; });
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* 캔버스에 공 그리기 (이미지 저장 카드 공용) */
  var BALL_FILL = { 1: '#fbc400', 2: '#69c8f2', 3: '#ff7272', 4: '#9aa4af', 5: '#8fc31f' };
  function drawBall(ctx, x, y, r, n) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = BALL_FILL[ballGroup(n)];
    ctx.fill();
    ctx.fillStyle = ballGroup(n) === 1 ? '#5b4a00' : '#fff';
    ctx.font = '700 ' + Math.round(r * 0.9) + 'px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + 1);
  }

  global.LL = {
    $: $, $$: $$, comma: comma,
    ballGroup: ballGroup, ballHTML: ballHTML, ballLineHTML: ballLineHTML,
    loadDraws: loadDraws, EMPTY_MSG: EMPTY_MSG, emptyDataHTML: emptyDataHTML,
    judge: judge, cryptoInt: cryptoInt, pick6: pick6,
    strHash: strHash, seededRng: seededRng, seededPick6: seededPick6,
    qs: qs, drawBall: drawBall
  };
})(window);
