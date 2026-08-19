/* common.js — familyday-kr 공통 유틸 (의존성 0). 모든 페이지에서 일반 스크립트로 로드 */
(function () {
  var root = document.documentElement;
  try { var t = localStorage.getItem("fd-theme"); if (t) root.setAttribute("data-theme", t); } catch (e) {}

  function toast(msg) {
    var el = document.getElementById("fd-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "fd-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111;color:#fff;" +
        "border:1px solid #444;padding:10px 16px;border-radius:999px;font-size:13.5px;z-index:99;opacity:0;transition:opacity .18s";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = "0"; }, 1800);
  }

  function copy(text, okMsg) {
    var done = function () { toast(okMsg || "복사했습니다"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else fallback(text, done);
  }
  function fallback(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("복사에 실패했습니다. 직접 선택해 주세요."); }
    document.body.removeChild(ta);
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.FD = {
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    esc: esc,
    toast: toast,
    copy: copy,
    download: download,
    won: function (n) { return Number(n).toLocaleString("ko-KR") + "원"; },
    num: function (n) { return Number(n).toLocaleString("ko-KR"); },
    /** localStorage 안전 래퍼 */
    load: function (k, dflt) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
    },
    save: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("브라우저 저장 공간을 쓸 수 없습니다."); return false; }
    },
    wipe: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
    exportJson: function (k, name) {
      var data = localStorage.getItem(k) || "{}";
      download(new Blob([data], { type: "application/json" }), name);
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("themebtn");
    if (b) b.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme");
      var isDark = cur ? cur === "dark" : !window.matchMedia("(prefers-color-scheme: light)").matches;
      var next = isDark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("fd-theme", next); } catch (e) {}
    });
    FD.$$("[data-copy]").forEach(function (el) {
      el.addEventListener("click", function () {
        var sel = el.getAttribute("data-copy");
        var src = sel.charAt(0) === "#" ? document.querySelector(sel) : null;
        copy(src ? (src.value !== undefined && src.value !== null && src.tagName !== "DIV" ? src.value : src.textContent) : sel);
      });
    });
  });
})();
