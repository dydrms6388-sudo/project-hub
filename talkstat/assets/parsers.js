/*!
 * talkstat — 카카오톡 내보내기(txt/csv) 파서 3종
 * 브라우저(<script>/Worker importScripts)와 Node(require) 겸용 UMD 모듈.
 * 지원 포맷:
 *   (a) android : "2026년 8월 19일 오후 3:12, 이름 : 내용" + 날짜 구분줄 "2026년 8월 19일 수요일"
 *   (b) ios     : "2026. 8. 19. 오후 3:12, 이름 : 내용"
 *   (c) pc      : "[이름] [오후 3:12] 내용" + "--------------- 2026년 8월 19일 수요일 ---------------"
 *   (d) pc-csv  : "Date,User,Message" 헤더 + "2026-08-19 15:12:34,이름,내용" (따옴표/줄바꿈 포함 CSV)
 * 모든 처리는 메모리 내 문자열만 사용. 네트워크 호출 없음.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.TalkParsers = factory(); }
}(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var RE = {
    androidMsg: /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+)$/,
    iosMsg: /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+)$/,
    dateSep: /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일$/,
    pcDateSep: /^-{3,}\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일\s*-{3,}$/,
    pcMsg: /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ([\s\S]*)$/,
    csvDate: /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    header: /(님과(의)? 카카오톡 대화$|카카오톡 대화$|^저장한 날짜\s*[:：])/
  };

  // 시스템 이벤트(입장/퇴장 등) — 발신자 없는 안내줄
  var SYSTEM_EVENTS = [
    { re: /님이 들어왔습니다\.?$/, kind: 'join' },
    { re: /님이 나갔습니다\.?$/, kind: 'leave' },
    { re: /님을 초대했습니다\.?$/, kind: 'invite' },
    { re: /님을 내보냈습니다\.?$/, kind: 'kick' },
    { re: /^채팅방 관리자가 .+$/, kind: 'admin' },
    { re: /채팅방 이름을 .+(으)?로 변경했습니다\.?$/, kind: 'rename' }
  ];

  function systemKind(line) {
    var t = String(line).trim();
    if (!t) { return null; }
    for (var i = 0; i < SYSTEM_EVENTS.length; i++) {
      if (SYSTEM_EVENTS[i].re.test(t)) { return SYSTEM_EVENTS[i].kind; }
    }
    return null;
  }

  // 메시지 본문 유형 분류 (사진/동영상/이모티콘/삭제 등)
  function classifyContent(text) {
    var t = String(text).trim();
    if (t === '사진' || /^사진 \d+장$/.test(t)) { return 'photo'; }
    if (t === '동영상') { return 'video'; }
    if (t === '이모티콘') { return 'emoticon'; }
    if (t === '삭제된 메시지입니다.' || t === '삭제된 메시지입니다') { return 'deleted'; }
    if (/^파일:\s?/.test(t)) { return 'file'; }
    if (t === '음성메시지') { return 'voice'; }
    return 'text';
  }

  function to24(ampm, h) {
    h = Number(h);
    if (ampm === '오전') { return h === 12 ? 0 : h; }
    return h === 12 ? 12 : h + 12;
  }

  function makeMsg(y, mo, d, h, mi, sender, text) {
    return {
      t: new Date(y, mo - 1, d, h, mi).getTime(),
      y: y, mo: mo, d: d, h: h, mi: mi,
      dow: new Date(y, mo - 1, d).getDay(), // 0=일
      sender: sender,
      text: text,
      type: classifyContent(text)
    };
  }

  function splitSender(rest) {
    var idx = rest.indexOf(' : ');
    if (idx <= 0) { return null; }
    return { sender: rest.slice(0, idx).trim(), text: rest.slice(idx + 3) };
  }

  function normalizeLines(text) {
    return String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  }

  function finalize(messages, systemEvents, format) {
    var participants = [];
    var seen = {};
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      m.text = m.text.replace(/\s+$/, '');
      m.type = classifyContent(m.text); // 멀티라인 병합 후 최종 본문 기준으로 재분류
      if (!seen[m.sender]) { seen[m.sender] = true; participants.push(m.sender); }
    }
    return { format: format, messages: messages, systemEvents: systemEvents, participants: participants };
  }

  function pushSystem(list, y, mo, d, h, mi, text, kind) {
    list.push({
      t: new Date(y, mo - 1, d, h, mi).getTime(),
      text: String(text).trim(),
      kind: kind
    });
  }

  // ── (a) Android txt ────────────────────────────────────────────────
  function parseAndroid(text) {
    var lines = normalizeLines(text);
    var messages = [], systemEvents = [], last = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = RE.androidMsg.exec(line);
      if (m) {
        var y = +m[1], mo = +m[2], d = +m[3], h = to24(m[4], m[5]), mi = +m[6], rest = m[7];
        var kind = systemKind(rest);
        var sm = kind ? null : splitSender(rest);
        if (sm) {
          last = makeMsg(y, mo, d, h, mi, sm.sender, sm.text);
          messages.push(last);
        } else {
          pushSystem(systemEvents, y, mo, d, h, mi, rest, kind || 'other');
          last = null;
        }
        continue;
      }
      if (RE.dateSep.test(line.trim())) { last = null; continue; }
      if (RE.header.test(line.trim()) && messages.length === 0) { continue; }
      if (line.trim() === '' && !last) { continue; }
      if (last) { last.text += '\n' + line; } // 멀티라인 병합
    }
    return finalize(messages, systemEvents, 'android');
  }

  // ── (b) iOS txt ────────────────────────────────────────────────────
  function parseIos(text) {
    var lines = normalizeLines(text);
    var messages = [], systemEvents = [], last = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = RE.iosMsg.exec(line);
      if (m) {
        var y = +m[1], mo = +m[2], d = +m[3], h = to24(m[4], m[5]), mi = +m[6], rest = m[7];
        var kind = systemKind(rest);
        var sm = kind ? null : splitSender(rest);
        if (sm) {
          last = makeMsg(y, mo, d, h, mi, sm.sender, sm.text);
          messages.push(last);
        } else {
          pushSystem(systemEvents, y, mo, d, h, mi, rest, kind || 'other');
          last = null;
        }
        continue;
      }
      if (RE.dateSep.test(line.trim())) { last = null; continue; }
      if (RE.header.test(line.trim()) && messages.length === 0) { continue; }
      if (line.trim() === '' && !last) { continue; }
      if (last) { last.text += '\n' + line; }
    }
    return finalize(messages, systemEvents, 'ios');
  }

  // ── (c) PC txt ─────────────────────────────────────────────────────
  function parsePcTxt(text) {
    var lines = normalizeLines(text);
    var messages = [], systemEvents = [], last = null, cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var ds = RE.pcDateSep.exec(line.trim());
      if (ds) { cur = { y: +ds[1], mo: +ds[2], d: +ds[3] }; last = null; continue; }
      var m = RE.pcMsg.exec(line);
      if (m && cur) {
        last = makeMsg(cur.y, cur.mo, cur.d, to24(m[2], m[3]), +m[4], m[1].trim(), m[5]);
        messages.push(last);
        continue;
      }
      var kind = systemKind(line);
      if (kind && cur) {
        // PC 포맷 시스템 줄은 시각이 없으므로 직전 메시지 시각(없으면 당일 0시)을 사용
        var ref = last || { h: 0, mi: 0 };
        pushSystem(systemEvents, cur.y, cur.mo, cur.d, ref.h, ref.mi, line, kind);
        last = null;
        continue;
      }
      if (RE.header.test(line.trim()) && messages.length === 0) { continue; }
      if (line.trim() === '' && !last) { continue; }
      if (last) { last.text += '\n' + line; }
    }
    return finalize(messages, systemEvents, 'pc');
  }

  // ── (d) PC csv ─────────────────────────────────────────────────────
  function parseCsvRows(text) {
    var s = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else { inQ = false; }
        } else { field += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function parsePcCsv(text) {
    var rows = parseCsvRows(text);
    var messages = [], systemEvents = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.length < 3) { continue; }
      var dm = RE.csvDate.exec(String(r[0]).trim());
      if (!dm) { continue; } // 헤더(Date,User,Message)나 잡음 줄
      var y = +dm[1], mo = +dm[2], d = +dm[3], h = +dm[4], mi = +dm[5];
      var sender = String(r[1]).trim();
      var body = r.slice(2).join(','); // 본문 내 콤마가 따옴표 없이 들어온 경우 복원
      var kind = systemKind(body);
      if (!sender || kind) {
        pushSystem(systemEvents, y, mo, d, h, mi, body, kind || 'other');
        continue;
      }
      messages.push(makeMsg(y, mo, d, h, mi, sender, body));
    }
    return finalize(messages, systemEvents, 'pc-csv');
  }

  // ── 포맷 자동 감지 ─────────────────────────────────────────────────
  function detectFormat(text) {
    var lines = normalizeLines(text);
    var score = { android: 0, ios: 0, pc: 0, 'pc-csv': 0 };
    var checked = 0;
    for (var i = 0; i < lines.length && checked < 120; i++) {
      var line = lines[i];
      if (!line.trim()) { continue; }
      checked++;
      if (RE.androidMsg.test(line)) { score.android += 2; }
      if (RE.iosMsg.test(line)) { score.ios += 2; }
      if (RE.pcMsg.test(line)) { score.pc += 2; }
      if (RE.pcDateSep.test(line.trim())) { score.pc += 1; }
      var firstField = line.split(',')[0];
      if (RE.csvDate.test(String(firstField).trim())) { score['pc-csv'] += 2; }
      if (/^"?Date"?,"?User"?,"?Message"?/i.test(line)) { score['pc-csv'] += 4; }
    }
    var best = null, bestScore = 0;
    for (var k in score) {
      if (score[k] > bestScore) { best = k; bestScore = score[k]; }
    }
    return best; // 없으면 null
  }

  function parse(text, format) {
    var fmt = format || detectFormat(text);
    if (fmt === 'android') { return parseAndroid(text); }
    if (fmt === 'ios') { return parseIos(text); }
    if (fmt === 'pc') { return parsePcTxt(text); }
    if (fmt === 'pc-csv') { return parsePcCsv(text); }
    var err = new Error('지원하지 않는 형식이거나 카카오톡 내보내기 파일이 아닙니다.');
    err.code = 'UNKNOWN_FORMAT';
    throw err;
  }

  return {
    parse: parse,
    detectFormat: detectFormat,
    parseAndroid: parseAndroid,
    parseIos: parseIos,
    parsePcTxt: parsePcTxt,
    parsePcCsv: parsePcCsv,
    classifyContent: classifyContent,
    _to24: to24,
    _parseCsvRows: parseCsvRows
  };
}));
