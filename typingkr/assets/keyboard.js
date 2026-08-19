/* typingkr 화면 키보드 (두벌식) — keyboard-layout 과 자리 연습에서 공유
 * TK.Keyboard(containerEl, {latin:false}) → { highlight(jamoOrChar), pressPhysical(code, on) }
 */
(function () {
  'use strict';
  var TK = window.TK = window.TK || {};

  // [qwerty, 기본 자모, shift 자모(있으면)]
  var ROWS = [
    [['q','ㅂ','ㅃ'],['w','ㅈ','ㅉ'],['e','ㄷ','ㄸ'],['r','ㄱ','ㄲ'],['t','ㅅ','ㅆ'],
     ['y','ㅛ'],['u','ㅕ'],['i','ㅑ'],['o','ㅐ','ㅒ'],['p','ㅔ','ㅖ']],
    [['a','ㅁ'],['s','ㄴ'],['d','ㅇ'],['f','ㄹ'],['g','ㅎ'],
     ['h','ㅗ'],['j','ㅓ'],['k','ㅏ'],['l','ㅣ']],
    [['z','ㅋ'],['x','ㅌ'],['c','ㅊ'],['v','ㅍ'],['b','ㅠ'],['n','ㅜ'],['m','ㅡ']]
  ];
  var HOME = { a:1, s:1, d:1, f:1, j:1, k:1, l:1 }; // 기본자리 (두벌식: ㅁㄴㅇㄹ / ㅓㅏㅣ)

  function Keyboard(container, opts) {
    opts = opts || {};
    var latin = !!opts.latin; // 영문 모드: 라틴 문자를 크게
    var map = {};   // 자모/문자 -> {el, shift}
    var keyEls = {}; // qwerty char -> el
    var shiftEls = [];

    var wrap = document.createElement('div');
    wrap.className = 'kbd';
    var inner = document.createElement('div');
    inner.className = 'kbd-inner';
    wrap.appendChild(inner);

    ROWS.forEach(function (row, ri) {
      var r = document.createElement('div');
      r.className = 'krow';
      if (ri === 2) { // 왼쪽 Shift
        var sl = mkWide('Shift'); shiftEls.push(sl); r.appendChild(sl);
      }
      row.forEach(function (kdef) {
        var q = kdef[0], base = kdef[1], sh = kdef[2];
        var k = document.createElement('div');
        k.className = 'k' + (HOME[q] ? ' home' : '');
        if (latin) {
          k.innerHTML = '<span>' + q.toUpperCase() + '</span><small>' + base + '</small>';
        } else {
          k.innerHTML = (sh ? '<span class="up">' + sh + '</span>' : '') +
            '<span>' + base + '</span><small>' + q.toUpperCase() + '</small>';
        }
        r.appendChild(k);
        keyEls[q] = k;
        map[base] = { el: k, shift: false };
        if (sh) map[sh] = { el: k, shift: true };
        map[q] = map[q] || { el: k, shift: false };
        map[q.toUpperCase()] = { el: k, shift: true };
      });
      if (ri === 2) { var sr = mkWide('Shift'); shiftEls.push(sr); r.appendChild(sr); }
      inner.appendChild(r);
    });
    // 스페이스 줄
    var last = document.createElement('div');
    last.className = 'krow';
    var space = document.createElement('div');
    space.className = 'k space';
    space.innerHTML = '<small>Space (띄어쓰기)</small>';
    last.appendChild(space);
    inner.appendChild(last);
    map[' '] = { el: space, shift: false };
    container.appendChild(wrap);

    function mkWide(t) {
      var e = document.createElement('div');
      e.className = 'k wide';
      e.textContent = t;
      return e;
    }

    var lit = [];
    function clear() {
      lit.forEach(function (e) { e.classList.remove('hl'); });
      lit = [];
    }
    return {
      el: wrap,
      /** 다음에 눌러야 할 자모/문자 하이라이트. null 이면 해제 */
      highlight: function (ch) {
        clear();
        if (ch == null) return;
        var m = map[ch];
        if (!m) return;
        m.el.classList.add('hl'); lit.push(m.el);
        if (m.shift) shiftEls.forEach(function (s) { s.classList.add('hl'); lit.push(s); });
      },
      /** 실제 keydown 이벤트 반영 (keyboard-layout 데모용) */
      pressPhysical: function (key, on) {
        var el = keyEls[(key || '').toLowerCase()] ||
          (key === ' ' ? space : (key === 'Shift' ? shiftEls[0] : null));
        if (!el) return;
        if (key === 'Shift') { shiftEls.forEach(function (s) { s.classList.toggle('hl', on); }); return; }
        el.classList.toggle('hl', on);
      }
    };
  }

  /* 텐키(숫자 키패드) */
  function Tenkey(container) {
    var LAYOUT = [
      ['7','8','9','-'],
      ['4','5','6','+'],
      ['1','2','3', null],  // + 는 세로 2칸
      ['0', null, '.', null] // 0 은 가로 2칸, Enter 세로 2칸
    ];
    var grid = document.createElement('div');
    grid.className = 'tenkey';
    var map = {};
    function add(t, cls) {
      var k = document.createElement('div');
      k.className = 'k' + (cls ? ' ' + cls : '');
      k.textContent = t;
      grid.appendChild(k);
      map[t] = k;
      return k;
    }
    add('7'); add('8'); add('9'); add('-');
    add('4'); add('5'); add('6'); add('+');
    add('1'); add('2'); add('3'); add('⏎', 'tall');
    add('0', 'wide2'); add('.');
    container.appendChild(grid);
    var cur = null;
    return {
      highlight: function (ch) {
        if (cur) cur.classList.remove('hl');
        cur = null;
        if (ch == null) return;
        if (ch === '\n') ch = '⏎';
        var el = map[ch];
        if (el) { el.classList.add('hl'); cur = el; }
      }
    };
  }

  TK.Keyboard = Keyboard;
  TK.Tenkey = Tenkey;
})();
