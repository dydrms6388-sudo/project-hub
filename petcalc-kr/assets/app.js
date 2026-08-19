/* PetCalc 공통 스크립트 */
window.pcShowAd = function () {
  var w = document.querySelector('.ad-wrap[data-pending]');
  if (!w) return;
  w.removeAttribute('data-pending');
  w.hidden = false;
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
};
window.pcFmt = function (n, d) {
  if (typeof d !== 'number') d = 0;
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
};
window.pcDate = function (d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
window.pcAddDays = function (base, days) {
  var d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
};
window.pcDownload = function (filename, text, mime) {
  var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
};
