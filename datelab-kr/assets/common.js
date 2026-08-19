/* DateLab 공용 유틸 — 헤더/푸터 주입 없음, 순수 함수만 */
(function (global) {
  'use strict';

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Date → 'YYYY-MM-DD'
  function toIso(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // 'YYYY-MM-DD' → Date(로컬 자정)
  function fromIso(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  // Date → '2026년 8월 19일 (수)'
  function fmtKo(d, withDow) {
    var s = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    if (withDow !== false) s += ' (' + WEEKDAYS[d.getDay()] + ')';
    return s;
  }

  function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }

  // 두 날짜(자정 기준) 차이 일수: b - a
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }

  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }

  function addMonths(d, n) {
    var r = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
  }

  // 만 나이 & 상세 (기준일 asOf 에서 birth 까지)
  function fullAge(birth, asOf) {
    var years = asOf.getFullYear() - birth.getFullYear();
    var m = asOf.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) years--;
    var annivThis = addMonths(birth, years * 12);
    var months = 0, probe = annivThis;
    while (true) {
      var nxt = addMonths(birth, years * 12 + months + 1);
      if (nxt <= asOf) { months++; probe = nxt; } else break;
    }
    var days = diffDays(addMonths(birth, years * 12 + months), asOf);
    return { years: years, months: months, days: days };
  }

  function numComma(n) { return n.toLocaleString('ko-KR'); }

  // 클립보드 복사(폴백 포함) 후 콜백
  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done && done(true); },
        function () { legacyCopy(text); done && done(true); });
    } else { legacyCopy(text); done && done(true); }
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  // ---- ICS(캘린더 파일) 직접 조립 ----
  function icsEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }
  // events: [{date:'YYYY-MM-DD', title, desc?}] — 종일 일정
  function buildIcs(events, calName) {
    var now = new Date();
    var stamp = now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) +
      'T' + pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + 'Z';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DateLab//KO', 'CALSCALE:GREGORIAN'];
    if (calName) lines.push('X-WR-CALNAME:' + icsEscape(calName));
    events.forEach(function (ev, i) {
      var d = ev.date.replace(/-/g, '');
      var next = toIso(addDays(fromIso(ev.date), 1)).replace(/-/g, '');
      lines.push('BEGIN:VEVENT',
        'UID:' + stamp + '-' + i + '@datelab',
        'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + d,
        'DTEND;VALUE=DATE:' + next,
        'SUMMARY:' + icsEscape(ev.title));
      if (ev.desc) lines.push('DESCRIPTION:' + icsEscape(ev.desc));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function downloadIcs(events, calName, filename) {
    var blob = new Blob([buildIcs(events, calName)], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'datelab.ics';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }

  // localStorage JSON 헬퍼
  function lsGet(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* noop */ }
  }

  global.DL = {
    WEEKDAYS: WEEKDAYS,
    $: $, $$: $$, pad2: pad2,
    toIso: toIso, fromIso: fromIso, fmtKo: fmtKo, today: today,
    diffDays: diffDays, addDays: addDays, addMonths: addMonths,
    fullAge: fullAge, numComma: numComma,
    copyText: copyText, buildIcs: buildIcs, downloadIcs: downloadIcs,
    lsGet: lsGet, lsSet: lsSet
  };
})(typeof window !== 'undefined' ? window : globalThis);
