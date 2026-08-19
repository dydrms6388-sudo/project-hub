/* holiday-dday.js — 명절 D-day (ES 모듈) */
import { SEOLLAL, CHUSEOK, holidayRange, HOLIDAY_META } from "../../data/holidays.mjs";
import { dowOf, DOW_KR, KASI_URL } from "./lunar-core.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

const DEFS = {
  seollal: { name: "설날", emoji: "🧧", arr: SEOLLAL, lunar: "음력 1월 1일" },
  chuseok: { name: "추석", emoji: "🌕", arr: CHUSEOK, lunar: "음력 8월 15일" },
};
const PICKS = [
  { key: "all", name: "전체" },
  { key: "seollal", name: "🧧 설날" },
  { key: "chuseok", name: "🌕 추석" },
];
let pick = "all";

function todayUTC() {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}
function daysTo(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - todayUTC()) / 86400000);
}
function items() {
  const out = [];
  for (const [k, def] of Object.entries(DEFS)) {
    if (pick !== "all" && pick !== k) continue;
    for (const h of def.arr) out.push({ key: k, def, ...h });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
function plusDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function ics(list) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//familyday-kr//holiday//KO", "CALSCALE:GREGORIAN", "X-WR-CALNAME:명절 일정"];
  for (const it of list) {
    const r = holidayRange(it.date);
    L.push("BEGIN:VEVENT",
      `UID:hol-${it.key}-${it.year}@familyday-kr`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${r.prev.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${plusDay(r.next).replace(/-/g, "")}`,
      `SUMMARY:${it.def.name} 연휴 (${it.year})`,
      `DESCRIPTION:${it.def.name} 당일 ${it.date}. 대체공휴일은 정부 공고로 확정됩니다.${it.needsCheck ? " 이 날짜는 공식 확인이 필요합니다." : ""}`,
      "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

function render() {
  const list = items();
  const next = list.find((it) => daysTo(it.date) >= 0);
  let head;
  if (next) {
    const n = daysTo(next.date);
    const r = holidayRange(next.date);
    const [y, m, d] = next.date.split("-").map(Number);
    head = `<section class="result">
<div class="big">${next.def.emoji} ${n === 0 ? "오늘입니다" : "D-" + n}</div>
<div class="sub">${next.year}년 ${esc(next.def.name)} · ${next.date} (${DOW_KR[dowOf(y, m, d)]}요일)<br>연휴 ${r.prev} ~ ${r.next}${next.needsCheck ? ' <span class="badge warn">확인 필요</span>' : ""}</div>
</section>`;
  } else {
    head = `<div class="note">표에 담긴 연도의 명절이 모두 지났습니다.</div>`;
  }

  const rows = list.map((it) => {
    const n = daysTo(it.date);
    const r = holidayRange(it.date);
    const [y, m, d] = it.date.split("-").map(Number);
    return `<tr><td><a href="${it.key}/${it.year}/">${it.year} ${esc(it.def.name)}</a></td>
<td><b>${it.date}</b> (${DOW_KR[dowOf(y, m, d)]})</td>
<td>${r.prev} ~ ${r.next}</td>
<td>${n >= 0 ? "D-" + n : "지남"}</td>
<td>${it.needsCheck ? '<span class="badge warn">확인 필요</span>' : '<span class="badge ok">확인됨</span>'}</td></tr>`;
  }).join("");

  $("#out").innerHTML = `${head}
<section class="panel">
<h2 style="margin-top:0">연도별 명절 일정</h2>
<div class="tbwrap"><table class="tb">
<thead><tr><th>명절</th><th>당일</th><th>연휴(전날~다음 날)</th><th>남은 날</th><th>확인</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<div class="btnrow"><button class="btn" type="button" id="ics">📅 캘린더(.ics) 내려받기</button></div>
<p class="note"><span class="badge warn">확인 필요</span> 표시는 공식 음양력 변환으로 재확인하지 못한 날짜입니다. 확정 일정은 <a href="${KASI_URL}" target="_blank" rel="noopener nofollow">한국천문연구원 변환기</a>와 정부 공휴일 공고로 확인하세요.</p>
<p class="src">근거: ${esc(HOLIDAY_META.source)} · 확인일 ${esc(HOLIDAY_META.checkedAt)}</p>
</section>`;

  $("#ics").addEventListener("click", () => {
    FD.download(new Blob([ics(list)], { type: "text/calendar;charset=utf-8" }), "korean-holidays.ics");
    FD.toast("캘린더 파일을 저장했습니다");
  });
}

function paint() {
  $("#pick").innerHTML = PICKS.map((x) =>
    `<button class="chip${x.key === pick ? " on" : ""}" type="button" data-k="${x.key}">${esc(x.name)}</button>`).join("");
  render();
}
$("#pick").addEventListener("click", (e) => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  pick = b.dataset.k;
  paint();
});
paint();
