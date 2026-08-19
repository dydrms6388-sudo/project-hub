export default {
  slug: "calorie-burn",
  emoji: "🔥",
  name: "소모 칼로리 계산기 (MET)",
  card: "29개 운동의 MET 값으로 체중·시간에 따른 소모 칼로리를 계산하고 종목별로 비교합니다.",
  title: "운동 소모 칼로리 계산기 — MET 기반 29개 종목 비교 (Compendium)",
  desc: "체중과 운동 시간을 넣으면 걷기·러닝·자전거·수영·웨이트 등 29개 종목의 소모 칼로리를 MET 공식(kcal/분 = MET×3.5×체중÷200)으로 계산하고 한 표에서 비교합니다. MET 값 출처는 2011 Compendium of Physical Activities.",
  lead: "체중 × 시간 × MET → 소모 칼로리. 29개 종목을 한 표에서 비교합니다.",
  body: `
  <section class="tool">
    <h2>입력</h2>
    <div class="grid2">
      <div class="field">
        <label for="wt">체중 (kg)</label>
        <input type="number" id="wt" inputmode="decimal" min="20" max="250" step="0.1" value="70" />
      </div>
      <div class="field">
        <label for="min">운동 시간 (분)</label>
        <input type="number" id="min" inputmode="numeric" min="1" max="600" step="1" value="30" />
      </div>
    </div>
    <div class="field">
      <label for="act">운동 종목</label>
      <select id="act"></select>
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">소모 칼로리 계산하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>계산 결과</h2>
    <p class="big"><span id="kcalOut">-</span> <small>kcal</small></p>
    <div class="kv"><span class="k">선택 종목</span><span class="v" id="actOut">-</span></div>
    <div class="kv"><span class="k">적용 MET</span><span class="v" id="metOut">-</span></div>
    <div class="kv"><span class="k">분당 소모</span><span class="v" id="perMinOut">-</span></div>
    <div class="kv"><span class="k">계산식</span><span class="v" id="formulaOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">같은 체중·시간 기준 종목별 비교</caption>
        <thead><tr><th>분류</th><th>종목</th><th class="num">MET</th><th class="num">소모 kcal</th></tr></thead>
        <tbody id="cBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">※ MET 기반 추정은 안정 시 대사량을 포함한 총 소모량입니다. 체성분·효율·환경에 따라 실제 값은 ±20~30% 차이가 날 수 있습니다.</p>
  </section>`,
  intro: `<p>MET(Metabolic Equivalent of Task)은 가만히 앉아 있을 때의 대사량을 1로 두고 활동 강도를 나타내는 단위입니다. 5 MET 운동은 안정 시보다 산소를 5배 쓴다는 뜻입니다. 소모 칼로리는 여기에 체중과 시간을 곱해 구합니다.</p>
    <p><code>kcal/분 = MET × 3.5 × 체중(kg) ÷ 200</code> — 1 MET가 체중 1kg당 분당 3.5mL의 산소 소비에 해당하고, 산소 1L 소비가 약 5kcal에 해당한다는 환산에서 나온 식입니다.</p>
    <p>이 계산기의 MET 값은 <b>2011 Compendium of Physical Activities</b>(Ainsworth 등)에서 가져왔습니다. 종목을 하나 고르면 같은 체중·시간 기준으로 29개 종목이 어떻게 다른지 표로 비교할 수 있어, "30분 운동으로 얼마나 태울까"를 종목별로 가늠하기 좋습니다.</p>`,
  howto: [
    "체중(kg)과 운동 시간(분)을 입력합니다.",
    "가장 비슷한 종목·강도를 고릅니다. 러닝은 속도별로 MET가 크게 다르니 실제 페이스에 맞춰 고르세요.",
    "결과에서 총 소모 kcal 과 분당 소모량을 확인합니다.",
    "아래 비교표로 같은 시간 대비 효율이 높은 종목을 찾을 수 있습니다.",
  ],
  faq: [
    { q: "MET 계산은 순수한 '추가' 소모인가요?", a: "아닙니다. MET 공식은 안정 시 대사량을 포함한 총 에너지 소비를 추정합니다. 순수 추가 소모를 보려면 (MET − 1)로 계산해야 하며, 이 값이 실제 '운동으로 더 쓴 칼로리'에 가깝습니다." },
    { q: "MET 값의 출처는 어디인가요?", a: "2011 Compendium of Physical Activities(Ainsworth BE 등, Med Sci Sports Exerc)의 표준 MET 코드입니다. 각 종목의 강도 표현도 그 분류를 따랐습니다." },
    { q: "웨이트 트레이닝은 왜 MET가 낮나요?", a: "세트 사이 휴식이 포함된 평균값이기 때문입니다. 다만 근력 운동은 운동 후 대사 증가와 근육량 증가라는 별도의 이점이 있어 칼로리 숫자만으로 평가하기 어렵습니다." },
    { q: "체중이 많이 나가면 더 많이 태우나요?", a: "네, 같은 활동이라도 체중에 비례해 소모가 커집니다. 체중 90kg인 사람은 60kg인 사람의 1.5배를 소모합니다." },
    { q: "스마트워치 값과 다릅니다.", a: "워치는 심박수·개인 프로필을 함께 쓰는 다른 모델을 사용합니다. 두 값 모두 추정치이며, 절대값보다 추세를 보는 편이 실용적입니다." },
  ],
  sources: [
    { label: "2011 Compendium of Physical Activities (Ainsworth et al.)", url: "https://pubmed.ncbi.nlm.nih.gov/21681120/" },
    { label: "Compendium of Physical Activities 공식 사이트", url: "https://pacompendium.com/" },
    { label: "MET 정의 및 kcal 환산", url: "https://en.wikipedia.org/wiki/Metabolic_equivalent_of_task" },
  ],
  related: ["step-convert", "interval", "protein-timing"],
  external: [
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
    { name: "TomatoEggCat BMR·TDEE 계산기", url: "https://tomatoeggcat.com/bmr-tdee-calc/" },
    { name: "TomatoEggCat BMI 계산기", url: "https://tomatoeggcat.com/bmi/" },
  ],
  script: `import { MET_TABLE, KCAL_FORMULA } from "../data/met.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const sel = $("#act");
const groups = [...new Set(MET_TABLE.map((m) => m.group))];
sel.innerHTML = groups
  .map((g) => '<optgroup label="' + g + '">' + MET_TABLE.filter((m) => m.group === g).map((m) => '<option value="' + m.id + '"' + (m.id === "run97" ? " selected" : "") + ">" + m.name + " (MET " + m.met.value + ")</option>").join("") + "</optgroup>")
  .join("");

function run() {
  const wt = parseFloat($("#wt").value);
  const min = parseFloat($("#min").value);
  if (!isFinite(wt) || wt <= 0) { alert("체중을 확인해 주세요."); return; }
  if (!isFinite(min) || min <= 0) { alert("운동 시간을 확인해 주세요."); return; }
  const act = MET_TABLE.find((m) => m.id === sel.value) || MET_TABLE[0];
  const met = act.met.value;
  const kcal = KCAL_FORMULA.fn(met, wt, min);

  $("#kcalOut").textContent = fmt(kcal, 0);
  $("#actOut").textContent = act.name;
  $("#metOut").textContent = met + " MET";
  $("#perMinOut").textContent = fmt(kcal / min, 1) + " kcal/분 (순 추가분 약 " + fmt(KCAL_FORMULA.fn(Math.max(0, met - 1), wt, min) / min, 1) + " kcal/분)";
  $("#formulaOut").textContent = met + " × 3.5 × " + fmt(wt, 1) + " ÷ 200 × " + fmt(min, 0) + "분";
  $("#cBody").innerHTML = MET_TABLE
    .slice()
    .sort((a, b) => b.met.value - a.met.value)
    .map((m) => "<tr" + (m.id === act.id ? ' style="outline:1px solid var(--acc2)"' : "") + "><td>" + m.group + "</td><td>" + m.name + "</td><td class=\\"num\\">" + m.met.value + "</td><td class=\\"num\\">" + fmt(KCAL_FORMULA.fn(m.met.value, wt, min), 0) + "</td></tr>")
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
for (const id of ["#wt", "#min"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
