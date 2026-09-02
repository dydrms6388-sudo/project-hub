/*!
 * talkstat — SVG 차트 직접 렌더 (라이브러리 없음)
 * 색: 검증된 범주 팔레트(고정 순서, 순환 금지) + 파랑 단일 색상 순차 램프.
 * 마크: 얇은 바(≤24px)·데이터 끝 4px 라운드·베이스라인 직각, 2px 라인, 헤어라인 그리드.
 */
(function () {
  'use strict';
  var TC = window.TalkCharts = {};

  // 범주 팔레트(고정 순서) — validate_palette.js 통과본. 9번째 이후는 '기타' 회색으로 폴드.
  var CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  var FOLD = '#94a3b8';
  // 파랑 순차 램프 (밝음→어두움)
  var SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
    '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
  var GRID = '#e2e8f0', AXIS = '#cbd5e1', INK = '#1a202c', SUB = '#64748b', SURFACE = '#ffffff';
  var ZERO = '#eef2f7';

  TC.CAT = CAT;
  TC.SEQ = SEQ;
  TC.colorFor = function (i) { return i < CAT.length ? CAT[i] : FOLD; };
  TC.seqColor = function (v, max) {
    if (!v || max <= 0) { return ZERO; }
    var idx = Math.min(SEQ.length - 1, Math.floor((v / max) * SEQ.length));
    return SEQ[idx];
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nf(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  // 가로 바: 데이터 끝(오른쪽)만 4px 라운드, 베이스라인은 직각
  function hBarPath(x, y, w, h) {
    var r = Math.min(4, w);
    return 'M' + x + ' ' + y + ' h' + (w - r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r +
      ' v' + (h - 2 * r) + ' a' + r + ' ' + r + ' 0 0 1 -' + r + ' ' + r + ' h-' + (w - r) + ' Z';
  }
  // 세로 바: 위쪽만 4px 라운드
  function vBarPath(x, y, w, h) {
    var r = Math.min(4, h, w / 2);
    return 'M' + x + ' ' + (y + h) + ' v-' + (h - r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' -' + r +
      ' h' + (w - 2 * r) + ' a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + ' v' + (h - r) + ' Z';
  }

  /**
   * 참여자 가로 바 차트. items: [{label, value, color, tip, sub}]
   * 이름·값은 텍스트 토큰 색(마크 색 아님) — 직접 라벨 항상 표시.
   */
  TC.hBars = function (items, opts) {
    opts = opts || {};
    var W = 640, rowH = 34, barH = 16, labelW = opts.labelW || 110, valW = 78;
    var H = items.length * rowH + 8;
    var max = 0;
    items.forEach(function (it) { if (it.value > max) { max = it.value; } });
    var plotW = W - labelW - valW - 8;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '가로 막대 차트') + '">';
    items.forEach(function (it, i) {
      var y = i * rowH + 8;
      var w = max ? Math.max(2, (it.value / max) * plotW) : 2;
      var tip = it.tip || (it.label + ' · ' + nf(it.value));
      s += '<text x="' + (labelW - 8) + '" y="' + (y + barH - 3) + '" text-anchor="end" font-size="12.5" fill="' + INK + '">' + esc(it.label) + '</text>';
      s += '<path d="' + hBarPath(labelW, y, w, barH) + '" fill="' + (it.color || CAT[0]) + '" data-tip="' + esc(tip) + '"></path>';
      s += '<text x="' + (labelW + w + 8) + '" y="' + (y + barH - 3) + '" font-size="12.5" fill="' + SUB + '">' + esc(it.valueLabel != null ? it.valueLabel : nf(it.value)) + '</text>';
    });
    s += '<line x1="' + labelW + '" y1="0" x2="' + labelW + '" y2="' + H + '" stroke="' + AXIS + '" stroke-width="1"/>';
    return s + '</svg>';
  };

  /** 24시간 히스토그램(단일 색상 = 순차 파랑 계열의 대표색) */
  TC.hourHist = function (hourly, opts) {
    opts = opts || {};
    var W = 640, H = 180, padL = 34, padB = 26, padT = 12;
    var plotW = W - padL - 8, plotH = H - padT - padB;
    var max = Math.max.apply(null, hourly.concat([1]));
    var slot = plotW / 24;
    var barW = Math.min(18, slot - 3);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="시간대별 메시지 수">';
    // 가로 그리드(헤어라인, 실선)
    for (var g = 1; g <= 3; g++) {
      var gy = padT + plotH - (plotH * g) / 3;
      var gv = Math.round((max * g) / 3);
      s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="' + GRID + '" stroke-width="1"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10.5" fill="' + SUB + '">' + nf(gv) + '</text>';
    }
    var peak = hourly.indexOf(max);
    for (var h = 0; h < 24; h++) {
      var v = hourly[h];
      var bh = max ? (v / max) * plotH : 0;
      var x = padL + h * slot + (slot - barW) / 2;
      var y = padT + plotH - bh;
      var col = h === peak ? SEQ[9] : SEQ[6];
      if (bh > 0) {
        s += '<path d="' + vBarPath(x, y, barW, bh) + '" fill="' + col + '" data-tip="' + h + '시 · ' + nf(v) + '건"></path>';
      }
      if (h % 3 === 0) {
        s += '<text x="' + (padL + h * slot + slot / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="' + SUB + '">' + h + '시</text>';
      }
    }
    if (max > 0) {
      var px = padL + peak * slot + slot / 2;
      var py = padT + plotH - plotH - 2;
      s += '<text x="' + px + '" y="' + Math.max(10, py + 8) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + INK + '">' + nf(max) + '</text>';
    }
    s += '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + W + '" y2="' + (padT + plotH) + '" stroke="' + AXIS + '" stroke-width="1"/>';
    return s + '</svg>';
  };

  /** 요일×시간 히트맵 (순차 파랑 램프 — 단일 색상, 진할수록 많음) */
  TC.heatmap = function (grid, opts) {
    opts = opts || {};
    var DOW = ['일', '월', '화', '수', '목', '금', '토'];
    var cell = 24, gap = 2, padL = 30, padT = 20;
    var W = padL + 24 * (cell + gap), H = padT + 7 * (cell + gap) + 6;
    var max = 0;
    grid.forEach(function (row) { row.forEach(function (v) { if (v > max) { max = v; } }); });
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="요일과 시간대별 메시지 히트맵">';
    for (var h = 0; h < 24; h += 3) {
      s += '<text x="' + (padL + h * (cell + gap) + cell / 2) + '" y="' + (padT - 7) + '" text-anchor="middle" font-size="10" fill="' + SUB + '">' + h + '</text>';
    }
    for (var d = 0; d < 7; d++) {
      s += '<text x="' + (padL - 8) + '" y="' + (padT + d * (cell + gap) + cell / 2 + 4) + '" text-anchor="end" font-size="10.5" fill="' + SUB + '">' + DOW[d] + '</text>';
      for (var hh = 0; hh < 24; hh++) {
        var v = grid[d][hh];
        s += '<rect x="' + (padL + hh * (cell + gap)) + '" y="' + (padT + d * (cell + gap)) +
          '" width="' + cell + '" height="' + cell + '" rx="4" fill="' + TC.seqColor(v, max) +
          '" data-tip="' + DOW[d] + '요일 ' + hh + '시 · ' + nf(v) + '건"></rect>';
      }
    }
    return s + '</svg>';
  };

  /**
   * 월별 추이 라인 차트. series: [{name, color, values:[...]}], labels: ['2026-01', ...]
   * 2px 라인, 끝점 마커 r4 + 표면색 2px 링, 끝 라벨은 범례가 대신(수렴 대비).
   */
  TC.lines = function (series, labels, opts) {
    opts = opts || {};
    var W = 640, H = 220, padL = 42, padR = 16, padT = 14, padB = 30;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var max = 1;
    series.forEach(function (sr) { sr.values.forEach(function (v) { if (v > max) { max = v; } }); });
    var n = labels.length;
    var X = function (i) { return n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW; };
    var Y = function (v) { return padT + plotH - (v / max) * plotH; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '월별 메시지 추이') + '">';
    for (var g = 1; g <= 3; g++) {
      var gy = padT + plotH - (plotH * g) / 3;
      s += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="' + GRID + '" stroke-width="1"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10.5" fill="' + SUB + '">' + nf(Math.round((max * g) / 3)) + '</text>';
    }
    s += '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '" stroke="' + AXIS + '" stroke-width="1"/>';
    var step = Math.max(1, Math.ceil(n / 8));
    for (var i = 0; i < n; i++) {
      if (i % step === 0 || i === n - 1) {
        s += '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10.5" fill="' + SUB + '">' + esc(labels[i].slice(2).replace('-', '.')) + '</text>';
      }
    }
    series.forEach(function (sr) {
      var pts = sr.values.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + sr.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      sr.values.forEach(function (v, i) {
        s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + sr.color + '" stroke="' + SURFACE + '" stroke-width="2" data-tip="' +
          esc(labels[i] + ' · ' + sr.name + ' ' + nf(v) + '건') + '"></circle>';
      });
    });
    return s + '</svg>';
  };

  /** 단어 빈도 가로 바 (단일 시리즈 = 단일 색) */
  TC.wordBars = function (words, opts) {
    opts = opts || {};
    var top = words.slice(0, opts.limit || 15);
    return TC.hBars(top.map(function (w) {
      return { label: w.key, value: w.count, color: SEQ[7], tip: '"' + w.key + '" · ' + nf(w.count) + '회' };
    }), { aria: '자주 쓴 단어', labelW: opts.labelW || 120 });
  };
}());
