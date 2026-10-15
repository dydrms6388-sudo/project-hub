// tripcalc-kr 환율 모듈 — 이 사이트에서 네트워크를 쓰는 유일한 부분.
// 정책: 키가 필요 없고 CORS 를 허용하는 공개 API 만 사용한다. 서버·프록시 없음.
//  1) 기본:  https://api.frankfurter.dev/v1/latest   (Frankfurter, 유럽중앙은행 기준환율, 키 불필요·CORS 허용)
//  2) 보조:  https://open.er-api.com/v6/latest/<BASE> (ExchangeRate-API 무료 공개 엔드포인트, 키 불필요·CORS 허용)
//  3) 실패 시: localStorage 24시간 캐시(만료된 캐시 포함)의 마지막 값을 "오래된 값" 표시와 함께 사용
//  4) 캐시도 없으면: 숫자를 지어내지 않고 안내 메시지만 노출한다.
// 표시 문구: "참고용이며 은행 고시 환율이 아닙니다."

export const FX_PRIMARY = "https://api.frankfurter.dev/v1/latest";
export const FX_FALLBACK = "https://open.er-api.com/v6/latest/";
export const FX_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
export const FX_CACHE_KEY = "tc-fx-v1";
export const FX_DISCLAIMER = "환율은 참고용이며 은행 고시 환율이 아닙니다. 실제 환전 시에는 스프레드·수수료가 더해집니다.";

/** Frankfurter 가 지원하는 통화(2026-08-19 확인) — 그 외 통화는 보조 API 로만 조회된다. */
export const FRANKFURTER_CODES = ["AUD","BGN","BRL","CAD","CHF","CNY","CZK","DKK","EUR","GBP","HKD","HUF","IDR","ILS","INR","ISK","JPY","KRW","MXN","MYR","NOK","NZD","PHP","PLN","RON","SEK","SGD","THB","TRY","USD","ZAR"];

function readCache() {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.rates || !o.base) return null;
    return o;
  } catch (e) { return null; }
}

function writeCache(o) {
  try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify(o)); } catch (e) { /* 저장 실패는 무시 */ }
}

/** 캐시 비우기 */
export function clearFxCache() {
  try { localStorage.removeItem(FX_CACHE_KEY); } catch (e) {}
}

async function fetchPrimary(base) {
  const res = await fetch(`${FX_PRIMARY}?base=${encodeURIComponent(base)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("primary " + res.status);
  const j = await res.json();
  if (!j || !j.rates) throw new Error("primary shape");
  return { base, rates: { ...j.rates, [base]: 1 }, date: j.date || "", src: "Frankfurter (ECB 기준환율)" };
}

async function fetchFallback(base) {
  const res = await fetch(FX_FALLBACK + encodeURIComponent(base), { cache: "no-store" });
  if (!res.ok) throw new Error("fallback " + res.status);
  const j = await res.json();
  if (!j || !j.rates) throw new Error("fallback shape");
  const date = (j.time_last_update_utc || "").slice(5, 16) || "";
  return { base, rates: { ...j.rates, [base]: 1 }, date, src: "ExchangeRate-API (공개 엔드포인트)" };
}

/**
 * 환율 테이블을 가져온다. 절대 예외를 던지지 않고 항상 상태 객체를 돌려준다.
 * 반환: { ok, stale, rates, base, date, src, fetchedAt, message }
 *  - ok:true  → 사용 가능한 환율(신선하거나 캐시)
 *  - stale:true → 네트워크 실패로 만료된 캐시를 쓰는 중
 *  - ok:false → 캐시도 없음. rates 없음, message 안내만.
 */
export async function getRates(base = "KRW", { force = false, now = Date.now() } = {}) {
  const cached = readCache();
  const fresh = cached && cached.base === base && now - (cached.fetchedAt || 0) < FX_TTL_MS;
  if (fresh && !force) {
    return { ok: true, stale: false, cached: true, ...cached, message: "" };
  }
  if (typeof fetch !== "function") {
    return offline(cached, base);
  }
  try {
    let data;
    try { data = await fetchPrimary(base); }
    catch (e1) { data = await fetchFallback(base); }
    const out = { ...data, fetchedAt: now };
    writeCache(out);
    return { ok: true, stale: false, cached: false, ...out, message: "" };
  } catch (e) {
    return offline(cached, base);
  }
}

function offline(cached, base) {
  if (cached && cached.base === base) {
    return {
      ok: true, stale: true, cached: true, ...cached,
      message: "환율 서버에 연결하지 못해 마지막으로 받아온 환율을 표시합니다.",
    };
  }
  return {
    ok: false, stale: true, rates: null, base, date: "", src: "",
    message: "환율을 불러오지 못했고 저장된 값도 없습니다. 네트워크 상태를 확인한 뒤 다시 시도하거나, 환율을 직접 입력해 계산하세요.",
  };
}

/** rates(base 기준) 에서 from→to 환율 계산 */
export function rateOf(state, from, to) {
  if (!state || !state.ok || !state.rates) return null;
  const r = state.rates;
  const b = state.base;
  const rf = from === b ? 1 : r[from];
  const rt = to === b ? 1 : r[to];
  if (!rf || !rt) return null;
  return rt / rf;
}

/** 금액 환산 */
export function convert(state, amount, from, to) {
  const r = rateOf(state, from, to);
  return r == null ? null : amount * r;
}

/** 통화별 표시 소수 자리(원화·엔화 등 소수 없는 통화 처리) */
const ZERO_DECIMAL = new Set(["KRW", "JPY", "VND", "IDR", "CLP", "HUF", "ISK", "TWD", "MNT", "LAK", "KHR", "COP", "PYG"]);
export function fxFmt(v, code) {
  if (v == null || !isFinite(v)) return "-";
  const d = ZERO_DECIMAL.has(code) ? 0 : Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 1 ? 2 : 4;
  return v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** 캐시 시각 표시 */
export function fetchedLabel(state) {
  if (!state || !state.fetchedAt) return "";
  const d = new Date(state.fetchedAt);
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
