/*! talkstat — 공용 유틸 (헤더/푸터는 각 페이지에 정적 포함, 여기는 순수 유틸만) */
(function () {
  'use strict';
  var TS = window.TalkStat = window.TalkStat || {};

  TS.fmtInt = function (n) { return Number(n || 0).toLocaleString('ko-KR'); };

  TS.fmtDate = function (t) {
    if (t == null) { return '—'; }
    var d = new Date(t);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  };

  TS.fmtDateTime = function (t) {
    if (t == null) { return '—'; }
    var d = new Date(t);
    var h = d.getHours(), mi = d.getMinutes();
    return TS.fmtDate(t) + ' ' + (h < 10 ? '0' + h : h) + ':' + (mi < 10 ? '0' + mi : mi);
  };

  TS.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // 파일 읽기(메모리 내 텍스트만, 어디에도 업로드하지 않음)
  TS.readFileAsText = function (file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error('파일을 읽지 못했습니다.')); };
      fr.readAsText(file, 'utf-8');
    });
  };

  // 분석 실행: Web Worker 우선, 실패 시(file:// 등) 메인 스레드 폴백
  TS.runAnalysis = function (text, format, opts) {
    return new Promise(function (resolve, reject) {
      var fallback = function () {
        try {
          if (!window.TalkParsers || !window.TalkAnalyzer) {
            reject(new Error('분석 모듈을 불러오지 못했습니다.')); return;
          }
          var parsed = window.TalkParsers.parse(text, format || undefined);
          if (!parsed.messages.length) {
            reject(new Error('메시지를 찾지 못했습니다. 카카오톡 "대화 내보내기" 파일(txt/csv)이 맞는지 확인해 주세요.')); return;
          }
          resolve({
            ok: true, format: parsed.format, participants: parsed.participants,
            result: window.TalkAnalyzer.analyze(parsed, opts || {})
          });
        } catch (e) { reject(e); }
      };
      var worker;
      try { worker = new Worker(TS.workerPath || '../../assets/worker.js'); }
      catch (e) { fallback(); return; }
      var timer = setTimeout(function () { try { worker.terminate(); } catch (e) {} fallback(); }, 30000);
      worker.onerror = function () { clearTimeout(timer); try { worker.terminate(); } catch (e) {} fallback(); };
      worker.onmessage = function (ev) {
        clearTimeout(timer);
        try { worker.terminate(); } catch (e) {}
        var d = ev.data;
        if (d && d.ok) { resolve(d); }
        else { reject(new Error((d && d.error) || '분석에 실패했습니다.')); }
      };
      worker.postMessage({ text: text, format: format || null, opts: opts || {} });
    });
  };

  // 업로드 UI(드래그앤드롭 + 파일 선택 + 붙여넣기) 배선
  TS.wireUpload = function (cfg) {
    var zone = document.getElementById(cfg.zoneId);
    var input = document.getElementById(cfg.inputId);
    var onText = cfg.onText;
    if (!zone || !input) { return; }
    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) { handleFile(input.files[0]); input.value = ''; }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { handleFile(f); }
    });
    function handleFile(f) {
      var hint = /\.csv$/i.test(f.name) ? 'pc-csv' : null;
      TS.readFileAsText(f).then(function (text) { onText(text, hint, f.name); })
        .catch(function (err) { if (cfg.onError) { cfg.onError(err); } });
    }
  };

  // localStorage 저장(옵션) — 요약 결과만, 원문 대화는 절대 저장하지 않음
  TS.saveResult = function (key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), payload: payload }));
      return true;
    } catch (e) { return false; }
  };
  TS.loadResult = function (key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };
  TS.clearResult = function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
  };

  // 차트 툴팁(위임 방식): data-tip 속성을 가진 요소 위에서 표시
  TS.attachTooltips = function (root) {
    root = root || document;
    var tip = document.querySelector('.tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      tip.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tip);
    }
    function move(e) {
      var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      var y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }
    root.addEventListener('mousemove', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (el) {
        tip.textContent = el.getAttribute('data-tip');
        tip.classList.add('show');
        move(e);
      } else { tip.classList.remove('show'); }
    });
    root.addEventListener('mouseleave', function () { tip.classList.remove('show'); }, true);
  };
}());
