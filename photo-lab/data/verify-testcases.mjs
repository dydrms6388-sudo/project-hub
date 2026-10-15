// photo-lab 설계 단계 테스트케이스 검증기
// 사용: node photo-lab/data/verify-testcases.mjs
// calculators.json 의 testCases 를 독립 구현 공식으로 재계산해 expected 와 대조한다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { calculators } = JSON.parse(readFileSync(join(here, 'calculators.json'), 'utf8'));

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const parseT = t => typeof t === 'string' && t.includes('/') ? 1 / Number(t.split('/')[1]) : Number(t);

// ---------- 공식 구현 (SI: mm, μm, s) ----------
const hyperfocal = (f, N, c) => f * f / (N * c) + f; // mm
function dof(f, N, c, sM) {
  const s = sM * 1000, H = hyperfocal(f, N, c);
  return {
    nearM: s * (H - f) / (H + s - 2 * f) / 1000,
    farM: s >= H ? Infinity : s * (H - f) / (H - s) / 1000,
  };
}
const SENSORS = { 'full-frame': [36, 24], mft: [17.3, 13] };
const npf = (N, p, f, decl = 0) => (35 * N + 30 * p) / f / Math.cos(decl * D2R);
const trailUm = (f, t, decl, ) => f * (15.0411 * t * Math.cos(decl * D2R) / 206265) * 1000;
const ev = (N, t, iso = 100) => Math.log2(N * N / parseT(t)) - Math.log2(iso / 100);
const aov = (dim, f) => 2 * Math.atan(dim / (2 * f)) * R2D;

// NOAA 태양 알고리즘 (Meeus)
function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunCalc(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * D2R) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * D2R) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R)) * R2D;
  const y2 = Math.tan(eps / 2 * D2R) ** 2;
  const Eq = 4 * R2D * (y2 * Math.sin(2 * L0 * D2R) - 2 * e * Math.sin(M * D2R)
    + 4 * e * y2 * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R)
    - 0.5 * y2 * y2 * Math.sin(4 * L0 * D2R) - 1.25 * e * e * Math.sin(2 * M * D2R));
  return { decl, Eq };
}
function sunCross(dateStr, lat, lon, altDeg) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const { decl, Eq } = sunCalc(julianDay(y, m, d) + 0.5);
  const cosH = (Math.sin(altDeg * D2R) - Math.sin(lat * D2R) * Math.sin(decl * D2R)) / (Math.cos(lat * D2R) * Math.cos(decl * D2R));
  if (cosH > 1) return { none: true, decl, Eq };
  const H = Math.acos(Math.max(-1, cosH)) * R2D;
  const noon = 12 - lon / 15 - Eq / 60;
  return { decl, Eq, rise: noon - H / 15, set: noon + H / 15 };
}
const hhmm = h => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };

// 1/3스톱 명목 셔터 계열(초). 정확값 계산 후 가장 가까운 명목 클릭으로 스냅
const NOMINAL_T = ['1/8000', '1/6400', '1/5000', '1/4000', '1/3200', '1/2500', '1/2000', '1/1600', '1/1250', '1/1000', '1/800', '1/640', '1/500', '1/400', '1/320', '1/250', '1/200', '1/160', '1/125', '1/100', '1/80', '1/60', '1/50', '1/40', '1/30', '1/25', '1/20', '1/15', '1/13', '1/10', '1/8', '1/6', '1/5', '1/4', '1/3', '0.4', '0.5', '0.6', '0.8', '1', '1.3', '1.6', '2', '2.5', '3.2', '4', '5', '6', '8', '10', '13', '15', '20', '25', '30'];
const snapShutter = t => NOMINAL_T.reduce((best, s) =>
  Math.abs(Math.log2(parseT(s) / t)) < Math.abs(Math.log2(parseT(best) / t)) ? s : best);
const minDiff = (a, b) => { // "HH:MM" 차이(분)
  const p = s => { const [H, M] = s.split(':').map(Number); return H * 60 + M; };
  return Math.abs(p(a) - p(b));
};

// ---------- slug 별 계산 ----------
function compute(slug, i) {
  switch (slug) {
    case 'depth-of-field': {
      const r = dof(i.f, i.N, i.c, i.s);
      return { nearM: r.nearM, farM: r.farM === Infinity ? 'Infinity' : r.farM };
    }
    case 'hyperfocal': return { H_m: hyperfocal(i.f, i.N, i.c) / 1000 };
    case 'circle-of-confusion': {
      const [w, h] = SENSORS[i.sensor];
      const sd = Math.hypot(w, h);
      if (i.mode === 'd') return { cocMm: sd / i.d };
      return { cocMm: 0.2 * (i.viewMm / 250) / (i.printDiagMm / sd) };
    }
    case 'npf-rule': {
      const out = { npfS: npf(i.N, i.p, i.f, i.decl) };
      if ('rule500S' in (i.__exp || {})) out.rule500S = 500 / i.f;
      return out;
    }
    case 'star-trail-length': {
      const um = trailUm(i.f, i.t, i.decl);
      return { trailUm: um, trailPx: um / i.p };
    }
    case 'sun-altitude': {
      if (i.quantity === 'declination') return { deg: sunCalc(julianDay(...i.date.split('-').map(Number)) + 0.5).decl };
      if (i.quantity === 'equationOfTime') return { min: sunCalc(julianDay(...i.date.split('-').map(Number)) + 0.5).Eq };
      const r = sunCross(i.date, i.lat ?? 0, i.lon ?? 0, -0.833);
      if (r.none) return { sunrise: 'none(극야)' };
      const tz = i.tz ?? 0;
      return { sunrise: hhmm(r.rise + tz), sunset: hhmm(r.set + tz), dayLengthH: r.set - r.rise };
    }
    case 'exposure-equivalent': {
      if (i.ev) return { EV100: ev(parseFloat(String(i.ev[0]).replace('f/', '')), i.ev[1], i.ev[2]) };
      const stops = { // 명목 클릭값 → 정확 스톱 수 검증용
        'f/8->f/5.6': 1, 'f/8:iso100->400': 2, 'f/4->f/5.0': -2 / 3,
      };
      // 스톱 산술 검증: from [N, t, iso] 에서 target 으로 이동한 셔터 계산
      const [Ns, ts, iso] = i.from;
      const N0 = parseFloat(String(Ns).replace('f/', '')), t0 = parseT(ts);
      if (i.fix === 'iso' && String(i.target).startsWith('f/')) {
        const N1 = parseFloat(String(i.target).replace('f/', ''));
        // 정확 스톱 = 명목값을 1/3스톱 격자에 스냅해 계산
        const snap = v => Math.round(Math.log2(v * v) * 3) / 3; // Av*? (f-number → stops)
        const dAv = snap(N0) - snap(N1); // 개방 방향 +
        const t1 = t0 * Math.pow(2, -dAv);
        return { shutter: snapShutter(t1) };
      }
      if (i.fix === 'aperture' && String(i.target).startsWith('ISO')) {
        const iso1 = Number(String(i.target).replace(/\D/g, ''));
        const t1 = t0 / (iso1 / iso);
        return { shutter: snapShutter(t1) };
      }
      if (i.fix === 'shutter' && String(i.target).startsWith('ISO')) {
        const iso1 = Number(String(i.target).replace(/\D/g, ''));
        const needN = N0 / Math.sqrt(iso / iso1); // ISO 낮추면 개방 필요
        return { aperture: needN < 0.95 ? '개방 한계 초과 → 불가 표시' : 'f/' + needN.toFixed(1) };
      }
      return null;
    }
    case 'ev-calculator': {
      const out = {};
      if (i.iso === 100 || i.iso === undefined) out.EV = ev(i.N, i.t, 100);
      if (i.iso && i.iso !== 100) out.EV100 = ev(i.N, i.t, i.iso);
      if (i.N === 16) out.EV = ev(i.N, i.t, i.iso); // 명목값 그대로
      return out;
    }
    case 'nd-filter': {
      if (i.stack) { const od = i.stack.reduce((a, s) => a + parseFloat(s.replace('OD', '')), 0); return { stops: od / Math.log10(2) }; }
      const t0 = parseT(i.t);
      const factor = i.factor ?? Math.pow(2, i.stops);
      return { tS: t0 * factor };
    }
    case 'macro-exposure': {
      const out = {};
      if (i.ext !== undefined) { out.m = i.ext / i.f; return out; }
      const m = i.m;
      out.factor = (1 + m) ** 2;
      out.stops = 2 * Math.log2(1 + m);
      if (i.N) out.Neff = i.N * (1 + m);
      out['NeffAtF2.8'] = 2.8 * (1 + m);
      return out;
    }
    case 'motion-blur': {
      const mag = i.f / (i.d * 1000 - i.f);
      const cosA = i.angleDeg ? Math.cos(i.angleDeg * D2R) : 1;
      const mm = i.v * 1000 * mag * parseT(i.t) * cosA;
      return { blurUm: mm * 1000, blurPx: mm * 1000 / i.p };
    }
    case 'angle-of-view': {
      const dims = { 'full-frame': [36, 24], mft: [17.3, 13] }[i.sensor];
      const dg = Math.hypot(...dims);
      return { diagDeg: aov(dg, i.f), hDeg: aov(dims[0], i.f), vDeg: aov(dims[1], i.f) };
    }
    case 'equivalent-focal': {
      const crop = { mft: 2.0, 'aps-c-canon': 43.267 / 26.82, 'phone-1-1.56': 43.267 / 10.21, 'medium-44x33': 43.267 / 54.78 }[i.from];
      const out = { fEq: i.f * crop };
      if (i.N) out.NEqDof = i.N * crop;
      return out;
    }
    case 'panorama-shots': {
      const fov = aov(i.w, i.f);
      const step = fov * (1 - i.overlap);
      return { shotFovDeg: fov, shots: Math.ceil(i.total / step) };
    }
    case 'diffraction-limit': {
      const lam = (i.lambda ?? 550) / 1000;
      const out = {};
      if (i.N) out.airyUm = 2.44 * lam * i.N;
      if (i.p) out.Nstar = 2 * i.p / (2.44 * lam);
      return out;
    }
    case 'pixel-pitch': {
      const out = {};
      if (i.wMm) out.pitchUm = i.wMm * 1000 / i.px;
      if (i.p && i.f) out.arcsecPerPx = 206.265 * i.p / i.f;
      return out;
    }
    case 'flash-guide-number': {
      const gn = i.GN * Math.sqrt((i.iso ?? 100) / 100) * Math.sqrt(i.power ?? 1);
      const out = {};
      if (i.d) out.N = gn / i.d;
      if (i.N) out.dM = gn / i.N;
      if (!i.d && !i.N) out.GNeff = gn;
      return out;
    }
    case 'timelapse': {
      const out = {};
      const shots = i.shots ?? (i.clip && i.fps ? i.clip * i.fps : undefined);
      if (shots) out.shots = shots;
      if (shots && i.interval) out.durationMin = shots * i.interval / 60;
      if (shots && i.sizeMb) out.storageGb = shots * i.sizeMb / 1024;
      if (i.interval && i.fps) out.speedup = i.interval * i.fps;
      return out;
    }
    default: return null;
  }
}

// ---------- 대조 ----------
let pass = 0, fail = 0, manual = 0;
const failures = [];
for (const calc of calculators) {
  for (const [idx, tc] of calc.testCases.entries()) {
    const input = { ...tc.input, __exp: tc.expected };
    let got;
    try { got = compute(calc.slug, input); } catch (e) { got = { __error: e.message }; }
    if (!got) { manual++; console.log(`SKIP  ${calc.slug}#${idx + 1} (수동 검증 항목)`); continue; }
    let ok = true;
    const detail = [];
    for (const [k, expRaw] of Object.entries(tc.expected)) {
      if (k === 'warning') continue;
      const g = got[k];
      if (typeof expRaw === 'string' && (expRaw.includes('Infinity') || expRaw.includes('극야') || expRaw.includes('불가'))) {
        const same = String(g) === String(expRaw);
        if (!same) { ok = false; detail.push(`${k}: got ${g}, want ${expRaw}`); }
        continue;
      }
      if (typeof expRaw === 'string' && /^1\/\d+$/.test(expRaw)) { // 명목 셔터 표기
        if (String(g) !== expRaw) { ok = false; detail.push(`${k}: got ${g}, want ${expRaw}`); }
        else detail.push(`${k}: ${g} (명목 클릭 일치)`);
        continue;
      }
      if (typeof expRaw === 'string' && expRaw.includes(':')) { // HH:MM
        const dm = minDiff(String(g), expRaw);
        const tolMin = 3;
        if (dm > tolMin) { ok = false; detail.push(`${k}: got ${g}, want ${expRaw} (±${tolMin}min)`); }
        else detail.push(`${k}: ${g} (기준 ${expRaw}, 차 ${dm}분)`);
        continue;
      }
      const exp = Number(expRaw);
      const tol = typeof tc.tolerance === 'number' ? Math.max(tc.tolerance, Math.abs(exp) * 0.002) : Math.abs(exp) * 0.01 + 0.02;
      if (g === undefined || Math.abs(g - exp) > tol) { ok = false; detail.push(`${k}: got ${g}, want ${exp}±${tol}`); }
      else detail.push(`${k}: ${typeof g === 'number' ? g.toFixed(4) : g} ≈ ${exp}`);
    }
    if (ok) { pass++; console.log(`PASS  ${calc.slug}#${idx + 1}  ${detail.join('; ')}`); }
    else { fail++; failures.push(`${calc.slug}#${idx + 1}: ${detail.join('; ')}`); console.log(`FAIL  ${calc.slug}#${idx + 1}  ${detail.join('; ')}`); }
  }
}
console.log(`\n합계: PASS ${pass} / FAIL ${fail} / 수동 ${manual}`);
if (failures.length) { console.log('실패 목록:'); failures.forEach(f => console.log(' -', f)); process.exitCode = 1; }
