export default {
  slug: "split-plan",
  emoji: "📋",
  name: "스플릿 플랜 (구간 통과표)",
  card: "목표 시간을 km별 통과 시간표로. 네거티브 스플릿 옵션 + 인쇄해서 손목에 붙이기.",
  title: "마라톤 스플릿 플랜 — km별 통과 시간표 + 네거티브 스플릿 (인쇄용)",
  desc: "목표 거리와 목표 완주 시간을 넣으면 1km 단위 구간 페이스와 누적 통과 시간표를 만듭니다. 네거티브 스플릿(후반 가속) 비율을 조정할 수 있고, 인쇄 버튼으로 손목 밴드용 표를 뽑을 수 있습니다.",
  lead: "목표 시간 → km별 통과 시간표. 네거티브 스플릿을 적용하고 그대로 인쇄해 손목에 붙이세요.",
  body: `
  <section class="tool no-print">
    <h2>목표 설정</h2>
    <div class="field">
      <label for="preset">거리</label>
      <select id="preset"></select>
    </div>
    <div class="grid2">
      <div class="field">
        <label for="dist">거리 (km)</label>
        <input type="number" id="dist" inputmode="decimal" min="1" step="0.001" value="42.195" />
      </div>
      <div class="field">
        <label for="goal">목표 시간 (h:mm:ss)</label>
        <input type="text" id="goal" inputmode="numeric" placeholder="4:00:00" value="4:00:00" />
      </div>
    </div>
    <div class="field">
      <label for="neg">네거티브 스플릿 (후반이 전반보다 빠른 정도)</label>
      <select id="neg">
        <option value="0">이븐 페이스 — 처음부터 끝까지 같은 페이스</option>
        <option value="0.01">1% — 아주 완만한 후반 가속</option>
        <option value="0.02" selected>2% — 표준 권장</option>
        <option value="0.03">3% — 뚜렷한 후반 가속</option>
        <option value="0.05">5% — 공격적 (전반을 크게 참아야 함)</option>
        <option value="-0.02">-2% — 포지티브 스플릿(전반이 빠름, 비권장)</option>
      </select>
    </div>
    <div class="field">
      <label for="step">표 간격</label>
      <select id="step">
        <option value="1">1 km</option>
        <option value="2">2 km</option>
        <option value="5">5 km</option>
      </select>
    </div>
    <div class="btnrow">
      <button class="btn" id="calcBtn" type="button">스플릿 표 만들기</button>
      <button class="btn sub" id="printBtn" type="button" hidden>표 인쇄하기</button>
    </div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>스플릿 플랜</h2>
    <p class="big"><span id="goalOut">-</span></p>
    <div class="kv"><span class="k">평균 페이스</span><span class="v" id="avgOut">-</span></div>
    <div class="kv"><span class="k">전반 / 후반</span><span class="v" id="halfOut">-</span></div>
    <div class="kv"><span class="k">첫 구간 / 마지막 구간 페이스</span><span class="v" id="edgeOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt">
        <thead><tr><th class="num">지점</th><th class="num">구간 페이스</th><th class="num">구간 시간</th><th class="num">누적 통과</th></tr></thead>
        <tbody id="sBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">※ 급수대·오르막·바람에 따라 실제 통과 시간은 달라집니다. 표는 목표 감각을 잡기 위한 기준선으로 쓰세요.</p>
  </section>`,
  intro: `<p>스플릿 플랜은 목표 완주 시간을 <b>구간별 통과 시간</b>으로 쪼갠 표입니다. 대회 중에는 시계의 평균 페이스만 보면 "지금 빠른가 느린가"를 판단하기 어렵지만, 각 km 지점의 목표 통과 시각을 알고 있으면 표지판을 지날 때마다 바로 확인할 수 있습니다.</p>
    <p><b>네거티브 스플릿</b>은 후반을 전반보다 빠르게 뛰는 전략입니다. 초반 오버페이스로 후반에 무너지는 것을 막아 주기 때문에 마라톤에서 널리 권장됩니다. 이 계산기는 거리에 따라 페이스가 선형으로 빨라지도록 배분하되, 합계가 정확히 목표 시간이 되도록 맞춥니다.</p>
    <p>완성된 표는 인쇄 버튼으로 바로 뽑을 수 있습니다. 인쇄 시에는 입력 폼·광고·메뉴가 모두 빠지고 표만 남습니다.</p>`,
  howto: [
    "거리를 프리셋에서 고르거나 직접 입력합니다 (기본값은 풀 마라톤 42.195km).",
    "목표 완주 시간을 h:mm:ss 로 넣습니다. 목표가 막연하면 <a href=\"../race-predict/\">완주 기록 예측</a>으로 먼저 예상치를 구하세요.",
    "네거티브 스플릿 비율을 고릅니다. 처음이라면 2% 를 권합니다.",
    "표 간격(1/2/5km)을 고르고 표를 만든 뒤, 인쇄 버튼으로 출력해 손목 밴드나 번호표 뒤에 붙입니다.",
  ],
  faq: [
    { q: "네거티브 스플릿 2% 는 정확히 어떤 의미인가요?", a: "후반 절반의 평균 페이스가 전반 절반보다 2% 빠르다는 뜻입니다. 4시간 목표라면 전반 약 2시간 1분, 후반 약 1시간 59분이 됩니다." },
    { q: "왜 후반을 빠르게 뛰라고 하나요?", a: "초반에 목표보다 빠르게 나가면 글리코겐 소모와 근피로가 앞당겨져 후반에 페이스가 급격히 무너집니다. 전반을 참으면 같은 총 노력으로 더 좋은 기록이 나오는 경우가 많습니다." },
    { q: "42.195km 처럼 딱 떨어지지 않는 거리는요?", a: "마지막 남은 구간(예: 0.195km)을 별도 행으로 표시하고, 그 구간의 페이스와 시간도 함께 계산합니다." },
    { q: "인쇄하면 무엇이 나오나요?", a: "제목, 목표 요약, 스플릿 표만 인쇄됩니다. 입력 폼·관련 도구·광고·푸터는 인쇄 CSS(@media print)로 제외됩니다." },
    { q: "포지티브 스플릿 옵션은 왜 있나요?", a: "일부러 전반을 빠르게 잡는 전략(내리막 코스 등)을 비교해 보기 위한 옵션입니다. 일반적인 대회에서는 권장하지 않습니다." },
  ],
  sources: [
    { label: "마라톤 공인 거리 42.195km", url: "https://en.wikipedia.org/wiki/Marathon" },
    { label: "하프 마라톤 공인 거리 21.0975km", url: "https://en.wikipedia.org/wiki/Half_marathon" },
    { label: "네거티브 스플릿 개념", url: "https://en.wikipedia.org/wiki/Negative_split" },
  ],
  related: ["race-predict", "running-pace", "hr-zone"],
  external: [
    { name: "TomatoEggCat 러닝 페이스 계산기", url: "https://tomatoeggcat.com/running-pace-calc/" },
    { name: "TomatoEggCat 소모 칼로리 계산기", url: "https://tomatoeggcat.com/calorie-burn-calc/" },
  ],
  script: `import { RACE_DISTANCES, parseHMS, fmtHMS, fmtPace } from "../data/pace.mjs";
import { $, showAd, fmt } from "../assets/app.mjs";

const sel = $("#preset");
sel.innerHTML = RACE_DISTANCES.map((d) => '<option value="' + d.km.value + '"' + (d.id === "full" ? " selected" : "") + ">" + d.name + " (" + d.km.value + "km)</option>").join("") + '<option value="">직접 입력</option>';
sel.addEventListener("change", () => { if (sel.value) $("#dist").value = sel.value; });

/* 페이스를 거리에 대해 선형 배분: p(x) = pAvg * (1 + d - 2d·x/D)
   전반 평균 = pAvg(1+d/2), 후반 평균 = pAvg(1-d/2) → 후반이 X% 빠르려면 d = 2X/(2-X) */
function makePlan(D, total, X) {
  const pAvg = total / D;
  const d = (2 * X) / (2 - X);
  const cum = (x) => pAvg * ((1 + d) * x - (d * x * x) / D);
  return { pAvg: pAvg, d: d, cum: cum, paceAt: (x) => pAvg * (1 + d - (2 * d * x) / D) };
}

function run() {
  const D = parseFloat($("#dist").value);
  const total = parseHMS($("#goal").value);
  const X = parseFloat($("#neg").value) || 0;
  const step = parseFloat($("#step").value) || 1;
  if (!isFinite(D) || D <= 0) { alert("거리를 확인해 주세요."); return; }
  if (total == null) { alert("목표 시간 형식을 확인해 주세요. 예: 4:00:00"); return; }
  const plan = makePlan(D, total, X);

  const rows = [];
  let a = 0;
  while (a < D - 1e-9) {
    const b = Math.min(a + step, D);
    const segT = plan.cum(b) - plan.cum(a);
    rows.push({ a: a, b: b, len: b - a, segT: segT, cum: plan.cum(b) });
    a = b;
  }
  const half = plan.cum(D / 2);
  $("#goalOut").textContent = fmt(D, 3) + "km · 목표 " + fmtHMS(total);
  $("#avgOut").textContent = fmtPace(plan.pAvg) + " /km";
  $("#halfOut").textContent = fmtHMS(half) + " / " + fmtHMS(total - half) + (X > 0 ? " (후반 " + fmt(X * 100, 0) + "% 빠름)" : X < 0 ? " (전반이 빠름)" : " (이븐)");
  $("#edgeOut").textContent = fmtPace(plan.paceAt(0.0001)) + " → " + fmtPace(plan.paceAt(D - 0.0001)) + " /km";
  $("#sBody").innerHTML = rows
    .map((r) => {
      const label = (Math.abs(r.b - Math.round(r.b)) < 1e-6 ? String(Math.round(r.b)) : fmt(r.b, 3)) + " km" + (r.len < step - 1e-9 ? " (마지막 " + fmt(r.len, 3) + "km)" : "");
      return "<tr><td class=\\"num\\">" + label + "</td><td class=\\"num\\">" + fmtPace(r.segT / r.len) + "</td><td class=\\"num\\">" + fmtHMS(r.segT) + "</td><td class=\\"num\\">" + fmtHMS(r.cum) + "</td></tr>";
    })
    .join("");
  $("#resultBox").hidden = false;
  $("#printBtn").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);
$("#printBtn").addEventListener("click", () => window.print());
$("#goal").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });`,
};
