export default {
  slug: "hr-zone",
  emoji: "❤️",
  name: "심박수 존 계산기",
  card: "최대심박수 2공식 + Karvonen 여유심박으로 존 1~5 목표 심박 구간을 계산합니다.",
  title: "심박수 존 계산기 — 220-나이 vs Tanaka + Karvonen 여유심박(HRR)",
  desc: "나이와 안정 시 심박수를 넣으면 최대심박수(220-나이 / Tanaka)와 Karvonen 여유심박 방식으로 존 1~5 목표 심박 구간을 계산합니다. 두 공식 결과를 나란히 비교해 러닝·유산소 강도를 잡을 수 있습니다.",
  lead: "나이 + 안정 심박 → 존 1~5 목표 심박 구간. %HRmax 방식과 Karvonen(여유심박) 방식을 비교합니다.",
  body: `
  <section class="tool">
    <h2>입력</h2>
    <div class="grid2">
      <div class="field">
        <label for="age">나이 (만)</label>
        <input type="number" id="age" inputmode="numeric" min="10" max="100" step="1" value="35" />
      </div>
      <div class="field">
        <label for="rest">안정 시 심박수 (bpm)</label>
        <input type="number" id="rest" inputmode="numeric" min="30" max="120" step="1" value="60" />
        <span class="hint">아침에 일어나 누운 채로 1분간 측정한 값</span>
      </div>
    </div>
    <div class="field">
      <label for="formula">최대심박수 공식</label>
      <select id="formula"></select>
    </div>
    <div class="field">
      <label for="measured">직접 측정한 최대심박수 (bpm, 선택)</label>
      <input type="number" id="measured" inputmode="numeric" min="100" max="230" step="1" placeholder="비우면 공식으로 추정" />
      <span class="hint">실측값이 있으면 공식보다 정확합니다.</span>
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">심박 존 계산하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>내 심박 존</h2>
    <p class="big"><span id="hrmaxOut">-</span> <small>bpm 최대심박수(추정)</small></p>
    <div class="kv"><span class="k">적용 공식</span><span class="v" id="fOut">-</span></div>
    <div class="kv"><span class="k">여유심박(HRR = HRmax − HRrest)</span><span class="v" id="hrrOut">-</span></div>
    <div class="kv"><span class="k">다른 공식 값</span><span class="v" id="altOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">존별 목표 심박 구간 (bpm)</caption>
        <thead><tr><th>존</th><th class="num">%HRmax</th><th class="num">%HRmax 방식</th><th class="num">Karvonen(HRR) 방식</th><th>느낌</th></tr></thead>
        <tbody id="zBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">※ 최대심박수는 개인차가 매우 큽니다(같은 나이에서 ±10~20bpm). 심혈관 질환·복용 약이 있다면 반드시 의사와 상담 후 강도를 정하세요.</p>
  </section>`,
  intro: `<p>심박수 존은 운동 강도를 심박수 구간으로 나눈 것입니다. 존 2(편안한 유산소)에서 오래 달리면 지구력 기반이, 존 4(역치) 인터벌에서는 젖산 처리 능력이 발달합니다. 강도를 감으로만 잡으면 대부분 "적당히 힘든" 존 3에 몰리기 쉬운데, 존을 숫자로 알면 훈련을 의도대로 분배할 수 있습니다.</p>
    <p>존 계산에는 두 방식이 있습니다. <b>%HRmax</b> 방식은 최대심박수에 비율을 곱하는 단순한 방법이고, <b>Karvonen(여유심박)</b> 방식은 안정 시 심박수를 빼고 계산해 개인의 심폐 능력을 반영합니다. 같은 존이라도 Karvonen 쪽 목표 심박이 더 높게 나오는 것이 정상입니다.</p>
    <p>최대심박수 추정에는 관행적인 <code>220 − 나이</code>와, 메타분석 기반의 <code>Tanaka: 208 − 0.7 × 나이</code>를 함께 제공합니다.</p>`,
  howto: [
    "나이와 안정 시 심박수를 입력합니다. 안정 심박은 아침 기상 직후 누운 채로 재는 것이 가장 정확합니다.",
    "최대심박수 공식을 고릅니다. 중장년이라면 Tanaka 공식이 오차가 작다고 보고됩니다.",
    "실제로 측정한 최대심박수(대회·전력 질주 중 최고치)가 있으면 그 값을 넣으세요 — 공식보다 정확합니다.",
    "결과 표에서 %HRmax 방식과 Karvonen 방식을 비교해 목표 존을 정합니다.",
    "장거리 훈련 대부분은 존 2, 인터벌은 존 4~5 를 목표로 잡는 것이 일반적인 배분입니다.",
  ],
  faq: [
    { q: "220 − 나이 공식은 왜 부정확하다고 하나요?", a: "이 식은 소규모 데이터에서 유도된 경험식으로, 개인 편차가 표준편차 10~12bpm 수준으로 큽니다. Tanaka 등(2001)의 메타분석에서는 208 − 0.7×나이 가 특히 중장년에서 오차가 작다고 보고했습니다." },
    { q: "%HRmax 와 Karvonen 중 뭘 써야 하나요?", a: "안정 심박을 정확히 알고 있다면 Karvonen 이 개인 차이를 더 잘 반영합니다. 안정 심박 측정이 어렵거나 값이 불확실하면 %HRmax 를 쓰세요." },
    { q: "존 2 심박이 너무 낮아서 걷게 됩니다.", a: "훈련 초기에는 흔한 일입니다. 지구력이 붙으면 같은 심박에서 페이스가 빨라집니다. 그동안은 걷기·조깅을 섞는 방식이 오히려 정석입니다." },
    { q: "안정 시 심박수는 몇이 정상인가요?", a: "성인은 대체로 60~100bpm 이며, 지구력 훈련자는 40~60bpm 대인 경우도 많습니다. 갑자기 크게 변했다면 과훈련·수면 부족·질환 신호일 수 있으니 확인이 필요합니다." },
    { q: "최대심박수를 직접 측정해도 되나요?", a: "전력 질주 테스트는 심혈관 부담이 크므로 건강한 사람이 충분한 준비 운동 뒤에만, 가능하면 전문가 감독 하에 하세요. 질환이 있거나 40세 이상 비운동인이라면 권하지 않습니다." },
  ],
  sources: [
    { label: "Tanaka H et al. 2001 — 최대심박수 추정 메타분석", url: "https://pubmed.ncbi.nlm.nih.gov/11153730/" },
    { label: "Heart rate reserve (Karvonen 방식)", url: "https://en.wikipedia.org/wiki/Heart_rate_reserve" },
    { label: "Heart rate — training zones", url: "https://en.wikipedia.org/wiki/Heart_rate#Training_zones" },
  ],
  related: ["running-pace", "interval", "rest-day"],
  external: [
    { name: "TomatoEggCat BMR·TDEE 계산기", url: "https://tomatoeggcat.com/bmr-tdee-calc/" },
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
  ],
  script: `import { HRMAX_FORMULAS, KARVONEN, HR_ZONES } from "../data/hr.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const sel = $("#formula");
sel.innerHTML = HRMAX_FORMULAS.map((f, i) => '<option value="' + f.id + '"' + (i === 1 ? " selected" : "") + ">" + f.name + "</option>").join("");

function run() {
  const age = parseFloat($("#age").value);
  const rest = parseFloat($("#rest").value);
  if (!isFinite(age) || age < 5 || age > 110) { alert("나이를 확인해 주세요."); return; }
  if (!isFinite(rest) || rest < 25 || rest > 150) { alert("안정 시 심박수를 확인해 주세요."); return; }
  const f = HRMAX_FORMULAS.find((x) => x.id === sel.value) || HRMAX_FORMULAS[0];
  const measured = parseFloat($("#measured").value);
  const hrMax = isFinite(measured) && measured > 0 ? measured : f.fn(age);
  if (hrMax <= rest) { alert("최대심박수가 안정 심박수보다 커야 합니다."); return; }
  const hrr = hrMax - rest;

  $("#hrmaxOut").textContent = fmt(hrMax, 0);
  $("#fOut").textContent = (isFinite(measured) && measured > 0 ? "실측값 사용" : f.name + " — " + f.value);
  $("#hrrOut").textContent = fmt(hrr, 0) + " bpm (HRmax " + fmt(hrMax, 0) + " − 안정 " + fmt(rest, 0) + ")";
  $("#altOut").textContent = HRMAX_FORMULAS.map((x) => x.name.split(" ")[0] + " " + fmt(x.fn(age), 0)).join(" · ");
  $("#zBody").innerHTML = HR_ZONES.value
    .map((z) => {
      const a1 = hrMax * z.lo, a2 = hrMax * z.hi;
      const k1 = KARVONEN.fn(hrMax, rest, z.lo), k2 = KARVONEN.fn(hrMax, rest, z.hi);
      return "<tr><td>" + z.name + "</td><td class=\\"num\\">" + Math.round(z.lo * 100) + "~" + Math.round(z.hi * 100) + "%</td>" +
        "<td class=\\"num\\">" + fmt(a1, 0) + "~" + fmt(a2, 0) + "</td>" +
        "<td class=\\"num\\">" + fmt(k1, 0) + "~" + fmt(k2, 0) + "</td><td>" + z.desc + "</td></tr>";
    })
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
for (const id of ["#age", "#rest", "#measured"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
