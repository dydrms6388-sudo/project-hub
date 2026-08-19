export default {
  slug: "one-rm",
  emoji: "🏋️",
  name: "1RM 계산기 (5공식 비교)",
  card: "든 무게 × 반복수로 Epley·Brzycki 등 5개 공식의 1RM을 한 번에 비교하고 %별 훈련 무게표까지.",
  title: "1RM 계산기 — Epley·Brzycki 등 5공식 비교 + %별 무게표",
  desc: "든 무게와 반복 횟수를 입력하면 Epley·Brzycki·Lombardi·O'Conner·Wathan 5개 공식의 1RM 추정치를 한 화면에서 비교하고, 50~100% 훈련 무게표와 원판 세팅까지 계산합니다.",
  lead: "든 무게 × 반복수 → 5개 공식의 1RM 추정치를 동시에 비교하고, 50~100% 훈련 무게표를 만듭니다.",
  body: `
  <section class="tool">
    <h2>세트 기록 입력</h2>
    <div class="grid2">
      <div class="field">
        <label for="w">든 무게 (kg)</label>
        <input type="number" id="w" inputmode="decimal" min="1" step="0.5" value="100" />
      </div>
      <div class="field">
        <label for="r">반복 횟수 (회)</label>
        <input type="number" id="r" inputmode="numeric" min="1" max="15" step="1" value="5" />
        <span class="hint">10회 이하에서 추정 오차가 작습니다.</span>
      </div>
    </div>
    <div class="field">
      <label for="bar">봉 무게 (kg) — 원판 세팅 계산용</label>
      <select id="bar">
        <option value="20">올림픽 바 20kg</option>
        <option value="15">여성용 바 15kg</option>
        <option value="10">EZ/경량 바 10kg</option>
        <option value="0">사용 안 함 (머신·덤벨)</option>
      </select>
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">1RM 계산하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>추정 1RM</h2>
    <p class="big"><span id="avgOut">-</span> <small>kg (5공식 평균)</small></p>
    <div class="kv"><span class="k">입력 세트</span><span class="v" id="inOut">-</span></div>
    <div class="kv"><span class="k">공식별 범위</span><span class="v" id="rangeOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">공식별 1RM 추정치</caption>
        <thead><tr><th>공식</th><th>계산식</th><th class="num">추정 1RM</th></tr></thead>
        <tbody id="fBody"></tbody>
      </table>
    </div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">%1RM 훈련 무게표 (평균 1RM 기준)</caption>
        <thead><tr><th class="num">%1RM</th><th class="num">무게(kg)</th><th class="num">예상 반복</th><th>한쪽 원판</th></tr></thead>
        <tbody id="pBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">※ 추정치는 실제 1RM 측정을 대체하지 않습니다. 무리한 고중량 시도 전에는 반드시 보조자·세이프티를 두세요.</p>
  </section>`,
  intro: `<p>1RM(One-Repetition Maximum)은 한 번만 들 수 있는 최대 무게입니다. 실제로 1RM을 측정하려면 부상 위험과 긴 회복이 따르기 때문에, 현장에서는 <b>가볍게 여러 번 든 기록</b>으로 1RM을 역산하는 추정 공식을 씁니다.</p>
    <p>문제는 공식마다 결과가 다르다는 점입니다. 같은 100kg×5회라도 Brzycki는 112.5kg, Epley는 116.7kg을 내놓습니다. 이 계산기는 널리 쓰이는 5개 공식(Epley·Brzycki·Lombardi·O'Conner·Wathan)을 동시에 계산해 <b>범위와 평균</b>으로 보여주므로, 한 공식의 값을 맹신하지 않고 안전한 훈련 무게 구간을 잡을 수 있습니다.</p>
    <p>계산된 평균 1RM으로 50~100% 훈련 무게표와 봉 기준 한쪽 원판 세팅까지 함께 만들어 줍니다.</p>`,
  howto: [
    "최근에 <b>실패하지 않고</b> 끝낸 세트의 무게(kg)와 반복 횟수를 입력합니다.",
    "반복 횟수는 10회 이하일 때 추정 정확도가 가장 좋습니다. 15회를 넘기면 오차가 급격히 커집니다.",
    "봉 무게를 고르면 %별 무게에 맞는 한쪽 원판 구성을 함께 보여줍니다.",
    "결과의 <b>범위</b>를 보고 보수적으로(낮은 쪽 값 기준) 훈련 무게를 정하세요.",
  ],
  faq: [
    { q: "5개 공식 중 어떤 게 가장 정확한가요?", a: "종목·개인·반복수에 따라 달라 정답은 없습니다. 다만 반복수가 많아질수록 Epley 계열은 값이 높게, Brzycki는 낮게 나오는 경향이 있습니다. 훈련 무게를 정할 때는 평균 또는 낮은 쪽 값을 쓰는 편이 안전합니다." },
    { q: "반복 1회를 입력하면 어떻게 되나요?", a: "1회는 곧 1RM이므로 모든 공식이 입력 무게를 그대로 돌려줍니다." },
    { q: "1RM을 실제로 측정해야 하나요?", a: "초보자나 부상 이력이 있다면 권장하지 않습니다. 추정치로 훈련 강도를 잡고, 필요하면 3RM·5RM 정도의 저위험 테스트를 전문가 지도 아래 하는 편이 안전합니다." },
    { q: "%1RM 옆의 예상 반복 횟수는 무엇인가요?", a: "NSCA 트레이닝 로드 차트에 정리된 현장 관행 대응표입니다. 개인차가 매우 크므로 참고 범위로만 쓰세요." },
    { q: "원판 구성은 어떻게 계산되나요?", a: "목표 무게에서 봉 무게를 뺀 값을 2로 나눈 뒤, 25/20/15/10/5/2.5/1.25kg 원판을 큰 것부터 채워 한쪽 구성을 만듭니다. 정확히 떨어지지 않으면 가장 가까운 조합으로 근사합니다." },
  ],
  sources: [
    { label: "One-repetition maximum (공식 원 문헌 서지 포함)", url: "https://en.wikipedia.org/wiki/One-repetition_maximum" },
    { label: "NSCA Training Load Chart (%1RM ↔ 반복수)", url: "https://www.nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf" },
  ],
  related: ["workout-log", "protein-timing", "rest-day"],
  external: [
    { name: "TomatoEggCat 1RM 랭킹", url: "https://tomatoeggcat.com/lift-rank-1rm/" },
    { name: "TomatoEggCat 단백질 계산기", url: "https://tomatoeggcat.com/protein-calc/" },
  ],
  script: `import { ONE_RM_FORMULAS, averageOneRM, PERCENT_STEPS } from "../data/onerm.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const REPS_AT = { 100: "1회", 95: "2회", 90: "4회", 85: "6회", 80: "8회", 75: "10회", 70: "12회", 65: "15회", 60: "18회", 55: "20회 이상", 50: "20회 이상" };
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

function plateSet(total, bar) {
  if (!bar) return "-";
  let side = (total - bar) / 2;
  if (side < 0.5) return "봉만";
  const out = [];
  for (const p of PLATES) {
    let n = Math.floor((side + 0.01) / p);
    if (n > 0) { out.push(n > 1 ? p + "×" + n : String(p)); side -= n * p; }
  }
  return out.length ? out.join(" + ") : "-";
}

function run() {
  const w = parseFloat($("#w").value);
  const r = Math.round(parseFloat($("#r").value));
  if (!isFinite(w) || w <= 0 || !isFinite(r) || r < 1) { alert("무게와 반복 횟수를 확인해 주세요."); return; }
  const bar = parseFloat($("#bar").value) || 0;
  const vals = ONE_RM_FORMULAS.map((f) => ({ name: f.name, value: f.value, rm: f.fn(w, r) }));
  const avg = averageOneRM(w, r);
  const lo = Math.min(...vals.map((v) => v.rm));
  const hi = Math.max(...vals.map((v) => v.rm));

  $("#avgOut").textContent = fmt(avg, 1);
  $("#inOut").textContent = fmt(w, 1) + "kg × " + r + "회";
  $("#rangeOut").textContent = fmt(lo, 1) + " ~ " + fmt(hi, 1) + " kg";
  $("#fBody").innerHTML = vals
    .map((v) => "<tr><td>" + v.name + "</td><td>" + v.value + "</td><td class=\\"num\\">" + fmt(v.rm, 1) + " kg</td></tr>")
    .join("");
  $("#pBody").innerHTML = PERCENT_STEPS.value
    .map((p) => {
      const kg = (avg * p) / 100;
      return "<tr><td class=\\"num\\">" + p + "%</td><td class=\\"num\\">" + fmt(kg, 1) + "</td><td class=\\"num\\">" + (REPS_AT[p] || "-") + "</td><td>" + plateSet(kg, bar) + "</td></tr>";
    })
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
for (const id of ["#w", "#r"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
