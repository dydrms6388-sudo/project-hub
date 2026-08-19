export default {
  slug: "step-convert",
  emoji: "👟",
  name: "걸음수 ↔ 거리 변환기",
  card: "키·성별 기준 보폭으로 걸음수를 km로, km를 걸음수로. 만보는 몇 km인지 바로 확인.",
  title: "걸음수 거리 변환 — 만보는 몇 km? 키·성별 보폭 기반 계산",
  desc: "키와 성별로 추정한 보폭을 이용해 걸음수를 거리(km)로, 거리를 걸음수로 변환합니다. 만보 = 몇 km인지, 소요 시간과 소모 칼로리(MET 기반)까지 함께 계산합니다.",
  lead: "만보는 내 키로 몇 km일까? 키·성별 보폭으로 걸음수와 거리를 서로 변환합니다.",
  body: `
  <section class="tool">
    <h2>입력</h2>
    <div class="field">
      <label for="mode">변환 방향</label>
      <select id="mode">
        <option value="s2d">걸음수 → 거리</option>
        <option value="d2s">거리 → 걸음수</option>
      </select>
    </div>
    <div class="grid2">
      <div class="field">
        <label for="height">키 (cm)</label>
        <input type="number" id="height" inputmode="decimal" min="100" max="220" step="0.5" value="170" />
      </div>
      <div class="field">
        <label for="sex">성별 (보폭 계수)</label>
        <select id="sex">
          <option value="male">남성 (키 × 0.415)</option>
          <option value="female">여성 (키 × 0.413)</option>
          <option value="avg">평균 (키 × 0.414)</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label for="act">활동</label>
      <select id="act">
        <option value="walk">걷기</option>
        <option value="run">달리기 (보폭 계수 확인 필요)</option>
      </select>
      <span class="hint" id="actHint"></span>
    </div>
    <div class="field" id="fSteps">
      <label for="steps">걸음수 (걸음)</label>
      <input type="number" id="steps" inputmode="numeric" min="1" step="100" value="10000" />
    </div>
    <div class="field" id="fDist" style="display:none">
      <label for="dist">거리 (km)</label>
      <input type="number" id="dist" inputmode="decimal" min="0.1" step="0.1" value="5" />
    </div>
    <div class="grid2">
      <div class="field">
        <label for="wt">체중 (kg) — 칼로리 계산용</label>
        <input type="number" id="wt" inputmode="decimal" min="20" max="250" step="0.1" value="70" />
      </div>
      <div class="field">
        <label for="min">소요 시간 (분, 선택)</label>
        <input type="number" id="min" inputmode="numeric" min="1" max="600" step="1" placeholder="비우면 속도 4.8km/h 가정" />
      </div>
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">변환하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>변환 결과</h2>
    <p class="big"><span id="mainOut">-</span></p>
    <div class="kv"><span class="k">추정 보폭</span><span class="v" id="strideOut">-</span></div>
    <div class="kv"><span class="k">걸음수</span><span class="v" id="stepOut">-</span></div>
    <div class="kv"><span class="k">거리</span><span class="v" id="distOut">-</span></div>
    <div class="kv"><span class="k">평균 속도</span><span class="v" id="speedOut">-</span></div>
    <div class="kv"><span class="k">소모 칼로리 (MET 추정)</span><span class="v" id="kcalOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">내 보폭 기준 걸음수별 거리</caption>
        <thead><tr><th class="num">걸음수</th><th class="num">거리 (km)</th><th class="num">4.8km/h 기준 소요</th></tr></thead>
        <tbody id="tBody"></tbody>
      </table>
    </div>
  </section>`,
  intro: `<p>만보계가 알려 주는 "10,000걸음"이 실제로 몇 km 인지는 사람마다 다릅니다. 보폭이 키에 비례하기 때문입니다. 일반적으로 걷기 보폭은 <b>키 × 0.413(여성) ~ 0.415(남성)</b> 정도로 추정합니다.</p>
    <p>이 변환기는 키와 성별로 보폭을 추정해 걸음수 ↔ 거리를 양방향으로 변환하고, 소요 시간을 입력하면 평균 속도와 그 속도에 맞는 MET 값으로 소모 칼로리까지 계산합니다.</p>
    <p><b>달리기 보폭</b>은 속도에 따라 편차가 매우 커서 단일 계수의 공신력 있는 출처를 확정하지 못했습니다. 달리기 모드는 참고 추정으로만 제공하며 화면에 "확인 필요" 배지를 표시합니다. 정확한 값이 필요하면 트랙 400m 를 걸어(또는 뛰어) 걸음 수를 세는 실측을 권합니다.</p>`,
  howto: [
    "변환 방향(걸음수 → 거리 / 거리 → 걸음수)을 고릅니다.",
    "키와 성별을 입력해 보폭을 추정합니다. 실측 보폭을 안다면 그 값에 맞게 키를 조정해 맞출 수도 있습니다.",
    "걸음수 또는 거리를 입력합니다.",
    "체중과 소요 시간을 넣으면 속도에 맞는 MET 값으로 소모 칼로리를 함께 계산합니다.",
    "아래 표에서 3,000 / 5,000 / 10,000걸음 등이 내 보폭으로 몇 km인지 한눈에 볼 수 있습니다.",
  ],
  faq: [
    { q: "만보는 몇 km 인가요?", a: "키 170cm 남성 기준 보폭 약 0.71m → 10,000걸음은 약 7.1km 입니다. 키 160cm 여성은 약 6.6km 로, 키에 따라 1km 가까이 차이가 납니다." },
    { q: "보폭을 직접 재려면 어떻게 하나요?", a: "평지에서 10m 를 정상 속도로 걸으며 걸음 수를 세고, 10m ÷ 걸음 수로 계산하면 됩니다. 3회 평균을 내면 더 정확합니다." },
    { q: "달리기 보폭에 '확인 필요' 배지가 붙는 이유는?", a: "달리기 보폭은 속도·다리 길이·주법에 따라 0.9m 에서 1.6m 이상까지 크게 변합니다. 단일 계수를 제시하는 공신력 있는 출처를 확정하지 못했기 때문에 참고 추정으로만 제공합니다." },
    { q: "칼로리는 어떻게 계산되나요?", a: "거리와 시간으로 평균 속도를 구한 뒤, 그 속도에 가장 가까운 걷기·러닝 MET 값(2011 Compendium)을 골라 kcal/분 = MET×3.5×체중÷200 으로 계산합니다." },
    { q: "스마트폰 만보계와 값이 다릅니다.", a: "스마트폰은 가속도 패턴으로 걸음을 세고 자체 보폭 모델을 씁니다. 이 계산기는 키 기반 추정이므로 차이가 날 수 있으며, 둘 다 추정값입니다." },
  ],
  sources: [
    { label: "보폭 추정 계수 (키 × 0.413/0.415) — 만보계 보정 관행", url: "https://www.verywellfit.com/set-pedometer-better-accuracy-3432895" },
    { label: "MET 값 — 2011 Compendium of Physical Activities", url: "https://pubmed.ncbi.nlm.nih.gov/21681120/" },
    { label: "TODO 확인 필요: 달리기 보폭 계수(키 × 0.65)의 공신력 있는 단일 출처 미확정", url: "" },
  ],
  related: ["calorie-burn", "running-pace", "plank-challenge"],
  external: [
    { name: "TomatoEggCat 만보기 걸음수 계산", url: "https://tomatoeggcat.com/manbo-steps/" },
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
  ],
  script: `import { STRIDE_WALK, STRIDE_RUN, strideMeters } from "../data/steps.mjs";
import { MET_TABLE, KCAL_FORMULA } from "../data/met.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";
import { fmtHMS } from "../data/pace.mjs";

function syncMode() {
  const s2d = $("#mode").value === "s2d";
  $("#fSteps").style.display = s2d ? "" : "none";
  $("#fDist").style.display = s2d ? "none" : "";
}
$("#mode").addEventListener("change", syncMode); syncMode();

function syncAct() {
  $("#actHint").innerHTML = $("#act").value === "run"
    ? '달리기 보폭 계수 0.65 는 <span class="badge todo">확인 필요</span> 참고 추정값입니다.'
    : "걷기 보폭 계수는 만보계 보정에 널리 쓰이는 값입니다.";
}
$("#act").addEventListener("change", syncAct); syncAct();

// 속도(km/h)에 가장 가까운 걷기/러닝 MET 항목을 고른다.
const SPEED_MET = [
  { kmh: 3.2, id: "walk32" }, { kmh: 4.8, id: "walk48" }, { kmh: 5.6, id: "walk56" }, { kmh: 6.4, id: "walk64" },
  { kmh: 8.0, id: "run80" }, { kmh: 9.7, id: "run97" }, { kmh: 11.3, id: "run113" }, { kmh: 12.9, id: "run129" }, { kmh: 14.5, id: "run145" },
];
function metFor(kmh) {
  let best = SPEED_MET[0];
  for (const s of SPEED_MET) if (Math.abs(s.kmh - kmh) < Math.abs(best.kmh - kmh)) best = s;
  const row = MET_TABLE.find((m) => m.id === best.id);
  return { met: row.met.value, name: row.name };
}

function run() {
  const h = parseFloat($("#height").value);
  if (!isFinite(h) || h < 80 || h > 250) { alert("키를 확인해 주세요."); return; }
  const isRun = $("#act").value === "run";
  const factor = isRun ? STRIDE_RUN.value : (STRIDE_WALK[$("#sex").value] || STRIDE_WALK.avg).value;
  const stride = strideMeters(h, factor);

  let steps, km;
  if ($("#mode").value === "s2d") {
    steps = parseFloat($("#steps").value);
    if (!isFinite(steps) || steps <= 0) { alert("걸음수를 확인해 주세요."); return; }
    km = (steps * stride) / 1000;
  } else {
    km = parseFloat($("#dist").value);
    if (!isFinite(km) || km <= 0) { alert("거리를 확인해 주세요."); return; }
    steps = (km * 1000) / stride;
  }

  const wt = parseFloat($("#wt").value) || 70;
  const minsIn = parseFloat($("#min").value);
  const mins = isFinite(minsIn) && minsIn > 0 ? minsIn : (km / 4.8) * 60;
  const kmh = km / (mins / 60);
  const m = metFor(kmh);
  const kcal = KCAL_FORMULA.fn(m.met, wt, mins);

  $("#mainOut").textContent = $("#mode").value === "s2d"
    ? fmt(km, 2) + " km"
    : fmt(steps, 0) + " 걸음";
  $("#strideOut").innerHTML = fmt(stride * 100, 1) + " cm (키 " + fmt(h, 0) + " × " + factor + ")" + (isRun ? ' <span class="badge todo">확인 필요</span>' : "");
  $("#stepOut").textContent = fmt(steps, 0) + " 걸음";
  $("#distOut").textContent = fmt(km, 3) + " km (" + fmt(km * 1000, 0) + " m)";
  $("#speedOut").textContent = fmt(kmh, 2) + " km/h · " + fmtHMS(mins * 60) + (isFinite(minsIn) && minsIn > 0 ? "" : " (4.8km/h 가정)");
  $("#kcalOut").textContent = fmt(kcal, 0) + " kcal (" + m.name + ", MET " + m.met + ")";
  $("#tBody").innerHTML = [1000, 3000, 5000, 8000, 10000, 15000, 20000]
    .map((s) => {
      const d = (s * stride) / 1000;
      return "<tr><td class=\\"num\\">" + fmt(s, 0) + "</td><td class=\\"num\\">" + fmt(d, 2) + "</td><td class=\\"num\\">" + fmtHMS((d / 4.8) * 3600) + "</td></tr>";
    })
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
for (const id of ["#height", "#steps", "#dist", "#wt", "#min"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
