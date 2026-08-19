/* studyroom-kr 공용 유틸 (전역 SR) — 외부 의존성 없음 */
window.SR = (function () {
  'use strict';

  /* ---------- URL-safe base64 상태 인코딩 (공유 링크) ---------- */
  function enc(obj) {
    var json = JSON.stringify(obj);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function dec(str) {
    try {
      var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { return null; }
  }
  function shareParam() {
    try { return new URLSearchParams(location.search).get('r'); } catch (e) { return null; }
  }
  function shareUrl(obj) {
    return location.origin + location.pathname + '?r=' + enc(obj);
  }

  /* ---------- localStorage ---------- */
  function save(key, val) {
    try { localStorage.setItem('sr_' + key, JSON.stringify(val)); } catch (e) {}
  }
  function load(key, def) {
    try {
      var v = localStorage.getItem('sr_' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('sr-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sr-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- 클립보드 ---------- */
  function copy(text, msg) {
    function done() { toast(msg || '복사되었습니다'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-99px;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했습니다'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }

  /* ---------- 캔버스 PNG 저장 (사파리 폴백 포함) ---------- */
  function saveCanvas(canvas, filename) {
    function openTab() {
      try {
        var url = canvas.toDataURL('image/png');
        var w = window.open('');
        if (w) {
          w.document.write('<title>' + filename + '</title>' +
            '<p style="font-family:sans-serif;font-size:14px">이미지를 길게 눌러(또는 우클릭) 저장하세요.</p>' +
            '<img src="' + url + '" style="max-width:100%">');
        } else toast('팝업이 차단되어 저장할 수 없습니다');
      } catch (e) { toast('이미지 저장에 실패했습니다'); }
    }
    try {
      canvas.toBlob(function (blob) {
        if (!blob) { openTab(); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        toast('이미지가 저장되었습니다');
      }, 'image/png');
    } catch (e) { openTab(); }
  }

  /* ---------- 파일(텍스트) 다운로드 ---------- */
  function saveText(text, filename, mime) {
    try {
      var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    } catch (e) { toast('다운로드에 실패했습니다'); }
  }

  /* ---------- 과목 색 팔레트 ---------- */
  var PALETTE = [
    '#6366f1', '#f43f5e', '#0ea5e9', '#f59e0b', '#10b981', '#a855f7',
    '#ef4444', '#14b8a6', '#8b5cf6', '#e11d48', '#059669', '#d97706',
    '#3b82f6', '#ec4899', '#84cc16', '#7c3aed'
  ];
  /* 밝은 배경용(블록 배경) */
  function tint(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha == null ? 0.16 : alpha) + ')';
  }

  /* ---------- 날짜 유틸 ---------- */
  var DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtKo(d) {
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DAYS_KO[d.getDay()] + ')';
  }
  function parseYmd(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function daysBetween(a, b) { /* b - a (자정 기준) */
    var A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((B - A) / 86400000);
  }

  /* ---------- 기타 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  /* 캔버스 둥근 사각형 */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return {
    enc: enc, dec: dec, shareParam: shareParam, shareUrl: shareUrl,
    save: save, load: load, toast: toast, copy: copy,
    saveCanvas: saveCanvas, saveText: saveText,
    PALETTE: PALETTE, tint: tint,
    DAYS_KO: DAYS_KO, ymd: ymd, fmtKo: fmtKo, parseYmd: parseYmd, daysBetween: daysBetween,
    uid: uid, esc: esc, pad2: pad2, rr: rr
  };
})();
