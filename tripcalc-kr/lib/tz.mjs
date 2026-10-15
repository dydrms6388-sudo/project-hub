// tripcalc-kr 시차 계산 — 하드코딩 금지, IANA 타임존 + Intl API 로만 계산한다.
// 서머타임(DST)은 Intl 이 tzdb 를 참조하므로 자동 반영된다.

/** 특정 시각에 해당 타임존의 UTC 오프셋(분). 예: Asia/Seoul → 540 */
export function offsetMinutes(timeZone, date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** 오프셋(분) → "+09:00" */
export function offsetLabel(min) {
  const s = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/** 두 타임존의 시차(시간, base 대비 target 이 얼마나 빠른가). 예: diffHours("Asia/Seoul","America/New_York") = -14 */
export function diffHours(baseTz, targetTz, date = new Date()) {
  return (offsetMinutes(targetTz, date) - offsetMinutes(baseTz, date)) / 60;
}

/** 시차 → "14시간 느림" / "1시간 빠름" / "시차 없음" */
export function diffLabel(h) {
  if (Math.abs(h) < 1e-9) return "시차 없음";
  const a = Math.abs(h);
  const hh = Math.floor(a);
  const mm = Math.round((a - hh) * 60);
  const t = (hh ? hh + "시간" : "") + (mm ? (hh ? " " : "") + mm + "분" : "");
  return `${t} ${h > 0 ? "빠름" : "느림"}`;
}

/** 해당 타임존의 현지 시각 문자열 */
export function localString(timeZone, date = new Date(), opts = {}) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", ...opts,
  }).format(date);
}

/** 해당 타임존의 현지 시각을 {y,m,d,h,mi,wd} 로 분해 */
export function localParts(timeZone, date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: p.weekday };
}

/** 현재 DST 적용 중인지(1월/7월 오프셋 비교로 판정) */
export function isDst(timeZone, date = new Date()) {
  const y = new Date(date).getUTCFullYear();
  const jan = offsetMinutes(timeZone, new Date(Date.UTC(y, 0, 15)));
  const jul = offsetMinutes(timeZone, new Date(Date.UTC(y, 6, 15)));
  return offsetMinutes(timeZone, date) > Math.min(jan, jul);
}

/**
 * 여러 도시의 겹치는 근무시간 찾기.
 * zones: [{tz, label}], work: {start, end} (현지 24시간 기준, end 는 미포함)
 * 기준일(dayDate) 의 UTC 0~23시 각각에 대해 모든 도시의 현지 시각을 구해 판정한다.
 * 반환: 24개 슬롯 [{utcHour, cells:[{h, wd, ok}], okCount, all}]
 */
export function overlapSlots(zones, work = { start: 9, end: 18 }, dayDate = new Date()) {
  const base = new Date(Date.UTC(
    dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), 0, 0, 0));
  const slots = [];
  for (let u = 0; u < 24; u++) {
    const t = new Date(base.getTime() + u * 3600000);
    const cells = zones.map((z) => {
      const p = localParts(z.tz, t);
      const weekend = p.wd === "Sat" || p.wd === "Sun";
      const inWork = p.h >= work.start && p.h < work.end;
      return { label: z.label, tz: z.tz, h: p.h, mi: p.mi, wd: p.wd, weekend, ok: inWork && !weekend, inWork };
    });
    const okCount = cells.filter((c) => c.ok).length;
    slots.push({ utcHour: u, at: t, cells, okCount, all: okCount === zones.length && zones.length > 0 });
  }
  return slots;
}

/** 겹치는 구간을 연속 블록으로 묶기 */
export function bestBlocks(slots) {
  const blocks = [];
  let cur = null;
  for (const s of slots) {
    if (s.all) { if (!cur) cur = { from: s, to: s, len: 1 }; else { cur.to = s; cur.len++; } }
    else if (cur) { blocks.push(cur); cur = null; }
  }
  if (cur) blocks.push(cur);
  return blocks.sort((a, b) => b.len - a.len);
}
