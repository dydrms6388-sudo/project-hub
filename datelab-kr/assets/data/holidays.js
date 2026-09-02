/*
 * 대한민국 공휴일 정적 데이터 2025–2027 (대체공휴일 반영)
 * 근거·출처:
 *  - 「관공서의 공휴일에 관한 규정」(대통령령) — https://www.law.go.kr/법령/관공서의공휴일에관한규정
 *  - 인사혁신처 공휴일·대체공휴일 안내 — https://www.mpm.go.kr
 *  - 공공데이터포털 특일 정보(한국천문연구원) — https://www.data.go.kr/data/15012690/openapi.do
 * type: 'h'=법정공휴일, 's'=대체공휴일, 't'=임시공휴일·선거일
 */
(function (global) {
  'use strict';

  var HOLIDAYS = {
    2025: [
      { d: '2025-01-01', name: '신정(새해 첫날)', type: 'h' },
      { d: '2025-01-27', name: '임시공휴일(설 연휴)', type: 't' },
      { d: '2025-01-28', name: '설날 연휴', type: 'h' },
      { d: '2025-01-29', name: '설날', type: 'h' },
      { d: '2025-01-30', name: '설날 연휴', type: 'h' },
      { d: '2025-03-01', name: '삼일절', type: 'h' },
      { d: '2025-03-03', name: '대체공휴일(삼일절)', type: 's' },
      { d: '2025-05-05', name: '어린이날·부처님오신날', type: 'h' },
      { d: '2025-05-06', name: '대체공휴일(어린이날·부처님오신날)', type: 's' },
      { d: '2025-06-03', name: '제21대 대통령선거일(임시공휴일)', type: 't' },
      { d: '2025-06-06', name: '현충일', type: 'h' },
      { d: '2025-08-15', name: '광복절', type: 'h' },
      { d: '2025-10-03', name: '개천절', type: 'h' },
      { d: '2025-10-05', name: '추석 연휴', type: 'h' },
      { d: '2025-10-06', name: '추석', type: 'h' },
      { d: '2025-10-07', name: '추석 연휴', type: 'h' },
      { d: '2025-10-08', name: '대체공휴일(추석 연휴)', type: 's' },
      { d: '2025-10-09', name: '한글날', type: 'h' },
      { d: '2025-12-25', name: '기독탄신일(성탄절)', type: 'h' }
    ],
    2026: [
      { d: '2026-01-01', name: '신정(새해 첫날)', type: 'h' },
      { d: '2026-02-16', name: '설날 연휴', type: 'h' },
      { d: '2026-02-17', name: '설날', type: 'h' },
      { d: '2026-02-18', name: '설날 연휴', type: 'h' },
      { d: '2026-03-01', name: '삼일절', type: 'h' },
      { d: '2026-03-02', name: '대체공휴일(삼일절)', type: 's' },
      { d: '2026-05-05', name: '어린이날', type: 'h' },
      { d: '2026-05-24', name: '부처님오신날', type: 'h' },
      { d: '2026-05-25', name: '대체공휴일(부처님오신날)', type: 's' },
      { d: '2026-06-03', name: '제9회 전국동시지방선거일', type: 't' },
      { d: '2026-06-06', name: '현충일', type: 'h' },
      { d: '2026-08-15', name: '광복절', type: 'h' },
      { d: '2026-08-17', name: '대체공휴일(광복절)', type: 's' },
      { d: '2026-09-24', name: '추석 연휴', type: 'h' },
      { d: '2026-09-25', name: '추석', type: 'h' },
      { d: '2026-09-26', name: '추석 연휴', type: 'h' },
      { d: '2026-10-03', name: '개천절', type: 'h' },
      { d: '2026-10-05', name: '대체공휴일(개천절)', type: 's' },
      { d: '2026-10-09', name: '한글날', type: 'h' },
      { d: '2026-12-25', name: '기독탄신일(성탄절)', type: 'h' }
    ],
    2027: [
      { d: '2027-01-01', name: '신정(새해 첫날)', type: 'h' },
      { d: '2027-02-06', name: '설날 연휴', type: 'h' },
      { d: '2027-02-07', name: '설날', type: 'h' },
      { d: '2027-02-08', name: '설날 연휴', type: 'h' },
      { d: '2027-02-09', name: '대체공휴일(설날 연휴)', type: 's' },
      { d: '2027-03-01', name: '삼일절', type: 'h' },
      { d: '2027-05-05', name: '어린이날', type: 'h' },
      { d: '2027-05-13', name: '부처님오신날', type: 'h' },
      { d: '2027-06-06', name: '현충일', type: 'h' },
      { d: '2027-08-15', name: '광복절', type: 'h' },
      { d: '2027-08-16', name: '대체공휴일(광복절)', type: 's' },
      { d: '2027-09-14', name: '추석 연휴', type: 'h' },
      { d: '2027-09-15', name: '추석', type: 'h' },
      { d: '2027-09-16', name: '추석 연휴', type: 'h' },
      { d: '2027-10-03', name: '개천절', type: 'h' },
      { d: '2027-10-04', name: '대체공휴일(개천절)', type: 's' },
      { d: '2027-10-09', name: '한글날', type: 'h' },
      { d: '2027-10-11', name: '대체공휴일(한글날)', type: 's' },
      { d: '2027-12-25', name: '기독탄신일(성탄절)', type: 'h' },
      { d: '2027-12-27', name: '대체공휴일(기독탄신일)', type: 's' }
    ]
  };

  var TYPE_LABEL = { h: '법정공휴일', s: '대체공휴일', t: '임시공휴일·선거일' };

  // 'YYYY-MM-DD' → 공휴일 항목 또는 null
  function getHoliday(iso) {
    var y = +iso.slice(0, 4);
    var list = HOLIDAYS[y];
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].d === iso) return list[i];
    return null;
  }

  // Date 객체가 휴무일(주말 또는 공휴일)인지
  function isDayOff(date) {
    var wd = date.getDay();
    if (wd === 0 || wd === 6) return true;
    return !!getHoliday(toIso(date));
  }

  function toIso(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  var KHolidays = {
    data: HOLIDAYS,
    years: [2025, 2026, 2027],
    typeLabel: TYPE_LABEL,
    getHoliday: getHoliday,
    isDayOff: isDayOff,
    toIso: toIso
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = KHolidays;
  global.KHolidays = KHolidays;
})(typeof window !== 'undefined' ? window : globalThis);
