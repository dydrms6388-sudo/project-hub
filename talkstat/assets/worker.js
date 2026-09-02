/*!
 * talkstat — 분석 Web Worker
 * 메인 스레드에서 받은 원문 텍스트를 파싱·분석해 결과만 돌려준다.
 * 네트워크 요청 없음 — 원문은 이 워커 밖으로 나가지 않는다.
 */
/* global importScripts, TalkParsers, TalkAnalyzer */
importScripts('parsers.js', 'analyzer.js');

self.onmessage = function (e) {
  var d = e.data || {};
  try {
    var parsed = TalkParsers.parse(d.text, d.format || undefined);
    if (!parsed.messages.length) {
      self.postMessage({ ok: false, error: '메시지를 찾지 못했습니다. 카카오톡 "대화 내보내기" 파일(txt/csv)이 맞는지 확인해 주세요.' });
      return;
    }
    var result = TalkAnalyzer.analyze(parsed, d.opts || {});
    self.postMessage({
      ok: true,
      format: parsed.format,
      participants: parsed.participants,
      result: result
    });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
