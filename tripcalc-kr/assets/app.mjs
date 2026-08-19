// tripcalc-kr 공통 브라우저 헬퍼 (의존성 0)
export const $ = (id) => document.getElementById(id);
export const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ko-KR");
export const won = (n) => fmt(n) + "원";
export const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 결과 하단 광고: 결과가 처음 표시될 때만 언하이드 + push (입력 화면에는 노출하지 않는다) */
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
    try { localStorage.setItem("tc-theme", next); } catch (e) {}
  });
}

/** 세그먼트/칩 버튼 그룹: 단일 선택 */
export function segInit(root, onChange) {
  const btns = [...root.querySelectorAll("button")];
  btns.forEach((b) => b.addEventListener("click", () => {
    btns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    onChange && onChange(b.dataset.v);
  }));
  return {
    get: () => btns.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.v,
    set: (v) => btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === v ? "true" : "false")),
  };
}

/** 칩 그룹: 다중 선택 */
export function multiInit(root) {
  const btns = [...root.querySelectorAll("button")];
  btns.forEach((b) => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
  }));
  return {
    get: () => btns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.v),
    set: (vals) => btns.forEach((b) => b.setAttribute("aria-pressed", vals.includes(b.dataset.v) ? "true" : "false")),
  };
}

/** 토스트 */
export function toast(msg) {
  const t = el("div", "toast", esc(msg));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

/** 클립보드 복사 */
export async function copyText(text, msg = "복사했습니다") {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(msg); } catch (e2) { toast("복사에 실패했습니다"); }
    ta.remove();
  }
}

/** 공유 버튼 묶음 배선: 링크 복사 / 텍스트 복사 / X / 공유 시트 */
export function wireShare({ linkBtn, textBtn, xBtn, shareBtn, getUrl, getText, title = "" }) {
  linkBtn && linkBtn.addEventListener("click", () => copyText(getUrl(), "링크를 복사했습니다"));
  textBtn && textBtn.addEventListener("click", () => copyText(getText() + "\n" + getUrl(), "커뮤니티용 텍스트를 복사했습니다"));
  xBtn && xBtn.addEventListener("click", () => {
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getText())}&url=${encodeURIComponent(getUrl())}`;
    window.open(u, "_blank", "noopener");
  });
  shareBtn && shareBtn.addEventListener("click", async () => {
    if (navigator.share) { try { await navigator.share({ title, text: getText(), url: getUrl() }); } catch (e) {} }
    else copyText(getUrl(), "링크를 복사했습니다");
  });
}

/** URL 상태 인코딩(base64, UTF-8 안전) */
export function enc(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, "");
}
export function dec(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch (e) { return null; }
}
/** ?r= 읽기 */
export function readR() {
  const m = new URLSearchParams(location.search).get("r");
  return m ? dec(m) : null;
}
/** 현재 URL 에 ?r= 를 반영한 공유 링크 */
export function shareUrl(state) {
  const u = new URL(location.href);
  u.search = "?r=" + enc(state);
  u.hash = "";
  return u.toString();
}
/** 공유 유입이면 "나도 해보기" CTA 노출 */
export function sharedCta(box, label = "나도 해보기") {
  if (!box) return;
  const url = location.pathname;
  box.innerHTML = `<a class="cta" href="${url}">✨ ${esc(label)}</a>`;
  box.hidden = false;
}

/** localStorage 기록 저장소(기록형 도구용) — 서버 저장 없음 */
export function store(key) {
  return {
    load(def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    save(v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } },
    clear() { try { localStorage.removeItem(key); } catch (e) {} },
  };
}

/** 텍스트 파일 내보내기(브라우저 내에서만 생성) */
export function download(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

/** 결과 카드 PNG 생성(canvas) — 도메인 워터마크 포함 */
export function drawCard({ title, lines, big, slug, w = 900, h = 560 }) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  c.fillStyle = "#0d1512"; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(16,185,129,.22)"); g.addColorStop(1, "rgba(16,185,129,0)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(52,211,153,.45)"; c.lineWidth = 2; c.strokeRect(18, 18, w - 36, h - 36);
  const F = '900 %spx -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  c.fillStyle = "#e6f7ef"; c.font = F.replace("%s", "34");
  c.fillText(title, 56, 96);
  if (big) { c.fillStyle = "#34d399"; c.font = F.replace("%s", "60"); c.fillText(big, 56, 190); }
  c.font = '500 24px -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  let y = big ? 250 : 170;
  for (const ln of lines.slice(0, 8)) {
    c.fillStyle = ln.startsWith("· ") ? "#c9d6d0" : "#e6f7ef";
    c.fillText(ln, 56, y); y += 42;
  }
  c.fillStyle = "rgba(200,220,210,.66)";
  c.font = '700 20px -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  c.fillText("tripcalc-kr.vercel.app/" + slug, 56, h - 44);
  return cv;
}

/** canvas → PNG 저장 */
export function saveCanvas(cv, filename) {
  cv.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }, "image/png");
}

/** select 채우기 */
export function fillSelect(sel, list, value = "") {
  sel.innerHTML = list.map((o) => `<option value="${esc(o.v)}"${o.v === value ? " selected" : ""}>${esc(o.n)}</option>`).join("");
}
