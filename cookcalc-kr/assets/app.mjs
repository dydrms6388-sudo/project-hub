// cookcalc-kr 공통 브라우저 헬퍼
export const $ = (id) => document.getElementById(id);
export const num = (el, dflt = 0) => {
  const v = parseFloat(el && el.value);
  return isFinite(v) ? v : dflt;
};
export const fmt = (n, p = 0) => {
  const f = Math.pow(10, p);
  return (Math.round(n * f) / f).toLocaleString("ko-KR");
};
export const g = (n) => fmt(n, 1) + "g";
export const ml = (n) => fmt(n, 0) + "ml";

/** 결과 하단 광고: 첫 결과 표시 시 1회만 노출·push (입력 화면에는 노출 금지) */
export function showAd() {
  const w = document.getElementById("adWrap");
  if (!w || w.dataset.on) return;
  w.hidden = false;
  w.dataset.on = "1";
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
}

/** 테마 토글(로컬 저장) */
export function initTheme(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cc-theme", next); } catch (e) {}
  });
}

/** 세그먼트/칩 버튼 그룹: onChange(value) */
export function segInit(el, onChange) {
  if (!el) return () => null;
  const btns = [...el.querySelectorAll("button")];
  btns.forEach((b) => b.addEventListener("click", () => {
    btns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    onChange(b.dataset.v, b);
  }));
  return () => (btns.find((b) => b.getAttribute("aria-pressed") === "true") || {}).dataset.v;
}

/** 결과 영역 표시 + 광고 언하이드 */
export function show(boxId) {
  const b = document.getElementById(boxId);
  if (b) b.hidden = false;
  showAd();
}

/** key-value 줄 목록 HTML */
export const kv = (rows) => rows.map((r) => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");

/** 출처 박스 */
export function srcBox(title, items) {
  return `<div class="srcbox"><strong>${title}</strong><br />` +
    items.map((i) => i.url
      ? `· ${i.text} — <a href="${i.url}" target="_blank" rel="noopener">${i.url}</a> (확인일 ${i.checkedAt})`
      : `· ${i.text}${i.checkedAt ? ` (확인일 ${i.checkedAt})` : ""}`).join("<br />") + `</div>`;
}

/** WebAudio 알림음 (외부 파일 없음) */
let AC = null;
export function beep(times = 3) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    for (let i = 0; i < times; i++) {
      const t0 = AC.currentTime + i * 0.45;
      const osc = AC.createOscillator(), gn = AC.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t0);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gn); gn.connect(AC.destination);
      osc.start(t0); osc.stop(t0 + 0.4);
    }
  } catch (e) { /* 오디오 미지원 환경 무시 */ }
}
export const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
};
