/* BabyCalc KR — 계산 공통 모듈 (브라우저 <script type="module"> + Node 테스트 공용, 의존성 0) */

/** 로컬 자정 기준 Date 생성 (YYYY-MM-DD 문자열 또는 y,m,d) */
export function mkDate(y, m, d) {
  if (typeof y === 'string') {
    const [yy, mm, dd] = y.split('-').map(Number);
    return new Date(yy, mm - 1, dd);
  }
  return new Date(y, m - 1, d);
}

/** date에 개월 수를 더한다. 말일은 해당 월 말일로 클램프 (1/31 +1개월 → 2/28·29) */
export function addMonths(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const d = date.getDate();
  const first = new Date(y, m, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d, lastDay));
}

/** 두 날짜 사이 일수 (to - from, 자정 기준) */
export function diffDays(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

/**
 * 개월수 계산: birth 기준 today 시점의 { months, days, totalDays, weeks, weekDays }
 * months = 만 개월수(달력 기준), days = 마지막 개월 기준일 이후 경과일.
 * 예) 1/31 출생, 3/1 → 1개월 1일 (1/31+1개월=2/28, 2/28→3/1 = 1일)
 */
export function babyAge(birth, today) {
  if (diffDays(birth, today) < 0) return null;
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  // 달력상 개월 경계: birth + months 가 today 를 넘으면 1 감소
  if (diffDays(addMonths(birth, months), today) < 0) months -= 1;
  // 말일 클램프로 인해 birth+months+1 이 이미 지난 경우 보정
  while (diffDays(addMonths(birth, months + 1), today) >= 0) months += 1;
  const days = diffDays(addMonths(birth, months), today);
  const totalDays = diffDays(birth, today);
  return {
    months,
    days,
    totalDays,
    weeks: Math.floor(totalDays / 7),
    weekDays: totalDays % 7,
  };
}

/** 교정연령(이른둥이): 출산예정일(dueDate)을 기준으로 계산한 나이 */
export function correctedAge(dueDate, today) {
  if (diffDays(dueDate, today) < 0) {
    // 아직 예정일 전 → 교정연령 0 이전
    return { months: 0, days: 0, totalDays: diffDays(dueDate, today), weeks: 0, weekDays: 0, beforeDue: true };
  }
  return { ...babyAge(dueDate, today), beforeDue: false };
}

/** LMS 공식 z점수: z = ((X/M)^L - 1) / (L*S), L=0이면 ln(X/M)/S */
export function zFromLMS(x, L, M, S) {
  if (!(x > 0) || !(M > 0) || !(S > 0)) return NaN;
  if (L === 0) return Math.log(x / M) / S;
  return (Math.pow(x / M, L) - 1) / (L * S);
}

/** z점수 → 측정값 X 역산: X = M * (1 + L*S*z)^(1/L) */
export function xFromZ(z, L, M, S) {
  if (L === 0) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/** 표준정규 누적분포 (Abramowitz-Stegun 근사, 오차 < 7.5e-8) */
export function normCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const az = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * az);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-az * az);
  return 0.5 * (1 + sign * y);
}

/** z → 백분위(%) */
export function percentileFromZ(z) {
  return normCdf(z) * 100;
}

/** 날짜 포맷 YYYY-MM-DD */
export function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 날짜 포맷 YYYY년 M월 D일 */
export function fmtDateKo(d) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** .ics 이벤트 목록 → ics 문자열 (종일 이벤트) */
export function buildIcs(calName, events) {
  const p = (n) => String(n).padStart(2, '0');
  const dt = (d) => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}00Z`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//babycalc-kr//KO', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  events.forEach((ev, i) => {
    const end = new Date(ev.date.getFullYear(), ev.date.getMonth(), ev.date.getDate() + 1);
    lines.push('BEGIN:VEVENT',
      `UID:babycalc-kr-${stamp}-${i}@babycalc-kr`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dt(ev.date)}`,
      `DTEND;VALUE=DATE:${dt(end)}`,
      `SUMMARY:${esc(ev.title)}`);
    if (ev.desc) lines.push(`DESCRIPTION:${esc(ev.desc)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
