export default {
  slug: "race-predict",
  emoji: "🎯",
  name: "완주 기록 예측 (Riegel)",
  card: "5K 기록으로 하프·풀 마라톤 완주 시간을 Riegel 공식으로 예측하고 목표 페이스까지.",
  title: "마라톤 완주 기록 예측 — Riegel 공식으로 5K→하프·풀 예상 시간",
  desc: "최근 대회 기록 하나(5K·10K 등)를 넣으면 Riegel 공식(T2 = T1 × (D2/D1)^1.06)으로 10K·하프·풀 마라톤 완주 시간과 목표 페이스를 예측합니다. 지수 조정과 임의 거리 예측도 지원합니다.",
  lead: "최근 기록 하나로 다른 거리의 완주 시간을 예측합니다 — Riegel 공식 T₂ = T₁ × (D₂/D₁)^1.06",
  body: `
  <section class="tool">
    <h2>기준 기록 입력</h2>
    <div class="field">
      <label for="basePreset">기준 거리</label>
      <select id="basePreset"></select>
    </div>
    <div class="field">
      <label for="baseDist">거리 (km)</label>
      <input type="number" id="baseDist" inputmode="decimal" min="0.4" step="0.01" value="5" />
    </div>
    <div class="field">
      <label for="baseTime">기록 (h:mm:ss 또는 mm:ss)</label>
      <input type="text" id="baseTime" inputmode="numeric" placeholder="25:00" value="25:00" />
    </div>
    <div class="field">
      <label for="expo">Riegel 지수 (기본 1.06)</label>
      <select id="expo">
        <option value="1.06">1.06 — 원 논문 표준값</option>
        <option value="1.04">1.04 — 장거리 훈련량이 충분한 경우(낙관)</option>
        <option value="1.08">1.08 — 장거리 경험이 적은 경우(보수)</option>
      </select>
      <span class="hint">지수가 클수록 긴 거리 예측이 느려집니다.</span>
    </div>
    <div class="field">
      <label for="extraDist">추가로 예측할 임의 거리 (km, 선택)</label>
      <input type="number" id="extraDist" inputmode="decimal" min="0.4" step="0.01" placeholder="예: 15" />
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">완주 기록 예측하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>예측 결과</h2>
    <p class="big"><span id="fullOut">-</span> <small>풀 마라톤 예상</small></p>
    <div class="kv"><span class="k">기준 기록</span><span class="v" id="baseOut">-</span></div>
    <div class="kv"><span class="k">적용 지수</span><span class="v" id="expoOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt">
        <thead><tr><th>거리</th><th class="num">예상 기록</th><th class="num">필요 페이스</th><th class="num">시속</th></tr></thead>
        <tbody id="pBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">※ Riegel 예측은 <b>그 거리에 맞는 훈련이 되어 있다는 가정</b>이 전제입니다. 장거리 훈련(롱런) 없이 5K 기록만으로 풀 마라톤에 나가면 실제 기록은 예측보다 크게 느려집니다.</p>
  </section>`,
  intro: `<p>Peter Riegel이 1981년 제안한 지구력 기록 예측식은 <code>T₂ = T₁ × (D₂ / D₁)^1.06</code> 입니다. 거리가 2배가 되면 시간은 2배보다 조금 더(약 2.08배) 걸린다는, 실제 대회 기록 분포에 잘 들어맞는 단순한 멱함수 모델입니다.</p>
    <p>이 계산기는 최근 대회 기록 하나를 기준으로 10K·하프·풀 마라톤을 포함한 여러 거리를 한 번에 예측하고, 각 거리의 <b>필요 페이스</b>와 <b>시속</b>까지 계산합니다. 지수는 1.04(낙관)~1.08(보수) 사이에서 조정할 수 있습니다.</p>
    <p>가장 정확한 예측은 예측하려는 거리와 가까운 기록을 기준으로 삼을 때 나옵니다. 풀 마라톤을 예측한다면 5K보다 하프 기록이 훨씬 신뢰도가 높습니다.</p>`,
  howto: [
    "최근 3개월 이내의 <b>전력 질주 대회·기록 측정</b> 결과를 기준으로 고릅니다.",
    "기준 거리를 프리셋에서 고르거나 직접 km 로 입력합니다.",
    "기록을 h:mm:ss 또는 mm:ss 형식으로 넣습니다.",
    "장거리 훈련량이 적다면 지수를 1.08 로 올려 보수적으로 예측하세요.",
    "결과의 필요 페이스를 <a href=\"../split-plan/\">스플릿 플랜</a>에 넣어 구간별 통과 시간을 만들 수 있습니다.",
  ],
  faq: [
    { q: "Riegel 공식이 잘 맞는 범위는 어디까지인가요?", a: "일반적으로 약 3분~4시간 구간의 기록에서 잘 맞는다고 알려져 있습니다. 매우 짧은 거리(400m)나 울트라 거리에서는 오차가 커집니다." },
    { q: "5K 기록으로 풀 마라톤을 예측해도 되나요?", a: "산술적으로는 가능하지만, 마라톤 완주는 지구력 훈련량에 크게 좌우됩니다. 롱런 경험이 부족하면 예측보다 20~30분 이상 느려지는 일이 흔합니다. 하프 기록이 있다면 그걸 기준으로 쓰세요." },
    { q: "지수 1.06은 어디서 온 값인가요?", a: "Riegel이 여러 종목의 세계 기록·대회 기록을 회귀해 얻은 값입니다. 개인의 지구력 성향에 따라 1.04~1.10 사이로 달라질 수 있어 이 계산기도 조정 옵션을 제공합니다." },
    { q: "내 실제 기록으로 나만의 지수를 구할 수 있나요?", a: "서로 다른 두 거리의 기록이 있으면 b = ln(T₂/T₁) / ln(D₂/D₁) 로 개인 지수를 구할 수 있습니다. 두 기록 모두 최근·전력 질주여야 의미가 있습니다." },
    { q: "예측 기록이 현실적인지 어떻게 확인하나요?", a: "예상 페이스로 10~15km 지속주를 뛰어 보세요. 그 페이스를 대회 거리의 3분의 1 이상 유지하기 힘들다면 목표를 낮추는 편이 안전합니다." },
  ],
  sources: [
    { label: "Peter Riegel — 기록 예측 공식(지수 1.06)", url: "https://en.wikipedia.org/wiki/Peter_Riegel" },
    { label: "마라톤 공인 거리 42.195km", url: "https://en.wikipedia.org/wiki/Marathon" },
  ],
  related: ["running-pace", "split-plan", "hr-zone"],
  external: [
    { name: "TomatoEggCat 러닝 페이스 계산기", url: "https://tomatoeggcat.com/running-pace-calc/" },
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
  ],
  script: `import { RACE_DISTANCES, paceFrom, speedKmh, parseHMS, fmtHMS, fmtPace } from "../data/pace.mjs";
import { RIEGEL_EXPONENT } from "../data/riegel.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const sel = $("#basePreset");
sel.innerHTML = RACE_DISTANCES.map((d) => '<option value="' + d.km.value + '">' + d.name + " (" + d.km.value + "km)</option>").join("") + '<option value="">직접 입력</option>';
sel.addEventListener("change", () => { if (sel.value) $("#baseDist").value = sel.value; });

const TARGETS = [{ name: "1.5K", km: 1.5 }, ...RACE_DISTANCES.map((d) => ({ name: d.name, km: d.km.value }))];

function predict(t1, d1, d2, b) { return t1 * Math.pow(d2 / d1, b); }

function run() {
  const d1 = parseFloat($("#baseDist").value);
  const t1 = parseHMS($("#baseTime").value);
  const b = parseFloat($("#expo").value) || RIEGEL_EXPONENT.value;
  if (!isFinite(d1) || d1 <= 0) { alert("기준 거리를 확인해 주세요."); return; }
  if (t1 == null) { alert("기록 형식을 확인해 주세요. 예: 25:00"); return; }
  const rows = TARGETS.slice();
  const extra = parseFloat($("#extraDist").value);
  if (isFinite(extra) && extra > 0) rows.push({ name: "임의 거리", km: extra });
  rows.sort((a, b2) => a.km - b2.km);

  $("#baseOut").textContent = fmt(d1, 3) + "km " + fmtHMS(t1) + " (" + fmtPace(paceFrom(d1, t1)) + "/km)";
  $("#expoOut").textContent = "b = " + b;
  $("#fullOut").textContent = fmtHMS(predict(t1, d1, 42.195, b));
  $("#pBody").innerHTML = rows
    .map((r) => {
      const t2 = predict(t1, d1, r.km, b);
      const p = paceFrom(r.km, t2);
      return "<tr><td>" + r.name + " (" + fmt(r.km, 3) + "km)</td><td class=\\"num\\">" + fmtHMS(t2) + "</td><td class=\\"num\\">" + fmtPace(p) + "/km</td><td class=\\"num\\">" + fmt(speedKmh(p), 2) + " km/h</td></tr>";
    })
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
$("#baseTime").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
