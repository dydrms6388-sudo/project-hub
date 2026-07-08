/* ===========================================================
   스터디서클 — app.js
   완전 클라이언트 사이드. 서버/백엔드 없음, localStorage만 사용.
   사용자 간 자유 텍스트 DM·채팅·사진 업로드·위치 매칭 없음.
   상호작용은 프리셋 리액션(정해진 문구) + 공개 그룹 피드로 제한.
   =========================================================== */
(function () {
  "use strict";

  var LS_KEY = "tsc_state_v1";
  var S = null;
  var MANUAL_MIN_MINUTES = 1;
  var MANUAL_MAX_MINUTES = 600; // input[type=number] 의 max 속성과 반드시 일치시켜야 함
  var GOAL_MIN_MINUTES = 10;
  var GOAL_MAX_MINUTES = 600; // input[type=number] 의 max 속성과 반드시 일치시켜야 함
  var NICK_MIN_LEN = 2;
  var NICK_MAX_LEN = 10; // 닉네임 입력의 HTML maxlength 속성과 반드시 일치시켜야 함(코드포인트 기준)

  /* ---------------- 유틸 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 문자열.length는 UTF-16 코드유닛 수를 센다. 이모지처럼 서로게이트 페어(surrogate
  // pair)로 표현되는 코드포인트 1개는 length로는 2로 잡혀, "2자 이상" 같은 조건을
  // 실제로는 1글자인 이모지 하나로 통과시킬 수 있다. Array.from(str)은 코드포인트
  // 단위로 순회하므로 사람이 실제로 인지하는 글자 수에 훨씬 가깝다.
  function codePointLength(str) { return Array.from(str || "").length; }
  // HTML maxlength 속성은 UTF-16 코드유닛 기준으로 잘라내기 때문에, 서로게이트
  // 페어로 이루어진 이모지 중간을 끊어 깨진 문자(예: 손상된 낱개 서로게이트)를
  // 남길 수 있다. 코드포인트 단위로 잘라내면 항상 온전한 문자 단위로만 잘린다.
  function truncateByCodePoints(str, max) { return Array.from(str || "").slice(0, max).join(""); }
  function fmtMin(min) {
    min = Math.round(min || 0);
    if (min < 60) return min + "분";
    var h = Math.floor(min / 60), m = min % 60;
    return h + "시간" + (m ? " " + m + "분" : "");
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function timeAgoLabel(minsAgo) {
    if (minsAgo < 60) return minsAgo + "분 전";
    var h = Math.floor(minsAgo / 60);
    if (h < 24) return h + "시간 전";
    return Math.floor(h / 24) + "일 전";
  }
  // HTML의 min/max 속성은 checkValidity()를 호출하지 않는 한 키보드/붙여넣기 입력을
  // 막지 못하므로, 사용자가 900000처럼 비정상적으로 큰(혹은 작은) 값을 입력해도
  // 그대로 통과된다. 여기서 JS 단에서 명시적으로 범위를 강제한다.
  // parseInt(raw,10)은 'e' 이후를 무시해(parseInt('1e5',10) === 1) input[type=number]가
  // 유효한 값으로 허용하는 지수 표기('1e5' === 100000)를 완전히 다른 값으로 오인했다.
  // Number()는 지수 표기·공백을 올바르게 파싱하므로, 사용자가 입력한 실제 값 기준으로
  // 범위를 검증할 수 있다.
  function parseBoundedInt(raw, min, max) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    var n = Number(s);
    if (!isFinite(n)) return null;
    n = Math.round(n);
    if (n < min || n > max) return null;
    return n;
  }
  function roomById(id) { return ROOMS.find(function (r) { return r.id === id; }); }
  // 타이머에 저장된 roomId로 실제 표시/기록에 쓸 룸을 결정한다. tm.roomId가
  // falsy일 때만 대체하던 이전 로직은, truthy이지만 ROOMS에 더 이상 존재하지
  // 않는(예: 룸 목록 개편으로 삭제된) id가 그대로 addLog()에 전달돼 S.joinedRooms에
  // 영구 고아 항목이 쌓이고 해당 로그가 어느 룸의 리더보드/피드에도 나타나지
  // 않는 문제가 있었다. renderTimer()가 쓰던 'roomById(tm.roomId) || roomById(...)
  // || ROOMS[0]' 검증 체인과 동일한 로직을 여기 한 곳으로 모아 양쪽이 항상
  // 일관되게 유효한 룸으로 귀결되도록 한다.
  function resolveTimerRoom(tm) {
    return roomById(tm.roomId) || roomById(S.joinedRooms[0]) || ROOMS[0];
  }
  function avatarSpan(emoji, grad, size, extraClass) {
    size = size || 38;
    return '<div class="avatar' + (extraClass ? " " + extraClass : "") + '" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * 0.46) + "px;background:linear-gradient(135deg," + grad[0] + "," + grad[1] + ')">' + emoji + "</div>";
  }
  function myAvatarSpan(size) {
    var grad = AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length];
    return avatarSpan(S.profile.avatarEmoji, grad, size);
  }
  function roomIconSpan(room, size) {
    return '<div class="room-ic" style="width:' + (size || 48) + "px;height:" + (size || 48) + "px;background:linear-gradient(135deg," + room.grad[0] + "," + room.grad[1] + ')">' + room.emoji + "</div>";
  }

  /* ---------------- 상태 ---------------- */
  function DEFAULTS() {
    return {
      onboarded: false,
      profile: { nickname: "", avatarEmoji: AVATAR_EMOJIS[0], gradIdx: 0, subjects: [], timeSlot: "", ageConfirmed: false, termsAgreed: false, updatedAt: 0 },
      joinedRooms: [],
      logs: [],
      goals: { dailyMinutes: 60, updatedAt: 0 },
      goalHitDates: [],
      badgesEarned: [],
      pomoCount: 0,
      reactionsSent: {},
      timer: { focusMin: 25, breakMin: 5, phase: "focus", remainingSec: 25 * 60, running: false, startedAt: null, roomId: null, todayCount: 0, todayDate: "", updatedAt: 0 }
    };
  }

  function deepMerge(base, incoming) {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return base;
    var keys = {};
    Object.keys(base).forEach(function (k) { keys[k] = true; });
    Object.keys(incoming).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (k) {
      if (incoming[k] === undefined) return;
      var b = base[k];
      var v = incoming[k];
      if (Array.isArray(b)) {
        // base 필드가 배열이면 incoming도 배열일 때만 채택. 타입이 다르면(손상된
        // 데이터 등) base의 기본값(보통 빈 배열)을 유지해 렌더링 시 .forEach 등에서
        // 크래시가 나지 않도록 한다.
        if (Array.isArray(v)) base[k] = v;
      } else if (b && typeof b === "object") {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          base[k] = deepMerge(b, v);
        }
        // 그 외 타입 불일치는 base 기본값 유지
      } else {
        base[k] = v;
      }
    });
    return base;
  }

  // 숫자 하나만 방어하는 헬퍼. 값이 유한하지 않거나(NaN/Infinity/문자열 등) 범위를
  // 벗어나면 fallback으로 되돌린다. min/max를 생략하면 해당 방향은 검사하지 않는다.
  function sanitizeNumber(v, fallback, min, max) {
    v = Number(v);
    if (!isFinite(v)) return fallback;
    if (min != null && v < min) return fallback;
    if (max != null && v > max) return fallback;
    return v;
  }
  // S.logs 배열 항목(공부시간 기록) 하나를 검증/정규화한다. goals/timer 같은
  // 설정 필드는 sanitizeNumber()로 엄격히 범위를 강제하면서, 정작 누적 통계의
  // 원천인 로그 각 항목의 minutes/date/roomId는 검증 없이 그대로 신뢰했다.
  // minutes가 숫자가 아니면(예: 손상된 localStorage, 구버전 데이터의 병합)
  // totalMinutesAll()의 't += l.minutes'가 문자열 연결로 빠져 fmtMin()이
  // 'NaN시간 NaN분'을 출력하고, renderGoals()의 pct(=t/goal*100)가 NaN이 되어
  // 목표바 width가 'NaN%'가 되는 등 크래시 없이 화면만 깨지는 문제가 있었다.
  // 유효하지 않은 항목은 값을 함부로 보정하지 않고(로그 데이터는 사실 기록이므로
  // 임의 보정이 오히려 왜곡) 통째로 버려 통계 계산에서 제외한다.
  function normalizeLogEntry(l) {
    if (!l || typeof l !== "object") return null;
    var minutes = Number(l.minutes);
    if (!isFinite(minutes)) return null;
    minutes = Math.round(minutes);
    if (minutes < MANUAL_MIN_MINUTES || minutes > MANUAL_MAX_MINUTES) return null;
    if (typeof l.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return null;
    if (typeof l.roomId !== "string" || !roomById(l.roomId)) return null;
    return {
      id: (typeof l.id === "string" && l.id) ? l.id : uid(),
      roomId: l.roomId,
      date: l.date,
      minutes: minutes,
      method: (l.method === "timer" || l.method === "manual") ? l.method : "manual",
      ts: (typeof l.ts === "number" && isFinite(l.ts) && l.ts > 0) ? l.ts : 0
    };
  }
  function load() {
    var parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { parsed = null; }
    S = deepMerge(DEFAULTS(), parsed || {});
    // deepMerge가 방어하지 못하는 예상 밖의 손상 데이터에 대비한 2차 안전망.
    // 배열/객체 필드가 어떤 이유로든 잘못된 타입이면 기본값으로 되돌려
    // renderHome() 등에서의 .forEach TypeError로 인한 흰 화면 크래시를 막는다.
    if (!Array.isArray(S.logs)) S.logs = [];
    // 배열 타입 자체는 위에서 방어됐지만, 항목 각각의 minutes/date/roomId 값은
    // 아직 검증되지 않았다. 비정상 항목은 통계 계산을 깨뜨리므로 걸러낸다.
    S.logs = S.logs.map(normalizeLogEntry).filter(Boolean);
    if (!Array.isArray(S.joinedRooms)) S.joinedRooms = [];
    if (!Array.isArray(S.badgesEarned)) S.badgesEarned = [];
    if (!Array.isArray(S.goalHitDates)) S.goalHitDates = [];
    if (!S.profile || typeof S.profile !== "object" || Array.isArray(S.profile)) S.profile = DEFAULTS().profile;
    if (!Array.isArray(S.profile.subjects)) S.profile.subjects = [];
    // 닉네임도 숫자 설정 필드와 동일한 원칙(HTML만으로는 범위를 강제할 수 없다)을
    // 적용해, 손상되거나 구버전에서 병합된 비정상(비문자열/과도한 길이) 값을
    // 코드포인트 기준으로 정규화한다.
    if (typeof S.profile.nickname !== "string") S.profile.nickname = "";
    S.profile.nickname = truncateByCodePoints(S.profile.nickname, NICK_MAX_LEN);
    if (!S.timer || typeof S.timer !== "object" || Array.isArray(S.timer)) S.timer = DEFAULTS().timer;
    if (!S.goals || typeof S.goals !== "object" || Array.isArray(S.goals)) S.goals = DEFAULTS().goals;
    if (!S.reactionsSent || typeof S.reactionsSent !== "object" || Array.isArray(S.reactionsSent)) S.reactionsSent = {};
    // 각 리액션 항목을 { v, t } 레코드로 정규화한다(구버전의 순수 불리언 값 포함).
    var normalizedReactions = {};
    Object.keys(S.reactionsSent).forEach(function (k) {
      var rec = normalizeReactionEntry(S.reactionsSent[k]);
      if (rec) normalizedReactions[k] = rec;
    });
    S.reactionsSent = normalizedReactions;
    // 2차 안전망은 지금까지 최상위 필드의 "타입"만 방어했고, 중첩된 숫자 필드(목표
    // 분·타이머 분/초)의 값 범위는 검증하지 않았다. localStorage가 손상되거나 수동
    // 편집으로 goals.dailyMinutes가 0/음수/NaN이 되면 renderGoals()의
    // pct = Math.round(t/goal*100) 계산이 NaN/Infinity가 되어 목표바·타이머 링이
    // 깨질 수 있으므로, 여기서 숫자 필드도 범위를 강제해 기본값으로 복구한다.
    var D = DEFAULTS();
    S.goals.dailyMinutes = sanitizeNumber(S.goals.dailyMinutes, D.goals.dailyMinutes, GOAL_MIN_MINUTES, GOAL_MAX_MINUTES);
    S.goals.updatedAt = sanitizeNumber(S.goals.updatedAt, 0, 0, null);
    S.timer.focusMin = sanitizeNumber(S.timer.focusMin, D.timer.focusMin, 1, 180);
    S.timer.breakMin = sanitizeNumber(S.timer.breakMin, D.timer.breakMin, 1, 60);
    S.timer.remainingSec = sanitizeNumber(S.timer.remainingSec, D.timer.remainingSec, 0, 180 * 60);
    S.timer.todayCount = sanitizeNumber(S.timer.todayCount, 0, 0, null);
    S.timer.updatedAt = sanitizeNumber(S.timer.updatedAt, 0, 0, null);
    if (S.timer.phase !== "focus" && S.timer.phase !== "break") S.timer.phase = "focus";
    if (typeof S.timer.todayDate !== "string") S.timer.todayDate = "";
    S.timer.running = !!S.timer.running;
    // running인데 startedAt이 숫자가 아니면 진행 시간 계산(Date.now()-startedAt)이
    // NaN이 되므로, 그런 경우는 일시정지 상태로 되돌려 안전하게 만든다.
    if (S.timer.running && typeof S.timer.startedAt !== "number") { S.timer.running = false; S.timer.startedAt = null; }
    if (!S.timer.running) S.timer.startedAt = (typeof S.timer.startedAt === "number") ? S.timer.startedAt : null;
    S.pomoCount = sanitizeNumber(S.pomoCount, 0, 0, null);
    S.profile.updatedAt = sanitizeNumber(S.profile.updatedAt, 0, 0, null);
  }
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(S));
      return true;
    } catch (e) {
      // 사파리 프라이빗 모드, 저장공간 초과 등으로 setItem이 실패하면 사용자가
      // 알아챌 수 있도록 토스트로 알린다. 이전에는 조용히 무시되어 방금 기록한
      // 공부시간·스트릭·배지가 저장 안 된 채 유실될 수 있었다.
      toast("⚠️ 저장에 실패했어요. 브라우저 저장공간을 확인해주세요.");
      return false;
    }
  }

  /* ---------------- 통계/스트릭/배지 ---------------- */
  function todayByRoomAndTotal() {
    var today = todayStr();
    var byRoom = {}, total = 0;
    S.logs.forEach(function (l) {
      if (l.date === today) { byRoom[l.roomId] = (byRoom[l.roomId] || 0) + l.minutes; total += l.minutes; }
    });
    return { byRoom: byRoom, total: total };
  }
  function totalMinutesAll() {
    var t = 0; S.logs.forEach(function (l) { t += l.minutes; }); return t;
  }
  function calcStreak() {
    var dates = {};
    S.logs.forEach(function (l) { dates[l.date] = true; });
    var d = new Date();
    var streak = 0;
    if (!dates[todayStr(d)]) d.setDate(d.getDate() - 1);
    while (dates[todayStr(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function currentStats() {
    return {
      totalMinutes: totalMinutesAll(),
      streak: calcStreak(),
      goalHitCount: S.goalHitDates.length,
      pomoCount: S.pomoCount,
      joinedRoomsCount: S.joinedRooms.length
    };
  }
  function checkAndAwardBadges() {
    var stats = currentStats();
    var newly = [];
    BADGES.forEach(function (b) {
      var earned = S.badgesEarned && S.badgesEarned.indexOf(b.id) > -1;
      if (!earned && b.check(stats)) {
        S.badgesEarned = S.badgesEarned || [];
        S.badgesEarned.push(b.id);
        newly.push(b);
      }
    });
    if (newly.length) {
      if (save()) {
        showBadgeToast(newly[0]);
      } else {
        // save()가 실패하면(용량 초과·프라이빗 모드 등) 이미 저장 실패 토스트가 떴다.
        // 메모리 상의 badgesEarned만 앞서 나가 있으면 화면은 "획득"으로 보이지만
        // 다음 새로고침에는 사라지므로, 방금 추가한 배지를 되돌려 메모리와 저장소
        // 상태를 일치시키고 성공(배지 획득) 토스트도 띄우지 않는다.
        newly.forEach(function (b) {
          var idx = S.badgesEarned.indexOf(b.id);
          if (idx > -1) S.badgesEarned.splice(idx, 1);
        });
        newly = [];
      }
    }
    return newly;
  }
  function checkGoalHit() {
    var t = todayByRoomAndTotal().total;
    var today = todayStr();
    if (t >= S.goals.dailyMinutes && S.goalHitDates.indexOf(today) === -1) {
      S.goalHitDates.push(today);
      if (save()) {
        toast("오늘의 목표를 달성했어요! 🎯");
      } else {
        // 저장 실패 시 메모리 상의 goalHitDates도 되돌려, "달성"으로 보였다가
        // 새로고침 후 조용히 사라지는 상태/저장 불일치를 막는다.
        var idx = S.goalHitDates.indexOf(today);
        if (idx > -1) S.goalHitDates.splice(idx, 1);
      }
    }
  }
  function addLog(roomId, minutes, method) {
    // 호출부에서 이미 검증하지만, 게이미피케이션 핵심 지표(오늘 공부시간·누적시간·
    // hour 배지·목표달성·리더보드)를 지키기 위한 마지막 방어선으로 여기서도 상한을 강제한다.
    minutes = Math.max(MANUAL_MIN_MINUTES, Math.min(MANUAL_MAX_MINUTES, Math.round(minutes)));
    var log = { id: uid(), roomId: roomId, date: todayStr(), minutes: minutes, method: method, ts: Date.now() };
    S.logs.push(log);
    var joinedRoomAdded = S.joinedRooms.indexOf(roomId) === -1;
    if (joinedRoomAdded) S.joinedRooms.push(roomId);
    if (!save()) {
      // 저장 실패: 방금 추가한 로그/참여룸을 메모리에서도 되돌린다. save()가 이미
      // '저장 실패' 토스트를 띄웠으므로, 호출부가 뒤이어 성공 토스트를 띄우지
      // 않도록 실패를 알리는 false를 반환한다.
      var idx = S.logs.indexOf(log);
      if (idx > -1) S.logs.splice(idx, 1);
      if (joinedRoomAdded) {
        var ri = S.joinedRooms.indexOf(roomId);
        if (ri > -1) S.joinedRooms.splice(ri, 1);
      }
      return false;
    }
    checkGoalHit();
    checkAndAwardBadges();
    return true;
  }

  /* ---------------- 토스트 ---------------- */
  // addLog() 내부에서 checkGoalHit()→toast('목표 달성')과 checkAndAwardBadges()→
  // showBadgeToast()가 먼저 실행된 뒤, 호출부(모달 제출 등)가 같은 동기 실행 흐름
  // 안에서 곧바로 toast('45분 기록했어요!')를 또 호출하는 경우가 있다. 예전에는
  // toast()가 #toast-root.innerHTML을 통째로 교체해 먼저 만든 토스트가 브라우저에
  // 페인트되기도 전에 지워졌고, showBadgeToast()가 appendChild한 배지 토스트까지도
  // 뒤이은 toast() 호출이 root.innerHTML을 덮어써 함께 사라졌다. 여기서는 일반
  // 토스트(하단)와 배지 토스트(상단, CSS 위치가 달라 서로 가리지 않음)를 각각 자신의
  // 큐로 관리해, 같은 종류끼리는 순서대로 하나씩, 서로 다른 종류는 동시에 보이도록 한다.
  function makeToastQueue(buildEl, displayMs) {
    var queue = [];
    var showing = false;
    function showNext() {
      if (!queue.length) { showing = false; return; }
      showing = true;
      var item = queue.shift();
      var root = $("#toast-root");
      var el = buildEl(item);
      root.appendChild(el);
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        showNext();
      }, displayMs);
    }
    return function enqueue(item) {
      queue.push(item);
      if (!showing) showNext();
    };
  }
  var enqueueToast = makeToastQueue(function (msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    return el;
  }, 2200);
  var enqueueBadgeToast = makeToastQueue(function (badge) {
    var el = document.createElement("div");
    el.className = "badge-toast";
    el.innerHTML = "<span>" + badge.emoji + "</span><span>새 배지 획득! " + esc(badge.name) + "</span>";
    return el;
  }, 2800);
  function toast(msg) { enqueueToast(msg); }
  function showBadgeToast(badge) { enqueueBadgeToast(badge); }

  /* ---------------- 모달 ---------------- */
  function openModal(html) {
    // 모든 버튼 클릭은 document의 단일 위임 리스너가 e.target.closest("[data-action]")로
    // 처리한다. 예전에는 모달 카드 바깥(배경)을 눌렀을 때만 닫히게 하려고 카드에
    // onclick="event.stopPropagation()"을 걸었는데, 이는 버블링 자체를 막아버려서
    // 카드 안의 모든 버튼(goal-save, modal-manual-submit, profile-save, confirm-reset,
    // select-timer-room 등)이 document 리스너까지 이벤트를 전달하지 못해 전혀 동작하지
    // 않는 문제가 있었다. closest()는 가장 가까운 data-action 조상에서 멈추므로,
    // 카드 자체에 아무 동작도 없는 data-action="noop"을 부여하면 카드의 빈 영역을
    // 눌러도(카드 자신이 가장 가까운 매치가 되어) 모달이 닫히지 않으면서, 카드 안의
    // 버튼들은 각자의 data-action이 먼저 매치되어 정상적으로 document까지 전달된다.
    $("#modal-root").innerHTML = '<div class="modal-back" data-action="close-modal"><div class="modal-card" data-action="noop">' + html + "</div></div>";
  }
  function closeModal() { $("#modal-root").innerHTML = ""; }

  /* ---------------- 광고 / 쿠팡 슬롯 ---------------- */
  var COUPANG = { trackingCode: "AF2114854", widgetId: "999155" };
  function coupangSlotHTML(subId) {
    return '<div class="coupang-slot" data-subid="' + esc(subId) + '"></div><p class="slot-label">이 사이트는 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받을 수 있습니다.</p>';
  }
  function activateCoupangSlots(root) {
    if (!COUPANG.trackingCode || !COUPANG.widgetId) return;
    $all(".coupang-slot", root).forEach(function (slot) {
      if (slot.dataset.mounted) return;
      slot.dataset.mounted = "1";
      var subId = slot.getAttribute("data-subid") || "teen-study-circle";
      var w = Math.max(300, Math.min(680, slot.clientWidth || 320));
      var h = w >= 640 ? 140 : 180;
      var src = "https://ads-partners.coupang.com/widgets.html?id=" + encodeURIComponent(COUPANG.widgetId) +
        "&template=carousel&trackingCode=" + encodeURIComponent(COUPANG.trackingCode) +
        "&subId=" + encodeURIComponent(subId) + "&width=" + w + "&height=" + h + "&tsource=";
      var iframe = document.createElement("iframe");
      iframe.src = src; iframe.width = String(w); iframe.height = String(h);
      iframe.setAttribute("frameborder", "0"); iframe.setAttribute("scrolling", "no");
      iframe.setAttribute("referrerpolicy", "unsafe-url");
      iframe.style.cssText = "max-width:100%;border:0;border-radius:14px;display:block;margin:0 auto";
      slot.appendChild(iframe);
    });
  }

  /* ---------------- 화면 전환 ---------------- */
  function showScreen(id) {
    $all(".scr").forEach(function (s) { s.hidden = true; });
    $("#" + id).hidden = false;
  }
  function goWelcome() { showScreen("scr-welcome"); }
  function goOnboarding() { obIndex = 0; showScreen("scr-onboarding"); renderObStep(); }
  function goMain() {
    showScreen("scr-main");
    switchTab(currentTab);
    updateStreakBadge();
  }
  function updateStreakBadge() {
    $("#tb-streak").textContent = "🔥 " + calcStreak() + "일";
  }

  /* ---------------- 온보딩 ---------------- */
  var OB_STEPS = ["nickname", "avatar", "subjects", "timeslot", "age"];
  var obIndex = 0;

  function renderObStep() {
    $("#ob-fill").style.width = ((obIndex + 1) / OB_STEPS.length * 100) + "%";
    var step = OB_STEPS[obIndex];
    var html = "";
    if (step === "nickname") {
      html = '<div class="ob-step"><h2>어떻게 불러드릴까요?</h2><p class="sub">실명 대신 별명을 사용해주세요. 학교명·연락처는 입력하지 않아요.</p>' +
        // maxlength는 UTF-16 코드유닛 기준이라 이모지(서로게이트 페어)를 코드포인트
        // 중간에서 잘라낼 수 있다. 실제 상한(10 코드포인트)은 아래 input 리스너에서
        // truncateByCodePoints()로 강제하고, 여기 maxlength는 그보다 넉넉한 값(서로게이트
        // 페어 10개 분량)을 둬 브라우저 네이티브 절단이 우리 로직보다 먼저 개입해
        // 문자를 깨뜨리지 않도록 하는 안전 여유값일 뿐이다.
        '<input class="ob-input" id="ob-nickname" maxlength="' + (NICK_MAX_LEN * 2) + '" placeholder="예: 새벽별지기" value="' + esc(S.profile.nickname) + '" />' +
        '<p class="ob-hint">2~10자, 별명만 입력하면 돼요</p></div>';
    } else if (step === "avatar") {
      var grad = AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length];
      html = '<div class="ob-step"><h2>아바타를 골라주세요</h2><p class="sub">사진 업로드는 지원하지 않아요. 이모지 + 색상으로만 표현해요.</p>' +
        '<div class="avatar-preview" style="background:linear-gradient(135deg,' + grad[0] + "," + grad[1] + ')">' + S.profile.avatarEmoji + "</div>" +
        '<div class="avatar-grid">' + AVATAR_EMOJIS.map(function (e, i) {
          return '<button class="av-opt' + (S.profile.avatarEmoji === e ? " on" : "") + '" style="background:linear-gradient(135deg,' + grad[0] + "," + grad[1] + ')" data-action="pick-emoji" data-emoji="' + e + '">' + e + "</button>";
        }).join("") + "</div>" +
        '<div class="grad-row">' + AVATAR_GRADIENTS.map(function (g, i) {
          return '<button class="grad-opt' + (S.profile.gradIdx === i ? " on" : "") + '" style="background:linear-gradient(135deg,' + g[0] + "," + g[1] + ')" data-action="pick-grad" data-idx="' + i + '"></button>';
        }).join("") + "</div></div>";
    } else if (step === "subjects") {
      html = '<div class="ob-step"><h2>관심있는 과목/시험을 골라주세요</h2><p class="sub">고른 룸에 자동으로 참여돼요. 여러 개 선택 가능해요.</p>' +
        '<div class="chip-grid">' + ROOMS.map(function (r) {
          return '<button class="chip' + (S.profile.subjects.indexOf(r.id) > -1 ? " on" : "") + '" data-action="toggle-subject" data-room="' + r.id + '">' + r.emoji + " " + esc(r.name) + "</button>";
        }).join("") + "</div></div>";
    } else if (step === "timeslot") {
      html = '<div class="ob-step"><h2>주로 언제 공부하나요?</h2><p class="sub">비슷한 시간대 친구들과 함께 동기부여를 받아요.</p>' +
        '<div class="chip-grid">' + TIME_SLOTS.map(function (t) {
          return '<button class="chip' + (S.profile.timeSlot === t.id ? " on" : "") + '" data-action="pick-timeslot" data-slot="' + t.id + '">' + t.emoji + " " + esc(t.label) + "</button>";
        }).join("") + "</div></div>";
    } else if (step === "age") {
      html = '<div class="ob-step"><h2>마지막으로 확인할게요</h2><p class="sub">스터디서클은 만 14~19세 중고생을 위한 학습 앱이에요.</p>' +
        '<div class="agree"><input type="checkbox" id="ob-age" ' + (S.profile.ageConfirmed ? "checked" : "") + ' /><span>저는 만 14~19세에 해당해요.</span></div>' +
        '<div class="agree"><input type="checkbox" id="ob-terms" ' + (S.profile.termsAgreed ? "checked" : "") + ' /><span>이 앱에는 1:1 개인 메시지·사진 업로드·위치 매칭 기능이 없으며, 다른 참가자와는 정해진 문구의 리액션과 공개 피드로만 소통한다는 점을 이해했어요. (<button type="button" data-action="show-guardian" style="text-decoration:underline;color:var(--acc2)">보호자 안내 자세히 보기</button>)</span></div>' +
        "</div>";
    }
    $("#ob-body").innerHTML = html;
    $("#ob-next").textContent = obIndex === OB_STEPS.length - 1 ? "완료" : "다음";
    var nickInput = $("#ob-nickname");
    if (nickInput) nickInput.addEventListener("input", function () {
      // 코드포인트 기준으로 즉시 상한을 강제해, 네이티브 maxlength(UTF-16 코드유닛
      // 기준)가 서로게이트 페어 이모지를 반쪽만 남기는 것을 방지한다.
      var v = truncateByCodePoints(nickInput.value, NICK_MAX_LEN);
      if (v !== nickInput.value) nickInput.value = v;
      S.profile.nickname = v;
    });
    var ageCk = $("#ob-age"); if (ageCk) ageCk.addEventListener("change", function () { S.profile.ageConfirmed = ageCk.checked; });
    var termsCk = $("#ob-terms"); if (termsCk) termsCk.addEventListener("change", function () { S.profile.termsAgreed = termsCk.checked; });
  }

  function obValidateCurrent() {
    var step = OB_STEPS[obIndex];
    if (step === "nickname") {
      // 하한(2자)만 재검증하고 상한(10자)은 HTML maxlength 속성에만 의존하던
      // 비일관성을 없앤다. .length는 UTF-16 코드유닛 기준이라 서로게이트 페어
      // 이모지 1개를 2자로 세어버리므로, 코드포인트 기준(codePointLength)으로
      // 상/하한을 모두 명시적으로 강제한다.
      var v = truncateByCodePoints((S.profile.nickname || "").trim(), NICK_MAX_LEN);
      if (codePointLength(v) < NICK_MIN_LEN) { toast("별명을 " + NICK_MIN_LEN + "자 이상 입력해주세요"); return false; }
      S.profile.nickname = v;
    } else if (step === "subjects") {
      if (!S.profile.subjects.length) { toast("최소 1개 이상 골라주세요"); return false; }
    } else if (step === "timeslot") {
      if (!S.profile.timeSlot) { toast("공부 시간대를 골라주세요"); return false; }
    } else if (step === "age") {
      if (!S.profile.ageConfirmed || !S.profile.termsAgreed) { toast("확인 항목에 모두 체크해주세요"); return false; }
    }
    return true;
  }

  function obNext() {
    if (!obValidateCurrent()) return;
    S.profile.updatedAt = Date.now();
    save();
    if (obIndex === OB_STEPS.length - 1) {
      S.onboarded = true;
      S.joinedRooms = Array.from(new Set(S.joinedRooms.concat(S.profile.subjects)));
      save();
      toast("환영해요, " + S.profile.nickname + "님! 👋");
      goMain();
      return;
    }
    obIndex++;
    renderObStep();
  }
  function obBack() {
    if (obIndex === 0) { goWelcome(); return; }
    obIndex--;
    renderObStep();
  }

  /* ---------------- 탭 라우팅 ---------------- */
  var currentTab = "home";
  var TAB_RENDERERS = { home: renderHome, rooms: renderRooms, timer: renderTimer, goals: renderGoals, my: renderMy };

  function switchTab(tab) {
    currentTab = tab;
    $all(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.tab === tab); });
    var view = $("#view");
    view.innerHTML = TAB_RENDERERS[tab]();
    view.scrollTop = 0;
    activateCoupangSlots(view);
    if (tab === "timer") ensureTimerLoop();
  }

  /* ---------------- 홈 ---------------- */
  function renderHome() {
    var t = todayByRoomAndTotal();
    var stats = currentStats();
    var joined = S.joinedRooms.map(roomById).filter(Boolean);
    var roomsHtml = joined.length
      ? joined.map(function (r) {
          return '<button class="my-room-chip" data-action="open-room" data-room="' + r.id + '">' + r.emoji + " " + esc(r.name) + "</button>";
        }).join("")
      : '<button class="my-room-chip" data-action="switch-tab" data-tab="rooms">📚 룸 둘러보러 가기</button>';
    return '' +
      '<div class="quote-card"><div class="q-label">오늘의 한마디</div><p>“' + esc(quoteOfToday()) + '”</p></div>' +
      '<div class="stat-grid">' +
        '<div class="stat-card"><b>' + fmtMin(t.total) + "</b><span>오늘 공부시간</span></div>" +
        '<div class="stat-card"><b>' + stats.streak + '일</b><span>연속 스트릭 🔥</span></div>' +
        '<div class="stat-card"><b>' + fmtMin(stats.totalMinutes) + "</b><span>누적 공부시간</span></div>" +
        '<div class="stat-card"><b>' + (S.badgesEarned ? S.badgesEarned.length : 0) + "개</b><span>획득 배지</span></div>" +
      "</div>" +
      '<div class="quick-row">' +
        '<button class="quick-btn" data-action="switch-tab" data-tab="timer"><span>⏱️</span>타이머 시작</button>' +
        '<button class="quick-btn" data-action="open-manual-log"><span>✍️</span>오늘 공부 기록</button>' +
      "</div>" +
      '<div class="sec" style="padding-bottom:0"><h2>내 스터디룸</h2></div>' +
      '<div class="my-rooms-row">' + roomsHtml + "</div>" +
      '<div class="sec"><h2>📎 문구·학습용품</h2></div>' +
      coupangSlotHTML("tsc-home") +
      "";
  }

  /* ---------------- 룸 목록 ---------------- */
  var roomFilter = "전체";
  function renderRooms() {
    var cats = ["전체"].concat(Array.from(new Set(ROOMS.map(function (r) { return r.cat; }))));
    var list = roomFilter === "전체" ? ROOMS : ROOMS.filter(function (r) { return r.cat === roomFilter; });
    return '' +
      '<div class="room-filter-row">' + cats.map(function (c) {
        return '<button class="chip' + (roomFilter === c ? " on" : "") + '" data-action="filter-room" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("") + "</div>" +
      list.map(function (r) {
        var members = SAMPLE_MEMBERS[r.id] || [];
        var joined = S.joinedRooms.indexOf(r.id) > -1;
        return '<button class="room-card" data-action="open-room" data-room="' + r.id + '">' +
          roomIconSpan(r, 48) +
          '<div class="room-info"><b>' + esc(r.name) + (joined ? '<span class="room-joined" style="margin-left:6px">참여중</span>' : "") + "</b>" +
          "<p>" + esc(r.desc) + "</p>" +
          '<div class="room-meta"><span>👥 ' + (members.length + (joined ? 1 : 0)) + "명</span><span>·</span><span>" + esc(r.cat) + "</span></div>" +
          "</div></button>";
      }).join("") +
      '<div class="empty-box"><span>ℹ️</span>리더보드·피드에 보이는 다른 참가자 활동은 체험을 위한 샘플 데이터입니다. 이 앱은 서버 없이 이 기기에서만 동작해요.</div>' +
      coupangSlotHTML("tsc-rooms");
  }
  function filterRoom(cat) { roomFilter = cat; switchTab("rooms"); }

  /* ---------------- 룸 상세(오버레이) ---------------- */
  var overlayRoomId = null;
  var overlaySubtab = "leaderboard";

  function openRoom(roomId) {
    overlayRoomId = roomId;
    overlaySubtab = "leaderboard";
    renderRoomOverlay();
  }
  function closeOverlay() {
    $("#overlay-root").innerHTML = "";
    overlayRoomId = null;
  }
  function toggleJoin(roomId) {
    var idx = S.joinedRooms.indexOf(roomId);
    if (idx > -1) { S.joinedRooms.splice(idx, 1); toast("룸에서 나갔어요"); }
    else { S.joinedRooms.push(roomId); toast("룸에 참여했어요!"); }
    save();
    checkAndAwardBadges();
    renderRoomOverlay();
  }

  function leaderboardRows(roomId) {
    var room = roomById(roomId);
    var members = SAMPLE_MEMBERS[roomId] || [];
    var rows = members.map(function (m) {
      return { id: m.id, nick: m.nick, emoji: m.emoji, grad: m.grad, minutes: sampleMinutesToday(roomId, m.id), streak: m.baseStreak, sample: true };
    });
    var joined = S.joinedRooms.indexOf(roomId) > -1;
    if (joined) {
      var mine = todayByRoomAndTotal().byRoom[roomId] || 0;
      rows.push({ id: "me", nick: S.profile.nickname || "나", emoji: S.profile.avatarEmoji, grad: AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length], minutes: mine, streak: calcStreak(), sample: false, me: true });
    }
    rows.sort(function (a, b) { return b.minutes - a.minutes; });
    return rows;
  }

  function renderRoomOverlay() {
    var room = roomById(overlayRoomId);
    if (!room) return;
    var joined = S.joinedRooms.indexOf(room.id) > -1;
    var body = overlaySubtab === "leaderboard" ? renderLeaderboardBody(room) : renderFeedBody(room);
    var html = '' +
      '<section class="overlay-scr">' +
      '<div class="ov-top"><button class="ov-back" data-action="close-overlay">‹</button>' +
      '<div class="ov-title">' + room.emoji + " " + esc(room.name) + "</div></div>" +
      '<div class="ov-body">' +
      '<div class="room-hero">' + roomIconSpan(room, 56) +
      '<div class="room-hero-info"><b>' + esc(room.name) + "</b><p>" + esc(room.desc) + "</p></div></div>" +
      '<div class="subtab-row">' +
      '<button class="subtab' + (overlaySubtab === "leaderboard" ? " on" : "") + '" data-action="room-subtab" data-sub="leaderboard">🏆 오늘의 순위</button>' +
      '<button class="subtab' + (overlaySubtab === "feed" ? " on" : "") + '" data-action="room-subtab" data-sub="feed">📝 오늘의 인증</button>' +
      "</div>" + body + "</div>" +
      '<div class="room-join-bar">' +
      (joined
        ? '<button class="btn-grad big" data-action="switch-tab" data-tab="timer" data-preroom="' + room.id + '">⏱️ 이 룸으로 타이머 시작</button><button class="btn-ghost" data-action="toggle-join" data-room="' + room.id + '">나가기</button>'
        : '<button class="btn-grad big" data-action="toggle-join" data-room="' + room.id + '">이 룸 참여하기</button>') +
      "</div></section>";
    $("#overlay-root").innerHTML = html;
    activateCoupangSlots($("#overlay-root"));
  }

  function renderLeaderboardBody(room) {
    var rows = leaderboardRows(room.id);
    if (!rows.length) return '<div class="empty-box"><span>🌱</span>아직 오늘 활동한 참가자가 없어요. 첫 기록을 남겨보세요!</div>';
    return rows.map(function (row, i) {
      var rankCls = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
      return '<div class="lb-row"><div class="lb-rank ' + rankCls + '">' + (i + 1) + "</div>" +
        avatarSpan(row.emoji, row.grad, 38) +
        '<div class="lb-info"><b class="' + (row.me ? "lb-you" : "") + '">' + esc(row.nick) + (row.me ? " (나)" : "") + (row.sample ? '<span class="lb-sample-tag">샘플</span>' : "") + "</b>" +
        '<div class="lb-sub">🔥 ' + row.streak + "일 연속</div></div>" +
        '<div class="lb-time">' + fmtMin(row.minutes) + "</div></div>";
    }).join("");
  }

  function feedEntriesForRoom(roomId) {
    var entries = sampleFeedToday(roomId).map(function (f) {
      return { id: f.id, nick: f.nick, emoji: f.emoji, grad: f.grad, minutes: f.minutes, minsAgo: f.minsAgo, sample: true };
    });
    var today = todayStr();
    // leaderboardRows()는 S.joinedRooms에 이 룸이 남아있을 때만 '나' 행을 보여준다.
    // 예전에는 여기서 참여 여부와 무관하게 오늘 기록만으로 내 항목을 넣어서, 룸을
    // 나간 뒤에도 피드에는 '내 기록이에요'가 계속 보이는데 리더보드에서는 그 기록이
    // 사라지는 모순이 있었다. 두 화면이 같은 기준(참여 중인지)을 쓰도록 맞춘다.
    var joined = S.joinedRooms.indexOf(roomId) > -1;
    if (joined) {
      S.logs.filter(function (l) { return l.roomId === roomId && l.date === today; }).forEach(function (l) {
        entries.push({
          id: l.id, nick: S.profile.nickname || "나", emoji: S.profile.avatarEmoji,
          grad: AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length],
          minutes: l.minutes, minsAgo: Math.max(0, Math.round((Date.now() - l.ts) / 60000)), sample: false, mine: true
        });
      });
    }
    entries.sort(function (a, b) { return a.minsAgo - b.minsAgo; });
    return entries;
  }

  function renderFeedBody(room) {
    var entries = feedEntriesForRoom(room.id);
    if (!entries.length) return '<div class="empty-box"><span>📝</span>오늘의 인증이 아직 없어요. 타이머로 첫 기록을 남겨보세요!</div>';
    return entries.map(function (e) {
      var reactRow = e.mine
        ? '<div class="reaction-row"><span class="reaction-btn" style="opacity:.6">내 기록이에요</span></div>'
        : '<div class="reaction-row">' + REACTIONS.map(function (r) {
            var key = e.id + "|" + r.id;
            var sent = !!(S.reactionsSent[key] && S.reactionsSent[key].v);
            var base = 1 + (hashStr(e.id + r.id) % 12);
            return '<button class="reaction-btn' + (sent ? " sent" : "") + '" data-action="send-reaction" data-entry="' + esc(e.id) + '" data-reaction="' + r.id + '">' +
              r.emoji + " " + r.label + ' <span class="cnt">' + (base + (sent ? 1 : 0)) + "</span></button>";
          }).join("") + "</div>";
      return '<div class="feed-item"><div class="feed-head">' + avatarSpan(e.emoji, e.grad, 38) +
        '<div><div class="feed-name">' + esc(e.nick) + (e.sample ? '<span class="lb-sample-tag">샘플</span>' : "") + "</div></div>" +
        '<div class="feed-time">' + timeAgoLabel(e.minsAgo) + "</div></div>" +
        '<div class="feed-body">📚 ' + fmtMin(e.minutes) + " 공부 인증했어요</div>" +
        reactRow + "</div>";
    }).join("");
  }

  function sendReaction(entryId, reactionId) {
    var key = entryId + "|" + reactionId;
    var wasSent = !!(S.reactionsSent[key] && S.reactionsSent[key].v);
    // 값과 함께 변경 시각도 기록해, 멀티탭 병합 시 last-write-wins로 "취소"도
    // "보냄"과 동등하게 최신 상태로 인정받을 수 있게 한다.
    S.reactionsSent[key] = { v: !wasSent, t: Date.now() };
    save();
    if (S.reactionsSent[key].v) toast("응원을 보냈어요 👏");
    renderRoomOverlay();
  }

  /* ---------------- 타이머 ---------------- */
  var timerMode = "pomo";
  var timerLoopHandle = null;

  function ensureTimerLoop() {
    if (timerLoopHandle) return;
    timerLoopHandle = setInterval(timerTick, 1000);
  }
  function timerDisplayRemaining() {
    var tm = S.timer;
    if (!tm.running || !tm.startedAt) return tm.remainingSec;
    var elapsed = Math.floor((Date.now() - tm.startedAt) / 1000);
    return tm.remainingSec - elapsed;
  }
  function timerTick() {
    var tm = S.timer;
    if (!tm.running) return;
    var remain = timerDisplayRemaining();
    if (remain <= 0) {
      completeTimerPhase(); // 다른 탭에 있어도 백그라운드에서 정상 완료 처리됨
    } else if (currentTab === "timer" && timerMode === "pomo") {
      updateTimerRingOnly(remain);
    }
  }
  function completeTimerPhase() {
    var tm = S.timer;
    if (tm.phase === "focus") {
      var roomId = resolveTimerRoom(tm).id;
      addLog(roomId, tm.focusMin, "timer");
      var today = todayStr();
      if (tm.todayDate !== today) { tm.todayDate = today; tm.todayCount = 0; }
      tm.todayCount++;
      S.pomoCount++;
      tm.phase = "break";
      tm.remainingSec = tm.breakMin * 60;
      tm.running = false; tm.startedAt = null;
      tm.updatedAt = Date.now();
      // save()가 실패하면 addLog() 안에서 이미 '저장 실패' 토스트가 떴으므로,
      // 여기서 '포커스 완료!' 성공 토스트까지 겹쳐 띄워 저장이 안 됐는데도
      // 된 것처럼 보이게 하지 않는다.
      if (save()) toast("포커스 완료! " + tm.breakMin + "분 쉬어가요 🌿");
      checkAndAwardBadges();
    } else {
      tm.phase = "focus";
      tm.remainingSec = tm.focusMin * 60;
      tm.running = false; tm.startedAt = null;
      tm.updatedAt = Date.now();
      if (save()) toast("휴식 끝! 다음 포커스를 시작해볼까요? 🔥");
    }
    updateStreakBadge();
    if (currentTab === "timer") switchTab("timer");
  }
  function updateTimerRingOnly(remainSec) {
    var clock = $("#timer-clock");
    if (!clock) return;
    clock.textContent = fmtClock(remainSec);
    var tm = S.timer;
    var total = (tm.phase === "focus" ? tm.focusMin : tm.breakMin) * 60;
    var pct = Math.max(0, Math.min(1, remainSec / total));
    var circumference = 2 * Math.PI * 100;
    var fg = $("#timer-ring-fg");
    if (fg) fg.style.strokeDashoffset = (circumference * (1 - pct)).toFixed(1);
  }

  function timerStart() {
    var tm = S.timer;
    if (!tm.roomId) tm.roomId = S.joinedRooms[0] || ROOMS[0].id;
    tm.running = true; tm.startedAt = Date.now();
    tm.updatedAt = Date.now();
    save(); switchTab("timer");
  }
  function timerPause() {
    var tm = S.timer;
    tm.remainingSec = timerDisplayRemaining();
    tm.running = false; tm.startedAt = null;
    tm.updatedAt = Date.now();
    save(); switchTab("timer");
  }
  function timerReset() {
    var tm = S.timer;
    tm.remainingSec = (tm.phase === "focus" ? tm.focusMin : tm.breakMin) * 60;
    tm.running = false; tm.startedAt = null;
    tm.updatedAt = Date.now();
    save(); switchTab("timer");
  }
  function timerSetPreset(focusMin, breakMin) {
    var tm = S.timer;
    tm.focusMin = focusMin; tm.breakMin = breakMin;
    tm.phase = "focus"; tm.remainingSec = focusMin * 60;
    tm.running = false; tm.startedAt = null;
    tm.updatedAt = Date.now();
    save(); switchTab("timer");
  }
  function pickTimerRoom(roomId) {
    S.timer.roomId = roomId; S.timer.updatedAt = Date.now(); save(); closeModal(); switchTab("timer");
  }

  function renderTimer() {
    var tm = S.timer;
    var room = resolveTimerRoom(tm);
    var remain = timerDisplayRemaining();
    var total = (tm.phase === "focus" ? tm.focusMin : tm.breakMin) * 60;
    var pct = Math.max(0, Math.min(1, remain / total));
    var circumference = 2 * Math.PI * 100;
    var offset = (circumference * (1 - pct)).toFixed(1);
    var today = todayStr();
    var todayCount = tm.todayDate === today ? tm.todayCount : 0;
    var dots = "";
    for (var i = 0; i < 8; i++) dots += '<div class="pomo-dot' + (i < todayCount ? " done" : "") + '"></div>';

    var pomoView = '' +
      '<div class="timer-room-pick" data-action="open-timer-room-picker">공부방: <b>' + room.emoji + " " + esc(room.name) + '</b> · 바꾸기 ›</div>' +
      '<div class="timer-ring-wrap"><svg width="230" height="230" viewBox="0 0 230 230">' +
      '<defs><linearGradient id="tgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>' +
      '<circle class="timer-ring-bg" cx="115" cy="115" r="100"></circle>' +
      '<circle id="timer-ring-fg" class="timer-ring-fg" cx="115" cy="115" r="100" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset + '"></circle>' +
      '</svg><div class="timer-center"><div class="timer-clock" id="timer-clock">' + fmtClock(remain) + '</div>' +
      '<div class="timer-phase">' + (tm.phase === "focus" ? "🎯 집중 시간" : "🌿 휴식 시간") + "</div></div></div>" +
      '<div class="timer-set-row">' +
      '<button data-action="timer-preset" data-focus="25" data-break="5">25/5</button>' +
      '<button data-action="timer-preset" data-focus="45" data-break="10">45/10</button>' +
      '<button data-action="timer-preset" data-focus="50" data-break="10">50/10</button>' +
      "</div>" +
      '<div class="timer-btn-row">' +
      (tm.running
        ? '<button class="btn-ghost" data-action="timer-pause">일시정지</button>'
        : '<button class="btn-grad" data-action="timer-start">' + (remain < total ? "이어하기" : "시작") + "</button>") +
      '<button class="btn-ghost" data-action="timer-reset">초기화</button>' +
      "</div>" +
      '<div class="pomo-count-row">' + dots + "</div>" +
      '<p class="ob-hint" style="margin-top:8px">오늘 완료한 뽀모도로 ' + todayCount + "회</p>";

    var manualView = '' +
      '<div class="sec" style="padding-top:0"><h2>오늘 공부한 시간을 직접 입력해요</h2>' +
      '<p class="sec-sub">타이머 없이도 공부시간을 인증할 수 있어요.</p></div>' +
      '<div style="padding:0 16px"><label class="ob-hint">공부방</label>' +
      '<select id="manual-room-select" class="ob-input" style="margin:6px 0 14px">' + ROOMS.map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === room.id ? " selected" : "") + ">" + r.emoji + " " + esc(r.name) + "</option>";
      }).join("") + "</select>" +
      '<label class="ob-hint">공부 시간(분)</label>' +
      '<input id="manual-minutes-input" class="ob-input" type="number" min="1" max="600" placeholder="예: 45" style="margin:6px 0 14px" />' +
      '<button class="btn-grad big" data-action="manual-log-submit">공부시간 기록하기</button></div>';

    return '' +
      '<div class="timer-wrap">' +
      '<div class="timer-mode-row">' +
      '<button class="timer-mode' + (timerMode === "pomo" ? " on" : "") + '" data-action="timer-mode" data-mode="pomo">🍅 뽀모도로</button>' +
      '<button class="timer-mode' + (timerMode === "manual" ? " on" : "") + '" data-action="timer-mode" data-mode="manual">✍️ 수동 입력</button>' +
      "</div>" +
      (timerMode === "pomo" ? pomoView : manualView) +
      "</div>";
  }

  function openTimerRoomPicker() {
    var pool = S.joinedRooms.length ? S.joinedRooms.map(roomById).filter(Boolean) : ROOMS;
    openModal('<h3>공부방 고르기</h3><div class="chip-grid">' + pool.map(function (r) {
      return '<button class="chip" data-action="select-timer-room" data-room="' + r.id + '">' + r.emoji + " " + esc(r.name) + "</button>";
    }).join("") + "</div>");
  }

  function openManualLog(presetRoom) {
    var pool = ROOMS;
    var defaultRoom = presetRoom || S.joinedRooms[0] || ROOMS[0].id;
    openModal('<h3>오늘 공부시간 기록하기</h3>' +
      '<label class="ob-hint">공부방</label>' +
      '<select id="ml-room" class="ob-input" style="margin:6px 0 14px">' + pool.map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === defaultRoom ? " selected" : "") + ">" + r.emoji + " " + esc(r.name) + "</option>";
      }).join("") + "</select>" +
      '<label class="ob-hint">공부 시간(분)</label>' +
      '<input id="ml-minutes" class="ob-input" type="number" min="1" max="600" placeholder="예: 30" style="margin:6px 0 16px" />' +
      '<button class="btn-grad big" data-action="modal-manual-submit">기록하기</button>');
  }

  /* ---------------- 목표 & 배지 ---------------- */
  function renderGoals() {
    var t = todayByRoomAndTotal().total;
    var goal = S.goals.dailyMinutes;
    var pct = Math.max(0, Math.min(100, Math.round((t / goal) * 100)));
    return '' +
      '<div class="sec"><h2>오늘의 목표</h2></div>' +
      '<div class="goal-card"><div class="goal-top"><b>일일 학습 목표</b><button class="btn-sm" data-action="open-goal-edit">수정</button></div>' +
      '<div class="goal-bar"><div class="goal-bar-fg" style="width:' + pct + '%"></div></div>' +
      '<div class="goal-foot"><span>' + fmtMin(t) + " / " + fmtMin(goal) + "</span><span>" + pct + "%</span></div></div>" +
      '<div class="sec"><h2>배지 컬렉션</h2><p class="sec-sub">' + (S.badgesEarned ? S.badgesEarned.length : 0) + " / " + BADGES.length + "개 획득</p></div>" +
      '<div class="badge-grid">' + BADGES.map(function (b) {
        // 배지 타일의 획득 표시는 b.check(stats)로 실시간 재계산하지 않고
        // S.badgesEarned에 실제로 들어있는지로만 판단한다. streak-3/7/30 같은
        // 배지는 calcStreak()이 하루라도 거르면 0으로 떨어지므로, 이미 영구히
        // 획득해 badgesEarned에 남아있는 배지가 하루 결석만으로 배지 화면에서
        // 미획득으로 되돌아가 버리는(홈/MY의 '획득 배지' 개수와 모순되는) 문제를 막는다.
        var on = S.badgesEarned && S.badgesEarned.indexOf(b.id) > -1;
        return '<div class="badge-item' + (on ? " on" : "") + '"><div class="b-ic">' + b.emoji + "</div><b>" + esc(b.name) + "</b><span>" + esc(b.desc) + "</span></div>";
      }).join("") + "</div>";
  }
  function openGoalEdit() {
    openModal('<h3>일일 학습 목표 설정</h3>' +
      '<label class="ob-hint">하루 목표 시간(분)</label>' +
      '<input id="goal-input" class="ob-input" type="number" min="10" max="600" step="10" value="' + S.goals.dailyMinutes + '" style="margin:6px 0 16px" />' +
      '<button class="btn-grad big" data-action="goal-save">저장하기</button>');
  }
  function saveGoal() {
    var v = parseBoundedInt($("#goal-input").value, GOAL_MIN_MINUTES, GOAL_MAX_MINUTES);
    if (v === null) { toast("목표 시간은 " + GOAL_MIN_MINUTES + "~" + GOAL_MAX_MINUTES + "분 사이로 설정해주세요"); return; }
    S.goals.dailyMinutes = v; S.goals.updatedAt = Date.now();
    save();
    // 목표 시간을 낮춰서 오늘 이미 기록한 공부시간이 새 목표를 넘게 되는 경우가
    // 있다. addLog()에서는 매번 checkGoalHit()을 호출해 목표 달성을 인식하지만,
    // 목표 자체를 수정하는 이 경로에서는 지금까지 호출되지 않아 goalHitDates에
    // 오늘 날짜가 추가되지 않고 goal-1/goal-10 배지도 못 받는 문제가 있었다.
    checkGoalHit();
    checkAndAwardBadges();
    closeModal(); switchTab("goals"); toast("목표를 저장했어요");
  }

  /* ---------------- MY ---------------- */
  var RELATED_APPS = [
    { href: "/exam-dday-study/", label: "합격 D-DAY", emoji: "📆" },
    { href: "/suneung-planner/", label: "수능 플래너", emoji: "🗓️" },
    { href: "/naesin-grade-sim/", label: "내신 등급 시뮬" },
    { href: "/toeic-planner/", label: "토익 플래너", emoji: "🗣️" }
  ];
  function renderMy() {
    var stats = currentStats();
    var subjectsLabel = S.profile.subjects.map(function (id) { var r = roomById(id); return r ? r.name : ""; }).filter(Boolean).join(", ") || "선택한 과목 없음";
    var slot = TIME_SLOTS.find(function (t) { return t.id === S.profile.timeSlot; });
    return '' +
      '<div class="my-profile">' + myAvatarSpan(60) +
      '<div><b>' + esc(S.profile.nickname || "학습자") + "</b><span>" + esc(subjectsLabel) + "</span>" +
      (slot ? '<span style="display:block">' + slot.emoji + " " + esc(slot.label) + "</span>" : "") + "</div></div>" +
      '<div class="my-stat-row">' +
      '<div class="my-stat"><b>' + fmtMin(stats.totalMinutes) + "</b><span>누적 학습</span></div>" +
      '<div class="my-stat"><b>' + stats.streak + '일</b><span>연속 스트릭</span></div>' +
      '<div class="my-stat"><b>' + (S.badgesEarned ? S.badgesEarned.length : 0) + "개</b><span>배지</span></div>" +
      "</div>" +
      '<div class="menu">' +
      '<button class="menu-item" data-action="open-profile-edit"><span class="m-ic">✏️</span>프로필 수정<span class="m-arrow">›</span></button>' +
      '<button class="menu-item" data-action="switch-tab" data-tab="goals"><span class="m-ic">🎯</span>목표 &amp; 배지<span class="m-arrow">›</span></button>' +
      '<button class="menu-item" data-action="show-guardian"><span class="m-ic">🛡️</span>보호자 안내<span class="m-arrow">›</span></button>' +
      '<button class="menu-item danger" data-action="open-reset-confirm"><span class="m-ic">🗑️</span>내 데이터 초기화<span class="m-arrow">›</span></button>' +
      "</div>" +
      '<div class="sec"><h2>관련 학습 도구</h2></div>' +
      '<div class="my-rooms-row">' + RELATED_APPS.map(function (a) {
        return '<a class="my-room-chip" href="' + a.href + '" target="_blank" rel="noopener">' + (a.emoji || "🔗") + " " + esc(a.label) + "</a>";
      }).join("") + "</div>" +
      '<div class="sec"><h2>📎 문구·학습용품</h2></div>' +
      coupangSlotHTML("tsc-my") +
      '<div class="legal-footer"><p>🍅🥚🐈 <a href="/">TomatoEggCat</a> — 일상에 유용한 무료 도구 모음</p>' +
      '<p><a href="/about.html">소개</a>·<a href="/privacy.html">개인정보처리방침</a>·<a href="/terms.html">이용약관</a>·<a href="/contact.html">문의</a></p></div>';
  }

  function openProfileEdit() {
    var grad = AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length];
    openModal('<h3>프로필 수정</h3>' +
      '<div class="avatar-preview" id="pe-preview" style="background:linear-gradient(135deg,' + grad[0] + "," + grad[1] + ')">' + S.profile.avatarEmoji + "</div>" +
      '<label class="ob-hint">별명</label>' +
      // ob-nickname과 동일한 이유로 maxlength는 안전 여유값(코드포인트 상한의 2배)만
      // 두고, 실제 상한은 아래 input 리스너에서 코드포인트 기준으로 강제한다.
      '<input id="pe-nickname" class="ob-input" maxlength="' + (NICK_MAX_LEN * 2) + '" value="' + esc(S.profile.nickname) + '" style="margin:6px 0 14px" />' +
      '<label class="ob-hint">아바타</label>' +
      '<div class="avatar-grid" id="pe-avatar-grid" style="margin:6px 0 14px">' + AVATAR_EMOJIS.map(function (e) {
        return '<button class="av-opt' + (S.profile.avatarEmoji === e ? " on" : "") + '" style="background:linear-gradient(135deg,' + grad[0] + "," + grad[1] + ')" data-pe-emoji="' + e + '">' + e + "</button>";
      }).join("") + "</div>" +
      '<div class="grad-row" id="pe-grad-row" style="margin:0 0 16px">' + AVATAR_GRADIENTS.map(function (g, i) {
        return '<button class="grad-opt' + (S.profile.gradIdx === i ? " on" : "") + '" style="background:linear-gradient(135deg,' + g[0] + "," + g[1] + ')" data-pe-grad="' + i + '"></button>';
      }).join("") + "</div>" +
      '<label class="ob-hint">관심 과목/시험</label>' +
      '<div class="chip-grid" id="pe-subjects" style="margin:6px 0 14px">' + ROOMS.map(function (r) {
        return '<button class="chip' + (S.profile.subjects.indexOf(r.id) > -1 ? " on" : "") + '" data-pe-subject="' + r.id + '">' + r.emoji + " " + esc(r.name) + "</button>";
      }).join("") + "</div>" +
      '<label class="ob-hint">공부 시간대</label>' +
      '<div class="chip-grid" id="pe-timeslot" style="margin:6px 0 18px">' + TIME_SLOTS.map(function (t) {
        return '<button class="chip' + (S.profile.timeSlot === t.id ? " on" : "") + '" data-pe-slot="' + t.id + '">' + t.emoji + " " + esc(t.label) + "</button>";
      }).join("") + "</div>" +
      '<button class="btn-grad big" data-action="profile-save">저장하기</button>');

    var tempEmoji = S.profile.avatarEmoji, tempGradIdx = S.profile.gradIdx, tempSubjects = S.profile.subjects.slice(), tempSlot = S.profile.timeSlot;
    function refreshPreview() {
      var g = AVATAR_GRADIENTS[tempGradIdx % AVATAR_GRADIENTS.length];
      $("#pe-preview").style.background = "linear-gradient(135deg," + g[0] + "," + g[1] + ")";
      $("#pe-preview").textContent = tempEmoji;
    }
    $("#pe-avatar-grid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pe-emoji]"); if (!b) return;
      tempEmoji = b.getAttribute("data-pe-emoji");
      $all("#pe-avatar-grid .av-opt").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on"); refreshPreview();
    });
    $("#pe-grad-row").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pe-grad]"); if (!b) return;
      tempGradIdx = parseInt(b.getAttribute("data-pe-grad"), 10);
      $all("#pe-grad-row .grad-opt").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on"); refreshPreview();
    });
    $("#pe-subjects").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pe-subject]"); if (!b) return;
      var id = b.getAttribute("data-pe-subject");
      var i = tempSubjects.indexOf(id);
      if (i > -1) { tempSubjects.splice(i, 1); b.classList.remove("on"); } else { tempSubjects.push(id); b.classList.add("on"); }
    });
    $("#pe-timeslot").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pe-slot]"); if (!b) return;
      tempSlot = b.getAttribute("data-pe-slot");
      $all("#pe-timeslot .chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
    });
    var peNickInput = $("#pe-nickname");
    peNickInput.addEventListener("input", function () {
      // 온보딩 닉네임 입력과 동일하게, 서로게이트 페어 이모지가 중간에서 잘리지
      // 않도록 코드포인트 기준으로 즉시 상한을 강제한다.
      var v = truncateByCodePoints(peNickInput.value, NICK_MAX_LEN);
      if (v !== peNickInput.value) peNickInput.value = v;
    });
    window.__tscProfileSave = function () {
      // 온보딩(obValidateCurrent)과 마찬가지로 하한뿐 아니라 상한도 명시적으로
      // 재검증한다. HTML maxlength는 키보드/붙여넣기를 완전히 막지 못하고, 이
      // 코드가 없으면 상한 검증이 HTML 속성에만 의존하는 비일관성이 생긴다.
      var nick = truncateByCodePoints($("#pe-nickname").value.trim(), NICK_MAX_LEN);
      if (codePointLength(nick) < NICK_MIN_LEN) { toast("별명을 " + NICK_MIN_LEN + "자 이상 입력해주세요"); return; }
      if (!tempSubjects.length) { toast("관심 과목을 1개 이상 골라주세요"); return; }
      if (!tempSlot) { toast("공부 시간대를 골라주세요"); return; }
      S.profile.nickname = nick;
      S.profile.avatarEmoji = tempEmoji;
      S.profile.gradIdx = tempGradIdx;
      S.profile.subjects = tempSubjects;
      S.profile.timeSlot = tempSlot;
      S.profile.updatedAt = Date.now();
      save();
      closeModal();
      switchTab("my");
      toast("프로필을 저장했어요");
    };
  }

  function openResetConfirm() {
    openModal('<h3>정말 초기화할까요?</h3>' +
      '<p class="muted" style="font-size:13.5px;margin-bottom:18px">프로필, 공부 기록, 스트릭, 배지가 이 기기에서 모두 삭제돼요. 되돌릴 수 없어요.</p>' +
      '<button class="btn-danger" style="width:100%;margin-bottom:10px" data-action="confirm-reset">초기화하기</button>' +
      '<button class="btn-ghost" style="width:100%" data-action="close-modal">취소</button>');
  }
  function confirmReset() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (e) {
      // 삭제가 실패했는데도 reload만 하면 사용자는 '초기화됨'으로 오인하지만
      // 실제로는 데이터가 남아있을 수 있다. 실패 시 reload하지 않고 명확히 알린다.
      toast("⚠️ 초기화에 실패했어요. 브라우저 저장공간 설정을 확인한 뒤 다시 시도해주세요.");
      return;
    }
    location.reload();
  }

  /* ---------------- 보호자 안내 ---------------- */
  var guardianReturnTo = "main";
  function showGuardian(from) {
    guardianReturnTo = from || (S && S.onboarded ? "main" : "welcome");
    var html = '' +
      '<section class="overlay-scr">' +
      '<div class="ov-top"><button class="ov-back" data-action="close-guardian">‹</button><div class="ov-title">🛡️ 보호자 안내</div></div>' +
      '<div class="ov-body guardian-body">' +
      '<div class="g-block"><h3>👋 누구를 위한 앱인가요?</h3><ul>' +
      "<li>스터디서클은 만 14~19세 중고생을 위한 학습 동기부여 앱이에요.</li>" +
      "<li>목적은 공부 습관 형성, 시간 관리, 또래와의 건전한 동기부여예요.</li>" +
      "<li>가입 절차 없이 이 기기(브라우저)에서만 동작하는 무료 웹앱입니다.</li>" +
      "</ul></div>" +
      '<div class="g-block g-safe"><h3>✅ 이 앱에서 할 수 없는 것</h3><ul>' +
      "<li>다른 사용자와의 1:1 개인 메시지, DM, 채팅 기능이 없어요.</li>" +
      "<li>사진을 업로드할 수 없어요. 아바타는 이모지 + 색상으로만 표현돼요.</li>" +
      "<li>위치·거리 기반으로 다른 사람을 찾는 기능이 없어요.</li>" +
      "<li>실명, 전화번호, 학교명 등 구체적인 개인정보를 요구하지 않아요.</li>" +
      "<li>자유롭게 글을 쓰는 댓글 기능이 없어요.</li>" +
      "</ul></div>" +
      '<div class="g-block"><h3>💬 다른 참가자와는 어떻게 소통하나요?</h3><ul>' +
      '<li>정해진 문구(예: "화이팅 👏", "나도 할래요! 🙋")를 탭하는 프리셋 리액션만 가능해요.</li>' +
      "<li>공개된 스터디룸 피드에서 서로의 공부 인증만 볼 수 있어요.</li>" +
      "<li>리더보드·피드의 다른 참가자 활동 중 일부는 체험을 위한 샘플(가상) 데이터예요.</li>" +
      "</ul></div>" +
      '<div class="g-block"><h3>📱 데이터는 어디에 저장되나요?</h3><ul>' +
      "<li>닉네임, 공부 기록, 목표, 배지는 모두 이 기기의 브라우저(localStorage)에만 저장돼요.</li>" +
      "<li>서버로 전송되지 않고, 다른 기기와 동기화되지 않아요.</li>" +
      "<li>MY 탭 &gt; 데이터 초기화로 언제든지 완전히 삭제할 수 있어요.</li>" +
      "</ul></div>" +
      '<div class="g-block g-notsafe"><h3>👪 보호자를 위한 안내</h3><ul>' +
      "<li>자녀가 이 앱에서 실제로 낯선 사람과 사적으로 연락할 방법은 없습니다.</li>" +
      "<li>학습 시간과 함께 휴식·수면 시간도 균형 있게 챙길 수 있도록 대화해주세요.</li>" +
      "<li>브라우저 설정에서 사용 기록을 언제든 확인·삭제할 수 있어요.</li>" +
      '<li>문의사항은 <a href="/contact.html" target="_blank" rel="noopener">문의 페이지</a>로 남겨주세요.</li>' +
      "</ul></div>" +
      '<button class="btn-grad big" style="margin:6px 16px 0;width:calc(100% - 32px)" data-action="close-guardian">확인했어요</button>' +
      "</div></section>";
    $("#overlay-root").innerHTML = html;
  }
  function closeGuardian() {
    $("#overlay-root").innerHTML = "";
    if (guardianReturnTo === "welcome") goWelcome();
  }

  /* ---------------- 이벤트 위임 ---------------- */
  function handleAction(action, el) {
    switch (action) {
      case "start-app":
        if (S.onboarded) goMain(); else goOnboarding();
        break;
      case "show-guardian": showGuardian(S.onboarded ? "main" : "welcome"); break;
      case "close-guardian": closeGuardian(); break;
      case "close-overlay": closeOverlay(); break;
      case "close-modal": closeModal(); break;
      case "switch-tab":
        closeOverlay();
        if (el.dataset.preroom) { S.timer.roomId = el.dataset.preroom; S.timer.updatedAt = Date.now(); save(); }
        switchTab(el.dataset.tab);
        break;
      case "open-room": openRoom(el.dataset.room); break;
      case "room-subtab": overlaySubtab = el.dataset.sub; renderRoomOverlay(); break;
      case "toggle-join": toggleJoin(el.dataset.room); break;
      case "filter-room": filterRoom(el.dataset.cat); break;
      case "send-reaction": sendReaction(el.dataset.entry, el.dataset.reaction); break;
      case "open-manual-log": openManualLog(); break;
      case "modal-manual-submit": {
        var roomId = $("#ml-room").value;
        var mins = parseBoundedInt($("#ml-minutes").value, MANUAL_MIN_MINUTES, MANUAL_MAX_MINUTES);
        if (mins === null) { toast("공부 시간은 " + MANUAL_MIN_MINUTES + "~" + MANUAL_MAX_MINUTES + "분 사이로 입력해주세요"); return; }
        // addLog()가 false를 반환하면 저장이 실패한 것이므로(이미 실패 토스트가 떴다)
        // 모달을 닫거나 '기록했어요!' 성공 토스트를 띄우지 않고 재시도할 수 있게 둔다.
        if (!addLog(roomId, mins, "manual")) return;
        closeModal();
        switchTab(currentTab === "timer" ? "timer" : currentTab);
        updateStreakBadge();
        toast(fmtMin(mins) + " 기록했어요! 🎉");
        break;
      }
      case "manual-log-submit": {
        var r2 = $("#manual-room-select").value;
        var m2 = parseBoundedInt($("#manual-minutes-input").value, MANUAL_MIN_MINUTES, MANUAL_MAX_MINUTES);
        if (m2 === null) { toast("공부 시간은 " + MANUAL_MIN_MINUTES + "~" + MANUAL_MAX_MINUTES + "분 사이로 입력해주세요"); return; }
        if (!addLog(r2, m2, "manual")) return;
        updateStreakBadge();
        switchTab("timer");
        toast(fmtMin(m2) + " 기록했어요! 🎉");
        break;
      }
      case "timer-mode": timerMode = el.dataset.mode; switchTab("timer"); break;
      case "timer-start": timerStart(); break;
      case "timer-pause": timerPause(); break;
      case "timer-reset": timerReset(); break;
      case "timer-preset": timerSetPreset(parseInt(el.dataset.focus, 10), parseInt(el.dataset.break, 10)); break;
      case "open-timer-room-picker": openTimerRoomPicker(); break;
      case "select-timer-room": pickTimerRoom(el.dataset.room); break;
      case "open-goal-edit": openGoalEdit(); break;
      case "goal-save": saveGoal(); break;
      case "open-profile-edit": openProfileEdit(); break;
      case "profile-save": if (window.__tscProfileSave) window.__tscProfileSave(); break;
      case "open-reset-confirm": openResetConfirm(); break;
      case "confirm-reset": confirmReset(); break;
      case "pick-emoji": S.profile.avatarEmoji = el.dataset.emoji; S.profile.updatedAt = Date.now(); save(); renderObStep(); break;
      case "pick-grad": S.profile.gradIdx = parseInt(el.dataset.idx, 10); S.profile.updatedAt = Date.now(); save(); renderObStep(); break;
      case "toggle-subject": {
        var rid = el.dataset.room;
        var i = S.profile.subjects.indexOf(rid);
        if (i > -1) S.profile.subjects.splice(i, 1); else S.profile.subjects.push(rid);
        S.profile.updatedAt = Date.now();
        save(); renderObStep();
        break;
      }
      case "pick-timeslot": S.profile.timeSlot = el.dataset.slot; S.profile.updatedAt = Date.now(); save(); renderObStep(); break;
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    handleAction(el.dataset.action, el);
  });

  /* ---------------- 멀티탭 동기화 ---------------- */
  // 이 앱은 여러 탭에서 동시에 열릴 수 있는데, localStorage는 탭 간 자동 동기화가 안 된다.
  // 손을 대지 않으면 나중에 save()를 호출한 탭이 다른 탭에서 기록한 상태를 통째로
  // 덮어써 조용히 유실된다(last-write-wins). 여기서는 다른 탭이 저장한 로그/참여룸/배지/
  // 목표달성일을 id/값 기준으로 합치고(union), pomoCount/goals/timer/profile/reactionsSent도
  // 각 필드 특성에 맞는 방식으로 합쳐 유실을 막는다.
  function mergeExternalArrayField(key, idField) {
    // idField가 있으면 객체 배열(id로 중복 판단), 없으면 원시값 배열(값 자체로 중복 판단)
    return function (incomingArr, existingArr) {
      var seen = {};
      existingArr.forEach(function (item) {
        seen[idField ? item[idField] : item] = true;
      });
      var added = false;
      incomingArr.forEach(function (item) {
        var k = idField ? item && item[idField] : item;
        if (k == null || seen[k]) return;
        seen[k] = true;
        existingArr.push(item);
        added = true;
      });
      return added;
    };
  }
  var mergeLogsArr = mergeExternalArrayField("logs", "id");
  var mergePrimitiveArr = mergeExternalArrayField("primitive", null);

  // goals/timer/profile처럼 "현재 값"을 나타내는 객체 필드는 union이 불가능하다(예:
  // 목표 분을 90→60으로 줄인 의도적 변경을 union이 뒤집으면 안 됨). 대신 각 객체에
  // 기록해둔 updatedAt(마지막 변경 시각)을 비교해 더 최근에 바뀐 쪽을 채택하는
  // last-write-wins 병합을 쓴다. 이렇게 하면 뒤늦게 save()를 호출한 탭이 이미 다른
  // 탭에서 더 최근에 바뀐 값을 조용히 롤백하지 못한다.
  // reactionsSent 항목을 { v: boolean, t: number(ms) } 형태로 정규화한다.
  // 이 필드를 도입하기 전(불리언만 저장하던 구버전) 데이터와도 호환되도록,
  // 순수 불리언 값은 타임스탬프를 알 수 없으므로 t=0(가장 오래된 것으로 취급)으로
  // 변환해, 타임스탬프가 있는 이후의 어떤 변경에도 항상 밀리게 한다.
  function normalizeReactionEntry(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      var t = Number(raw.t);
      if (!isFinite(t) || t < 0) t = 0;
      return { v: !!raw.v, t: t };
    }
    if (typeof raw === "boolean") return { v: raw, t: 0 };
    return null;
  }
  function mergeLwwObject(incomingObj, existingObj) {
    if (!incomingObj || typeof incomingObj !== "object") return false;
    var incomingTs = Number(incomingObj.updatedAt) || 0;
    var existingTs = Number(existingObj.updatedAt) || 0;
    if (incomingTs <= existingTs) return false;
    Object.keys(incomingObj).forEach(function (k) { existingObj[k] = incomingObj[k]; });
    return true;
  }

  function mergeExternalState(incoming) {
    if (!incoming || typeof incoming !== "object") return false;
    var changed = false;
    if (Array.isArray(incoming.logs)) {
      // load()에서와 마찬가지로, 다른 탭(혹은 구버전)이 저장한 손상/비정상 로그가
      // 그대로 병합되면 totalMinutesAll() 등의 계산이 깨지므로 병합 전에 검증한다.
      var validIncomingLogs = incoming.logs.map(normalizeLogEntry).filter(Boolean);
      changed = mergeLogsArr(validIncomingLogs, S.logs) || changed;
    }
    if (Array.isArray(incoming.joinedRooms)) changed = mergePrimitiveArr(incoming.joinedRooms, S.joinedRooms) || changed;
    if (Array.isArray(incoming.badgesEarned)) changed = mergePrimitiveArr(incoming.badgesEarned, S.badgesEarned) || changed;
    if (Array.isArray(incoming.goalHitDates)) changed = mergePrimitiveArr(incoming.goalHitDates, S.goalHitDates) || changed;
    // pomoCount는 completeTimerPhase()에서만 증가하는 단조 증가 카운터이므로, 두 값 중
    // 더 큰 쪽(=더 많이 완료된 쪽)을 취하면 항상 안전하다(둘 다 반영해도 유실이 없음).
    if (typeof incoming.pomoCount === "number" && isFinite(incoming.pomoCount) && incoming.pomoCount > S.pomoCount) {
      S.pomoCount = incoming.pomoCount;
      changed = true;
    }
    if (incoming.goals && typeof incoming.goals === "object") changed = mergeLwwObject(incoming.goals, S.goals) || changed;
    if (incoming.timer && typeof incoming.timer === "object") changed = mergeLwwObject(incoming.timer, S.timer) || changed;
    if (incoming.profile && typeof incoming.profile === "object") changed = mergeLwwObject(incoming.profile, S.profile) || changed;
    // reactionsSent는 각 항목이 { v: 보냈는지 여부, t: 마지막 변경 시각 } 형태의
    // 켬/끔 레코드다. 예전에는 'incoming[k] && !S.reactionsSent[k]'라는 단방향 OR만
    // 수행해, 탭A에서 리액션을 취소(false)한 직후 탭B가 저장한 예전 스냅샷(true)이
    // 들어오면 탭A의 명시적 취소가 되살아나는 결함이 있었다. 항목별 타임스탬프를
    // 비교해 더 최근에 바뀐 쪽만 채택하는 last-write-wins로 바꿔, "취소했다"는
    // 사실도 "보냈다"는 사실과 동등하게 보존되도록 한다.
    if (incoming.reactionsSent && typeof incoming.reactionsSent === "object" && !Array.isArray(incoming.reactionsSent)) {
      Object.keys(incoming.reactionsSent).forEach(function (k) {
        var inRec = normalizeReactionEntry(incoming.reactionsSent[k]);
        if (!inRec) return;
        var curRec = normalizeReactionEntry(S.reactionsSent[k]);
        if (!curRec || inRec.t > curRec.t) {
          S.reactionsSent[k] = inRec;
          changed = true;
        }
      });
    }
    return changed;
  }

  window.addEventListener("storage", function (e) {
    if (e.key !== LS_KEY || !S) return; // 로드 완료 전이면 무시
    var incoming = null;
    try { incoming = JSON.parse(e.newValue || "null"); } catch (err) { incoming = null; }
    if (!incoming) return;
    var changed = mergeExternalState(incoming);
    if (!changed) return;
    save();
    checkGoalHit();
    checkAndAwardBadges();
    updateStreakBadge();
    if (!$("#scr-main").hidden) switchTab(currentTab);
    toast("다른 탭에서 기록한 공부시간을 동기화했어요");
  });

  /* ---------------- 치명적 오류 복구 화면 ---------------- */
  // load()/초기 렌더링 과정에서 예상치 못한 예외가 발생하면(손상된 데이터 등) 흰 화면으로
  // 멈추는 대신, 사용자가 데이터 초기화로 복구할 수 있는 최소한의 화면을 보여준다.
  function showFatalErrorScreen(err) {
    try { if (window.console && console.error) console.error("[스터디서클] 초기화 실패", err); } catch (e2) {}
    var frame = document.getElementById("frame");
    if (!frame) return;
    frame.innerHTML =
      '<div style="padding:40px 20px;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;min-height:70vh">' +
      '<div style="font-size:44px">😵</div>' +
      "<h2 style=\"margin:0\">문제가 발생했어요</h2>" +
      '<p style="opacity:.7;max-width:320px;line-height:1.6;font-size:14px">저장된 데이터를 불러오는 중 오류가 발생했어요. 아래 버튼으로 초기화하면 다시 사용할 수 있어요.<br>(이 기기에 저장된 기록이 모두 삭제돼요)</p>' +
      '<button id="fatal-reset-btn" style="padding:13px 24px;border-radius:14px;border:0;background:#ef4444;color:#fff;font-weight:700;font-size:15px;cursor:pointer">데이터 초기화하고 다시 시작</button>' +
      "</div>";
    var btn = document.getElementById("fatal-reset-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        try { localStorage.removeItem(LS_KEY); } catch (e3) {}
        location.reload();
      });
    }
  }

  // DOMContentLoaded 핸들러의 try/catch는 load()·최초 화면 렌더링 같은 동기 시작
  // 경로만 보호한다. 앱이 정상적으로 뜬 뒤에 벌어지는 예외 — 예를 들어 단일 위임
  // 클릭 핸들러 handleAction()이나 1초마다 도는 timerTick() setInterval 안에서
  // (멀티탭 병합 후 손상된 데이터 등으로) 던져지는 예외 — 는 어디서도 잡히지 않아
  // 사용자가 흰 화면/먹통 상태에서 복구할 방법이 없었다. window 레벨의 전역
  // 핸들러를 달아, 시작 이후에 발생하는 예외도 동일한 초기화 복구 화면으로 안내한다.
  var fatalErrorShown = false;
  function handleFatalRuntimeError(err) {
    if (fatalErrorShown) return; // 반복 실행되는 setInterval 등에서 같은 오류가 계속 던져져도 한 번만 처리
    fatalErrorShown = true;
    if (timerLoopHandle) { clearInterval(timerLoopHandle); timerLoopHandle = null; }
    showFatalErrorScreen(err);
  }
  window.addEventListener("error", function (e) {
    handleFatalRuntimeError(e && e.error ? e.error : e);
  });
  window.addEventListener("unhandledrejection", function (e) {
    handleFatalRuntimeError(e && e.reason ? e.reason : e);
  });

  /* ---------------- 초기화 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    try {
      load();
      $("#btn-start").addEventListener("click", function () { S.onboarded ? goMain() : goOnboarding(); });
      $("#btn-guardian-from-welcome").addEventListener("click", function () { showGuardian("welcome"); });
      $("#btn-guardian").addEventListener("click", function () { showGuardian("main"); });
      $("#ob-next").addEventListener("click", obNext);
      $("#ob-back").addEventListener("click", obBack);
      $all(".tab").forEach(function (t) { t.addEventListener("click", function () { closeOverlay(); switchTab(t.dataset.tab); }); });

      if (S.onboarded) { goMain(); } else { goWelcome(); }
      ensureTimerLoop();
    } catch (err) {
      showFatalErrorScreen(err);
    }
  });

  // manifest.webmanifest는 이 앱을 PWA로 선언하지만, 서비스워커 등록이 빠져있으면
  // 오프라인에서 앱 셸(HTML/CSS/JS) 자체를 다시 열 수 있다는 보장이 없다(localStorage에
  // 저장된 학습 기록과는 별개 문제). sw.js를 등록해 앱 셸을 캐시하고, 오프라인에서도
  // 흰 화면 대신 앱이 열리도록 한다.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
