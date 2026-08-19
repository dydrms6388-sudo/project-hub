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
