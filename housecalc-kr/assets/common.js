/* housecalc-kr 공통 스크립트 (비모듈): 테마 토글, 숫자 입력 콤마, 광고 노출 제어 */
(function () {
  // 테마 토글 버튼
  var btn = document.createElement("button");
  btn.className = "themebtn";
  btn.type = "button";
  btn.setAttribute("aria-label", "다크/라이트 테마 전환");
  function cur() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function paint() { btn.textContent = cur() === "dark" ? "라이트" : "다크"; }
  btn.addEventListener("click", function () {
    var next = cur() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tec-theme", next); } catch (e) {}
    paint();
  });
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(btn); paint();
  });
})();

/* 금액 입력: 콤마 자동 표기. <input data-comma> 대상 */
function hcAttachComma(root) {
  (root || document).querySelectorAll("input[data-comma]").forEach(function (el) {
    el.setAttribute("inputmode", "numeric");
    el.addEventListener("input", function () {
      var raw = el.value.replace(/[^\d]/g, "");
      el.value = raw ? Number(raw).toLocaleString("ko-KR") : "";
    });
  });
}
function hcNum(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  var v = String(el.value).replace(/[^\d.]/g, "");
  return v ? Number(v) : 0;
}
document.addEventListener("DOMContentLoaded", function () { hcAttachComma(); });

/* 광고: 결과가 처음 표시될 때만 결과 하단 광고 1개 노출 (입력 화면 광고 금지) */
var hcAdShown = false;
function hcShowAd() {
  if (hcAdShown) return;
  var box = document.getElementById("adbox");
  if (!box) return;
  hcAdShown = true;
  box.hidden = false;
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
}
