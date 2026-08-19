export default {
  slug: "running-pace",
  emoji: "🏃",
  name: "러닝 페이스 계산기",
  card: "거리·시간·페이스 중 두 개만 넣으면 나머지 하나를 계산합니다. km/마일 동시 표기.",
  title: "러닝 페이스 계산기 — 거리·시간·페이스 중 2개로 나머지 계산 (km/마일)",
  desc: "거리, 목표 시간, 페이스 중 두 가지만 입력하면 나머지 하나를 즉시 계산합니다. km·마일 페이스와 시속을 동시에 보여주고, 그 페이스로 5K·10K·하프·풀 마라톤을 뛰면 걸리는 시간표까지 제공합니다.",
  lead: "거리 · 시간 · 페이스 — 두 개만 넣으면 나머지 하나가 나옵니다. km와 마일을 함께 표기합니다.",
  body: `
  <section class="tool">
    <h2>무엇을 계산할까요?</h2>
    <div class="field">
      <label for="target">구할 항목</label>
      <select id="target">
        <option value="pace">페이스 (거리 + 시간 입력)</option>
        <option value="time">완주 시간 (거리 + 페이스 입력)</option>
        <option value="dist">거리 (시간 + 페이스 입력)</option>
      </select>
    </div>
    <div class="field">
      <label for="unit">거리·페이스 단위</label>
      <select id="unit">
        <option value="km">킬로미터 (km, 분/km)</option>
        <option value="mi">마일 (mile, 분/mile)</option>
      </select>
    </div>
    <div class="field" id="fDist">
      <label for="dist">거리</label>
      <select id="preset">
        <option value="">직접 입력</option>
      </select>
      <input type="number" id="dist" inputmode="decimal" min="0.1" step="0.01" value="10" />
      <span class="hint">대회 거리를 고르면 자동으로 채워집니다.</span>
    </div>
    <div class="field" id="fTime">
      <label for="time">시간 (h:mm:ss 또는 mm:ss)</label>
      <input type="text" id="time" inputmode="numeric" placeholder="0:50:00" value="0:50:00" />
    </div>
    <div class="field" id="fPace">
      <label for="pace">페이스 (분:초, 단위 거리당)</label>
      <input type="text" id="pace" inputmode="numeric" placeholder="5:00" value="5:00" />
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">계산하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>계산 결과</h2>
    <p class="big"><span id="mainOut">-</span></p>
    <div class="kv"><span class="k">거리</span><span class="v" id="dOut">-</span></div>
    <div class="kv"><span class="k">완주 시간</span><span class="v" id="tOut">-</span></div>
    <div class="kv"><span class="k">페이스 (km)</span><span class="v" id="pkOut">-</span></div>
    <div class="kv"><span class="k">페이스 (mile)</span><span class="v" id="pmOut">-</span></div>
    <div class="kv"><span class="k">평균 속도</span><span class="v" id="sOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt"><caption class="hint" style="text-align:left;padding:4px 0">이 페이스를 그대로 유지하면 (※ 실제로는 거리가 길수록 페이스가 느려집니다 — 완주 예측은 <a href="../race-predict/">완주 기록 예측</a> 참고)</caption>
        <thead><tr><th>거리</th><th class="num">예상 소요 시간</th></tr></thead>
        <tbody id="raceBody"></tbody>
      </table>
    </div>
  </section>`,
  intro: `<p>러닝에서 쓰는 세 값 — <b>거리</b>, <b>시간</b>, <b>페이스</b> — 는 하나의 식으로 묶여 있습니다. 페이스는 단위 거리당 걸린 시간이므로 <code>시간 = 거리 × 페이스</code>이고, 나머지 둘을 알면 세 번째는 자동으로 결정됩니다.</p>
    <p>이 계산기는 어느 값을 구할지 고르면 나머지 두 칸만 입력받아 계산합니다. 결과는 km 페이스와 마일 페이스, 시속을 함께 보여주므로 해외 대회 기록이나 트레드밀 속도(km/h)와도 바로 대조할 수 있습니다.</p>
    <p>5K·10K·하프·풀 마라톤 표는 "지금 페이스를 그대로 유지했을 때"의 산술 계산입니다. 거리가 길어지면 실제로는 페이스가 느려지므로, 대회 기록 예측에는 Riegel 공식을 쓰는 <a href="../race-predict/">완주 기록 예측</a>을 함께 보세요.</p>`,
  howto: [
    "구할 항목을 먼저 고릅니다 — 페이스 / 완주 시간 / 거리 중 하나.",
    "단위를 km 또는 마일로 고릅니다. 페이스 표기도 함께 바뀝니다.",
    "남은 두 칸을 채웁니다. 시간은 <code>0:50:00</code> 또는 <code>50:00</code>, 페이스는 <code>5:30</code> 형식입니다.",
    "결과에서 km·마일 페이스와 시속을 확인하고, 대회 거리 예상 시간표를 참고합니다.",
  ],
  faq: [
    { q: "시간을 어떤 형식으로 입력하나요?", a: "h:mm:ss(1:45:30), mm:ss(50:00), 또는 숫자만(45 → 45분) 모두 인식합니다. 페이스 칸에 5:30을 넣으면 5분 30초/km 입니다." },
    { q: "마일 페이스로 바꾸면 입력값도 바뀌나요?", a: "단위를 바꾸면 거리와 페이스 입력이 그 단위 기준으로 해석됩니다. 결과에는 km와 마일 페이스가 항상 함께 표시됩니다." },
    { q: "시속(km/h)은 어떻게 계산되나요?", a: "3600을 페이스(초/km)로 나눈 값입니다. 트레드밀 속도 설정에 그대로 쓸 수 있습니다." },
    { q: "표의 마라톤 시간이 제 실제 기록보다 빠른데요?", a: "이 표는 페이스를 끝까지 그대로 유지한다는 가정의 단순 곱셈입니다. 실제로는 거리가 길수록 페이스가 떨어지므로, Riegel 공식을 쓰는 완주 기록 예측 페이지를 보세요." },
    { q: "1마일은 몇 km 인가요?", a: "정확히 1.609344km 입니다. 이 값을 그대로 사용합니다." },
  ],
  sources: [
    { label: "마일 정의 (1 mile = 1.609344 km)", url: "https://en.wikipedia.org/wiki/Mile" },
    { label: "마라톤 공인 거리 42.195km", url: "https://en.wikipedia.org/wiki/Marathon" },
    { label: "하프 마라톤 공인 거리 21.0975km", url: "https://en.wikipedia.org/wiki/Half_marathon" },
  ],
  related: ["race-predict", "split-plan", "hr-zone"],
  external: [
    { name: "TomatoEggCat 러닝 페이스 계산기", url: "https://tomatoeggcat.com/running-pace-calc/" },
    { name: "TomatoEggCat 만보기 걸음수 계산", url: "https://tomatoeggcat.com/manbo-steps/" },
  ],
  script: `import { RACE_DISTANCES, MILE_KM, paceFrom, timeFrom, distFrom, speedKmh, parseHMS, fmtHMS, fmtPace } from "../data/pace.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const MI = MILE_KM.value;
const sel = $("#preset");
sel.innerHTML = '<option value="">직접 입력</option>' + RACE_DISTANCES.map((d) => '<option value="' + d.km.value + '">' + d.name + " (" + d.km.value + "km)</option>").join("");

function unitKm() { return $("#unit").value === "km" ? 1 : MI; }

function syncFields() {
  const t = $("#target").value;
  $("#fDist").style.display = t === "dist" ? "none" : "";
  $("#fTime").style.display = t === "time" ? "none" : "";
  $("#fPace").style.display = t === "pace" ? "none" : "";
}
$("#target").addEventListener("change", syncFields);
syncFields();

sel.addEventListener("change", () => {
  if (!sel.value) return;
  const km = parseFloat(sel.value);
  $("#dist").value = ($("#unit").value === "km" ? km : km / MI).toFixed(2);
});

function run() {
  const t = $("#target").value;
  const f = unitKm();
  let distKm = null, timeSec = null, paceKm = null;
  if (t !== "dist") {
    const d = parseFloat($("#dist").value);
    if (!isFinite(d) || d <= 0) { alert("거리를 확인해 주세요."); return; }
    distKm = d * f;
  }
  if (t !== "time") {
    timeSec = parseHMS($("#time").value);
    if (timeSec == null) { alert("시간 형식을 확인해 주세요. 예: 0:50:00"); return; }
  }
  if (t !== "pace") {
    const p = parseHMS($("#pace").value);
    if (p == null) { alert("페이스 형식을 확인해 주세요. 예: 5:30"); return; }
    paceKm = p / f;
  }
  let main = "";
  if (t === "pace") { paceKm = paceFrom(distKm, timeSec); main = fmtPace(paceKm * f) + " / " + ($("#unit").value === "km" ? "km" : "mile"); }
  else if (t === "time") { timeSec = timeFrom(distKm, paceKm); main = fmtHMS(timeSec); }
  else { distKm = distFrom(timeSec, paceKm); main = fmt(distKm / f, 2) + " " + ($("#unit").value === "km" ? "km" : "mile"); }

  $("#mainOut").textContent = main;
  $("#dOut").textContent = fmt(distKm, 3) + " km (" + fmt(distKm / MI, 3) + " mile)";
  $("#tOut").textContent = fmtHMS(timeSec);
  $("#pkOut").textContent = fmtPace(paceKm) + " /km";
  $("#pmOut").textContent = fmtPace(paceKm * MI) + " /mile";
  $("#sOut").textContent = fmt(speedKmh(paceKm), 2) + " km/h (" + fmt(speedKmh(paceKm) / MI, 2) + " mph)";
  $("#raceBody").innerHTML = RACE_DISTANCES
    .map((d) => "<tr><td>" + d.name + " (" + d.km.value + "km)</td><td class=\\"num\\">" + fmtHMS(timeFrom(d.km.value, paceKm)) + "</td></tr>")
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
for (const id of ["#dist", "#time", "#pace"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
