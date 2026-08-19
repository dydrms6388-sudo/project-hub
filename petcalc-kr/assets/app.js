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
window.pcQ = function (id) { return document.getElementById(id); };
window.pcSeg = function (id, cb) {
  var w = document.getElementById(id);
  if (!w) return;
  w.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !w.contains(b)) return;
    var all = w.querySelectorAll('button');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
    cb(b.getAttribute('data-v'));
  });
};
window.pcNum = function (id) {
  var el = document.getElementById(id);
  if (!el) return NaN;
  var v = parseFloat(String(el.value).replace(/,/g, ''));
  return isFinite(v) ? v : NaN;
};
window.pcShow = function (id) {
  var el = document.getElementById(id);
  if (el) { el.hidden = false; }
  if (window.pcShowAd) window.pcShowAd();
};
window.pcIcs = function (name, events) {
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//petcalc-kr//KO', 'CALSCALE:GREGORIAN'];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var ymd = e.date.replace(/-/g, '');
    var end = new Date(e.date + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    L.push('BEGIN:VEVENT');
    L.push('UID:' + ymd + '-' + i + '@petcalc-kr');
    L.push('DTSTAMP:' + ymd + 'T090000Z');
    L.push('DTSTART;VALUE=DATE:' + ymd);
    L.push('DTEND;VALUE=DATE:' + window.pcDate(end).replace(/-/g, ''));
    L.push('SUMMARY:' + String(e.title).replace(/[,;]/g, ' '));
    if (e.desc) L.push('DESCRIPTION:' + String(e.desc).replace(/[,;]/g, ' '));
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  window.pcDownload(name, L.join('\r\n'), 'text/calendar');
};
