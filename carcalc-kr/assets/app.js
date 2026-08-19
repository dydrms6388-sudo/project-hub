/* carcalc-kr 공통 헬퍼 (전역, 의존성 0) */
window.CC = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
  const won = (n) => fmt(n) + "원";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (el) => {
    const v = parseFloat(String((typeof el === "string" ? $(el) : el).value).replace(/[, ]/g, ""));
    return isFinite(v) ? v : 0;
  };

  // 결과가 표시된 뒤에만 광고 노출 (입력 화면 광고 금지 정책)
  let adShown = false;
  function showAd() {
    if (adShown) return;
    const box = document.getElementById("adBox");
    if (!box) return;
    box.hidden = false;
    adShown = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* noop */ }
  }

  // CSV 내보내기 (BOM 포함 — 엑셀 한글 호환)
  function downloadCsv(filename, rows) {
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c == null ? "" : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // localStorage JSON 헬퍼
  function lsGet(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  async function copyText(btn, text) {
    try {
      await navigator.clipboard.writeText(text);
      if (btn) { const t = btn.textContent; btn.textContent = "복사됨 ✓"; setTimeout(() => (btn.textContent = t), 1500); }
    } catch (e) {
      window.prompt("복사해서 사용하세요:", text);
    }
  }

  return { $, $$, fmt, won, esc, num, showAd, downloadCsv, lsGet, lsSet, copyText };
})();
