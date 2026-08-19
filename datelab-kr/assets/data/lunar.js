/*
 * 한국 음력(KARI 한국천문연구원 역법 기준) ↔ 양력 변환 모듈 (1940–2050)
 * 데이터: usingsky/korean_lunar_calendar (MIT License) 의 KARI 기반 연도별
 * 비트 테이블에서 1940~2050 구간을 추출해 내장.
 * 각 32비트 항목: bit30=양력 윤년, bit17~25=그 해 음력 총일수,
 * bit16=윤달 크기(1=30일), bit12~15=윤달 번호(0=없음), bit(12-m)=m월 크기(1=30일)
 * 기준일(anchor): 음력 1940-01-01 = 양력 1940-02-08
 */
(function (global) {
  'use strict';

  var BASE_YEAR = 1940;
  var MAX_YEAR = 2050;

  var DATA = [
0xc2c40d4a,0x83016d8a,0x82c60b69,0x82c6056d,0xc301425b,0x82c4025d,0x82c4092d,0x83002d2b,
0xc2c40a95,0x83007d55,0x82c40b4a,0x82c60b55,0xc3015555,0x82c604db,0x82c4025b,0x83013857,
0xc2c4052b,0x83008a9b,0x82c40695,0x82c406aa,0xc3006aea,0x82c60ab5,0x82c404b6,0x83004aae,
0xc2c60a57,0x82c40527,0x82fe3726,0x82c60d95,0xc30076b5,0x82c4056a,0x82c609ad,0x830054dd,
0xc2c404ae,0x82c40a4e,0x83004d4d,0x82c40d25,0xc3008d59,0x82c40b54,0x82c60d6a,0x8301695a,
0xc2c6095b,0x82c4049b,0x83004a9b,0x82c40a4b,0xc300ab27,0x82c406a5,0x82c406d4,0x83026b75,
0xc2c402b6,0x82c6095b,0x830054b7,0x82c40497,0xc2c4064b,0x82fe374a,0x82c60ea5,0x830086d9,
0xc2c605ad,0x82c402b6,0x8300596e,0x82c4092e,0xc2c40c96,0x83004e95,0x82c40d4a,0x82c60da5,
0xc3002755,0x82c4056c,0x83027abb,0x82c4025d,0xc2c4092d,0x83005cab,0x82c40a95,0x82c40b4a,
0xc3013b4a,0x82c60b55,0x8300955d,0x82c404ba,0xc2c60a5b,0x83005557,0x82c4052b,0x82c40a95,
0xc3004b95,0x82c406aa,0x82c60ad5,0x830026b5,0xc2c404b6,0x83006a6e,0x82c60a57,0x82c40527,
0xc2fe56a6,0x82c60d93,0x82c405aa,0x83003b6a,0xc2c6096d,0x8300b4af,0x82c404ae,0x82c40a4d,
0xc3016d0d,0x82c40d25,0x82c40d52,0x83005dd4,0xc2c60b6a,0x82c6096d,0x8300255b,0x82c4049b,
0xc3007a57,0x82c40a4b,0x82c40b25,0x83015b25,0xc2c406d4,0x82c60ada,0x830138b6
  ];

  function info(year) { return DATA[year - BASE_YEAR]; }

  // 그 해 윤달 번호 (0 = 윤달 없음)
  function leapMonth(year) { return (info(year) >> 12) & 0xF; }

  // 음력 (year, month) 의 일수. isLeap=true 면 그 해 윤 month월의 일수
  function lunarMonthDays(year, month, isLeap) {
    var d = info(year);
    if (isLeap) {
      if (leapMonth(year) !== month) return 0;
      return ((d >> 16) & 0x1) ? 30 : 29;
    }
    return ((d >> (12 - month)) & 0x1) ? 30 : 29;
  }

  // 그 해 음력 총 일수 (353~385)
  function lunarYearDays(year) { return (info(year) >> 17) & 0x1FF; }

  // ---- 양력(그레고리력) 일수 계산: Julian Day Number ----
  function solarToJdn(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
      Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  function jdnToSolar(jdn) {
    var a = jdn + 32044;
    var b = Math.floor((4 * a + 3) / 146097);
    var c = a - Math.floor(146097 * b / 4);
    var d = Math.floor((4 * c + 3) / 1461);
    var e = c - Math.floor(1461 * d / 4);
    var m = Math.floor((5 * e + 2) / 153);
    return {
      y: 100 * b + d - 4800 + Math.floor(m / 10),
      m: m + 3 - 12 * Math.floor(m / 10),
      d: e - Math.floor((153 * m + 2) / 5) + 1
    };
  }

  var ANCHOR_JDN = solarToJdn(1940, 2, 8); // = 음력 1940-01-01

  // 음력 연초부터 (month, isLeap) 1일 직전까지의 일수
  function daysBeforeLunarMonth(year, month, isLeap) {
    var sum = 0, lm = leapMonth(year), m;
    for (m = 1; m < month; m++) {
      sum += lunarMonthDays(year, m, false);
      if (lm === m) sum += lunarMonthDays(year, m, true);
    }
    if (isLeap && lm === month) sum += lunarMonthDays(year, month, false);
    return sum;
  }

  /**
   * 음력 → 양력. 반환 {y, m, d} 또는 null(범위 밖/잘못된 날짜)
   */
  function lunarToSolar(ly, lm, ld, isLeap) {
    isLeap = !!isLeap;
    if (ly < BASE_YEAR || ly > MAX_YEAR || lm < 1 || lm > 12 || ld < 1) return null;
    if (isLeap && leapMonth(ly) !== lm) return null;
    if (ld > lunarMonthDays(ly, lm, isLeap)) return null;
    var offset = 0, y;
    for (y = BASE_YEAR; y < ly; y++) offset += lunarYearDays(y);
    offset += daysBeforeLunarMonth(ly, lm, isLeap) + (ld - 1);
    var res = jdnToSolar(ANCHOR_JDN + offset);
    if (res.y > MAX_YEAR) return null;
    return res;
  }

  /**
   * 양력 → 음력. 반환 {year, month, day, leap:boolean} 또는 null
   * 유효 범위: 1940-02-08 ~ 2050-12-31
   */
  function solarToLunar(y, m, d) {
    var jdn = solarToJdn(y, m, d);
    var offset = jdn - ANCHOR_JDN;
    if (offset < 0) return null;
    var ly = BASE_YEAR, yd;
    while (ly <= MAX_YEAR && offset >= (yd = lunarYearDays(ly))) {
      offset -= yd; ly++;
    }
    if (ly > MAX_YEAR) return null;
    var lm = leapMonth(ly), month, leap = false, md;
    for (month = 1; month <= 12; month++) {
      md = lunarMonthDays(ly, month, false);
      if (offset < md) { leap = false; break; }
      offset -= md;
      if (lm === month) {
        md = lunarMonthDays(ly, month, true);
        if (offset < md) { leap = true; break; }
        offset -= md;
      }
    }
    return { year: ly, month: month, day: offset + 1, leap: leap };
  }

  // ---- 간지(육십갑자)·띠 ----
  var GAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var JI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  var GAN_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var JI_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 연도(음력 기준 연도)의 간지. 예: 2025 → 을사
  function yearGanji(year) {
    var g = ((year - 4) % 10 + 10) % 10;
    var j = ((year - 4) % 12 + 12) % 12;
    return {
      gan: GAN[g], ji: JI[j],
      hanja: GAN_HANJA[g] + JI_HANJA[j],
      name: GAN[g] + JI[j],
      zodiac: ZODIAC[j], zodiacIndex: j
    };
  }

  var KLunar = {
    BASE_YEAR: BASE_YEAR,
    MAX_YEAR: MAX_YEAR,
    leapMonth: leapMonth,
    lunarMonthDays: lunarMonthDays,
    lunarYearDays: lunarYearDays,
    lunarToSolar: lunarToSolar,
    solarToLunar: solarToLunar,
    solarToJdn: solarToJdn,
    jdnToSolar: jdnToSolar,
    yearGanji: yearGanji,
    ZODIAC: ZODIAC
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = KLunar;
  global.KLunar = KLunar;
})(typeof window !== 'undefined' ? window : globalThis);
