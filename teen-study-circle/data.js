/* ===========================================================
   스터디서클 — 정적 데이터
   과목/시험 룸 목록, 샘플 동료(체험용), 명언, 배지, 프리셋 리액션.
   실제 백엔드가 없으므로 "다른 사용자" 데이터는 전부 이 기기에서
   날짜 시드로 계산되는 샘플(체험용) 데이터이며, 화면 곳곳에
   "샘플" 표기를 남겨 실제 인물처럼 오인하지 않도록 합니다.
   =========================================================== */

/* 오늘 날짜 문자열(로컬 기준) */
function todayStr(d) {
  d = d || new Date();
  var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/* 문자열 → 32bit 정수 해시 */
function hashStr(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* mulberry32 시드 난수 생성기 */
function seededRng(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 문자열 시드로 0~1 난수 하나 뽑기용 헬퍼 */
function rngFor(seedText) { return seededRng(hashStr(seedText)); }

/* ---------------- 스터디룸 ---------------- */
var ROOMS = [
  { id: "suneung-kor", name: "수능 국어", emoji: "📖", cat: "수능", desc: "비문학·문학, 독서와 화작 함께 달려요", grad: ["#6366f1", "#22d3ee"] },
  { id: "suneung-math", name: "수능 수학", emoji: "🧮", cat: "수능", desc: "개념부터 킬러 문항까지", grad: ["#4f46e5", "#06b6d4"] },
  { id: "suneung-eng", name: "수능 영어", emoji: "🔤", cat: "수능", desc: "단어·듣기·독해 매일 조금씩", grad: ["#0ea5e9", "#22d3ee"] },
  { id: "naesin", name: "내신 전과목", emoji: "🏫", cat: "내신", desc: "중간·기말고사 벼락치기 금지, 꾸준히", grad: ["#10b981", "#22d3ee"] },
  { id: "gongsi", name: "공무원 시험", emoji: "🏛️", cat: "공시", desc: "국어·영어·한국사 기본 3과목", grad: ["#f59e0b", "#f97316"] },
  { id: "coding", name: "코딩테스트", emoji: "💻", cat: "IT", desc: "알고리즘 문제풀이 인증", grad: ["#8b5cf6", "#6366f1"] },
  { id: "toeic", name: "토익 · 토플", emoji: "🗣️", cat: "어학", desc: "목표 점수까지 매일 기록", grad: ["#ec4899", "#f472b6"] },
  { id: "hanja", name: "한국사 · 한자", emoji: "📜", cat: "자격", desc: "암기 과목 스터디", grad: ["#84cc16", "#22c55e"] },
  { id: "license", name: "자격증 준비", emoji: "🎓", cat: "자격", desc: "컴활·전산세무 등 실무 자격증", grad: ["#0891b2", "#0ea5e9"] },
  { id: "dawn", name: "새벽 자율학습", emoji: "🌙", cat: "자율", desc: "조용한 새벽 시간, 각자 할 일", grad: ["#312e81", "#6366f1"] },
  { id: "morning", name: "아침 기상 스터디", emoji: "☀️", cat: "자율", desc: "일찍 일어나 하루를 여는 습관", grad: ["#fbbf24", "#f59e0b"] },
  { id: "arts", name: "예체능 실기+이론", emoji: "🎨", cat: "예체능", desc: "실기 연습과 이론 병행", grad: ["#f43f5e", "#ec4899"] }
];

/* ---------------- 아바타(이모지 + 그라디언트) ---------------- */
var AVATAR_EMOJIS = ["📚", "✏️", "🧠", "🦉", "🐿️", "🐢", "🦁", "🐯", "🍀", "⭐", "🔥", "🌙", "☀️", "🎯", "🧩", "🐝", "🦊", "🐧", "🌈", "⚡"];
var AVATAR_GRADIENTS = [
  ["#6366f1", "#22d3ee"], ["#f59e0b", "#ef4444"], ["#10b981", "#22d3ee"],
  ["#8b5cf6", "#ec4899"], ["#0ea5e9", "#6366f1"], ["#f43f5e", "#f59e0b"],
  ["#22c55e", "#84cc16"], ["#06b6d4", "#3b82f6"], ["#eab308", "#f97316"],
  ["#a855f7", "#6366f1"]
];

/* ---------------- 공부 시간대 선호 ---------------- */
var TIME_SLOTS = [
  { id: "dawn", label: "새벽 (5~8시)", emoji: "🌌" },
  { id: "morning", label: "오전 (8~12시)", emoji: "🌤️" },
  { id: "afternoon", label: "오후 (12~18시)", emoji: "☀️" },
  { id: "evening", label: "저녁 (18~22시)", emoji: "🌆" },
  { id: "night", label: "심야 (22~1시)", emoji: "🌙" }
];

/* ---------------- 샘플 동료 닉네임 풀(체험용, 실제 인물 아님) ---------------- */
var SAMPLE_NICKNAMES = [
  "달빛여우", "조용한불꽃", "새벽별지기", "꾸준한거북이", "작심삼십일",
  "커피한잔러", "1교시전사", "야행성부엉이", "오늘도완주", "목표달성러",
  "도서관죽순이", "N수생파이팅", "기적의7시간", "불태우는중", "한걸음씩",
  "집중모드ON", "지구본소년", "합격까지D", "밑줄긋는중", "루틴장인",
  "메모광", "밤샘금지", "체력관리중", "인강스피드러", "복습요정"
];

/* 룸별 샘플 동료 명단(고정 소속) — 매일 활동량만 시드로 달라짐 */
var SAMPLE_MEMBERS = (function () {
  var byRoom = {};
  ROOMS.forEach(function (room, ri) {
    var members = [];
    var count = 6 + (hashStr(room.id) % 4); // 6~9명
    for (var i = 0; i < count; i++) {
      var seed = room.id + "-member-" + i;
      var nick = SAMPLE_NICKNAMES[hashStr(seed) % SAMPLE_NICKNAMES.length] + (i % 3 === 0 ? "" : String(1 + (hashStr(seed + "n") % 9)));
      members.push({
        id: seed,
        nick: nick,
        emoji: AVATAR_EMOJIS[hashStr(seed + "e") % AVATAR_EMOJIS.length],
        grad: AVATAR_GRADIENTS[hashStr(seed + "g") % AVATAR_GRADIENTS.length],
        baseStreak: 1 + (hashStr(seed + "s") % 21)
      });
    }
    byRoom[room.id] = members;
  });
  return byRoom;
})();

/* 오늘 기준 샘플 동료의 공부 시간(분) — 날짜 시드로 매일 자연스럽게 변함 */
function sampleMinutesToday(roomId, memberId) {
  var r = rngFor(roomId + "|" + memberId + "|" + todayStr());
  var base = r() * 180; // 0~180분
  var bonus = r() < 0.3 ? r() * 60 : 0;
  return Math.round(base + bonus);
}

/* 오늘 룸별 샘플 인증 피드(체험용) 생성 */
function sampleFeedToday(roomId) {
  var members = SAMPLE_MEMBERS[roomId] || [];
  var seedDate = todayStr();
  var feed = [];
  members.forEach(function (m) {
    var minutes = sampleMinutesToday(roomId, m.id);
    if (minutes < 10) return; // 오늘 활동 없음
    var r = rngFor(roomId + "|" + m.id + "|" + seedDate + "|time");
    var hoursAgoMax = 14;
    var minsAgo = Math.floor(r() * hoursAgoMax * 60) + 3;
    feed.push({
      id: roomId + "-" + m.id + "-" + seedDate,
      memberId: m.id,
      nick: m.nick,
      emoji: m.emoji,
      grad: m.grad,
      minutes: minutes,
      minsAgo: minsAgo,
      sample: true
    });
  });
  feed.sort(function (a, b) { return a.minsAgo - b.minsAgo; });
  return feed;
}

/* ---------------- 오늘의 학습 동기부여 문구 ---------------- */
var QUOTES = [
  "오늘 흘린 땀은 배신하지 않아요.",
  "완벽하게 말고, 꾸준하게.",
  "작은 진도가 쌓이면 결국 큰 차이가 됩니다.",
  "지금의 30분이 미래의 나를 바꿔요.",
  "포기하고 싶을 때가 반환점이에요.",
  "남과 비교하지 말고 어제의 나와 비교해요.",
  "공부는 재능이 아니라 시간과 반복이에요.",
  "오늘도 책상에 앉은 당신, 이미 절반은 성공.",
  "쉬는 것도 계획의 일부예요, 죄책감 갖지 말아요.",
  "1등이 아니어도 괜찮아요, 어제보다 나은 나면 충분해요.",
  "조금 늦게 시작해도 멈추지만 않으면 돼요.",
  "집중한 25분이 산만한 2시간보다 낫습니다.",
  "실수는 배움의 증거예요.",
  "목표를 잘게 쪼개면 오늘 할 일이 보여요.",
  "힘든 과목일수록 먼저 펴보는 용기.",
  "졸리면 5분만 눈 붙이고 다시 시작해요.",
  "오늘의 최선이 내일의 기준이 됩니다.",
  "혼자가 아니에요, 지금 이 시간에도 같이 공부하는 친구들이 있어요.",
  "노력은 배신하지 않는다는 말, 오늘도 증명해봐요.",
  "완주가 목표예요, 속도는 두 번째.",
  "시험은 끝나지만 공부하는 습관은 남아요.",
  "지금 딴생각이 든다면, 딱 한 문제만 더 풀어봐요.",
  "매일 1%씩만 나아져도 1년이면 완전히 달라져요.",
  "쉬운 것부터 풀며 공부 엔진을 켜봐요.",
  "오늘 세운 계획, 절반만 해도 성공이에요.",
  "번아웃보다 무서운 건 아예 시작 안 하는 거예요.",
  "잘하고 있어요, 그 페이스 그대로 가봐요.",
  "틀린 문제 노트가 곧 나만의 합격 비법서예요.",
  "공부는 나를 위한 투자, 오늘도 투자 중.",
  "긴 싸움일수록 페이스 조절이 실력이에요."
];

function quoteOfToday() {
  var d = new Date();
  var start = new Date(d.getFullYear(), 0, 0);
  var diff = d - start;
  var dayOfYear = Math.floor(diff / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/* ---------------- 배지 ---------------- */
var BADGES = [
  { id: "first-log", name: "첫 발걸음", desc: "첫 학습 인증 완료", emoji: "🌱", check: function (s) { return s.totalMinutes >= 1; } },
  { id: "streak-3", name: "3일 연속", desc: "3일 연속 학습 인증", emoji: "🔥", check: function (s) { return s.streak >= 3; } },
  { id: "streak-7", name: "일주일 완주", desc: "7일 연속 학습 인증", emoji: "🔥", check: function (s) { return s.streak >= 7; } },
  { id: "streak-30", name: "한 달 개근", desc: "30일 연속 학습 인증", emoji: "🏆", check: function (s) { return s.streak >= 30; } },
  { id: "hour-10", name: "누적 10시간", desc: "총 학습시간 10시간 달성", emoji: "⏱️", check: function (s) { return s.totalMinutes >= 600; } },
  { id: "hour-50", name: "누적 50시간", desc: "총 학습시간 50시간 달성", emoji: "⏱️", check: function (s) { return s.totalMinutes >= 3000; } },
  { id: "hour-100", name: "누적 100시간", desc: "총 학습시간 100시간 달성", emoji: "💎", check: function (s) { return s.totalMinutes >= 6000; } },
  { id: "goal-1", name: "목표 달성", desc: "오늘의 목표 시간 달성", emoji: "🎯", check: function (s) { return s.goalHitCount >= 1; } },
  { id: "goal-10", name: "목표 마스터", desc: "목표 시간 10번 달성", emoji: "🎯", check: function (s) { return s.goalHitCount >= 10; } },
  { id: "pomo-10", name: "뽀모도로 10회", desc: "뽀모도로 세션 10회 완료", emoji: "🍅", check: function (s) { return s.pomoCount >= 10; } },
  { id: "pomo-50", name: "뽀모도로 마스터", desc: "뽀모도로 세션 50회 완료", emoji: "🍅", check: function (s) { return s.pomoCount >= 50; } },
  { id: "rooms-3", name: "다과목러", desc: "3개 이상의 룸 참여", emoji: "🗂️", check: function (s) { return s.joinedRoomsCount >= 3; } }
];

/* ---------------- 프리셋 리액션(자유 텍스트 없음) ---------------- */
var REACTIONS = [
  { id: "fighting", label: "화이팅", emoji: "👏" },
  { id: "metoo", label: "나도 할래요", emoji: "🙋" },
  { id: "great", label: "대단해요", emoji: "🌟" },
  { id: "respect", label: "존경해요", emoji: "😮" },
  { id: "together", label: "같이 가요", emoji: "🔥" },
  { id: "power", label: "힘내세요", emoji: "💪" }
];
