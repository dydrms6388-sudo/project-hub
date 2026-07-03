/* PRISM — 게이 데이팅 PWA (클라이언트 사이드 데모)
   모든 데이터는 이 기기(localStorage)에만 저장됩니다. */
(function () {
  "use strict";
  const D = window.PRISM_DATA || { profiles: [], replyStyles: {}, icebreakers: [], dailyQuestions: [], safetyTips: [] };
  const LS = "prism:v1";
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  /* ── 상태 ── */
  const DEFAULTS = () => ({
    user: null,
    premium: { plan: "free", since: null },
    day: todayStr(), likesUsed: 0, supersUsed: 0,
    boostMonth: null, boostUntil: 0,
    liked: [], passed: [], blocked: [], superliked: [],
    incoming: [], seenIncoming: [],
    matches: [], // {pid, at, unread}
    chats: {},   // pid -> [{who,t,at}]
    votes: {},
    lastSwipe: null,
    settings: { pin: null, hideDistance: false, privateMode: false, bgLock: true, disguise: false, fontScale: 0 },
    filters: { ageMin: 20, ageMax: 45, area: "all", looking: "all" },
    stats: { likesSent: 0, matches: 0 },
    items: { teleport: 0, spotlight: 0, superlike: 0, boostticket: 0, refill: 0, gachaticket: 0 },
    fx: { teleport: null, spotlightUntil: 0 }, // teleport: {region, until}
    cards: {}, // charId -> {n, lv}
    gacha: { day: "", freeUsed: false, pity: 0 },
    joinedAt: Date.now(),
  });
  let S;
  try { S = Object.assign(DEFAULTS(), JSON.parse(localStorage.getItem(LS) || "null") || {}); }
  catch (e) { S = DEFAULTS(); }
  // 구버전 저장 데이터 마이그레이션
  S.items = Object.assign({ teleport: 0, spotlight: 0, superlike: 0, boostticket: 0, refill: 0, gachaticket: 0 }, S.items || {});
  S.fx = Object.assign({ teleport: null, spotlightUntil: 0 }, S.fx || {});
  S.cards = S.cards || {};
  S.gacha = Object.assign({ day: "", freeUsed: false, pity: 0 }, S.gacha || {});
  S.settings = Object.assign({ pin: null, hideDistance: false, privateMode: false, bgLock: true, disguise: false, fontScale: 0 }, S.settings || {});
  S.filters = Object.assign({ ageMin: 20, ageMax: 45, area: "all", looking: "all" }, S.filters || {});
  S.stats = Object.assign({ likesSent: 0, matches: 0 }, S.stats || {});
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  const PLANS = {
    free:  { label: "무료",        likes: 20, supers: 1, seeLikes: false, rewind: false, boost: 0, ads: true,  read: false },
    plus:  { label: "PRISM+",      likes: Infinity, supers: 1, seeLikes: true, rewind: true, boost: 1, ads: false, read: false },
    black: { label: "PRISM Black", likes: Infinity, supers: 5, seeLikes: true, rewind: true, boost: 4, ads: false, read: true },
  };
  const plan = () => PLANS[S.premium.plan] || PLANS.free;
  const P = (id) => D.profiles.find((p) => p.id === id);

  /* ── 아이템 상점 (소모품 수익) ── */
  const SHOP = [
    { key: "teleport", em: "🌏", name: "텔레포트", desc: "24시간 동안 원하는 지역으로 순간이동 — 그 동네 사람들이 먼저 보여요", packs: [{ n: 1, price: 3500 }, { n: 3, price: 8900 }] },
    { key: "spotlight", em: "✨", name: "스포트라이트", desc: "3시간 동안 내 프로필 상단 고정 노출 — 좋아요가 쏟아져요", packs: [{ n: 1, price: 2500 }, { n: 5, price: 9900 }] },
    { key: "superlike", em: "⭐", name: "슈퍼라이크 팩", desc: "일일 한도와 무관하게 쓰는 슈퍼라이크 5개", packs: [{ n: 5, price: 4500 }] },
    { key: "boostticket", em: "🚀", name: "부스트 1회권", desc: "플랜과 무관하게 30분 부스트 — 무료 플랜도 OK", packs: [{ n: 1, price: 3900 }] },
    { key: "refill", em: "💜", name: "좋아요 리필", desc: "오늘의 좋아요 20개 즉시 충전", packs: [{ n: 1, price: 1900 }] },
    { key: "gachaticket", em: "🎴", name: "크러시 팩 뽑기권", desc: "크러시 카드 1장 뽑기 — SSR 홀로그램에 도전!", packs: [{ n: 1, price: 1500 }, { n: 10, price: 12900 }] },
  ];
  const itemDiscount = () => (S.premium.plan === "black" ? 0.15 : S.premium.plan === "plus" ? 0.05 : 0);
  const itemPrice = (base) => Math.round(base * (1 - itemDiscount()) / 100) * 100;
  const won = (n) => n.toLocaleString("ko-KR") + "원";
  const teleportActive = () => S.fx.teleport && Date.now() < S.fx.teleport.until ? S.fx.teleport : null;
  const spotlightActive = () => Date.now() < S.fx.spotlightUntil;

  /* ── 크러시 카드 버프 (게임 ↔ 매칭 루프 연결) ── */
  const CD = window.PRISM_CARDS || { CHARS: [], RARITY: {}, charSVG: () => "" };
  const cardOf = (id) => CD.CHARS.find((c) => c.id === id);
  const cardLikeBonus = () => Math.min(20, Object.values(S.cards).reduce((a, c) => a + (c.lv - 1) * 2, 0));
  const cardSuperBonus = () => Math.min(2, Object.keys(S.cards).filter((id) => (cardOf(id) || {}).rarity === "SSR").length);
  const likeLimit = () => plan().likes === Infinity ? Infinity : plan().likes + cardLikeBonus();
  const superLimit = () => plan().supers + cardSuperBonus();
  const gachaFreeMax = () => (S.premium.plan === "black" ? 2 : 1); // Black: 매일 무료 뽑기 2회
  const gachaFreeLeft = () => S.gacha.day !== todayStr() ? gachaFreeMax() : Math.max(0, gachaFreeMax() - (S.gacha.freeCount || 0));
  const gachaFreeAvail = () => gachaFreeLeft() > 0;

  /* ── 일일 리셋 & 새 좋아요 유입 ── */
  function dailyTick() {
    const t = todayStr();
    let dirty = false;
    if (S.day !== t) {
      S.day = t; S.likesUsed = 0; S.supersUsed = 0;
      seedIncoming(1 + Math.floor(Math.random() * 2));
      dirty = true;
    }
    if (S.user && !S.incoming.length && !S.seenIncoming.length) { seedIncoming(3); dirty = true; }
    if (dirty) save(); // 변경 없을 땐 저장 안 함 (다른 탭/시드 상태 덮어쓰기 방지)
  }
  function seedIncoming(n) {
    if (S.settings.privateMode) return; // 프라이빗 모드: 새 노출 중단
    const used = new Set([...S.incoming, ...S.matches.map((m) => m.pid), ...S.blocked]);
    const pool = D.profiles.filter((p) => !used.has(p.id));
    const pri = pool.filter((p) => p.likedYou);
    const rest = pool.filter((p) => !p.likedYou);
    for (let i = 0; i < n; i++) {
      const src = pri.length ? pri : rest;
      if (!src.length) break;
      const pick = src.splice(Math.floor(Math.random() * src.length), 1)[0];
      S.incoming.push(pick.id);
    }
  }

  /* ── 지역 인식 거리 ── */
  const AREA_GROUP = { 천안: "충청", 청주: "충청", 전주: "전라", 순천: "전라", 포항: "경상", 창원: "경상" };
  const groupOf = (a) => AREA_GROUP[a] || a;
  const myArea = () => ((S.user && S.user.region) || "").split(" ")[0];
  const areaOf = (p) => p.region.split(" ")[0];
  const sameArea = (p) => {
    const tp = teleportActive();
    if (tp) return groupOf(areaOf(p)) === groupOf(tp.region);
    return groupOf(areaOf(p)) === groupOf(myArea());
  };
  function distLabel(p) {
    if (S.settings.hideDistance) return `📍 ${esc(p.region)}`;
    return sameArea(p) ? `📍 ${esc(p.region)} · ${p.distanceKm}km` : `📍 ${esc(p.region)} · 다른 지역`;
  }

  /* ── 궁합 점수 (하한 없음 — 실제 분산 노출) ── */
  function compat(p) {
    if (!S.user) return 70;
    let sc = 42;
    const shared = p.tags.filter((t) => S.user.tags.includes(t));
    sc += Math.min(32, shared.length * 8);
    if (p.lastActiveMin < 60) sc += 8; else if (p.lastActiveMin < 720) sc += 4;
    if (sameArea(p)) { sc += 8; if (p.distanceKm < 5) sc += 6; else if (p.distanceKm < 15) sc += 3; }
    if (p.lookingFor === S.user.lookingFor) sc += 6;
    return Math.max(31, Math.min(99, sc));
  }
  const sharedTags = (p) => (S.user ? p.tags.filter((t) => S.user.tags.includes(t)) : []);

  /* ── 토스트/모달 ── */
  function toast(msg, ms) {
    const t = document.createElement("div");
    t.className = "toast"; t.innerHTML = msg;
    $("#toast-root").appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 320); }, ms || 2200);
  }
  function modal(html, opts) {
    const back = document.createElement("div");
    back.className = "modal-back" + ((opts && opts.center) ? " center" : "");
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.innerHTML = html;
    back.addEventListener("click", (e) => { if (e.target === back && !(opts && opts.sticky)) back.remove(); });
    $("#modal-root").appendChild(back);
    return back;
  }
  function confirmDlg(em, title, body, okLabel, onOk, danger) {
    const m = modal(`<div class="dialog"><div class="em">${em}</div><h3>${esc(title)}</h3><p>${body}</p>
      <div class="row"><button class="btn-ghost" data-x>취소</button><button class="btn-grad" data-ok ${danger ? 'style="background:linear-gradient(135deg,#f43f5e,#e11d48)"' : ""}>${esc(okLabel)}</button></div></div>`, { center: true });
    $("[data-x]", m).onclick = () => m.remove();
    $("[data-ok]", m).onclick = () => { m.remove(); onOk && onOk(); };
  }

  /* ── 광고 (무료 티어 수익) ── */
  const HOUSE_ADS = [
    { em: "💓", b: "썸톡 — 카톡 대화 궁합 분석", s: "우리 대화, 썸일까? 무료 분석", href: "/katalk-chemistry/" },
    { em: "💞", b: "썸타이밍 궁합", s: "커플 케미 무료 테스트", href: "/couple-chemistry/" },
    { em: "🎁", b: "선물각 — 선물 추천", s: "데이트 선물 고민 끝", href: "/dydrms-seonmulgak/" },
    { em: "🔮", b: "오늘의 운세", s: "오늘 연애운 확인하기", href: "/today-fortune/" },
  ];
  function adSlot() {
    if (plan().ads === false) return "";
    const a = rnd(HOUSE_ADS);
    return `<a class="ad-slot" href="${a.href}" target="_blank" rel="noopener">
      <span class="ad-tag">AD</span>
      <span class="house"><span class="ha-em">${a.em}</span><span><b>${esc(a.b)}</b><small>${esc(a.s)}</small></span></span></a>`;
  }

  /* ── 화면 전환 ── */
  const SCRS = ["scr-lock", "scr-welcome", "scr-onboarding", "scr-main"];
  function show(id) { SCRS.forEach((s) => { $("#" + s).hidden = s !== id; }); }

  /* ══ PIN 잠금 (해시 저장 · 시도 제한 · 백그라운드 잠금) ══ */
  async function pinHash(pin) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("prism-salt::" + pin));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "plain::" + pin; } // http 폴백 (데모 로컬 테스트)
  }
  const hasPin = () => !!(S.settings.pinHash || S.settings.pin);
  async function checkPin(pin) {
    if (S.settings.pinHash) return (await pinHash(pin)) === S.settings.pinHash;
    return pin === S.settings.pin; // 구버전 평문 (아래 boot에서 자동 마이그레이션)
  }
  let pinFails = 0, pinCoolUntil = 0;
  let locked = false;
  function renderLock(onPass) {
    locked = true;
    show("scr-lock");
    $("#overlay-root").style.visibility = "hidden"; // 잠금 중 오버레이(채팅 등) 완전 은닉
    $("#modal-root").style.visibility = "hidden";
    const unlock = () => {
      locked = false;
      $("#overlay-root").style.visibility = "";
      $("#modal-root").style.visibility = "";
      onPass();
    };
    let buf = "";
    const dots = $("#pin-dots");
    const paint = () => $$("i", dots).forEach((d, i) => d.classList.toggle("f", i < buf.length));
    const pad = $("#pin-pad");
    pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) =>
      k === "" ? "<button class='ghost' disabled></button>" :
      `<button data-k="${k}" ${k === "⌫" ? "class='ghost'" : ""} aria-label="${k === "⌫" ? "지우기" : k}">${k}</button>`).join("");
    pad.onclick = async (e) => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      if (Date.now() < pinCoolUntil) { toast(`잠시 후 다시 시도하세요 (${Math.ceil((pinCoolUntil - Date.now()) / 1000)}초)`); return; }
      const k = b.dataset.k;
      if (k === "⌫") buf = buf.slice(0, -1);
      else if (buf.length < 4) buf += k;
      paint();
      if (buf.length === 4) {
        if (await checkPin(buf)) { buf = ""; pinFails = 0; unlock(); }
        else {
          pinFails++; buf = "";
          if (pinFails >= 5) { pinCoolUntil = Date.now() + 30000; pinFails = 0; toast("5회 오류 — 30초 후 다시 시도하세요"); }
          dots.classList.add("err"); vibrate(80);
          setTimeout(() => { dots.classList.remove("err"); paint(); }, 450);
        }
      }
    };
    paint();
  }
  /* 화면 이탈 시 즉시 잠금 (아우팅 방지 핵심 시나리오) */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { dailyTick(); return; }
    if (hasPin() && S.settings.bgLock && S.user && !locked && !stealthEl) {
      renderLock(() => show("scr-main"));
    }
  });

  /* ══ 온보딩 ══ */
  const REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충청", "전라", "경상", "제주"];
  const LOOKING = ["진지한 연애", "가볍게 친구부터", "천천히 알아가기", "동네 친구", "운동 메이트"];
  const MBTIS = ["ISTJ","ISFJ","INFJ","INTJ","ISTP","ISFP","INFP","INTP","ESTP","ESFP","ENFP","ENTP","ESTJ","ESFJ","ENFJ","ENTJ"];
  const AV_EMOJIS = ["😎","🦊","🐻","🐯","🌊","🔥","🌙","⚡","🎧","🎨","🏀","🌵","🍀","🦁","🐺","🚀"];
  const AV_GRADS = [["#8b5cf6","#ec4899"],["#2563eb","#2dd4bf"],["#f59e0b","#ef4444"],["#10b981","#3b82f6"],["#d946ef","#f43f5e"],["#0ea5e9","#8b5cf6"],["#f97316","#eab308"],["#14b8a6","#a3e635"]];
  const masterTags = () => {
    const set = new Set(); D.profiles.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  };
  let ob = {};
  function startOnboarding() {
    ob = { step: 0, birthYear: "", agree1: false, agree2: false, name: "", region: "서울", town: "",
      height: 175, mbti: "ENFP", lookingFor: LOOKING[0], tags: [], emoji: AV_EMOJIS[0], grad: AV_GRADS[0], intro: "" };
    show("scr-onboarding"); renderOb();
  }
  function renderOb() {
    const steps = [obAge, obName, obBasic, obTags, obAvatar, obIntro];
    $("#ob-fill").style.width = ((ob.step + 1) / steps.length * 100) + "%";
    $("#ob-back").style.visibility = ob.step === 0 ? "hidden" : "visible";
    $("#ob-body").innerHTML = steps[ob.step]();
    bindOb();
    $("#ob-body").scrollTop = 0;
  }
  const obNextBtn = (ok, label) => `<button class="btn-grad big ob-next" id="ob-next" ${ok ? "" : "disabled"}>${label || "다음"}</button>`;
  function obAge() {
    const years = []; const nowY = new Date().getFullYear();
    for (let y = nowY - 19; y >= nowY - 60; y--) years.push(y);
    return `<h2 class="ob-h">환영해요 👋</h2><p class="ob-sub">PRISM은 19세 이상만 이용할 수 있어요.</p>
      <div class="ob-field"><label>출생연도</label>
        <select class="ob-input" id="f-year"><option value="">선택</option>${years.map((y) => `<option ${String(y) === String(ob.birthYear) ? "selected" : ""}>${y}</option>`).join("")}</select></div>
      <label class="agree"><input type="checkbox" id="f-a1" ${ob.agree1 ? "checked" : ""}><span>만 19세 이상이며, <a href="/terms.html" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a>에 동의합니다.</span></label>
      <label class="agree"><input type="checkbox" id="f-a2" ${ob.agree2 ? "checked" : ""}><span>서로를 존중하는 커뮤니티 가이드라인(혐오·차별·괴롭힘 금지)에 동의합니다.</span></label>
      <p class="tiny">입력한 정보는 서버로 전송되지 않고 이 기기에만 저장됩니다. 아우팅 걱정 없이 사용하세요.</p>
      ${obNextBtn(ob.birthYear && ob.agree1 && ob.agree2)}`;
  }
  function obName() {
    return `<h2 class="ob-h">뭐라고 불러드릴까요?</h2><p class="ob-sub">실명이 아니어도 괜찮아요. 프로필에 표시될 닉네임이에요.</p>
      <div class="ob-field"><label>닉네임</label><input class="ob-input" id="f-name" maxlength="10" placeholder="예: 준" value="${esc(ob.name)}"></div>
      <div class="ob-field"><label>지역</label><select class="ob-input" id="f-region">${REGIONS.map((r) => `<option ${r === ob.region ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="ob-field"><label>동네 (선택 · 예: 마포, 해운대)</label><input class="ob-input" id="f-town" maxlength="10" placeholder="구/동 단위, 비워도 돼요" value="${esc(ob.town)}"></div>
      ${obNextBtn(ob.name.trim().length >= 1)}`;
  }
  function obBasic() {
    return `<h2 class="ob-h">기본 정보</h2><p class="ob-sub">매칭 추천에 활용돼요.</p>
      <div class="ob-field"><label>키 — <b id="f-height-v">${ob.height}</b>cm</label>
        <input type="range" id="f-height" min="150" max="200" value="${ob.height}" style="width:100%;accent-color:var(--vio)"></div>
      <div class="ob-field"><label>MBTI</label><select class="ob-input" id="f-mbti">${MBTIS.map((m) => `<option ${m === ob.mbti ? "selected" : ""}>${m}</option>`).join("")}</select></div>
      <div class="ob-field"><label>찾고 있는 관계</label><div class="seg" id="f-looking">${LOOKING.map((l) => `<button class="chip ${l === ob.lookingFor ? "on" : ""}" data-v="${esc(l)}">${esc(l)}</button>`).join("")}</div></div>
      ${obNextBtn(true)}`;
  }
  function obTags() {
    return `<h2 class="ob-h">관심사를 골라주세요</h2><p class="ob-sub">3~5개 · 겹치는 관심사가 많을수록 궁합 점수가 올라가요.</p>
      <div class="chips" id="f-tags">${masterTags().map((t) => `<button class="chip ${ob.tags.includes(t) ? "on" : ""}" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      ${obNextBtn(ob.tags.length >= 3, `다음 (${ob.tags.length}/5)`)}`;
  }
  function obAvatar() {
    return `<h2 class="ob-h">아바타 만들기</h2><p class="ob-sub">사진 대신 아바타로 시작해요. 신원 노출 걱정 없이.</p>
      <div class="av-preview"><span class="avatar" style="width:88px;height:88px;font-size:42px;background:linear-gradient(135deg,${ob.grad[0]},${ob.grad[1]})">${ob.emoji}</span><small>미리보기</small></div>
      <div class="ob-field"><label>이모지</label><div class="avatar-pick" id="f-emoji">${AV_EMOJIS.map((e) => `<button class="av-opt ${e === ob.emoji ? "on" : ""}" data-v="${e}" aria-label="아바타 이모지 ${e}">${e}</button>`).join("")}</div></div>
      <div class="ob-field"><label>배경 색감</label><div class="avatar-pick" id="f-grad">${AV_GRADS.map((g, i) => `<button class="av-opt ${g === ob.grad ? "on" : ""}" data-i="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})" aria-label="배경 색 ${i + 1}"></button>`).join("")}</div></div>
      ${obNextBtn(true)}`;
  }
  function obIntro() {
    return `<h2 class="ob-h">마지막이에요!</h2><p class="ob-sub">나를 보여주는 한두 문장. 구체적일수록 좋은 매치가 와요.</p>
      <div class="ob-field"><label>자기소개</label><textarea class="ob-input" id="f-intro" maxlength="120" placeholder="예: 주말엔 한강 러닝, 밤엔 넷플릭스. 같이 뛰거나 같이 뒹굴 사람 찾아요.">${esc(ob.intro)}</textarea></div>
      ${obNextBtn(true, "PRISM 시작하기 ✨")}`;
  }
  function bindOb() {
    const el = $("#ob-body");
    const re = () => renderOb();
    const on = (sel, ev, fn) => { const n = $(sel, el); if (n) n.addEventListener(ev, fn); };
    on("#f-year", "change", (e) => { ob.birthYear = e.target.value; re(); });
    on("#f-a1", "change", (e) => { ob.agree1 = e.target.checked; re(); });
    on("#f-a2", "change", (e) => { ob.agree2 = e.target.checked; re(); });
    on("#f-name", "input", (e) => { ob.name = e.target.value; $("#ob-next").disabled = !ob.name.trim(); });
    on("#f-town", "input", (e) => { ob.town = e.target.value; });
    on("#f-region", "change", (e) => { ob.region = e.target.value; });
    on("#f-height", "input", (e) => { ob.height = +e.target.value; $("#f-height-v").textContent = ob.height; });
    on("#f-mbti", "change", (e) => { ob.mbti = e.target.value; });
    on("#f-looking", "click", (e) => { const b = e.target.closest(".chip"); if (b) { ob.lookingFor = b.dataset.v; re(); } });
    on("#f-tags", "click", (e) => {
      // 전체 리렌더 없이 in-place 토글 (스크롤·포커스 유지)
      const b = e.target.closest(".chip"); if (!b) return;
      const t = b.dataset.v;
      if (ob.tags.includes(t)) { ob.tags = ob.tags.filter((x) => x !== t); b.classList.remove("on"); }
      else if (ob.tags.length < 5) { ob.tags.push(t); b.classList.add("on"); }
      else { toast("최대 5개까지 고를 수 있어요"); return; }
      const nx = $("#ob-next", el);
      nx.disabled = ob.tags.length < 3;
      nx.textContent = `다음 (${ob.tags.length}/5)`;
    });
    on("#f-emoji", "click", (e) => { const b = e.target.closest(".av-opt"); if (b) { ob.emoji = b.dataset.v; re(); } });
    on("#f-grad", "click", (e) => { const b = e.target.closest(".av-opt"); if (b) { ob.grad = AV_GRADS[+b.dataset.i]; re(); } });
    on("#f-intro", "input", (e) => { ob.intro = e.target.value; });
    on("#ob-next", "click", () => {
      if (ob.step < 5) { ob.step++; renderOb(); }
      else {
        const nowY = new Date().getFullYear();
        S.user = { name: ob.name.trim().slice(0, 10), age: nowY - (+ob.birthYear), region: ob.region + (ob.town.trim() ? " " + ob.town.trim() : ""),
          height: ob.height, mbti: ob.mbti, lookingFor: ob.lookingFor, tags: ob.tags.slice(),
          emoji: ob.emoji, grad: ob.grad.slice(), intro: ob.intro.trim() };
        S.joinedAt = Date.now();
        seedIncoming(3); save();
        enterMain();
        setTimeout(() => toast("🎉 가입 완료! 벌써 " + S.incoming.length + "명이 좋아요를 보냈어요"), 700);
      }
    });
    $("#ob-back").onclick = () => { if (ob.step > 0) { ob.step--; renderOb(); } };
  }

  /* ══ 메인 ══ */
  let tab = "discover";
  function enterMain() { show("scr-main"); paintTopbar(); go("discover"); maybeIncomingMessage(); }
  function paintTopbar() {
    const b = $("#btn-premium-badge");
    b.textContent = plan().label;
    b.className = "tb-premium" + (S.premium.plan === "plus" ? " plus" : S.premium.plan === "black" ? " black" : "");
  }
  function badges() {
    const newLikes = S.incoming.filter((id) => !S.seenIncoming.includes(id)).length;
    const unread = S.matches.reduce((a, m) => a + (m.unread || 0), 0);
    const bl = $("#badge-likes"), bc = $("#badge-chats"), bcd = $("#badge-cards");
    bl.hidden = !newLikes; bl.textContent = newLikes;
    bc.hidden = !unread; bc.textContent = unread;
    if (bcd) { bcd.hidden = !gachaFreeAvail(); bcd.textContent = "!"; }
  }
  function go(t) {
    tab = t;
    $$("#tabbar .tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    const V = { discover: vDiscover, likes: vLikes, chats: vChats, community: vCommunity, cards: vCards, my: vMy };
    $("#view").innerHTML = "";
    V[t]();
    badges();
    $("#view").scrollTop = 0;
  }
  $("#tabbar").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) go(b.dataset.tab); });

  /* ══ 디스커버 ══ */
  let deck = [];
  function buildDeck() {
    const gone = new Set([...S.liked, ...S.passed, ...S.blocked, ...S.matches.map((m) => m.pid)]);
    const tp = teleportActive();
    const F = S.filters;
    deck = D.profiles.filter((p) => !gone.has(p.id))
      .filter((p) => p.age >= F.ageMin && p.age <= F.ageMax)
      .filter((p) => F.area === "all" || sameArea(p))
      .filter((p) => F.looking === "all" || p.lookingFor === F.looking)
      .map((p) => ({ p, sc: compat(p) + Math.random() * 8 + (tp && groupOf(areaOf(p)) === groupOf(tp.region) ? 100 : 0) }))
      .sort((a, b) => b.sc - a.sc).map((x) => x.p);
    // 되돌린 카드는 항상 맨 위로
    if (S.restoredPid) {
      const i = deck.findIndex((p) => p.id === S.restoredPid);
      if (i > 0) deck.unshift(deck.splice(i, 1)[0]);
      S.restoredPid = null;
    }
  }
  function vDiscover() {
    buildDeck();
    const boostOn = Date.now() < S.boostUntil;
    const tp = teleportActive();
    const fxChips = [
      boostOn ? `🚀 부스트 ${Math.ceil((S.boostUntil - Date.now()) / 60000)}분` : "",
      tp ? `🌏 텔레포트: ${esc(tp.region)} ${Math.ceil((tp.until - Date.now()) / 3600000)}시간` : "",
      spotlightActive() ? `✨ 스포트라이트 ${Math.ceil((S.fx.spotlightUntil - Date.now()) / 60000)}분` : "",
    ].filter(Boolean);
    const F = S.filters;
    const filterOn = F.ageMin > 20 || F.ageMax < 45 || F.area !== "all" || F.looking !== "all";
    $("#view").innerHTML = `<div class="disc">
      <div class="fx-row"><button class="fx-chip fx-btn ${filterOn ? "on" : ""}" id="d-filter" aria-label="탐색 필터 설정">⚙️ 필터${filterOn ? " ●" : ""}</button>${fxChips.map((c) => `<span class="fx-chip fx-live">${c}</span>`).join("")}</div>
      <div class="deck" id="deck"></div>
      <div class="actions">
        <div class="act-w"><button class="act md rew" id="a-rew" aria-label="마지막 카드 되돌리기">↩${plan().rewind ? "" : '<span class="lock">🔒</span>'}</button><small>되돌리기</small></div>
        <div class="act-w"><button class="act lg nope" id="a-nope" aria-label="패스">✕</button><small>패스</small></div>
        <div class="act-w"><button class="act md sup" id="a-sup" aria-label="슈퍼라이크 보내기">⭐</button><small>슈퍼</small></div>
        <div class="act-w"><button class="act lg like" id="a-like" aria-label="좋아요 보내기">💜</button><small>좋아요</small></div>
        <div class="act-w"><button class="act md boost" id="a-boost" aria-label="부스트 사용">🚀${plan().boost || S.items.boostticket ? "" : '<span class="lock">🔒</span>'}</button><small>부스트</small></div>
      </div>
      <div class="quota">${likeLimit() === Infinity
        ? `<span>💜 좋아요 <b>무제한</b></span>` : `<span>오늘 좋아요 <b>${Math.max(0, likeLimit() - S.likesUsed)}</b>/${likeLimit()}${cardLikeBonus() ? ` <i class="buff" title="카드 버프">+${cardLikeBonus()}🎴</i>` : ""}</span>`}
        <span>⭐ 슈퍼라이크 <b>${Math.max(0, superLimit() - S.supersUsed)}</b>/${superLimit()}${S.items.superlike ? ` <i class="buff">+${S.items.superlike}📦</i>` : ""}</span></div>
      ${adSlot()}</div>`;
    paintDeck();
    $("#a-nope").onclick = () => swipeTop("nope");
    $("#a-like").onclick = () => swipeTop("like");
    $("#a-sup").onclick = () => swipeTop("sup");
    $("#a-rew").onclick = rewind;
    $("#a-boost").onclick = boost;
    $("#d-filter").onclick = filterSheet;
  }
  function filterSheet() {
    const F = S.filters;
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">탐색 필터</h3>
      <p class="muted" style="font-size:13px;margin:0 0 16px">원하는 조건의 사람만 보여드려요. 필터는 전 플랜 무료.</p>
      <div class="ob-field"><label>나이 — <b id="fv-age">${F.ageMin}~${F.ageMax}세</b></label>
        <div style="display:flex;gap:12px;align-items:center">
          <input type="range" id="f-amin" min="20" max="45" value="${F.ageMin}" style="flex:1;accent-color:var(--vio)" aria-label="최소 나이">
          <input type="range" id="f-amax" min="20" max="45" value="${F.ageMax}" style="flex:1;accent-color:var(--vio)" aria-label="최대 나이">
        </div></div>
      <div class="ob-field"><label>지역</label><div class="seg" style="grid-template-columns:1fr 1fr">
        <button class="chip ${F.area === "all" ? "on" : ""}" data-area="all">전국</button>
        <button class="chip ${F.area === "mine" ? "on" : ""}" data-area="mine">${esc(myArea() || "내 지역")}만</button></div></div>
      <div class="ob-field"><label>찾는 관계</label><div class="chips" id="f-look">
        <button class="chip ${F.looking === "all" ? "on" : ""}" data-look="all">전체</button>
        ${LOOKING.map((l) => `<button class="chip ${F.looking === l ? "on" : ""}" data-look="${esc(l)}">${esc(l)}</button>`).join("")}</div></div>
      <div class="row" style="display:flex;gap:9px">
        <button class="btn-ghost" style="flex:1" id="f-reset">초기화</button>
        <button class="btn-grad" style="flex:2" id="f-apply">적용하기</button></div></div>`);
    const amin = $("#f-amin", m), amax = $("#f-amax", m);
    const sync = () => {
      if (+amin.value > +amax.value) amax.value = amin.value;
      $("#fv-age", m).textContent = `${amin.value}~${amax.value}세`;
    };
    amin.oninput = sync; amax.oninput = sync;
    m.addEventListener("click", (e) => {
      const a = e.target.closest("[data-area]");
      if (a) { $$("[data-area]", m).forEach((x) => x.classList.remove("on")); a.classList.add("on"); }
      const lk = e.target.closest("[data-look]");
      if (lk) { $$("[data-look]", m).forEach((x) => x.classList.remove("on")); lk.classList.add("on"); }
    });
    $("#f-reset", m).onclick = () => { S.filters = { ageMin: 20, ageMax: 45, area: "all", looking: "all" }; save(); m.remove(); vDiscover(); toast("필터를 초기화했어요"); };
    $("#f-apply", m).onclick = () => {
      S.filters = { ageMin: +amin.value, ageMax: +amax.value,
        area: ($(".chip.on[data-area]", m) || {}).dataset ? $(".chip.on[data-area]", m).dataset.area : "all",
        looking: ($(".chip.on[data-look]", m) || {}).dataset ? $(".chip.on[data-look]", m).dataset.look : "all" };
      save(); m.remove(); vDiscover();
    };
  }
  function cardHTML(p, top) {
    const sh = sharedTags(p);
    const isNew = p.lastActiveMin < 30;
    const showHint = top && !S.hintSeen;
    if (showHint) { S.hintSeen = true; save(); }
    return `<div class="pcard" data-pid="${p.id}" style="z-index:${top ? 3 : 2}">
      <div class="ph" style="background:linear-gradient(150deg,${p.grad[0]},${p.grad[1]})"><span class="em">${p.emoji}</span></div>
      <div class="grad-veil"></div>
      ${isNew ? `<div class="newbie">🟢 방금 활동</div>` : ""}
      <div class="compat">궁합 <b>${compat(p)}%</b></div>
      ${showHint ? `<div class="hint">← 패스 · 좋아요 → · ↑ 슈퍼라이크 · 탭하면 프로필</div>` : ""}
      <div class="info">
        <div class="nm">${esc(p.name)}, ${p.age} ${p.verified ? '<span class="vf" title="프로필 인증(데모)">✔︎</span>' : ""}</div>
        <div class="meta"><span>${distLabel(p)}</span><span>${esc(p.job)}</span></div>
        <div class="tags">${p.tags.map((t) => `<span class="tg ${sh.includes(t) ? "hit" : ""}">${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="stamp like">좋아요</div><div class="stamp nope">패스</div><div class="stamp sup">슈퍼</div>
    </div>`;
  }
  function paintDeck() {
    const d = $("#deck"); if (!d) return;
    if (!deck.length) {
      const filtered = S.filters.area !== "all" || S.filters.looking !== "all" || S.filters.ageMin > 20 || S.filters.ageMax < 45;
      d.innerHTML = `<div class="deck-empty"><div class="em">🌈</div><b>${filtered ? "조건에 맞는 프로필을 다 봤어요" : "오늘의 추천을 모두 봤어요"}</b>
        <p class="muted" style="margin:0;font-size:13.5px">${filtered ? "필터를 넓히면 더 많은 사람을 만날 수 있어요." : "내일 새로운 프로필이 도착해요.<br>받은 좋아요를 확인해보는 건 어때요?"}</p>
        ${filtered ? `<button class="btn-grad" id="de-filter">필터 넓히기 ⚙️</button>` : `<button class="btn-grad" id="de-likes">받은 좋아요 보기 💜</button>`}
        <button class="btn-ghost" id="de-tp" style="font-size:13px;padding:10px 16px">🌏 텔레포트로 다른 지역 보기</button></div>`;
      const dl = $("#de-likes"); if (dl) dl.onclick = () => go("likes");
      const df = $("#de-filter"); if (df) df.onclick = filterSheet;
      $("#de-tp").onclick = () => openShop("teleport");
      return;
    }
    d.innerHTML = deck.slice(0, 3).reverse().map((p, i, arr) => cardHTML(p, i === arr.length - 1)).join("");
    const top = d.lastElementChild;
    if (top) attachSwipe(top);
    $$(".pcard", d).forEach((c, i, arr) => {
      const depth = arr.length - 1 - i;
      if (depth > 0) { c.style.transform = `scale(${1 - depth * .04}) translateY(${depth * 10}px)`; c.style.filter = "brightness(.8)"; }
    });
  }
  function attachSwipe(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false;
    const stampL = $(".stamp.like", card), stampN = $(".stamp.nope", card);
    card.addEventListener("pointerdown", (e) => {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId); card.style.transition = "none";
    });
    const stampS = $(".stamp.sup", card);
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      card.style.transform = `translate(${dx}px,${dy * .4}px) rotate(${dx / 18}deg)`;
      const upSwipe = dy < -60 && Math.abs(dx) < 70;
      stampL.style.opacity = upSwipe ? 0 : Math.max(0, Math.min(1, dx / 90));
      stampN.style.opacity = upSwipe ? 0 : Math.max(0, Math.min(1, -dx / 90));
      stampS.style.opacity = upSwipe ? Math.max(0, Math.min(1, -dy / 130)) : 0;
    });
    const springBack = () => {
      card.style.transition = "transform .3s cubic-bezier(.2,.8,.3,1.2)";
      card.style.transform = ""; stampL.style.opacity = 0; stampN.style.opacity = 0; stampS.style.opacity = 0;
    };
    card.addEventListener("pointerup", () => {
      if (!dragging) return; dragging = false;
      const upSwipe = dy < -150 && Math.abs(dx) < 70;
      if (upSwipe) { if (canAct("sup")) flyUp(card, () => act("sup")); else springBack(); }
      else if (dx > 110) { if (canAct("like")) flyOut(card, 1, () => act("like")); else springBack(); }
      else if (dx < -110) flyOut(card, -1, () => act("nope"));
      else { springBack(); if (!moved) openProfile(card.dataset.pid, "deck"); }
      dx = 0; dy = 0;
    });
  }
  function flyUp(card, after) {
    card.style.transition = "transform .38s ease, opacity .38s";
    card.style.transform = "translateY(-620px) rotate(-4deg)";
    card.style.opacity = "0";
    setTimeout(after, 240);
  }
  /* 한도 체크 — 애니메이션 전에 수행 (카드가 날아갔다 되살아나는 UX 방지) */
  function canAct(kind) {
    if (kind === "like" && likeLimit() !== Infinity && S.likesUsed >= likeLimit()) {
      if (S.items.refill > 0) refillOffer(); else paywall("likes");
      return false;
    }
    if (kind === "sup" && S.supersUsed >= superLimit() && S.items.superlike <= 0) {
      paywall("super"); return false;
    }
    return true;
  }
  function refillOffer() {
    confirmDlg("💜", "좋아요 리필 사용", `오늘의 좋아요를 다 썼어요.<br>보유한 리필(${S.items.refill}개)로 <b>20개</b>를 바로 채울까요?`, "리필 사용", () => {
      S.items.refill--; S.likesUsed = Math.max(0, S.likesUsed - 20); save(); vDiscover();
      toast("💜 좋아요 20개가 충전됐어요!");
    });
  }
  function flyOut(card, dir, after) {
    card.style.transition = "transform .38s ease, opacity .38s";
    card.style.transform = `translate(${dir * 560}px,-40px) rotate(${dir * 24}deg)`;
    card.style.opacity = "0";
    setTimeout(after, 240);
  }
  function swipeTop(kind) {
    const d = $("#deck"); const card = d && d.lastElementChild;
    if (!card || !card.classList.contains("pcard")) return;
    if (kind !== "nope" && !canAct(kind)) return;
    if (kind === "sup") {
      const s = $(".stamp.sup", card); if (s) s.style.opacity = 1;
      flyUp(card, () => act("sup"));
    } else if (kind === "like") {
      const s = $(".stamp.like", card); if (s) s.style.opacity = 1;
      flyOut(card, 1, () => act("like"));
    } else {
      const s = $(".stamp.nope", card); if (s) s.style.opacity = 1;
      flyOut(card, -1, () => act("nope"));
    }
  }
  function act(kind) {
    const p = deck[0]; if (!p) return;
    if (kind === "nope") {
      S.passed.push(p.id); S.lastSwipe = { pid: p.id, kind };
      deck.shift(); save(); vDiscover(); return;
    }
    if (!canAct(kind)) { vDiscover(); return; }
    if (kind === "like") { S.likesUsed++; S.stats.likesSent++; }
    else if (S.supersUsed < superLimit()) { S.supersUsed++; S.superliked.push(p.id); S.stats.likesSent++; }
    else { S.items.superlike--; S.superliked.push(p.id); S.stats.likesSent++; toast(`⭐ 슈퍼라이크 팩 사용 (남은 ${S.items.superlike}개)`); }
    S.liked.push(p.id); S.lastSwipe = { pid: p.id, kind };
    deck.shift();
    // 매칭 판정
    const boostOn = Date.now() < S.boostUntil;
    let prob = compat(p) / 100 * 0.42 + (kind === "sup" ? 0.3 : 0) + (boostOn ? 0.2 : 0);
    const sure = p.likedYou || S.incoming.includes(p.id);
    vibrate(12);
    if (sure || Math.random() < prob) {
      makeMatch(p.id);
    } else { save(); vDiscover(); }
  }
  function makeMatch(pid) {
    S.incoming = S.incoming.filter((x) => x !== pid);
    S.seenIncoming = S.seenIncoming.filter((x) => x !== pid);
    S.matches.push({ pid, at: Date.now(), unread: 0 });
    S.stats.matches++;
    S.lastSwipe = null; // 매치는 되돌리기 불가
    save(); vibrate([30, 60, 30]);
    matchModal(pid);
  }
  function matchModal(pid) {
    const p = P(pid); if (!p) return;
    const u = S.user;
    const m = document.createElement("div");
    m.className = "match-modal";
    m.innerHTML = `${confettiHTML()}
      <h2>우리, 통했어요!</h2><p>${esc(p.name)}님과 서로 좋아요를 눌렀어요 🎉</p>
      <div class="match-avs">
        <div class="avatar" style="background:linear-gradient(135deg,${u.grad[0]},${u.grad[1]})">${u.emoji}</div>
        <span class="heart">💜</span>
        <div class="avatar" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</div>
      </div>
      <div class="match-btns">
        <button class="btn-grad big" data-chat>바로 메시지 보내기 💬</button>
        <button class="btn-ghost" data-keep>계속 둘러보기</button>
      </div>`;
    $("#modal-root").appendChild(m);
    $("[data-chat]", m).onclick = () => { m.remove(); openChat(pid); };
    $("[data-keep]", m).onclick = () => { m.remove(); vDiscover(); badges(); };
  }
  function confettiHTML() {
    const ems = ["💜", "💖", "✨", "🌈", "💫", "🩷"];
    let h = "";
    for (let i = 0; i < 26; i++) {
      h += `<span class="confetti" style="left:${Math.random() * 100}%;animation-duration:${2 + Math.random() * 2.4}s;animation-delay:${Math.random() * .9}s;font-size:${13 + Math.random() * 14}px">${rnd(ems)}</span>`;
    }
    return h;
  }
  function rewind() {
    if (!plan().rewind) { paywall("rewind"); return; }
    if (!S.lastSwipe) { toast("되돌릴 카드가 없어요"); return; }
    const { pid, kind } = S.lastSwipe;
    S.liked = S.liked.filter((x) => x !== pid);
    S.passed = S.passed.filter((x) => x !== pid);
    S.superliked = S.superliked.filter((x) => x !== pid);
    if (kind === "like") S.likesUsed = Math.max(0, S.likesUsed - 1);
    if (kind === "sup") S.supersUsed = Math.max(0, S.supersUsed - 1);
    S.restoredPid = pid; // 되돌린 카드는 덱 최상단으로
    S.lastSwipe = null; save(); vDiscover();
    toast("↩ 마지막 카드를 맨 위로 되돌렸어요");
  }
  function activateBoost() {
    S.boostUntil = Date.now() + 30 * 60000;
    seedIncoming(2); save(); vDiscover(); badges();
    toast("🚀 부스트 시작! 새로운 좋아요가 도착했어요");
  }
  function boost() {
    if (Date.now() < S.boostUntil) { toast("이미 부스트가 진행 중이에요 🚀"); return; }
    const mo = new Date().toISOString().slice(0, 7);
    const used = S.boostMonth === mo ? (S.boostUsed || 0) : 0;
    const hasQuota = plan().boost > 0 && used < plan().boost;
    if (hasQuota) {
      confirmDlg("🚀", "부스트 사용", `30분 동안 내 프로필이 상단에 노출되고<br>매칭 확률이 크게 올라가요. (이번 달 ${used}/${plan().boost}회 사용)`, "부스트 시작", () => {
        S.boostMonth = mo; S.boostUsed = used + 1; activateBoost();
      });
    } else if (S.items.boostticket > 0) {
      confirmDlg("🚀", "부스트 1회권 사용", `보유한 부스트권(${S.items.boostticket}개)으로<br>30분 부스트를 시작할까요?`, "사용하기", () => {
        S.items.boostticket--; activateBoost();
      });
    } else paywall("boost");
  }

  /* ══ 프로필 상세 ══ */
  function openProfile(pid, ctx) {
    const p = P(pid); if (!p) return;
    const sh = sharedTags(p);
    const o = document.createElement("div");
    o.className = "ovl";
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">프로필</span></div>
      <div class="ovl-body">
        <div class="pd-hero" style="background:linear-gradient(150deg,${p.grad[0]},${p.grad[1]})"><span class="em">${p.emoji}</span><div class="veil"></div></div>
        <div class="pd-body">
          <div class="pd-nm">${esc(p.name)}, ${p.age} ${p.verified ? '<button data-vinfo style="color:#38bdf8;font-size:16px" aria-label="인증 정보">✔︎</button>' : ""}</div>
          <div class="pd-meta">${distLabel(p)} · ${lastActive(p)}</div>
          <div class="pd-sec"><h4>소개</h4><div class="pd-intro">${esc(p.intro)}</div></div>
          <div class="pd-sec"><h4>기본 정보</h4><div class="pd-facts">
            <div class="pd-fact"><small>직업</small>${esc(p.job)}</div>
            <div class="pd-fact"><small>키</small>${p.height}cm</div>
            <div class="pd-fact"><small>MBTI</small>${p.mbti}</div>
            <div class="pd-fact"><small>찾는 관계</small>${esc(p.lookingFor)}</div></div></div>
          <div class="pd-sec"><h4>관심사 ${sh.length ? `· <span style="color:var(--vio)">${sh.length}개 겹침</span>` : ""}</h4>
            <div class="chips">${p.tags.map((t) => `<span class="chip ${sh.includes(t) ? "on" : ""}" style="cursor:default">${esc(t)}</span>`).join("")}</div></div>
          <div class="pd-sec"><h4>프라이빗 앨범</h4>
            ${S.matches.some((m) => m.pid === p.id)
              ? `<div class="album open">${[0, 1, 2].map((i) => `<div class="alb" style="background:linear-gradient(${135 + i * 40}deg,${p.grad[0]},${p.grad[1]})"><span>${p.emoji}</span></div>`).join("")}</div>
                 <p class="tiny" style="margin-top:6px">매치되어 앨범이 공개됐어요 (데모: 일러스트로 대체)</p>`
              : `<div class="album"><div class="alb lock">🔒</div><div class="alb lock">🔒</div><div class="alb lock">🔒</div></div>
                 <p class="tiny" style="margin-top:6px">사진은 서로 매치된 뒤에만 공개돼요 — 아우팅 방지 설계</p>`}</div>
          ${ctx === "deck" ? `<div class="pd-actions">
            <button class="btn-line" data-nope style="color:var(--red)">✕ 패스</button>
            <button class="btn-grad" data-like style="flex:1">💜 좋아요</button></div>` : ""}
          ${ctx === "likes" ? `<div class="pd-actions">
            <button class="btn-line" data-lpass style="color:var(--red)">✕ 지나가기</button>
            <button class="btn-grad" data-lmatch style="flex:1">💜 나도 좋아요 (바로 매치!)</button></div>` : ""}
          <div class="pd-danger"><button data-block>차단</button><button data-report>신고</button></div>
        </div></div>`;
    $("#overlay-root").appendChild(o);
    const close = () => o.remove();
    $(".ovl-close", o).onclick = close;
    const vi = $("[data-vinfo]", o);
    if (vi) vi.onclick = () => modal(`<div class="dialog"><div class="em">✔︎</div><h3>인증된 프로필</h3><p>실시간 셀피 인증을 통과한 프로필이에요.<br>(데모: 정식 버전에서 신분 확인 없이<br>얼굴 실재 여부만 검증 — 아우팅 방지)</p>
      <button class="btn-grad big" data-ok>확인</button></div>`, { center: true }).querySelector("[data-ok]").addEventListener("click", function () { this.closest(".modal-back").remove(); });
    const nb = $("[data-nope]", o), lb = $("[data-like]", o);
    if (nb) nb.onclick = () => { close(); swipeTop("nope"); };
    if (lb) lb.onclick = () => { close(); swipeTop("like"); };
    const lp = $("[data-lpass]", o), lm = $("[data-lmatch]", o);
    if (lp) lp.onclick = () => { S.incoming = S.incoming.filter((x) => x !== pid); S.passed.push(pid); save(); close(); go("likes"); };
    if (lm) lm.onclick = () => { close(); makeMatch(pid); };
    $("[data-block]", o).onclick = () => confirmDlg("🚫", "차단하기", `${esc(p.name)}님을 차단하면 서로의 프로필이<br>더 이상 보이지 않아요.`, "차단", () => { blockUser(pid); close(); }, true);
    $("[data-report]", o).onclick = () => reportSheet(pid, close);
  }
  function lastActive(p) {
    const m = p.lastActiveMin;
    if (m < 30) return "🟢 방금 활동";
    if (m < 60) return m + "분 전 활동";
    if (m < 1440) return Math.floor(m / 60) + "시간 전 활동";
    return Math.floor(m / 1440) + "일 전 활동";
  }
  function blockUser(pid) {
    $$(".chatroom").forEach((c) => c.remove());
    S.blocked.push(pid);
    S.incoming = S.incoming.filter((x) => x !== pid);
    S.matches = S.matches.filter((m) => m.pid !== pid);
    delete S.chats[pid];
    save(); toast("차단했어요. 안전 센터에서 관리할 수 있어요");
    go(tab);
  }
  function reportSheet(pid, after) {
    const reasons = ["불쾌한 메시지·언행", "사칭·가짜 프로필", "혐오 표현·차별", "금전 요구·사기 의심", "미성년자로 의심", "기타"];
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">신고 사유를 선택해주세요</h3>
      <p class="muted" style="font-size:13px;margin:0 0 14px">신고는 익명으로 접수되며, 상대는 자동으로 차단돼요.</p>
      ${reasons.map((r) => `<button class="btn-line" style="margin-bottom:8px;text-align:left" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>`);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]"); if (!b) return;
      m.remove(); blockUser(pid);
      const num = "R" + String(Date.now()).slice(-6);
      const dlg = modal(`<div class="dialog"><div class="em">🛡️</div><h3>신고 접수 완료</h3>
        <p style="text-align:left">접수번호 <b>${num}</b><br><br>· 상대는 자동 차단됐어요<br>· 금전 피해가 있다면 <b>경찰 112</b> 또는 사이버범죄 신고(ecrm.police.go.kr)에 접수하세요<br>· 대화 캡처를 증거로 보관해두세요</p>
        <button class="btn-grad big" data-ok>확인</button></div>`, { center: true });
      $("[data-ok]", dlg).onclick = () => dlg.remove();
      after && after();
    });
  }

  /* ══ 좋아요 ══ */
  function vLikes() {
    S.incoming.forEach((id) => { if (!S.seenIncoming.includes(id)) S.seenIncoming.push(id); });
    save();
    const can = plan().seeLikes;
    const list = S.incoming.map(P).filter(Boolean);
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">받은 좋아요 ${list.length ? `<span style="color:var(--pink)">${list.length}</span>` : ""}</div>
      <p class="sec-sub">${can ? "나를 좋아요한 사람들이에요. 탭해서 확인하고 바로 매치하세요." : "누가 나를 좋아하는지 PRISM+에서 바로 확인할 수 있어요."}</p>
      ${S.settings.privateMode ? `<p class="tiny" style="margin:4px 0 0">🕶️ 프라이빗 모드 중 — 새로운 노출·좋아요 유입이 멈춰 있어요.</p>` : ""}
      <p class="tiny" style="margin:4px 0 0">데모 안내: 가상 프로필의 반응이에요. 정식 버전에서는 실제 사용자만 표시됩니다.</p></div>
      ${!can && list.length ? `<div class="likes-cta"><button class="btn-grad big" id="lk-up">💜 PRISM+로 전부 확인하기</button></div>` : ""}
      ${list.length ? `<div class="likes-grid">${list.map((p) => `
        <button class="lk-card ${can ? "" : "blur"}" data-pid="${p.id}">
          <span class="ph" style="background:linear-gradient(150deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
          <span class="veil"></span><span class="nm">${esc(p.name)}, ${p.age}</span>
          ${can ? "" : `<span class="lk-lock">🔒<small>PRISM+로 확인</small></span>`}
        </button>`).join("")}</div>`
      : `<div class="empty"><div class="em">💌</div>아직 새로운 좋아요가 없어요.<br>둘러보기에서 먼저 좋아요를 보내보세요!</div>`}
      ${adSlot()}`;
    const up = $("#lk-up"); if (up) up.onclick = () => openPremium();
    $$(".lk-card").forEach((c) => c.onclick = () => {
      if (!plan().seeLikes) { paywall("seeLikes"); return; }
      openProfile(c.dataset.pid, "likes");
    });
  }

  /* ══ 채팅 ══ */
  function vChats() {
    const ms = S.matches.slice().sort((a, b) => lastMsgAt(b) - lastMsgAt(a));
    const fresh = ms.filter((m) => !(S.chats[m.pid] || []).some((x) => x.who !== "sys"));
    const convs = ms.filter((m) => (S.chats[m.pid] || []).some((x) => x.who !== "sys"));
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">채팅</div>
      <p class="sec-sub">매치된 사람들과의 대화</p></div>
      ${fresh.length ? `<div style="padding:0 16px 4px"><h4 class="tiny" style="margin:0 0 8px;letter-spacing:.5px">새로운 매치 ✨</h4></div>
      <div class="new-matches">${fresh.map((m) => { const p = P(m.pid); return p ? `
        <button class="nm-item unread" data-pid="${p.id}">
          <span class="avatar" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
          <small>${esc(p.name)}</small></button>` : ""; }).join("")}</div>` : ""}
      ${convs.length ? convs.map((m) => {
        const p = P(m.pid); if (!p) return "";
        const chat = S.chats[m.pid] || [];
        const last = chat.filter((x) => x.who !== "sys").slice(-1)[0];
        return `<button class="chat-item" data-pid="${p.id}">
          <span class="avatar ${p.lastActiveMin < 30 ? "online" : ""}" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
          <span class="ci-mid"><span class="ci-nm">${esc(p.name)} ${p.verified ? '<span style="color:#38bdf8;font-size:12px">✔︎</span>' : ""}</span>
          <span class="ci-last">${last ? (last.who === "me" ? "나: " : "") + esc(last.t) : "대화를 시작해보세요"}</span></span>
          <span class="ci-right"><span class="ci-time">${last ? timeAgo(last.at) : ""}</span>${m.unread ? `<i class="badge" style="position:static">${m.unread}</i>` : ""}</span>
        </button>`; }).join("") : ""}
      ${!ms.length ? `<div class="empty"><div class="em">💬</div>아직 매치가 없어요.<br>둘러보기에서 좋아요를 보내면 여기서 대화할 수 있어요.</div>` : ""}
      ${adSlot()}`;
    $$("[data-pid]", $("#view")).forEach((b) => b.onclick = () => openChat(b.dataset.pid));
  }
  const lastMsgAt = (m) => { const c = S.chats[m.pid] || []; return c.length ? c[c.length - 1].at : m.at; };
  function timeAgo(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "방금"; if (s < 3600) return Math.floor(s / 60) + "분 전";
    if (s < 86400) return Math.floor(s / 3600) + "시간 전"; return Math.floor(s / 86400) + "일 전";
  }
  const chatTimers = {}; // 방별 답장 타이머 (전역 1개면 다른 방 답장이 증발)
  const SCAM_RE = /계좌|송금|입금|비트코인|코인|투자|수익|대출|돈\s*빌|기프트\s*카드|문화상품권|리딩방/;
  function openChat(pid) {
    const p = P(pid); if (!p) return;
    const m = S.matches.find((x) => x.pid === pid); if (!m) return;
    m.unread = 0; save();
    if (!S.chats[pid]) S.chats[pid] = [{ who: "sys", t: "매치 성공! 서로를 존중하는 대화로 시작해요 🌈", at: Date.now() }];
    const o = document.createElement("div");
    o.className = "chatroom";
    const ices = shuffle(D.icebreakers.slice()).slice(0, 3);
    o.innerHTML = `<div class="cr-top">
        <button class="cr-back">‹</button>
        <span class="avatar ${p.lastActiveMin < 30 ? "online" : ""}" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
        <span class="cr-nm"><b>${esc(p.name)}</b><small>${lastActive(p)}</small></span>
        <button class="cr-menu">⋯</button></div>
      <div class="cr-body" id="cr-body"></div>
      <div class="ice-row" id="ice-row">${ices.map((q) => `<button class="ice">${esc(q)}</button>`).join("")}</div>
      <div class="cr-input"><input id="cr-in" placeholder="메시지 보내기" maxlength="300" autocomplete="off"><button class="cr-send" id="cr-send">➤</button></div>`;
    $("#overlay-root").appendChild(o);
    const body = $("#cr-body", o);
    const paint = () => {
      const chat = S.chats[pid] || [];
      body.innerHTML = chat.map((x, i) =>
        x.who === "sys" ? `<div class="sys">${esc(x.t)}</div>` :
        `<div class="msg ${x.who === "me" ? "me" : "you"}">${esc(x.t)}<span class="mt">${fmtTime(x.at)}</span>${x.who === "me" && plan().read && i === lastMyIdx(chat) && repliedAfter(chat, i) ? `<span class="read">읽음</span>` : ""}</div>`).join("");
      body.scrollTop = body.scrollHeight;
    };
    const lastMyIdx = (chat) => { let k = -1; chat.forEach((x, i) => { if (x.who === "me") k = i; }); return k; };
    const repliedAfter = (chat, i) => chat.slice(i + 1).some((x) => x.who === "you");
    paint();
    const input = $("#cr-in", o);
    const scamGuard = (t) => {
      // 로맨스 스캠 방어: 금전 관련 키워드 감지 시 1회 경고 (아이템/상품 언급과 무관하게 안전 우선)
      if (SCAM_RE.test(t) && !S.chats[pid].some((x) => x.who === "sys" && x.scam)) {
        S.chats[pid].push({ who: "sys", scam: true, t: "⚠️ 금전 요구·투자 권유는 100% 사기예요. 절대 송금하지 말고 신고해주세요.", at: Date.now() });
      }
    };
    const send = (text) => {
      const t = (text || input.value).trim(); if (!t) return;
      S.chats[pid].push({ who: "me", t, at: Date.now() });
      scamGuard(t); save();
      input.value = ""; paint();
      $("#ice-row", o).style.display = "none";
      scheduleReply(pid, o, paint);
    };
    $("#cr-send", o).onclick = () => send();
    input.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 이중 전송 방지
      if (e.key === "Enter") send();
    });
    $("#ice-row", o).onclick = (e) => { const b = e.target.closest(".ice"); if (b) send(b.textContent); };
    $(".cr-back", o).onclick = () => { o.remove(); if (tab === "chats") go("chats"); badges(); };
    $(".cr-menu", o).onclick = () => {
      const sheet = modal(`<div class="sheet"><div class="grip"></div>
        <button class="btn-line" style="margin-bottom:8px" data-prof>프로필 보기</button>
        <button class="btn-line" style="margin-bottom:8px" data-unmatch>매치 해제</button>
        <button class="btn-line" style="margin-bottom:8px;color:var(--red)" data-block>차단하기</button>
        <button class="btn-line" style="color:var(--red)" data-report>신고하기</button></div>`);
      $("[data-prof]", sheet).onclick = () => { sheet.remove(); openProfile(pid, "chat"); };
      $("[data-unmatch]", sheet).onclick = () => {
        sheet.remove();
        confirmDlg("💔", "매치 해제", "대화방이 삭제돼요. 차단과 달리<br>나중에 둘러보기에서 다시 만날 수 있어요.", "해제", () => {
          o.remove();
          S.matches = S.matches.filter((m) => m.pid !== pid);
          delete S.chats[pid];
          S.liked = S.liked.filter((x) => x !== pid);
          save(); go("chats"); toast("매치를 해제했어요");
        });
      };
      $("[data-block]", sheet).onclick = () => { sheet.remove(); confirmDlg("🚫", "차단하기", "대화방이 삭제되고 서로 보이지 않게 돼요.", "차단", () => { o.remove(); blockUser(pid); }, true); };
      $("[data-report]", sheet).onclick = () => { sheet.remove(); reportSheet(pid, () => o.remove()); };
    };
  }
  const fmtTime = (t) => { const d = new Date(t); const h = d.getHours(); return (h < 12 ? "오전 " : "오후 ") + ((h % 12) || 12) + ":" + String(d.getMinutes()).padStart(2, "0"); };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickReply(p, userText) {
    const st = D.replyStyles[p.vibe] || Object.values(D.replyStyles)[0];
    if (!st) return "반가워요!";
    const chat = S.chats[p.id] || [];
    const yourCount = chat.filter((x) => x.who === "you").length;
    if (yourCount === 0) return rnd(st.greet);
    if (/[?？]|뭐|어때|어떤|어디|왜|언제|누구/.test(userText) && Math.random() < .8) return rnd(st.answer);
    const r = Math.random();
    if (r < .3) return rnd(st.react);
    if (r < .55) return rnd(st.question);
    return rnd(st.answer);
  }
  function scheduleReply(pid, room, paint) {
    const p = P(pid); if (!p) return;
    clearTimeout(chatTimers[pid]);
    chatTimers[pid] = setTimeout(() => {
      if (!room.isConnected) return;
      const body = $("#cr-body", room);
      const ty = document.createElement("div");
      ty.className = "typing"; ty.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(ty); body.scrollTop = body.scrollHeight;
      const chat = S.chats[pid];
      const lastMe = chat.filter((x) => x.who === "me").slice(-1)[0];
      setTimeout(() => {
        ty.remove();
        if (!room.isConnected) { // 방을 나갔으면 안읽음 처리
          chat.push({ who: "you", t: pickReply(p, lastMe ? lastMe.t : ""), at: Date.now() });
          const m = S.matches.find((x) => x.pid === pid); if (m) m.unread = (m.unread || 0) + 1;
          save(); badges(); return;
        }
        chat.push({ who: "you", t: pickReply(p, lastMe ? lastMe.t : ""), at: Date.now() });
        save(); paint();
      }, 1100 + Math.random() * 1600);
    }, 500 + Math.random() * 900);
  }
  function maybeIncomingMessage() {
    // 앱 사용 중 가끔 매치 상대가 먼저 말을 걸어옴
    const cands = S.matches.filter((m) => { const c = S.chats[m.pid] || []; return !c.some((x) => x.who === "you"); });
    if (!cands.length || Math.random() < .5) return;
    setTimeout(() => {
      const m = rnd(cands); const p = P(m.pid); if (!p) return;
      const st = D.replyStyles[p.vibe]; if (!st) return;
      if (!S.chats[m.pid]) S.chats[m.pid] = [{ who: "sys", t: "매치 성공! 서로를 존중하는 대화로 시작해요 🌈", at: Date.now() }];
      if (S.chats[m.pid].some((x) => x.who !== "sys")) return;
      S.chats[m.pid].push({ who: "you", t: rnd(st.greet), at: Date.now() });
      m.unread = (m.unread || 0) + 1;
      save(); badges();
      toast(`💬 ${esc(p.name)}님이 메시지를 보냈어요`);
    }, 15000 + Math.random() * 30000);
  }

  /* ══ 커뮤니티 ══ */
  function vCommunity() {
    const qs = D.dailyQuestions;
    const idx = qs.length ? (dayOfYear() % qs.length) : 0;
    const q = qs[idx];
    const voted = S.votes[idx] !== undefined;
    const dist = q ? voteDist(idx, q.options.length) : [];
    const total = dist.reduce((a, b) => a + b, 0) + (voted ? 1 : 0);
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">라운지</div>
      <p class="sec-sub">만남 전에, 가볍게 서로를 알아가는 공간</p></div>
      ${q ? `<div class="dq-card"><div class="dq-tag">오늘의 질문 · ${new Date().getMonth() + 1}/${new Date().getDate()}</div>
        <h3>${esc(q.q)}</h3>
        ${q.options.map((op, i) => {
          const n = dist[i] + (voted && S.votes[idx] === i ? 1 : 0);
          const pct = voted ? Math.round(n / total * 100) : 0;
          return `<button class="dq-opt ${voted && S.votes[idx] === i ? "mine" : ""}" data-i="${i}" ${voted ? "disabled" : ""}>
            ${voted ? `<span class="fill" style="transform:scaleX(${pct / 100})"></span>` : ""}
            <span>${esc(op)}</span>${voted ? `<span class="pct">${pct}%</span>` : ""}</button>`;
        }).join("")}
        ${voted ? `<div class="dq-total">${total.toLocaleString()}명 참여 · 내일 새로운 질문이 올라와요</div>` : ""}</div>` : ""}
      ${qs.length > 1 ? `<div class="sec" style="padding:2px 16px 0"><b style="font-size:13px;color:var(--tx3)">지난 질문 다시 보기</b></div>
      <div class="past-qs">${[1, 2, 3].map((d) => {
        const pi = ((idx - d) % qs.length + qs.length) % qs.length;
        const pq = qs[pi]; if (!pq) return "";
        const pd = voteDist(pi, pq.options.length);
        const pt = pd.reduce((a, b) => a + b, 0);
        const win = pd.indexOf(Math.max(...pd));
        return `<div class="past-q"><small>${d}일 전 · ${pt.toLocaleString()}명 참여</small><b>${esc(pq.q)}</b>
          <span>1위 — ${esc(pq.options[win])} (${Math.round(pd[win] / pt * 100)}%)</span></div>`;
      }).join("")}</div>` : ""}
      <div class="lounge-note">🏳️‍🌈 <b>주제별 라운지</b>(운동·전시·반려동물·동네 모임)는 정식 버전에서 열릴 예정이에요. 오늘의 질문에 참여하며 기다려주세요!</div>
      <div class="sec" style="padding-top:0"><div class="sec-h" style="font-size:16px">🛡️ 오늘의 안전 팁</div></div>
      <div class="safe-list">${shuffle((D.safetyTips || []).slice()).slice(0, 2).map((t) => `<div class="safe-it"><span>💡</span>${esc(t)}</div>`).join("")}</div>
      ${adSlot()}`;
    $$(".dq-opt:not([disabled])").forEach((b) => b.onclick = () => {
      S.votes[idx] = +b.dataset.i; save(); vCommunity(); vibrate(10);
    });
  }
  const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  function voteDist(idx, n) {
    // 시드 고정 의사난수 분포 (데모)
    const out = []; let seed = idx * 7919 + n * 104729;
    for (let i = 0; i < n; i++) { seed = (seed * 9301 + 49297) % 233280; out.push(120 + (seed % 480)); }
    return out;
  }

  /* ══ MY ══ */
  function vMy() {
    const u = S.user;
    const pl = S.premium.plan;
    $("#view").innerHTML = `
      <div class="my-head">
        <span class="avatar" style="background:linear-gradient(135deg,${u.grad[0]},${u.grad[1]})">${u.emoji}</span>
        <div><div class="mh-nm">${esc(u.name)}, ${u.age}</div>
        <div class="mh-sub">📍 ${esc(u.region)} · ${u.mbti} · ${esc(u.lookingFor)}</div></div>
      </div>
      <div class="my-plan ${pl === "free" ? "free" : ""}">
        <b>${pl === "free" ? "무료 플랜 이용 중" : "🎉 " + plan().label + " 이용 중"}</b>
        <p>이번 주 보낸 좋아요 <b>${S.stats.likesSent}</b> · 매치 <b>${S.stats.matches}</b>${pl === "free" ? " — PRISM+면 좋아요 무제한, 받은 좋아요 공개, 광고 제거." : " — 프리미엄 혜택 적용 중. 언제든 변경 가능."}</p>
        <button class="btn-grad" id="my-premium" style="font-size:14px;padding:11px 18px">${pl === "free" ? "PRISM+ 시작하기 💜" : "플랜 관리"}</button>
      </div>
      <div class="menu">
        <button class="menu-it" id="m-edit"><span class="mi-ic">✏️</span>프로필 수정<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-verify"><span class="mi-ic">✔︎</span>프로필 인증하기<span class="mi-val">${u.verified ? "인증됨 ✔︎" : "미인증"}</span></button>
        <button class="menu-it" id="m-shop"><span class="mi-ic">🛍️</span>아이템 상점<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-install"><span class="mi-ic">📲</span>홈 화면에 앱 설치<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-font"><span class="mi-ic">🔠</span>글자 크기<span class="mi-val">${["보통", "크게", "아주 크게"][S.settings.fontScale]}</span></button>
      </div>
      <div class="sec" style="padding:0 18px 8px"><b style="font-size:13px;color:var(--tx3)">프라이버시 · 안전</b></div>
      <div class="menu">
        <button class="menu-it" id="m-pin"><span class="mi-ic">🔐</span>앱 잠금 (PIN)<span class="mi-val">${hasPin() ? "사용 중" : "꺼짐"}</span></button>
        ${hasPin() ? `<button class="menu-it" id="m-bglock"><span class="mi-ic">🫥</span>화면 이탈 시 즉시 잠금<span class="switch ${S.settings.bgLock ? "on" : ""}"></span></button>` : ""}
        <button class="menu-it" id="m-disguise"><span class="mi-ic">🎭</span>위장 제목 항상 사용<span class="switch ${S.settings.disguise ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-dist"><span class="mi-ic">📍</span>거리 숨기기<span class="switch ${S.settings.hideDistance ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-private"><span class="mi-ic">🕶️</span>프라이빗 모드 (새 노출 중단)<span class="switch ${S.settings.privateMode ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-safety"><span class="mi-ic">🛡️</span>안전 센터<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-blocked"><span class="mi-ic">🚫</span>차단 목록<span class="mi-val">${S.blocked.length}명</span></button>
      </div>
      <div class="menu">
        <button class="menu-it" id="m-reset"><span class="mi-ic">🗑️</span><span style="color:var(--red)">데이터 초기화 (계정 삭제)</span></button>
      </div>
      <p class="tiny" style="text-align:center;padding:0 20px 8px">PRISM 데모 v1.0 · 모든 데이터는 이 기기에만 저장 ·
        <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--tx3)">개인정보</a> ·
        <a href="/terms.html" target="_blank" rel="noopener" style="color:var(--tx3)">약관</a> ·
        <a href="/contact.html" target="_blank" rel="noopener" style="color:var(--tx3)">문의</a></p>
      ${adSlot()}`;
    $("#my-premium").onclick = () => openPremium();
    $("#m-edit").onclick = editProfileSheet;
    $("#m-shop").onclick = () => openShop();
    $("#m-install").onclick = installApp;
    $("#m-font").onclick = () => {
      S.settings.fontScale = (S.settings.fontScale + 1) % 3;
      save(); applyFontScale(); vMy();
      toast("글자 크기: " + ["보통", "크게", "아주 크게"][S.settings.fontScale]);
    };
    $("#m-verify").onclick = () => {
      if (u.verified) { toast("이미 인증된 프로필이에요 ✔︎"); return; }
      confirmDlg("✔︎", "프로필 인증 (데모)", "정식 버전에서는 실시간 셀피 인증으로<br>가짜 프로필을 걸러내요. 데모에서는 바로 인증돼요.", "인증하기", () => {
        u.verified = true; save(); vMy(); toast("✔︎ 프로필이 인증됐어요");
      });
    };
    $("#m-pin").onclick = pinSheet;
    const bg = $("#m-bglock");
    if (bg) bg.onclick = () => { S.settings.bgLock = !S.settings.bgLock; save(); vMy(); };
    $("#m-disguise").onclick = () => {
      S.settings.disguise = !S.settings.disguise; save(); applyDisguise(); vMy();
      toast(S.settings.disguise ? "🎭 탭 제목·아이콘이 '메모'로 위장돼요" : "위장 제목을 해제했어요");
    };
    $("#m-dist").onclick = () => { S.settings.hideDistance = !S.settings.hideDistance; save(); vMy(); };
    $("#m-private").onclick = () => {
      S.settings.privateMode = !S.settings.privateMode; save(); vMy();
      if (S.settings.privateMode) toast("🕶️ 프라이빗 모드: 새로운 좋아요 유입이 멈춰요");
    };
    $("#m-safety").onclick = openSafety;
    $("#m-blocked").onclick = blockedSheet;
    $("#m-reset").onclick = () => confirmDlg("🗑️", "정말 초기화할까요?", "프로필, 매치, 대화가 모두 삭제되고<br>되돌릴 수 없어요.", "전부 삭제", () => {
      localStorage.removeItem(LS); location.reload();
    }, true);
  }
  function editProfileSheet() {
    const u = S.user;
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 14px">프로필 수정</h3>
      <div class="ob-field"><label>닉네임</label><input class="ob-input" id="e-name" maxlength="10" value="${esc(u.name)}"></div>
      <div class="ob-field"><label>자기소개</label><textarea class="ob-input" id="e-intro" maxlength="120">${esc(u.intro)}</textarea></div>
      <div class="ob-field"><label>관심사 (3~5개)</label><div class="chips" id="e-tags">${masterTags().map((t) => `<button class="chip ${u.tags.includes(t) ? "on" : ""}" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
      <button class="btn-grad big" id="e-save">저장</button></div>`);
    const tags = u.tags.slice();
    $("#e-tags", m).onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const t = b.dataset.v;
      if (tags.includes(t)) { tags.splice(tags.indexOf(t), 1); b.classList.remove("on"); }
      else if (tags.length < 5) { tags.push(t); b.classList.add("on"); }
      else toast("최대 5개까지 고를 수 있어요");
    };
    $("#e-save", m).onclick = () => {
      const nm = $("#e-name", m).value.trim();
      if (!nm) { toast("닉네임을 입력해주세요"); return; }
      if (tags.length < 3) { toast("관심사를 3개 이상 골라주세요"); return; }
      u.name = nm.slice(0, 10); u.intro = $("#e-intro", m).value.trim(); u.tags = tags;
      save(); m.remove(); vMy(); toast("저장했어요 ✓");
    };
  }
  function pinSheet() {
    if (hasPin()) {
      confirmDlg("🔐", "앱 잠금 해제", "설정된 PIN 잠금을 해제할까요?", "해제", () => { S.settings.pin = null; S.settings.pinHash = null; save(); vMy(); toast("앱 잠금을 해제했어요"); });
      return;
    }
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">앱 잠금 설정</h3>
      <p class="muted" style="font-size:13px;margin:0 0 14px">앱을 열 때마다 4자리 PIN을 입력해요. 누가 폰을 봐도 안심.</p>
      <div class="ob-field"><label>PIN 4자리</label><input class="ob-input" id="p-1" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;letter-spacing:10px;font-size:22px"></div>
      <div class="ob-field"><label>PIN 확인</label><input class="ob-input" id="p-2" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;letter-spacing:10px;font-size:22px"></div>
      <p class="tiny">⚠️ PIN을 잊으면 데이터 초기화로만 해제할 수 있어요.</p>
      <button class="btn-grad big" id="p-save">잠금 설정</button></div>`);
    $("#p-save", m).onclick = async () => {
      const a = $("#p-1", m).value, b = $("#p-2", m).value;
      if (!/^\d{4}$/.test(a)) { toast("숫자 4자리를 입력해주세요"); return; }
      if (a !== b) { toast("PIN이 서로 달라요"); return; }
      S.settings.pinHash = await pinHash(a); S.settings.pin = null;
      save(); m.remove(); vMy(); toast("🔐 앱 잠금이 설정됐어요 (해시 저장 · 5회 오류 시 30초 잠금)");
    };
  }
  function blockedSheet() {
    const list = S.blocked.map(P).filter(Boolean);
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 14px">차단 목록 (${list.length})</h3>
      ${list.length ? list.map((p) => `<div style="display:flex;align-items:center;gap:12px;padding:9px 0">
        <span class="avatar" style="width:42px;height:42px;font-size:20px;background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
        <b style="flex:1">${esc(p.name)}, ${p.age}</b>
        <button class="btn-ghost" style="padding:8px 14px;font-size:13px" data-un="${p.id}">차단 해제</button></div>`).join("")
      : `<p class="muted" style="text-align:center;padding:16px 0">차단한 사용자가 없어요</p>`}</div>`);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-un]"); if (!b) return;
      S.blocked = S.blocked.filter((x) => x !== b.dataset.un); save();
      m.remove(); vMy(); toast("차단을 해제했어요");
    });
  }

  /* ══ 안전 센터 ══ */
  function openSafety() {
    const o = document.createElement("div");
    o.className = "ovl";
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">🛡️ 안전 센터</span></div>
      <div class="ovl-body">
        <div class="sec"><div class="sec-h" style="font-size:17px">퀴어 데이팅 안전 가이드</div>
        <p class="sec-sub">모든 안전 기능은 무료예요. 언제나.</p></div>
        <div class="safe-list">${(D.safetyTips || []).map((t) => `<div class="safe-it"><span>🛡️</span>${esc(t)}</div>`).join("")}</div>
        <div class="sec"><div class="sec-h" style="font-size:17px">긴급 도움 (전국)</div></div>
        <div class="safe-list">
          <div class="safe-it"><span>📞</span><span><b>경찰 <a href="tel:112">112</a></b> · 위급 상황 시 즉시 신고하세요. 전국 어디서나.</span></div>
          <div class="safe-it"><span>💜</span><span><b>청소년성소수자위기지원센터 띵동</b> · <a href="tel:029241224">02-924-1224</a> (전화·온라인 상담, 전국)</span></div>
          <div class="safe-it"><span>🤝</span><span><b>한국게이인권운동단체 친구사이</b> · 상담 및 커뮤니티 지원 (온라인)</span></div>
          <div class="safe-it"><span>🧑‍⚕️</span><span><b>자살예방 상담전화 <a href="tel:1393">1393</a></b> · 24시간, 전국</span></div>
        </div>
        <div class="sec"><div class="sec-h" style="font-size:17px">이 앱의 프라이버시 원칙</div></div>
        <div class="safe-list" style="margin-bottom:24px">
          <div class="safe-it"><span>🔒</span><span>모든 데이터는 <b>이 기기에만</b> 저장 — 서버 전송 0회</span></div>
          <div class="safe-it"><span>🚫</span><span>이 앱 화면에는 <b>외부 광고·추적 스크립트가 없어요</b> (앱 내 추천은 자체 하우스 배너)</span></div>
          <div class="safe-it"><span>🗑️</span><span>MY → 데이터 초기화로 <b>모든 흔적을 즉시 삭제</b>할 수 있어요</span></div>
        </div></div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
  }

  /* ══ 프리미엄 (수익 모델) ══ */
  function paywall(kind) {
    const msgs = {
      likes: ["💜", "오늘의 좋아요를 다 썼어요", "PRISM+는 좋아요가 <b>무제한</b>이에요.<br>내일까지 기다리지 않아도 돼요."],
      super: ["⭐", "슈퍼라이크를 다 썼어요", "PRISM Black은 매일 <b>슈퍼라이크 5개</b>.<br>매칭 확률이 3배 올라가요."],
      rewind: ["↩️", "실수로 넘겼나요?", "PRISM+의 <b>되돌리기</b>로<br>방금 지나친 인연을 다시 만나요."],
      boost: ["🚀", "부스트로 눈에 띄기", "PRISM+는 매달 <b>무료 부스트</b>.<br>30분간 노출이 수직 상승해요."],
      seeLikes: ["👀", "누가 나를 좋아할까요?", "PRISM+에서 받은 좋아요를<br><b>전부 공개</b>하고 바로 매치하세요."],
    };
    const itemAlt = { likes: "refill", super: "superlike", boost: "boostticket" }[kind];
    const [em, t, b] = msgs[kind] || msgs.likes;
    const m = modal(`<div class="dialog"><div class="em">${em}</div><h3>${t}</h3><p>${b}</p>
      <div class="row"><button class="btn-ghost" data-x>다음에</button><button class="btn-grad" data-go>플랜 보기</button></div>
      ${itemAlt ? `<button class="pw-item" data-shop>🛍️ 아이템으로 한 번만 해결하기 →</button>` : ""}</div>`, { center: true });
    $("[data-x]", m).onclick = () => m.remove();
    $("[data-go]", m).onclick = () => { m.remove(); openPremium(); };
    const sh = $("[data-shop]", m);
    if (sh) sh.onclick = () => { m.remove(); openShop(itemAlt); };
  }
  function openPremium() {
    const o = document.createElement("div");
    o.className = "ovl";
    const cur = S.premium.plan;
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">프리미엄</span></div>
      <div class="ovl-body">
        <div class="pm-hero"><div class="em">◈</div><h2><span class="prism-mark">PRISM</span> 프리미엄</h2>
        <p>기본 기능은 언제나 무료. 더 빠른 만남을 원할 때만.</p></div>
        <div class="plan-cards">
          <div class="plan hot"><span class="pl-badge">인기</span><h3>PRISM+</h3>
            <div class="pl-price">월 9,900원 <small>· 연 결제 시 월 8,250원 (17%↓) · 언제든 해지</small></div>
            <ul><li>좋아요 무제한</li><li>받은 좋아요 전체 공개 + 바로 매치</li><li>되돌리기 (마지막 카드 복구)</li><li>부스트 월 1회 (30분 상단 노출)</li><li>광고 제거 · 아이템 5% 할인</li></ul>
            ${cur === "plus" ? `<button class="btn-ghost" style="width:100%" data-cancel>이용 중 · 해지하기</button>` : `<button class="btn-grad big" data-buy="plus">PRISM+ 시작하기</button>`}</div>
          <div class="plan black"><span class="pl-badge">BLACK</span><h3>PRISM Black</h3>
            <div class="pl-price">월 19,900원 <small>· 연 결제 시 월 16,580원 (17%↓) · 언제든 해지</small></div>
            <ul><li>PRISM+ 모든 혜택 포함</li><li>슈퍼라이크 매일 5개 (매칭 확률 3배)</li><li>부스트 월 4회 — 단품 구매 대비 월 15,600원 상당</li><li>크러시 팩 무료 뽑기 매일 2회</li><li>아이템 15% 할인 · 읽음 확인</li></ul>
            ${cur === "black" ? `<button class="btn-ghost" style="width:100%" data-cancel>이용 중 · 해지하기</button>` : `<button class="btn-grad big" style="background:linear-gradient(90deg,#f59e0b,#fbbf24);color:#241a02" data-buy="black">Black 시작하기</button>`}</div>
        </div>
        <div class="compare"><table>
          <tr><th></th><th>무료</th><th>PLUS</th><th>BLACK</th></tr>
          <tr><td>좋아요</td><td>20/일</td><td>무제한</td><td>무제한</td></tr>
          <tr><td>받은 좋아요 확인</td><td>—</td><td>✓</td><td>✓</td></tr>
          <tr><td>되돌리기</td><td>—</td><td>✓</td><td>✓</td></tr>
          <tr><td>슈퍼라이크</td><td>1/일</td><td>1/일</td><td>5/일</td></tr>
          <tr><td>부스트</td><td>—</td><td>월 1회</td><td>월 4회</td></tr>
          <tr><td>크러시 팩 무료 뽑기</td><td>1/일</td><td>1/일</td><td>2/일</td></tr>
          <tr><td>아이템 할인</td><td>—</td><td>5%</td><td>15%</td></tr>
          <tr><td>읽음 확인</td><td>—</td><td>—</td><td>✓</td></tr>
          <tr><td>광고</td><td>표시</td><td>제거</td><td>제거</td></tr>
          <tr><td>필터·차단·신고·안전 센터</td><td colspan="3">전 플랜 무료 ✓</td></tr>
        </table></div>
        <p class="pm-note">구독 없이 필요한 만큼만 — <button id="pm-shop" style="color:var(--vio);text-decoration:underline;font-size:12px">아이템 상점 🛍️</button><br>데모 버전에서는 결제가 실제로 청구되지 않아요.<br>정식 출시 시 토스페이먼츠·인앱결제로 안전하게 결제됩니다.</p>
      </div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
    const ps = $("#pm-shop", o); if (ps) ps.onclick = () => { o.remove(); openShop(); };
    $$("[data-buy]", o).forEach((b) => b.onclick = () => checkoutSheet(b.dataset.buy, o));
    const cx = $("[data-cancel]", o);
    if (cx) cx.onclick = () => confirmDlg("😢", "정말 해지할까요?", "다음 결제일부터 무료 플랜으로 전환돼요.<br>(데모: 즉시 전환)", "해지", () => {
      S.premium = { plan: "free", since: null }; save(); paintTopbar(); o.remove(); go(tab); toast("무료 플랜으로 전환됐어요");
    });
  }
  function checkoutSheet(planKey, ovl) {
    const info = planKey === "plus" ? ["PRISM+", "9,900"] : ["PRISM Black", "19,900"];
    const m = modal(`<div class="sheet"><div class="grip"></div>
      <h3 style="margin:0 0 4px">결제 확인</h3>
      <p class="muted" style="font-size:13px;margin:0 0 16px">${info[0]} 월간 구독 · 월 ${info[1]}원 · 언제든 해지 가능</p>
      <div class="seg" style="margin-bottom:16px">
        <button class="chip on" data-pay>💳 카드 결제</button>
        <button class="chip" data-pay>🟡 카카오페이</button>
        <button class="chip" data-pay>🔵 토스페이</button>
      </div>
      <button class="btn-grad big" id="pay-go">데모 결제 완료하기</button>
      <p class="tiny" style="text-align:center;margin-top:10px">데모 버전 — 실제 결제가 발생하지 않습니다.</p></div>`);
    $$("[data-pay]", m).forEach((c) => c.onclick = () => { $$("[data-pay]", m).forEach((x) => x.classList.remove("on")); c.classList.add("on"); });
    $("#pay-go", m).onclick = () => {
      S.premium = { plan: planKey, since: Date.now() }; save();
      m.remove(); if (ovl) ovl.remove();
      paintTopbar(); go(tab);
      const dlg = modal(`<div class="dialog"><div class="em">🎉</div><h3>${info[0]} 시작!</h3><p>프리미엄 혜택이 바로 적용됐어요.<br>좋은 인연 만나시길 💜</p>
        <button class="btn-grad big" data-ok>좋아요!</button></div>`, { center: true });
      $("[data-ok]", dlg).onclick = () => dlg.remove();
      vibrate([20, 40, 20]);
    };
  }

  /* ══ 아이템 상점 ══ */
  function openShop(focusKey) {
    const o = document.createElement("div");
    o.className = "ovl";
    const disc = itemDiscount();
    const inv = SHOP.filter((it) => S.items[it.key] > 0 || (it.key === "superlike" && S.items.superlike > 0));
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close" aria-label="닫기">‹</button><span class="ovl-title">🛍️ 아이템 상점</span></div>
      <div class="ovl-body">
        <div class="pm-hero" style="padding-top:18px"><h2 style="font-size:20px">필요할 때, 필요한 만큼만</h2>
        <p>구독 없이 골라 쓰는 소모품${disc ? ` · <b style="color:var(--amber)">${plan().label} ${disc * 100}% 할인 적용 중</b>` : ""}</p></div>
        ${inv.length ? `<div class="sec" style="padding:4px 18px 0"><b style="font-size:13px;color:var(--tx3)">보유 아이템</b></div>
        <div class="inv-row">${inv.map((it) => `<div class="inv-it"><span>${it.em}</span><b>${S.items[it.key]}</b><small>${esc(it.name)}</small>
          ${(it.key === "teleport" || it.key === "spotlight") ? `<button class="btn-grad inv-use" data-use="${it.key}">사용</button>` : ""}</div>`).join("")}</div>` : ""}
        <div class="shop-list">
        ${SHOP.map((it) => `<div class="shop-it ${focusKey === it.key ? "hl" : ""}" id="shop-${it.key}">
          <div class="si-head"><span class="si-em">${it.em}</span><div><b>${esc(it.name)}</b><p>${esc(it.desc)}</p></div></div>
          <div class="si-packs">${it.packs.map((pk, i) => `
            <button class="si-pack" data-key="${it.key}" data-pi="${i}">
              <b>${pk.n}${it.key === "teleport" || it.key === "boostticket" || it.key === "refill" ? "개" : it.key === "spotlight" ? "회" : "장"}</b>
              <span>${disc ? `<s>${won(pk.price)}</s> ` : ""}${won(itemPrice(pk.price))}</span>
              ${pk.n > 1 ? `<i>개당 ${won(Math.round(itemPrice(pk.price) / pk.n / 100) * 100)}</i>` : ""}</button>`).join("")}</div>
        </div>`).join("")}
        </div>
        <p class="pm-note">데모 버전 — 실제 결제가 발생하지 않아요.<br>정식 출시 시 토스페이먼츠·인앱결제로 안전하게 결제됩니다.</p>
      </div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
    $$(".si-pack", o).forEach((b) => b.onclick = () => {
      const it = SHOP.find((x) => x.key === b.dataset.key);
      buyItemSheet(it, it.packs[+b.dataset.pi], o);
    });
    $$("[data-use]", o).forEach((b) => b.onclick = () => { useItem(b.dataset.use, o); });
    if (focusKey) { const el = $("#shop-" + focusKey, o); if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 60); }
  }
  function buyItemSheet(it, pack, ovl) {
    const price = itemPrice(pack.price);
    const m = modal(`<div class="sheet"><div class="grip"></div>
      <h3 style="margin:0 0 4px">${it.em} ${esc(it.name)} × ${pack.n}</h3>
      <p class="muted" style="font-size:13px;margin:0 0 16px">${esc(it.desc)}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:16px">
        <span class="muted" style="font-size:14px">결제 금액</span><b style="font-size:18px">${won(price)}</b></div>
      <div class="seg" style="margin-bottom:16px">
        <button class="chip on" data-pay>💳 카드 결제</button>
        <button class="chip" data-pay>🟡 카카오페이</button>
        <button class="chip" data-pay>🔵 토스페이</button>
      </div>
      <button class="btn-grad big" id="ipay-go">데모 결제 완료하기</button>
      <p class="tiny" style="text-align:center;margin-top:10px">데모 버전 — 실제 결제가 발생하지 않습니다.</p></div>`);
    $$("[data-pay]", m).forEach((c) => c.onclick = () => { $$("[data-pay]", m).forEach((x) => x.classList.remove("on")); c.classList.add("on"); });
    $("#ipay-go", m).onclick = () => {
      S.items[it.key] = (S.items[it.key] || 0) + pack.n;
      save(); m.remove(); vibrate([20, 40, 20]);
      toast(`${it.em} ${it.name} ${pack.n}개 충전 완료!`);
      if (ovl) { ovl.remove(); openShop(it.key); }
      if (tab === "discover") vDiscover();
      badges();
    };
  }
  function useItem(key, ovl) {
    if (key === "spotlight") {
      if (spotlightActive()) { toast("이미 스포트라이트가 켜져 있어요 ✨"); return; }
      confirmDlg("✨", "스포트라이트 켜기", "3시간 동안 내 프로필이 상단에 고정 노출돼요.<br>좋아요가 도착하기 시작합니다!", "켜기", () => {
        S.items.spotlight--; S.fx.spotlightUntil = Date.now() + 3 * 3600000;
        seedIncoming(2 + Math.floor(Math.random() * 2));
        save(); if (ovl) ovl.remove(); go("discover");
        toast("✨ 스포트라이트 ON — 새로운 좋아요가 도착했어요!"); badges();
      });
      return;
    }
    if (key === "teleport") {
      const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">🌏 어디로 갈까요?</h3>
        <p class="muted" style="font-size:13px;margin:0 0 14px">24시간 동안 선택한 지역 사람들이 먼저 보여요.</p>
        <div class="chips">${REGIONS.filter((r) => r !== myArea()).map((r) => `<button class="chip" data-r="${r}">${r}</button>`).join("")}</div></div>`);
      m.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]"); if (!b) return;
        S.items.teleport--; S.fx.teleport = { region: b.dataset.r, until: Date.now() + 24 * 3600000 };
        save(); m.remove(); if (ovl) ovl.remove(); go("discover");
        toast(`🌏 ${b.dataset.r}(으)로 텔레포트! 24시간 유지돼요`);
      });
    }
  }

  /* ══ 크러시 카드 (수집 · 가챠 · 진화) ══ */
  const EVOLVE_COST = { 2: 3, 3: 5 };
  const MILESTONES = [4, 8, 12, 16];
  function ownedKinds() { return Object.keys(S.cards).length; }
  function rollGacha() {
    // pity: 10회 연속 SR 미만이면 SR 이상 확정
    let rarity;
    if (S.gacha.pity >= 9) rarity = Math.random() < 0.25 ? "SSR" : "SR";
    else {
      const r = Math.random() * 100;
      rarity = r < 3 ? "SSR" : r < 13 ? "SR" : r < 40 ? "R" : "N";
    }
    S.gacha.pity = (rarity === "SR" || rarity === "SSR") ? 0 : S.gacha.pity + 1;
    const pool = CD.CHARS.filter((c) => c.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function doGacha() {
    const free = gachaFreeAvail();
    if (!free && S.items.gachaticket <= 0) { openShop("gachaticket"); return; }
    if (free) {
      if (S.gacha.day !== todayStr()) { S.gacha.day = todayStr(); S.gacha.freeCount = 0; }
      S.gacha.freeCount = (S.gacha.freeCount || 0) + 1;
    } else S.items.gachaticket--;
    const c = rollGacha();
    const before = S.cards[c.id];
    const isNew = !before;
    if (before) before.n++;
    else S.cards[c.id] = { n: 1, lv: 1 };
    // 컬렉션 마일스톤 보상
    let milestone = 0;
    if (isNew && MILESTONES.includes(ownedKinds())) { milestone = ownedKinds(); S.items.gachaticket++; }
    save(); badges();
    gachaReveal(c, isNew, milestone);
  }
  function gachaReveal(c, isNew, milestone) {
    const R = CD.RARITY[c.rarity];
    const m = modal(`<div class="gacha-stage">
      <div class="gacha-flip"><div class="gacha-inner">
        <div class="gacha-back"><span class="prism-mark" style="font-size:64px">◈</span></div>
        <div class="gacha-front"><div class="ccard r-${c.rarity}" style="--frame:${R.color}">
          ${c.rarity === "SSR" ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { animate: true, uid: "g" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>${esc(c.name)}</b><small>${esc(c.job)}</small></div>
        </div></div>
      </div></div>
      <p class="gacha-line">"${esc(c.line)}"</p>
      <p class="gacha-note">${isNew ? `<b style="color:${R.color}">NEW!</b> 컬렉션에 추가됐어요` : `중복 카드 — 진화 재료 +1 (보유 ${S.cards[c.id].n}장)`}
      ${milestone ? `<br>🎁 컬렉션 ${milestone}종 달성 보상: 뽑기권 +1` : ""}</p>
      <div class="match-btns">
        <button class="btn-grad big" data-again>${gachaFreeAvail() ? "무료로 한 번 더" : S.items.gachaticket > 0 ? `한 번 더 (뽑기권 ${S.items.gachaticket}장)` : "뽑기권 구매하기 🛍️"}</button>
        <button class="btn-ghost" data-close>앨범 보기</button>
      </div></div>`, { sticky: true });
    m.classList.add("center");
    $("[data-again]", m).onclick = () => { m.remove(); doGacha(); };
    $("[data-close]", m).onclick = () => { m.remove(); go("cards"); };
    vibrate(c.rarity === "SSR" ? [40, 60, 40, 60, 80] : c.rarity === "SR" ? [30, 50, 30] : 15);
  }
  function vCards() {
    const owned = ownedKinds();
    const free = gachaFreeAvail();
    const lb = cardLikeBonus(), sb = cardSuperBonus();
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">크러시 카드</div>
      <p class="sec-sub">일러스트 캐릭터를 모으고 진화시키면 <b>매칭 버프</b>가 쌓여요</p></div>
      <div class="gacha-box">
        <div class="gb-left"><b>컬렉션 ${owned}/16</b>
          <div class="gb-bar"><i style="width:${owned / 16 * 100}%"></i></div>
          <small>${lb || sb ? `버프: ${lb ? `좋아요 +${lb}/일` : ""}${lb && sb ? " · " : ""}${sb ? `슈퍼라이크 +${sb}/일` : ""}` : "카드를 진화시키면 좋아요 한도가 늘어나요"}</small></div>
        <button class="btn-grad" id="g-pull">${free ? "오늘의 무료 뽑기 🎴" : `뽑기 (권 ${S.items.gachaticket}장)`}</button>
      </div>
      <div class="ccard-grid">${CD.CHARS.map((c) => {
        const st = S.cards[c.id];
        const R = CD.RARITY[c.rarity];
        if (!st) return `<div class="ccard locked"><div class="ccard-q">?</div><div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>???</b><small>미획득</small></div></div>`;
        return `<button class="ccard r-${c.rarity} owned" data-cid="${c.id}" style="--frame:${R.color}">
          ${c.rarity === "SSR" ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { uid: "t" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>${esc(c.name)} ${"★".repeat(st.lv)}</b><small>${esc(c.job)} · ${st.n}장</small></div>
        </button>`;
      }).join("")}</div>
      <p class="tiny" style="padding:0 18px 16px;text-align:center">모든 캐릭터는 가상의 일러스트입니다 · 같은 카드를 모으면 진화 (★2: 3장 소모 · ★3: 5장 소모)</p>
      ${adSlot()}`;
    $("#g-pull").onclick = doGacha;
    $$(".ccard.owned").forEach((b) => b.onclick = () => cardDetail(b.dataset.cid));
  }
  function cardDetail(cid) {
    const c = cardOf(cid); const st = S.cards[cid];
    if (!c || !st) return;
    const R = CD.RARITY[c.rarity];
    const nextLv = st.lv + 1;
    const cost = EVOLVE_COST[nextLv];
    const canEvolve = cost && st.n > cost;
    const o = document.createElement("div");
    o.className = "ovl";
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close" aria-label="닫기">‹</button><span class="ovl-title">카드 상세</span></div>
      <div class="ovl-body" style="display:flex;flex-direction:column;align-items:center;padding:20px">
        <div class="ccard big r-${c.rarity} lv-${st.lv}" style="--frame:${R.color}">
          ${c.rarity === "SSR" || st.lv >= 3 ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { animate: true, uid: "d" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity} ${"★".repeat(st.lv)}</span><b>${esc(c.name)}</b><small>${esc(c.job)}</small></div>
        </div>
        <p class="gacha-line">"${esc(c.line)}"</p>
        <div class="ev-box">
          <div><b>보유 ${st.n}장</b><small>${cost ? `진화 재료 ${Math.max(0, st.n - 1)}/${cost}` : "최대 레벨"}</small></div>
          ${cost ? `<button class="btn-grad" id="ev-go" ${canEvolve ? "" : "disabled"}>★${nextLv}로 진화 (${cost}장 소모)</button>` : `<span style="font-size:20px">👑</span>`}
        </div>
        <p class="tiny" style="margin-top:10px;text-align:center">진화 보상: 레벨당 <b>일일 좋아요 +2</b>${c.rarity === "SSR" ? " · SSR 보유: 슈퍼라이크 +1/일" : ""}</p>
      </div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
    const ev = $("#ev-go", o);
    if (ev) ev.onclick = () => {
      if (!canEvolve) return;
      st.n -= cost; st.lv = nextLv; save();
      o.remove(); vibrate([30, 50, 30, 50]);
      const dlg = modal(`<div class="dialog"><div class="em">🌟</div><h3>${esc(c.name)} ★${nextLv} 진화!</h3><p>일일 좋아요 한도가 +2 늘었어요.<br>현재 카드 버프: 좋아요 +${cardLikeBonus()}/일</p>
        <button class="btn-grad big" data-ok>멋져요!</button></div>`, { center: true });
      $("[data-ok]", dlg).onclick = () => { dlg.remove(); cardDetail(cid); };
    };
  }

  /* ══ 위장 (제목 · 파비콘) ══ */
  const NEUTRAL_ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f5b642"/><rect x="14" y="12" width="36" height="40" rx="5" fill="#fff"/><path d="M20 22h24M20 30h24M20 38h16" stroke="#c9cdd6" stroke-width="3" stroke-linecap="round"/></svg>');
  const REAL_TITLE = document.title;
  function applyDisguise(force) {
    const on = force || S.settings.disguise || !!stealthEl;
    document.title = on ? "메모" : REAL_TITLE;
    const link = $('link[rel="icon"]');
    if (link) link.href = on ? NEUTRAL_ICON : "favicon.svg";
  }
  /* 글자 크기 (접근성) */
  function applyFontScale() {
    document.documentElement.classList.remove("fs-1", "fs-2");
    if (S.settings.fontScale) document.documentElement.classList.add("fs-" + S.settings.fontScale);
  }

  /* ══ 스텔스 모드 (빠른 숨김) ══ */
  let stealthEl = null;
  const MEMO_POOL = [
    ["장보기", "우유, 계란, 두부, 파"], ["할 일", "세탁소 옷 찾기 · 공과금 납부"], ["금요일", "팀 회식 7시 — 위치 확인"],
    ["아이디어", "주말에 부모님 댁 방문"], ["운동", "월수금 헬스 / 화목 러닝 30분"], ["책", "빌린 책 반납 D-3"],
    ["여행", "숙소 체크인 15:00 · 짐 미리 싸기"], ["병원", "치과 예약 변경하기"], ["집", "정수기 필터 교체"],
  ];
  function toggleStealth() {
    if (stealthEl) return;
    const start = () => {
      stealthEl = document.createElement("div");
      applyDisguise(true);
      // 사용자별 랜덤 메모 4개 — 화면이 항상 같아 보이지 않게
      if (!S.memoSeed) { S.memoSeed = Math.floor(Math.random() * 9999); save(); }
      const memos = MEMO_POOL.slice().sort((a, b) => ((a[0].charCodeAt(0) * S.memoSeed) % 17) - ((b[0].charCodeAt(0) * S.memoSeed) % 17)).slice(0, 4);
      stealthEl.style.cssText = "position:fixed;inset:0;background:#f4f5f7;color:#222;z-index:9999;font-family:inherit;padding:0;overflow-y:auto";
      stealthEl.innerHTML = `
        <div style="background:#fff;border-bottom:1px solid #e2e4e8;padding:16px 18px;font-weight:800;font-size:17px;color:#111" id="st-title">메모</div>
        ${memos.map((n) => `<div style="background:#fff;margin:10px 14px;border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.06)"><b style="font-size:14px">${n[0]}</b><div style="color:#777;font-size:13px;margin-top:4px">${n[1]}</div></div>`).join("")}`;
      document.body.appendChild(stealthEl);
      let taps = 0, timer = null;
      $("#st-title", stealthEl).addEventListener("click", () => {
        taps++; clearTimeout(timer); timer = setTimeout(() => { taps = 0; }, 700);
        if (taps >= 3) {
          stealthEl.remove(); stealthEl = null; applyDisguise();
          if (hasPin()) renderLock(() => { show("scr-main"); });
        }
      });
    };
    if (!S.stealthCoach) {
      S.stealthCoach = true; save();
      confirmDlg("👓", "스텔스 모드", "평범한 메모 화면으로 위장해요.<br><b>돌아오려면 '메모' 제목을 3번 연속 탭</b> —<br>이 안내는 위장 화면에는 표시되지 않아요.", "위장 시작", start);
    } else start();
  }

  /* ══ PWA 설치 ══ */
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
  function installApp() {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(() => { deferredInstall = null; });
    } else {
      modal(`<div class="dialog"><div class="em">📲</div><h3>앱으로 설치하기</h3>
        <p style="text-align:left">• <b>iPhone (Safari)</b>: 공유 버튼 → "홈 화면에 추가"<br><br>• <b>Android (Chrome)</b>: 메뉴(⋮) → "홈 화면에 추가"<br><br>설치하면 아이콘으로 바로 열리는 앱이 돼요.</p>
        <button class="btn-grad big" data-ok>확인</button></div>`, { center: true })
        .querySelector("[data-ok]").onclick = function () { this.closest(".modal-back").remove(); };
    }
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  /* ══ 부트 ══ */
  $("#btn-start").onclick = startOnboarding;
  $("#btn-stealth").onclick = toggleStealth;
  $("#btn-shop").onclick = () => openShop();
  $("#btn-premium-badge").onclick = () => openPremium();
  function boot() {
    dailyTick();
    applyFontScale();
    applyDisguise();
    // 구버전 평문 PIN → 해시 마이그레이션
    if (S.settings.pin && !S.settings.pinHash) {
      pinHash(S.settings.pin).then((h) => { S.settings.pinHash = h; S.settings.pin = null; save(); });
    }
    // 자정 넘김 감지 (앱을 켜둔 채로도 일일 한도 리셋)
    setInterval(dailyTick, 60000);
    const enter = () => { S.user ? enterMain() : show("scr-welcome"); };
    if (S.user && hasPin()) renderLock(enter);
    else enter();
  }
  boot();
})();
