/* homecalc-kr 공용 스크립트 (비모듈) — 테마 토글, 광고 지연 로드, 포맷터 */
(function () {
  var btn = document.querySelector(".theme-btn");
  function cur() { return document.documentElement.getAttribute("data-theme") || ""; }
  if (btn) {
    btn.addEventListener("click", function () {
      var next = cur() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("tec-theme", next); } catch (e) {}
    });
  }
})();

/* 결과가 처음 표시될 때 한 번만 광고를 push (입력 화면에는 광고 없음) */
window.hcShowResultAd = function () {
  var slot = document.getElementById("adSlot");
  if (!slot) return;
  if (slot.hidden) slot.hidden = false;
  if (!slot.dataset.pushed) {
    slot.dataset.pushed = "1";
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }
};

window.hcFmt = function (n, digits) {
  if (digits === undefined) digits = 0;
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
};

window.hcToast = function (msg) {
  var t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(window.__hcToastT);
  window.__hcToastT = setTimeout(function () { t.classList.remove("on"); }, 1800);
};
