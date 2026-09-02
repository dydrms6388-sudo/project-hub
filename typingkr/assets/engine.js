/* typingkr 타자 엔진
 * - IME 조합(compositionstart/update/end) + input 이벤트를 함께 처리.
 *   조합 중인 마지막 글자는 채점 보류(.compose 표시), 확정된 글자만 채점.
 * - 타수(타/분) = 올바르게 입력한 "자모 수" 기준 (hangul.js 분해 기준).
 * - 정확도 = 확정 글자 기준, 한 번이라도 틀렸던 위치는 고쳐도 오타로 집계.
 * - jamoMode: 자리 연습용. 목표·입력을 자모 열로 분해해 비교(조합 영향 없음).
 */
(function () {
  'use strict';
  var H = window.TKHangul;
  var TK = window.TK = window.TK || {};

  function Engine(opts) {
    this.targetEl = opts.targetEl;
    this.input = opts.inputEl;
    this.jamoMode = !!opts.jamoMode;
    this.onProgress = opts.onProgress || function () {};
    this.onLineDone = opts.onLineDone || function () {};
    this.onKeyHint = opts.onKeyHint || null;
    this.onError = opts.onError || function () {};
    this.onType = opts.onType || function () {};

    this.text = '';
    this.units = [];      // 채점 단위 배열 (char 또는 jamo)
    this.spans = [];
    this.composing = false;
    this.errorEver = {};  // index -> true
    this.prevLen = 0;
    this.prevErrCount = 0;
    this.done = false;

    // 세션 누적
    this.sStrokes = 0; this.sUnits = 0; this.sErrors = 0; this.sChars = 0;
    this.startTime = 0;

    var self = this;
    this.input.addEventListener('compositionstart', function () { self.composing = true; });
    this.input.addEventListener('compositionupdate', function () { self.composing = true; self.grade(); });
    this.input.addEventListener('compositionend', function () { self.composing = false; self.grade(); });
    this.input.addEventListener('input', function () { self.grade(); });
    this.input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { self.clearInput(); self.grade(); }
    });
  }

  Engine.prototype.setText = function (text) {
    this.text = text;
    this.units = this.jamoMode ? H.decomposeAll(text) : text.split('');
    this.errorEver = {};
    this.done = false;
    this.prevLen = 0;
    this.prevErrCount = 0;
    this.render();
    this.clearInput();
    this.updateHint(0, []);
    this.onProgress(this.stats(0, 0, 0));
  };

  Engine.prototype.render = function () {
    var el = this.targetEl;
    el.textContent = '';
    this.spans = [];
    for (var i = 0; i < this.units.length; i++) {
      var s = document.createElement('span');
      var u = this.units[i];
      if (u === '\n') { s.innerHTML = '<span class="nl">⏎</span>\n'; }
      else { s.textContent = u; }
      el.appendChild(s);
      this.spans.push(s);
    }
    if (this.spans.length) this.spans[0].classList.add('cur');
  };

  Engine.prototype.clearInput = function () {
    // 조합 중 value 초기화는 IME 상태가 꼬일 수 있어 blur→clear→focus 로 처리
    // resetting 플래그: blur 가 동기적으로 유발하는 compositionend/input 이벤트가
    // 새 문장을 잘못 채점하지 않게 막는다
    var inp = this.input, self = this;
    self.resetting = true;
    self.composing = false;
    if (document.activeElement === inp) {
      inp.blur();
      inp.value = '';
      requestAnimationFrame(function () { inp.value = ''; inp.focus(); self.resetting = false; });
    } else {
      inp.value = '';
      self.resetting = false;
    }
  };

  // 입력값 → [확정 단위 배열, 조합 중 단위 배열]
  Engine.prototype.splitTyped = function () {
    var v = this.input.value;
    if (this.jamoMode) {
      var all = H.decomposeAll(v);
      var prov = (this.composing && v.length) ? H.decompose(v[v.length - 1]).length : 0;
      return [all.slice(0, all.length - prov), all.slice(all.length - prov)];
    }
    if (this.composing && v.length) return [v.slice(0, -1).split(''), [v[v.length - 1]]];
    return [v.split(''), []];
  };

  Engine.prototype.grade = function () {
    if (this.done || this.resetting) return;
    if (!this.startTime && this.input.value.length) this.startTime = Date.now();

    var sp = this.splitTyped();
    var conf = sp[0], prov = sp[1];
    var T = this.units, n = T.length;
    var i, ok, correct = 0, strokes = 0;

    // 전체 일치 시 조합 중이어도 완료 인정 (문장 끝 글자가 조합 상태로 남는 문제 해결)
    var full = conf.concat(prov);
    var exact = full.length === n && full.join('') === T.join('');
    if (exact) { conf = full; prov = []; }

    var m = Math.min(conf.length, n);
    for (i = 0; i < m; i++) {
      ok = conf[i] === T[i];
      if (!ok) this.errorEver[i] = true;
      var cl = this.spans[i].classList;
      cl.remove('cur', 'compose');
      cl.toggle('ok', ok);
      cl.toggle('bad', !ok);
      if (ok) { correct++; strokes += this.jamoMode ? 1 : H.strokes(T[i]); }
    }
    // 목표보다 길게 친 확정 입력 = 오타
    for (i = n; i < conf.length; i++) this.errorEver['x' + i] = true;
    // 남은 구간 초기화
    for (i = m; i < n; i++) this.spans[i].className = '';
    // 조합 중 표시
    var pos = conf.length;
    if (prov.length && pos < n) {
      // 조합 글자가 차지하는 단위(자모 모드면 여러 칸)
      var span = this.jamoMode ? prov.length : 1;
      for (i = pos; i < Math.min(pos + span, n); i++) this.spans[i].classList.add('compose');
    } else if (pos < n) {
      this.spans[pos].classList.add('cur');
    }

    // 사운드/콜백
    var errCount = Object.keys(this.errorEver).length;
    var lenNow = conf.length + prov.length;
    if (lenNow > this.prevLen) {
      if (errCount > this.prevErrCount) this.onError(); else this.onType();
    }
    this.prevLen = lenNow; this.prevErrCount = errCount;

    this.updateHint(pos, prov);
    this.onProgress(this.stats(strokes, m, errCount));

    // 완료 판정
    if (exact || conf.length >= n) {
      this.done = true;
      for (i = 0; i < n; i++) this.spans[i].classList.remove('cur', 'compose');
      var lineErr = errCount;
      this.sStrokes += strokes;
      this.sUnits += n;
      this.sErrors += lineErr;
      this.sChars += this.jamoMode ? n : this.text.length;
      var self = this;
      // 다음 문장 전환은 살짝 뒤에 (마지막 글자 확인 시간)
      setTimeout(function () { self.onLineDone(self.lineStats(strokes, n, lineErr)); }, 120);
    }
  };

  Engine.prototype.updateHint = function (pos, prov) {
    if (!this.onKeyHint) return;
    var T = this.units;
    if (pos >= T.length) { this.onKeyHint(null); return; }
    if (this.jamoMode) { this.onKeyHint(T[pos]); return; }
    var tj = H.decompose(T[pos]);
    var cj = (prov && prov.length) ? H.decompose(prov[0]) : [];
    // 조합 중인 자모가 목표의 접두면 다음 자모, 아니면 처음부터
    var k = 0;
    while (k < cj.length && k < tj.length && cj[k] === tj[k]) k++;
    this.onKeyHint(k < tj.length ? tj[k] : tj[0]);
  };

  Engine.prototype.stats = function (curStrokes, curUnits, curErr) {
    var strokes = this.sStrokes + (curStrokes || 0);
    var units = this.sUnits + (curUnits || 0);
    var errs = this.sErrors + (curErr || 0);
    var min = this.startTime ? (Date.now() - this.startTime) / 60000 : 0;
    return {
      cpm: min > 0.005 ? Math.round(strokes / min) : 0,
      acc: units > 0 ? Math.max(0, Math.round((units - errs) / units * 1000) / 10) : 100,
      strokes: strokes, units: units, errors: errs,
      elapsed: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  };

  Engine.prototype.lineStats = function (strokes, units, errs) {
    return { strokes: strokes, units: units, errors: errs };
  };

  Engine.prototype.resetSession = function () {
    this.sStrokes = 0; this.sUnits = 0; this.sErrors = 0; this.sChars = 0;
    this.startTime = 0;
  };

  TK.Engine = Engine;
})();
