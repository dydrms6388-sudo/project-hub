// cookcalc-kr 계산 엔진 (브라우저·테스트 공용, 의존성 0)
import { DENSITY, DENSITY_UNITS } from "../data/density.mjs";

/* ── 단위 정의 ─────────────────────────────────────────────── */
export const VOL_UNITS = {
  "컵": 200, "cup": 200, "공기": 200,
  "큰술": 15, "스푼": 15, "숟갈": 15, "테이블스푼": 15, "T": 15,
  "작은술": 5, "티스푼": 5, "t": 5,
  "ml": 1, "mL": 1, "밀리리터": 1, "cc": 1,
  "L": 1000, "l": 1000, "리터": 1000,
};
export const MASS_UNITS = { "g": 1, "그램": 1, "kg": 1000, "킬로그램": 1000 };
export const COUNT_UNITS = ["개", "알", "장", "대", "쪽", "톨", "줌", "봉지", "봉", "캔", "모", "마리", "조각", "포기", "단", "자밤", "꼬집"];

/** 계량 표기 정규화 (컵/큰술/작은술 → ml) */
export const unitMl = (u) => VOL_UNITS[u];
export const isVolUnit = (u) => Object.prototype.hasOwnProperty.call(VOL_UNITS, u);
export const isMassUnit = (u) => Object.prototype.hasOwnProperty.call(MASS_UNITS, u);

/* ── 밀도 조회 ─────────────────────────────────────────────── */
const norm = (s) => String(s).replace(/\s+/g, "").toLowerCase();
const DENS_MAP = new Map(DENSITY.map((d) => [norm(d.name), d]));

/** 재료명으로 밀도 항목 찾기 (정확 일치 → 부분 일치 중 가장 긴 이름) */
export function findDensity(name) {
  if (!name) return null;
  const k = norm(name);
  if (DENS_MAP.has(k)) return DENS_MAP.get(k);
  let best = null;
  for (const d of DENSITY) {
    const n = norm(d.name);
    if (n.length < 2) continue;
    if (k.includes(n) && (!best || n.length > norm(best.name).length)) best = d;
  }
  return best;
}

/** 부피(ml) → 무게(g) */
export const mlToGram = (ml, density) => ml * density;
/** 무게(g) → 부피(ml) */
export const gramToMl = (g, density) => g / density;

/** 수량+단위 → g (부피 단위는 밀도 필요, 질량 단위는 밀도 무관) */
export function toGram(qty, unit, density) {
  if (isMassUnit(unit)) return qty * MASS_UNITS[unit];
  if (isVolUnit(unit)) {
    if (!(density > 0)) return null;
    return qty * VOL_UNITS[unit] * density;
  }
  return null;
}

/** g → 지정 단위 수량 */
export function fromGram(g, unit, density) {
  if (isMassUnit(unit)) return g / MASS_UNITS[unit];
  if (isVolUnit(unit)) {
    if (!(density > 0)) return null;
    return g / density / VOL_UNITS[unit];
  }
  return null;
}

/** 한 재료의 전 단위 환산표 */
export function conversionTable(d) {
  const rows = [];
  for (const [key, u] of Object.entries(DENSITY_UNITS)) {
    rows.push({ key, name: u.name, ml: u.ml, gram: round(u.ml * d.value, 1) });
  }
  return rows;
}

export const round = (n, p = 0) => {
  const f = Math.pow(10, p);
  return Math.round(n * f) / f;
};

/* ── 수량 표기 파서 ────────────────────────────────────────── */
const KO_NUM = { "한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10, "반": 0.5 };
export const VAGUE_WORDS = ["약간", "조금", "적당량", "적당히", "취향껏", "기호에", "넉넉히", "살짝", "톡톡", "듬뿍", "한꼬집", "약간씩"];

const UNIT_ALT = [
  "밀리리터", "킬로그램", "테이블스푼", "티스푼", "작은술", "큰술", "숟갈", "스푼", "리터", "그램",
  "컵", "공기", "ml", "mL", "cc", "kg", "g", "L", "l", "T", "t",
].concat(COUNT_UNITS);
const UNIT_RE = UNIT_ALT.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const QTY_RE = "(?:\\d+(?:\\.\\d+)?\\s*(?:\\+|과|와)\\s*\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+(?:\\.\\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|반)";
const LINE_RE = new RegExp(`(${QTY_RE})\\s*(${UNIT_RE})?`);

function qtyValue(s) {
  const t = String(s).replace(/\s+/g, "");
  if (Object.prototype.hasOwnProperty.call(KO_NUM, t)) return KO_NUM[t];
  let m = t.match(/^(\d+(?:\.\d+)?)(?:\+|과|와)(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return Number(t);
}

/** 한 줄 파싱 → {raw,name,qty,unit,kind,vague} · 실패 시 kind:"text" */
export function parseLine(raw) {
  const src = String(raw).replace(/\s+/g, " ").trim();
  if (!src) return null;
  const line = src.replace(/^[-•*·▪◦]\s*/, "").replace(/^\d+[.)]\s+/, "").trim();
  const m = line.match(LINE_RE);
  const vague = VAGUE_WORDS.some((w) => line.includes(w));
  if (!m || (vague && !m[2])) {
    return { raw: src, name: line.replace(/[:：]\s*$/, ""), qty: null, unit: null, kind: vague ? "vague" : "text", vague };
  }
  const qty = qtyValue(m[1]);
  const unit = m[2] || "";
  if (!isFinite(qty)) return { raw: src, name: line, qty: null, unit: null, kind: "text", vague };
  const name = (line.slice(0, m.index) + " " + line.slice(m.index + m[0].length))
    .replace(/[:：,，]/g, " ").replace(/\s+/g, " ").trim();
  const kind = isVolUnit(unit) ? "vol" : isMassUnit(unit) ? "mass" : unit ? "count" : "num";
  return { raw: src, name: name || line, qty, unit, kind, vague: false };
}

/** 목록 문자열 파싱 */
export function parseList(text) {
  return String(text).split(/\r?\n/).map(parseLine).filter(Boolean);
}

/* ── 수량 표기 포맷 ────────────────────────────────────────── */
const FRACS = [[1 / 4, "1/4"], [1 / 3, "1/3"], [1 / 2, "1/2"], [2 / 3, "2/3"], [3 / 4, "3/4"]];
export function fmtQty(n) {
  if (!isFinite(n)) return "";
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-9) return String(r);
  const whole = Math.floor(n), frac = n - whole;
  for (const [v, s] of FRACS) {
    if (Math.abs(frac - v) < 0.008) return whole ? `${whole}+${s}` : s;
  }
  const d = Math.round(n * 100) / 100;
  return String(d);
}

/** 파싱 결과에 배수 적용 → {…, qty, text} */
export function scaleLine(p, factor) {
  if (!p) return null;
  if (p.qty == null) return { ...p, text: p.raw, scaled: false };
  const qty = p.qty * factor;
  const text = `${p.name} ${fmtQty(qty)}${p.unit}`.replace(/\s+/g, " ").trim();
  return { ...p, qty, text, scaled: true };
}

/** 목록 전체에 배수 적용 (+ 밀도 아는 재료는 g 병기) */
export function scaleList(text, factor) {
  return parseList(text).map((p) => {
    const s = scaleLine(p, factor);
    const d = p.kind === "vol" ? findDensity(p.name) : null;
    s.gram = d ? round(toGram(s.qty, s.unit, d.value), 1) : null;
    s.density = d || null;
    return s;
  });
}

/* ── 베이킹 팬 부피 ────────────────────────────────────────── */
/** 팬 1개의 내부 부피(ml = cm³). 원형은 지름 d·높이 h, 사각은 w×l×h */
export function panVolume(p) {
  const h = p.h;
  if (p.shape === "round") return Math.PI * Math.pow(p.d / 2, 2) * h;
  return p.w * p.l * h;
}
/** from 팬 레시피를 to 팬으로 옮길 때의 재료 배수 */
export function panRatio(from, to) {
  return panVolume(to) / panVolume(from);
}

/* ── 오븐 → 에어프라이어 변환 ──────────────────────────────── */
export function ovenToAir(temp, minutes, rule) {
  return {
    temp: Math.round((temp + rule.tempDelta.value) / 5) * 5,
    minMin: Math.round(minutes * rule.timeFactor.value * 0.9),
    minMax: Math.round(minutes * rule.timeFactor.value * 1.1),
    mid: Math.round(minutes * rule.timeFactor.value),
  };
}

/* ── 밥물 ──────────────────────────────────────────────────── */
export function riceWater(cups, type, cooker, soaked) {
  const riceMl = cups * 200;
  const ratio = soaked ? type.soaked : type.unsoaked;
  const waterMl = riceMl * ratio * cooker.factor;
  return { riceMl, riceG: Math.round(cups * 165), ratio, waterMl: Math.round(waterMl), waterCups: round(waterMl / 200, 2) };
}
