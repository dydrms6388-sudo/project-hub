/* imagelab-kr common utils — 모든 처리는 브라우저 로컬에서만 수행됩니다. */
window.IL = (function () {
  'use strict';

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* 대용량에 유리한 createImageBitmap 우선, 실패 시 <img> 폴백 */
  async function loadImage(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) { /* fallthrough */ }
    }
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('이미지를 읽을 수 없습니다: ' + file.name)); };
      img.src = url;
    });
  }
  function imgW(im) { return im.naturalWidth || im.width; }
  function imgH(im) { return im.naturalHeight || im.height; }

  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function toBlob(canvas, type, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) { b ? res(b) : rej(new Error('이미지 인코딩에 실패했습니다 (' + type + ')')); }, type, q);
    });
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
  }

  /* 다운로드 파일명: 원본명-접미사.확장자 */
  function outName(orig, suffix, ext) {
    var base = (orig || 'image').replace(/\.[^.]+$/, '').slice(0, 80) || 'image';
    return base + '-' + suffix + '.' + ext;
  }

  function bindDrop(zoneEl, inputEl, onFiles) {
    zoneEl.addEventListener('click', function () { inputEl.click(); });
    inputEl.addEventListener('change', function () {
      if (inputEl.files && inputEl.files.length) onFiles(Array.from(inputEl.files));
      inputEl.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (t) {
      zoneEl.addEventListener(t, function (e) { e.preventDefault(); zoneEl.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      zoneEl.addEventListener(t, function (e) { e.preventDefault(); zoneEl.classList.remove('over'); });
    });
    zoneEl.addEventListener('drop', function (e) {
      var fs = Array.from(e.dataTransfer.files).filter(function (f) { return /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name); });
      if (fs.length) onFiles(fs);
    });
  }

  /* ---------- CRC32 + ZIP(STORE, 무압축) 직접 조립 ---------- */
  var CRC_T = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /* entries: [{name:String(ASCII/UTF-8), data:Uint8Array}] → Blob(application/zip) */
  function makeZip(entries) {
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var dtime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    var ddate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    entries.forEach(function (e) {
      var name = enc.encode(e.name);
      var data = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data);
      var crc = crc32(data);
      var head = new Uint8Array([].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dtime), u16(ddate),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
      parts.push(head, name, data);
      var cen = new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dtime), u16(ddate),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset)));
      central.push(cen, name);
      offset += head.length + name.length + data.length;
    });
    var cenSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var eocd = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(cenSize), u32(offset), u16(0)));
    return new Blob(parts.concat(central, [eocd]), { type: 'application/zip' });
  }

  /* ---------- 전/후 비교 슬라이더 ---------- */
  /* container에 beforeURL/afterURL 두 이미지를 넣고 드래그 비교 UI 생성 */
  function compareSlider(container, beforeURL, afterURL, labelA, labelB) {
    container.classList.add('cmp');
    container.innerHTML = '';
    var bottom = new Image(); bottom.src = afterURL; bottom.alt = labelB || '후';
    var top = document.createElement('div'); top.className = 'top';
    var topImg = new Image(); topImg.src = beforeURL; topImg.alt = labelA || '전';
    top.appendChild(topImg);
    var bar = document.createElement('div'); bar.className = 'bar';
    var la = document.createElement('span'); la.className = 'lab a'; la.textContent = labelA || '원본';
    var lb = document.createElement('span'); lb.className = 'lab b'; lb.textContent = labelB || '결과';
    container.appendChild(bottom); container.appendChild(top);
    container.appendChild(bar); container.appendChild(la); container.appendChild(lb);
    function setPos(ratio) {
      ratio = Math.max(0.02, Math.min(0.98, ratio));
      var w = container.clientWidth;
      top.style.width = (ratio * 100) + '%';
      topImg.style.width = w + 'px';
      bar.style.left = 'calc(' + (ratio * 100) + '% - 1.5px)';
    }
    bottom.onload = function () { setPos(0.5); };
    var dragging = false;
    function move(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - container.getBoundingClientRect().left;
      setPos(x / container.clientWidth);
    }
    container.addEventListener('pointerdown', function (e) { dragging = true; move(e); });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('resize', function () { setPos(parseFloat(top.style.width) / 100 || 0.5); });
    setPos(0.5);
  }

  return {
    fmtBytes: fmtBytes, loadImage: loadImage, imgW: imgW, imgH: imgH,
    canvasOf: canvasOf, toBlob: toBlob, download: download, outName: outName,
    bindDrop: bindDrop, crc32: crc32, makeZip: makeZip, compareSlider: compareSlider
  };
})();
