/* writelab-kr 공용 유틸 — 모든 처리는 브라우저 안에서만 수행됩니다. */
(function (g) {
  'use strict';
  var WL = {};

  WL.norm = function (t) { return (t || '').replace(/\r\n?/g, '\n'); };
  WL.esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  WL.fmt = function (n) { return Number(n).toLocaleString('ko-KR'); };
  WL.$ = function (sel, root) { return (root || document).querySelector(sel); };
  WL.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  WL.debounce = function (fn, ms) {
    var t; return function () {
      var a = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 150);
    };
  };

  WL.saveLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  WL.loadLS = function (k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  };

  WL.copy = function (text, btn) {
    function done(ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? '복사됨 ✓' : '복사 실패';
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
      document.body.removeChild(ta);
    }
  };

  WL.download = function (name, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 300);
  };

  /* ---- 글자수 ---- */
  // EUC-KR 근사: ASCII(영문·숫자·기본 문장부호·공백) 1바이트, 그 외(한글 등) 2바이트.
  WL.eucBytes = function (t) {
    var n = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t.codePointAt(i);
      if (c > 0xFFFF) i++;
      n += (c <= 0x7F) ? 1 : 2;
    }
    return n;
  };
  WL.utf8Bytes = function (t) { return new TextEncoder().encode(t).length; };

  WL.charStats = function (text) {
    var t = WL.norm(text);
    var arr = Array.from(t);
    var inclNl = arr.length;                                   // 줄바꿈 포함 전체
    var incl = 0, excl = 0;
    for (var i = 0; i < arr.length; i++) {
      var ch = arr[i];
      if (ch !== '\n') incl++;                                  // 공백 포함(줄바꿈 제외)
      if (!/\s/.test(ch)) excl++;                               // 공백 제외
    }
    var trimmed = t.trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    var paras = t.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (paras.length === 0 && trimmed) paras = [trimmed];
    return {
      incl: incl, inclNl: inclNl, excl: excl, words: words,
      paras: paras, paraCount: paras.length,
      sents: WL.splitSentences(t), utf8: WL.utf8Bytes(t), euc: WL.eucBytes(t)
    };
  };

  /* ---- 문장 분리(근사): 마침표/물음표/느낌표/말줄임표 + 줄바꿈 기준 ---- */
  WL.splitSentences = function (text) {
    var out = [];
    WL.norm(text).split(/\n+/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var parts = line.match(/[^.!?…。]*[.!?…。]+["')\]]*\s*|[^.!?…。]+$/g) || [line];
      parts.forEach(function (p) { p = p.trim(); if (p) out.push(p); });
    });
    return out;
  };

  /* ---- 어절 토큰화 ---- */
  WL.tokenize = function (text) {
    return WL.norm(text).split(/\s+/).map(function (w) {
      return w.replace(/^[^0-9A-Za-z가-힣]+|[^0-9A-Za-z가-힣]+$/g, '');
    }).filter(Boolean);
  };

  /* ---- 조사 제거(간단 규칙, 근사) ---- */
  var JOSA = ['에서부터', '으로부터', '이라는', '에서의', '에게서', '으로써', '으로서', '라는', '에서', '에게', '께서',
    '한테', '부터', '까지', '처럼', '보다', '으로', '로서', '로써', '마다', '조차', '밖에', '이나', '이며', '이고',
    '이라', '에는', '에도', '와의', '과의', '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로'];
  WL.stripJosa = function (w) {
    if (!/[가-힣]$/.test(w)) return w;
    for (var i = 0; i < JOSA.length; i++) {
      var j = JOSA[i];
      if (w.length - j.length >= 2 && w.slice(-j.length) === j) return w.slice(0, -j.length);
    }
    return w;
  };

  /* ---- 어절 단위 LCS diff ---- */
  // a, b: 토큰 배열. 반환: [{t:'eq'|'del'|'ins', v:토큰}]
  WL.lcsDiff = function (a, b) {
    var n = a.length, m = b.length;
    if (n * m > 6000000) return null; // 과대 입력 가드(호출측에서 안내)
    var W = m + 1;
    var dp = new Int32Array((n + 1) * W);
    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i * W + j] = (a[i] === b[j])
          ? dp[(i + 1) * W + j + 1] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    var ops = [], x = 0, y = 0;
    while (x < n && y < m) {
      if (a[x] === b[y]) { ops.push({ t: 'eq', v: a[x] }); x++; y++; }
      else if (dp[(x + 1) * W + y] >= dp[x * W + y + 1]) { ops.push({ t: 'del', v: a[x] }); x++; }
      else { ops.push({ t: 'ins', v: b[y] }); y++; }
    }
    while (x < n) { ops.push({ t: 'del', v: a[x++] }); }
    while (y < m) { ops.push({ t: 'ins', v: b[y++] }); }
    return ops;
  };

  g.WL = WL;
})(typeof window !== 'undefined' ? window : globalThis);
