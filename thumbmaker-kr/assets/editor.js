/* =========================================================================
 * thumbmaker-kr — 경량 캔버스 에디터 엔진 (외부 라이브러리 없음)
 * 레이어(배경/이미지/텍스트/도형/이모지), 선택·드래그·리사이즈·회전,
 * 스냅 가이드, 실행취소/다시실행, 레이어 순서, 터치(Pointer Events) 지원.
 * 사용: new ThumbEditor(mountEl, presetConfig)
 * ========================================================================= */
(function () {
'use strict';

var FONTS = [
  { css: "Pretendard Variable, Pretendard, sans-serif", key: 'Pretendard',      label: '프리텐다드',       weights: [400, 700, 800] },
  { css: "'Noto Sans KR', sans-serif",                  key: 'Noto Sans KR',    label: '노토 산스',        weights: [400, 700, 900] },
  { css: "'Nanum Gothic', sans-serif",                  key: 'Nanum Gothic',    label: '나눔고딕',         weights: [400, 700, 800] },
  { css: "'Nanum Myeongjo', serif",                     key: 'Nanum Myeongjo',  label: '나눔명조',         weights: [400, 700, 800] },
  { css: "'Nanum Pen Script', cursive",                 key: 'Nanum Pen Script',label: '나눔손글씨 펜',    weights: [400] },
  { css: "'Black Han Sans', sans-serif",                key: 'Black Han Sans',  label: '검은고딕(임팩트)', weights: [400] },
  { css: "'Jua', sans-serif",                           key: 'Jua',             label: '주아',             weights: [400] },
  { css: "'Do Hyeon', sans-serif",                      key: 'Do Hyeon',        label: '도현',             weights: [400] }
];
var EMOJIS = ['😀','😂','🥹','😍','🤔','😱','🔥','✨','💖','⭐','🎉','👍','👀','💬','❗','❓','✅','🚫','➡️','📌','🏆','💰','🍀','☕','🎬','🎮','📷','🍕','😴','🤯'];

function fontByKey(k) { for (var i = 0; i < FONTS.length; i++) if (FONTS[i].key === k) return FONTS[i]; return FONTS[0]; }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function deg2rad(d) { return d * Math.PI / 180; }
var _uid = 0;
function uid() { return 'o' + (++_uid) + '_' + Date.now().toString(36); }

/* rounded-rect path (iOS<16 roundRect 미지원 대비) */
function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ThumbEditor(mount, preset) {
  if (!(this instanceof ThumbEditor)) return new ThumbEditor(mount, preset);
  var self = this;
  preset = preset || {};
  this.preset = preset;
  this.slug = preset.slug || 'canvas';
  this.sizes = preset.sizes || [{ label: '1280×720', w: 1280, h: 720 }];
  this.state = {
    w: this.sizes[0].w, h: this.sizes[0].h,
    bg: preset.transparentDefault
      ? { type: 'transparent' }
      : (preset.bg || { type: 'linear', angle: 135, from: '#2563eb', to: '#7c3aed', color: '#ffffff' }),
    objects: []
  };
  if (this.state.bg.type === 'solid' && !this.state.bg.color) this.state.bg.color = '#ffffff';
  this.sel = null;             // selected object id
  this.history = []; this.hIdx = -1;
  this.imgCache = {};          // src -> {img, ok}
  this.loadedFonts = {};       // "700 KEY" -> true
  this.guides = [];            // snap guide lines to draw
  this.mount = mount;

  this._buildUI();
  this._bindPointer();
  this._bindKeys();

  // 저장본 자동 복원
  var restored = false;
  try {
    var raw = localStorage.getItem('tm-project-' + this.slug);
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && saved.w && Array.isArray(saved.objects)) {
        this.state = saved; restored = true;
        this.cv.width = saved.w; this.cv.height = saved.h;
        this._matchSizeSelect();
      }
    }
  } catch (e) {}
  if (!restored && preset.starter) preset.starter(this);
  this._bgToUI(); this._syncMemeInputs();
  this._preloadFonts();
  this.select(null);          // 초기 레이어/속성 패널 렌더 (템플릿 스타터 반영)
  this.pushHistory();
  this.render();
  if (restored) this.toast('이전 작업을 불러왔어요. 처음부터 시작하려면 [새로]를 누르세요.');
}

/* ---------------------------------------------------------------- UI --- */
ThumbEditor.prototype._buildUI = function () {
  var self = this, p = this.preset;
  var el = document.createElement('div');
  el.className = 'tm-editor';
  var sizeSel = '';
  if (this.sizes.length > 1) {
    sizeSel = '<select data-act="size" aria-label="캔버스 크기">' + this.sizes.map(function (s, i) {
      return '<option value="' + i + '">' + s.label + '</option>';
    }).join('') + '</select>';
  }
  el.innerHTML =
    '<div class="tm-toolbar">' +
      '<button type="button" class="tm-btn" data-act="undo" title="실행취소 (Ctrl+Z)">↶ 취소</button>' +
      '<button type="button" class="tm-btn" data-act="redo" title="다시실행 (Ctrl+Y)">↷ 재실행</button>' +
      '<span class="sep"></span>' +
      '<button type="button" class="tm-btn" data-act="add-text">T 텍스트</button>' +
      '<button type="button" class="tm-btn" data-act="add-image">🖼 이미지</button>' +
      '<button type="button" class="tm-btn" data-act="shape-pop">◼ 도형</button>' +
      '<button type="button" class="tm-btn" data-act="emoji-pop">😀 스티커</button>' +
      '<span class="sep"></span>' +
      '<button type="button" class="tm-btn" data-act="templates">🎨 템플릿</button>' +
      sizeSel +
      '<span class="sep"></span>' +
      '<button type="button" class="tm-btn" data-act="reset">새로</button>' +
      '<button type="button" class="tm-btn" data-act="proj-save">저장</button>' +
      '<button type="button" class="tm-btn" data-act="proj-load">열기</button>' +
    '</div>' +
    (p.memeMode ?
      '<div class="tm-memebar">' +
        '<button type="button" class="tm-btn full" data-act="meme-image">📷 짤 배경 이미지 선택 (필수 아님)</button>' +
        '<input type="text" data-meme="top" placeholder="윗줄 텍스트" aria-label="윗줄 텍스트">' +
        '<input type="text" data-meme="bottom" placeholder="아랫줄 텍스트" aria-label="아랫줄 텍스트">' +
        '<div class="hint">입력하면 즉시 캔버스에 반영됩니다. 위치·크기는 캔버스에서 드래그로 조절할 수 있어요.</div>' +
      '</div>' : '') +
    '<div class="tm-main">' +
      '<div class="tm-stagewrap"><div class="tm-stage"><canvas></canvas></div></div>' +
      '<div class="tm-side">' +
        '<div class="tm-panel" data-panel="props"><h4>선택 요소</h4><div data-props><p class="tm-empty">요소를 선택하거나 툴바에서 추가하세요.</p></div></div>' +
        '<div class="tm-panel" data-panel="layers"><h4>레이어</h4><ul class="tm-layers" data-layers></ul></div>' +
        '<div class="tm-panel" data-panel="bg"><h4>배경</h4>' +
          '<div class="tm-row"><label>종류</label><select data-bg="type">' +
            '<option value="solid">단색</option><option value="linear">그라데이션</option><option value="transparent">투명</option>' +
          '</select></div>' +
          '<div class="tm-row" data-bgrow="solid"><label>색상</label><input type="color" class="tm-color" data-bg="color" value="#ffffff"></div>' +
          '<div class="tm-row" data-bgrow="linear"><label>색 1→2</label>' +
            '<input type="color" class="tm-color" data-bg="from" value="#2563eb">' +
            '<input type="color" class="tm-color" data-bg="to" value="#7c3aed">' +
            '<input type="range" data-bg="angle" min="0" max="360" value="135" aria-label="그라데이션 각도"></div>' +
        '</div>' +
        '<div class="tm-panel" data-panel="export"><h4>내보내기</h4>' +
          '<div class="tm-row"><label>형식</label><select data-ex="fmt">' +
            '<option value="png">PNG</option><option value="jpeg">JPG</option><option value="webp">WebP</option></select>' +
            '<select data-ex="scale" aria-label="배율"><option value="1">1x</option><option value="2">2x</option></select></div>' +
          '<div class="tm-row" data-exrow="q"><label>품질</label><input type="range" data-ex="q" min="50" max="100" value="90"></div>' +
          (p.circle ? '<div class="tm-row"><label></label><label style="min-width:0;display:flex;gap:6px;align-items:center;font-size:.85rem;color:var(--ink)"><input type="checkbox" data-ex="circle" checked> 원형으로 자르기(PNG)</label></div>' : '') +
          '<button type="button" class="tm-btn primary" data-act="export" style="width:100%;min-height:48px;margin-top:4px">⬇ 이미지 저장</button>' +
          '<div class="tm-note">저장이 안 되면 캔버스를 길게 눌러 “이미지 저장”을 사용하세요(iOS).</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  this.mount.appendChild(el);
  this.root = el;
  this.cv = el.querySelector('canvas');
  this.ctx = this.cv.getContext('2d');
  this.cv.width = this.state.w; this.cv.height = this.state.h;
  this.stage = el.querySelector('.tm-stage');

  // hidden file inputs
  this.fileImg = document.createElement('input');
  this.fileImg.type = 'file'; this.fileImg.accept = 'image/*'; this.fileImg.style.display = 'none';
  this.fileProj = document.createElement('input');
  this.fileProj.type = 'file'; this.fileProj.accept = '.json,application/json'; this.fileProj.style.display = 'none';
  el.appendChild(this.fileImg); el.appendChild(this.fileProj);

  // popovers
  this.shapePop = document.createElement('div');
  this.shapePop.className = 'tm-pop';
  this.shapePop.innerHTML =
    '<button type="button" class="tm-btn" data-shape="rect">■ 사각형</button>' +
    '<button type="button" class="tm-btn" data-shape="circle">● 원</button>' +
    '<button type="button" class="tm-btn" data-shape="line">─ 선</button>';
  this.emojiPop = document.createElement('div');
  this.emojiPop.className = 'tm-pop';
  this.emojiPop.innerHTML = '<div class="tm-emoji-grid">' +
    EMOJIS.map(function (e) { return '<button type="button" data-emoji="' + e + '">' + e + '</button>'; }).join('') + '</div>';
  el.querySelector('.tm-toolbar').style.position = 'relative';
  el.querySelector('.tm-toolbar').appendChild(this.shapePop);
  el.querySelector('.tm-toolbar').appendChild(this.emojiPop);

  // template modal
  this.tplModal = document.createElement('div');
  this.tplModal.className = 'tm-modal';
  this.tplModal.innerHTML = '<div class="box"><button type="button" class="tm-close" aria-label="닫기">✕</button>' +
    '<h3>템플릿 선택</h3><p class="sub">템플릿을 적용하면 현재 캔버스 내용이 바뀝니다(실행취소 가능). 문구는 클릭해서 자유롭게 수정하세요.</p>' +
    '<div class="tm-tpl-grid"></div></div>';
  document.body.appendChild(this.tplModal);

  // toast
  this.toastEl = document.createElement('div');
  this.toastEl.className = 'tm-toast';
  document.body.appendChild(this.toastEl);

  this._bindUI();
};

ThumbEditor.prototype.toast = function (msg) {
  var t = this.toastEl; t.textContent = msg; t.classList.add('show');
  clearTimeout(this._toastT);
  this._toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
};

ThumbEditor.prototype._bindUI = function () {
  var self = this, root = this.root;
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'undo') self.undo();
    else if (act === 'redo') self.redo();
    else if (act === 'add-text') self.addText();
    else if (act === 'add-image') { self._imgTarget = 'new'; self.fileImg.click(); }
    else if (act === 'meme-image') { self._imgTarget = 'meme'; self.fileImg.click(); }
    else if (act === 'shape-pop') self._togglePop(self.shapePop, b);
    else if (act === 'emoji-pop') self._togglePop(self.emojiPop, b);
    else if (act === 'templates') self.openTemplates();
    else if (act === 'reset') self.resetCanvas();
    else if (act === 'proj-save') self.exportProject();
    else if (act === 'proj-load') self.fileProj.click();
    else if (act === 'export') self.exportImage();
  });
  this.shapePop.addEventListener('click', function (e) {
    var b = e.target.closest('[data-shape]'); if (!b) return;
    self.addShape(b.getAttribute('data-shape'));
    self.shapePop.classList.remove('open');
  });
  this.emojiPop.addEventListener('click', function (e) {
    var b = e.target.closest('[data-emoji]'); if (!b) return;
    self.addEmoji(b.getAttribute('data-emoji'));
    self.emojiPop.classList.remove('open');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.tm-pop') && !e.target.closest('[data-act="shape-pop"]') && !e.target.closest('[data-act="emoji-pop"]')) {
      self.shapePop.classList.remove('open'); self.emojiPop.classList.remove('open');
    }
  });
  this.fileImg.addEventListener('change', function () {
    var f = self.fileImg.files[0]; self.fileImg.value = '';
    if (f) self._loadImageFile(f, self._imgTarget === 'meme');
  });
  this.fileProj.addEventListener('change', function () {
    var f = self.fileProj.files[0]; self.fileProj.value = '';
    if (f) self.importProject(f);
  });
  var szSel = root.querySelector('[data-act="size"]');
  if (szSel) szSel.addEventListener('change', function () { self.setSize(parseInt(szSel.value, 10)); });

  // background controls
  root.querySelectorAll('[data-bg]').forEach(function (inp) {
    inp.addEventListener('input', function () { self._bgFromUI(false); });
    inp.addEventListener('change', function () { self._bgFromUI(true); });
  });
  this._bgToUI();

  // export quality row visibility
  var fmtSel = root.querySelector('[data-ex="fmt"]');
  var qRow = root.querySelector('[data-exrow="q"]');
  var updQ = function () { qRow.style.display = fmtSel.value === 'png' ? 'none' : ''; };
  fmtSel.addEventListener('change', updQ); updQ();

  // meme inputs
  if (this.preset.memeMode) {
    root.querySelectorAll('[data-meme]').forEach(function (inp) {
      inp.addEventListener('input', function () { self._memeText(inp.getAttribute('data-meme'), inp.value, false); });
      inp.addEventListener('change', function () { self._memeText(inp.getAttribute('data-meme'), inp.value, true); });
    });
  }

  // template modal
  this.tplModal.addEventListener('click', function (e) {
    if (e.target === self.tplModal || e.target.closest('.tm-close')) self.tplModal.classList.remove('open');
  });
};

ThumbEditor.prototype._togglePop = function (pop, btn) {
  var open = pop.classList.contains('open');
  this.shapePop.classList.remove('open'); this.emojiPop.classList.remove('open');
  if (!open) {
    pop.style.left = Math.max(0, btn.offsetLeft - 4) + 'px';
    pop.style.top = (btn.offsetTop + btn.offsetHeight + 6) + 'px';
    pop.classList.add('open');
  }
};

/* --------------------------------------------------------- background --- */
ThumbEditor.prototype._bgToUI = function () {
  var r = this.root, bg = this.state.bg;
  r.querySelector('[data-bg="type"]').value = bg.type || 'solid';
  if (bg.color) r.querySelector('[data-bg="color"]').value = bg.color;
  if (bg.from) r.querySelector('[data-bg="from"]').value = bg.from;
  if (bg.to) r.querySelector('[data-bg="to"]').value = bg.to;
  if (bg.angle != null) r.querySelector('[data-bg="angle"]').value = bg.angle;
  r.querySelector('[data-bgrow="solid"]').style.display = bg.type === 'solid' ? '' : 'none';
  r.querySelector('[data-bgrow="linear"]').style.display = bg.type === 'linear' ? '' : 'none';
};
ThumbEditor.prototype._bgFromUI = function (commit) {
  var r = this.root;
  this.state.bg = {
    type: r.querySelector('[data-bg="type"]').value,
    color: r.querySelector('[data-bg="color"]').value,
    from: r.querySelector('[data-bg="from"]').value,
    to: r.querySelector('[data-bg="to"]').value,
    angle: parseInt(r.querySelector('[data-bg="angle"]').value, 10) || 0
  };
  this._bgToUI();
  this.render();
  if (commit) this.pushHistory();
};

/* ------------------------------------------------------------- objects --- */
ThumbEditor.prototype.addText = function (opts) {
  var s = this.state, base = Math.min(s.w, s.h);
  var o = Object.assign({
    id: uid(), type: 'text', text: '텍스트를 입력하세요',
    x: s.w / 2, y: s.h / 2, rotation: 0, opacity: 1,
    font: 'Black Han Sans', weight: 400, size: Math.round(base * 0.12),
    color: '#ffffff', stroke: '#000000', strokeW: Math.round(base * 0.012),
    align: 'center', lineHeight: 1.2, shadow: false
  }, opts || {});
  s.objects.push(o);
  this.select(o.id); this.render(); this.pushHistory();
  this.ensureFont(o.font, o.weight);
  return o;
};
ThumbEditor.prototype.addShape = function (shape) {
  var s = this.state, base = Math.min(s.w, s.h);
  var o = {
    id: uid(), type: 'shape', shape: shape,
    x: s.w / 2, y: s.h / 2, rotation: 0, opacity: 1,
    w: shape === 'line' ? Math.round(s.w * 0.5) : Math.round(base * 0.4),
    h: shape === 'line' ? Math.max(6, Math.round(base * 0.012)) : Math.round(base * 0.4),
    fill: shape === 'line' ? '#1a202c' : '#facc15',
    stroke: '', strokeW: 0, radius: shape === 'rect' ? Math.round(base * 0.03) : 0
  };
  s.objects.push(o);
  this.select(o.id); this.render(); this.pushHistory();
  return o;
};
ThumbEditor.prototype.addEmoji = function (ch) {
  var s = this.state, base = Math.min(s.w, s.h);
  var o = { id: uid(), type: 'emoji', char: ch, x: s.w / 2, y: s.h / 2,
    rotation: 0, opacity: 1, size: Math.round(base * 0.25) };
  s.objects.push(o);
  this.select(o.id); this.render(); this.pushHistory();
  return o;
};
ThumbEditor.prototype._loadImageFile = function (file, asMeme) {
  var self = this;
  var rd = new FileReader();
  rd.onload = function () {
    var src = rd.result;
    var img = new Image();
    img.onload = function () {
      self.imgCache[src] = { img: img, ok: true };
      var s = self.state, o;
      if (asMeme) {
        // cover canvas, send to back
        var sc = Math.max(s.w / img.naturalWidth, s.h / img.naturalHeight);
        o = { id: 'meme-img', type: 'image', src: src, x: s.w / 2, y: s.h / 2,
          w: Math.round(img.naturalWidth * sc), h: Math.round(img.naturalHeight * sc),
          rotation: 0, opacity: 1 };
        s.objects = s.objects.filter(function (x) { return x.id !== 'meme-img'; });
        s.objects.unshift(o);
      } else {
        var sc2 = Math.min(1, (s.w * 0.6) / img.naturalWidth, (s.h * 0.6) / img.naturalHeight);
        o = { id: uid(), type: 'image', src: src, x: s.w / 2, y: s.h / 2,
          w: Math.round(img.naturalWidth * sc2), h: Math.round(img.naturalHeight * sc2),
          rotation: 0, opacity: 1 };
        s.objects.push(o);
      }
      self.select(o.id); self.render(); self.pushHistory();
    };
    img.src = src;
  };
  rd.readAsDataURL(file);
};
ThumbEditor.prototype._memeText = function (pos, val, commit) {
  var s = this.state, id = 'meme-' + pos;
  var o = this.byId(id);
  if (!val.trim()) {
    if (o) { s.objects = s.objects.filter(function (x) { return x.id !== id; }); if (this.sel === id) this.sel = null; }
  } else if (o) { o.text = val; }
  else {
    var base = Math.min(s.w, s.h);
    s.objects.push({ id: id, type: 'text', text: val,
      x: s.w / 2, y: pos === 'top' ? s.h * 0.12 : s.h * 0.88,
      rotation: 0, opacity: 1, font: 'Black Han Sans', weight: 400,
      size: Math.round(base * 0.13), color: '#ffffff', stroke: '#000000',
      strokeW: Math.round(base * 0.016), align: 'center', lineHeight: 1.15, shadow: false });
    this.ensureFont('Black Han Sans', 400);
  }
  this.render();
  if (commit) this.pushHistory();
};

ThumbEditor.prototype.byId = function (id) {
  for (var i = 0; i < this.state.objects.length; i++)
    if (this.state.objects[i].id === id) return this.state.objects[i];
  return null;
};
ThumbEditor.prototype.select = function (id) {
  this.sel = id;
  this._renderProps(); this._renderLayers();
};
ThumbEditor.prototype.deleteSel = function () {
  if (!this.sel) return;
  var id = this.sel;
  this.state.objects = this.state.objects.filter(function (o) { return o.id !== id; });
  this.sel = null;
  this._syncMemeInputs();
  this.select(null); this.render(); this.pushHistory();
};
ThumbEditor.prototype.duplicateSel = function () {
  var o = this.byId(this.sel); if (!o) return;
  var c = JSON.parse(JSON.stringify(o));
  c.id = uid(); c.x += this.state.w * 0.03; c.y += this.state.h * 0.03;
  this.state.objects.push(c);
  this.select(c.id); this.render(); this.pushHistory();
};
ThumbEditor.prototype.moveLayer = function (id, dir) {
  var arr = this.state.objects, i = arr.findIndex(function (o) { return o.id === id; });
  if (i < 0) return;
  var j = i + dir;
  if (j < 0 || j >= arr.length) return;
  var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  this.render(); this._renderLayers(); this.pushHistory();
};

/* ------------------------------------------------------------- history --- */
ThumbEditor.prototype.pushHistory = function () {
  var snap = JSON.stringify(this.state);
  if (this.history[this.hIdx] === snap) return;
  this.history = this.history.slice(0, this.hIdx + 1);
  this.history.push(snap);
  if (this.history.length > 30) this.history.shift();
  this.hIdx = this.history.length - 1;
  this._histBtns();
  this._autosave();
};
ThumbEditor.prototype.undo = function () {
  if (this.hIdx <= 0) return;
  this.hIdx--; this._restore(this.history[this.hIdx]);
};
ThumbEditor.prototype.redo = function () {
  if (this.hIdx >= this.history.length - 1) return;
  this.hIdx++; this._restore(this.history[this.hIdx]);
};
ThumbEditor.prototype._restore = function (snap) {
  this.state = JSON.parse(snap);
  if (this.sel && !this.byId(this.sel)) this.sel = null;
  this.cv.width = this.state.w; this.cv.height = this.state.h;
  this._bgToUI(); this._syncMemeInputs(); this._matchSizeSelect();
  this.select(this.sel); this.render(); this._histBtns(); this._autosave();
};
ThumbEditor.prototype._histBtns = function () {
  this.root.querySelector('[data-act="undo"]').disabled = this.hIdx <= 0;
  this.root.querySelector('[data-act="redo"]').disabled = this.hIdx >= this.history.length - 1;
};
ThumbEditor.prototype._autosave = function () {
  try { localStorage.setItem('tm-project-' + this.slug, JSON.stringify(this.state)); }
  catch (e) { /* 용량 초과 시 조용히 무시 (대형 이미지 포함 프로젝트) */ }
};
ThumbEditor.prototype._syncMemeInputs = function () {
  if (!this.preset.memeMode) return;
  var self = this;
  this.root.querySelectorAll('[data-meme]').forEach(function (inp) {
    var o = self.byId('meme-' + inp.getAttribute('data-meme'));
    inp.value = o ? o.text : '';
  });
};
ThumbEditor.prototype._matchSizeSelect = function () {
  var sel = this.root.querySelector('[data-act="size"]'); if (!sel) return;
  for (var i = 0; i < this.sizes.length; i++)
    if (this.sizes[i].w === this.state.w && this.sizes[i].h === this.state.h) { sel.value = String(i); return; }
};

ThumbEditor.prototype.resetCanvas = function () {
  if (!confirm('캔버스를 비우고 처음부터 시작할까요?')) return;
  var sz = this.sizes[parseInt((this.root.querySelector('[data-act="size"]') || { value: 0 }).value, 10) || 0];
  this.state = { w: sz.w, h: sz.h,
    bg: this.preset.transparentDefault ? { type: 'transparent' } : (this.preset.bg || { type: 'linear', angle: 135, from: '#2563eb', to: '#7c3aed', color: '#ffffff' }),
    objects: [] };
  this.sel = null;
  this.cv.width = sz.w; this.cv.height = sz.h;
  if (this.preset.starter) this.preset.starter(this);
  this._bgToUI(); this._syncMemeInputs();
  this.select(null); this.render(); this.pushHistory();
};

ThumbEditor.prototype.setSize = function (i) {
  var sz = this.sizes[i]; if (!sz) return;
  var s = this.state, fx = sz.w / s.w, fy = sz.h / s.h, fm = Math.min(fx, fy);
  s.objects.forEach(function (o) {
    o.x *= fx; o.y *= fy;
    if (o.w) o.w *= fm; if (o.h) o.h *= fm;
    if (o.size) o.size *= fm; if (o.strokeW) o.strokeW *= fm; if (o.radius) o.radius *= fm;
  });
  s.w = sz.w; s.h = sz.h;
  this.cv.width = sz.w; this.cv.height = sz.h;
  this.render(); this.pushHistory();
};

/* --------------------------------------------------------------- fonts --- */
ThumbEditor.prototype.ensureFont = function (key, weight) {
  var self = this, f = fontByKey(key);
  var tag = (weight || 400) + ' ' + f.key;
  if (this.loadedFonts[tag] || !document.fonts || !document.fonts.load) return;
  document.fonts.load((weight || 400) + ' 32px ' + f.css.split(',')[0]).then(function () {
    self.loadedFonts[tag] = true;
    self.render();
  }).catch(function () {});
};
ThumbEditor.prototype._preloadFonts = function () {
  var self = this;
  // 기본 폰트 + 상태에 등장하는 폰트 미리 로딩
  this.ensureFont('Black Han Sans', 400);
  this.ensureFont('Pretendard', 700);
  this.state.objects.forEach(function (o) { if (o.type === 'text') self.ensureFont(o.font, o.weight); });
};
ThumbEditor.prototype._fontsReady = function () {
  // 내보내기 직전: 상태에 쓰인 모든 폰트 로딩 보장
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  var jobs = [];
  this.state.objects.forEach(function (o) {
    if (o.type === 'text') {
      var f = fontByKey(o.font);
      jobs.push(document.fonts.load((o.weight || 400) + ' 32px ' + f.css.split(',')[0], o.text || '가나다'));
    }
  });
  return Promise.all(jobs).catch(function () {});
};

/* ------------------------------------------------------------ geometry --- */
ThumbEditor.prototype._bbox = function (o) {
  // returns {w,h} — text/emoji measured
  if (o.type === 'text') {
    var f = fontByKey(o.font), ctx = this.ctx;
    ctx.font = (o.weight || 400) + ' ' + o.size + 'px ' + f.css;
    var lines = String(o.text || '').split('\n'), w = 1;
    for (var i = 0; i < lines.length; i++) w = Math.max(w, ctx.measureText(lines[i]).width);
    return { w: w, h: Math.max(o.size, lines.length * o.size * (o.lineHeight || 1.2)) };
  }
  if (o.type === 'emoji') return { w: o.size * 1.1, h: o.size * 1.1 };
  return { w: o.w || 10, h: o.h || 10 };
};
ThumbEditor.prototype._hit = function (o, px, py) {
  var b = this._bbox(o);
  var a = -deg2rad(o.rotation || 0);
  var dx = px - o.x, dy = py - o.y;
  var lx = dx * Math.cos(a) - dy * Math.sin(a);
  var ly = dx * Math.sin(a) + dy * Math.cos(a);
  var pad = Math.min(this.state.w, this.state.h) * 0.012; // touch pad
  return Math.abs(lx) <= b.w / 2 + pad && Math.abs(ly) <= b.h / 2 + pad;
};
ThumbEditor.prototype._handles = function (o) {
  var b = this._bbox(o), a = deg2rad(o.rotation || 0);
  var cs = Math.cos(a), sn = Math.sin(a);
  function pt(lx, ly) { return { x: o.x + lx * cs - ly * sn, y: o.y + lx * sn + ly * cs }; }
  var hw = b.w / 2, hh = b.h / 2;
  return {
    nw: pt(-hw, -hh), ne: pt(hw, -hh), sw: pt(-hw, hh), se: pt(hw, hh),
    rot: pt(0, -hh - this._k() * 28)
  };
};
ThumbEditor.prototype._k = function () {
  // canvas units per screen px
  var r = this.cv.getBoundingClientRect();
  return r.width ? this.state.w / r.width : 1;
};
ThumbEditor.prototype._pos = function (e) {
  var r = this.cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * this.state.w / r.width,
           y: (e.clientY - r.top) * this.state.h / r.height };
};

/* ------------------------------------------------------------- pointer --- */
ThumbEditor.prototype._bindPointer = function () {
  var self = this, cv = this.cv;
  var drag = null;

  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    var p = self._pos(e);
    var o = self.byId(self.sel);
    if (o) {
      var hs = self._handles(o), hr = self._k() * 16;
      var keys = ['rot', 'nw', 'ne', 'sw', 'se'];
      for (var i = 0; i < keys.length; i++) {
        var h = hs[keys[i]];
        if (Math.hypot(p.x - h.x, p.y - h.y) <= hr) {
          if (keys[i] === 'rot') {
            drag = { mode: 'rotate', o: o,
              startA: Math.atan2(p.y - o.y, p.x - o.x), startRot: o.rotation || 0, moved: false };
          } else {
            var b = self._bbox(o);
            drag = { mode: 'resize', o: o,
              startD: Math.max(8, Math.hypot(p.x - o.x, p.y - o.y)),
              w0: b.w, h0: b.h, size0: o.size || 0, sw0: o.strokeW || 0, rad0: o.radius || 0, moved: false };
          }
          return;
        }
      }
    }
    // hit-test top-most first
    var hitObj = null;
    for (var j = self.state.objects.length - 1; j >= 0; j--) {
      if (self._hit(self.state.objects[j], p.x, p.y)) { hitObj = self.state.objects[j]; break; }
    }
    if (hitObj) {
      self.select(hitObj.id);
      drag = { mode: 'drag', o: hitObj, sx: p.x, sy: p.y, ox: hitObj.x, oy: hitObj.y, moved: false };
    } else {
      self.select(null); drag = null;
    }
    self.render();
  });

  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    e.preventDefault();
    var p = self._pos(e), o = drag.o, s = self.state;
    drag.moved = true;
    self.guides = [];
    if (drag.mode === 'drag') {
      var nx = drag.ox + (p.x - drag.sx), ny = drag.oy + (p.y - drag.sy);
      // snap: center / edges
      var thr = Math.min(s.w, s.h) * 0.015;
      var b = self._bbox(o);
      var snapsX = [
        { at: s.w / 2, to: s.w / 2, g: s.w / 2 },                    // center
        { at: nx - b.w / 2, to: 0, g: 0 },                            // left edge
        { at: nx + b.w / 2, to: s.w, g: s.w }                         // right edge
      ];
      if (Math.abs(nx - s.w / 2) < thr) { nx = s.w / 2; self.guides.push({ v: s.w / 2 }); }
      else if (Math.abs((nx - b.w / 2)) < thr) { nx = b.w / 2; self.guides.push({ v: 0 }); }
      else if (Math.abs((nx + b.w / 2) - s.w) < thr) { nx = s.w - b.w / 2; self.guides.push({ v: s.w }); }
      if (Math.abs(ny - s.h / 2) < thr) { ny = s.h / 2; self.guides.push({ h: s.h / 2 }); }
      else if (Math.abs((ny - b.h / 2)) < thr) { ny = b.h / 2; self.guides.push({ h: 0 }); }
      else if (Math.abs((ny + b.h / 2) - s.h) < thr) { ny = s.h - b.h / 2; self.guides.push({ h: s.h }); }
      o.x = nx; o.y = ny;
    } else if (drag.mode === 'resize') {
      var d = Math.max(8, Math.hypot(p.x - o.x, p.y - o.y));
      var f = d / drag.startD;
      if (o.type === 'text') o.size = Math.max(8, drag.size0 * f);
      else if (o.type === 'emoji') o.size = Math.max(12, drag.size0 * f);
      else { o.w = Math.max(8, drag.w0 * f); o.h = Math.max(o.shape === 'line' ? 2 : 8, drag.h0 * f); }
      if (o.strokeW) o.strokeW = drag.sw0 * f;
      if (o.radius) o.radius = drag.rad0 * f;
    } else if (drag.mode === 'rotate') {
      var ang = Math.atan2(p.y - o.y, p.x - o.x);
      var rot = drag.startRot + (ang - drag.startA) * 180 / Math.PI;
      rot = ((rot % 360) + 360) % 360;
      // snap to 0/90/180/270
      [0, 90, 180, 270, 360].forEach(function (t) { if (Math.abs(rot - t) < 4) rot = t % 360; });
      o.rotation = rot;
    }
    self.render();
    self._renderPropsValuesOnly();
  });

  function up(e) {
    if (!drag) return;
    var moved = drag.moved;
    drag = null;
    self.guides = [];
    self.render();
    if (moved) self.pushHistory();
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  cv.addEventListener('dblclick', function (e) {
    var o = self.byId(self.sel);
    if (o && o.type === 'text') {
      var ta = self.root.querySelector('[data-prop="text"]');
      if (ta) { ta.focus(); ta.select(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
  });
};

ThumbEditor.prototype._bindKeys = function () {
  var self = this;
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!self.root.closest('body')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? self.redo() : self.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); self.redo(); return; }
    var o = self.byId(self.sel); if (!o) return;
    var step = e.shiftKey ? 10 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); self.deleteSel(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); o.x -= step; self.render(); self.pushHistory(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); o.x += step; self.render(); self.pushHistory(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); o.y -= step; self.render(); self.pushHistory(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); o.y += step; self.render(); self.pushHistory(); }
  });
};

/* -------------------------------------------------------------- render --- */
ThumbEditor.prototype.renderScene = function (ctx, scale, forExport, jpegBg) {
  var s = this.state, self = this;
  var W = s.w * scale, H = s.h * scale;
  ctx.clearRect(0, 0, W, H);
  // background
  if (s.bg.type === 'solid') { ctx.fillStyle = s.bg.color || '#fff'; ctx.fillRect(0, 0, W, H); }
  else if (s.bg.type === 'linear') {
    var a = deg2rad(s.bg.angle || 0);
    var cx = W / 2, cy = H / 2, L = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    var g = ctx.createLinearGradient(cx - Math.cos(a) * L / 2, cy - Math.sin(a) * L / 2,
                                     cx + Math.cos(a) * L / 2, cy + Math.sin(a) * L / 2);
    g.addColorStop(0, s.bg.from || '#2563eb'); g.addColorStop(1, s.bg.to || '#7c3aed');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (jpegBg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }
  // objects
  s.objects.forEach(function (o) {
    ctx.save();
    ctx.globalAlpha = clamp(o.opacity == null ? 1 : o.opacity, 0, 1);
    ctx.translate(o.x * scale, o.y * scale);
    ctx.rotate(deg2rad(o.rotation || 0));
    if (o.type === 'image') {
      var c = self.imgCache[o.src];
      if (!c) {
        c = self.imgCache[o.src] = { img: new Image(), ok: false };
        c.img.onload = function () { c.ok = true; self.render(); };
        c.img.src = o.src;
      }
      if (c.ok) ctx.drawImage(c.img, -o.w * scale / 2, -o.h * scale / 2, o.w * scale, o.h * scale);
      else if (!forExport) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-o.w * scale / 2, -o.h * scale / 2, o.w * scale, o.h * scale);
      }
    } else if (o.type === 'shape') {
      var w = o.w * scale, h = o.h * scale;
      if (o.shape === 'circle') {
        ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        rr(ctx, -w / 2, -h / 2, w, h, (o.shape === 'line' ? h / 2 : (o.radius || 0) * scale));
      }
      if (o.fill && o.fill !== 'none') { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke && o.strokeW > 0) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW * scale; ctx.stroke(); }
    } else if (o.type === 'emoji') {
      ctx.font = (o.size * scale) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.char, 0, o.size * scale * 0.06);
    } else if (o.type === 'text') {
      var f = fontByKey(o.font);
      ctx.font = (o.weight || 400) + ' ' + (o.size * scale) + 'px ' + f.css;
      ctx.textBaseline = 'middle';
      var lines = String(o.text || '').split('\n');
      var lh = o.size * (o.lineHeight || 1.2) * scale;
      var totalH = lines.length * lh;
      var bw = 1;
      lines.forEach(function (ln) { bw = Math.max(bw, ctx.measureText(ln).width); });
      if (o.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = o.size * scale * 0.18;
        ctx.shadowOffsetX = o.size * scale * 0.04; ctx.shadowOffsetY = o.size * scale * 0.05;
      }
      lines.forEach(function (ln, i) {
        var y = -totalH / 2 + lh * (i + 0.5);
        var x = 0;
        if (o.align === 'left') { ctx.textAlign = 'left'; x = -bw / 2; }
        else if (o.align === 'right') { ctx.textAlign = 'right'; x = bw / 2; }
        else ctx.textAlign = 'center';
        if (o.stroke && o.strokeW > 0) {
          ctx.lineJoin = 'round';
          ctx.strokeStyle = o.stroke;
          ctx.lineWidth = o.strokeW * 2 * scale;
          ctx.strokeText(ln, x, y);
        }
        ctx.fillStyle = o.color || '#000';
        ctx.fillText(ln, x, y);
      });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
    ctx.restore();
  });
};

ThumbEditor.prototype.render = function () {
  var ctx = this.ctx, s = this.state, p = this.preset;
  this.renderScene(ctx, 1, false, false);
  var k = this._k();
  // safe-area guide (banner)
  if (p.safeArea) {
    var sa = p.safeArea;
    ctx.save();
    ctx.strokeStyle = 'rgba(225,29,72,.9)'; ctx.setLineDash([10 * k, 8 * k]); ctx.lineWidth = 2 * k;
    ctx.strokeRect((s.w - sa.w) / 2, (s.h - sa.h) / 2, sa.w, sa.h);
    ctx.setLineDash([]);
    ctx.font = (13 * k) + 'px sans-serif'; ctx.fillStyle = 'rgba(225,29,72,.9)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('안전 영역 ' + sa.w + '×' + sa.h + ' (모든 기기 표시)', (s.w - sa.w) / 2 + 8 * k, (s.h - sa.h) / 2 + 6 * k);
    ctx.restore();
  }
  // circle guide (profile)
  if (p.circle) {
    ctx.save();
    ctx.strokeStyle = 'rgba(225,29,72,.85)'; ctx.setLineDash([10 * k, 8 * k]); ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(s.w / 2, s.h / 2, Math.min(s.w, s.h) / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // snap guides
  var self = this;
  if (this.guides.length) {
    ctx.save();
    ctx.strokeStyle = '#ff2fa0'; ctx.lineWidth = Math.max(1, 1.5 * k);
    this.guides.forEach(function (g) {
      ctx.beginPath();
      if (g.v != null) { ctx.moveTo(g.v, 0); ctx.lineTo(g.v, s.h); }
      else { ctx.moveTo(0, g.h); ctx.lineTo(s.w, g.h); }
      ctx.stroke();
    });
    ctx.restore();
  }
  // selection
  var o = this.byId(this.sel);
  if (o) {
    var b = this._bbox(o), hs = this._handles(o);
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(deg2rad(o.rotation || 0));
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.6 * k;
    ctx.setLineDash([6 * k, 4 * k]);
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.setLineDash([]);
    ctx.restore();
    var hr = 7 * k;
    ctx.save();
    ['nw', 'ne', 'sw', 'se'].forEach(function (key) {
      var h = hs[key];
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // rotation handle
    ctx.beginPath(); ctx.moveTo(hs.rot.x, hs.rot.y);
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath(); ctx.arc(hs.rot.x, hs.rot.y, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb'; ctx.fill();
    ctx.restore();
  }
};

/* --------------------------------------------------------- props panel --- */
ThumbEditor.prototype._renderProps = function () {
  var box = this.root.querySelector('[data-props]');
  var o = this.byId(this.sel), self = this;
  if (!o) { box.innerHTML = '<p class="tm-empty">요소를 선택하거나 툴바에서 추가하세요.</p>'; return; }
  var h = '';
  if (o.type === 'text') {
    h += '<div class="tm-row"><textarea data-prop="text" rows="2" aria-label="텍스트 내용">' +
      String(o.text).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea></div>' +
      '<div class="tm-row"><label>폰트</label><select data-prop="font">' +
      FONTS.map(function (f) { return '<option value="' + f.key + '"' + (f.key === o.font ? ' selected' : '') + '>' + f.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="tm-row"><label>굵기</label><select data-prop="weight">' +
      fontByKey(o.font).weights.map(function (w) {
        return '<option value="' + w + '"' + (w === (o.weight || 400) ? ' selected' : '') + '>' + (w >= 800 ? '아주 굵게' : w >= 700 ? '굵게' : '보통') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="tm-row"><label>크기</label><input type="number" data-prop="size" value="' + Math.round(o.size) + '" min="8">' +
      '<label>줄간격</label><input type="number" data-prop="lineHeight" value="' + (o.lineHeight || 1.2) + '" step="0.05" min="0.8" max="3" style="width:64px"></div>' +
      '<div class="tm-row"><label>글자색</label><input type="color" class="tm-color" data-prop="color" value="' + (o.color || '#000000') + '">' +
      '<label>외곽선</label><input type="color" class="tm-color" data-prop="stroke" value="' + (o.stroke || '#000000') + '">' +
      '<input type="number" data-prop="strokeW" value="' + Math.round(o.strokeW || 0) + '" min="0" style="width:64px" aria-label="외곽선 두께"></div>' +
      '<div class="tm-row"><label>정렬</label><select data-prop="align">' +
      '<option value="left"' + (o.align === 'left' ? ' selected' : '') + '>왼쪽</option>' +
      '<option value="center"' + (o.align === 'center' || !o.align ? ' selected' : '') + '>가운데</option>' +
      '<option value="right"' + (o.align === 'right' ? ' selected' : '') + '>오른쪽</option></select>' +
      '<label style="min-width:0;display:flex;align-items:center;gap:5px;font-size:.82rem;color:var(--ink)"><input type="checkbox" data-prop="shadow"' + (o.shadow ? ' checked' : '') + '> 그림자</label></div>';
  } else if (o.type === 'shape') {
    h += '<div class="tm-row"><label>채우기</label><input type="color" class="tm-color" data-prop="fill" value="' + (o.fill === 'none' ? '#ffffff' : (o.fill || '#facc15')) + '">' +
      '<label style="min-width:0;display:flex;align-items:center;gap:5px;font-size:.82rem;color:var(--ink)"><input type="checkbox" data-prop="fillNone"' + (o.fill === 'none' ? ' checked' : '') + '> 채우기 없음</label></div>' +
      '<div class="tm-row"><label>테두리</label><input type="color" class="tm-color" data-prop="stroke" value="' + (o.stroke || '#1a202c') + '">' +
      '<input type="number" data-prop="strokeW" value="' + Math.round(o.strokeW || 0) + '" min="0" style="width:64px" aria-label="테두리 두께"></div>' +
      (o.shape === 'rect' ? '<div class="tm-row"><label>모서리</label><input type="number" data-prop="radius" value="' + Math.round(o.radius || 0) + '" min="0"></div>' : '') +
      '<div class="tm-row"><label>가로</label><input type="number" data-prop="w" value="' + Math.round(o.w) + '" min="2">' +
      '<label>세로</label><input type="number" data-prop="h" value="' + Math.round(o.h) + '" min="2"></div>';
  } else if (o.type === 'emoji') {
    h += '<div class="tm-row"><label>이모지</label><input type="text" data-prop="char" value="' + o.char + '" style="width:80px">' +
      '<label>크기</label><input type="number" data-prop="size" value="' + Math.round(o.size) + '" min="12"></div>';
  } else if (o.type === 'image') {
    h += '<div class="tm-row"><label>가로</label><input type="number" data-prop="w" value="' + Math.round(o.w) + '" min="4">' +
      '<label>세로</label><input type="number" data-prop="h" value="' + Math.round(o.h) + '" min="4"></div>' +
      '<div class="tm-row"><button type="button" class="tm-btn tm-mini" data-imgfit="cover">캔버스 꽉 채우기</button>' +
      '<button type="button" class="tm-btn tm-mini" data-imgfit="contain">캔버스에 맞추기</button></div>';
  }
  // common
  h += '<div class="tm-row"><label>회전</label><input type="number" data-prop="rotation" value="' + Math.round(o.rotation || 0) + '" step="1">' +
    '<label>투명도</label><input type="range" data-prop="opacity" min="10" max="100" value="' + Math.round((o.opacity == null ? 1 : o.opacity) * 100) + '"></div>' +
    '<div class="tm-row">' +
    '<button type="button" class="tm-btn tm-mini" data-alcenter="x">↔ 가로 중앙</button>' +
    '<button type="button" class="tm-btn tm-mini" data-alcenter="y">↕ 세로 중앙</button></div>' +
    '<div class="tm-row">' +
    '<button type="button" class="tm-btn tm-mini" data-obj="dup">⧉ 복제</button>' +
    '<button type="button" class="tm-btn tm-mini" data-obj="del" style="color:var(--bad)">🗑 삭제</button></div>';
  box.innerHTML = h;

  box.querySelectorAll('[data-prop]').forEach(function (inp) {
    var evt = (inp.type === 'color' || inp.type === 'range' || inp.tagName === 'TEXTAREA' || inp.type === 'text') ? 'input' : 'change';
    inp.addEventListener('input', function () { self._applyProp(o, inp, false); });
    inp.addEventListener('change', function () { self._applyProp(o, inp, true); });
  });
  box.querySelectorAll('[data-obj]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-obj') === 'dup') self.duplicateSel(); else self.deleteSel();
    });
  });
  box.querySelectorAll('[data-alcenter]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-alcenter') === 'x') o.x = self.state.w / 2; else o.y = self.state.h / 2;
      self.render(); self.pushHistory();
    });
  });
  box.querySelectorAll('[data-imgfit]').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = self.imgCache[o.src]; if (!c || !c.ok) return;
      var iw = c.img.naturalWidth, ih = c.img.naturalHeight, s = self.state;
      var f = b.getAttribute('data-imgfit') === 'cover' ? Math.max(s.w / iw, s.h / ih) : Math.min(s.w / iw, s.h / ih);
      o.w = iw * f; o.h = ih * f; o.x = s.w / 2; o.y = s.h / 2; o.rotation = 0;
      self.render(); self._renderProps(); self.pushHistory();
    });
  });
};
ThumbEditor.prototype._applyProp = function (o, inp, commit) {
  var k = inp.getAttribute('data-prop'), v = inp.value;
  if (k === 'text') o.text = v;
  else if (k === 'font') { o.font = v; var f = fontByKey(v); if (f.weights.indexOf(o.weight) < 0) o.weight = f.weights[0]; this.ensureFont(v, o.weight); if (commit) this._renderProps(); }
  else if (k === 'weight') { o.weight = parseInt(v, 10); this.ensureFont(o.font, o.weight); }
  else if (k === 'opacity') o.opacity = parseInt(v, 10) / 100;
  else if (k === 'shadow') o.shadow = inp.checked;
  else if (k === 'fillNone') { o.fill = inp.checked ? 'none' : this.root.querySelector('[data-prop="fill"]').value; }
  else if (k === 'fill') { o.fill = v; var cb = this.root.querySelector('[data-prop="fillNone"]'); if (cb) cb.checked = false; }
  else if (k === 'char') o.char = v || '😀';
  else if (k === 'color' || k === 'stroke' || k === 'align') o[k] = v;
  else o[k] = parseFloat(v) || 0;
  if (o.id.indexOf('meme-') === 0 && k === 'text') this._syncMemeInputs();
  this.render(); this._renderLayers();
  if (commit) this.pushHistory();
};
ThumbEditor.prototype._renderPropsValuesOnly = function () {
  var o = this.byId(this.sel); if (!o) return;
  var box = this.root.querySelector('[data-props]');
  var r = box.querySelector('[data-prop="rotation"]'); if (r) r.value = Math.round(o.rotation || 0);
  var sz = box.querySelector('[data-prop="size"]'); if (sz && o.size) sz.value = Math.round(o.size);
  var w = box.querySelector('[data-prop="w"]'); if (w && o.w) w.value = Math.round(o.w);
  var h = box.querySelector('[data-prop="h"]'); if (h && o.h) h.value = Math.round(o.h);
};

/* -------------------------------------------------------- layers panel --- */
var TYPE_LABEL = { text: '📝', image: '🖼', shape: '◼', emoji: '😀' };
ThumbEditor.prototype._renderLayers = function () {
  var ul = this.root.querySelector('[data-layers]'), self = this;
  var arr = this.state.objects;
  if (!arr.length) { ul.innerHTML = '<li class="tm-empty" style="cursor:default">레이어가 없습니다.</li>'; return; }
  ul.innerHTML = arr.slice().reverse().map(function (o) {
    var nm = o.type === 'text' ? (o.text || '').split('\n')[0] :
             o.type === 'emoji' ? o.char :
             o.type === 'image' ? '이미지' :
             (o.shape === 'circle' ? '원' : o.shape === 'line' ? '선' : '사각형');
    return '<li data-id="' + o.id + '" class="' + (o.id === self.sel ? 'sel' : '') + '">' +
      '<span>' + (TYPE_LABEL[o.type] || '·') + '</span><span class="nm">' + String(nm).replace(/</g, '&lt;') + '</span>' +
      '<button type="button" data-l="up" title="위로">▲</button>' +
      '<button type="button" data-l="down" title="아래로">▼</button>' +
      '<button type="button" data-l="del" title="삭제">✕</button></li>';
  }).join('');
  ul.querySelectorAll('li[data-id]').forEach(function (li) {
    var id = li.getAttribute('data-id');
    li.addEventListener('click', function (e) {
      var b = e.target.closest('[data-l]');
      if (b) {
        var act = b.getAttribute('data-l');
        if (act === 'up') self.moveLayer(id, +1);
        else if (act === 'down') self.moveLayer(id, -1);
        else { self.sel = id; self.deleteSel(); }
        return;
      }
      self.select(id); self.render();
    });
  });
};

/* ----------------------------------------------------------- templates --- */
ThumbEditor.prototype.openTemplates = function () {
  var self = this, grid = this.tplModal.querySelector('.tm-tpl-grid');
  var all = (window.TM_TEMPLATES || []);
  var cats = this.preset.templateCats || [this.slug];
  var mine = all.filter(function (t) { return t.cat.some(function (c) { return cats.indexOf(c) >= 0; }); });
  var rest = all.filter(function (t) { return mine.indexOf(t) < 0; });
  grid.innerHTML = '';
  mine.concat(rest).forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button';
    var pv = document.createElement('canvas');
    var ratio = self.state.h / self.state.w;
    pv.width = 220; pv.height = Math.round(220 * ratio);
    b.appendChild(pv);
    var lbl = document.createElement('span');
    lbl.textContent = t.name + (mine.indexOf(t) < 0 ? ' (다른 프리셋)' : '');
    b.appendChild(lbl);
    // preview: apply template to a temp state and render small
    var tmp = self._templateState(t);
    var saveState = self.state, saveCache = self.imgCache;
    self.state = tmp;
    self.renderScene(pv.getContext('2d'), pv.width / tmp.w, true, false);
    self.state = saveState;
    b.addEventListener('click', function () {
      self.applyTemplate(t);
      self.tplModal.classList.remove('open');
    });
    grid.appendChild(b);
  });
  this.tplModal.classList.add('open');
};
ThumbEditor.prototype._templateState = function (t) {
  var w = this.state.w, h = this.state.h, base = Math.min(w, h);
  var st = { w: w, h: h, bg: JSON.parse(JSON.stringify(t.bg)), objects: [] };
  (t.objects || []).forEach(function (o) {
    var n = { id: uid(), type: o.type, x: o.rx * w, y: o.ry * h,
      rotation: o.rot || 0, opacity: o.opacity == null ? 1 : o.opacity };
    if (o.type === 'text') {
      Object.assign(n, { text: o.text, font: o.font || 'Pretendard', weight: o.weight || 400,
        size: Math.max(10, Math.round((o.size || 0.1) * base)),
        color: o.color || '#000', stroke: o.stroke || '', strokeW: Math.round((o.strokeW || 0) * base),
        align: o.align || 'center', lineHeight: o.lineHeight || 1.2, shadow: !!o.shadow });
      if (o.memeId) n.id = o.memeId;
    } else if (o.type === 'shape') {
      Object.assign(n, { shape: o.shape, w: Math.round(o.rw * w), h: Math.round(o.rh * h),
        fill: o.fill || '#000', stroke: o.stroke || '', strokeW: Math.round((o.strokeW || 0) * base),
        radius: Math.round((o.radius || 0) * base) });
    } else if (o.type === 'emoji') {
      Object.assign(n, { char: o.char, size: Math.round((o.size || 0.2) * base) });
    }
    st.objects.push(n);
  });
  return st;
};
ThumbEditor.prototype.applyTemplate = function (t) {
  var self = this;
  this.state = this._templateState(t);
  this.sel = null;
  this.state.objects.forEach(function (o) { if (o.type === 'text') self.ensureFont(o.font, o.weight); });
  this._bgToUI(); this._syncMemeInputs();
  this.select(null); this.render(); this.pushHistory();
  this.toast('템플릿 적용 완료 — 텍스트를 눌러 내용을 바꿔보세요.');
};

/* -------------------------------------------------------------- export --- */
ThumbEditor.prototype.exportImage = function () {
  var self = this, r = this.root;
  var fmt = r.querySelector('[data-ex="fmt"]').value;
  var scale = parseInt(r.querySelector('[data-ex="scale"]').value, 10) || 1;
  var q = (parseInt(r.querySelector('[data-ex="q"]').value, 10) || 90) / 100;
  var circleCb = r.querySelector('[data-ex="circle"]');
  var circle = circleCb && circleCb.checked;
  this._fontsReady().then(function () {
    var s = self.state;
    var out = document.createElement('canvas');
    out.width = s.w * scale; out.height = s.h * scale;
    var octx = out.getContext('2d');
    if (circle && fmt !== 'png') fmt = 'png'; // 원형은 투명 필요
    self.renderScene(octx, scale, true, fmt === 'jpeg');
    if (circle) {
      var m = document.createElement('canvas');
      var d = Math.min(out.width, out.height);
      m.width = d; m.height = d;
      var mctx = m.getContext('2d');
      mctx.beginPath(); mctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); mctx.clip();
      mctx.drawImage(out, (out.width - d) / -2, (out.height - d) / -2);
      out = m;
    }
    var mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
    out.toBlob(function (blob) {
      if (!blob) { self.toast('내보내기에 실패했습니다. 다른 형식을 시도해 보세요.'); return; }
      var name = 'thumbmaker-' + self.slug + '-' + s.w * scale + 'x' + s.h * scale + '.' +
        (fmt === 'jpeg' ? 'jpg' : fmt);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      self.toast('저장 완료: ' + name);
    }, mime, fmt === 'png' ? undefined : q);
  });
};
ThumbEditor.prototype.exportProject = function () {
  var data = { app: 'thumbmaker-kr', slug: this.slug, version: 1, state: this.state };
  var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'thumbmaker-' + this.slug + '-project.json';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  this.toast('프로젝트 파일(JSON)로 저장했어요. [열기]로 다시 불러올 수 있습니다.');
};
ThumbEditor.prototype.importProject = function (file) {
  var self = this;
  var rd = new FileReader();
  rd.onload = function () {
    try {
      var data = JSON.parse(rd.result);
      var st = data.state || data;
      if (!st || !st.w || !st.h || !Array.isArray(st.objects)) throw new Error('bad');
      self.state = st;
      self.cv.width = st.w; self.cv.height = st.h;
      self.sel = null;
      self._preloadFonts();
      self._bgToUI(); self._syncMemeInputs(); self._matchSizeSelect();
      self.select(null); self.render(); self.pushHistory();
      self.toast('프로젝트를 불러왔습니다.');
    } catch (e) { self.toast('올바른 프로젝트 파일이 아닙니다.'); }
  };
  rd.readAsText(file);
};

window.ThumbEditor = ThumbEditor;
window.TM_FONTS = FONTS;
})();
