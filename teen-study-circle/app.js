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

  /* ---------------- 유틸 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
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
  function roomById(id) { return ROOMS.find(function (r) { return r.id === id; }); }
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
      profile: { nickname: "", avatarEmoji: AVATAR_EMOJIS[0], gradIdx: 0, subjects: [], timeSlot: "", ageConfirmed: false, termsAgreed: false },
      joinedRooms: [],
      logs: [],
      goals: { dailyMinutes: 60 },
      goalHitDates: [],
      badgesEarned: [],
      pomoCount: 0,
      reactionsSent: {},
      timer: { focusMin: 25, breakMin: 5, phase: "focus", remainingSec: 25 * 60, running: false, startedAt: null, roomId: null, todayCount: 0, todayDate: "" }
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
      if (b && typeof b === "object" && !Array.isArray(b) && incoming[k] && typeof incoming[k] === "object" && !Array.isArray(incoming[k])) {
        base[k] = deepMerge(b, incoming[k]);
      } else {
        base[k] = incoming[k];
      }
    });
    return base;
  }

  function load() {
    var parsed = null;
    try { parsed = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { parsed = null; }
    S = deepMerge(DEFAULTS(), parsed || {});
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
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
    if (newly.length) { save(); showBadgeToast(newly[0]); }
    return newly;
  }
  function checkGoalHit() {
    var t = todayByRoomAndTotal().total;
    var today = todayStr();
    if (t >= S.goals.dailyMinutes && S.goalHitDates.indexOf(today) === -1) {
      S.goalHitDates.push(today);
      save();
      toast("오늘의 목표를 달성했어요! 🎯");
    }
  }
  function addLog(roomId, minutes, method) {
    minutes = Math.max(1, Math.round(minutes));
    S.logs.push({ id: uid(), roomId: roomId, date: todayStr(), minutes: minutes, method: method, ts: Date.now() });
    if (S.joinedRooms.indexOf(roomId) === -1) S.joinedRooms.push(roomId);
    save();
    checkGoalHit();
    checkAndAwardBadges();
  }

  /* ---------------- 토스트 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var root = $("#toast-root");
    root.innerHTML = '<div class="toast">' + esc(msg) + "</div>";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { root.innerHTML = ""; }, 2200);
  }
  var badgeToastTimer = null;
  function showBadgeToast(badge) {
    var root = $("#toast-root");
    var el = document.createElement("div");
    el.className = "badge-toast";
    el.innerHTML = "<span>" + badge.emoji + "</span><span>새 배지 획득! " + esc(badge.name) + "</span>";
    root.appendChild(el);
    clearTimeout(badgeToastTimer);
    badgeToastTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2800);
  }

  /* ---------------- 모달 ---------------- */
  function openModal(html) {
    $("#modal-root").innerHTML = '<div class="modal-back" data-action="close-modal"><div class="modal-card" onclick="event.stopPropagation()">' + html + "</div></div>";
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
        '<input class="ob-input" id="ob-nickname" maxlength="10" placeholder="예: 새벽별지기" value="' + esc(S.profile.nickname) + '" />' +
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
    if (nickInput) nickInput.addEventListener("input", function () { S.profile.nickname = nickInput.value; });
    var ageCk = $("#ob-age"); if (ageCk) ageCk.addEventListener("change", function () { S.profile.ageConfirmed = ageCk.checked; });
    var termsCk = $("#ob-terms"); if (termsCk) termsCk.addEventListener("change", function () { S.profile.termsAgreed = termsCk.checked; });
  }

  function obValidateCurrent() {
    var step = OB_STEPS[obIndex];
    if (step === "nickname") {
      var v = (S.profile.nickname || "").trim();
      if (v.length < 2) { toast("별명을 2자 이상 입력해주세요"); return false; }
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
    S.logs.filter(function (l) { return l.roomId === roomId && l.date === today; }).forEach(function (l) {
      entries.push({
        id: l.id, nick: S.profile.nickname || "나", emoji: S.profile.avatarEmoji,
        grad: AVATAR_GRADIENTS[S.profile.gradIdx % AVATAR_GRADIENTS.length],
        minutes: l.minutes, minsAgo: Math.max(0, Math.round((Date.now() - l.ts) / 60000)), sample: false, mine: true
      });
    });
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
            var sent = !!S.reactionsSent[key];
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
    S.reactionsSent[key] = !S.reactionsSent[key];
    save();
    if (S.reactionsSent[key]) toast("응원을 보냈어요 👏");
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
      var roomId = tm.roomId || (S.joinedRooms[0] || ROOMS[0].id);
      addLog(roomId, tm.focusMin, "timer");
      var today = todayStr();
      if (tm.todayDate !== today) { tm.todayDate = today; tm.todayCount = 0; }
      tm.todayCount++;
      S.pomoCount++;
      tm.phase = "break";
      tm.remainingSec = tm.breakMin * 60;
      tm.running = false; tm.startedAt = null;
      save();
      toast("포커스 완료! " + tm.breakMin + "분 쉬어가요 🌿");
      checkAndAwardBadges();
    } else {
      tm.phase = "focus";
      tm.remainingSec = tm.focusMin * 60;
      tm.running = false; tm.startedAt = null;
      save();
      toast("휴식 끝! 다음 포커스를 시작해볼까요? 🔥");
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
    save(); switchTab("timer");
  }
  function timerPause() {
    var tm = S.timer;
    tm.remainingSec = timerDisplayRemaining();
    tm.running = false; tm.startedAt = null;
    save(); switchTab("timer");
  }
  function timerReset() {
    var tm = S.timer;
    tm.remainingSec = (tm.phase === "focus" ? tm.focusMin : tm.breakMin) * 60;
    tm.running = false; tm.startedAt = null;
    save(); switchTab("timer");
  }
  function timerSetPreset(focusMin, breakMin) {
    var tm = S.timer;
    tm.focusMin = focusMin; tm.breakMin = breakMin;
    tm.phase = "focus"; tm.remainingSec = focusMin * 60;
    tm.running = false; tm.startedAt = null;
    save(); switchTab("timer");
  }
  function pickTimerRoom(roomId) {
    S.timer.roomId = roomId; save(); closeModal(); switchTab("timer");
  }

  function renderTimer() {
    var tm = S.timer;
    var room = roomById(tm.roomId) || roomById(S.joinedRooms[0]) || ROOMS[0];
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
    var stats = currentStats();
    return '' +
      '<div class="sec"><h2>오늘의 목표</h2></div>' +
      '<div class="goal-card"><div class="goal-top"><b>일일 학습 목표</b><button class="btn-sm" data-action="open-goal-edit">수정</button></div>' +
      '<div class="goal-bar"><div class="goal-bar-fg" style="width:' + pct + '%"></div></div>' +
      '<div class="goal-foot"><span>' + fmtMin(t) + " / " + fmtMin(goal) + "</span><span>" + pct + "%</span></div></div>" +
      '<div class="sec"><h2>배지 컬렉션</h2><p class="sec-sub">' + (S.badgesEarned ? S.badgesEarned.length : 0) + " / " + BADGES.length + "개 획득</p></div>" +
      '<div class="badge-grid">' + BADGES.map(function (b) {
        var on = b.check(stats);
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
    var v = parseInt($("#goal-input").value, 10);
    if (!v || v < 10) { toast("10분 이상으로 설정해주세요"); return; }
    S.goals.dailyMinutes = v; save(); closeModal(); switchTab("goals"); toast("목표를 저장했어요");
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
      '<input id="pe-nickname" class="ob-input" maxlength="10" value="' + esc(S.profile.nickname) + '" style="margin:6px 0 14px" />' +
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
    window.__tscProfileSave = function () {
      var nick = $("#pe-nickname").value.trim();
      if (nick.length < 2) { toast("별명을 2자 이상 입력해주세요"); return; }
      if (!tempSubjects.length) { toast("관심 과목을 1개 이상 골라주세요"); return; }
      if (!tempSlot) { toast("공부 시간대를 골라주세요"); return; }
      S.profile.nickname = nick;
      S.profile.avatarEmoji = tempEmoji;
      S.profile.gradIdx = tempGradIdx;
      S.profile.subjects = tempSubjects;
      S.profile.timeSlot = tempSlot;
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
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
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
        if (el.dataset.preroom) { S.timer.roomId = el.dataset.preroom; save(); }
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
        var mins = parseInt($("#ml-minutes").value, 10);
        if (!mins || mins < 1) { toast("공부 시간을 입력해주세요"); return; }
        addLog(roomId, mins, "manual");
        closeModal();
        switchTab(currentTab === "timer" ? "timer" : currentTab);
        updateStreakBadge();
        toast(fmtMin(mins) + " 기록했어요! 🎉");
        break;
      }
      case "manual-log-submit": {
        var r2 = $("#manual-room-select").value;
        var m2 = parseInt($("#manual-minutes-input").value, 10);
        if (!m2 || m2 < 1) { toast("공부 시간을 입력해주세요"); return; }
        addLog(r2, m2, "manual");
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
      case "pick-emoji": S.profile.avatarEmoji = el.dataset.emoji; save(); renderObStep(); break;
      case "pick-grad": S.profile.gradIdx = parseInt(el.dataset.idx, 10); save(); renderObStep(); break;
      case "toggle-subject": {
        var rid = el.dataset.room;
        var i = S.profile.subjects.indexOf(rid);
        if (i > -1) S.profile.subjects.splice(i, 1); else S.profile.subjects.push(rid);
        save(); renderObStep();
        break;
      }
      case "pick-timeslot": S.profile.timeSlot = el.dataset.slot; save(); renderObStep(); break;
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    handleAction(el.dataset.action, el);
  });

  /* ---------------- 초기화 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    load();
    $("#btn-start").addEventListener("click", function () { S.onboarded ? goMain() : goOnboarding(); });
    $("#btn-guardian-from-welcome").addEventListener("click", function () { showGuardian("welcome"); });
    $("#btn-guardian").addEventListener("click", function () { showGuardian("main"); });
    $("#ob-next").addEventListener("click", obNext);
    $("#ob-back").addEventListener("click", obBack);
    $all(".tab").forEach(function (t) { t.addEventListener("click", function () { closeOverlay(); switchTab(t.dataset.tab); }); });

    if (S.onboarded) { goMain(); } else { goWelcome(); }
    ensureTimerLoop();
  });
})();
