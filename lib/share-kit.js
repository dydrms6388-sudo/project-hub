/* share-kit — TomatoEggCat 공유·바이럴 앱 공통 엔진 (브라우저 전역 `SK`)
 *
 * 목적: "서버 없이 링크 하나로 결과·체인을 주고받는" 정적 앱을 만들 때
 *       매번 다시 짜게 되는 것들(상태 인코딩·URL 상태·공유바·결과 카드 PNG·
 *       KST 일일 시드)을 한 곳에 모은 것. 의존성 0, 빌드 0.
 *
 * 사용: <script src="/lib/share-kit.js"></script>  (같은 오리진 정적 파일)
 *       앱에서 백엔드/외부 API/키를 쓰지 않는다는 원칙은 그대로다.
 *
 * 상태 규약
 *   - 쿼리 파라미터는 `?d=`(신규 표준). 기존 앱 호환을 위해 `?r=`도 읽는다.
 *   - 해시(#)가 아니라 쿼리를 쓰는 이유: 링크 미리보기/색인 도구가 읽을 수 있어야 함.
 *   - 개인정보(전화·계좌·주민번호·이메일)는 상태에 절대 넣지 않는다.
 *   - 크기 한도: 8KB 경고 / 12KB 차단 (카톡·문자에서 잘리는 링크 방지).
 *
 * 테스트: node scripts/test-share-kit.mjs
 */
(function (root) {
  "use strict";

  var LIMIT_WARN = 8 * 1024;
  var LIMIT_BLOCK = 12 * 1024;

  /* ── base64url (btoa 비의존: 바이트 배열 ↔ 문자열) ───────────────── */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var B64I = (function () { var m = {}; for (var i = 0; i < 64; i++) m[B64[i]] = i; return m; })();

  function b64encode(bytes) {
    var out = "", i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63] + B64[n & 63];
    }
    var rem = bytes.length - i;
    if (rem === 1) {
      out += B64[bytes[i] >>> 2] + B64[(bytes[i] << 4) & 63];
    } else if (rem === 2) {
      out += B64[bytes[i] >>> 2] + B64[((bytes[i] << 4) | (bytes[i + 1] >>> 4)) & 63] + B64[(bytes[i + 1] << 2) & 63];
    }
    return out;
  }

  function b64decode(str) {
    var s = String(str).replace(/[=\s]/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    var full = (s.length >> 2) * 4, out = [], i, n;
    for (i = 0; i < full; i += 4) {
      n = (B64I[s[i]] << 18) | (B64I[s[i + 1]] << 12) | (B64I[s[i + 2]] << 6) | B64I[s[i + 3]];
      if (isNaN(n)) return null;
      out.push((n >>> 16) & 255, (n >>> 8) & 255, n & 255);
    }
    var rem = s.length - full;
    if (rem === 1) return null;            // base64로 나올 수 없는 길이
    if (rem === 2) {
      n = (B64I[s[i]] << 6) | B64I[s[i + 1]];
      if (isNaN(n)) return null;
      out.push((n >>> 4) & 255);
    } else if (rem === 3) {
      n = (B64I[s[i]] << 12) | (B64I[s[i + 1]] << 6) | B64I[s[i + 2]];
      if (isNaN(n)) return null;
      out.push((n >>> 10) & 255, (n >>> 2) & 255);
    }
    return out;
  }

  /* ── LZSS (window 4096 / match 3~18) ───────────────────────────────
   * 8개 토큰마다 플래그 바이트 1개. 비트 0 = 리터럴 1바이트,
   * 비트 1 = 매치 2바이트(상위 12bit 오프셋, 하위 4bit 길이-3).
   * 편지·명단처럼 반복이 많은 상태에서 URL 길이를 크게 줄인다. */
  function lzCompress(src) {
    var out = [], n = src.length, pos = 0;
    var head = Object.create(null);         // 3바이트 키 → 최근 위치 목록
    while (pos < n) {
      var flagIdx = out.length; out.push(0);
      var flags = 0;
      for (var bit = 0; bit < 8 && pos < n; bit++) {
        var bestLen = 0, bestOff = 0;
        if (pos + 2 < n) {
          var key = src[pos] + "," + src[pos + 1] + "," + src[pos + 2];
          var cands = head[key];
          if (cands) {
            for (var c = cands.length - 1; c >= 0 && cands.length - c <= 48; c--) {
              var off = pos - cands[c];
              if (off <= 0 || off > 4095) break;
              var len = 0, max = Math.min(18, n - pos);
              while (len < max && src[cands[c] + len] === src[pos + len]) len++;
              if (len > bestLen) { bestLen = len; bestOff = off; if (len === 18) break; }
            }
          }
        }
        if (bestLen >= 3) {
          flags |= (1 << bit);
          out.push((bestOff >>> 4) & 255, ((bestOff & 15) << 4) | (bestLen - 3));
        } else {
          bestLen = 1;
          out.push(src[pos]);
        }
        for (var k = 0; k < bestLen; k++) {
          var p = pos + k;
          if (p + 2 < n) {
            var kk = src[p] + "," + src[p + 1] + "," + src[p + 2];
            (head[kk] || (head[kk] = [])).push(p);
          }
        }
        pos += bestLen;
      }
      out[flagIdx] = flags;
    }
    return out;
  }

  function lzDecompress(src) {
    var out = [], i = 0, n = src.length;
    while (i < n) {
      var flags = src[i++];
      for (var bit = 0; bit < 8 && i < n; bit++) {
        if (flags & (1 << bit)) {
          if (i + 1 >= n) return null;
          var a = src[i++], b = src[i++];
          var off = (a << 4) | (b >>> 4);
          var len = (b & 15) + 3;
          var start = out.length - off;
          if (off === 0 || start < 0) return null;
          for (var k = 0; k < len; k++) out.push(out[start + k]);
        } else {
          out.push(src[i++]);
        }
      }
    }
    return out;
  }

  /* ── 문자열 ↔ 바이트 ───────────────────────────────────────────── */
  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return Array.prototype.slice.call(new TextEncoder().encode(str));
    var esc = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < esc.length; i++) out.push(esc.charCodeAt(i));
    return out;
  }
  function unutf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(new Uint8Array(bytes));
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /* ── 상태 인코딩 ───────────────────────────────────────────────────
   * 선두 1바이트가 포맷: 0 = 원본, 1 = LZSS. 압축이 이득일 때만 1을 쓴다.
   * (짧은 상태는 압축하면 오히려 길어지므로 자동 선택) */
  function encode(obj) {
    var raw = utf8(JSON.stringify(obj));
    var lz = lzCompress(raw);
    var body = lz.length < raw.length ? [1].concat(lz) : [0].concat(raw);
    return b64encode(body);
  }

  function decode(str, validate) {
    try {
      if (!str) return null;
      var bytes = b64decode(str);
      if (!bytes || !bytes.length) return null;
      var fmt = bytes[0], body = bytes.slice(1);
      if (fmt === 1) { body = lzDecompress(body); if (!body) return null; }
      else if (fmt !== 0) return null;
      var obj = JSON.parse(unutf8(body));
      if (typeof validate === "function" && !validate(obj)) return null;
      return obj;
    } catch (e) { return null; }
  }

  /* 인코딩된 상태의 크기 판정. warn=카톡에서 잘릴 수 있음, block=만들지 말 것 */
  function sizeInfo(encoded) {
    var bytes = encoded ? encoded.length : 0;   // base64url = 1문자 1바이트
    return { bytes: bytes, warn: bytes > LIMIT_WARN, block: bytes > LIMIT_BLOCK, limitWarn: LIMIT_WARN, limitBlock: LIMIT_BLOCK };
  }

  /* ── URL 상태 ────────────────────────────────────────────────────── */
  function param() {
    var q = new URLSearchParams(root.location.search);
    return q.get("d") || q.get("r") || "";     // r = 기존 앱 호환
  }
  function readState(validate) { return decode(param(), validate); }

  /* 뒤로가기 히스토리를 더럽히지 않도록 replaceState 사용 */
  function writeState(obj) {
    var enc = typeof obj === "string" ? obj : encode(obj);
    try { root.history.replaceState(null, "", root.location.pathname + "?d=" + enc); } catch (e) {}
    return enc;
  }
  function clearState() {
    try { root.history.replaceState(null, "", root.location.pathname); } catch (e) {}
  }
  function link(obj) {
    return root.location.origin + root.location.pathname + "?d=" + (typeof obj === "string" ? obj : encode(obj));
  }

  /* ── 체인(A→B→C…) ──────────────────────────────────────────────── */
  function appendChain(list, entry, maxItems) {
    var arr = Array.isArray(list) ? list.slice() : [];
    var cap = maxItems || 20;
    if (arr.length >= cap) return { ok: false, list: arr, reason: "full", max: cap };
    arr.push(entry);
    var info = sizeInfo(encode(arr));
    if (info.block) return { ok: false, list: Array.isArray(list) ? list : [], reason: "size", size: info };
    return { ok: true, list: arr, size: info };
  }

  /* 닉네임: 최대 12자, 제어문자·꺾쇠 제거. 실명·연락처를 넣지 말라는 안내는 앱 UI 몫 */
  function nick(s, fallback) {
    var v = String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
    return v || (fallback || "익명");
  }

  /* ── KST 일일 시드 ────────────────────────────────────────────────
   * 서버 없이 "매일 같은 정답"을 만들기 위한 결정론적 시드. 기준은 Asia/Seoul. */
  function kstKey(date) {
    var d = date ? new Date(date) : new Date();
    var kst = new Date(d.getTime() + 9 * 3600 * 1000);   // UTC+9 고정(한국은 서머타임 없음)
    return kst.getUTCFullYear() * 10000 + (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
  }
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function dailySeed(date, salt) { return hashStr(kstKey(date) + "|" + (salt || "")); }
  function prng(seed) {                                   // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* KST 다음 자정까지 남은 ms */
  function msToKstMidnight(now) {
    var d = now ? new Date(now) : new Date();
    var kst = new Date(d.getTime() + 9 * 3600 * 1000);
    var next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1);
    return next - kst.getTime();
  }

  /* ── 이모지 격자(데일리 게임 공유용) ──────────────────────────────
   * rows: [[2,1,0,...]] — 2=정확(🟩) 1=근접(🟨) 0=없음(⬜) */
  function emojiGrid(rows, header, marks) {
    var m = marks || ["⬜", "🟨", "🟩"];
    var body = (rows || []).map(function (r) {
      return r.map(function (v) { return m[v] || m[0]; }).join("");
    }).join("\n");
    return header ? header + "\n" + body : body;
  }

  /* ── 토스트 ───────────────────────────────────────────────────── */
  var toastEl = null;
  function toast(msg) {
    var doc = root.document;
    if (!doc) return;
    if (!toastEl || !toastEl.isConnected) {
      toastEl = doc.getElementById("sk-toast");
      if (!toastEl) {
        toastEl = doc.createElement("div");
        toastEl.id = "sk-toast";
        toastEl.setAttribute("role", "status");
        toastEl.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(14px);" +
          "background:#111;color:#fff;border:1px solid #333;padding:11px 18px;border-radius:999px;font-size:14px;" +
          "font-weight:600;z-index:9999;opacity:0;transition:.2s;pointer-events:none;max-width:88vw;text-align:center";
        doc.body.appendChild(toastEl);
      }
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    toastEl.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(-50%) translateY(14px)";
    }, 1900);
  }

  function copy(text, okMsg) {
    var p;
    try { p = root.navigator.clipboard.writeText(text); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(
      function () { toast(okMsg || "복사했어요"); return true; },
      function () { toast("복사에 실패했어요. 길게 눌러 복사해 주세요"); return false; }
    );
  }

  /* ── 공유 ─────────────────────────────────────────────────────────
   * opts: { title, text, url, file }  file = 결과 카드 PNG(Blob) — 지원 기기에서만 */
  function share(opts) {
    var o = opts || {};
    var nav = root.navigator;
    var data = { title: o.title, text: o.text, url: o.url };
    if (o.file && nav && nav.canShare) {
      var withFile = { title: o.title, text: o.text, files: [o.file] };
      try { if (nav.canShare(withFile)) data = withFile; } catch (e) {}
    }
    if (nav && nav.share) {
      return nav.share(data).then(function () { return true; }, function () { return false; });
    }
    return copy((o.text ? o.text + "\n" : "") + (o.url || ""), "공유 텍스트를 복사했어요");
  }

  function shareX(text, url) {
    var u = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text || "") + "&url=" + encodeURIComponent(url || "");
    root.open(u, "_blank", "noopener");
  }

  /* ── 공유바 마운트 ────────────────────────────────────────────────
   * mountShareBar(el, { url(), text(), title, onSave, buttons })
   * buttons 기본값: ["link","text","x","share","save"] */
  function mountShareBar(el, opts) {
    var doc = root.document;
    if (!el || !doc) return;
    var o = opts || {};
    var want = o.buttons || ["link", "text", "x", "share", "save"];
    var defs = {
      link: { label: "🔗 링크 복사", act: function () { copy(o.url(), "링크를 복사했어요. 카톡·인스타에 붙여넣으세요"); } },
      text: { label: "📋 텍스트 복사", act: function () { copy(o.text(), "커뮤니티용 텍스트를 복사했어요"); } },
      x: { label: "𝕏 공유", act: function () { shareX(o.text(), o.url()); } },
      share: { label: "📤 공유하기", act: function () { share({ title: o.title, text: o.text(), url: o.url() }); } },
      save: { label: "🖼️ 이미지 저장", act: function () { if (o.onSave) o.onSave(); } }
    };
    el.innerHTML = "";
    want.forEach(function (k) {
      var d = defs[k];
      if (!d || (k === "save" && !o.onSave)) return;
      var b = doc.createElement("button");
      b.type = "button";
      b.className = "sk-share-btn";
      b.textContent = d.label;
      b.addEventListener("click", d.act);
      el.appendChild(b);
    });
  }

  /* ── 결과 카드(canvas) ────────────────────────────────────────────
   * 정적 스택에는 결과별 동적 OG 이미지가 없다. 대신 사용자가 저장·업로드하는
   * 캔버스 카드를 제공한다. 프리셋: square 1080×1080 / story 1080×1920 / feed 1080×1350 */
  var PRESETS = { square: [1080, 1080], story: [1080, 1920], feed: [1080, 1350] };

  function card(preset, draw) {
    var doc = root.document;
    var size = PRESETS[preset] || PRESETS.feed;
    var cv = doc.createElement("canvas");
    cv.width = size[0]; cv.height = size[1];
    var x = cv.getContext("2d");
    x.textBaseline = "alphabetic";
    draw(x, cv.width, cv.height);
    return cv;
  }

  /* 하단 워터마크(도메인). 모든 공유 카드에 필수 */
  function watermark(x, w, h, path, color) {
    x.save();
    x.fillStyle = color || "rgba(255,255,255,.62)";
    x.font = "600 " + Math.round(w / 38) + "px sans-serif";
    x.textAlign = "left";
    x.fillText("tomatoeggcat.com" + (path ? "/" + String(path).replace(/^\//, "") : ""), Math.round(w / 12), h - Math.round(w / 20));
    x.restore();
  }

  /* 글자 단위 줄바꿈(한글은 공백 기준 줄바꿈이 잘 맞지 않는다). 반환: 마지막 줄의 y */
  function wrapText(x, text, px, py, maxw, lh, maxLines) {
    var chars = String(text == null ? "" : text).split("");
    var line = "", yy = py, lines = 1;
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (x.measureText(test).width > maxw && line) {
        if (maxLines && lines >= maxLines) {
          while (line && x.measureText(line + "…").width > maxw) line = line.slice(0, -1);
          x.fillText(line + "…", px, yy);
          return yy;
        }
        x.fillText(line, px, yy); line = chars[i]; yy += lh; lines++;
      } else line = test;
    }
    x.fillText(line, px, yy);
    return yy;
  }

  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  function download(canvas, filename) {
    try {
      var a = root.document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = (filename || "tomatoeggcat") + ".png";
      a.click();
      toast("이미지를 저장했어요");
      return true;
    } catch (e) { toast("이미지 저장에 실패했어요"); return false; }
  }

  /* 캔버스 → Blob (navigator.share files 용). 미지원 시 null */
  function toBlob(canvas) {
    return new Promise(function (res) {
      try { canvas.toBlob(function (b) { res(b || null); }, "image/png"); }
      catch (e) { res(null); }
    });
  }

  var SK = {
    /* 상태 */
    encode: encode, decode: decode, sizeInfo: sizeInfo,
    param: param, readState: readState, writeState: writeState, clearState: clearState, link: link,
    appendChain: appendChain, nick: nick,
    /* 시드 */
    kstKey: kstKey, dailySeed: dailySeed, prng: prng, hash: hashStr, msToKstMidnight: msToKstMidnight,
    /* 공유 */
    toast: toast, copy: copy, share: share, shareX: shareX, mountShareBar: mountShareBar, emojiGrid: emojiGrid,
    /* 카드 */
    card: card, watermark: watermark, wrapText: wrapText, roundRect: roundRect, download: download, toBlob: toBlob,
    presets: PRESETS,
    /* 내부(테스트용) */
    _lz: { compress: lzCompress, decompress: lzDecompress }, _b64: { encode: b64encode, decode: b64decode },
    LIMIT_WARN: LIMIT_WARN, LIMIT_BLOCK: LIMIT_BLOCK,
    version: 1
  };

  root.SK = SK;
  if (typeof module !== "undefined" && module.exports) module.exports = SK;
})(typeof globalThis !== "undefined" ? globalThis : this);
