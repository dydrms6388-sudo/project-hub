/* holiday-year.js — 연도별 명절 상세 페이지의 D-day 표시 (일반 스크립트) */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var h = window.__HOLIDAY;
    var box = document.getElementById("cnt");
    if (!h || !box) return;
    var p = h.date.split("-").map(Number);
    var n = new Date();
    var diff = Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
    var txt;
    if (diff > 0) txt = h.name + "까지 <b>" + diff + "일</b> 남았습니다 (D-" + diff + ")";
    else if (diff === 0) txt = "오늘이 " + h.name + "입니다.";
    else txt = h.name + "이(가) " + (-diff) + "일 지났습니다.";
    box.innerHTML = txt;
  });
})();
