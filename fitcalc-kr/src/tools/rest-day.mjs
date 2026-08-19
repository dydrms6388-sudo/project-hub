export default {
  slug: "rest-day",
  emoji: "🛌",
  name: "휴식일 계산기 (참고)",
  card: "주간 훈련 부하·단조로움·ACWR을 계산해 휴식이 필요한지 참고 지표로 보여줍니다.",
  title: "휴식일 계산기 — session-RPE 주간 부하·단조로움·ACWR 참고 지표",
  desc: "요일별 운동 시간과 자각 강도(RPE)를 넣으면 session-RPE 방식으로 주간 부하, 단조로움(monotony), 스트레인, 급성:만성 부하비(ACWR)를 계산해 휴식이 필요한지 참고 지표로 보여줍니다.",
  lead: "이번 주 부하가 과했을까? session-RPE로 주간 부하·단조로움·ACWR을 계산합니다. <span class=\"badge ref\">참고</span> 지표입니다.",
  body: `
  <section class="tool">
    <h2>이번 주 훈련 입력 <span class="badge ref">참고</span></h2>
    <p class="hint">각 요일의 <b>운동 시간(분)</b>과 <b>자각 강도 RPE(0~10)</b>를 넣으세요. 쉬는 날은 0 으로 둡니다.</p>
    <div id="dayRows"></div>
    <div class="grid2">
      <div class="field">
        <label for="chronic">최근 4주 평균 주간 부하 (선택)</label>
        <input type="number" id="chronic" inputmode="numeric" min="0" step="10" placeholder="ACWR 계산용 · 비우면 생략" />
        <span class="hint">지난 4주 주간 부하의 평균값. 모르면 비워 두세요.</span>
      </div>
      <div class="field">
        <label for="lastLift">같은 근육군 마지막 저항운동 (선택)</label>
        <input type="date" id="lastLift" />
        <span class="hint">48~72시간 회복 권고 기준으로 다음 가능일을 계산합니다.</span>
      </div>
    </div>
    <div class="btnrow"><button class="btn" id="calcBtn" type="button">부하 계산하기</button></div>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>주간 부하 진단 <span class="badge ref">참고</span></h2>
    <p class="big"><span id="verdictOut">-</span></p>
    <div class="kv"><span class="k">주간 총 부하 (AU)</span><span class="v" id="loadOut">-</span></div>
    <div class="kv"><span class="k">일 평균 / 표준편차</span><span class="v" id="avgOut">-</span></div>
    <div class="kv"><span class="k">단조로움 (monotony)</span><span class="v" id="monoOut">-</span></div>
    <div class="kv"><span class="k">스트레인 (부하 × 단조로움)</span><span class="v" id="strainOut">-</span></div>
    <div class="kv"><span class="k">급성:만성 부하비 (ACWR)</span><span class="v" id="acwrOut">-</span></div>
    <div class="kv"><span class="k">완전 휴식일 (이번 주)</span><span class="v" id="restOut">-</span></div>
    <div class="kv"><span class="k">같은 근육군 다음 운동</span><span class="v" id="nextOut">-</span></div>
    <div class="rt-scroll">
      <table class="rt">
        <thead><tr><th>요일</th><th class="num">시간(분)</th><th class="num">RPE</th><th class="num">부하(AU)</th></tr></thead>
        <tbody id="dBody"></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px"><span class="badge ref">참고</span> 이 지표들은 스포츠과학 현장에서 쓰이는 <b>모니터링 도구</b>이며 진단·처방이 아닙니다. 지속되는 피로·수면 장애·안정 심박 상승이 있다면 지표와 무관하게 휴식하고 전문가와 상담하세요.</p>
  </section>`,
  intro: `<p>훈련 부하를 재는 가장 실용적인 방법은 Foster가 제안한 <b>session-RPE</b> 입니다. 각 세션의 <code>부하 = 운동 시간(분) × 자각 강도 RPE(0~10)</code> 로 계산하고, 이를 일주일 합산해 주간 부하(AU, arbitrary unit)를 구합니다.</p>
    <p>여기에 두 가지 파생 지표를 봅니다. <b>단조로움(monotony)</b>은 일 평균 부하를 표준편차로 나눈 값으로, 매일 비슷한 강도로 훈련할수록 커집니다. Foster는 monotony 가 2.0 을 넘는 상태가 지속되면 과훈련·질병 위험이 높아진다고 보고했습니다. <b>스트레인</b>은 주간 부하 × 단조로움으로, 총량과 단조로움을 함께 반영합니다.</p>
    <p><b>ACWR</b>(급성:만성 부하비)은 이번 주 부하를 최근 4주 평균으로 나눈 값입니다. 0.8~1.3 구간을 '스위트 스팟'으로 보는 참고 기준이 널리 쓰이며, 1.5 를 크게 넘으면 부하를 급격히 올린 상태로 봅니다.</p>
    <p><span class="badge ref">참고</span> 모든 수치는 참고용 모니터링 지표입니다. 절대적인 안전선이 아니며, 개인의 회복력·수면·영양 상태에 따라 크게 달라집니다.</p>`,
  howto: [
    "요일별로 운동한 시간(분)과 그날의 자각 강도 RPE(0~10)를 입력합니다. RPE 는 운동 종료 30분 뒤 기억으로 매기는 것이 정석입니다.",
    "쉬는 날은 시간과 RPE 를 0 으로 둡니다 — 완전 휴식일 수 계산에 반영됩니다.",
    "지난 4주 평균 주간 부하를 알면 입력해 ACWR 을 함께 확인하세요.",
    "같은 근육군의 마지막 저항운동 날짜를 넣으면 48~72시간 회복 기준의 다음 가능일을 계산합니다.",
    "단조로움이 2.0 을 넘거나 ACWR 이 1.5 를 넘으면 강도를 낮춘 회복 주(디로드)를 고려하세요.",
  ],
  faq: [
    { q: "RPE 는 어떻게 매기나요?", a: "0(완전 휴식)~10(최대 노력)의 척도로 그 세션 전체의 체감 강도를 하나의 숫자로 표현합니다. 종료 직후보다 약 30분 뒤에 매기면 마지막 세트의 인상에 덜 좌우됩니다." },
    { q: "AU 단위는 무슨 뜻인가요?", a: "arbitrary unit(임의 단위)입니다. 절대적 의미는 없고 자신의 이전 주와 비교하는 상대 지표로 씁니다." },
    { q: "단조로움이 높으면 왜 위험한가요?", a: "매일 비슷한 중강도로만 훈련하면 회복 자극이 부족해집니다. 힘든 날은 더 힘들게, 쉬운 날은 더 쉽게(강약 대비를 크게) 배치하면 같은 총량에서도 단조로움이 낮아집니다." },
    { q: "ACWR 이 낮으면 좋은 건가요?", a: "꼭 그렇지는 않습니다. 0.8 미만은 훈련량이 급격히 줄어든 상태로, 체력 저하나 복귀 시 부상 위험과 연결될 수 있습니다. 0.8~1.3 구간을 참고 범위로 봅니다." },
    { q: "주당 완전 휴식일은 며칠이 적당한가요?", a: "주 1~2일이 널리 통용되는 코칭 관행이지만, 이 권고의 공신력 있는 단일 출처는 확정하지 못했습니다(확인 필요). 훈련 강도·경력·나이에 따라 달라지므로 참고 범위로만 쓰세요." },
    { q: "48시간 회복은 모든 운동에 적용되나요?", a: "ACSM 저항운동 지침의 '같은 근육군 사이 48시간' 권고를 기준으로 했습니다. 고강도 대근육 운동이나 근육통이 심한 경우 72시간 이상 걸릴 수도 있습니다." },
  ],
  sources: [
    { label: "Foster C 1998 — session-RPE, 단조로움·스트레인 (Med Sci Sports Exerc)", url: "https://pubmed.ncbi.nlm.nih.gov/9662687/" },
    { label: "Gabbett TJ 2016 — 급성:만성 부하비(ACWR)", url: "https://pubmed.ncbi.nlm.nih.gov/26758673/" },
    { label: "ACSM Position Stand 2009 — 저항운동 진행 모델(회복 48시간)", url: "https://pubmed.ncbi.nlm.nih.gov/19204579/" },
    { label: "TODO 확인 필요: 주당 완전 휴식일 1~2일 권고의 공신력 있는 단일 출처 미확정", url: "" },
  ],
  related: ["workout-log", "hr-zone", "interval"],
  external: [
    { name: "TomatoEggCat 홈트 루틴 추천", url: "https://tomatoeggcat.com/home-workout-routine/" },
    { name: "TomatoEggCat BMR·TDEE 계산기", url: "https://tomatoeggcat.com/bmr-tdee-calc/" },
  ],
  script: `import { SESSION_RPE, MONOTONY_WARN, MUSCLE_REST_H, ACWR_SWEET, WEEKLY_REST_DAYS } from "../data/restday.mjs";
import { $, showAd, fmt, todayStr } from "../assets/app.mjs";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DEFAULT_MIN = [60, 0, 60, 0, 60, 90, 0];
const DEFAULT_RPE = [7, 0, 6, 0, 8, 5, 0];

$("#dayRows").innerHTML = DAYS.map((d, i) =>
  '<div class="grid3" style="align-items:end"><div class="field"><label for="m' + i + '">' + d + "요일 시간(분)</label>" +
  '<input type="number" id="m' + i + '" inputmode="numeric" min="0" max="600" step="5" value="' + DEFAULT_MIN[i] + '" /></div>' +
  '<div class="field"><label for="e' + i + '">RPE (0~10)</label>' +
  '<input type="number" id="e' + i + '" inputmode="numeric" min="0" max="10" step="0.5" value="' + DEFAULT_RPE[i] + '" /></div></div>'
).join("");

function run() {
  const loads = [], mins = [], rpes = [];
  for (let i = 0; i < 7; i++) {
    const m = Math.max(0, parseFloat($("#m" + i).value) || 0);
    const e = Math.min(10, Math.max(0, parseFloat($("#e" + i).value) || 0));
    mins.push(m); rpes.push(e); loads.push(m * e);
  }
  const total = loads.reduce((a, b) => a + b, 0);
  if (total <= 0) { alert("최소 하루는 운동 시간과 RPE를 입력해 주세요."); return; }
  const mean = total / 7;
  const sd = Math.sqrt(loads.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 7);
  const mono = sd > 0 ? mean / sd : Infinity;
  const strain = total * (isFinite(mono) ? mono : 0);
  const restDays = loads.filter((l) => l === 0).length;
  const chronic = parseFloat($("#chronic").value);
  const acwr = isFinite(chronic) && chronic > 0 ? total / chronic : null;

  const flags = [];
  if (isFinite(mono) && mono > MONOTONY_WARN.value) flags.push("단조로움이 " + MONOTONY_WARN.value + " 초과");
  if (!isFinite(mono)) flags.push("매일 동일 부하(변화 없음)");
  if (acwr != null && acwr > 1.5) flags.push("ACWR 1.5 초과 — 부하 급증");
  if (acwr != null && acwr < ACWR_SWEET.value[0]) flags.push("ACWR " + ACWR_SWEET.value[0] + " 미만 — 부하 급감");
  if (restDays < WEEKLY_REST_DAYS.value[0]) flags.push("완전 휴식일 없음");

  $("#verdictOut").innerHTML = flags.length
    ? "⚠ 휴식·디로드를 고려하세요 <span class=\\"badge ref\\">참고</span>"
    : "✅ 이번 주 부하는 참고 범위 안입니다 <span class=\\"badge ref\\">참고</span>";
  $("#loadOut").textContent = fmt(total, 0) + " AU (" + SESSION_RPE.value + ")";
  $("#avgOut").textContent = fmt(mean, 0) + " AU / SD " + fmt(sd, 1);
  $("#monoOut").innerHTML = (isFinite(mono) ? fmt(mono, 2) : "∞") +
    (isFinite(mono) && mono <= MONOTONY_WARN.value ? ' <span class="badge ok">기준 이하</span>' : ' <span class="badge todo">기준 ' + MONOTONY_WARN.value + ' 초과</span>');
  $("#strainOut").textContent = isFinite(strain) ? fmt(strain, 0) : "-";
  $("#acwrOut").innerHTML = acwr == null
    ? "4주 평균 미입력 — 계산 생략"
    : fmt(acwr, 2) + (acwr >= ACWR_SWEET.value[0] && acwr <= ACWR_SWEET.value[1]
      ? ' <span class="badge ok">스위트 스팟 ' + ACWR_SWEET.value[0] + "~" + ACWR_SWEET.value[1] + "</span>"
      : ' <span class="badge todo">권장 ' + ACWR_SWEET.value[0] + "~" + ACWR_SWEET.value[1] + " 벗어남</span>");
  $("#restOut").innerHTML = restDays + "일 (관행 권고 " + WEEKLY_REST_DAYS.value[0] + "~" + WEEKLY_REST_DAYS.value[1] + "일 " +
    (WEEKLY_REST_DAYS.needsCheck ? '<span class="badge todo">확인 필요</span>' : "") + ")";
  const last = $("#lastLift").value;
  if (last) {
    const d = new Date(last + "T00:00:00");
    d.setHours(d.getHours() + MUSCLE_REST_H.value);
    $("#nextOut").textContent = todayStr(d) + " 이후 (" + MUSCLE_REST_H.value + "시간 회복 권고, 근육통 심하면 72시간)";
  } else {
    $("#nextOut").textContent = "마지막 운동일 미입력";
  }
  $("#dBody").innerHTML = DAYS
    .map((d, i) => "<tr><td>" + d + "</td><td class=\\"num\\">" + fmt(mins[i], 0) + "</td><td class=\\"num\\">" + fmt(rpes[i], 1) + "</td><td class=\\"num\\">" + fmt(loads[i], 0) + "</td></tr>")
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}
$("#calcBtn").addEventListener("click", run);`,
};
