/* thumbmaker-kr common utilities (no header/footer injection — pages are static) */
(function () {
  'use strict';
  // footer year
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
