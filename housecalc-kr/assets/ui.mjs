// housecalc-kr 공통 UI 헬퍼 (모듈). 계산은 assets/calc.mjs, 값·출처는 data/*.mjs.
export const $ = (id) => document.getElementById(id);
export function raw(id) {
  const el = $(id); if (!el) return 0;
  const v = String(el.value).replace(/[^\d.\-]/g, "");
  return v ? Number(v) : 0;
}
export function man(id) { return raw(id) * 10000; }        // 만원 입력 → 원
export function txt(id) { const el = $(id); return el ? String(el.value) : ""; }
export function on(id) { const el = $(id); return !!(el && el.checked); }
export function won(n) { return isFinite(n) ? Math.round(n).toLocaleString("ko-KR") + "원" : "-"; }
export function manwon(n) { return isFinite(n) ? Math.round(n / 10000).toLocaleString("ko-KR") + "만원" : "-"; }
export function pctStr(n, d) { return isFinite(n) ? (Math.round(n * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toLocaleString("ko-KR") + "%" : "-"; }
export function eok(n) {
  if (!isFinite(n)) return "-";
  const w = Math.round(n), e = Math.floor(w / 100000000), m = Math.round((w - e * 100000000) / 10000);
  if (e > 0 && m > 0) return e + "억 " + m.toLocaleString("ko-KR") + "만원";
  if (e > 0) return e + "억원";
  return m.toLocaleString("ko-KR") + "만원";
}
// 산출 과정(산식) 블록: rows = [[라벨, 값], ...]
export function fbox(title, rows, foot) {
  let h = '<div class="formula">';
  if (title) h += '<div class="frow"><span><b>' + title + "</b></span><span class=\"fv\"></span></div>";
  for (const r of rows) h += '<div class="frow"><span>' + r[0] + '</span><span class="fv">' + r[1] + "</span></div>";
  h += "</div>";
  if (foot) h += '<p class="src">' + foot + "</p>";
  return h;
}
// 데이터 항목의 출처·확인일 한 줄
export function srcLine(label, d) {
  return '<p class="src">' + label + " 근거: <a href=\"" + d.source + '" target="_blank" rel="noopener">출처</a> · 확인일 ' + d.checkedAt +
    (d.todo ? ' <span class="badge warn">확인 필요</span>' : "") + "</p>";
}
export function setHtml(id, html) { const el = $(id); if (el) el.innerHTML = html; }
export function setText(id, s) { const el = $(id); if (el) el.textContent = s; }
// 결과 표시 + 광고 노출(입력 화면 광고 금지 규칙: 결과가 나온 뒤에만)
export function showResult(id) {
  const el = $(id || "result");
  if (el) el.hidden = false;
  if (typeof window.hcShowAd === "function") window.hcShowAd();
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
// 만원 입력 옆에 억/만원 환산 표시
export function echo(inputId, outId) {
  const el = $(inputId), out = $(outId);
  if (!el || !out) return;
  const paint = () => { const v = raw(inputId) * 10000; out.textContent = v > 0 ? "= " + eok(v) : ""; };
  el.addEventListener("input", paint); paint();
}
// 칩(프리셋) 버튼: data-v 값을 대상 입력에 채움
export function chips(wrapId, targetId, after) {
  const w = $(wrapId); if (!w) return;
  w.querySelectorAll("button[data-v]").forEach((b) => {
    b.addEventListener("click", () => {
      w.querySelectorAll("button[data-v]").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      const t = $(targetId); if (t) { t.value = b.getAttribute("data-v"); t.dispatchEvent(new Event("input")); }
      if (after) after(b.getAttribute("data-v"), b);
    });
  });
}
