// FitCalc 공통 헬퍼 (의존성 0, 브라우저 ES 모듈)
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

/** 결과가 표시된 뒤에만 결과 하단 광고 1개를 노출한다(입력 화면 광고 금지 정책). */
export function showAd() {
  const box = document.getElementById("adBox");
  if (!box || box.dataset.on) return;
  box.hidden = false;
  box.dataset.on = "1";
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* 광고 차단 등 */ }
}

export function fmt(n, digits = 1) {
  if (!isFinite(n)) return "-";
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  del(key) { try { localStorage.removeItem(key); } catch (e) {} },
};

/** 텍스트 파일 다운로드 (CSV 등) */
export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob(["\uFEFF" + text], { type: mime + ";charset=utf-8" }); // BOM: 엑셀 한글 호환
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** 오늘 날짜 YYYY-MM-DD (로컬 기준) */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 간단 HTML 이스케이프 */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
