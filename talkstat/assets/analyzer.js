/*!
 * talkstat — 대화 통계 분석 엔진 (브라우저 Worker + Node 겸용 UMD)
 * 입력: TalkParsers.parse() 결과. 출력: 순수 데이터 객체(구조 복제 가능).
 * 네트워크 호출 없음 — 모든 계산은 메모리 내에서만 수행.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.TalkAnalyzer = factory(); }
}(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var STOPWORDS = {};
  [
    // 대명사·지시어
    '나', '너', '저', '우리', '내', '네', '니', '제', '그', '이', '걔', '얘', '쟤',
    '이거', '그거', '저거', '이건', '그건', '저건', '이게', '그게', '저게', '이런', '그런', '저런',
    '여기', '거기', '저기', '어디', '누구', '뭐', '뭔가', '뭐지', '뭐야', '무슨', '어떤',
    '내가', '네가', '니가', '나도', '너도', '나는', '너는', '나만', '너만', '우리가', '우리는',
    // 접속·부사
    '그리고', '그래서', '근데', '그런데', '하지만', '그러면', '그럼', '그니까', '그러니까',
    '그냥', '진짜', '정말', '너무', '완전', '되게', '엄청', '약간', '조금', '좀', '많이',
    '이제', '지금', '아까', '나중에', '먼저', '다시', '또', '계속', '바로', '아직', '벌써',
    '오늘', '내일', '어제', '모레', '이번', '저번', '다음', '매일', '맨날',
    '여기서', '거기서', '어떻게', '왜', '언제', '얼마나', '이렇게', '그렇게', '저렇게',
    '되면', '하면', '해서', '했는데', '하는데', '하고', '해도', '한다', '하니까',
    // 감탄·응답
    '응', '웅', '엉', '어', '아', '오', '와', '음', '흠', '헐', '헉', '와우', '오오',
    '네', '넹', '넵', '예', '아니', '아냐', '아니야', '아니요', '맞아', '맞다', '그래', '그렇지',
    '진짜로', '정말로', '설마', '혹시', '아마', '역시',
    // 조사 붙은 흔한 형태·기타
    '있는', '없는', '있어', '없어', '있다', '없다', '같은', '같아', '같이', '거의', '모든',
    '하나', '한번', '일단', '근까', '암튼', '아무튼', '어차피', '제일', '가장', '별로',
    '뭐라', '뭐냐', '뭐임', '아무', '다들', '요즘', '오늘은', '내일은',
    // 영어 흔한 단어
    'the', 'a', 'an', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'is', 'it', 'i',
    'you', 'me', 'my', 'we', 'so', 'ok', 'okay', 'yes', 'no', 'not', 'do', 'be'
  ].forEach(function (w) { STOPWORDS[w] = true; });

  var URL_RE = /https?:\/\/\S+|www\.\S+/g;
  var TOKEN_RE = /[가-힣]+|[a-zA-Z]+|[ㄱ-ㅎㅏ-ㅣ]+/g;
  var EMOJI_RE = null;
  try { EMOJI_RE = new RegExp('\\p{Extended_Pictographic}(\\uFE0F)?', 'gu'); } catch (e) { EMOJI_RE = null; }

  var DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

  function newUser(name) {
    return {
      name: name,
      messages: 0, chars: 0, photos: 0, videos: 0, emoticons: 0,
      files: 0, deleted: 0, voice: 0, texts: 0,
      laughK: 0, laughH: 0, emojis: 0, emojiMap: {},
      replyGaps: [], initiations: 0, wordMap: {}
    };
  }

  function median(arr) {
    if (!arr.length) { return null; }
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function avg(arr) {
    if (!arr.length) { return null; }
    var sum = 0;
    for (var i = 0; i < arr.length; i++) { sum += arr[i]; }
    return sum / arr.length;
  }

  function topEntries(map, n) {
    return Object.keys(map)
      .map(function (k) { return { key: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); })
      .slice(0, n);
  }

  function monthKey(m) {
    return m.y + '-' + (m.mo < 10 ? '0' + m.mo : m.mo);
  }

  /**
   * analyze(parsed, opts)
   * opts.replyCapMs  발신자 전환 간격을 '답장'으로 인정하는 상한 (기본 8시간)
   * opts.initGapMs   이 시간 이상 침묵 후 첫 메시지 = '먼저 말 걸기' (기본 8시간)
   */
  function analyze(parsed, opts) {
    opts = opts || {};
    var REPLY_CAP = opts.replyCapMs || 8 * 3600 * 1000;
    var INIT_GAP = opts.initGapMs || 8 * 3600 * 1000;
    var msgs = parsed.messages;

    var users = {};
    var order = [];
    var heatmap = [];
    for (var dw = 0; dw < 7; dw++) { heatmap.push(new Array(24).fill(0)); }
    var hourly = new Array(24).fill(0);
    var monthly = {};      // 'YYYY-MM' -> { total, perUser: {} }
    var wordMap = {};      // 전체 단어 빈도 (불용어·ㅋㅋ/ㅎㅎ 제외)
    var emojiMap = {};     // 전체 이모지 빈도
    var laughK = 0, laughH = 0;
    var longest = null;    // 가장 긴 침묵
    var prev = null;
    var days = {};         // 활동한 날짜 수

    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      var u = users[m.sender];
      if (!u) { u = users[m.sender] = newUser(m.sender); order.push(m.sender); }

      u.messages++;
      if (m.type === 'photo') { u.photos++; }
      else if (m.type === 'video') { u.videos++; }
      else if (m.type === 'emoticon') { u.emoticons++; }
      else if (m.type === 'file') { u.files++; }
      else if (m.type === 'deleted') { u.deleted++; }
      else if (m.type === 'voice') { u.voice++; }
      else {
        u.texts++;
        u.chars += m.text.replace(/\s/g, '').length;
      }

      heatmap[m.dow][m.h]++;
      hourly[m.h]++;
      days[m.y + '-' + m.mo + '-' + m.d] = true;

      var mk = monthKey(m);
      var mo = monthly[mk];
      if (!mo) { mo = monthly[mk] = { total: 0, perUser: {} }; }
      mo.total++;
      mo.perUser[m.sender] = (mo.perUser[m.sender] || 0) + 1;

      if (prev) {
        var gap = m.t - prev.t;
        if (gap > 0 && (!longest || gap > longest.gap)) {
          longest = { gap: gap, fromT: prev.t, toT: m.t, endedBy: m.sender };
        }
        if (gap >= INIT_GAP) { u.initiations++; }
        else if (m.sender !== prev.sender && gap >= 0 && gap <= REPLY_CAP) {
          u.replyGaps.push(gap);
        }
      } else {
        u.initiations++;
      }
      prev = m;

      // 단어·웃음·이모지 (텍스트 메시지만)
      if (m.type === 'text') {
        var clean = m.text.replace(URL_RE, ' ');
        if (EMOJI_RE) {
          var em;
          EMOJI_RE.lastIndex = 0;
          while ((em = EMOJI_RE.exec(clean)) !== null) {
            var ch = em[0].replace(/\uFE0F/g, '');
            if (!ch) { continue; }
            emojiMap[ch] = (emojiMap[ch] || 0) + 1;
            u.emojis++;
            u.emojiMap[ch] = (u.emojiMap[ch] || 0) + 1;
          }
        }
        var toks = clean.match(TOKEN_RE) || [];
        for (var ti = 0; ti < toks.length; ti++) {
          var tk = toks[ti];
          if (/^ㅋ+$/.test(tk)) { laughK += 1; u.laughK += 1; continue; }
          if (/^ㅎ+$/.test(tk)) { laughH += 1; u.laughH += 1; continue; }
          var low = tk.toLowerCase();
          if (low.length < 2 || STOPWORDS[low]) { continue; }
          wordMap[low] = (wordMap[low] || 0) + 1;
          u.wordMap[low] = (u.wordMap[low] || 0) + 1;
        }
      }
    }

    // ── 요약 지표 ──
    var totalMsgs = msgs.length;
    var totalInit = 0;
    order.forEach(function (n) { totalInit += users[n].initiations; });

    var perUser = order.map(function (n) {
      var u = users[n];
      return {
        name: n,
        messages: u.messages,
        share: totalMsgs ? u.messages / totalMsgs : 0,
        chars: u.chars,
        texts: u.texts,
        photos: u.photos,
        videos: u.videos,
        emoticons: u.emoticons,
        files: u.files,
        deleted: u.deleted,
        voice: u.voice,
        laughK: u.laughK,
        laughH: u.laughH,
        emojis: u.emojis,
        avgReplyMs: avg(u.replyGaps),
        medianReplyMs: median(u.replyGaps),
        replyCount: u.replyGaps.length,
        initiations: u.initiations,
        initShare: totalInit ? u.initiations / totalInit : 0,
        topWords: topEntries(u.wordMap, 10),
        topEmojis: topEntries(u.emojiMap, 5)
      };
    });

    // 골든타임: 메시지가 가장 몰린 시간대 + 요일×시간 셀
    var goldenHour = 0;
    for (var h = 1; h < 24; h++) { if (hourly[h] > hourly[goldenHour]) { goldenHour = h; } }
    var goldenCell = { dow: 0, hour: 0, count: 0 };
    for (var d2 = 0; d2 < 7; d2++) {
      for (var h2 = 0; h2 < 24; h2++) {
        if (heatmap[d2][h2] > goldenCell.count) {
          goldenCell = { dow: d2, hour: h2, count: heatmap[d2][h2] };
        }
      }
    }

    var monthKeys = Object.keys(monthly).sort();

    return {
      totals: {
        messages: totalMsgs,
        participants: order.length,
        days: Object.keys(days).length,
        firstT: msgs.length ? msgs[0].t : null,
        lastT: msgs.length ? msgs[msgs.length - 1].t : null,
        laughK: laughK,
        laughH: laughH,
        systemEvents: parsed.systemEvents.length
      },
      perUser: perUser,
      heatmap: heatmap,          // [dow 0=일][hour]
      hourly: hourly,
      monthly: monthKeys.map(function (k) { return { month: k, total: monthly[k].total, perUser: monthly[k].perUser }; }),
      longestSilence: longest,   // {gap, fromT, toT, endedBy} | null
      goldenHour: { hour: goldenHour, count: hourly[goldenHour] || 0 },
      goldenCell: goldenCell,
      goldenCellLabel: DOW_KO[goldenCell.dow] + '요일 ' + goldenCell.hour + '시',
      topWords: topEntries(wordMap, 40),
      topEmojis: topEntries(emojiMap, 20),
      params: { replyCapMs: REPLY_CAP, initGapMs: INIT_GAP }
    };
  }

  function formatDuration(ms) {
    if (ms == null) { return '—'; }
    if (ms < 1000) { return '1초 미만'; }
    var s = Math.round(ms / 1000);
    if (s < 60) { return s + '초'; }
    var m = Math.floor(s / 60);
    if (m < 60) { return m + '분 ' + (s % 60 ? s % 60 + '초' : '').trim(); }
    var h = Math.floor(m / 60);
    if (h < 24) { return h + '시간 ' + (m % 60 ? m % 60 + '분' : '').trim(); }
    var d = Math.floor(h / 24);
    return d + '일 ' + (h % 24 ? h % 24 + '시간' : '').trim();
  }

  return {
    analyze: analyze,
    formatDuration: formatDuration,
    STOPWORDS: STOPWORDS,
    DOW_KO: DOW_KO
  };
}));
