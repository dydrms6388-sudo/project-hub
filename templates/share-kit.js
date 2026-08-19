/* ────────────────────────────────────────────────────────────────────────────
   share-kit v1 — TomatoEggCat 공유·바이럴 엔진 (자기완결 · 외부 의존 0)

   사용법: 각 앱의 <script> 최상단에 이 파일 내용을 **그대로 붙여넣는다**.
   (앱은 단일 파일 완결형이어야 하고, 나중에 앱별 도메인으로 떼어내도
    이 엔진이 함께 따라가야 하므로 공유 <script src>를 쓰지 않는다.)

   제공 기능
   - 상태 URL 인코딩: SK.enc / SK.dec  (UTF-8 안전 base64url + 선택적 LZW 압축)
   - URL 상태 훅:     SK.readState / SK.writeState / SK.clearState / SK.stateUrl
   - 용량 가드:       SK.sizeOf (8KB 경고 / 12KB 차단)
   - 체인:            SK.appendChain
   - 비트맵:          SK.bitsToStr / SK.strToBits  (밸런스·시간표처럼 0/1 대량 상태용)
   - 결정론 난수:     SK.kstYMD / SK.dailySeed / SK.prng / SK.pick / SK.shuffle
   - 이모지 격자:     SK.emojiGrid
   - 공유 UI:         SK.copy / SK.toast / SK.share / SK.xUrl
   - 결과 카드:       SK.card / SK.wrapText / SK.roundRect / SK.savePng / SK.sharePng
   - 유틸:            SK.esc / SK.nick (닉네임 12자 정제) / SK.countdownToKstMidnight

   상태 스키마 규칙: 객체 키 반복은 URL 낭비 → **배열 튜플**로 쓴다.
     좋음  {v:1,a:["민수",[3,1,4,...]]}
     나쁨  {version:1,me:{nickname:"민수",answers:[...]}}
   ──────────────────────────────────────────────────────────────────────────── */
var SK = (function () {
  "use strict";

  /* ── UTF-8 ↔ 바이트 ─────────────────────────────────────────── */
  function utf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var esc = unescape(encodeURIComponent(str)), out = new Uint8Array(esc.length);
    for (var i = 0; i < esc.length; i++) out[i] = esc.charCodeAt(i);
    return out;
  }
  function bytesUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /* ── base64url ──────────────────────────────────────────────── */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var B64I = (function () { var m = {}; for (var i = 0; i < 64; i++) m[B64[i]] = i; return m; })();
  function b64uEnc(bytes) {
    var out = "", i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rem = bytes.length - i;
    if (rem === 1) {
      var a = bytes[i] << 16;
      out += B64[(a >> 18) & 63] + B64[(a >> 12) & 63];
    } else if (rem === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63];
    }
    return out;
  }
  function b64uDec(str) {
    var clean = String(str).replace(/[^A-Za-z0-9\-_]/g, "");
    var full = Math.floor(clean.length / 4), rem = clean.length % 4;
    if (rem === 1) throw new Error("bad base64url length");
    var len = full * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0);
    var out = new Uint8Array(len), o = 0, i;
    for (i = 0; i + 3 < clean.length; i += 4) {
      var n = (B64I[clean[i]] << 18) | (B64I[clean[i + 1]] << 12) | (B64I[clean[i + 2]] << 6) | B64I[clean[i + 3]];
      out[o++] = (n >> 16) & 255; out[o++] = (n >> 8) & 255; out[o++] = n & 255;
    }
    if (rem === 2) {
      out[o++] = ((B64I[clean[i]] << 18) | (B64I[clean[i + 1]] << 12)) >> 16 & 255;
    } else if (rem === 3) {
      var m = (B64I[clean[i]] << 18) | (B64I[clean[i + 1]] << 12) | (B64I[clean[i + 2]] << 6);
      out[o++] = (m >> 16) & 255; out[o++] = (m >> 8) & 255;
    }
    return out;
  }

  /* ── LZW (바이트 단위, 16비트 코드) ─────────────────────────────
     한글 본문처럼 긴 텍스트를 URL에 담을 때 쓴다. 압축이 이득이 아니면
     enc()가 자동으로 무압축(prefix "1")을 고른다. ─────────────────── */
  function codeOf(dict, w) { return w.length === 1 ? w.charCodeAt(0) : dict.get(w); }
  function lzwEnc(bytes) {
    if (!bytes.length) return new Uint8Array(0);
    var dict = new Map(), next = 256, codes = [], w = String.fromCharCode(bytes[0]);
    for (var i = 1; i < bytes.length; i++) {
      var c = String.fromCharCode(bytes[i]), wc = w + c;
      if (dict.has(wc)) { w = wc; continue; }
      codes.push(codeOf(dict, w));
      if (next < 65536) dict.set(wc, next++);
      w = c;
    }
    codes.push(codeOf(dict, w));
    var out = new Uint8Array(codes.length * 2);
    for (var j = 0; j < codes.length; j++) { out[j * 2] = (codes[j] >> 8) & 255; out[j * 2 + 1] = codes[j] & 255; }
    return out;
  }
  function lzwDec(buf) {
    if (buf.length % 2 !== 0) throw new Error("bad lzw stream");
    var codes = [], i;
    for (i = 0; i < buf.length; i += 2) codes.push((buf[i] << 8) | buf[i + 1]);
    if (!codes.length) return new Uint8Array(0);
    var dict = [], next = 256;
    for (i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
    var w = dict[codes[0]];
    if (w === undefined) throw new Error("bad lzw code");
    var out = w;
    for (i = 1; i < codes.length; i++) {
      var k = codes[i], entry;
      if (k < next && dict[k] !== undefined) entry = dict[k];
      else if (k === next) entry = w + w.charAt(0);
      else throw new Error("bad lzw code");
      out += entry;
      if (next < 65536) dict[next++] = w + entry.charAt(0);
      w = entry;
    }
    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  /* ── 상태 인코딩 ─────────────────────────────────────────────
     prefix "1" = 무압축, "2" = LZW. 두 형식 모두 dec()가 읽는다. ── */
  function enc(obj) {
    var raw = utf8Bytes(JSON.stringify(obj));
    var plain = "1" + b64uEnc(raw);
    if (raw.length < 120) return plain;
    try {
      var z = "2" + b64uEnc(lzwEnc(raw));
      return z.length < plain.length ? z : plain;
    } catch (e) { return plain; }
  }
  function dec(str) {
    if (!str) return null;
    try {
      var s = String(str), tag = s.charAt(0), body = s.slice(1);
      if (tag !== "1" && tag !== "2") { tag = "1"; body = s; } // v0 링크(무접두) 하위호환
      var bytes = b64uDec(body);
      if (tag === "2") bytes = lzwDec(bytes);
      var val = JSON.parse(bytesUtf8(bytes));
      return (val && typeof val === "object") ? val : null;
    } catch (e) { return null; }
  }

  /* ── URL 상태 ────────────────────────────────────────────────── */
  var KEY = "d";
  function stateUrl(obj, key) {
    return location.origin + location.pathname + "?" + (key || KEY) + "=" + enc(obj);
  }
  function readState(key) {
    try { return dec(new URLSearchParams(location.search).get(key || KEY)); }
    catch (e) { return null; }
  }
  function writeState(obj, key) {
    try { history.replaceState(null, "", location.pathname + "?" + (key || KEY) + "=" + enc(obj)); } catch (e) {}
  }
  function clearState() {
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }
  /* 8KB 경고 / 12KB 차단. 반환 {bytes, ok, warn} */
  function sizeOf(obj) {
    var n = enc(obj).length;
    return { bytes: n, ok: n <= 12288, warn: n > 8192 };
  }
  /* 체인 추가: 최대 인원·용량 초과 시 {ok:false, reason} */
  function appendChain(list, entry, maxItems) {
    var arr = (list || []).slice();
    if (arr.length >= (maxItems || 20)) return { ok: false, reason: "max", list: arr };
    arr.push(entry);
    return { ok: true, list: arr };
  }

  /* ── 비트맵(0/1 대량 상태) ───────────────────────────────────── */
  function bitsToStr(bits) {
    var bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (var i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= (128 >> (i & 7));
    return b64uEnc(bytes);
  }
  function strToBits(str, n) {
    var bytes = b64uDec(str), bits = [];
    for (var i = 0; i < n; i++) bits.push(((bytes[i >> 3] || 0) >> (7 - (i & 7))) & 1);
    return bits;
  }

  /* ── KST 날짜 · 결정론 난수 ──────────────────────────────────── */
  var KST_MS = 9 * 3600 * 1000;
  function kstDate(d) { return new Date((d ? d.getTime() : Date.now()) + KST_MS); }
  /* KST 기준 YYYYMMDD 숫자 */
  function kstYMD(d) {
    var k = kstDate(d);
    return k.getUTCFullYear() * 10000 + (k.getUTCMonth() + 1) * 100 + k.getUTCDate();
  }
  /* 기준일(YYYYMMDD)로부터 KST 며칠째인가 — 데일리 게임 회차 번호 */
  function kstDayIndex(startYMD, d) {
    var s = String(startYMD);
    var start = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
    var k = kstDate(d);
    var cur = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
    return Math.round((cur - start) / 86400000);
  }
  function hash32(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function dailySeed(salt, d) { return hash32(kstYMD(d) + "|" + (salt || "")); }
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }
  function shuffle(rnd, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* KST 자정까지 남은 시간 {h,m,s,ms} */
  function countdownToKstMidnight(d) {
    var k = kstDate(d);
    var ms = 86400000 - (k.getUTCHours() * 3600000 + k.getUTCMinutes() * 60000 + k.getUTCSeconds() * 1000 + k.getUTCMilliseconds());
    return { ms: ms, h: Math.floor(ms / 3600000), m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 };
  }

  /* ── 이모지 격자(데일리 공유용) ───────────────────────────────── */
  function emojiGrid(rows, header) {
    var body = rows.map(function (r) { return r.join(""); }).join("\n");
    return (header ? header + "\n" : "") + body;
  }

  /* ── 문자열 유틸 ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* 닉네임: 12자 · 제어문자 제거. 개인정보(실명 강요) 금지 — 별명 안내는 UI에서. */
  function nick(s, fallback) {
    var raw = String(s == null ? "" : s), t = "";
    for (var i = 0; i < raw.length && t.length < 12; i++) {
      var cc = raw.charCodeAt(i);
      if (cc < 32 || cc === 127) continue;              // 제어문자 제거
      if ("<>&\"'\\".indexOf(raw[i]) >= 0) continue;      // HTML 위험 문자 제거
      t += raw[i];
    }
    t = t.trim();
    return t || (fallback || "익명");
  }

  /* ── 공유 UI ─────────────────────────────────────────────────── */
  function toast(msg) {
    var el = document.getElementById("sk-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sk-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(8px);z-index:99;" +
        "background:#101014;color:#f2f3f5;border:1px solid #33343c;border-radius:12px;padding:11px 16px;font-size:14px;" +
        "font-weight:600;box-shadow:0 8px 28px rgba(0,0,0,.45);opacity:0;transition:.18s;pointer-events:none;max-width:88vw;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(function () { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(8px)"; }, 1900);
  }
  function copy(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }
  function share(opts) {
    if (navigator.share) {
      return navigator.share(opts).then(function () { return true; }, function () { return false; });
    }
    return copy(opts.url || opts.text || "").then(function (ok) {
      if (ok) toast("링크를 복사했어요. 카톡·인스타에 붙여넣으세요");
      return ok;
    });
  }
  function xUrl(text, url) {
    return "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
  }

  /* ── 결과 카드(캔버스) ───────────────────────────────────────── */
  var FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
  /* preset: "story"(1080×1920) | "square"(1080×1080) | "card"(1080×1350) */
  function card(preset) {
    var size = preset === "story" ? [1080, 1920] : preset === "square" ? [1080, 1080] : [1080, 1350];
    var cv = document.createElement("canvas");
    cv.width = size[0]; cv.height = size[1];
    var ctx = cv.getContext("2d");
    ctx.textBaseline = "top";
    return { cv: cv, ctx: ctx, W: size[0], H: size[1], font: FONT };
  }
  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  /* 줄바꿈 그리기 → 마지막 y 반환 */
  function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(/(\s+)/), line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line.replace(/\s+$/, "")); line = words[i].replace(/^\s+/, ""); }
      else line = test;
    }
    if (line.trim()) lines.push(line.replace(/\s+$/, ""));
    /* 공백 없는 긴 한글 줄 대비: 글자 단위 재분할 */
    var out = [];
    for (var j = 0; j < lines.length; j++) {
      var l = lines[j];
      while (ctx.measureText(l).width > maxW && l.length > 1) {
        var cut = l.length;
        while (cut > 1 && ctx.measureText(l.slice(0, cut)).width > maxW) cut--;
        out.push(l.slice(0, cut)); l = l.slice(cut);
      }
      out.push(l);
    }
    if (maxLines && out.length > maxLines) { out = out.slice(0, maxLines); out[maxLines - 1] = out[maxLines - 1].replace(/.$/, "…"); }
    for (var k = 0; k < out.length; k++) ctx.fillText(out[k], x, y + k * lh);
    return y + out.length * lh;
  }
  /* 하단 워터마크 — 도메인/앱 경로 (예: "tomatoeggcat.com/chemi-link") */
  function watermark(ctx, W, H, label, color) {
    ctx.font = "600 26px " + FONT;
    ctx.fillStyle = color || "rgba(255,255,255,.42)";
    ctx.textAlign = "center";
    ctx.fillText(label, W / 2, H - 62);
    ctx.textAlign = "left";
  }
  function savePng(cv, filename) {
    try {
      var a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = filename || "card.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      return true;
    } catch (e) { return false; }
  }
  /* navigator.share(files) 우선 → 실패 시 PNG 다운로드 */
  function sharePng(cv, filename, title) {
    return new Promise(function (resolve) {
      if (!cv.toBlob || !navigator.canShare) { resolve(savePng(cv, filename)); return; }
      cv.toBlob(function (blob) {
        if (!blob) { resolve(savePng(cv, filename)); return; }
        try {
          var file = new File([blob], filename || "card.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: title || "" }).then(
              function () { resolve(true); },
              function () { resolve(savePng(cv, filename)); }
            );
            return;
          }
        } catch (e) {}
        resolve(savePng(cv, filename));
      }, "image/png");
    });
  }

  return {
    enc: enc, dec: dec,
    stateUrl: stateUrl, readState: readState, writeState: writeState, clearState: clearState,
    sizeOf: sizeOf, appendChain: appendChain,
    bitsToStr: bitsToStr, strToBits: strToBits,
    kstYMD: kstYMD, kstDayIndex: kstDayIndex, dailySeed: dailySeed, hash32: hash32,
    prng: prng, pick: pick, shuffle: shuffle, countdownToKstMidnight: countdownToKstMidnight,
    emojiGrid: emojiGrid, esc: esc, nick: nick,
    toast: toast, copy: copy, share: share, xUrl: xUrl,
    card: card, roundRect: roundRect, wrapText: wrapText, watermark: watermark,
    savePng: savePng, sharePng: sharePng
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SK;
