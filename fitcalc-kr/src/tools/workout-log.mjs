export default {
  slug: "workout-log",
  emoji: "📝",
  name: "운동 기록장 (주간 볼륨)",
  card: "세트를 기록하면 주간 총 볼륨을 그래프로. 브라우저에만 저장되고 CSV로 내보낼 수 있습니다.",
  title: "운동 기록장 — 주간 볼륨 그래프 + CSV 내보내기 (서버 저장 없음)",
  desc: "무게·반복·세트를 기록하면 총 볼륨(kg)을 자동 계산하고 최근 8주 주간 볼륨을 막대그래프로 보여줍니다. 데이터는 브라우저(localStorage)에만 저장되며 CSV 내보내기와 전체 삭제를 지원합니다.",
  lead: "무게 × 반복 × 세트 = 볼륨. 주간 추이를 그래프로 보고 CSV로 내보내세요. <b>서버 저장 없음</b>.",
  body: `
  <section class="tool">
    <h2>세트 기록 추가</h2>
    <div class="grid2">
      <div class="field">
        <label for="date">날짜</label>
        <input type="date" id="date" />
      </div>
      <div class="field">
        <label for="ex">운동명</label>
        <input type="text" id="ex" list="exList" placeholder="벤치프레스" value="벤치프레스" />
        <datalist id="exList">
          <option value="스쿼트"></option><option value="벤치프레스"></option><option value="데드리프트"></option>
          <option value="오버헤드프레스"></option><option value="바벨로우"></option><option value="랫풀다운"></option>
          <option value="레그프레스"></option><option value="풀업"></option><option value="딥스"></option>
        </datalist>
      </div>
    </div>
    <div class="grid3">
      <div class="field">
        <label for="w">무게 (kg)</label>
        <input type="number" id="w" inputmode="decimal" min="0" step="0.5" value="60" />
      </div>
      <div class="field">
        <label for="r">반복 (회)</label>
        <input type="number" id="r" inputmode="numeric" min="1" step="1" value="8" />
      </div>
      <div class="field">
        <label for="s">세트 (회)</label>
        <input type="number" id="s" inputmode="numeric" min="1" step="1" value="5" />
      </div>
    </div>
    <div class="btnrow">
      <button class="btn" id="addBtn" type="button">기록 추가</button>
      <button class="btn sub" id="csvBtn" type="button">CSV 내보내기</button>
      <button class="btn danger" id="clearBtn" type="button">전체 삭제</button>
    </div>
    <p class="hint" style="margin-top:10px">🔒 기록은 이 브라우저의 저장소(localStorage)에만 저장됩니다. <b>서버로 전송되지 않으며</b> 브라우저 데이터를 지우면 함께 사라집니다. 중요한 기록은 CSV 로 내보내 보관하세요.</p>
  </section>

  <section class="result" id="resultBox" hidden aria-live="polite">
    <h2>기록 요약</h2>
    <p class="big"><span id="totalOut">-</span> <small>kg 누적 볼륨</small></p>
    <div class="kv"><span class="k">이번 주 볼륨</span><span class="v" id="weekOut">-</span></div>
    <div class="kv"><span class="k">지난주 대비</span><span class="v" id="deltaOut">-</span></div>
    <div class="kv"><span class="k">기록 수 / 운동일</span><span class="v" id="cntOut">-</span></div>
    <h2 style="margin-top:18px">주간 볼륨 (최근 8주)</h2>
    <div class="chart-wrap" id="chartWrap"></div>
    <h2 style="margin-top:18px">기록 목록</h2>
    <div class="rt-scroll">
      <table class="rt">
        <thead><tr><th>날짜</th><th>운동</th><th class="num">무게</th><th class="num">반복</th><th class="num">세트</th><th class="num">볼륨</th><th></th></tr></thead>
        <tbody id="lBody"></tbody>
      </table>
    </div>
  </section>`,
  intro: `<p>근력 훈련의 진척은 한 세트 무게보다 <b>총 볼륨</b>(무게 × 반복 × 세트)의 흐름에서 더 잘 드러납니다. 무게가 그대로여도 반복이나 세트가 늘면 볼륨은 증가하고, 그 누적이 근비대의 주요 동력이기 때문입니다.</p>
    <p>이 기록장은 세트를 입력하면 볼륨을 자동 계산하고, 최근 8주의 주간 볼륨을 막대그래프(SVG)로 그립니다. 지난주 대비 증감이 표시되므로 과도한 점프(부상 위험)나 정체를 바로 알아볼 수 있습니다.</p>
    <p>계정도, 서버도 없습니다. 모든 데이터는 브라우저의 localStorage 에만 남고, 언제든 CSV 로 내보내거나 전체 삭제할 수 있습니다.</p>`,
  howto: [
    "날짜·운동명·무게·반복·세트를 넣고 <b>기록 추가</b>를 누릅니다.",
    "볼륨(kg)은 무게 × 반복 × 세트로 자동 계산됩니다. 맨몸 운동은 무게 0 으로 두면 횟수만 집계됩니다.",
    "주간 볼륨 그래프에서 최근 8주 흐름을 확인합니다. 주는 월요일 시작 기준입니다.",
    "<b>CSV 내보내기</b>로 엑셀·구글 시트에 옮겨 장기 보관하세요 (한글 깨짐 방지 BOM 포함).",
    "기기를 바꾸거나 브라우저 데이터를 지우면 기록이 사라지므로 정기적으로 내보내는 것을 권합니다.",
  ],
  faq: [
    { q: "기록이 서버에 저장되나요?", a: "아니요. 이 사이트는 계정·백엔드가 없습니다. 기록은 브라우저 localStorage 에만 저장되며 어디로도 전송되지 않습니다." },
    { q: "다른 기기에서도 볼 수 있나요?", a: "볼 수 없습니다. 브라우저별로 저장되므로 기기·브라우저가 바뀌면 기록도 달라집니다. CSV 내보내기로 옮기세요." },
    { q: "볼륨은 어떻게 계산되나요?", a: "무게(kg) × 반복 × 세트 입니다. 예를 들어 60kg × 8회 × 5세트 = 2,400kg 입니다. 종목이 달라도 단순 합산하므로 절대값보다 추세 비교에 쓰는 것이 좋습니다." },
    { q: "주간 볼륨을 얼마나 늘려야 하나요?", a: "일반적으로 급격한 증가는 부상 위험을 높입니다. 주 단위 증가를 완만하게 유지하고, 피로가 쌓이면 휴식일 계산기(session-RPE 주간 부하)로 부하를 점검하세요." },
    { q: "CSV 를 엑셀에서 열면 한글이 깨집니다.", a: "이 도구는 UTF-8 BOM 을 붙여 내보내므로 대부분의 엑셀 버전에서 바로 열립니다. 그래도 깨진다면 엑셀의 '데이터 → 텍스트/CSV 가져오기'에서 UTF-8 을 지정하세요." },
  ],
  sources: [
    { label: "훈련 볼륨(무게×반복×세트) 개념 — Strength training", url: "https://en.wikipedia.org/wiki/Strength_training" },
    { label: "MDN — Window.localStorage (브라우저 저장, 서버 전송 없음)", url: "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage" },
  ],
  related: ["one-rm", "rest-day", "protein-timing"],
  external: [
    { name: "TomatoEggCat 1RM 랭킹", url: "https://tomatoeggcat.com/lift-rank-1rm/" },
    { name: "TomatoEggCat 홈트 루틴 추천", url: "https://tomatoeggcat.com/home-workout-routine/" },
  ],
  script: `import { $, showAd, fmt, store, downloadText, todayStr, esc } from "../assets/app.mjs";

const KEY = "fitcalc-workout-log-v1";
let rows = store.get(KEY, []);
$("#date").value = todayStr();

function mondayOf(dstr) {
  const d = new Date(dstr + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - day);
  return todayStr(d);
}

function weekly(n) {
  const weeks = [];
  const base = new Date(mondayOf(todayStr()) + "T00:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i * 7);
    weeks.push({ key: todayStr(d), vol: 0 });
  }
  const map = new Map(weeks.map((w) => [w.key, w]));
  for (const r of rows) { const w = map.get(mondayOf(r.date)); if (w) w.vol += r.vol; }
  return weeks;
}

function chart(weeks) {
  const W = 640, H = 220, PL = 52, PR = 12, PT = 14, PB = 34;
  const max = Math.max(1, ...weeks.map((w) => w.vol));
  const bw = (W - PL - PR) / weeks.length;
  let g = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="최근 8주 주간 볼륨 막대그래프">';
  for (let i = 0; i <= 4; i++) {
    const y = PT + ((H - PT - PB) * i) / 4;
    const v = max * (1 - i / 4);
    g += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="currentColor" stroke-opacity="0.14" />';
    g += '<text x="' + (PL - 6) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" text-anchor="end" fill="currentColor" fill-opacity="0.55">' + fmt(v, 0) + '</text>';
  }
  weeks.forEach((w, i) => {
    const h = ((H - PT - PB) * w.vol) / max;
    const x = PL + i * bw + bw * 0.18;
    const y = H - PB - h;
    g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="3" fill="var(--acc2)"><title>' + w.key + " · " + fmt(w.vol, 0) + 'kg</title></rect>';
    if (w.vol > 0) g += '<text x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" font-size="10" text-anchor="middle" fill="currentColor" fill-opacity="0.7">' + fmt(w.vol, 0) + '</text>';
    g += '<text x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (H - PB + 16) + '" font-size="10" text-anchor="middle" fill="currentColor" fill-opacity="0.55">' + w.key.slice(5) + '</text>';
  });
  g += '<line x1="' + PL + '" y1="' + (H - PB) + '" x2="' + (W - PR) + '" y2="' + (H - PB) + '" stroke="currentColor" stroke-opacity="0.35" />';
  g += "</svg>";
  return g;
}

function render() {
  if (!rows.length) { $("#resultBox").hidden = true; return; }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = rows.reduce((a, r) => a + r.vol, 0);
  const weeks = weekly(8);
  const cur = weeks[weeks.length - 1].vol, prev = weeks[weeks.length - 2].vol;
  $("#totalOut").textContent = fmt(total, 0);
  $("#weekOut").textContent = fmt(cur, 0) + " kg";
  $("#deltaOut").textContent = prev > 0 ? (cur >= prev ? "+" : "") + fmt(((cur - prev) / prev) * 100, 1) + "% (지난주 " + fmt(prev, 0) + "kg)" : "비교할 지난주 기록 없음";
  $("#cntOut").textContent = rows.length + "건 / " + new Set(rows.map((r) => r.date)).size + "일";
  $("#chartWrap").innerHTML = chart(weeks);
  $("#lBody").innerHTML = rows
    .map((r, i) => "<tr><td>" + r.date + "</td><td>" + esc(r.ex) + "</td><td class='num'>" + fmt(r.w, 1) + "</td><td class='num'>" + r.r + "</td><td class='num'>" + r.s + "</td><td class='num'>" + fmt(r.vol, 0) + "</td><td><button class='btn sub small' data-del='" + i + "' type='button'>삭제</button></td></tr>")
    .join("");
  $("#resultBox").hidden = false;
  showAd();
}

$("#addBtn").addEventListener("click", () => {
  const date = $("#date").value || todayStr();
  const ex = ($("#ex").value || "").trim() || "이름 없음";
  const w = parseFloat($("#w").value) || 0;
  const r = parseInt($("#r").value, 10);
  const s = parseInt($("#s").value, 10);
  if (!isFinite(r) || r < 1 || !isFinite(s) || s < 1) { alert("반복과 세트를 확인해 주세요."); return; }
  rows.push({ date: date, ex: ex, w: w, r: r, s: s, vol: w * r * s });
  store.set(KEY, rows);
  render();
});

$("#lBody").addEventListener("click", (e) => {
  const i = e.target && e.target.dataset ? e.target.dataset.del : null;
  if (i == null) return;
  rows.splice(parseInt(i, 10), 1);
  store.set(KEY, rows);
  render();
});

$("#csvBtn").addEventListener("click", () => {
  if (!rows.length) { alert("내보낼 기록이 없습니다."); return; }
  const head = "날짜,운동,무게(kg),반복,세트,볼륨(kg)";
  const body = rows.map((r) => [r.date, '"' + String(r.ex).replace(/"/g, '""') + '"', r.w, r.r, r.s, r.vol].join(",")).join("\\n");
  downloadText("fitcalc-workout-log-" + todayStr() + ".csv", head + "\\n" + body, "text/csv");
});

$("#clearBtn").addEventListener("click", () => {
  if (!rows.length) return;
  if (!confirm("모든 운동 기록을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
  rows = [];
  store.del(KEY);
  $("#resultBox").hidden = true;
});

render();`,
};
