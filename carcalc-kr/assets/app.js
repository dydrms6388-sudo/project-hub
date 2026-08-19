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


  // 결과 박스 렌더 (모든 계산기 공통) — 결과 표시 후에만 광고 노출
  function result(elId, o) {
    const el = typeof elId === "string" ? document.getElementById(elId) : elId;
    if (!el) return null;
    let h = "";
    if (o.big) h += '<p class="big">' + o.big + "</p>";
    if (o.sub) h += '<p class="sub">' + o.sub + "</p>";
    const rows = (o.rows || []).filter(Boolean);
    if (rows.length) {
      h += '<table class="kv"><tbody>';
      for (const r of rows) {
        h += "<tr" + (r[2] === "total" ? ' class="total"' : "") + "><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>";
      }
      h += "</tbody></table>";
    }
    if (o.foot) h += o.foot;
    el.innerHTML = h;
    el.hidden = false;
    showAd();
    return el;
  }

  // 산출 과정(산식) 블록
  function steps(lines) {
    return '<div class="steps"><p class="steps-t">산출 과정</p><ol>' +
      lines.map((l) => "<li>" + l + "</li>").join("") + "</ol></div>";
  }

  // 스크롤 가능한 표
  function tbl(headers, rows) {
    let h = '<div class="tblwrap"><table class="tbl"><thead><tr>';
    for (const t of headers) h += "<th>" + t + "</th>";
    h += "</tr></thead><tbody>";
    for (const r of rows) {
      h += "<tr>";
      for (let i = 0; i < r.length; i++) h += "<td" + (i > 0 ? ' class="num"' : "") + ">" + r[i] + "</td>";
      h += "</tr>";
    }
    return h + "</tbody></table></div>";
  }

  return { $, $$, fmt, won, esc, num, showAd, downloadCsv, lsGet, lsSet, copyText, result, steps, tbl };
})();
