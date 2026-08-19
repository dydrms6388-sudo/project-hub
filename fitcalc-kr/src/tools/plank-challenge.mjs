export default {
  slug: "plank-challenge",
  emoji: "🧘",
  name: "30일 챌린지 체크",
  card: "플랭크·스쿼트·푸시업 30일 프로그램. 체크한 진행률이 브라우저에 저장됩니다.",
  title: "30일 플랭크 챌린지 — 스쿼트·푸시업 버전 포함 진행 체크표",
  desc: "플랭크·스쿼트·푸시업 3종의 30일 챌린지 프로그램을 날짜별로 체크하며 진행률을 관리합니다. 체크 기록은 브라우저(localStorage)에만 저장되고 CSV 내보내기·전체 삭제를 지원합니다.",
  lead: "플랭크 · 스쿼트 · 푸시업 30일 프로그램. 오늘 목표를 체크하고 진행률을 쌓아 보세요.",
  body: `
  <section class="tool">
    <h2>프로그램 선택</h2>
    <div class="field">
      <label for="prog">종목</label>
      <select id="prog"></select>
      <span class="hint"><span class="badge ref">참고</span> 자체 구성 프로그램입니다. 통증이 있으면 즉시 중단하고 강도를 낮추세요.</span>
    </div>
    <p class="hint" id="todayHint"></p>
    <div class="days" id="dayGrid" role="group" aria-label="30일 체크"></div>
    <div class="btnrow">
      <button class="btn" id="todayBtn" type="button">오늘 것 체크</button>
      <button class="btn sub" id="csvBtn" type="button">CSV 내보내기</button>
      <button class="btn danger" id="clearBtn" type="button">전체 삭제</button>
    </div>
    <p class="hint" style="margin-top:10px">🔒 체크 기록은 이 브라우저의 저장소(localStorage)에만 저장됩니다. <b>서버로 전송되지 않습니다.</b></p>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>진행 상황</h2>
    <p class="big"><span id="pctOut">-</span> <small>완료</small></p>
    <div class="progress"><i id="barOut"></i></div>
    <div class="kv"><span class="k">완료 / 전체</span><span class="v" id="cntOut">-</span></div>
    <div class="kv"><span class="k">누적 수행량</span><span class="v" id="sumOut">-</span></div>
    <div class="kv"><span class="k">다음 목표</span><span class="v" id="nextOut">-</span></div>
    <p class="hint" style="margin-top:10px">플랭크 자세가 흔들리면 시간을 채우기보다 자세를 유지할 수 있는 만큼만 하세요. 허리가 꺼지면 즉시 중단합니다.</p>
  </section>`,
  intro: `<p>30일 챌린지는 매일 조금씩 목표를 올리며 습관을 만드는 방식입니다. 이 페이지는 <b>플랭크(초)</b>, <b>스쿼트(회)</b>, <b>푸시업(회)</b> 세 가지 프로그램을 제공하고, 각 일차를 눌러 체크하면 진행률과 누적 수행량이 자동으로 계산됩니다.</p>
    <p>세 프로그램 모두 5~6일마다 휴식일이 들어 있습니다. 휴식일은 회복을 위한 계획된 날이므로 건너뛰지 말고 그대로 쉬는 것이 좋습니다.</p>
    <p><span class="badge ref">참고</span> 이 프로그램들은 연구 기반 처방이 아니라 자체 구성한 참고용 진행표입니다. 체력 수준에 따라 목표가 과할 수 있으니, 자세가 무너지면 시간·횟수를 줄여 조정하세요.</p>`,
  howto: [
    "종목(플랭크 / 스쿼트 / 푸시업)을 고릅니다. 종목별로 진행 기록이 따로 저장됩니다.",
    "그날의 목표를 수행한 뒤 해당 일차 칸을 눌러 체크합니다. <b>오늘 것 체크</b> 버튼은 다음 미완료 일차를 자동으로 체크합니다.",
    "휴식(0) 일차도 체크해서 넘기면 진행률에 반영됩니다.",
    "진행률·누적 수행량과 다음 목표를 확인하며 30일을 채웁니다.",
    "CSV 내보내기로 기록을 백업하거나, 전체 삭제로 처음부터 다시 시작할 수 있습니다.",
  ],
  faq: [
    { q: "하루를 빠뜨렸는데 처음부터 다시 해야 하나요?", a: "아닙니다. 빠진 날의 목표를 다음 날 이어서 하면 됩니다. 이틀 이상 쉬었다면 직전 성공한 일차로 한 단계 낮춰 재개하는 편이 안전합니다." },
    { q: "플랭크 자세가 흔들리면 시간을 채워야 하나요?", a: "아니요. 허리가 꺼지거나 엉덩이가 솟은 상태로 시간을 채우면 허리에 부담만 커집니다. 자세를 유지할 수 있는 시간까지만 하고, 나눠서 여러 세트로 채우세요." },
    { q: "목표가 너무 쉽거나 너무 어려워요.", a: "이 표는 참고용 자체 구성 프로그램입니다. 전체 목표를 일정 비율로 올리거나 내려 자신의 수준에 맞게 조정해 사용하세요." },
    { q: "체크 기록은 어디에 저장되나요?", a: "브라우저 localStorage 에만 저장됩니다. 서버 전송이 없고 계정도 필요 없습니다. 브라우저 데이터를 지우면 함께 사라집니다." },
    { q: "스쿼트·푸시업은 한 번에 다 해야 하나요?", a: "나눠서 해도 됩니다. 하루 총량을 채우는 것이 목표이므로 2~4세트로 쪼개는 편이 자세 유지에 유리합니다." },
  ],
  sources: [
    { label: "자체 구성 프로그램 — 연구 근거 기반 처방이 아님(참고용)", url: "" },
    { label: "플랭크(코어 운동) 개요", url: "https://en.wikipedia.org/wiki/Plank_(exercise)" },
    { label: "MDN — Window.localStorage (브라우저 저장, 서버 전송 없음)", url: "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage" },
  ],
  related: ["workout-log", "step-convert", "rest-day"],
  external: [
    { name: "TomatoEggCat 홈트 루틴 추천", url: "https://tomatoeggcat.com/home-workout-routine/" },
    { name: "TomatoEggCat BMI 계산기", url: "https://tomatoeggcat.com/bmi/" },
  ],
  script: `import { PROGRAMS } from "../data/plank.mjs";
import { $, showAd, fmt, store, downloadText, todayStr } from "../assets/app.mjs";

const KEY = (id) => "fitcalc-challenge-" + id + "-v1";
const sel = $("#prog");
sel.innerHTML = PROGRAMS.map((p) => '<option value="' + p.id + '">' + p.emoji + " " + p.name + " 30일</option>").join("");

let prog = PROGRAMS[0];
let done = [];

function load() {
  prog = PROGRAMS.find((p) => p.id === sel.value) || PROGRAMS[0];
  done = store.get(KEY(prog.id), []);
  if (!Array.isArray(done)) done = [];
  render();
}

function label(v) { return v === 0 ? "휴식" : v + prog.unit; }

function render() {
  $("#dayGrid").innerHTML = prog.value
    .map((v, i) => '<div class="day' + (done[i] ? " done" : "") + (v === 0 ? " rest-d" : "") + '" role="checkbox" tabindex="0" aria-checked="' + (done[i] ? "true" : "false") + '" data-i="' + i + '"><div class="dn">' + (i + 1) + "일차</div><div class=\\"dv\\">" + (done[i] ? "✓ " : "") + label(v) + "</div></div>")
    .join("");
  const cnt = done.filter(Boolean).length;
  const nextIdx = prog.value.findIndex((v, i) => !done[i]);
  $("#todayHint").innerHTML = nextIdx < 0
    ? "🎉 30일 프로그램을 모두 완료했습니다!"
    : "다음 목표: <b>" + (nextIdx + 1) + "일차 · " + label(prog.value[nextIdx]) + "</b>";
  if (cnt === 0) { $("#resultBox").hidden = true; return; }
  const sum = prog.value.reduce((a, v, i) => a + (done[i] ? v : 0), 0);
  $("#pctOut").textContent = fmt((cnt / prog.value.length) * 100, 0) + "%";
  $("#barOut").style.width = (cnt / prog.value.length) * 100 + "%";
  $("#cntOut").textContent = cnt + " / " + prog.value.length + "일";
  $("#sumOut").textContent = fmt(sum, 0) + prog.unit + (prog.unit === "초" ? " (" + fmt(sum / 60, 1) + "분)" : "");
  $("#nextOut").textContent = nextIdx < 0 ? "완료" : (nextIdx + 1) + "일차 · " + label(prog.value[nextIdx]);
  $("#resultBox").hidden = false;
  showAd();
}

function toggle(i) {
  done[i] = !done[i];
  store.set(KEY(prog.id), done);
  render();
}

sel.addEventListener("change", load);
$("#dayGrid").addEventListener("click", (e) => {
  const el = e.target.closest("[data-i]");
  if (el) toggle(parseInt(el.dataset.i, 10));
});
$("#dayGrid").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest("[data-i]");
  if (el) { e.preventDefault(); toggle(parseInt(el.dataset.i, 10)); }
});
$("#todayBtn").addEventListener("click", () => {
  const i = prog.value.findIndex((v, k) => !done[k]);
  if (i < 0) { alert("이미 30일을 모두 완료했습니다."); return; }
  toggle(i);
});
$("#csvBtn").addEventListener("click", () => {
  const head = "일차,목표,단위,완료";
  const body = prog.value.map((v, i) => [i + 1, v, prog.unit, done[i] ? "완료" : ""].join(",")).join("\\n");
  downloadText("fitcalc-" + prog.id + "-challenge-" + todayStr() + ".csv", head + "\\n" + body, "text/csv");
});
$("#clearBtn").addEventListener("click", () => {
  if (!confirm(prog.name + " 챌린지 체크 기록을 모두 삭제합니다. 계속할까요?")) return;
  done = [];
  store.del(KEY(prog.id));
  render();
});

load();`,
};
