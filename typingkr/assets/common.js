/* typingkr 공용 유틸 — 테마/사운드/결과카드/URL상태 */
(function () {
  'use strict';
  var TK = window.TK = window.TK || {};

  /* ---------- 테마 (다크/라이트, 이 사이트 한정) ---------- */
  var THEME_KEY = 'typingkr-theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = document.getElementById('themeBtn');
    if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  TK.initTheme = function () {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    var t = saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(t);
    var b = document.getElementById('themeBtn');
    if (b) b.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  };

  /* ---------- 사운드 피드백 (WebAudio, 파일 없음) ---------- */
  var SOUND_KEY = 'typingkr-sound';
  var audioCtx = null;
  TK.soundOn = false;
  try { TK.soundOn = localStorage.getItem(SOUND_KEY) === '1'; } catch (e) {}
  function beep(freq, dur, gain) {
    if (!TK.soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.03, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.05));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur || 0.05));
    } catch (e) {}
  }
  TK.clickSound = function () { beep(880, 0.03, 0.02); };
  TK.errorSound = function () { beep(180, 0.09, 0.045); };
  TK.doneSound = function () { beep(660, 0.07, 0.03); setTimeout(function () { beep(990, 0.12, 0.03); }, 80); };
  TK.bindSoundToggle = function (id) {
    var b = document.getElementById(id || 'soundBtn');
    if (!b) return;
    function label() { b.textContent = TK.soundOn ? '🔊 소리 켬' : '🔇 소리 끔'; }
    label();
    b.addEventListener('click', function () {
      TK.soundOn = !TK.soundOn;
      try { localStorage.setItem(SOUND_KEY, TK.soundOn ? '1' : '0'); } catch (e) {}
      label(); if (TK.soundOn) TK.clickSound();
    });
  };

  /* ---------- 모바일 감지 ---------- */
  TK.isMobile = function () {
    return window.matchMedia && matchMedia('(max-width: 700px)').matches &&
      matchMedia('(pointer: coarse)').matches;
  };

  /* ---------- URL 결과 상태 (?r=base64) ---------- */
  TK.encodeState = function (obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, '');
  };
  TK.decodeState = function () {
    try {
      var m = location.search.match(/[?&]r=([^&]+)/);
      if (!m) return null;
      return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    } catch (e) { return null; }
  };

  /* ---------- localStorage 헬퍼 ---------- */
  TK.store = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  TK.load = function (k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  };

  /* ---------- 결과 카드 (canvas PNG) ---------- */
  /* opts: {title, sub, stats:[{label,value}], footer} → canvas 반환 */
  TK.drawResultCard = function (opts) {
    var W = 640, H = 400, dpr = 2;
    var cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    cv.className = 'result-canvas';
    var x = cv.getContext('2d');
    x.scale(dpr, dpr);
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    // 배경
    var g = x.createLinearGradient(0, 0, W, H);
    if (dark) { g.addColorStop(0, '#111a2c'); g.addColorStop(1, '#1c2a45'); }
    else { g.addColorStop(0, '#ecfeff'); g.addColorStop(1, '#ede9fe'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 카드
    x.fillStyle = dark ? '#1a2233' : '#ffffff';
    x.strokeStyle = dark ? '#3b4a6b' : '#e2e8f0';
    roundRect(x, 24, 24, W - 48, H - 48, 18); x.fill(); x.stroke();
    var ink = dark ? '#e6edf6' : '#1a202c', sub = dark ? '#8b9bb4' : '#64748b';
    var ff = "'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif";
    // 제목
    x.fillStyle = ink; x.textAlign = 'center';
    x.font = '700 24px ' + ff;
    x.fillText(opts.title, W / 2, 78);
    if (opts.sub) { x.fillStyle = sub; x.font = '400 15px ' + ff; x.fillText(opts.sub, W / 2, 104); }
    // 스탯
    var stats = opts.stats || [];
    var n = stats.length, bw = (W - 96) / n;
    for (var i = 0; i < n; i++) {
      var cx = 48 + bw * i + bw / 2;
      x.fillStyle = '#0891b2';
      x.font = '800 ' + (n > 3 ? 30 : 40) + 'px ' + ff;
      x.fillText(String(stats[i].value), cx, 200);
      x.fillStyle = sub; x.font = '400 14px ' + ff;
      x.fillText(stats[i].label, cx, 228);
    }
    if (opts.footer) {
      x.fillStyle = ink; x.font = '600 16px ' + ff;
      x.fillText(opts.footer, W / 2, 285);
    }
    // 워터마크
    x.fillStyle = sub; x.font = '500 13px ' + ff;
    x.fillText('tomatoeggcat.com/typingkr', W / 2, H - 46);
    return cv;
  };
  function roundRect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r);
    x.closePath();
  }
  TK.downloadCanvas = function (cv, filename) {
    var a = document.createElement('a');
    a.download = filename || 'typingkr-result.png';
    a.href = cv.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };
  TK.copyText = function (text, btn, okMsg) {
    function done() { if (btn) { var t = btn.textContent; btn.textContent = okMsg || '복사됨!'; setTimeout(function () { btn.textContent = t; }, 1500); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
  };

  /* ---------- 무작위 ---------- */
  TK.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  TK.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  document.addEventListener('DOMContentLoaded', TK.initTheme);
})();
