// billcalc-kr 공통 브라우저 헬퍼
import { TARIFF } from "../data/electric.mjs";

export const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
export const won = (n) => fmt(n) + "원";
export const kwhFmt = (n) => (Math.round(n * 10) / 10).toLocaleString("ko-KR") + " kWh";

/** 결과 하단 광고: 첫 결과 표시 시 1회만 노출·push */
export function showAd() {
  const w = document.getElementById("adWrap");
  if (!w || w.dataset.on) return;
  w.hidden = false;
  w.dataset.on = "1";
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
}

/** 테마 토글(로컬 저장) */
export function initTheme(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("bc-theme", next); } catch (e) {}
  });
}

/** 세그먼트 버튼 그룹 초기화: onChange(value) */
export function segInit(el, onChange) {
  const btns = [...el.querySelectorAll("button")];
  btns.forEach((b) => b.addEventListener("click", () => {
    btns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    onChange(b.dataset.v);
  }));
  return () => btns.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.v;
}

/** 전기요금 항목별 내역 테이블 HTML */
export function billTableHtml(r) {
  const seasonName = r.isSummer ? "하계(7~8월)" : "기타계절";
  let rows = "";
  rows += `<tr><td>기본요금 <span class="mut">(${r.tier}단계 · ${r.voltageLabel})</span></td><td></td><td>${won(r.base)}</td></tr>`;
  for (const s of r.steps) {
    rows += `<tr><td>전력량요금 ${s.label}</td><td class="mut">${(Math.round(s.kwh * 10) / 10).toLocaleString("ko-KR")}kWh × ${s.rate}원</td><td>${won(s.amount)}</td></tr>`;
  }
  rows += `<tr><td>기후환경요금</td><td class="mut">${fmt(r.kwh)}kWh × ${r.rates.climate}원</td><td>${won(r.climate)}</td></tr>`;
  rows += `<tr><td>연료비조정요금</td><td class="mut">${fmt(r.kwh)}kWh × ${r.rates.fuelAdj}원</td><td>${won(r.fuel)}</td></tr>`;
  rows += `<tr class="sum"><td>전기요금계</td><td></td><td>${won(r.subtotal)}</td></tr>`;
  rows += `<tr><td>부가가치세 <span class="mut">(10%, 원 미만 반올림)</span></td><td></td><td>${won(r.vat)}</td></tr>`;
  rows += `<tr><td>전력산업기반기금 <span class="mut">(${(r.rates.fundRate * 100).toFixed(1)}%, 10원 미만 절사)</span></td><td></td><td>${won(r.fund)}</td></tr>`;
  rows += `<tr class="sum"><td>예상 청구금액 <span class="mut">(10원 미만 절사)</span></td><td></td><td>${won(r.total)}</td></tr>`;
  return `<div class="tbl-scroll"><table class="tbl">
    <thead><tr><th>항목 <span class="mut">(${seasonName} · 누진 ${r.tier}단계)</span></th><th>계산</th><th>금액</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/** 요금표 출처·기준일 박스 HTML */
export function tariffSourceHtml() {
  const m = TARIFF.meta;
  return `<div class="srcbox"><strong>요금표 기준: ${m.revision}</strong> (주택용 전력)<br>
  누진 3단계·하계(7~8월) 구간 완화·기후환경요금 ${TARIFF.climate.value}원/kWh·연료비조정요금 ${TARIFF.fuelAdj.value}원/kWh 반영.
  연료비조정요금·기반기금 요율은 분기·연도별로 바뀔 수 있으니
  <a href="${m.source}" target="_blank" rel="noopener">한국전력 사이버지점 요금표</a>에서 최신 단가를 확인하세요.
  (데이터 확인일: ${m.checkedAt})</div>`;
}

/** 공용 광고 유닛 HTML (결과 하단 전용) */
export const AD_HTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-5567719201265106" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>`;

/** 숫자 입력값 파싱 */
export const num = (el, dflt = 0) => {
  const v = parseFloat(String(el.value).replace(/,/g, ""));
  return Number.isFinite(v) ? v : dflt;
};

/** "확인 필요" 배지 */
export const warnBadge = (t = "확인 필요") => `<span class="badge warn">${t}</span>`;

/** 증가액(누진 구간 이동) 비교 테이블 — ac-cost / appliance-cost 공용 */
export function deltaTableHtml(d, naive, label = "추가 기기") {
  const moved = d.tierMoved
    ? `<div class="alert">⚠ 누진 <strong>${d.before.tier}단계 → ${d.after.tier}단계</strong>로 올라갔습니다. 기본요금과 단가가 함께 뛰기 때문에 "사용량 × 단가"보다 실제 증가액이 큽니다.</div>`
    : `<div class="note">누진 단계는 ${d.before.tier}단계로 유지됩니다.</div>`;
  const gap = naive ? d.delta - naive.amount : 0;
  const naiveRow = naive
    ? `<tr><td>단순 곱셈 추정 <span class="mut">(${d.addKwh.toFixed(1)}kWh × ${naive.perKwh.toFixed(1)}원, ${naive.tier}단계 단가)</span></td><td>${won(naive.amount)}</td></tr>
       <tr class="sum"><td>누진 이동으로 인한 <strong>추가 부담</strong></td><td>${gap >= 0 ? "+" : ""}${won(gap)}</td></tr>`
    : "";
  return `${moved}<div class="tbl-scroll"><table class="tbl">
    <thead><tr><th>구분</th><th>금액</th></tr></thead><tbody>
    <tr><td>기존 사용량 <span class="mut">${kwhFmt(d.before.kwh)}</span> 청구액</td><td>${won(d.before.total)}</td></tr>
    <tr><td>${label} 포함 <span class="mut">${kwhFmt(d.after.kwh)}</span> 청구액</td><td>${won(d.after.total)}</td></tr>
    <tr class="sum"><td>실제 증가액 <span class="mut">(+${kwhFmt(d.addKwh)})</span></td><td>${won(d.delta)}</td></tr>
    <tr><td>1kWh당 실질 부담</td><td>${d.addKwh > 0 ? fmt(d.avgPerKwh) + "원" : "-"}</td></tr>
    ${naiveRow}
  </tbody></table></div>`;
}

/** 의존성 0 SVG 라인 차트. pts:[{x,y}], marks:[{x,y,label,color}] */
export function chartSvg({ pts, marks = [], w = 640, h = 280, xUnit = "kWh", yFmt = (v) => fmt(v / 10000) + "만원" }) {
  const pad = { l: 58, r: 18, t: 18, b: 40 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || 1;
  const y1 = Math.max(...ys) * 1.1 || 1;
  const X = (v) => pad.l + ((v - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const Y = (v) => h - pad.b - (v / y1) * (h - pad.t - pad.b);
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = (y1 / 4) * i, y = Y(v);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" stroke="var(--line2)" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${yFmt(v)}</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const v = x0 + ((x1 - x0) / 4) * i, x = X(v);
    grid += `<text x="${x.toFixed(1)}" y="${h - 14}" text-anchor="middle" font-size="11" fill="var(--muted)">${fmt(v)}</text>`;
  }
  grid += `<text x="${w - pad.r}" y="${h - 2}" text-anchor="end" font-size="11" fill="var(--muted)">사용량(${xUnit})</text>`;
  let mk = "";
  for (const m of marks) {
    const x = X(m.x), y = Y(m.y), c = m.color || "var(--acc)";
    mk += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${h - pad.b}" stroke="${c}" stroke-dasharray="3 3" stroke-width="1"/>`;
    mk += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${c}"/>`;
    mk += `<text x="${Math.min(x + 8, w - pad.r - 4).toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="${x > w * 0.7 ? "end" : "start"}" font-size="12" font-weight="700" fill="${c}">${m.label}</text>`;
  }
  return `<div class="chart-scroll"><svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="사용량별 예상 청구금액 곡선">
    ${grid}<path d="${line}" fill="none" stroke="var(--acc2)" stroke-width="2.5" stroke-linejoin="round"/>${mk}
  </svg></div>`;
}

/** 도시가스 출처·기준 안내 박스 */
export function gasSourceHtml(links = []) {
  const ls = links.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.name}</a>`).join(" · ");
  return `<div class="srcbox"><strong>도시가스 단가는 지역 도시가스사 고시값</strong>이라 전국 공통 단가가 없습니다.
  고지서의 "단가(원/MJ)"·"평균열량(MJ/㎥)"·"기본요금"을 그대로 입력하면 정확합니다.
  단위 환산(1kWh = 3.6MJ)은 국제 단위 정의값입니다.<br>${ls}</div>`;
}
