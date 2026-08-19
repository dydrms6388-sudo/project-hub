/* BabyCalc KR — 배포 게이트 테스트 (Node, 의존성 0)
 * 실행: node tests/run.mjs   (gen.mjs 실행 후)
 * 1) 성장 백분위 LMS z점수 공식 검증
 * 2) 개월수·교정연령 경계 케이스
 * 3) 전 HTML '광고 영역'/'REPLACE_' 0건
 * 4) 상대링크 깨짐 0건 (절대경로 "/" 시작 금지 포함)
 * 5) sitemap URL ↔ 파일 존재 대응
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mkDate, addMonths, diffDays, babyAge, correctedAge,
  zFromLMS, xFromZ, normCdf, percentileFromZ,
} from '../assets/calc.mjs';
import { GROWTH } from '../data/growth.mjs';

const BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ORIGIN = 'https://babycalc-kr.vercel.app';

let pass = 0;
const fails = [];
const counts = {};

function group(name) { counts[name] = counts[name] || { pass: 0, fail: 0 }; return name; }
function ok(g, name, cond, extra) {
  if (cond) { pass++; counts[g].pass++; }
  else { counts[g].fail++; fails.push('[' + g + '] ' + name + (extra ? ' — ' + extra : '')); }
}
function near(g, name, actual, expected, tol) {
  const d = Math.abs(actual - expected);
  ok(g, name, d <= (tol == null ? 1e-9 : tol), 'actual=' + actual + ' expected=' + expected + ' diff=' + d);
}

/* ───────── 1. LMS z점수 공식 ───────── */
{
  const g = group('1. LMS z점수');

  // (1) 중앙값과 같으면 z = 0 (L≠0)
  near(g, 'X=M → z=0 (L=0.3487, WHO 남아 0개월 몸무게)', zFromLMS(3.3464, 0.3487, 3.3464, 0.14602), 0);

  // (2) 중앙값과 같으면 z = 0 (L=1)
  near(g, 'X=M → z=0 (L=1, 남아 0개월 신장)', zFromLMS(49.8842, 1, 49.8842, 0.03795), 0);

  // (3) L=1 인 경우 z = (X/M - 1)/S 와 동일해야 한다 (독립 계산)
  {
    const X = 52.0, M = 49.8842, S = 0.03795;
    near(g, 'L=1 → (X/M-1)/S 와 일치', zFromLMS(X, 1, M, S), (X / M - 1) / S, 1e-12);
  }

  // (4) L=0 → ln(X/M)/S (로그정규 케이스, 독립 계산)
  {
    const X = 6.0, M = 5.5675, S = 0.12385;
    near(g, 'L=0 → ln(X/M)/S 와 일치', zFromLMS(X, 0, M, S), Math.log(X / M) / S, 1e-12);
    near(g, 'L=0 & X=M → z=0', zFromLMS(M, 0, M, S), 0);
  }

  // (5) 일반 케이스: 공식을 손으로 전개한 값과 일치 (WHO 남아 3개월 몸무게 LMS)
  {
    const L = 0.1738, M = 6.3762, S = 0.11727, X = 7.0;
    const expected = (Math.exp(L * Math.log(X / M)) - 1) / (L * S); // (X/M)^L 를 exp·log 로 독립 전개
    near(g, '일반 케이스 z = ((X/M)^L-1)/(L·S)', zFromLMS(X, L, M, S), expected, 1e-10);
    // 부호 확인: 중앙값보다 크면 z > 0
    ok(g, '중앙값보다 크면 z>0', zFromLMS(X, L, M, S) > 0);
    ok(g, '중앙값보다 작으면 z<0', zFromLMS(5.5, L, M, S) < 0);
  }

  // (6) 역산 왕복: xFromZ(zFromLMS(X)) === X
  {
    const L = 0.2297, M = 4.4709, S = 0.13395, X = 4.9;
    near(g, 'xFromZ ∘ zFromLMS 왕복 (L≠0)', xFromZ(zFromLMS(X, L, M, S), L, M, S), X, 1e-9);
    near(g, 'xFromZ ∘ zFromLMS 왕복 (L=0)', xFromZ(zFromLMS(X, 0, M, S), 0, M, S), X, 1e-9);
  }

  // (7) 백분위 변환
  near(g, 'z=0 → 백분위 50%', percentileFromZ(0), 50, 1e-6);
  near(g, 'z=1.281552 → 백분위 ≈ 90%', percentileFromZ(1.2815516), 90, 0.01);
  near(g, 'z=-1.881 → 백분위 ≈ 3%', percentileFromZ(-1.8807936), 3, 0.01);
  ok(g, 'normCdf 단조 증가', normCdf(-1) < normCdf(0) && normCdf(0) < normCdf(1));

  // (8) 잘못된 입력 방어
  ok(g, 'X<=0 이면 NaN', Number.isNaN(zFromLMS(0, 1, 5, 0.1)));

  // (9) 실제 데이터(checked 행)로 z=0 이면 M 이 되돌아오는지
  {
    const rows = GROWTH.weight.boy.filter((r) => r.checked);
    ok(g, 'checked 몸무게 행 존재', rows.length >= 4, 'rows=' + rows.length);
    let allOk = true;
    rows.forEach((r) => { if (Math.abs(xFromZ(0, r.L, r.M, r.S) - r.M) > 1e-9) allOk = false; });
    ok(g, '모든 checked 행에서 z=0 → X=M', allOk);
  }
}

/* ───────── 2. 개월수·교정연령 경계 ───────── */
{
  const g = group('2. 개월수·교정연령');
  const A = (b, t) => babyAge(mkDate(b), mkDate(t));

  ok(g, '생일 당일 → 0개월 0일', A('2026-01-15', '2026-01-15').months === 0 && A('2026-01-15', '2026-01-15').days === 0);
  ok(g, '생일 전날 → null', A('2026-01-15', '2026-01-14') === null);
  ok(g, '1개월 하루 전 → 0개월 30일', (() => { const a = A('2026-01-15', '2026-02-14'); return a.months === 0 && a.days === 30; })(),
    JSON.stringify(A('2026-01-15', '2026-02-14')));
  ok(g, '정확히 1개월 → 1개월 0일', (() => { const a = A('2026-01-15', '2026-02-15'); return a.months === 1 && a.days === 0; })());
  ok(g, '말일 보정: 1/31 → 2/28 은 1개월 0일', (() => { const a = A('2026-01-31', '2026-02-28'); return a.months === 1 && a.days === 0; })(),
    JSON.stringify(A('2026-01-31', '2026-02-28')));
  ok(g, '말일 보정: 1/31 → 3/1 은 1개월 1일', (() => { const a = A('2026-01-31', '2026-03-01'); return a.months === 1 && a.days === 1; })(),
    JSON.stringify(A('2026-01-31', '2026-03-01')));
  ok(g, '말일 보정: 1/31 → 3/31 은 2개월 0일', (() => { const a = A('2026-01-31', '2026-03-31'); return a.months === 2 && a.days === 0; })(),
    JSON.stringify(A('2026-01-31', '2026-03-31')));
  // 윤년 2/29 출생: 말일 클램프 규칙에 따라 평년의 2/28 이 12개월 기준일이 된다
  ok(g, '윤년 2/29 출생 → 다음해 2/28 은 12개월 0일 (말일 클램프)', (() => {
    const a = A('2024-02-29', '2025-02-28');
    return a.months === 12 && a.days === 0;
  })(), JSON.stringify(A('2024-02-29', '2025-02-28')));
  ok(g, '윤년 2/29 출생 → 다음해 2/27 은 아직 11개월', A('2024-02-29', '2025-02-27').months === 11,
    JSON.stringify(A('2024-02-29', '2025-02-27')));
  ok(g, '윤년 2/29 출생 → 다음해 3/1 은 12개월 1일', (() => { const a = A('2024-02-29', '2025-03-01'); return a.months === 12 && a.days === 1; })(),
    JSON.stringify(A('2024-02-29', '2025-03-01')));
  ok(g, '만 1년 = 12개월 0일', (() => { const a = A('2025-06-10', '2026-06-10'); return a.months === 12 && a.days === 0; })());
  ok(g, '총 일수: 2025-01-01 → 2026-01-01 = 365일', A('2025-01-01', '2026-01-01').totalDays === 365,
    'totalDays=' + A('2025-01-01', '2026-01-01').totalDays);
  ok(g, '윤년 포함 총 일수: 2024-01-01 → 2025-01-01 = 366일', A('2024-01-01', '2025-01-01').totalDays === 366);
  ok(g, '주수 환산: 100일 → 14주 2일', (() => { const a = A('2026-01-01', '2026-04-11'); return a.totalDays === 100 && a.weeks === 14 && a.weekDays === 2; })(),
    JSON.stringify(A('2026-01-01', '2026-04-11')));
  ok(g, '개월수는 음수가 되지 않는다', A('2026-01-15', '2026-01-20').months === 0);

  // 교정연령
  const C = (due, t) => correctedAge(mkDate(due), mkDate(t));
  ok(g, '교정연령: 예정일 당일 → 0개월 0일', (() => { const c = C('2026-03-01', '2026-03-01'); return c.months === 0 && c.days === 0 && c.beforeDue === false; })());
  ok(g, '교정연령: 예정일 전 → beforeDue=true', C('2026-03-01', '2026-02-20').beforeDue === true);
  ok(g, '교정연령: 예정일 8주 전 출생, 실제 6개월 시점의 교정연령은 약 4개월', (() => {
    const birth = mkDate('2026-01-01');
    const due = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + 56); // 8주 뒤 예정
    const today = addMonths(birth, 6);
    const c = correctedAge(due, today);
    return c.months === 4;
  })());
  ok(g, '교정연령 ≤ 실제 개월수', (() => {
    const birth = mkDate('2025-11-10');
    const due = mkDate('2026-01-05');
    const today = mkDate('2026-08-19');
    return correctedAge(due, today).months <= babyAge(birth, today).months;
  })());

  // addMonths / diffDays 보조 검증
  ok(g, 'addMonths 말일 클램프 (1/31 +1 = 2/28)', (() => { const d = addMonths(mkDate('2026-01-31'), 1); return d.getMonth() === 1 && d.getDate() === 28; })());
  ok(g, 'addMonths 윤년 클램프 (2024-01-31 +1 = 2/29)', (() => { const d = addMonths(mkDate('2024-01-31'), 1); return d.getMonth() === 1 && d.getDate() === 29; })());
  ok(g, 'diffDays 역방향은 음수', diffDays(mkDate('2026-03-01'), mkDate('2026-02-28')) === -1);
}

/* ───────── HTML 수집 ───────── */
function walk(dir, out) {
  readdirSync(dir).forEach((f) => {
    if (f === 'node_modules' || f === '.git') return;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.html')) out.push(p);
  });
  return out;
}
const htmlFiles = walk(BASE, []).sort();

/* ───────── 3. 금지 문구 ───────── */
{
  const g = group('3. 금지 문구');
  ok(g, 'HTML 파일이 생성되어 있다', htmlFiles.length >= 70, 'count=' + htmlFiles.length);
  const BANNED = ['광고 영역', 'REPLACE_'];
  BANNED.forEach((b) => {
    const hits = htmlFiles.filter((f) => readFileSync(f, 'utf8').includes(b));
    ok(g, '"' + b + '" 0건', hits.length === 0, hits.map((h) => relative(BASE, h)).join(', '));
  });
  // 광고 유닛 자체는 존재해야 한다 (도구 페이지 기준)
  const adPages = htmlFiles.filter((f) => readFileSync(f, 'utf8').includes('ca-pub-5567719201265106'));
  ok(g, '광고 유닛(ca-pub-5567719201265106) 페이지 존재', adPages.length >= 70, 'count=' + adPages.length);
  // 미치환 토큰
  const tok = htmlFiles.filter((f) => readFileSync(f, 'utf8').includes('@UP@'));
  ok(g, '@UP@ 미치환 토큰 0건', tok.length === 0, tok.map((h) => relative(BASE, h)).join(', '));
}

/* ───────── 4. 상대링크 ───────── */
{
  const g = group('4. 상대링크');
  let checked = 0;
  const broken = [];
  const absolute = [];
  htmlFiles.forEach((f) => {
    const raw = readFileSync(f, 'utf8');
    // <script> 블록 제거 (JS 문자열 결합에서 나오는 href= 오탐 방지)
    const html = raw.replace(/<script[\s\S]*?<\/script>/gi, '');
    const dir = dirname(f);
    const re = /(?:href|src)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(href)) continue;
      if (href.startsWith('/')) { absolute.push(relative(BASE, f) + ' → ' + href); continue; }
      checked++;
      let p = href.split('#')[0].split('?')[0];
      if (p === '') continue;
      let target = resolve(dir, p);
      if (p.endsWith('/')) target = join(target, 'index.html');
      else if (!/\.[a-z0-9]+$/i.test(p)) target = join(target, 'index.html');
      if (!existsSync(target)) broken.push(relative(BASE, f) + ' → ' + href);
    }
  });
  ok(g, '절대경로("/" 시작) 링크 0건', absolute.length === 0, absolute.slice(0, 8).join(' | '));
  ok(g, '깨진 상대링크 0건 (' + checked + '건 검사)', broken.length === 0, broken.slice(0, 12).join(' | '));
  ok(g, '검사한 상대링크가 충분하다', checked >= 300, 'checked=' + checked);
}

/* ───────── 5. sitemap ↔ 파일 ───────── */
{
  const g = group('5. sitemap');
  const smPath = join(BASE, 'sitemap.xml');
  ok(g, 'sitemap.xml 존재', existsSync(smPath));
  ok(g, 'robots.txt 존재', existsSync(join(BASE, 'robots.txt')));
  if (existsSync(smPath)) {
    const sm = readFileSync(smPath, 'utf8');
    const locs = Array.from(sm.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    ok(g, 'sitemap URL 개수 ≥ 70', locs.length >= 70, 'count=' + locs.length);
    const missing = [];
    const seen = new Set();
    const dup = [];
    locs.forEach((loc) => {
      if (!loc.startsWith(SITE_ORIGIN + '/')) { missing.push(loc + ' (origin 불일치)'); return; }
      if (seen.has(loc)) dup.push(loc);
      seen.add(loc);
      let rel = loc.slice((SITE_ORIGIN + '/').length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      if (!existsSync(join(BASE, rel))) missing.push(loc + ' → ' + rel);
    });
    ok(g, 'sitemap의 모든 URL에 대응 파일 존재', missing.length === 0, missing.slice(0, 10).join(' | '));
    ok(g, 'sitemap 중복 URL 0건', dup.length === 0, dup.join(', '));

    // 역방향: 모든 HTML 이 sitemap 에 있는지
    const notListed = htmlFiles.map((f) => relative(BASE, f).split('\\').join('/'))
      .filter((rel) => {
        const url = SITE_ORIGIN + '/' + rel.replace(/index\.html$/, '');
        return !seen.has(url);
      });
    ok(g, '모든 HTML 이 sitemap 에 등록됨', notListed.length === 0, notListed.slice(0, 10).join(', '));

    const robots = readFileSync(join(BASE, 'robots.txt'), 'utf8');
    ok(g, 'robots.txt 가 sitemap 을 가리킨다', robots.includes(SITE_ORIGIN + '/sitemap.xml'));
  }
}

/* ───────── 6. 페이지 필수 요소 (보조 게이트) ───────── */
{
  const g = group('6. 페이지 필수 요소');
  const titles = new Map();
  const descs = new Map();
  const noJsonld = [];
  const noCanon = [];
  htmlFiles.forEach((f) => {
    const html = readFileSync(f, 'utf8');
    const rel = relative(BASE, f);
    const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    titles.set(rel, t);
    descs.set(rel, d);
    if (!html.includes('application/ld+json')) noJsonld.push(rel);
    if (!html.includes('<link rel="canonical"')) noCanon.push(rel);
  });
  ok(g, '모든 페이지에 JSON-LD', noJsonld.length === 0, noJsonld.slice(0, 6).join(', '));
  ok(g, '모든 페이지에 canonical', noCanon.length === 0, noCanon.slice(0, 6).join(', '));
  const dupT = [...new Set([...titles.values()].filter((t, i, arr) => arr.indexOf(t) !== i))];
  ok(g, 'title 중복 0건', dupT.length === 0, dupT.slice(0, 5).join(' | '));
  const dupD = [...new Set([...descs.values()].filter((t, i, arr) => arr.indexOf(t) !== i))];
  ok(g, 'description 중복 0건', dupD.length === 0, dupD.slice(0, 3).join(' | '));
  const emptyT = [...titles.entries()].filter(([, t]) => !t.trim()).map(([k]) => k);
  ok(g, '빈 title 0건', emptyT.length === 0, emptyT.join(', '));

  // 의료 관련 페이지 고지
  const MED = ['vaccine-schedule', 'growth-percentile', 'formula-amount', 'weaning-stage', 'sleep-schedule', 'fever-guide', 'milestone', 'months-age'];
  const noNotice = MED.map((s) => join(BASE, s, 'index.html'))
    .filter((p) => existsSync(p) && !/참고용이며 진단이 아닙니다|참고용입니다|진단이 아닙니다/.test(readFileSync(p, 'utf8')));
  ok(g, '의료 관련 페이지에 참고용·비진단 고지', noNotice.length === 0, noNotice.map((p) => relative(BASE, p)).join(', '));

  // name-check 오락용 명시
  const nc = join(BASE, 'name-check', 'index.html');
  ok(g, 'name-check 오락용 명시', existsSync(nc) && /오락용/.test(readFileSync(nc, 'utf8')) && /작명/.test(readFileSync(nc, 'utf8')));

  // 기록형 페이지: localStorage 안내 + 전체삭제
  const REC = ['vaccine-schedule', 'growth-percentile', 'sleep-schedule', 'milestone'];
  const noLocal = REC.map((s) => join(BASE, s, 'index.html'))
    .filter((p) => { const h = existsSync(p) ? readFileSync(p, 'utf8') : ''; return !(h.includes('서버 저장 없음') && h.includes('전체 삭제')); });
  ok(g, '기록형 페이지에 "서버 저장 없음" + 전체 삭제', noLocal.length === 0, noLocal.map((p) => relative(BASE, p)).join(', '));

  // 크로스링크 (tomatoeggcat 절대 URL 2개 이상)
  const TOOLS = ['vaccine-schedule', 'months-age', 'growth-percentile', 'formula-amount', 'weaning-stage', 'sleep-schedule',
    'fever-guide', 'diaper-size', 'daycare-dday', 'baby-cost', 'name-check', 'milestone'];
  const lowCross = TOOLS.filter((s) => {
    const p = join(BASE, s, 'index.html');
    if (!existsSync(p)) return true;
    const n = (readFileSync(p, 'utf8').match(/https:\/\/tomatoeggcat\.com\/[a-z-]+\//g) || []).length;
    return n < 2;
  });
  ok(g, '모든 도구에 TomatoEggCat 크로스링크 2개 이상', lowCross.length === 0, lowCross.join(', '));
}

/* ───────── 결과 출력 ───────── */
console.log('\n=== BabyCalc KR 배포 게이트 ===');
Object.keys(counts).forEach((k) => {
  const c = counts[k];
  console.log('  ' + (c.fail ? '❌' : '✅') + ' ' + k + ': ' + c.pass + '/' + (c.pass + c.fail) + ' 통과');
});
console.log('  ─ HTML 파일 ' + htmlFiles.length + '개 검사');
if (fails.length) {
  console.log('\n실패 ' + fails.length + '건:');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('\n전체 ' + pass + '건 통과 ✅');
