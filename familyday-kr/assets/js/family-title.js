/* family-title.js — 가족 호칭 사전 목록 필터 (일반 스크립트, 의존성 0) */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var q = document.getElementById("q");
    var cnt = document.getElementById("cnt");
    if (!q) return;
    var items = FD.$$(".ft-item");
    var total = items.length;

    function apply() {
      var v = q.value.trim().toLowerCase().replace(/\s+/g, "");
      var shown = 0;
      items.forEach(function (el) {
        var hay = ((el.dataset.k || "") + el.textContent).toLowerCase().replace(/\s+/g, "");
        var ok = !v || hay.indexOf(v) !== -1;
        el.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
      FD.$$(".panel").forEach(function (sec) {
        var chips = FD.$$(".ft-item", sec);
        if (!chips.length) return;
        var any = chips.some(function (c) { return c.style.display !== "none"; });
        sec.style.display = any ? "" : "none";
      });
      cnt.textContent = v ? shown + "개 조합이 검색되었습니다" : total + "개 조합";
    }
    q.addEventListener("input", apply);
    apply();
  });
})();
