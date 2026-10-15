/* jesa-date.js — 음력 기일 ↔ 양력 변환 + .ics 내보내기 (ES 모듈) */
import { solarToLunar, lunarToSolar, lunarMonthLength, leapMonthOf, dowOf, DOW_KR, KASI_URL, g2jdn, jdn2g } from "./lunar-core.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

const MODES = [
  { key: "s2l", name: "양력 날짜 → 음력 기일 확인" },
  { key: "l2s", name: "음력 기일 → 앞으로의 양력 날짜" },
];
let mode = "s2l";

function chips(box, list, cur, cb) {
  box.innerHTML = list.map((x) =>
    `<button class="chip${x.key === cur ? " on" : ""}" type="button" data-k="${x.key}">${esc(x.name)}</button>`).join("");
  box.onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) cb(b.dataset.k); };
}

const pad = (n) => String(n).padStart(2, "0");
const fmt = (o) => `${o.y}-${pad(o.m)}-${pad(o.d)}`;

function currentLunar() {
  if (mode === "s2l") {
    const v = $("#sdate").value;
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    const l = solarToLunar(y, m, d);
    if (!l) return null;
    return { month: l.month, day: l.day, leap: l.leap, from: { y, m, d }, lunarYear: l.year };
  }
  return {
    month: parseInt($("#lm").value, 10),
    day: parseInt($("#ld").value, 10),
    leap: $("#lleap").checked,
    from: null,
  };
}

function futureRows(base, years) {
  const now = new Date();
  const startY = now.getFullYear();
  const rows = [];
  for (let y = startY; y < startY + years; y++) {
    let note = "";
    let leapUsed = base.leap;
    let g = base.leap ? lunarToSolar(y, base.month, base.day, true) : null;
    if (base.leap && !g) {
      leapUsed = false;
      note = "그해에는 윤달이 없어 평달로 계산";
      g = lunarToSolar(y, base.month, base.day, false);
    }
    if (!g) g = lunarToSolar(y, base.month, base.day, false);
    if (!g) {
      const len = lunarMonthLength(y, base.month, false);
      if (len) {
        g = lunarToSolar(y, base.month, len, false);
        note = `그해 음력 ${base.month}월은 ${len}일까지라 마지막 날로 계산`;
      }
    }
    if (!g) { rows.push({ y, err: true }); continue; }
    const dow = DOW_KR[dowOf(g.y, g.m, g.d)];
    const eveJdn = g2jdn(g.y, g.m, g.d) - 1;
    const eve = jdn2g(eveJdn);
    const lm = leapMonthOf(y);
    rows.push({
      y, date: fmt(g), dow, eve: fmt(eve),
      note: note || (lm ? `이 해는 윤${lm}월이 있는 해` : ""),
      leapUsed,
    });
  }
  return rows;
}

function icsFor(base, rows, who) {
  const name = (who || "기일").trim() || "기일";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//familyday-kr//jesa-date//KO",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${name} (음력 ${base.leap ? "윤" : ""}${base.month}월 ${base.day}일)`,
  ];
  rows.filter((r) => !r.err).forEach((r) => {
    const dt = r.date.replace(/-/g, "");
    const end = (() => { const o = jdn2g(g2jdn(...r.date.split("-").map(Number)) + 1); return `${o.y}${pad(o.m)}${pad(o.d)}`; })();
    lines.push(
      "BEGIN:VEVENT",
      `UID:jesa-${base.month}-${base.day}-${r.y}@familyday-kr`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${name} (음력 ${base.leap ? "윤" : ""}${base.month}월 ${base.day}일)`,
      `DESCRIPTION:전통적으로는 기일 전날(${r.eve}) 밤 자시에 지냈습니다. 요즘은 전날 저녁이나 당일 저녁에 모이는 집이 많습니다.`,
      "BEGIN:VALARM", "TRIGGER:-P2D", "ACTION:DISPLAY", `DESCRIPTION:${name} 이틀 전`, "END:VALARM",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function render() {
  const base = currentLunar();
  const out = $("#out");
  if (!base) { out.innerHTML = `<div class="note">${mode === "s2l" ? "돌아가신 날(양력)을 입력하면 음력 기일과 앞으로의 제삿날이 나옵니다." : "음력 기일을 고르면 앞으로의 양력 날짜가 나옵니다."}</div>`; return; }

  const years = parseInt($("#yrs").value, 10) || 10;
  const rows = futureRows(base, years);
  const who = $("#who").value.trim();
  const label = `음력 ${base.leap ? "윤" : ""}${base.month}월 ${base.day}일`;

  out.innerHTML = `
<section class="result">
<div class="big">${esc(label)}</div>
<div class="sub">${base.from ? `양력 ${fmt(base.from)} = ${esc(label)} (${base.lunarYear}년)` : "이 기일을 기준으로 계산했습니다"}${who ? ` · ${esc(who)}` : ""}</div>
</section>
<section class="panel">
<h2 style="margin-top:0">앞으로 ${years}년간의 제삿날</h2>
<div class="tbwrap"><table class="tb"><thead><tr><th>연도</th><th>기일 (양력)</th><th>요일</th><th>기일 전날</th><th>참고</th></tr></thead>
<tbody>${rows.map((r) => r.err
    ? `<tr><td>${r.y}년</td><td colspan="4">계산할 수 없습니다</td></tr>`
    : `<tr><td>${r.y}년</td><td><b>${r.date}</b></td><td>${r.dow}</td><td>${r.eve}</td><td>${esc(r.note || "")}</td></tr>`).join("")}
</tbody></table></div>
<div class="btnrow">
<button class="btn" type="button" id="ics">📅 캘린더(.ics) 내려받기</button>
<button class="btn sec" type="button" id="cp">표 복사</button>
</div>
<p class="note">전통적으로는 <b>기일 전날 밤 자시(23~01시)</b>에 지냈습니다. 요즘은 전날 저녁이나 당일 저녁에 모이는 집이 많습니다. 어느 쪽이든 집안에서 이어 온 방식을 따르시면 됩니다.</p>
<p class="src">음양력 변환은 천문 계산(삭·태양 황경)을 한국 표준시 기준으로 재구성한 값입니다. 삭 시각이 자정에 매우 가까운 해에는 하루 차이가 날 수 있으니, 중요한 날짜는 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">한국천문연구원 음양력 변환기</a>로 한 번 더 확인하세요.</p>
</section>`;

  $("#ics").addEventListener("click", () => {
    FD.download(new Blob([icsFor(base, rows, who)], { type: "text/calendar;charset=utf-8" }), "jesa-" + base.month + "-" + base.day + ".ics");
    FD.toast("캘린더 파일을 저장했습니다");
  });
  $("#cp").addEventListener("click", () => {
    const txt = `${who ? who + " " : ""}기일 (${label})\n` +
      rows.filter((r) => !r.err).map((r) => `${r.y}년 ${r.date} (${r.dow}) · 전날 ${r.eve}`).join("\n");
    FD.copy(txt);
  });
}

function paint() {
  chips($("#mode"), MODES, mode, (k) => {
    mode = k;
    $("#panelA").hidden = k !== "s2l";
    $("#panelB").hidden = k !== "l2s";
    paint();
  });
  render();
}
["#sdate", "#lm", "#ld", "#lleap", "#who", "#yrs"].forEach((s) => {
  const el = $(s);
  el.addEventListener("change", render);
  el.addEventListener("input", render);
});
paint();
