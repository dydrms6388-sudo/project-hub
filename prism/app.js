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
    settings: { pin: null, hideDistance: false, privateMode: false, bgLock: true, disguise: false, fontScale: 0, lang: "ko" },
    filters: { ageMin: 20, ageMax: 50, area: "all", looking: "all", position: "all" },
    stats: { likesSent: 0, matches: 0 },
    items: { teleport: 0, spotlight: 0, superlike: 0, boostticket: 0, refill: 0, gachaticket: 0 },
    fx: { teleport: null, spotlightUntil: 0 }, // teleport: {region, until}
    cards: {}, // charId -> {n, lv}
    gacha: { day: "", freeUsed: false, pity: 0 },
    roulette: { day: "" },
    wc: { day: "", champ: "" },
    battle: { day: "", plays: 0, winsToday: 0, rewarded: 0, streak: 0, best: 0, totalWins: 0 },
    balance: {},
    streak: { last: "", n: 0 },
    joinedAt: Date.now(),
  });
  let S;
  try { S = Object.assign(DEFAULTS(), JSON.parse(localStorage.getItem(LS) || "null") || {}); }
  catch (e) { S = DEFAULTS(); }
  // 구버전 저장 데이터 마이그레이션
  S.items = Object.assign({ teleport: 0, spotlight: 0, superlike: 0, boostticket: 0, refill: 0, gachaticket: 0 }, S.items || {});
  S.fx = Object.assign({ teleport: null, spotlightUntil: 0 }, S.fx || {});
  S.cards = S.cards || {};
  // 카드 모델 v1 {n,lv} → v2 {레벨:장수} 마이그레이션
  Object.keys(S.cards).forEach((id) => {
    const c = S.cards[id];
    if (c && typeof c.n === "number") {
      const copies = {}; copies[c.lv || 1] = 1;
      if (c.n > 1) copies[1] = (copies[1] || 0) + (c.n - 1);
      S.cards[id] = copies;
    }
  });
  S.gacha = Object.assign({ day: "", freeUsed: false, pity: 0 }, S.gacha || {});
  S.roulette = Object.assign({ day: "" }, S.roulette || {});
  S.wc = Object.assign({ day: "", champ: "" }, S.wc || {});
  S.battle = Object.assign({ day: "", plays: 0, winsToday: 0, rewarded: 0, streak: 0, best: 0, totalWins: 0 }, S.battle || {});
  S.balance = S.balance || {};
  S.streak = Object.assign({ last: "", n: 0 }, S.streak || {});
  S.settings = Object.assign({ pin: null, hideDistance: false, privateMode: false, bgLock: true, disguise: false, fontScale: 0, lang: "ko" }, S.settings || {});
  S.filters = Object.assign({ ageMin: 20, ageMax: 50, area: "all", looking: "all", position: "all" }, S.filters || {});
  if (S.filters.ageMax === 45) S.filters.ageMax = 50; // 구버전 기본값 승격
  S.stats = Object.assign({ likesSent: 0, matches: 0 }, S.stats || {});
  // 프로필 신규 필드 마이그레이션 (사진/성향/스타일/찾는관계 다중/커밍아웃)
  if (S.user) {
    if (!Array.isArray(S.user.photos)) S.user.photos = [];
    if (!Array.isArray(S.user.privatePhotos)) S.user.privatePhotos = [];
    if (!Array.isArray(S.user.lookingList)) S.user.lookingList = S.user.lookingFor ? [S.user.lookingFor] : [];
    if (!Array.isArray(S.user.styles)) S.user.styles = [];
    if (typeof S.user.position !== "string") S.user.position = "";
    if (typeof S.user.outLevel !== "string") S.user.outLevel = "";
    if (!Array.isArray(S.user.topics)) S.user.topics = [];
  }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {
    // localStorage 초과(사진 과다) 시 안내
    toast && toast("⚠️ 저장 공간이 가득 찼어요. 사진 수를 줄여주세요");
  } };

  /* ══ 다국어 (i18n) — 한국어 원문 → 영어 사전, 미번역 문자열은 한국어 폴백 ══ */
  const I18N_EN = {
    // 탭 · 상단
    "둘러보기": "Discover", "좋아요": "Likes", "채팅": "Chats", "라운지": "Lounge", "카드": "Cards",
    "아이템 상점": "Item Shop", "프리미엄": "Premium", "프로필": "Profile", "무료": "Free",
    // 웰컴
    "나를 숨기지 않는 만남 — 게이·바이·퀴어 남성 모두 환영": "Dating without hiding — all gay, bi & queer men welcome",
    "시작하기": "Get Started",
    "기본 무료 · 가입 없이 이 기기에서 바로 · 19세 이상": "Free · No sign-up, runs on this device · 19+",
    "본 서비스는 데모 버전으로, 등장하는 프로필은 모두 가상 인물입니다.": "This is a demo — all profiles are fictional.",
    // 디스커버
    "필터": "Filter", "패스": "Pass", "슈퍼": "Super", "되돌리기": "Rewind", "부스트": "Boost",
    "오늘 좋아요": "Likes today", "슈퍼라이크": "Super Likes", "무제한": "Unlimited",
    "탐색 필터": "Discovery Filters", "적용하기": "Apply", "초기화": "Reset",
    // 섹션 헤더
    "받은 좋아요": "Likes You", "크러시 카드 도감": "Crush Card Collection",
    "만남 전에, 가볍게 서로를 알아가는 공간": "A light space to get to know each other first",
    "매치된 사람들과의 대화": "Conversations with your matches",
    // 게임
    "데일리 룰렛": "Daily Roulette", "매력 배틀": "Charm Battle", "이상형 월드컵": "Ideal-Type World Cup",
    "무료 뽑기": "Free pull", "10연챠": "10-Pull",
    // MY 메뉴
    "프로필 수정": "Edit Profile", "프로필 인증하기": "Verify Profile", "홈 화면에 앱 설치": "Install App",
    "글자 크기": "Font Size", "앱 잠금 (PIN)": "App Lock (PIN)", "화면 이탈 시 즉시 잠금": "Lock instantly on leave",
    "위장 제목 항상 사용": "Always disguise title", "거리 숨기기": "Hide distance",
    "프라이빗 모드 (새 노출 중단)": "Private mode (pause exposure)", "안전 센터": "Safety Center",
    "차단 목록": "Blocked Users", "데이터 초기화 (계정 삭제)": "Reset Data (delete account)",
    "언어": "Language", "프라이버시 · 안전": "Privacy · Safety",
    "무료 플랜 이용 중": "On the Free plan", "플랜 관리": "Manage Plan",
    "프로필 완성도": "Profile Completion",
    "인증됨 ✔︎": "Verified ✔︎", "미인증": "Not verified", "사용 중": "On", "꺼짐": "Off",
    // 공용 버튼
    "닫기": "Close", "확인": "OK", "취소": "Cancel", "저장": "Save", "다음": "Next", "다음에": "Later",
  };
  const curLang = () => (S.settings && S.settings.lang) || "ko";
  const t = (s) => curLang() === "en" ? (I18N_EN[s] || s) : s;
  /* 정적 화면(웰컴·탭바) 텍스트 재도색 */
  function paintStatic() {
    const TAB_LB = { discover: "둘러보기", likes: "좋아요", chats: "채팅", community: "라운지", cards: "카드", my: "MY" };
    $$("#tabbar .tab").forEach((b) => { const lb = $(".t-lb", b); if (lb) lb.textContent = t(TAB_LB[b.dataset.tab] || lb.textContent); });
    const wt = $(".w-tag"); if (wt) wt.textContent = t("나를 숨기지 않는 만남 — 게이·바이·퀴어 남성 모두 환영");
    const bs = $("#btn-start"); if (bs) bs.textContent = t("시작하기");
    const wn = $(".w-note"); if (wn) wn.textContent = t("기본 무료 · 가입 없이 이 기기에서 바로 · 19세 이상");
    const wd = $(".w-demo"); if (wd) wd.textContent = t("본 서비스는 데모 버전으로, 등장하는 프로필은 모두 가상 인물입니다.");
    if (curLang() === "en") {
      const FE = [["Anti-outing by design", "PIN lock · stealth mode · everything stays on this device"],
        ["Taste-based matching", "Compatibility scored by interests, distance & activity"],
        ["Easy first conversations", "Icebreaker prompts the moment you match"],
        ["Safety Center", "One-tap block & report, queer dating safety guide"]];
      $$(".w-feats li").forEach((li, i) => { if (FE[i]) { const b = $("b", li), s = $("small", li); if (b) b.textContent = FE[i][0]; if (s) s.textContent = FE[i][1]; } });
    }
  }

  const PLANS = {
    free:  { label: "무료",        likes: 20, supers: 1, seeLikes: false, rewind: 1,        boost: 0, ads: true,  read: false },
    plus:  { label: "PRISM+",      likes: Infinity, supers: 1, seeLikes: true, rewind: Infinity, boost: 1, ads: false, read: false },
    black: { label: "PRISM Black", likes: Infinity, supers: 5, seeLikes: true, rewind: Infinity, boost: 4, ads: false, read: true },
  };
  const rewindLeft = () => plan().rewind === Infinity ? Infinity : Math.max(0, plan().rewind - (S.rewindsUsed || 0));
  const plan = () => PLANS[S.premium.plan] || PLANS.free;
  const P = (id) => D.profiles.find((p) => p.id === id);

  /* ── 아이템 상점 (소모품 수익) ── */
  const SHOP = [
    { key: "teleport", em: "🌏", name: "텔레포트", desc: "24시간 동안 원하는 지역으로 순간이동 — 그 동네 사람들이 먼저 보여요", packs: [{ n: 1, price: 3500 }, { n: 3, price: 8900 }] },
    { key: "spotlight", em: "✨", name: "스포트라이트", desc: "3시간 동안 내 프로필 상단 고정 노출 — 노출이 크게 늘어요", packs: [{ n: 1, price: 2500 }, { n: 5, price: 9900 }] },
    { key: "superlike", em: "⭐", name: "슈퍼라이크 팩", desc: "일일 한도와 무관하게 쓰는 슈퍼라이크 5개", packs: [{ n: 5, price: 4500 }] },
    { key: "boostticket", em: "🚀", name: "부스트 1회권", desc: "플랜과 무관하게 30분 부스트 — 무료 플랜도 OK", packs: [{ n: 1, price: 3900 }] },
    { key: "refill", em: "💜", name: "좋아요 리필", desc: "오늘의 좋아요 20개 즉시 충전", packs: [{ n: 1, price: 1900 }] },
    { key: "gachaticket", em: "🎴", name: "크러시 팩 뽑기권", desc: "카드 1장 · N60/R27/SR10/SSR3% · SR+ 10회·SSR 40회 천장 · SSR의 50%는 주간 픽업(픽뚫 시 다음 확정)", packs: [{ n: 1, price: 1500 }, { n: 10, price: 12900 }] },
  ];
  const itemDiscount = () => (S.premium.plan === "black" ? 0.15 : S.premium.plan === "plus" ? 0.05 : 0);
  const itemPrice = (base) => Math.round(base * (1 - itemDiscount()) / 100) * 100;
  const won = (n) => n.toLocaleString("ko-KR") + "원";
  const teleportActive = () => S.fx.teleport && Date.now() < S.fx.teleport.until ? S.fx.teleport : null;
  const spotlightActive = () => Date.now() < S.fx.spotlightUntil;

  /* ── 크러시 카드 버프 (게임 ↔ 매칭 루프 연결) ──
     카드 보유 모델: S.cards[id] = { "1": n, "2": n, ... } (레벨별 장수) */
  const CD = window.PRISM_CARDS || { CHARS: [], RARITY: {}, charSVG: () => "" };
  const MAX_CARD_LV = 5;
  const cardOf = (id) => CD.CHARS.find((c) => c.id === id);
  const cardCopies = (id) => S.cards[id] || {};
  const cardTotal = (id) => Object.values(cardCopies(id)).reduce((a, b) => a + b, 0);
  const cardMaxLv = (id) => {
    const lvs = Object.keys(cardCopies(id)).filter((l) => cardCopies(id)[l] > 0).map(Number);
    return lvs.length ? Math.max(...lvs) : 0;
  };
  const cardOwned = (id) => cardTotal(id) > 0;
  const cardLikeBonus = () => Math.min(30, Object.keys(S.cards).reduce((a, id) => a + Math.max(0, cardMaxLv(id) - 1), 0));
  const cardSuperBonus = () => Math.min(3, Object.keys(S.cards).filter((id) => cardOwned(id) && (cardOf(id) || {}).rarity === "SSR").length);
  const likeLimit = () => plan().likes === Infinity ? Infinity : plan().likes + cardLikeBonus() + profileBonusLikes();
  const superLimit = () => plan().supers + cardSuperBonus();
  const gachaFreeMax = () => (S.premium.plan === "black" ? 2 : 1); // Black: 매일 무료 뽑기 2회
  const gachaFreeLeft = () => S.gacha.day !== todayStr() ? gachaFreeMax() : Math.max(0, gachaFreeMax() - (S.gacha.freeCount || 0));
  const gachaFreeAvail = () => gachaFreeLeft() > 0;

  /* ── 일일 리셋 & 새 좋아요 유입 ── */
  function dailyTick() {
    const t = todayStr();
    let dirty = false;
    if (S.day !== t) {
      S.day = t; S.likesUsed = 0; S.supersUsed = 0; S.rewindsUsed = 0;
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

  /* ── 지역 인식 거리 (권역 그룹핑 — 지방 사용자 풀 확대) ── */
  const AREA_GROUP = { 천안: "충청", 청주: "충청", 전주: "전라", 순천: "전라", 포항: "경상", 창원: "경상" };
  const REGION_ZONE = { 서울: "수도권", 경기: "수도권", 인천: "수도권", 부산: "영남", 대구: "영남", 울산: "영남", 경상: "영남", 광주: "호남", 전라: "호남", 대전: "충청권", 세종: "충청권", 충청: "충청권", 강원: "강원", 제주: "제주" };
  const ZONES = ["수도권", "영남", "호남", "충청권", "강원", "제주"];
  const groupOf = (a) => AREA_GROUP[a] || a;
  const zoneOf = (a) => REGION_ZONE[groupOf(a)] || groupOf(a);
  const myArea = () => ((S.user && S.user.region) || "").split(" ")[0];
  const areaOf = (p) => p.region.split(" ")[0];
  const sameArea = (p) => {
    const tp = teleportActive();
    if (tp) return zoneOf(areaOf(p)) === zoneOf(tp.region);
    return zoneOf(areaOf(p)) === zoneOf(myArea());
  };
  function distLabel(p) {
    if (S.settings.hideDistance) return `📍 ${esc(p.region)}`;
    return sameArea(p) ? `📍 ${esc(p.region)} · ${p.distanceKm}km` : `📍 ${esc(p.region)} · 다른 지역`;
  }

  /* ── 궁합 점수 (감산 포함 실분산 31~99) ── */
  function compat(p) {
    if (!S.user) return 70;
    let sc = 46;
    const shared = p.tags.filter((t) => S.user.tags.includes(t));
    sc += Math.min(32, shared.length * 8);
    if (p.lastActiveMin < 60) sc += 8; else if (p.lastActiveMin < 720) sc += 4;
    else if (p.lastActiveMin > 2880) sc -= 7; // 이틀 이상 미접속 감산
    if (sameArea(p)) { sc += 6; if (p.distanceKm < 5) sc += 6; else if (p.distanceKm < 15) sc += 3; }
    else sc -= 8; // 타 권역 감산
    if (p.lookingFor === S.user.lookingFor) sc += 6;
    sc += Math.min(9, sharedTopics(p).length * 5); // 같은 라운지 참여 가산
    return Math.max(31, Math.min(99, sc));
  }
  const sharedTags = (p) => (S.user ? p.tags.filter((t) => S.user.tags.includes(t)) : []);
  /* ── 주제별 라운지 (관심 주제 방 · 커뮤니티 ↔ 매칭 연결) ── */
  const TOPICS = [["운동", "💪"], ["전시·문화", "🎨"], ["반려동물", "🐾"], ["여행", "✈️"], ["게임", "🎮"], ["맛집·요리", "🍜"], ["영화·드라마", "🎬"], ["동네모임", "🏘️"]];
  const TOPIC_EM = (name) => (TOPICS.find((t) => t[0] === name) || ["", "🏳️‍🌈"])[1];
  const TAG2TOPIC = { 러닝: "운동", 헬스: "운동", 등산: "운동", 클라이밍: "운동", 전시: "전시·문화", 미술: "전시·문화", 사진: "전시·문화", 공연: "전시·문화", 반려동물: "반려동물", 강아지: "반려동물", 고양이: "반려동물", 여행: "여행", 캠핑: "여행", 게임: "게임", 보드게임: "게임", 맛집탐방: "맛집·요리", 베이킹: "맛집·요리", 요리: "맛집·요리", 와인: "맛집·요리", 커피: "맛집·요리", 카페투어: "맛집·요리", 영화: "영화·드라마", 음악: "영화·드라마", 넷플릭스: "영화·드라마" };
  // 데모 프로필의 주제 파생(태그 기반 + id 시드 보장)
  const demoTopics = (p) => {
    if (p.topics) return p.topics;
    const set = new Set();
    (p.tags || []).forEach((t) => { if (TAG2TOPIC[t]) set.add(TAG2TOPIC[t]); });
    if (!set.size) set.add(TOPICS[demoHash(p.id) % TOPICS.length][0]);
    return Array.from(set).slice(0, 3);
  };
  const myTopics = () => (S.user && Array.isArray(S.user.topics) ? S.user.topics : []);
  const sharedTopics = (p) => { const mine = myTopics(); return demoTopics(p).filter((t) => mine.includes(t)); };
  const topicMembers = (name) => D.profiles.filter((p) => !S.blocked.includes(p.id) && demoTopics(p).includes(name));
  /* ── 프로필 완성도 (가중 100점) ── */
  function profileScore() {
    const u = S.user; if (!u) return { pct: 0, items: [] };
    const items = [
      { label: "사진 등록", done: (u.photos || []).length > 0, w: 22, go: "edit" },
      { label: "사진 2장 이상", done: (u.photos || []).length >= 2, w: 10, go: "edit" },
      { label: "자기소개 20자+", done: (u.intro || "").trim().length >= 20, w: 15, go: "edit" },
      { label: "관심사 3개+", done: (u.tags || []).length >= 3, w: 10, go: "edit" },
      { label: "성향 선택", done: !!u.position, w: 8, go: "edit" },
      { label: "스타일 태그", done: (u.styles || []).length > 0, w: 8, go: "edit" },
      { label: "찾는 관계", done: (u.lookingList || []).length > 0, w: 7, go: "edit" },
      { label: "관심 주제 참여", done: (u.topics || []).length > 0, w: 8, go: "community" },
      { label: "프로필 인증", done: !!u.verified, w: 12, go: "verify" },
    ];
    const pct = items.filter((i) => i.done).reduce((a, i) => a + i.w, 0);
    return { pct, items };
  }
  const profileBonusLikes = () => profileScore().pct >= 80 ? 5 : 0; // 완성 보너스: 일일 좋아요 +5

  /* ── 데이트 코스 추천 (공통 주제·지역 기반) ── */
  const DATE_SPOTS = {
    "운동": ["한강공원에서 같이 러닝하고 스트레칭", "클라이밍장 원데이 클래스 도전", "올림픽공원 자전거 라이딩"],
    "전시·문화": ["요즘 화제인 전시 함께 관람", "독립서점·소품샵 구경", "소극장 공연 관람"],
    "반려동물": ["애견 동반 카페에서 힐링", "반려동물 소품샵 구경 후 산책", "펫 프렌들리 공원 나들이"],
    "여행": ["근교로 당일치기 드라이브", "안 가본 동네 골목 투어", "루프탑에서 도시 전망 감상"],
    "게임": ["보드게임 카페에서 한판 승부", "방탈출 협동전", "레트로 오락실 대결"],
    "맛집·요리": ["줄 서는 맛집 도장깨기", "둘이 쿠킹 클래스 참여", "야시장 먹방 투어"],
    "영화·드라마": ["심야 영화 한 편 관람", "감성 카페에서 인생영화 토크", "브런치 후 드라마 정주행 수다"],
    "동네모임": ["동네 카페 탐방", "골목 산책 후 포차 한잔", "플리마켓 구경"],
  };
  const DATE_FINALE = ["근처 조용한 바에서 한 잔", "야경 좋은 곳에서 산책 마무리", "디저트 카페에서 도란도란", "강변 벤치에서 야식 나눔"];
  function dateCourse(p, salt) {
    const seed = demoHash(p.id + "date" + (salt || 0));
    const topics = sharedTopics(p).length ? sharedTopics(p) : demoTopics(p);
    const topic = topics[seed % topics.length];
    const spots = DATE_SPOTS[topic] || DATE_SPOTS["동네모임"];
    const region = (p.region || "").split(" ")[0] || "우리 동네";
    return {
      topic, shared: sharedTopics(p).length,
      steps: [
        { em: "📍", t: `${esc(region)} 근처에서 만나 가볍게 인사`, s: "부담 없이 카페에서 첫 대화" },
        { em: TOPIC_EM(topic), t: esc(spots[seed % spots.length]), s: `${esc(topic)} 취향이 통하는 코스` },
        { em: "🌙", t: esc(DATE_FINALE[(seed >> 3) % DATE_FINALE.length]), s: "여운 남기는 마무리" },
      ],
    };
  }
  function dateCourseModal(pid, salt, withChat) {
    const p = P(pid); if (!p) return;
    salt = salt || 0;
    const c = dateCourse(p, salt);
    const m = modal(`<div class="dialog dc-dialog"><div class="em">💡</div>
      <h3>${esc(p.name)}님과 이런 데이트 어때요?</h3>
      <p style="font-size:12.5px;margin:0 0 12px">${c.shared ? `공통 관심 <b style="color:var(--vio)">${TOPIC_EM(c.topic)} ${esc(c.topic)}</b> 기반 추천` : `${TOPIC_EM(c.topic)} ${esc(c.topic)} 테마 추천`} · 데모 아이디어예요</p>
      <div class="dc-steps">${c.steps.map((s, i) => `<div class="dc-step"><span class="dc-em">${s.em}</span><div><b>${i + 1}. ${s.t}</b><small>${s.s}</small></div></div>`).join("")}</div>
      ${withChat ? `<button class="btn-grad big" data-chat style="margin-bottom:8px">💬 이 얘기로 대화 시작</button>` : ""}
      <div class="row"><button class="btn-ghost" data-x>닫기</button><button class="btn-grad" data-again>다른 코스</button></div></div>`, { center: true });
    $("[data-x]", m).onclick = () => m.remove();
    $("[data-again]", m).onclick = () => { m.remove(); dateCourseModal(pid, salt + 1, withChat); };
    const ch = $("[data-chat]", m); if (ch) ch.onclick = () => { m.remove(); openChat(pid); };
  }
  // 최초 100% 달성 시 1회 보상
  function checkProfileComplete() {
    if (profileScore().pct >= 100 && !S.profileComplete100) {
      S.profileComplete100 = true; S.items.gachaticket += 3; save();
      setTimeout(() => toast("🏆 프로필 100% 완성! 크러시 팩 뽑기권 +3 보너스"), 400);
    }
  }

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
    // 접근성: 포커스 이동·트랩·복원 + Esc 닫기
    const prevFocus = document.activeElement;
    const origRemove = back.remove.bind(back);
    back.remove = () => { origRemove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {} };
    back.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !(opts && opts.sticky)) { back.remove(); return; }
      if (e.key !== "Tab") return;
      const f = $$("button,input,select,textarea,a[href]", back).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $("#modal-root").appendChild(back);
    const focusables = $$("button,input,select,textarea", back).filter((x) => !x.disabled);
    if (focusables.length) setTimeout(() => focusables[0].focus(), 30);
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
  // 시도 제한을 localStorage에 영속화 (새로고침 우회 방지)
  S.pinGuard = Object.assign({ fails: 0, coolUntil: 0 }, S.pinGuard || {});
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
      if (Date.now() < S.pinGuard.coolUntil) { toast(`잠시 후 다시 시도하세요 (${Math.ceil((S.pinGuard.coolUntil - Date.now()) / 1000)}초)`); return; }
      const k = b.dataset.k;
      if (k === "⌫") buf = buf.slice(0, -1);
      else if (buf.length < 4) buf += k;
      paint();
      if (buf.length === 4) {
        if (await checkPin(buf)) { buf = ""; S.pinGuard = { fails: 0, coolUntil: 0 }; save(); unlock(); }
        else {
          S.pinGuard.fails++; buf = "";
          if (S.pinGuard.fails >= 5) { S.pinGuard.coolUntil = Date.now() + 30000; S.pinGuard.fails = 0; toast("5회 오류 — 30초 후 다시 시도하세요"); }
          save();
          dots.classList.add("err"); vibrate(80);
          setTimeout(() => { dots.classList.remove("err"); paint(); }, 450);
        }
      }
    };
    paint();
  }
  /* 화면 이탈 시 즉시 잠금 + 중립 커버 (태스크 스위처·탭 미리보기 노출 방지) */
  let privacyCover = null;
  function showCover() {
    if (privacyCover || !S.user) return;
    if (!((hasPin() && S.settings.bgLock) || S.settings.disguise)) return; // 위장만 켠 유저도 커버
    privacyCover = document.createElement("div");
    privacyCover.style.cssText = "position:fixed;inset:0;background:#f4f5f7;z-index:9998;display:flex;align-items:center;justify-content:center";
    privacyCover.innerHTML = `<div style="text-align:center;color:#999;font-size:15px;font-weight:700">메모</div>`;
    document.body.appendChild(privacyCover);
  }
  function hideCover() { if (privacyCover) { privacyCover.remove(); privacyCover = null; } }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { showCover(); dailyTick(); return; }
    if (hasPin() && S.settings.bgLock && S.user && !locked && !stealthEl) {
      renderLock(() => { hideCover(); show("scr-main"); });
      hideCover();
    } else hideCover();
  });

  /* ══ 온보딩 ══ */
  const REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충청", "전라", "경상", "제주"];
  const LOOKING = ["진지한 연애", "가볍게 친구부터", "천천히 알아가기", "동네 친구", "운동 메이트", "취미 메이트", "여행 메이트"];
  /* ── 게이 데이팅 프로필 요소 ── */
  const POSITIONS = ["탑", "바텀", "올라운더", "버서블", "미정 · 천천히"];       // 성향(포지션)
  const STYLES = ["곰", "트윙크", "머슬", "늑대", "슬림", "탄탄", "댄디", "젠틀", "털보", "베어"]; // 스타일/체형(커뮤니티 표현)
  const OUT_LEVELS = ["비공개 (조심스러워요)", "일부만 알아요", "완전히 오픈"];   // 커밍아웃 정도
  const posShort = (p) => (p || "").split(" ")[0];
  // 데모 프로필 파생(고정 시드) — 시연용 포지션/스타일
  const demoHash = (id) => Array.from(String(id)).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const posOf = (p) => p.position || POSITIONS[demoHash(p.id) % POSITIONS.length];
  const stylesOf = (p) => p.styles || (() => { const h = demoHash(p.id + "s"); return [STYLES[h % STYLES.length], STYLES[(h >> 3) % STYLES.length]].filter((v, i, a) => a.indexOf(v) === i); })();

  /* ── 사진 업로드: 캔버스 리사이즈 → dataURL (localStorage 절약) ── */
  function downscaleFile(file, maxDim, cb) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        try { cb(cv.toDataURL("image/jpeg", 0.82)); } catch (err) { cb(null); }
      };
      img.onerror = () => cb(null);
      img.src = e.target.result;
    };
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
  }
  function pickPhotos(multiple, onDone) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = !!multiple;
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.onchange = () => {
      const files = Array.from(inp.files || []).slice(0, 6);
      if (!files.length) { inp.remove(); return; }
      const out = []; let done = 0;
      files.forEach((f) => downscaleFile(f, 900, (url) => {
        if (url) out.push(url); done++;
        if (done === files.length) { inp.remove(); onDone(out); }
      }));
    };
    inp.click();
  }
  // 아바타: 사진 있으면 대표사진, 없으면 이모지+그라데이션
  const avStyle = (o) => (o && o.photos && o.photos[0])
    ? `background-image:url('${o.photos[0]}');background-size:cover;background-position:center`
    : `background:linear-gradient(135deg,${(o && o.grad && o.grad[0]) || "#8b5cf6"},${(o && o.grad && o.grad[1]) || "#ec4899"})`;
  const avEm = (o) => (o && o.photos && o.photos[0]) ? "" : ((o && o.emoji) || "🙂");
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
      height: 175, mbti: "ENFP", lookingList: [LOOKING[0]], position: "", styles: [], outLevel: "",
      tags: [], emoji: AV_EMOJIS[0], grad: AV_GRADS[0], photos: [], privatePhotos: [], intro: "" };
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
    return `<h2 class="ob-h">기본 정보</h2><p class="ob-sub">매칭 추천에 활용돼요. 성향·스타일은 나중에 언제든 바꿀 수 있어요.</p>
      <div class="ob-field"><label>키 — <b id="f-height-v">${ob.height}</b>cm</label>
        <input type="range" id="f-height" min="150" max="200" value="${ob.height}" style="width:100%;accent-color:var(--vio)"></div>
      <div class="ob-field"><label>MBTI</label><select class="ob-input" id="f-mbti">${MBTIS.map((m) => `<option ${m === ob.mbti ? "selected" : ""}>${m}</option>`).join("")}</select></div>
      <div class="ob-field"><label>성향 (포지션) <small class="tiny" style="font-weight:400">· 선택 · 프로필에만 표시</small></label>
        <div class="chips" id="f-pos">${POSITIONS.map((p) => `<button class="chip ${p === ob.position ? "on" : ""}" data-v="${esc(p)}">${esc(p)}</button>`).join("")}</div></div>
      <div class="ob-field"><label>스타일 <small class="tiny" style="font-weight:400">· 나를 표현하는 태그 (여러 개)</small></label>
        <div class="chips" id="f-styles">${STYLES.map((s) => `<button class="chip ${ob.styles.includes(s) ? "on" : ""}" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>
      <div class="ob-field"><label>찾고 있는 관계 <small class="tiny" style="font-weight:400">· 여러 개 선택 가능</small></label>
        <div class="chips" id="f-looking">${LOOKING.map((l) => `<button class="chip ${ob.lookingList.includes(l) ? "on" : ""}" data-v="${esc(l)}">${esc(l)}</button>`).join("")}</div></div>
      <div class="ob-field"><label>커밍아웃 상태 <small class="tiny" style="font-weight:400">· 선택 · 안전을 위해</small></label>
        <div class="chips" id="f-out">${OUT_LEVELS.map((o) => `<button class="chip ${o === ob.outLevel ? "on" : ""}" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>
      ${obNextBtn(ob.lookingList.length >= 1)}`;
  }
  function obTags() {
    return `<h2 class="ob-h">관심사를 골라주세요</h2><p class="ob-sub">3~5개 · 겹치는 관심사가 많을수록 궁합 점수가 올라가요.</p>
      <div class="chips" id="f-tags">${masterTags().map((t) => `<button class="chip ${ob.tags.includes(t) ? "on" : ""}" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      ${obNextBtn(ob.tags.length >= 3, `다음 (${ob.tags.length}/5)`)}`;
  }
  function obAvatar() {
    const av = ob.photos[0]
      ? `<span class="avatar" style="width:88px;height:88px;background-image:url('${ob.photos[0]}');background-size:cover;background-position:center"></span>`
      : `<span class="avatar" style="width:88px;height:88px;font-size:42px;background:linear-gradient(135deg,${ob.grad[0]},${ob.grad[1]})">${ob.emoji}</span>`;
    return `<h2 class="ob-h">프로필 사진</h2><p class="ob-sub">실제 사진을 올리거나, 아바타로 시작해도 돼요. 사진은 서버로 전송되지 않고 이 기기에만 저장돼요.</p>
      <div class="av-preview">${av}<small>${ob.photos.length ? "대표 사진" : "아바타 미리보기"}</small></div>
      <div class="ob-field"><label>내 사진 <small class="tiny" style="font-weight:400">· 여러 장 (최대 6) · 첫 장이 대표</small></label>
        <div class="photo-grid" id="f-photos">${ob.photos.map((u, i) => `<div class="pg-item"><img src="${u}" alt=""><button class="pg-del" data-pi="${i}" aria-label="삭제">×</button>${i === 0 ? '<span class="pg-main">대표</span>' : ""}</div>`).join("")}
          ${ob.photos.length < 6 ? `<button class="pg-add" id="f-photo-add">＋<small>사진 추가</small></button>` : ""}</div></div>
      <div class="ob-field"><label>또는 아바타 이모지</label><div class="avatar-pick" id="f-emoji">${AV_EMOJIS.map((e) => `<button class="av-opt ${e === ob.emoji ? "on" : ""}" data-v="${e}" aria-label="아바타 이모지 ${e}">${e}</button>`).join("")}</div></div>
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
    on("#f-pos", "click", (e) => { const b = e.target.closest(".chip"); if (b) { ob.position = ob.position === b.dataset.v ? "" : b.dataset.v; re(); } });
    on("#f-out", "click", (e) => { const b = e.target.closest(".chip"); if (b) { ob.outLevel = ob.outLevel === b.dataset.v ? "" : b.dataset.v; re(); } });
    on("#f-styles", "click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return; const v = b.dataset.v;
      if (ob.styles.includes(v)) { ob.styles = ob.styles.filter((x) => x !== v); b.classList.remove("on"); }
      else if (ob.styles.length < 4) { ob.styles.push(v); b.classList.add("on"); }
      else toast("스타일은 4개까지 고를 수 있어요");
    });
    on("#f-looking", "click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return; const v = b.dataset.v;
      if (ob.lookingList.includes(v)) { ob.lookingList = ob.lookingList.filter((x) => x !== v); b.classList.remove("on"); }
      else if (ob.lookingList.length < 3) { ob.lookingList.push(v); b.classList.add("on"); }
      else { toast("최대 3개까지 고를 수 있어요"); return; }
      const nx = $("#ob-next", el); if (nx) nx.disabled = ob.lookingList.length < 1;
    });
    on("#f-photo-add", "click", () => pickPhotos(true, (arr) => { ob.photos = ob.photos.concat(arr).slice(0, 6); re(); }));
    on("#f-photos", "click", (e) => { const d = e.target.closest(".pg-del"); if (d) { ob.photos.splice(+d.dataset.pi, 1); re(); } });
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
          height: ob.height, mbti: ob.mbti, lookingList: ob.lookingList.slice(), lookingFor: ob.lookingList[0] || LOOKING[0],
          position: ob.position, styles: ob.styles.slice(), outLevel: ob.outLevel, topics: [], tags: ob.tags.slice(),
          emoji: ob.emoji, grad: ob.grad.slice(), photos: ob.photos.slice(), privatePhotos: ob.privatePhotos.slice(), intro: ob.intro.trim() };
        S.joinedAt = Date.now();
        seedIncoming(3); save();
        enterMain();
        setTimeout(() => toast("🎉 가입 완료! 벌써 " + S.incoming.length + "명이 좋아요를 보냈어요"), 700);
        // 30초 프라이버시 설정 — 핵심 차별점을 첫 경험에 노출
        setTimeout(() => {
          const pm = modal(`<div class="dialog"><div class="em">🔐</div><h3>30초 프라이버시 설정</h3>
            <p style="text-align:left">아우팅 걱정 없이 쓰도록 지금 설정할 수 있어요:<br><br>· <b>PIN 잠금</b> — 화면 이탈 시 자동 잠금<br>· <b>위장 제목</b> — 탭 제목·아이콘이 '메모'로</p>
            <div class="row"><button class="btn-ghost" data-skip>나중에</button><button class="btn-grad" data-pin>PIN 설정하기</button></div>
            <button class="pw-item" data-dg>🎭 위장 제목만 바로 켜기</button></div>`, { center: true });
          $("[data-skip]", pm).onclick = () => pm.remove();
          $("[data-pin]", pm).onclick = () => { pm.remove(); pinSheet(); };
          $("[data-dg]", pm).onclick = () => { pm.remove(); S.settings.disguise = true; save(); applyDisguise(); toast("🎭 위장 제목 ON — 방문 기록·홈 화면 아이콘은 위장되지 않아요"); };
        }, 2600);
      }
    });
    $("#ob-back").onclick = () => { if (ob.step > 0) { ob.step--; renderOb(); } };
  }

  /* ══ 메인 ══ */
  let tab = "discover";
  function enterMain() { show("scr-main"); paintTopbar(); tickStreak(); go("discover"); maybeIncomingMessage(); }
  /* 연속 출석 스트릭 — 3일마다 뽑기권 1, 7일마다 3장 */
  function tickStreak() {
    if (!S.user) return;
    const t = todayStr();
    if (S.streak.last === t) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    S.streak.n = S.streak.last === y ? S.streak.n + 1 : 1;
    S.streak.last = t;
    let bonus = 0;
    if (S.streak.n > 1) { if (S.streak.n % 7 === 0) bonus = 3; else if (S.streak.n % 3 === 0) bonus = 1; }
    if (bonus) { S.items.gachaticket += bonus; setTimeout(() => toast(`🔥 연속 출석 ${S.streak.n}일 — 크러시 팩 뽑기권 +${bonus}!`), 2200); }
    save();
  }
  function paintTopbar() {
    const b = $("#btn-premium-badge");
    b.textContent = t(plan().label);
    b.className = "tb-premium" + (S.premium.plan === "plus" ? " plus" : S.premium.plan === "black" ? " black" : "");
  }
  function badges() {
    const newLikes = S.incoming.filter((id) => !S.seenIncoming.includes(id)).length;
    const unread = S.matches.reduce((a, m) => a + (m.unread || 0), 0);
    const bl = $("#badge-likes"), bc = $("#badge-chats"), bcd = $("#badge-cards");
    bl.hidden = !newLikes; bl.textContent = newLikes;
    bc.hidden = !unread; bc.textContent = unread;
    if (bcd) { bcd.hidden = !(gachaFreeAvail() || rouletteAvail() || wcAvail()); bcd.textContent = "!"; }
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
      .filter((p) => p.age >= F.ageMin && (F.ageMax >= 50 || p.age <= F.ageMax)) // 50 = "50+" (상한 없음)
      .filter((p) => F.area === "all" || (F.area === "mine" ? sameArea(p) : zoneOf(areaOf(p)) === F.area))
      .filter((p) => F.looking === "all" || p.lookingFor === F.looking)
      .filter((p) => !F.position || F.position === "all" || posOf(p) === F.position)
      .map((p) => ({ p, sc: compat(p) + Math.random() * 8 + (tp && groupOf(areaOf(p)) === groupOf(tp.region) ? 100 : 0) }))
      .sort((a, b) => b.sc - a.sc).map((x) => x.p);
    // 되돌린 카드는 항상 맨 위로 (필터에 걸려도 복귀 보장)
    if (S.restoredPid) {
      const i = deck.findIndex((p) => p.id === S.restoredPid);
      if (i > 0) deck.unshift(deck.splice(i, 1)[0]);
      else if (i < 0) { const rp = P(S.restoredPid); if (rp && !S.blocked.includes(rp.id)) deck.unshift(rp); }
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
    const filterOn = F.ageMin > 20 || F.ageMax < 50 || F.area !== "all" || F.looking !== "all" || (F.position && F.position !== "all");
    $("#view").innerHTML = `<div class="disc">
      <div class="fx-row"><button class="fx-chip fx-btn ${filterOn ? "on" : ""}" id="d-filter" aria-label="탐색 필터 설정">⚙️ ${t("필터")}${filterOn ? " ●" : ""}</button>${fxChips.map((c) => `<span class="fx-chip fx-live">${c}</span>`).join("")}</div>
      <div class="deck" id="deck"></div>
      <div class="actions">
        <div class="act-w"><button class="act md rew" id="a-rew" aria-label="마지막 카드 되돌리기">↩${rewindLeft() > 0 ? "" : '<span class="lock">🔒</span>'}</button><small>${t("되돌리기")}</small></div>
        <div class="act-w"><button class="act lg nope" id="a-nope" aria-label="패스">✕</button><small>${t("패스")}</small></div>
        <div class="act-w"><button class="act md sup" id="a-sup" aria-label="슈퍼라이크 보내기">⭐</button><small>${t("슈퍼")}</small></div>
        <div class="act-w"><button class="act lg like" id="a-like" aria-label="좋아요 보내기">💜</button><small>${t("좋아요")}</small></div>
        <div class="act-w"><button class="act md boost" id="a-boost" aria-label="부스트 사용">🚀${plan().boost || S.items.boostticket ? "" : '<span class="lock">🔒</span>'}</button><small>${t("부스트")}</small></div>
      </div>
      <div class="quota">${likeLimit() === Infinity
        ? `<span>💜 ${t("좋아요")} <b>${t("무제한")}</b></span>` : `<span>${t("오늘 좋아요")} <b>${Math.max(0, likeLimit() - S.likesUsed)}</b>/${likeLimit()}${cardLikeBonus() ? ` <i class="buff" title="카드 버프">+${cardLikeBonus()}🎴</i>` : ""}</span>`}
        <span>⭐ ${t("슈퍼라이크")} <b>${Math.max(0, superLimit() - S.supersUsed)}</b>/${superLimit()}${S.items.superlike ? ` <i class="buff">+${S.items.superlike}📦</i>` : ""}</span></div>
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
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">${t("탐색 필터")}</h3>
      <p class="muted" style="font-size:13px;margin:0 0 16px">원하는 조건의 사람만 보여드려요. 필터는 전 플랜 무료.</p>
      <div class="ob-field"><label>나이 — <b id="fv-age">${F.ageMin}~${F.ageMax >= 50 ? "50+" : F.ageMax + "세"}</b></label>
        <div style="display:flex;gap:12px;align-items:center">
          <span style="display:flex;flex-direction:column;flex:1;gap:2px"><small class="tiny">최소</small><input type="range" id="f-amin" min="20" max="50" value="${F.ageMin}" style="accent-color:var(--vio)" aria-label="최소 나이"></span>
          <span style="display:flex;flex-direction:column;flex:1;gap:2px"><small class="tiny">최대</small><input type="range" id="f-amax" min="20" max="50" value="${F.ageMax}" style="accent-color:var(--vio)" aria-label="최대 나이 (50은 상한 없음)"></span>
        </div></div>
      <div class="ob-field"><label>지역 (권역)</label><div class="chips">
        <button class="chip ${F.area === "all" ? "on" : ""}" data-area="all">전국</button>
        <button class="chip ${F.area === "mine" ? "on" : ""}" data-area="mine">내 권역 (${esc(zoneOf(myArea()) || "내 지역")})</button>
        ${ZONES.filter((z) => z !== zoneOf(myArea())).map((z) => `<button class="chip ${F.area === z ? "on" : ""}" data-area="${z}">${z}</button>`).join("")}</div>
        <p class="tiny" style="margin:6px 0 0">다른 권역도 무료로 탐색할 수 있어요 · 텔레포트는 해당 권역을 우선 노출해주는 아이템이에요</p></div>
      <div class="ob-field"><label>성향 (포지션)</label><div class="chips" id="f-pos">
        <button class="chip ${(F.position || "all") === "all" ? "on" : ""}" data-pos="all">전체</button>
        ${POSITIONS.map((p) => `<button class="chip ${F.position === p ? "on" : ""}" data-pos="${esc(p)}">${esc(p)}</button>`).join("")}</div></div>
      <div class="ob-field"><label>찾는 관계</label><div class="chips" id="f-look">
        <button class="chip ${F.looking === "all" ? "on" : ""}" data-look="all">전체</button>
        ${LOOKING.map((l) => `<button class="chip ${F.looking === l ? "on" : ""}" data-look="${esc(l)}">${esc(l)}</button>`).join("")}</div></div>
      <div class="row" style="display:flex;gap:9px">
        <button class="btn-ghost" style="flex:1" id="f-reset">${t("초기화")}</button>
        <button class="btn-grad" style="flex:2" id="f-apply">${t("적용하기")}</button></div></div>`);
    const amin = $("#f-amin", m), amax = $("#f-amax", m);
    const sync = () => {
      if (+amin.value > +amax.value) amax.value = amin.value;
      $("#fv-age", m).textContent = `${amin.value}~${+amax.value >= 50 ? "50+" : amax.value + "세"}`;
    };
    amin.oninput = sync; amax.oninput = sync;
    m.addEventListener("click", (e) => {
      const a = e.target.closest("[data-area]");
      if (a) { $$("[data-area]", m).forEach((x) => x.classList.remove("on")); a.classList.add("on"); }
      const lk = e.target.closest("[data-look]");
      if (lk) { $$("[data-look]", m).forEach((x) => x.classList.remove("on")); lk.classList.add("on"); }
      const ps = e.target.closest("[data-pos]");
      if (ps) { $$("[data-pos]", m).forEach((x) => x.classList.remove("on")); ps.classList.add("on"); }
    });
    $("#f-reset", m).onclick = () => { S.filters = { ageMin: 20, ageMax: 50, area: "all", looking: "all", position: "all" }; save(); m.remove(); vDiscover(); toast("필터를 초기화했어요"); };
    $("#f-apply", m).onclick = () => {
      S.filters = { ageMin: +amin.value, ageMax: +amax.value,
        area: ($(".chip.on[data-area]", m) || {}).dataset ? $(".chip.on[data-area]", m).dataset.area : "all",
        looking: ($(".chip.on[data-look]", m) || {}).dataset ? $(".chip.on[data-look]", m).dataset.look : "all",
        position: ($(".chip.on[data-pos]", m) || {}).dataset ? $(".chip.on[data-pos]", m).dataset.pos : "all" };
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
      const filtered = S.filters.area !== "all" || S.filters.looking !== "all" || S.filters.ageMin > 20 || S.filters.ageMax < 50;
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
    // 매일 첫 매치 보상: 뽑기권 +1 (무료 유저도 카드 성장 경로 확보)
    if (S.matchTicketDay !== todayStr()) {
      S.matchTicketDay = todayStr(); S.items.gachaticket++;
      setTimeout(() => toast("🎁 오늘의 첫 매치 보상 — 크러시 팩 뽑기권 +1"), 1600);
    }
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
        <div class="avatar" style="${avStyle(u)}">${avEm(u)}</div>
        <span class="heart">💜</span>
        <div class="avatar" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</div>
      </div>
      <div class="match-btns">
        <button class="btn-grad big" data-chat>바로 메시지 보내기 💬</button>
        <button class="btn-line" data-course>💡 데이트 코스 추천 보기</button>
        <button class="btn-ghost" data-keep>계속 둘러보기</button>
      </div>`;
    $("#modal-root").appendChild(m);
    $("[data-chat]", m).onclick = () => { m.remove(); openChat(pid); };
    $("[data-course]", m).onclick = () => { m.remove(); dateCourseModal(pid, 0, true); };
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
    if (rewindLeft() <= 0) { paywall("rewind"); return; }
    if (!S.lastSwipe) { toast("되돌릴 카드가 없어요"); return; }
    const { pid, kind } = S.lastSwipe;
    S.liked = S.liked.filter((x) => x !== pid);
    S.passed = S.passed.filter((x) => x !== pid);
    S.superliked = S.superliked.filter((x) => x !== pid);
    if (kind === "like") S.likesUsed = Math.max(0, S.likesUsed - 1);
    if (kind === "sup") S.supersUsed = Math.max(0, S.supersUsed - 1);
    if (plan().rewind !== Infinity) S.rewindsUsed = (S.rewindsUsed || 0) + 1;
    S.restoredPid = pid; // 되돌린 카드는 덱 최상단으로
    S.lastSwipe = null; save(); vDiscover();
    toast(plan().rewind === Infinity ? "↩ 마지막 카드를 맨 위로 되돌렸어요" : `↩ 되돌렸어요 (오늘 무료 ${rewindLeft()}회 남음)`);
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
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">${t("프로필")}</span></div>
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
            <div class="pd-fact"><small>성향</small>${esc(posOf(p))}</div></div></div>
          <div class="pd-sec"><h4>스타일</h4>
            <div class="chips">${stylesOf(p).map((s) => `<span class="chip" style="cursor:default">${esc(s)}</span>`).join("")}</div></div>
          <div class="pd-sec"><h4>찾는 관계</h4>
            <div class="chips">${(p.lookingList || [p.lookingFor]).map((l) => `<span class="chip on" style="cursor:default">${esc(l)}</span>`).join("")}</div></div>
          ${(() => { const st = sharedTopics(p); return `<div class="pd-sec"><h4>주제 라운지 ${st.length ? `· <span style="color:var(--vio)">${st.length}개 함께</span>` : ""}</h4>
            <div class="chips">${demoTopics(p).map((t) => `<span class="chip ${st.includes(t) ? "on" : ""}" style="cursor:default">${TOPIC_EM(t)} ${esc(t)}</span>`).join("")}</div></div>`; })()}
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
      (S.reports = S.reports || []).push({ num, reason: b.dataset.r, at: Date.now() }); save();
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
    // 무료 티어: 하루 1명 무료 공개 (막다른 골목 방지)
    if (!can && list.length) {
      if (!S.freeReveal || S.freeReveal.day !== todayStr() || !S.incoming.includes(S.freeReveal.pid)) {
        S.freeReveal = { day: todayStr(), pid: list[0].id }; save();
      }
    }
    const freePid = !can && S.freeReveal ? S.freeReveal.pid : null;
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">${t("받은 좋아요")} ${list.length ? `<span style="color:var(--pink)">${list.length}</span>` : ""}</div>
      <p class="sec-sub">${can ? "나를 좋아요한 사람들이에요. 탭해서 확인하고 바로 매치하세요." : "매일 1명은 무료로 공개! 나머지는 PRISM+에서 바로 확인해요."}</p>
      ${S.settings.privateMode ? `<p class="tiny" style="margin:4px 0 0">🕶️ 프라이빗 모드 중 — 새로운 노출·좋아요 유입이 멈춰 있어요.</p>` : ""}
      <p class="tiny" style="margin:4px 0 0">데모 안내: 가상 프로필의 반응이에요. 정식 버전에서는 실제 사용자만 표시됩니다.</p></div>
      ${!can && list.length > 1 ? `<div class="likes-cta"><button class="btn-grad big" id="lk-up">💜 PRISM+로 전부 확인하기</button></div>` : ""}
      ${list.length ? `<div class="likes-grid">${list.map((p) => {
        const revealed = can || p.id === freePid;
        return `
        <button class="lk-card ${revealed ? "" : "blur"}" data-pid="${p.id}" data-open="${revealed ? 1 : 0}">
          ${!can && p.id === freePid ? `<span class="free-tag">오늘의 무료 공개</span>` : ""}
          <span class="ph" style="background:linear-gradient(150deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
          <span class="veil"></span><span class="nm">${esc(p.name)}, ${p.age}</span>
          ${revealed ? "" : `<span class="lk-lock">🔒<small>PRISM+로 확인</small></span>`}
        </button>`; }).join("")}</div>`
      : `<div class="empty"><div class="em">💌</div>아직 새로운 좋아요가 없어요.<br>둘러보기에서 먼저 좋아요를 보내보세요!</div>`}
      ${adSlot()}`;
    const up = $("#lk-up"); if (up) up.onclick = () => openPremium();
    $$(".lk-card").forEach((c) => c.onclick = () => {
      if (c.dataset.open !== "1") { paywall("seeLikes"); return; }
      openProfile(c.dataset.pid, "likes");
    });
  }

  /* ══ 채팅 ══ */
  function vChats() {
    const ms = S.matches.slice().sort((a, b) => lastMsgAt(b) - lastMsgAt(a));
    const fresh = ms.filter((m) => !(S.chats[m.pid] || []).some((x) => x.who !== "sys"));
    const convs = ms.filter((m) => (S.chats[m.pid] || []).some((x) => x.who !== "sys"));
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">${t("채팅")}</div>
      <p class="sec-sub">${t("매치된 사람들과의 대화")}</p></div>
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
  const OFFAPP_RE = /카톡|카카오톡|라인\s*아이디|텔레그램|위챗|디엠|인스타.{0,4}아이디/;
  // 수발신 양방향 검사 — 실제 스캠은 '상대'가 요구하는 시나리오
  function scamGuard(pid, t) {
    const chat = S.chats[pid]; if (!chat) return;
    if (SCAM_RE.test(t) && !chat.some((x) => x.who === "sys" && x.scam === 1)) {
      chat.push({ who: "sys", scam: 1, t: "⚠️ 금전 요구·투자 권유는 100% 사기예요. 절대 송금하지 말고 신고해주세요.", at: Date.now() });
    }
    if (OFFAPP_RE.test(t) && !chat.some((x) => x.who === "sys" && x.scam === 2)) {
      chat.push({ who: "sys", scam: 2, t: "💡 앱 밖 메신저로 빨리 옮기자는 상대는 주의하세요 — 사기의 첫 단계일 수 있어요.", at: Date.now() });
    }
  }
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
    const send = (text) => {
      const t = (text || input.value).trim(); if (!t) return;
      S.chats[pid].push({ who: "me", t, at: Date.now() });
      scamGuard(pid, t); save();
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
        <button class="btn-line" style="margin-bottom:8px" data-course>💡 데이트 코스 추천</button>
        <button class="btn-line" style="margin-bottom:8px" data-prof>프로필 보기</button>
        <button class="btn-line" style="margin-bottom:8px" data-unmatch>매치 해제</button>
        <button class="btn-line" style="margin-bottom:8px;color:var(--red)" data-block>차단하기</button>
        <button class="btn-line" style="color:var(--red)" data-report>신고하기</button></div>`);
      $("[data-course]", sheet).onclick = () => { sheet.remove(); dateCourseModal(pid); };
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
    const pushReply = () => {
      const chat = S.chats[pid]; if (!chat) return;
      const lastMe = chat.filter((x) => x.who === "me").slice(-1)[0];
      const rt = pickReply(p, lastMe ? lastMe.t : "");
      chat.push({ who: "you", t: rt, at: Date.now() });
      scamGuard(pid, rt); // 수신 메시지도 검사
      if (!room.isConnected) { // 방을 나갔으면 안읽음 적립
        const m = S.matches.find((x) => x.pid === pid); if (m) m.unread = (m.unread || 0) + 1;
        save(); badges(); return;
      }
      save(); paint();
    };
    chatTimers[pid] = setTimeout(() => {
      if (!room.isConnected) { pushReply(); return; } // 일찍 나가도 답장은 도착 (소멸 버그 방지)
      const body = $("#cr-body", room);
      const ty = document.createElement("div");
      ty.className = "typing"; ty.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(ty); body.scrollTop = body.scrollHeight;
      setTimeout(() => { ty.remove(); pushReply(); }, 1100 + Math.random() * 1600);
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
  /* 밸런스 게임 — 둘 중 하나만! */
  const BQ = [
    ["첫 데이트", "분위기 좋은 바에서 🍸", "한강 야경 산책 🌉"],
    ["연락 스타일", "실시간 초스피드 답장 ⚡", "하루 한 번 정성 장문 ✍️"],
    ["이상형 무드", "듬직한 곰 🐻", "샤프한 여우 🦊"],
    ["여행 궁합", "계획 꽉꽉 J형 여행 🗓️", "발 닿는 대로 P형 여행 🎒"],
    ["데이트 비용", "무조건 반반 ⚖️", "그때그때 번갈아 쏘기 🔄"],
    ["동거한다면", "각자 방은 필수 🚪", "한 이불에서 다 같이 🛏️"],
    ["고백", "먼저 고백하는 편 💌", "고백 받고 싶은 편 💘"],
    ["운동", "같이 헬스장 가는 커플 💪", "운동은 각자, 밥만 같이 🍚"],
    ["주말 데이트", "집에서 넷플릭스+배달 🛋️", "무조건 나가서 데이트 🌤️"],
    ["애정표현", "스킨십으로 표현 🤗", "말로 다정하게 💬"],
    ["질투", "적당한 질투는 애정 🔥", "쿨한 신뢰가 최고 🧊"],
    ["둘만의 비밀", "친한 친구에겐 오픈 🌈", "우리 둘만 아는 사이 🤫"],
    ["끌리는 포인트", "웃음 코드가 같은 사람 😂", "플레이리스트가 같은 사람 🎧"],
    ["기념일", "100일 단위 다 챙기기 🎂", "생일·1주년만 크게 🎁"],
    ["다퉜을 때", "그 자리에서 바로 풀기 🗣️", "하루 식히고 대화 🌙"],
    ["반려동물", "강아지파 🐶", "고양이파 🐱"],
    ["술 데이트", "소주에 삼겹살 🍖", "와인에 치즈 플레이트 🧀"],
    ["모임 스타일", "시끌벅적 큰 모임 🪩", "소수 정예 홈파티 🏠"],
  ];
  let balPtr = null;
  function bDist(qi) { // 시드 고정 분포 28~72%
    let seed = qi * 3571 + 991;
    seed = (seed * 9301 + 49297) % 233280;
    return 28 + (seed % 45);
  }
  function balanceHTML() {
    if (balPtr === null) balPtr = (dayOfYear() * 3) % BQ.length;
    const qi = balPtr;
    const [topic, A, B] = BQ[qi];
    const voted = S.balance[qi] !== undefined;
    const pctA = bDist(qi), pctB = 100 - pctA;
    const answered = Object.keys(S.balance).length;
    const opt = (label, i, pct) => `<button class="bal-opt ${voted ? (S.balance[qi] === i ? "mine" : "other") : ""}" data-b="${i}" ${voted ? "disabled" : ""}>
      ${voted ? `<span class="bal-fill" style="height:${pct}%"></span>` : ""}
      <span class="bal-tx">${esc(label)}</span>${voted ? `<b class="bal-pct">${pct}%${S.balance[qi] === i ? " · 나" : ""}</b>` : ""}</button>`;
    return `<div class="dq-card bal-card"><div class="dq-tag">밸런스 게임 · 참여 ${answered}/${BQ.length}</div>
      <h3>${esc(topic)} — 둘 중 하나만!</h3>
      <div class="bal-row">${opt(A, 0, pctA)}<div class="bal-vs">VS</div>${opt(B, 1, pctB)}</div>
      ${voted ? `<button class="btn-ghost bal-next" id="bal-next">다음 질문 ▶</button>` : `<div class="dq-total" style="border:0;padding-top:2px">고르면 다른 사람들의 선택이 보여요</div>`}</div>`;
  }
  function vCommunity() {
    const qs = D.dailyQuestions;
    const idx = qs.length ? (dayOfYear() % qs.length) : 0;
    const q = qs[idx];
    const voted = S.votes[idx] !== undefined;
    const dist = q ? voteDist(idx, q.options.length) : [];
    const total = dist.reduce((a, b) => a + b, 0) + (voted ? 1 : 0);
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">${t("라운지")}</div>
      <p class="sec-sub">${t("만남 전에, 가볍게 서로를 알아가는 공간")}</p></div>
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
      ${balanceHTML()}
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
      <div class="sec" style="padding:2px 16px 0"><div class="sec-h" style="font-size:16px">🏳️‍🌈 주제별 라운지</div>
        <p class="sec-sub" style="margin:2px 0 0">관심 주제 방에 참여하면 <b>같은 주제를 좋아하는 사람과 궁합이 올라가요</b> (+최대 9점).</p></div>
      <div class="topic-grid">${TOPICS.map(([name, em]) => {
        const joined = myTopics().includes(name);
        const n = topicMembers(name).length;
        return `<button class="topic-room ${joined ? "on" : ""}" data-topic="${esc(name)}">
          <span class="tr-em">${em}</span><b>${esc(name)}</b>
          <small>${n}명 참여${joined ? " · 참여 중" : ""}</small>
          <span class="tr-join">${joined ? "나가기" : "참여"}</span></button>`;
      }).join("")}</div>
      ${myTopics().length ? (() => {
        const feat = myTopics()[dayOfYear() % myTopics().length];
        const mem = shuffle(topicMembers(feat).slice()).slice(0, 4);
        return `<div class="sec" style="padding:8px 16px 0"><b style="font-size:13px;color:var(--tx3)">${TOPIC_EM(feat)} ${esc(feat)} 라운지 · 이번 주 멤버</b></div>
        <div class="topic-mem">${mem.length ? mem.map((p) => `<button class="tm-item" data-pid="${p.id}">
          <span class="avatar" style="width:46px;height:46px;font-size:20px;background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${p.emoji}</span>
          <small>${esc(p.name)}, ${p.age}</small></button>`).join("") : `<p class="tiny" style="padding:6px 2px">아직 이 방에 표시할 멤버가 없어요.</p>`}</div>`;
      })() : `<p class="tiny" style="padding:6px 18px 2px">아직 참여한 주제가 없어요. 위에서 관심 주제를 눌러 참여해보세요!</p>`}
      <div class="sec" style="padding-top:6px"><div class="sec-h" style="font-size:16px">🛡️ 오늘의 안전 팁</div></div>
      <div class="safe-list">${shuffle((D.safetyTips || []).slice()).slice(0, 2).map((t) => `<div class="safe-it"><span>💡</span>${esc(t)}</div>`).join("")}</div>
      ${adSlot()}`;
    $$(".dq-opt:not([disabled])").forEach((b) => b.onclick = () => {
      S.votes[idx] = +b.dataset.i; save(); vCommunity(); vibrate(10);
    });
    $$(".bal-opt:not([disabled])").forEach((b) => b.onclick = () => {
      S.balance[balPtr] = +b.dataset.b; save(); vCommunity(); vibrate(10);
    });
    const bn = $("#bal-next");
    if (bn) bn.onclick = () => { balPtr = (balPtr + 1) % BQ.length; vCommunity(); };
    $$(".topic-room").forEach((b) => b.onclick = () => {
      const name = b.dataset.topic;
      S.user.topics = Array.isArray(S.user.topics) ? S.user.topics : [];
      if (S.user.topics.includes(name)) { S.user.topics = S.user.topics.filter((x) => x !== name); toast(`${TOPIC_EM(name)} ${name} 라운지에서 나왔어요`); }
      else { S.user.topics.push(name); toast(`${TOPIC_EM(name)} ${name} 라운지 참여! 같은 주제 친구와 궁합이 올라가요`); vibrate(10); }
      save(); vCommunity();
    });
    $$(".tm-item").forEach((b) => b.onclick = () => openProfile(b.dataset.pid, "likes"));
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
    checkProfileComplete();
    const ps = profileScore();
    const missing = ps.items.filter((i) => !i.done);
    $("#view").innerHTML = `
      <div class="my-head">
        <span class="avatar" style="${avStyle(u)}">${avEm(u)}</span>
        <div><div class="mh-nm">${esc(u.name)}, ${u.age} ${u.verified ? '<span class="vbadge" title="인증된 프로필">✔︎ 인증</span>' : ""}</div>
        <div class="mh-sub">📍 ${esc(u.region)} · ${u.mbti}${u.position ? " · " + esc(posShort(u.position)) : ""}</div>
        ${(u.styles && u.styles.length) || (u.lookingList && u.lookingList.length) ? `<div class="mh-tags">${(u.styles || []).map((s) => `<span class="mtag st">${esc(s)}</span>`).join("")}${(u.lookingList || []).slice(0, 2).map((l) => `<span class="mtag lk">${esc(l)}</span>`).join("")}</div>` : ""}</div>
      </div>
      ${u.photos && u.photos.length ? `<div class="my-photos">${u.photos.map((ph) => `<div class="myp" style="background-image:url('${ph}')"></div>`).join("")}${u.privatePhotos && u.privatePhotos.length ? `<div class="myp priv"><span>🔒 비밀 ${u.privatePhotos.length}</span></div>` : ""}</div>` : ""}
      <div class="pcompl ${ps.pct >= 100 ? "done" : ""}">
        <div class="pc-top"><b>${t("프로필 완성도")}</b><span class="pc-pct">${ps.pct}%</span></div>
        <div class="pc-bar"><i style="width:${ps.pct}%"></i></div>
        ${ps.pct >= 100
          ? `<p class="pc-msg">🏆 완벽해요! 완성 보너스로 <b>매일 좋아요 +5</b> 적용 중이에요.</p>`
          : `<p class="pc-msg">${ps.pct >= 80 ? "완성 보너스(<b>좋아요 +5/일</b>) 적용 중 · " : ""}채우면 추천에 더 잘 노출돼요:</p>
             <div class="pc-todo">${missing.slice(0, 4).map((m) => `<button class="pc-chip" data-go="${m.go}">＋ ${esc(m.label)}</button>`).join("")}</div>`}
      </div>
      <div class="my-plan ${pl === "free" ? "free" : ""}">
        <b>${pl === "free" ? t("무료 플랜 이용 중") : "🎉 " + plan().label}</b>
        <p>누적 — 보낸 좋아요 <b>${S.stats.likesSent}</b> · 매치 <b>${S.stats.matches}</b>${pl === "free" ? " — PRISM+면 좋아요 무제한, 받은 좋아요 공개, 광고 제거." : " — 프리미엄 혜택 적용 중. 언제든 변경 가능."}</p>
        <button class="btn-grad" id="my-premium" style="font-size:14px;padding:11px 18px">${pl === "free" ? "PRISM+ 💜" : t("플랜 관리")}</button>
      </div>
      <div class="menu">
        <button class="menu-it" id="m-edit"><span class="mi-ic">✏️</span>${t("프로필 수정")}<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-verify"><span class="mi-ic">✔︎</span>${t("프로필 인증하기")}<span class="mi-val">${u.verified ? t("인증됨 ✔︎") : t("미인증")}</span></button>
        <button class="menu-it" id="m-shop"><span class="mi-ic">🛍️</span>${t("아이템 상점")}<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-install"><span class="mi-ic">📲</span>${t("홈 화면에 앱 설치")}<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-font"><span class="mi-ic">🔠</span>${t("글자 크기")}<span class="mi-val">${["보통", "크게", "아주 크게", "최대"][S.settings.fontScale]}</span></button>
        <button class="menu-it" id="m-lang"><span class="mi-ic">🌐</span>${t("언어")}<span class="mi-val">${curLang() === "en" ? "English" : "한국어"}</span></button>
      </div>
      <div class="sec" style="padding:0 18px 8px"><b style="font-size:13px;color:var(--tx3)">${t("프라이버시 · 안전")}</b></div>
      <div class="menu">
        <button class="menu-it" id="m-pin"><span class="mi-ic">🔐</span>${t("앱 잠금 (PIN)")}<span class="mi-val">${hasPin() ? t("사용 중") : t("꺼짐")}</span></button>
        ${hasPin() ? `<button class="menu-it" id="m-bglock" role="switch" aria-checked="${S.settings.bgLock}"><span class="mi-ic">🫥</span>${t("화면 이탈 시 즉시 잠금")}<span class="switch ${S.settings.bgLock ? "on" : ""}"></span></button>` : ""}
        <button class="menu-it" id="m-disguise" role="switch" aria-checked="${S.settings.disguise}"><span class="mi-ic">🎭</span>${t("위장 제목 항상 사용")}<span class="switch ${S.settings.disguise ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-dist" role="switch" aria-checked="${S.settings.hideDistance}"><span class="mi-ic">📍</span>${t("거리 숨기기")}<span class="switch ${S.settings.hideDistance ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-private" role="switch" aria-checked="${S.settings.privateMode}"><span class="mi-ic">🕶️</span>${t("프라이빗 모드 (새 노출 중단)")}<span class="switch ${S.settings.privateMode ? "on" : ""}"></span></button>
        <button class="menu-it" id="m-safety"><span class="mi-ic">🛡️</span>${t("안전 센터")}<span class="mi-arrow">›</span></button>
        <button class="menu-it" id="m-blocked"><span class="mi-ic">🚫</span>${t("차단 목록")}<span class="mi-val">${S.blocked.length}명</span></button>
      </div>
      <div class="menu">
        <button class="menu-it" id="m-reset"><span class="mi-ic">🗑️</span><span style="color:var(--red)">${t("데이터 초기화 (계정 삭제)")}</span></button>
      </div>
      <p class="tiny" style="text-align:center;padding:0 20px 8px">PRISM 데모 v2.0 · 모든 데이터는 이 기기에만 저장 ·
        <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--tx3)">개인정보</a> ·
        <a href="/terms.html" target="_blank" rel="noopener" style="color:var(--tx3)">약관</a> ·
        <a href="/contact.html" target="_blank" rel="noopener" style="color:var(--tx3)">문의</a></p>
      ${adSlot()}`;
    $("#my-premium").onclick = () => openPremium();
    $$(".pc-chip").forEach((b) => b.onclick = () => {
      const g = b.dataset.go;
      if (g === "edit") editProfileSheet();
      else if (g === "community") go("community");
      else if (g === "verify") $("#m-verify").click();
    });
    $("#m-edit").onclick = editProfileSheet;
    $("#m-shop").onclick = () => openShop();
    $("#m-install").onclick = installApp;
    $("#m-font").onclick = () => {
      S.settings.fontScale = (S.settings.fontScale + 1) % 4;
      save(); applyFontScale(); vMy();
      toast("글자 크기: " + ["보통", "크게", "아주 크게", "최대"][S.settings.fontScale]);
    };
    $("#m-lang").onclick = () => {
      S.settings.lang = curLang() === "ko" ? "en" : "ko";
      save(); paintStatic(); paintTopbar(); vMy();
      toast(curLang() === "en" ? "Language: English — main UI translated (demo content stays Korean)" : "언어: 한국어");
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
      toast(S.settings.disguise ? "🎭 탭 제목·아이콘 위장 ON (방문 기록·홈 화면 아이콘은 위장되지 않아요)" : "위장 제목을 해제했어요", 3200);
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
    // 로컬 드래프트 (저장 눌러야 반영)
    const d = { name: u.name, intro: u.intro || "", tags: u.tags.slice(),
      photos: (u.photos || []).slice(), privatePhotos: (u.privatePhotos || []).slice(),
      position: u.position || "", styles: (u.styles || []).slice(),
      lookingList: (u.lookingList || (u.lookingFor ? [u.lookingFor] : [])).slice(), outLevel: u.outLevel || "" };
    const m = modal(`<div class="sheet edit-sheet"><div class="grip"></div><h3 style="margin:0 0 14px">프로필 수정</h3><div id="edit-body"></div></div>`);
    const body = $("#edit-body", m);
    const chips = (arr, sel, active) => arr.map((v) => `<button class="chip ${active(v) ? "on" : ""}" data-${sel}="${esc(v)}">${esc(v)}</button>`).join("");
    const render = () => {
      body.innerHTML = `
        <div class="ob-field"><label>프로필 사진 <small class="tiny" style="font-weight:400">· 여러 장 · 첫 장이 대표</small></label>
          <div class="photo-grid" id="e-photos">${d.photos.map((ph, i) => `<div class="pg-item"><img src="${ph}" alt=""><button class="pg-del" data-del="${i}" aria-label="삭제">×</button>${i === 0 ? '<span class="pg-main">대표</span>' : `<button class="pg-star" data-main="${i}" aria-label="대표로">☆</button>`}<button class="pg-lock" data-hide="${i}" aria-label="비밀사진으로">🔒</button></div>`).join("")}
            ${d.photos.length < 6 ? `<button class="pg-add" id="e-photo-add">＋<small>사진 추가</small></button>` : ""}</div></div>
        <div class="ob-field"><label>🔒 비밀 사진 <small class="tiny" style="font-weight:400">· 매치된 상대에게만 공개</small></label>
          <div class="photo-grid" id="e-priv">${d.privatePhotos.map((ph, i) => `<div class="pg-item priv"><img src="${ph}" alt=""><button class="pg-del" data-pdel="${i}" aria-label="삭제">×</button><button class="pg-unlock" data-show="${i}" aria-label="공개사진으로">🔓</button></div>`).join("")}
            ${d.privatePhotos.length < 6 ? `<button class="pg-add" id="e-priv-add">＋<small>비밀 추가</small></button>` : ""}</div>
          <p class="tiny" style="margin:4px 0 0">사진의 🔒를 누르면 비밀 사진으로, 🔓를 누르면 공개로 옮겨져요.</p></div>
        <div class="ob-field"><label>닉네임</label><input class="ob-input" id="e-name" maxlength="10" value="${esc(d.name)}"></div>
        <div class="ob-field"><label>자기소개</label><textarea class="ob-input" id="e-intro" maxlength="120">${esc(d.intro)}</textarea></div>
        <div class="ob-field"><label>성향 (포지션)</label><div class="chips" id="e-pos">${chips(POSITIONS, "pos", (v) => d.position === v)}</div></div>
        <div class="ob-field"><label>스타일 (최대 4)</label><div class="chips" id="e-styles">${chips(STYLES, "sty", (v) => d.styles.includes(v))}</div></div>
        <div class="ob-field"><label>찾는 관계 (최대 3)</label><div class="chips" id="e-look">${chips(LOOKING, "look", (v) => d.lookingList.includes(v))}</div></div>
        <div class="ob-field"><label>커밍아웃 상태</label><div class="chips" id="e-out">${chips(OUT_LEVELS, "out", (v) => d.outLevel === v)}</div></div>
        <div class="ob-field"><label>관심사 (3~5개)</label><div class="chips" id="e-tags">${chips(masterTags(), "tag", (v) => d.tags.includes(v))}</div></div>
        <button class="btn-grad big" id="e-save">저장</button>`;
      bind();
    };
    const toggleIn = (arr, v, max) => {
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else if (arr.length < max) arr.push(v);
      else { toast(`최대 ${max}개까지 고를 수 있어요`); return false; }
      return true;
    };
    const bind = () => {
      $("#e-photo-add", body) && ($("#e-photo-add", body).onclick = () => pickPhotos(true, (a) => { d.photos = d.photos.concat(a).slice(0, 6); render(); }));
      $("#e-priv-add", body) && ($("#e-priv-add", body).onclick = () => pickPhotos(true, (a) => { d.privatePhotos = d.privatePhotos.concat(a).slice(0, 6); render(); }));
      $("#e-photos", body).onclick = (e) => {
        const del = e.target.closest("[data-del]"), mn = e.target.closest("[data-main]"), hd = e.target.closest("[data-hide]");
        if (del) { d.photos.splice(+del.dataset.del, 1); render(); }
        else if (mn) { const [x] = d.photos.splice(+mn.dataset.main, 1); d.photos.unshift(x); render(); }
        else if (hd) { const [x] = d.photos.splice(+hd.dataset.hide, 1); d.privatePhotos.push(x); d.privatePhotos = d.privatePhotos.slice(0, 6); render(); }
      };
      $("#e-priv", body).onclick = (e) => {
        const del = e.target.closest("[data-pdel]"), sh = e.target.closest("[data-show]");
        if (del) { d.privatePhotos.splice(+del.dataset.pdel, 1); render(); }
        else if (sh) { const [x] = d.privatePhotos.splice(+sh.dataset.show, 1); d.photos.push(x); d.photos = d.photos.slice(0, 6); render(); }
      };
      $("#e-pos", body).onclick = (e) => { const b = e.target.closest("[data-pos]"); if (b) { d.position = d.position === b.dataset.pos ? "" : b.dataset.pos; render(); } };
      $("#e-out", body).onclick = (e) => { const b = e.target.closest("[data-out]"); if (b) { d.outLevel = d.outLevel === b.dataset.out ? "" : b.dataset.out; render(); } };
      $("#e-styles", body).onclick = (e) => { const b = e.target.closest("[data-sty]"); if (b && toggleIn(d.styles, b.dataset.sty, 4)) render(); };
      $("#e-look", body).onclick = (e) => { const b = e.target.closest("[data-look]"); if (b && toggleIn(d.lookingList, b.dataset.look, 3)) render(); };
      $("#e-tags", body).onclick = (e) => { const b = e.target.closest("[data-tag]"); if (b && toggleIn(d.tags, b.dataset.tag, 5)) render(); };
      $("#e-name", body).oninput = (e) => { d.name = e.target.value; };
      $("#e-intro", body).oninput = (e) => { d.intro = e.target.value; };
      $("#e-save", body).onclick = () => {
        const nm = d.name.trim();
        if (!nm) { toast("닉네임을 입력해주세요"); return; }
        if (d.tags.length < 3) { toast("관심사를 3개 이상 골라주세요"); return; }
        if (d.lookingList.length < 1) { toast("찾는 관계를 1개 이상 골라주세요"); return; }
        u.name = nm.slice(0, 10); u.intro = d.intro.trim(); u.tags = d.tags.slice();
        u.photos = d.photos.slice(); u.privatePhotos = d.privatePhotos.slice();
        u.position = d.position; u.styles = d.styles.slice();
        u.lookingList = d.lookingList.slice(); u.lookingFor = d.lookingList[0] || u.lookingFor; u.outLevel = d.outLevel;
        save(); m.remove(); vMy(); toast("저장했어요 ✓");
      };
    };
    render();
  }
  function pinSheet(after) {
    if (hasPin()) {
      confirmDlg("🔐", "앱 잠금 해제", "설정된 PIN 잠금을 해제할까요?", "해제", () => { S.settings.pin = null; S.settings.pinHash = null; save(); if (tab === "my") vMy(); toast("앱 잠금을 해제했어요"); });
      return;
    }
    if (!(window.crypto && crypto.subtle)) { toast("보안 연결(HTTPS)에서만 PIN을 설정할 수 있어요"); return; }
    const m = modal(`<div class="sheet"><div class="grip"></div><h3 style="margin:0 0 4px">앱 잠금 설정</h3>
      <p class="muted" style="font-size:13px;margin:0 0 14px">앱 화면을 4자리 PIN으로 잠가요. 화면 잠금 방식이라, 기기 자체 잠금(지문·비밀번호)과 함께 쓰면 가장 안전해요.</p>
      <div class="ob-field"><label>PIN 4자리</label><input class="ob-input" id="p-1" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;letter-spacing:10px;font-size:22px"></div>
      <div class="ob-field"><label>PIN 확인</label><input class="ob-input" id="p-2" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;letter-spacing:10px;font-size:22px"></div>
      <p class="tiny">⚠️ PIN을 잊으면 데이터 초기화로만 해제할 수 있어요.</p>
      <button class="btn-grad big" id="p-save">잠금 설정</button></div>`);
    $("#p-save", m).onclick = async () => {
      const a = $("#p-1", m).value, b = $("#p-2", m).value;
      if (!/^\d{4}$/.test(a)) { toast("숫자 4자리를 입력해주세요"); return; }
      if (a !== b) { toast("PIN이 서로 달라요"); return; }
      S.settings.pinHash = await pinHash(a); S.settings.pin = null;
      save(); m.remove(); if (tab === "my") vMy(); toast("🔐 앱 잠금이 설정됐어요 (해시 저장 · 5회 오류 시 30초 잠금)");
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
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">🛡️ ${t("안전 센터")}</span></div>
      <div class="ovl-body">
        <div class="sec"><div class="sec-h" style="font-size:17px">퀴어 데이팅 안전 가이드</div>
        <p class="sec-sub">모든 안전 기능은 무료예요. 언제나.</p></div>
        <div class="safe-list">${(D.safetyTips || []).map((t) => `<div class="safe-it"><span>🛡️</span>${esc(t)}</div>`).join("")}</div>
        <div class="sec"><div class="sec-h" style="font-size:17px">긴급 도움 (전국)</div></div>
        <div class="safe-list">
          <div class="safe-it"><span>📞</span><span><b>경찰 <a href="tel:112">112</a></b> · 위급 상황 시 즉시 신고하세요. 전국 어디서나.</span></div>
          <div class="safe-it"><span>💜</span><span><b>청소년성소수자위기지원센터 띵동</b> · <a href="tel:029241224">02-924-1224</a> (전화·온라인 상담, 전국)</span></div>
          <div class="safe-it"><span>🤝</span><span><b>한국게이인권운동단체 친구사이</b> · 상담 및 커뮤니티 지원 (온라인)</span></div>
          <div class="safe-it"><span>🧑‍⚕️</span><span><b>자살예방 상담전화 <a href="tel:1393">1393</a></b> · 24시간, 전국</span></div>\n          <div class="safe-it"><span>🌈</span><span><b>한국성적소수자문화인권센터</b> · 성인 퀴어 상담·자료 (온라인)</span></div>
        </div>
        <div class="sec"><div class="sec-h" style="font-size:17px">이 앱의 프라이버시 원칙</div></div>
        <div class="safe-list" style="margin-bottom:24px">
          <div class="safe-it"><span>🔒</span><span>모든 데이터는 <b>이 기기에만</b> 저장 — 서버 전송 0회</span></div>
          <div class="safe-it"><span>🚫</span><span>이 앱 화면에는 <b>외부 광고·추적 스크립트가 없어요</b> (앱 내 추천은 자체 하우스 배너)</span></div>
          <div class="safe-it"><span>🗑️</span><span>MY → 데이터 초기화로 <b>모든 흔적을 즉시 삭제</b>할 수 있어요</span></div>
          <div class="safe-it"><span>⚠️</span><span><b>위장의 한계</b>: 브라우저 방문 기록·홈 화면 설치 아이콘은 위장되지 않아요. 공용 기기에서는 시크릿 모드를 권장해요.</span></div>
        </div>
        ${(S.reports || []).length ? `<div class="sec"><div class="sec-h" style="font-size:17px">내 신고 내역</div></div>
        <div class="safe-list" style="margin-bottom:24px">${S.reports.map((r) => `<div class="safe-it"><span>🧾</span><span><b>${esc(r.num)}</b> · ${esc(r.reason)} · ${new Date(r.at).toLocaleDateString("ko-KR")} — 접수 완료</span></div>`).join("")}</div>` : ""}
        </div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
  }

  /* ══ 프리미엄 (수익 모델) ══ */
  function paywall(kind) {
    const msgs = {
      likes: ["💜", "오늘의 좋아요를 다 썼어요", "PRISM+는 좋아요가 <b>무제한</b>이에요.<br>내일까지 기다리지 않아도 돼요."],
      super: ["⭐", "슈퍼라이크를 다 썼어요", "PRISM Black은 매일 <b>슈퍼라이크 5개</b>.<br>매칭 확률이 3배 올라가요."],
      rewind: ["↩️", "오늘의 무료 되돌리기를 다 썼어요", "PRISM+는 되돌리기가 <b>무제한</b> —<br>지나친 인연을 언제든 다시 만나요."],
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
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">${t("프리미엄")}</span></div>
      <div class="ovl-body">
        <div class="pm-hero"><img src="favicon.svg" alt="" width="46" height="46" style="border-radius:12px"><h2><span class="prism-mark">PRISM</span> 프리미엄</h2>
        <p>기본 기능은 언제나 무료. 더 빠른 만남을 원할 때만.</p></div>
        <div class="plan-cards">
          <div class="plan hot"><span class="pl-badge">인기</span><h3>PRISM+</h3>
            <div class="pl-price">월 9,900원 <small>· 연 결제 시 월 8,200원 (17%↓) · 언제든 해지</small></div>
            <ul><li>좋아요 무제한</li><li>받은 좋아요 전체 공개 + 바로 매치</li><li>되돌리기 (마지막 카드 복구)</li><li>부스트 월 1회 (30분 상단 노출)</li><li>광고 제거 · 아이템 5% 할인</li></ul>
            ${cur === "plus" ? `<button class="btn-ghost" style="width:100%" data-cancel>이용 중 · 해지하기</button>` : `<button class="btn-grad big" data-buy="plus">PRISM+ 시작하기</button>`}</div>
          <div class="plan black"><span class="pl-badge">BLACK</span><h3>PRISM Black</h3>
            <div class="pl-price">월 19,900원 <small>· 연 결제 시 월 16,500원 (17%↓) · 언제든 해지</small></div>
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
    const mo = planKey === "plus" ? 9900 : 19900;
    const yr = Math.round(mo * 12 * 0.83 / 100) * 100; // 연 결제 17% 할인
    const info = planKey === "plus" ? ["PRISM+"] : ["PRISM Black"];
    let period = "month";
    const m = modal(`<div class="sheet"><div class="grip"></div>
      <h3 style="margin:0 0 4px">결제 확인</h3>
      <p class="muted" style="font-size:13px;margin:0 0 12px">${info[0]} 구독 · 언제든 해지 가능</p>
      <div class="seg" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
        <button class="chip on" data-period="month">월간 · ${won(mo)}/월</button>
        <button class="chip" data-period="year">연간 · ${won(Math.round(yr / 12 / 100) * 100)}/월 <i style="font-style:normal;color:var(--amber)">17%↓</i></button>
      </div>
      <div class="seg" style="margin-bottom:16px">
        <button class="chip on" data-pay>💳 카드 결제</button>
        <button class="chip" data-pay>🟡 카카오페이</button>
        <button class="chip" data-pay>🔵 토스페이</button>
      </div>
      <button class="btn-grad big" id="pay-go">데모 결제 완료하기</button>
      <p class="tiny" style="text-align:center;margin-top:10px">데모 버전 — 실제 결제가 발생하지 않습니다.</p></div>`);
    $$("[data-pay]", m).forEach((c) => c.onclick = () => { $$("[data-pay]", m).forEach((x) => x.classList.remove("on")); c.classList.add("on"); });
    $$("[data-period]", m).forEach((c) => c.onclick = () => { $$("[data-period]", m).forEach((x) => x.classList.remove("on")); c.classList.add("on"); period = c.dataset.period; });
    $("#pay-go", m).onclick = () => {
      S.premium = { plan: planKey, since: Date.now(), period }; save();
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
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close" aria-label="닫기">‹</button><span class="ovl-title">🛍️ ${t("아이템 상점")}</span></div>
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
      confirmDlg("✨", "스포트라이트 켜기", "3시간 동안 내 프로필이 상단에 고정 노출돼요.<br>노출이 늘어 좋아요 확률이 올라가요.", "켜기", () => {
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

  /* ══ 데일리 룰렛 (매일 1회 무료 스핀) ══ */
  const RL_PRIZES = [
    { em: "🎴", label: "뽑기권 1장", key: "gachaticket", n: 1, w: 30 },
    { em: "💜", label: "좋아요 리필 1개", key: "refill", n: 1, w: 12 },
    { em: "🎴", label: "뽑기권 2장", key: "gachaticket", n: 2, w: 15 },
    { em: "⭐", label: "슈퍼라이크 1개", key: "superlike", n: 1, w: 12 },
    { em: "✨", label: "스포트라이트 1회", key: "spotlight", n: 1, w: 8 },
    { em: "🎴", label: "뽑기권 1장", key: "gachaticket", n: 1, w: 15 },
    { em: "🚀", label: "부스트 1회권", key: "boostticket", n: 1, w: 5 },
    { em: "👑", label: "잭팟! 뽑기권 5장", key: "gachaticket", n: 5, w: 3 },
  ];
  const rouletteAvail = () => S.roulette.day !== todayStr();
  function pickPrize() {
    const total = RL_PRIZES.reduce((a, p) => a + p.w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < RL_PRIZES.length; i++) { r -= RL_PRIZES[i].w; if (r < 0) return i; }
    return 0;
  }
  function openRoulette() {
    const avail = rouletteAvail();
    const m = modal(`<div class="rl-stage">
      <h3 style="margin:0">🎡 데일리 룰렛</h3>
      <p class="muted" style="font-size:12.5px;margin:4px 0 12px">매일 1번, 공짜로 돌려요 — 꽝 없음!</p>
      <div class="rl-wrap"><div class="rl-pin">▼</div>
        <div class="rl-wheel" id="rl-wheel">${RL_PRIZES.map((p, i) =>
          `<span class="rl-lb" style="transform:rotate(${i * 45 + 22.5}deg)"><i>${p.em}</i>${p.n > 1 ? `<small>×${p.n}</small>` : ""}</span>`).join("")}
          <div class="rl-hub">🎡</div></div></div>
      <button class="btn-grad big" id="rl-go" ${avail ? "" : "disabled"} style="margin-top:14px">${avail ? "돌리기!" : "오늘은 이미 돌렸어요 — 내일 또!"}</button>
      <button class="btn-ghost" data-x style="margin-top:8px">닫기</button></div>`, { center: true, sticky: true });
    $("[data-x]", m).onclick = () => m.remove();
    $("#rl-go", m).onclick = () => {
      if (!rouletteAvail()) return;
      const btn = $("#rl-go", m); btn.disabled = true; btn.textContent = "두근두근...";
      S.roulette.day = todayStr(); save(); // 스핀 시작 시점에 소진 (새로고침 재스핀 방지)
      const idx = pickPrize();
      const wheel = $("#rl-wheel", m);
      const rot = 6 * 360 - (idx * 45 + 22.5);
      wheel.style.transition = "transform 4.2s cubic-bezier(.12,.75,.1,1)";
      wheel.style.transform = `rotate(${rot}deg)`;
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        const p = RL_PRIZES[idx];
        S.items[p.key] = (S.items[p.key] || 0) + p.n;
        save(); badges(); vibrate(idx === 7 ? [40, 60, 40, 60, 80] : [30, 50, 30]);
        const dlg = modal(`<div class="dialog"><div class="em">${p.em}</div><h3>${idx === 7 ? "👑 잭팟!!" : "축하해요!"}</h3>
          <p><b>${esc(p.label)}</b> 획득!<br>보유 아이템에 바로 들어갔어요.</p>
          <button class="btn-grad big" data-ok>받기</button></div>`, { center: true });
        $("[data-ok]", dlg).onclick = () => { dlg.remove(); m.remove(); if (tab === "cards") vCards(); };
      };
      wheel.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, 4800); // transitionend 유실 대비
    };
  }

  /* ══ 이상형 월드컵 (8강 토너먼트로 '오늘의 최애' 선정) ══ */
  const wcAvail = () => S.wc.day !== todayStr();
  function openWorldcup() {
    // 참가자 8명: 보유 카드 우선, 부족분은 랜덤으로 채움
    const owned = shuffle(CD.CHARS.filter((c) => cardOwned(c.id)).slice());
    const rest = shuffle(CD.CHARS.filter((c) => !cardOwned(c.id)).slice());
    const pool = owned.concat(rest).slice(0, 8);
    if (pool.length < 2) { toast("카드가 부족해요 — 먼저 뽑기를 해보세요 🎴"); return; }
    let round = pool.slice(), roundName = pool.length >= 8 ? "8강" : pool.length >= 4 ? "4강" : "결승";
    let queue = round.slice(), winners = [], idx = 0;
    const o = document.createElement("div");
    o.className = "ovl wc-ovl";
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">👑 이상형 월드컵</span><span class="wc-round" id="wc-round">${roundName}</span></div>
      <div class="ovl-body wc-body"><p class="wc-q" id="wc-q">더 취향인 쪽을 골라요</p><div class="wc-pair" id="wc-pair"></div></div>`;
    $("#overlay-root").appendChild(o);
    const cardHtml = (c) => { const R = CD.RARITY[c.rarity]; return `<button class="wc-card r-${c.rarity}" data-id="${c.id}" style="--frame:${R.color};--fgrad:${R.frame}">
      ${c.rarity === "SSR" ? '<div class="holo"></div>' : ""}${CD.charSVG(c, { uid: "wc" + Math.floor(Math.random() * 1e6) })}
      <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>${esc(c.name)}</b><small>${c.age}세 · ${esc(c.job)}</small></div></button>`; };
    const paintPair = () => {
      const a = queue[idx], b = queue[idx + 1];
      $("#wc-round", o).textContent = roundName + ` · ${Math.floor(idx / 2) + 1}/${Math.floor(queue.length / 2)}`;
      $("#wc-pair", o).innerHTML = cardHtml(a) + `<div class="wc-vs">VS</div>` + cardHtml(b);
      $$(".wc-card", o).forEach((btn) => btn.onclick = () => {
        winners.push(queue.find((c) => c.id === btn.dataset.id));
        btn.classList.add("wc-pick"); vibrate(12);
        setTimeout(next, 260);
      });
    };
    const next = () => {
      idx += 2;
      if (idx < queue.length - (queue.length % 2)) { paintPair(); return; }
      // 홀수면 남은 1명 부전승
      if (queue.length % 2) winners.push(queue[queue.length - 1]);
      if (winners.length === 1) { finishWC(winners[0]); return; }
      queue = winners; winners = []; idx = 0;
      roundName = queue.length >= 4 ? "4강" : queue.length >= 2 ? "결승" : "우승";
      paintPair();
    };
    const finishWC = (champ) => {
      const first = wcAvail();
      S.wc = { day: todayStr(), champ: champ.id };
      let reward = 0;
      if (first) { reward = 1; S.items.gachaticket += 1; }
      save(); badges(); vibrate([40, 60, 40, 60, 80]);
      const R = CD.RARITY[champ.rarity];
      $("#wc-pair", o).innerHTML = "";
      $("#wc-q", o).textContent = "";
      const dlg = modal(`<div class="dialog wc-win"><div class="em">👑</div><h3>오늘의 최애!</h3>
        <div class="ccard big r-${champ.rarity}" style="--frame:${R.color};--fgrad:${R.frame};width:150px;margin:6px auto 10px">${champ.rarity === "SSR" ? '<div class="holo"></div>' : ""}${CD.charSVG(champ, { animate: true, uid: "wcw" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${champ.rarity}</span><b>${esc(champ.name)}</b><small>${champ.age}세 · ${esc(champ.job)}</small></div></div>
        <p style="font-size:12.5px">"${esc(champ.line)}"</p>
        <p style="font-size:12.5px;margin:6px 0 0">${reward ? `🎁 완주 보상: 크러시 팩 뽑기권 <b>+1</b>` : "오늘 보상은 이미 받았어요 — 재미로 다시 즐겨요!"}</p>
        <button class="btn-grad big" data-ok style="margin-top:10px">좋아요!</button></div>`, { center: true, sticky: true });
      $("[data-ok]", dlg).onclick = () => { dlg.remove(); o.remove(); if (tab === "cards") vCards(); };
    };
    $(".ovl-close", o).onclick = () => o.remove();
    paintPair();
  }

  /* ══ 매력 배틀 아레나 (모은 카드로 3판 2선승 상성 배틀) ══
     상성 삼각: 💪파워 > 🧠두뇌 > ✨매력 > 💪파워 (우세 시 파워 ×1.25) */
  const RPOW = { N: 10, R: 16, SR: 24, SSR: 34 };
  const TYPE_KEYS = ["power", "brain", "charm"];
  const TYPE_INFO = { power: ["💪", "파워"], brain: ["🧠", "두뇌"], charm: ["✨", "매력"] };
  const BEATS = { power: "brain", brain: "charm", charm: "power" };
  const typeOf = (c) => TYPE_KEYS[Array.from(String(c.id)).reduce((a, ch) => a + ch.charCodeAt(0), 0) % 3];
  const cardPower = (id) => { const c = cardOf(id); return c && cardOwned(id) ? RPOW[c.rarity] + (cardMaxLv(id) - 1) * 6 : 0; };
  const BATTLE_MAX = 5;
  const battleLeft = () => S.battle.day === todayStr() ? Math.max(0, BATTLE_MAX - S.battle.plays) : BATTLE_MAX;
  function battleSetup() {
    const owned = CD.CHARS.filter((c) => cardOwned(c.id));
    if (owned.length < 3) {
      confirmDlg("⚔️", "카드가 3종 필요해요", `배틀에는 서로 다른 카드 3장이 필요해요.<br>지금 <b>${owned.length}종</b> 보유 중 — 뽑기로 채워볼까요?`, "뽑기하러 가기", () => { if (tab !== "cards") go("cards"); doGacha(); });
      return;
    }
    if (battleLeft() <= 0) { toast("오늘의 배틀을 다 했어요 — 내일 5회가 충전돼요 ⚔️"); return; }
    const picked = [];
    const m = modal(`<div class="sheet"><div class="grip"></div>
      <h3 style="margin:0 0 4px">⚔️ 출전 카드 3장 선택</h3>
      <p class="muted" style="font-size:12.5px;margin:0 0 10px">등급·★이 높을수록 강해요 · 상성(💪>🧠>✨>💪)까지 맞으면 파워 ×1.25</p>
      <div class="bt-pickgrid">${owned.map((c) => {
        const tp = typeOf(c);
        return `<button class="bt-pick" data-id="${c.id}">
          <b style="color:${CD.RARITY[c.rarity].color}">${c.rarity}${"★".repeat(cardMaxLv(c.id))}</b>
          <span>${esc(c.name)}</span>
          <small>${TYPE_INFO[tp][0]}${TYPE_INFO[tp][1]} · 파워 ${cardPower(c.id)}</small></button>`;
      }).join("")}</div>
      <div class="row" style="display:flex;gap:9px;margin-top:12px">
        <button class="btn-ghost" style="flex:1" id="bt-auto">자동 편성</button>
        <button class="btn-grad" style="flex:2" id="bt-start" disabled>배틀 시작 (0/3)</button></div></div>`);
    const sync = () => {
      $$(".bt-pick", m).forEach((b) => b.classList.toggle("on", picked.includes(b.dataset.id)));
      const st = $("#bt-start", m);
      st.disabled = picked.length !== 3;
      st.textContent = `배틀 시작 (${picked.length}/3)`;
    };
    m.addEventListener("click", (e) => {
      const b = e.target.closest(".bt-pick"); if (!b) return;
      const id = b.dataset.id;
      if (picked.includes(id)) picked.splice(picked.indexOf(id), 1);
      else if (picked.length < 3) picked.push(id);
      else { toast("3장까지만 출전할 수 있어요"); return; }
      sync();
    });
    $("#bt-auto", m).onclick = () => {
      picked.length = 0;
      owned.slice().sort((a, b) => cardPower(b.id) - cardPower(a.id)).slice(0, 3).forEach((c) => picked.push(c.id));
      sync(); toast("가장 강한 3장으로 자동 편성!");
    };
    $("#bt-start", m).onclick = () => { if (picked.length === 3) { m.remove(); battleRun(picked.slice()); } };
  }
  function battleRun(teamIds) {
    // 입장 시 횟수 차감 (중도 이탈 재도전 방지)
    if (S.battle.day !== todayStr()) S.battle = Object.assign(S.battle, { day: todayStr(), plays: 0, winsToday: 0, rewarded: 0 });
    S.battle.plays++; save();
    const mine = teamIds.map(cardOf);
    const myPow = teamIds.map(cardPower);
    // 상대: 무작위 3인 (미보유 포함 — "쟤 갖고 싶다" 동기), 파워는 내 팀 ±20%
    const pool = shuffle(CD.CHARS.slice()).slice(0, 3);
    const enemy = pool.map((c, i) => ({ c, pow: Math.max(6, Math.round(myPow[i] * (0.8 + Math.random() * 0.4))) }));
    let round = 0, myScore = 0, enScore = 0;
    const o = document.createElement("div");
    o.className = "ovl bt-ovl";
    const slot = (c, pow, side, i, hidden) => {
      const tp = typeOf(c);
      return `<div class="bt-card ${hidden ? "fd" : ""}" id="bt-${side}${i}">
        <div class="bt-face">${CD.charSVG(c, { uid: side + i })}
          <b>${esc(c.name)}</b><small>${TYPE_INFO[tp][0]} ${pow}</small></div>
        <div class="bt-back">?</div></div>`;
    };
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close">‹</button><span class="ovl-title">⚔️ 매력 배틀</span>
        <span class="bt-score" id="bt-score">0 : 0</span></div>
      <div class="ovl-body bt-body">
        <div class="bt-row">${enemy.map((e, i) => slot(e.c, e.pow, "e", i, true)).join("")}</div>
        <div class="bt-mid" id="bt-mid">상대 카드는 비공개! 라운드마다 공개돼요</div>
        <div class="bt-row">${mine.map((c, i) => slot(c, myPow[i], "m", i, false)).join("")}</div>
        <button class="btn-grad big" id="bt-go" style="margin:14px auto 0;max-width:340px;display:block">라운드 1 ▶</button>
      </div>`;
    $("#overlay-root").appendChild(o);
    const finishBattle = () => {
      const win = myScore > enScore, perfect = myScore === 3;
      if (win) {
        S.battle.winsToday++; S.battle.totalWins++; S.battle.streak++;
        S.battle.best = Math.max(S.battle.best, S.battle.streak);
      } else S.battle.streak = 0;
      let reward = 0;
      if (win && S.battle.rewarded < 3) { reward = perfect ? 2 : 1; S.battle.rewarded++; S.items.gachaticket += reward; }
      save(); badges(); vibrate(win ? [40, 60, 40, 60, 80] : 40);
      const dlg = modal(`<div class="dialog"><div class="em">${win ? (perfect ? "👑" : "🏆") : "💦"}</div>
        <h3>${win ? (perfect ? "퍼펙트 승리!" : "승리!") : "아쉽게 패배..."}</h3>
        <p>${myScore} : ${enScore}${win ? ` · 연승 <b>${S.battle.streak}</b>` : ""}<br>
        ${reward ? `🎁 보상: 크러시 팩 뽑기권 <b>+${reward}</b>${perfect ? " (퍼펙트 보너스!)" : ""}` : win ? "오늘 보상 3회를 다 받았어요 — 내일 또!" : "카드를 합성해 ★을 올리면 강해져요"}</p>
        <div class="row"><button class="btn-ghost" data-x>닫기</button>
        ${battleLeft() > 0 ? `<button class="btn-grad" data-re>한 판 더 (${battleLeft()}회 남음)</button>` : ""}</div></div>`, { center: true, sticky: true });
      $("[data-x]", dlg).onclick = () => { dlg.remove(); o.remove(); if (tab === "cards") vCards(); };
      const re = $("[data-re]", dlg);
      if (re) re.onclick = () => { dlg.remove(); o.remove(); battleSetup(); };
    };
    $(".ovl-close", o).onclick = () => confirmDlg("🏳️", "배틀 포기", "지금 나가면 이번 판은 패배로 기록돼요.", "포기하기", () => { S.battle.streak = 0; save(); o.remove(); if (tab === "cards") vCards(); }, true);
    $("#bt-go", o).onclick = () => {
      if (round >= 3) { finishBattle(); return; }
      const i = round;
      const mC = mine[i], eC = enemy[i].c;
      const mT = typeOf(mC), eT = typeOf(eC);
      const mAdv = BEATS[mT] === eT, eAdv = BEATS[eT] === mT;
      const mEff = Math.round(myPow[i] * (mAdv ? 1.25 : 1) * (0.95 + Math.random() * 0.1));
      const eEff = Math.round(enemy[i].pow * (eAdv ? 1.25 : 1) * (0.95 + Math.random() * 0.1));
      const iWin = mEff === eEff ? Math.random() < 0.5 : mEff > eEff;
      const eSlot = $("#bt-e" + i, o), mSlot = $("#bt-m" + i, o);
      eSlot.classList.remove("fd"); // 상대 공개
      eSlot.classList.add("act"); mSlot.classList.add("act");
      setTimeout(() => {
        if (iWin) { myScore++; mSlot.classList.add("win"); eSlot.classList.add("lose"); }
        else { enScore++; eSlot.classList.add("win"); mSlot.classList.add("lose"); }
        mSlot.classList.remove("act"); eSlot.classList.remove("act");
        $("#bt-score", o).textContent = `${myScore} : ${enScore}`;
        $("#bt-mid", o).innerHTML = `R${i + 1} — ${TYPE_INFO[mT][0]}<b>${mEff}</b> vs <b>${eEff}</b>${TYPE_INFO[eT][0]}
          ${mAdv ? ' · <span style="color:var(--teal)">상성 우세 ×1.25!</span>' : eAdv ? ' · <span style="color:var(--red)">상성 열세...</span>' : ""}
          → ${iWin ? "<b style='color:var(--teal)'>승리!</b>" : "<b style='color:var(--red)'>패배</b>"}`;
        vibrate(iWin ? [20, 40] : 30);
        round++;
        const btn = $("#bt-go", o);
        btn.textContent = round >= 3 ? "결과 보기 🏆" : `라운드 ${round + 1} ▶`;
        btn.disabled = false;
      }, 650);
      $("#bt-go", o).disabled = true;
    };
  }

  /* ══ 크러시 카드 (수집 · 가챠 · 합성) ══
     합성 규칙: 같은 카드 + 같은 레벨 2장 → 다음 레벨 1장 (최대 ★5) */
  const MILESTONES = [16, 32, 64, 96, 128];
  function ownedKinds() { return CD.CHARS.filter((c) => cardOwned(c.id)).length; }
  /* 주간 픽업 SSR — 특정 카드를 노릴 수단 (SSR 당첨 시 50%는 픽업 카드) */
  function weekOfYear() { return Math.floor(dayOfYear() / 7); }
  function pickupSSR() {
    const pool = CD.CHARS.filter((c) => c.rarity === "SSR");
    return pool.length ? pool[weekOfYear() % pool.length] : null;
  }
  function rollGacha() {
    // 천장 2단: 10회 내 SR+ 확정, 40회 내 SSR 확정
    let rarity;
    if ((S.gacha.ssrPity || 0) >= 39) rarity = "SSR";
    else if (S.gacha.pity >= 9) rarity = Math.random() < 0.25 ? "SSR" : "SR";
    else {
      const r = Math.random() * 100;
      rarity = r < 3 ? "SSR" : r < 13 ? "SR" : r < 40 ? "R" : "N";
    }
    const ceilingHit = (S.gacha.ssrPity || 0) >= 39;
    S.gacha.pity = (rarity === "SR" || rarity === "SSR") ? 0 : S.gacha.pity + 1;
    S.gacha.ssrPity = rarity === "SSR" ? 0 : (S.gacha.ssrPity || 0) + 1;
    const pk = pickupSSR();
    if (rarity === "SSR" && pk) {
      // 픽업 확정 조건: 직전 픽뚫 보장 / SSR 천장 도달 / 50% 당첨
      if (S.gacha.guarantee || ceilingHit || Math.random() < 0.5) { S.gacha.guarantee = false; return pk; }
      S.gacha.guarantee = true; // 픽뚫 → 다음 SSR은 픽업 확정
    }
    const pool = CD.CHARS.filter((c) => c.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  /* 뽑기 1회 처리 (단챠·10연 공용) */
  function pullOnce() {
    const c = rollGacha();
    const isNew = !cardOwned(c.id);
    const copies = S.cards[c.id] || (S.cards[c.id] = {});
    if (cardMaxLv(c.id) >= MAX_CARD_LV) { // ★5 완성 카드의 중복은 뽑기권으로 환급
      S.items.gachaticket++;
      return { c, isNew: false, milestone: 0, refund: true };
    }
    copies[1] = (copies[1] || 0) + 1;
    let milestone = 0;
    if (isNew && MILESTONES.includes(ownedKinds())) { milestone = ownedKinds(); S.items.gachaticket += milestone === 128 ? 12 : 3; }
    return { c, isNew, milestone };
  }
  function doGacha() {
    const free = gachaFreeAvail();
    if (!free && S.items.gachaticket <= 0) { openShop("gachaticket"); return; }
    if (free) {
      if (S.gacha.day !== todayStr()) { S.gacha.day = todayStr(); S.gacha.freeCount = 0; }
      S.gacha.freeCount = (S.gacha.freeCount || 0) + 1;
    } else S.items.gachaticket--;
    const r = pullOnce();
    save(); badges();
    gachaReveal(r.c, r.isNew, r.milestone, r.refund);
  }
  /* 10연챠 — 뽑기권 10장, 결과 요약 시트 */
  function doGacha10() {
    if (S.items.gachaticket < 10) { openShop("gachaticket"); return; }
    S.items.gachaticket -= 10;
    const results = [];
    for (let i = 0; i < 10; i++) results.push(pullOnce());
    save(); badges(); vibrate([30, 40, 30, 40, 60]);
    const best = results.reduce((a, r) => (["N", "R", "SR", "SSR"].indexOf(r.c.rarity) > ["N", "R", "SR", "SSR"].indexOf(a.c.rarity) ? r : a), results[0]);
    const m = modal(`<div class="sheet"><div class="grip"></div>
      <h3 style="margin:0 0 4px">10연 뽑기 결과 ${results.some((r) => r.c.rarity === "SSR") ? "— ✨ SSR!" : results.some((r) => r.c.rarity === "SR") ? "— SR 등장!" : ""}</h3>
      <p class="muted" style="font-size:12.5px;margin:0 0 14px">최고 등급: <b style="color:${CD.RARITY[best.c.rarity].color}">${best.c.rarity} ${esc(best.c.name)}</b> · NEW ${results.filter((r) => r.isNew).length}장</p>
      <div class="g10-grid">${results.map((r) => {
        const R = CD.RARITY[r.c.rarity];
        return `<div class="ccard r-${r.c.rarity}" style="--frame:${R.color};--fgrad:${R.frame}">
          ${r.c.rarity === "SSR" ? '<div class="holo"></div>' : ""}${CD.charSVG(r.c, { uid: "x" + Math.floor(Math.random() * 1e6) })}
          <div class="ccard-info" style="padding:16px 7px 6px"><span class="ccard-r" style="color:${R.color}">${r.c.rarity}</span> <b style="font-size:10px;display:inline">${esc(r.c.name)}</b>${r.refund ? '<small style="color:var(--amber)">★5 — 권+1 환급</small>' : r.isNew ? '<small style="color:var(--teal)">NEW!</small>' : `<small>재료 +1</small>`}</div>
        </div>`;
      }).join("")}</div>
      ${results.some((r) => r.milestone) ? `<p class="tiny" style="margin-top:10px">🎁 컬렉션 마일스톤 달성 — 뽑기권 보상 지급!</p>` : ""}
      <button class="btn-grad big" style="margin-top:14px" data-g10ok>확인</button></div>`, { sticky: true });
    $("[data-g10ok]", m).onclick = () => { m.remove(); if (tab === "cards") vCards(); };
  }
  function gachaReveal(c, isNew, milestone, refund) {
    const R = CD.RARITY[c.rarity];
    const m = modal(`<div class="gacha-stage">
      <div class="gacha-flip"><div class="gacha-inner">
        <div class="gacha-back"><img src="favicon.svg" alt="" width="72" height="72" style="border-radius:18px;opacity:.9"></div>
        <div class="gacha-front"><div class="ccard r-${c.rarity}" style="--frame:${R.color};--fgrad:${R.frame}">
          ${c.rarity === "SSR" ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { animate: true, uid: "g" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>${esc(c.name)}</b><small>${c.age}세 · ${esc(c.job)}</small></div>
        </div></div>
      </div></div>
      <p class="gacha-line">"${esc(c.line)}"</p>
      <p class="gacha-note">${refund ? `👑 ★5 완성 카드 — 중복이 <b>뽑기권 +1</b>로 환급됐어요` : isNew ? `<b style="color:${R.color}">NEW!</b> 컬렉션 ${ownedKinds()}/128` : `중복! ★1 +1장 — 같은 레벨 2장을 모으면 합성할 수 있어요 (★1 ×${cardCopies(c.id)[1] || 0})`}
      ${milestone ? `<br>🎁 컬렉션 ${milestone}종 달성 보상: 뽑기권 +${milestone === 128 ? 12 : 3}` : ""}</p>
      <div class="match-btns">
        <button class="btn-grad big" data-again>${gachaFreeAvail() ? "무료로 한 번 더" : S.items.gachaticket > 0 ? `한 번 더 (뽑기권 ${S.items.gachaticket}장)` : "뽑기권 구매하기 🛍️"}</button>
        <button class="btn-ghost" data-close>앨범 보기</button>
      </div></div>`, { sticky: true });
    m.classList.add("center");
    $("[data-again]", m).onclick = () => { m.remove(); doGacha(); };
    $("[data-close]", m).onclick = () => { m.remove(); go("cards"); };
    vibrate(c.rarity === "SSR" ? [40, 60, 40, 60, 80] : c.rarity === "SR" ? [30, 50, 30] : 15);
  }
  let albumFilter = "all";
  function vCards() {
    const owned = ownedKinds();
    const free = gachaFreeAvail();
    const lb = cardLikeBonus(), sb = cardSuperBonus();
    const FILTERS = [["all", "전체"], ["owned", "보유"], ["N", "N"], ["R", "R"], ["SR", "SR"], ["SSR", "SSR"]];
    const list = CD.CHARS.filter((c) =>
      albumFilter === "all" ? true : albumFilter === "owned" ? cardOwned(c.id) : c.rarity === albumFilter);
    $("#view").innerHTML = `<div class="sec"><div class="sec-h">${t("크러시 카드 도감")}</div>
      <p class="sec-sub">128명의 일러스트 캐릭터 — 뽑고, 모으고, <b>같은 레벨끼리 합성</b>해서 매칭 버프를 키우세요</p></div>
      <div class="game-row">
        <button class="game-tile" id="g-roulette"><span class="gt-em">🎡</span><b>${t("데일리 룰렛")}</b><small>${rouletteAvail() ? "오늘 무료 1회! 꽝 없음" : "내일 다시 돌려요"}</small>${rouletteAvail() ? '<i class="gt-dot"></i>' : ""}</button>
        <button class="game-tile" id="g-battle"><span class="gt-em">⚔️</span><b>${t("매력 배틀")}</b><small>오늘 ${battleLeft()}/${BATTLE_MAX}회${S.battle.streak ? ` · 🔥연승 ${S.battle.streak}` : ""}${S.battle.best ? ` · 최고 ${S.battle.best}` : ""}</small>${battleLeft() > 0 ? '<i class="gt-dot"></i>' : ""}</button>
        <button class="game-tile wide" id="g-worldcup"><span class="gt-em">👑</span><b>${t("이상형 월드컵")}</b><small>${wcAvail() ? "오늘의 최애를 뽑아요 — 완주 시 뽑기권 +1" : `오늘의 최애: ${esc((cardOf(S.wc.champ) || {}).name || "완료")} · 다시 즐기기`}</small>${wcAvail() ? '<i class="gt-dot"></i>' : ""}</button>
      </div>
      <div class="streak-chip">🔥 연속 출석 <b>${S.streak.n || 1}일</b> — 3일마다 뽑기권 1장, 7일마다 3장이 쌓여요</div>
      <div class="gacha-box">
        <div class="gb-left"><b>컬렉션 ${owned}/128</b>
          <div class="gb-bar"><i style="width:${owned / 128 * 100}%"></i></div>
          <small>${lb || sb ? `버프: ${lb ? `좋아요 +${lb}/일` : ""}${lb && sb ? " · " : ""}${sb ? `슈퍼라이크 +${sb}/일` : ""}` : "카드를 합성해 ★을 올리면 좋아요 한도가 늘어나요"}</small></div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <button class="btn-grad" id="g-pull">${free ? `${t("무료 뽑기")} ${gachaFreeLeft()}회 🎴` : `뽑기 (권 ${S.items.gachaticket}장)`}</button>
          <button class="btn-ghost" id="g-pull10" style="font-size:12px;padding:9px 12px">${t("10연챠")} ${S.items.gachaticket >= 10 ? "" : "🛍️"}</button>
        </div>
      </div>
      <p class="tiny" style="padding:0 18px 4px">천장: SR+ 확정까지 <b>${Math.max(0, 10 - (S.gacha.pity || 0) - 1) + 1}회</b> · SSR 확정까지 <b>${Math.max(0, 40 - (S.gacha.ssrPity || 0))}회</b></p>
      ${(() => { const pk = pickupSSR(); return pk ? `<div class="pickup-row"><span class="pickup-tag">이번 주 픽업</span> <b style="color:${CD.RARITY.SSR.color}">SSR ${esc(pk.name)}</b> · ${pk.age}세 ${esc(pk.job)} — SSR 당첨 시 <b>${S.gacha.guarantee ? "100% (픽뚫 보장)" : "50%"}</b> 확률로 이 카드${S.gacha.guarantee ? "" : " · 빗나가면 다음 SSR 확정"} · 천장 SSR은 픽업 확정 · 보장은 픽업 변경 시 새 픽업에 적용 <button class="pickup-view" data-pkview="${pk.id}">미리보기</button></div>` : ""; })()}
      <div class="fx-row" style="padding:0 16px 10px;margin:0" id="alb-filter">${FILTERS.map(([k, lb2]) =>
        `<button class="fx-chip ${albumFilter === k ? "on" : ""}" data-f="${k}" style="${k === albumFilter ? "border-color:var(--vio);color:var(--tx)" : ""}">${lb2}${k === "owned" ? ` ${owned}` : ""}</button>`).join("")}</div>
      <div class="ccard-grid">${list.map((c) => {
        const R = CD.RARITY[c.rarity];
        if (!cardOwned(c.id)) return `<div class="ccard locked"><div class="ccard-q">?</div><div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity}</span><b>???</b><small>미획득</small></div></div>`;
        const lv = cardMaxLv(c.id);
        return `<button class="ccard r-${c.rarity} owned" data-cid="${c.id}" style="--frame:${R.color};--fgrad:${R.frame}">
          ${c.rarity === "SSR" ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { uid: "t" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity} ${"★".repeat(lv)}</span><b>${esc(c.name)}</b><small>${c.age}세 · ${esc(c.job)} · ${cardTotal(c.id)}장</small></div>
        </button>`;
      }).join("")}</div>
      ${!list.length ? `<div class="empty"><div class="em">🎴</div>이 조건의 카드가 아직 없어요.<br>뽑기로 컬렉션을 채워보세요!</div>` : ""}
      <p class="tiny" style="padding:0 18px 16px;text-align:center">모든 캐릭터는 가상의 일러스트입니다 · 합성: 같은 카드 <b>같은 ★ 2장 → ★+1</b> (최대 ★5)<br>뽑기 확률: N 60% · R 27% · SR 10% · SSR 3% — 10회 내 SR 이상 확정(천장)</p>
      ${adSlot()}`;
    $("#g-pull").onclick = doGacha;
    $("#g-pull10").onclick = doGacha10;
    $("#g-worldcup").onclick = openWorldcup;
    $("#g-roulette").onclick = openRoulette;
    $("#g-battle").onclick = battleSetup;
    const pkv = $("[data-pkview]");
    if (pkv) pkv.onclick = () => {
      const pk = cardOf(pkv.dataset.pkview); if (!pk) return;
      const R = CD.RARITY.SSR;
      const m = modal(`<div class="dialog" style="max-width:300px"><div class="ccard big r-SSR" style="--frame:${R.color};--fgrad:${R.frame};width:100%;margin:0 auto 12px"><div class="holo"></div>${CD.charSVG(pk, { animate: true, uid: "pk" })}
        <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">SSR · 이번 주 픽업</span><b>${esc(pk.name)}</b><small>${pk.age}세 · ${esc(pk.job)}</small></div></div>
        <p style="font-size:12.5px">"${esc(pk.line)}"</p>
        <button class="btn-grad big" data-ok>닫기</button></div>`, { center: true });
      $("[data-ok]", m).onclick = () => m.remove();
    };
    $("#alb-filter").onclick = (e) => {
      const b = e.target.closest("[data-f]"); if (!b) return;
      albumFilter = b.dataset.f; vCards();
    };
    $$(".ccard.owned").forEach((b) => b.onclick = () => cardDetail(b.dataset.cid));
  }
  function cardDetail(cid) {
    const c = cardOf(cid);
    if (!c || !cardOwned(cid)) return;
    const copies = cardCopies(cid);
    const R = CD.RARITY[c.rarity];
    const maxLv = cardMaxLv(cid);
    const o = document.createElement("div");
    o.className = "ovl";
    const fuseRows = [];
    for (let lv = 1; lv <= MAX_CARD_LV; lv++) {
      const n = copies[lv] || 0;
      if (!n && lv > maxLv) continue;
      const canFuse = n >= 2 && lv < MAX_CARD_LV;
      fuseRows.push(`<div class="fuse-row">
        <span class="fr-lv">${"★".repeat(lv)}</span><span class="fr-n">×${n}</span>
        ${lv < MAX_CARD_LV ? `<button class="btn-grad fr-btn" data-fuse="${lv}" ${canFuse ? "" : "disabled"}>2장 합성 → ★${lv + 1}</button>` : `<span class="fr-max">👑 최대</span>`}
      </div>`);
    }
    o.innerHTML = `<div class="ovl-top"><button class="ovl-close" aria-label="닫기">‹</button><span class="ovl-title">카드 상세</span></div>
      <div class="ovl-body" style="display:flex;flex-direction:column;align-items:center;padding:20px">
        <div class="ccard big r-${c.rarity}" style="--frame:${R.color};--fgrad:${R.frame}">
          ${c.rarity === "SSR" || maxLv >= 4 ? '<div class="holo"></div>' : ""}
          ${CD.charSVG(c, { animate: true, uid: "d" })}
          <div class="ccard-info"><span class="ccard-r" style="color:${R.color}">${c.rarity} ${"★".repeat(maxLv)}</span><b>${esc(c.name)}</b><small>${c.age}세 · ${esc(c.job)}</small></div>
        </div>
        <p class="gacha-line">"${esc(c.line)}"</p>
        <div class="fuse-box">${fuseRows.join("")}</div>
        <p class="tiny" style="margin-top:10px;text-align:center">합성 규칙: <b>같은 카드, 같은 ★ 2장</b>만 합성 가능 · 최고 ★이 버프 결정 (★당 일일 좋아요 +1)${c.rarity === "SSR" ? " · SSR 보유: 슈퍼라이크 +1/일" : ""}</p>
      </div>`;
    $("#overlay-root").appendChild(o);
    $(".ovl-close", o).onclick = () => o.remove();
    $$("[data-fuse]", o).forEach((b) => b.onclick = () => {
      const lv = +b.dataset.fuse;
      if ((copies[lv] || 0) < 2 || lv >= MAX_CARD_LV) return;
      copies[lv] -= 2;
      if (!copies[lv]) delete copies[lv];
      copies[lv + 1] = (copies[lv + 1] || 0) + 1;
      save(); o.remove(); vibrate([30, 50, 30, 50]);
      const dlg = modal(`<div class="dialog"><div class="em">🌟</div><h3>${esc(c.name)} ★${lv + 1} 합성 성공!</h3><p>같은 카드 ★${lv} 2장이 ★${lv + 1} 1장이 됐어요.<br>현재 카드 버프: 좋아요 +${cardLikeBonus()}/일</p>
        <button class="btn-grad big" data-ok>멋져요!</button></div>`, { center: true });
      $("[data-ok]", dlg).onclick = () => { dlg.remove(); cardDetail(cid); };
    });
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
    document.documentElement.classList.remove("fs-1", "fs-2", "fs-3");
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
    paintStatic();
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
