/* 도구 페이지 정의 B — sleep / fever / diaper / daycare / cost / name / milestone */
import { SOURCE as SLEEP_SRC, TOTAL_SLEEP, NAP_GUIDE } from '../data/sleep.mjs';
import { SOURCE as FEVER_SRC, FEVER_THRESHOLD, URGENT_RULES, HOME_CARE } from '../data/fever.mjs';
import { SOURCE as DIAPER_SRC, GENERIC_SIZES, FIT_TIPS } from '../data/diaper.mjs';
import { SOURCE as DAYCARE_SRC, PRIORITY_ITEMS, NOTES as DAYCARE_NOTES } from '../data/daycare.mjs';
import { SOURCE as COST_SRC, SUPPORTS, COST_ITEMS } from '../data/cost.mjs';
import { SOURCE as MS_SRC, MILESTONES, CHECKUP_NOTE } from '../data/milestone.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const badge = (ok) => ok ? '<span class="badge ok">확인됨</span>' : '<span class="badge todo">확인 필요</span>';
const won = (n) => n.toLocaleString('ko-KR') + '원';

const REL_TEC = {
  vaccine: { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미 (TomatoEggCat)' },
  due: { href: 'https://tomatoeggcat.com/due-date-calc/', ic: '🍅', name: '출산 예정일 계산기' },
  age: { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
  taemyeong: { href: 'https://tomatoeggcat.com/dydrms-taemyeong/', ic: '🍅', name: '태명 짓기' },
  ovul: { href: 'https://tomatoeggcat.com/ovulation-calendar/', ic: '🍅', name: '배란일 계산기' },
};

/* ───────────────────────── 5. 수면 스케줄 ───────────────────────── */
const sleepRows = TOTAL_SLEEP.map((t) =>
  '<tr><td>' + esc(t.range) + '</td><td>' + esc(t.hours) + '</td><td>' + badge(t.checked) + '</td></tr>').join('\n        ');
const napRows = NAP_GUIDE.map((n) =>
  '<tr><td>' + esc(n.range) + '</td><td>' + esc(n.naps) + '</td><td>' + esc(n.wake) + '</td><td>' + badge(n.checked) + '</td></tr>').join('\n        ');

const sleepSchedule = {
  slug: 'sleep-schedule', emoji: '😴',
  title: '아기 수면 스케줄 만들기 — 월령별 권장 수면시간·낮잠 타임라인 | BabyCalc',
  desc: '월령과 아침 기상 시각을 입력하면 권장 총 수면시간과 깨어있는 시간(wake window)을 바탕으로 낮잠·취침 타임라인 예시를 만들어 드립니다. 수면 기록 저장과 CSV 내보내기도 지원합니다.',
  ogTitle: '아기 수면 스케줄 만들기',
  ogDesc: '월령별 권장 수면시간과 낮잠 타임라인 예시를 한 번에.',
  h1: '아기 수면 스케줄 만들기', crumbName: '수면 스케줄',
  lead: '몇 시에 재워야 할지 막막할 때, 월령별 권장 수면시간과 깨어있는 시간으로 하루 타임라인을 그려 드려요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="row2">
      <div class="field">
        <label for="month">월령 (개월)</label>
        <input type="number" id="month" min="0" max="60" step="1" required placeholder="예: 7">
      </div>
      <div class="field">
        <label for="wake">아침 기상 시각</label>
        <input type="time" id="wake" value="07:00" required>
      </div>
    </div>
    <button class="btn" type="submit">스케줄 만들기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>추천 타임라인</h2>
    <p class="res-big" id="totalBig">—</p>
    <p class="res-sub" id="totalSub"></p>
    <div class="kv"><span class="k">낮잠 횟수 (참고)</span><span class="v" id="kNaps">—</span></div>
    <div class="kv"><span class="k">깨어있는 시간 (참고)</span><span class="v" id="kWake">—</span></div>
    <div class="tbl-scroll"><table class="tbl" id="tlTbl">
      <thead><tr><th>시각</th><th>일정</th></tr></thead><tbody></tbody>
    </table></div>
    <p class="res-sub" id="tlNote" style="font-size:12.5px;color:var(--muted)"></p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>

  <section class="card">
    <h2>수면 기록</h2>
    <div class="row3">
      <div class="field"><label for="rDate">날짜</label><input type="date" id="rDate"></div>
      <div class="field"><label for="rBed">취침</label><input type="time" id="rBed"></div>
      <div class="field"><label for="rUp">기상</label><input type="time" id="rUp"></div>
    </div>
    <div class="field">
      <label for="rNap">낮잠 합계 (분)</label>
      <input type="number" id="rNap" min="0" max="900" step="5" placeholder="예: 120">
    </div>
    <div class="btnrow">
      <button class="btn sm" type="button" id="addRec">기록 추가</button>
      <button class="btn sm sec" type="button" id="csvBtn">CSV 내보내기</button>
      <button class="btn sm sec" type="button" id="jsonBtn">JSON 내보내기</button>
      <button class="btn sm danger" type="button" id="clearBtn">기록 전체 삭제</button>
    </div>
    <div class="tbl-scroll"><table class="tbl" id="recTbl">
      <thead><tr><th>날짜</th><th>취침</th><th>기상</th><th>밤잠</th><th>낮잠</th><th>총 수면</th><th class="no-print">삭제</th></tr></thead><tbody></tbody>
    </table></div>
    <p class="local-note">✅ 수면 기록은 이 브라우저(localStorage)에만 저장됩니다. <strong>서버 저장 없음.</strong></p>
  </section>`,
  introTitle: '어떤 기준으로 만드나요?',
  introHtml: '<p>하루 총 수면시간은 <strong>미국수면재단(NSF) 2015 연령별 권장 수면시간</strong>을 기준으로 합니다. 여기에 월령별로 흔히 안내되는 <strong>깨어있는 시간(wake window)</strong>을 더해 기상 시각부터 낮잠·취침까지의 타임라인 예시를 만듭니다.</p>' +
    '<p>총 수면시간 권장치는 출처가 분명한 값이지만, <strong>낮잠 횟수·깨어있는 시간·낮잠 길이는 공식 표준이 없는 일반적 육아 참고</strong>라 <span class="badge todo">확인 필요</span>로 표시합니다. 타임라인은 "이렇게 짜 볼 수 있다"는 예시일 뿐, 아기의 졸림 신호가 항상 우선입니다.</p>',
  howtoHtml: '<ol><li>월령과 오늘 아침 기상 시각을 입력합니다.</li>' +
    '<li>깨어있는 시간을 기준으로 낮잠 시작 시각과 밤 취침 시각 예시가 나옵니다.</li>' +
    '<li>아래 수면 기록에 실제 취침·기상 시각을 적어 두면 패턴을 볼 수 있고, CSV로 내보낼 수 있습니다.</li></ol>',
  extraHtml: '<h2>월령별 권장 총 수면시간</h2>\n    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>연령</th><th>하루 총 수면(낮잠 포함)</th><th>근거</th></tr></thead><tbody>\n        ' + sleepRows + '\n      </tbody></table></div>' +
    '<h2>낮잠 횟수와 깨어있는 시간</h2>\n    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>월령</th><th>낮잠 횟수</th><th>깨어있는 시간</th><th>근거</th></tr></thead><tbody>\n        ' + napRows + '\n      </tbody></table></div>' +
    '<p>이 표의 값은 공식 표준이 아니라 널리 통용되는 참고 범위입니다. 같은 월령이라도 아기마다 1~2시간씩 차이가 나는 것이 자연스럽습니다.</p>' +
    '<h2>안전한 수면 환경</h2>' +
    '<ul><li>돌 전에는 <strong>등을 대고 눕혀</strong> 재웁니다.</li><li>단단한 매트리스에, 베개·인형·두꺼운 이불 없이.</li><li>같은 방에서 자되 <strong>같은 침구는 공유하지 않는 것</strong>이 권장됩니다.</li><li>실내는 덥지 않게, 두껍게 싸매지 않도록 합니다.</li></ul>',
  faq: [
    { q: '권장 수면시간보다 적게 자요.', a: '권장치는 범위이고 개인차가 큽니다. 낮에 기분이 좋고 잘 먹으며 발달이 순조롭다면 대개 괜찮습니다. 지속적으로 심하게 부족하거나 자다가 자주 깨서 힘들어한다면 소아과에서 상담해 보세요.' },
    { q: '낮잠을 안 자려고 해요.', a: '깨어있는 시간이 너무 짧거나 반대로 너무 길면 잠들기 어려워집니다. 타임라인을 참고해 30분 단위로 조정해 보고, 졸림 신호(눈 비비기·칭얼거림)를 놓치지 않는 것이 도움이 됩니다.' },
    { q: '통잠은 몇 개월부터 자나요?', a: '아기마다 편차가 매우 커서 정해진 시점이 없습니다. 밤중 수유가 필요한 시기, 이앓이, 발달 도약 등으로 다시 자주 깨는 시기도 흔합니다.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + SLEEP_SRC.name + ' — <a href="' + SLEEP_SRC.url + '" target="_blank" rel="noopener">sleepfoundation.org</a> (확인일 ' + SLEEP_SRC.checkedAt + '). ' +
    '총 수면시간만 이 출처의 확정 값이며, <strong>낮잠 횟수·깨어있는 시간·낮잠 길이는 공식 표준이 없는 일반 참고(확인 필요)</strong>입니다.',
  disclaimer: '수면 안내는 참고용이며 진단이 아닙니다. 수면 중 호흡 이상, 심한 수면 부족 등이 걱정되면 소아과 전문의와 상담하세요.',
  related: [
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@milestone/', ic: '🧸', name: '발달 이정표 체크' },
    { href: '@UP@growth-percentile/', ic: '📈', name: '성장 백분위 계산기' },
    REL_TEC.vaccine, REL_TEC.age,
  ],
  script: `import { TOTAL_SLEEP, NAP_GUIDE } from '@UP@data/sleep.mjs';
import { fmtDate } from '@UP@assets/calc.mjs';
const $ = (s) => document.querySelector(s);
const RKEY = 'bc-sleep-records';
const IKEY = 'bc-sleep-input';
const NAP_ASSUME = 60; /* 낮잠 길이 가정(분) — 아기마다 다름, 예시용 */

function parseWake(str) {
  const m = str.match(/(\\d+)~(\\d+)(분|시간)/);
  if (!m) return 120;
  const lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
  const mid = (lo + hi) / 2;
  return m[3] === '시간' ? mid * 60 : mid;
}
function parseNaps(str) {
  const m = str.match(/(\\d+)/);
  return m ? parseInt(m[1], 10) : 2;
}
function hhmm(mins) {
  const t = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), m = Math.round(t % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function toMin(v) {
  if (!v) return null;
  const p = v.split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function build(month, wakeStr) {
  const total = TOTAL_SLEEP.find((t) => month >= t.fromM && month <= t.toM) || TOTAL_SLEEP[TOTAL_SLEEP.length - 1];
  const nap = NAP_GUIDE.find((n) => month >= n.fromM && month <= n.toM) || NAP_GUIDE[NAP_GUIDE.length - 1];
  const ww = parseWake(nap.wake);
  const naps = parseNaps(nap.naps);
  $('#totalBig').textContent = '하루 ' + total.hours;
  $('#totalSub').textContent = '생후 ' + month + '개월 · ' + total.range + ' 권장 총 수면(낮잠 포함) · 미국수면재단 2015';
  $('#kNaps').innerHTML = nap.naps + ' <span class="badge todo">확인 필요</span>';
  $('#kWake').innerHTML = nap.wake + ' <span class="badge todo">확인 필요</span>';

  const start = toMin(wakeStr);
  const rows = [{ t: start, label: '기상' }];
  let cur = start;
  for (let i = 1; i <= naps; i++) {
    cur += ww;
    rows.push({ t: cur, label: i + '번째 낮잠 시작 (예시)' });
    cur += NAP_ASSUME;
    rows.push({ t: cur, label: i + '번째 낮잠 종료 (약 ' + NAP_ASSUME + '분 가정)' });
  }
  cur += ww;
  rows.push({ t: cur, label: '밤 취침' });
  const tb = $('#tlTbl tbody');
  tb.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + hhmm(r.t) + '</td><td>' + r.label + '</td>';
    tb.appendChild(tr);
  });
  $('#tlNote').textContent = '깨어있는 시간 ' + Math.round(ww) + '분, 낮잠 길이 ' + NAP_ASSUME + '분을 가정한 예시입니다. 낮잠 길이는 아기마다 크게 달라 공식 기준이 없습니다. 아기의 졸림 신호가 시간표보다 우선입니다.';
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = parseInt($('#month').value, 10), w = $('#wake').value;
  if (isNaN(m) || !w) return;
  bcStore.set(IKEY, { m, w });
  build(m, w);
});

function renderRecs() {
  const recs = bcStore.get(RKEY, []);
  const tb = $('#recTbl tbody');
  tb.innerHTML = '';
  if (!recs.length) { tb.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">아직 기록이 없어요.</td></tr>'; return; }
  recs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((r) => {
    const night = r.night, tot = night + (r.nap || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.date + '</td><td>' + r.bed + '</td><td>' + r.up + '</td>' +
      '<td>' + Math.floor(night / 60) + '시간 ' + (night % 60) + '분</td>' +
      '<td>' + Math.floor((r.nap || 0) / 60) + '시간 ' + ((r.nap || 0) % 60) + '분</td>' +
      '<td><strong>' + Math.floor(tot / 60) + '시간 ' + (tot % 60) + '분</strong></td>' +
      '<td class="no-print"><button class="btn sm sec" type="button" data-del="' + r.id + '">삭제</button></td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button[data-del]').forEach((b) => b.addEventListener('click', () => {
    bcStore.set(RKEY, bcStore.get(RKEY, []).filter((x) => x.id !== b.dataset.del));
    renderRecs();
  }));
}

$('#addRec').addEventListener('click', () => {
  const date = $('#rDate').value || fmtDate(new Date());
  const bed = $('#rBed').value, up = $('#rUp').value;
  if (!bed || !up) { alert('취침·기상 시각을 입력해 주세요.'); return; }
  let night = toMin(up) - toMin(bed);
  if (night <= 0) night += 1440;
  const recs = bcStore.get(RKEY, []);
  recs.push({ id: 's' + Date.now(), date, bed, up, night, nap: parseInt($('#rNap').value, 10) || 0 });
  bcStore.set(RKEY, recs);
  $('#rNap').value = '';
  renderRecs();
});
$('#csvBtn').addEventListener('click', () => {
  const lines = ['날짜,취침,기상,밤잠(분),낮잠(분),총수면(분)'];
  bcStore.get(RKEY, []).forEach((r) => lines.push([r.date, r.bed, r.up, r.night, r.nap || 0, r.night + (r.nap || 0)].map(bcCsvCell).join(',')));
  bcDownload('baby-sleep.csv', '\\ufeff' + lines.join('\\n'), 'text/csv');
});
$('#jsonBtn').addEventListener('click', () => bcDownload('baby-sleep.json', JSON.stringify(bcStore.get(RKEY, []), null, 2), 'application/json'));
$('#clearBtn').addEventListener('click', () => {
  if (confirm('수면 기록을 모두 삭제할까요? (이 브라우저에서만 삭제됩니다)')) { bcStore.del(RKEY); renderRecs(); }
});

$('#rDate').value = fmtDate(new Date());
renderRecs();
const si = bcStore.get(IKEY, null);
if (si && si.m != null) { $('#month').value = si.m; $('#wake').value = si.w; build(si.m, si.w); }`,
};

/* ───────────────────────── 6. 발열 대처 가이드 ───────────────────────── */
const urgentChecks = URGENT_RULES.filter((r) => r.id !== 'under90d').map((r) =>
  '<label class="chk-item"><input type="checkbox" class="sym" data-id="' + r.id + '">' +
  '<span class="chk-tx">' + esc(r.cond) + '<span class="chk-sub">' + esc(r.action) + ' ' + (r.checked ? '' : '(자료마다 기준 상이 — 확인 필요)') + '</span></span></label>').join('\n      ');

const urgentRows = URGENT_RULES.map((r) =>
  '<tr><td>' + esc(r.cond) + '</td><td>' + esc(r.action) + '</td><td>' + badge(r.checked) + '</td></tr>').join('\n        ');

const feverGuide = {
  slug: 'fever-guide', emoji: '🌡️',
  title: '아기 발열 대처 가이드 — 월령·체온·증상으로 보는 진료 기준 | BabyCalc',
  desc: '아기 월령과 체온, 동반 증상을 입력하면 즉시 진료가 필요한 상황인지 공개된 소아 발열 안내 기준 그대로 확인할 수 있습니다. 해열제 용량은 계산하지 않으며 가정 대처 요령만 안내합니다.',
  ogTitle: '아기 발열 대처 가이드 — 언제 병원에 가야 할까',
  ogDesc: '월령·체온·증상으로 보는 소아 발열 진료 기준과 가정 대처 요령.',
  h1: '아기 발열 대처 가이드', crumbName: '발열 대처',
  lead: '지금 병원에 가야 할 상황인지, 공개된 소아 발열 안내 기준을 그대로 확인해 보세요.',
  notice: '🚨 <strong>응급 상황이면 이 페이지를 보지 말고 즉시 119 또는 응급실로 연락하세요.</strong> 이 페이지는 참고용이며 진단이 아닙니다. 반드시 소아과 전문의와 상담하세요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 상태</h2>
    <div class="row2">
      <div class="field">
        <label for="month">월령 (개월)</label>
        <input type="number" id="month" min="0" max="72" step="1" required placeholder="예: 5">
      </div>
      <div class="field">
        <label for="temp">체온 (℃)</label>
        <input type="number" id="temp" min="34" max="43" step="0.1" required placeholder="예: 38.4">
        <p class="hint">측정 부위(고막·겨드랑이·항문)에 따라 값이 다릅니다.</p>
      </div>
    </div>
    <h2 style="margin-top:16px">동반 증상 (해당하는 항목 체크)</h2>
    <div id="symbox">
      ${urgentChecks}
    </div>
    <button class="btn" type="submit" style="margin-top:12px">확인하기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>확인 결과</h2>
    <p class="res-big" id="verdict">—</p>
    <p class="res-sub" id="verdictSub"></p>
    <div id="matched"></div>
    <div id="homecare"></div>
    <p class="res-sub" style="margin-top:14px;color:var(--warn)">이 결과는 공개된 안내 기준에 입력값을 대조한 것일 뿐 <strong>진단이 아닙니다</strong>. 체크한 항목이 없어도 아이가 평소와 다르게 처지면 체온과 관계없이 진료를 받으세요.</p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>`,
  introTitle: '발열은 몇 도부터인가요?',
  introHtml: '<p>일반적으로 <strong>' + FEVER_THRESHOLD.value + FEVER_THRESHOLD.unit + ' 이상</strong>을 발열로 봅니다. 다만 측정 부위(고막·겨드랑이·항문·이마)에 따라 값이 달라지므로, 같은 방식으로 반복해서 재고 그 흐름을 보는 것이 더 중요합니다.</p>' +
    '<p>열 자체는 몸이 감염과 싸우는 반응입니다. 그래서 소아과에서는 <strong>숫자보다 아이의 상태</strong>(잘 먹는지, 놀 수 있는지, 처지지는 않는지)를 더 중요하게 봅니다. 이 페이지는 널리 안내되는 "즉시 진료가 필요한 상황"을 <strong>출처 문구 그대로</strong> 보여 줄 뿐, 열의 원인을 판단하지 않습니다.</p>',
  howtoHtml: '<ol><li>아기의 월령과 지금 잰 체온을 입력합니다.</li>' +
    '<li>해당하는 동반 증상을 체크합니다.</li>' +
    '<li>체크한 항목 중 즉시 진료 기준에 해당하는 것이 있으면 그대로 표시됩니다.</li></ol>' +
    '<p><strong>이 도구는 해열제 용량을 계산하지 않습니다.</strong> 해열제는 소아과에서 아기 체중에 맞춰 안내받은 용법·용량대로만 사용하세요.</p>',
  extraHtml: '<h2>즉시·당일 진료가 필요한 상황</h2>\n    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>상황</th><th>안내</th><th>근거</th></tr></thead><tbody>\n        ' + urgentRows + '\n      </tbody></table></div>' +
    '<h2>가정에서의 대처</h2>\n    <ul>' + HOME_CARE.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ul>' +
    '<h2>야간·휴일에 갈 수 있는 곳</h2>' +
    '<p>문 여는 병원과 응급실은 <a href="' + FEVER_SRC.urlEgen + '" target="_blank" rel="noopener">응급의료포털 E-GEN</a> 또는 전화 <strong>119</strong>(응급의료 상담)에서 확인할 수 있습니다. 아이가 처지거나 숨쉬기 힘들어하면 기다리지 말고 바로 119에 연락하세요.</p>',
  faq: [
    { q: '생후 3개월 미만인데 열이 나요.', a: '생후 3개월(90일) 미만의 38.0℃ 이상 발열은 검사가 필요한 경우가 많아, 시간과 관계없이 즉시 진료(응급실 포함)를 받도록 안내됩니다. 집에서 지켜보지 마세요.' },
    { q: '열이 40도인데 위험한가요?', a: '체온 숫자만으로 중증도를 판단하지는 않습니다. 다만 고열이면서 처지거나, 경련·호흡곤란·의식 저하가 있으면 즉시 진료가 필요합니다. 판단이 어려우면 진료를 받는 쪽이 안전합니다.' },
    { q: '해열제는 얼마나 먹여야 하나요?', a: '이 페이지는 용량을 계산하지 않습니다. 해열제 종류와 용량은 아기 체중과 상태에 따라 다르므로 소아과에서 안내받은 용법·용량을 그대로 지키세요.' },
    { q: '열성경련을 하면 어떻게 하나요?', a: '경련은 즉시 119 또는 응급실 대상입니다. 경련 중에는 입에 아무것도 넣지 말고, 옆으로 눕혀 기도를 확보하고, 시작 시각과 지속 시간을 확인해 의료진에게 알려 주세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + FEVER_SRC.name + ' — <a href="' + FEVER_SRC.url + '" target="_blank" rel="noopener">health.kdca.go.kr</a> / <a href="' + FEVER_SRC.urlEgen + '" target="_blank" rel="noopener">e-gen.or.kr</a> (확인일 ' + FEVER_SRC.checkedAt + '). ' +
    '표의 문구는 출처 안내를 그대로 옮긴 것이며, 자료마다 기준이 다른 항목(발열 지속 시간 등)은 <span class="badge todo">확인 필요</span>로 표기하고 보수적으로 안내합니다.',
  disclaimer: '이 페이지는 참고용 정보이며 진단·처방이 아닙니다. 발열의 원인 판단과 치료는 소아과 전문의의 진료가 필요합니다. 응급 상황에서는 즉시 119에 연락하세요.',
  related: [
    { href: '@UP@vaccine-schedule/', ic: '💉', name: '예방접종 일정표' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@milestone/', ic: '🧸', name: '발달 이정표 체크' },
    REL_TEC.vaccine, REL_TEC.age,
  ],
  script: `import { URGENT_RULES, HOME_CARE, FEVER_THRESHOLD } from '@UP@data/fever.mjs';
const $ = (s) => document.querySelector(s);

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = parseInt($('#month').value, 10);
  const t = parseFloat($('#temp').value);
  if (isNaN(m) || isNaN(t)) return;
  const hits = [];
  if (m < 3 && t >= FEVER_THRESHOLD.value) hits.push(URGENT_RULES.find((r) => r.id === 'under90d'));
  document.querySelectorAll('.sym:checked').forEach((cb) => {
    const r = URGENT_RULES.find((x) => x.id === cb.dataset.id);
    if (r) hits.push(r);
  });
  const fever = t >= FEVER_THRESHOLD.value;
  const emergency = hits.some((h) => h.action.indexOf('119') >= 0 || h.action.indexOf('즉시') >= 0);

  if (hits.length) {
    $('#verdict').innerHTML = emergency ? '🚨 즉시 진료가 필요한 항목에 해당합니다' : '⚠ 당일 진료가 권고되는 항목에 해당합니다';
    $('#verdictSub').textContent = '생후 ' + m + '개월 · 체온 ' + t.toFixed(1) + '℃ · 해당 항목 ' + hits.length + '건';
    $('#matched').innerHTML = '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>해당 상황</th><th>안내(출처 문구)</th></tr></thead><tbody>' +
      hits.map((h) => '<tr><td>' + h.cond + '</td><td><strong>' + h.action + '</strong></td></tr>').join('') +
      '</tbody></table></div>';
    $('#homecare').innerHTML = '<p class="res-sub">이동 중에도 아이의 의식·호흡·피부색을 계속 살피세요. 야간·휴일 진료기관은 응급의료포털 E-GEN 또는 119에서 확인할 수 있습니다.</p>';
  } else {
    $('#verdict').textContent = fever ? '체크한 즉시 진료 항목은 없습니다' : '발열 기준(' + FEVER_THRESHOLD.value + '℃) 미만입니다';
    $('#verdictSub').textContent = '생후 ' + m + '개월 · 체온 ' + t.toFixed(1) + '℃' + (fever ? ' · 발열 상태' : '');
    $('#matched').innerHTML = '<p class="res-sub">입력하신 정보로는 위 표의 즉시 진료 항목에 해당하지 않습니다. 다만 이는 <strong>안심해도 된다는 뜻이 아니며</strong>, 아이가 평소와 다르게 처지거나 상태가 나빠지면 체온과 무관하게 진료를 받아야 합니다.</p>';
    $('#homecare').innerHTML = '<h2 style="font-size:15px;margin-top:16px">가정에서의 대처</h2><ul style="padding-left:20px;color:var(--tx2);font-size:14.5px">' +
      HOME_CARE.map((h) => '<li style="margin:6px 0">' + h + '</li>').join('') + '</ul>';
  }
  bcShowResult('result');
});`,
};

/* ───────────────────────── 7. 기저귀 사이즈 ───────────────────────── */
const diaperRows = GENERIC_SIZES.map((s) =>
  '<tr><td><strong>' + esc(s.size) + '</strong></td><td>' + esc(s.note) + '</td><td>' + badge(s.checked) + '</td></tr>').join('\n        ');

const diaperSize = {
  slug: 'diaper-size', emoji: '🧷',
  title: '기저귀 사이즈 계산기 — 체중으로 보는 사이즈 구간과 교체 신호 | BabyCalc',
  desc: '아기 체중을 입력하면 해당하는 기저귀 사이즈 구간(NB·S·M·L·XL)을 알려 드립니다. 브랜드마다 실제 구간이 다르므로 공식 사이즈표 확인이 필요하며, 사이즈를 올려야 하는 신호도 함께 정리했습니다.',
  ogTitle: '기저귀 사이즈 계산기 — 몇 단계 써야 할까',
  ogDesc: '체중으로 보는 기저귀 사이즈 구간과 교체 신호 정리.',
  h1: '기저귀 사이즈 계산기', crumbName: '기저귀 사이즈',
  lead: '지금 체중이면 몇 단계일까요? 일반 참고 구간과 사이즈를 올려야 하는 신호를 알려 드려요.',
  notice: '⚠ 브랜드·제품별 실제 사이즈 구간은 서로 다릅니다. 구매 전 <strong>제조사 공식 사이즈표</strong>를 반드시 확인하세요. 이 페이지는 참고용입니다.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 체중</h2>
    <div class="row2">
      <div class="field">
        <label for="kg">체중 (kg)</label>
        <input type="number" id="kg" min="1" max="30" step="0.1" required placeholder="예: 8.5">
      </div>
      <div class="field">
        <label for="type">사용 형태</label>
        <select id="type">
          <option value="tape">밴드형(테이프)</option>
          <option value="pants">팬티형</option>
        </select>
      </div>
    </div>
    <button class="btn" type="submit">사이즈 찾기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>추천 사이즈</h2>
    <p class="res-big" id="sizeBig">—</p>
    <p class="res-sub" id="sizeSub"></p>
    <div id="sizeList"></div>
    <p class="res-sub" id="typeNote" style="margin-top:10px"></p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>`,
  introTitle: '사이즈는 어떻게 고르나요?',
  introHtml: '<p>기저귀 사이즈는 <strong>체중 구간</strong>을 기준으로 나뉩니다. 다만 같은 "M"이라도 브랜드마다 커버하는 체중과 실제 크기가 달라, 아래 표는 <span class="badge todo">확인 필요</span> 상태의 <strong>일반 참고 구간</strong>입니다. 최종 확인은 제조사 공식 사이즈표에서 하세요.</p>' +
    '<p>체중이 두 구간에 걸칠 때는 <strong>허벅지·허리 둘레와 활동량</strong>을 함께 봅니다. 같은 체중이라도 통통한 허벅지라면 큰 사이즈가 새는 일이 적습니다.</p>',
  howtoHtml: '<ol><li>최근에 잰 체중을 입력합니다.</li><li>해당하는 사이즈 구간이 표시됩니다(겹치는 구간은 모두 표시).</li><li>아래 교체 신호를 보고 지금 사이즈가 맞는지 점검하세요.</li></ol>',
  extraHtml: '<h2>일반 참고 사이즈 구간</h2>\n    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>사이즈</th><th>참고 체중</th><th>근거</th></tr></thead><tbody>\n        ' + diaperRows + '\n      </tbody></table></div>' +
    '<h2>사이즈를 올릴 때가 됐다는 신호</h2>\n    <ul>' + FIT_TIPS.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
    '<h2>새는 이유는 사이즈만이 아니에요</h2>' +
    '<ul><li>허리 밴드가 배꼽 아래로 내려가 있으면 위로 올려 채웁니다.</li><li>다리 안쪽 주름(프릴)이 안으로 말려 있으면 밖으로 펴 줍니다.</li><li>테이프를 너무 헐겁게 채우면 옆으로 샙니다.</li><li>흡수량을 넘긴 경우라면 사이즈보다 교체 주기를 줄이는 것이 답입니다.</li></ul>',
  faq: [
    { q: '체중이 두 사이즈에 걸쳐요.', a: '두 사이즈 모두 사용 가능한 구간입니다. 자국이 남거나 자주 샌다면 큰 쪽을, 헐거워 새는 느낌이면 작은 쪽을 선택하세요. 밤에는 한 단계 큰 사이즈를 쓰는 경우도 많습니다.' },
    { q: '팬티형은 언제부터 쓰나요?', a: '정해진 시점은 없고, 뒤집기·기기가 활발해져 눕혀 채우기 어려워질 때 넘어가는 경우가 많습니다. 두 형태를 함께 쓰기도 합니다.' },
    { q: '브랜드를 바꾸면 사이즈도 바뀌나요?', a: '네, 같은 표기라도 실제 크기가 다를 수 있습니다. 브랜드를 바꿀 때는 대용량을 사기 전에 소량으로 먼저 시험해 보세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + DIAPER_SRC.name + ' (확인일 ' + DIAPER_SRC.checkedAt + '). 표의 구간은 브랜드 공통 관행 수준의 일반 참고값으로 <span class="badge todo">확인 필요</span> 상태이며, 브랜드별 공식 사이즈표와는 다를 수 있습니다.',
  disclaimer: '기저귀 사이즈 안내는 참고용입니다. 피부 발진·자극이 지속되면 소아과 전문의와 상담하세요.',
  appCategory: 'LifestyleApplication',
  related: [
    { href: '@UP@growth-percentile/', ic: '📈', name: '성장 백분위 계산기' },
    { href: '@UP@baby-cost/', ic: '💰', name: '육아 비용 계산기' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    REL_TEC.age, REL_TEC.due,
  ],
  script: `import { GENERIC_SIZES } from '@UP@data/diaper.mjs';
const $ = (s) => document.querySelector(s);
const KEY = 'bc-diaper-kg';

function calc(kg, type) {
  const hits = GENERIC_SIZES.filter((s) => kg >= s.min && kg <= s.max);
  if (!hits.length) {
    $('#sizeBig').textContent = '해당 구간 없음';
    $('#sizeSub').textContent = '체중 ' + kg + 'kg — 일반 참고 구간을 벗어났습니다. 제조사 공식 사이즈표를 확인하세요.';
    $('#sizeList').innerHTML = '';
  } else {
    $('#sizeBig').innerHTML = hits.map((h) => h.size).join(' 또는 ') + ' <span class="badge todo">확인 필요</span>';
    $('#sizeSub').textContent = '체중 ' + kg + 'kg 기준 일반 참고 구간 · 브랜드 공식 사이즈표가 우선입니다.';
    $('#sizeList').innerHTML = hits.map((h) =>
      '<div class="kv"><span class="k">' + h.size + '</span><span class="v">' + h.note + '</span></div>').join('');
  }
  $('#typeNote').textContent = type === 'pants'
    ? '팬티형은 같은 표기라도 밴드형보다 작게 느껴지는 경우가 있어, 활동량이 많으면 한 단계 크게 쓰기도 합니다.'
    : '밴드형은 테이프 위치를 좌우 대칭으로 채우고 다리 주름을 밖으로 펴 주면 새는 것을 크게 줄일 수 있습니다.';
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = parseFloat($('#kg').value);
  if (!(kg > 0)) return;
  bcStore.set(KEY, kg);
  calc(kg, $('#type').value);
});

const saved = bcStore.get(KEY, null);
if (saved) { $('#kg').value = saved; calc(saved, $('#type').value); }`,
};

/* ───────────────────────── 8. 어린이집 입소 D-day ───────────────────────── */
const priorityChecks = PRIORITY_ITEMS.map((p) =>
  '<label class="chk-item"><input type="checkbox" class="pri" data-id="' + p.id + '" data-points="' + p.points + '">' +
  '<span class="chk-tx">' + esc(p.label) + '<span class="chk-sub">' + p.rank + '순위 · ' + p.points + '점 (배점 확인 필요)</span></span></label>').join('\n      ');

const daycareDday = {
  slug: 'daycare-dday', emoji: '🏫',
  title: '어린이집 입소 D-day 계산기 — 대기 우선순위 점수 함께 보기 | BabyCalc',
  desc: '어린이집 입소 희망일까지 남은 D-day와 아기의 입소 시점 월령을 계산하고, 아이사랑 입소대기 우선순위 항목을 체크해 예상 점수를 확인합니다. 배점은 연도별 보육사업안내 개정에 따라 달라집니다.',
  ogTitle: '어린이집 입소 D-day + 우선순위 점수',
  ogDesc: '입소 희망일 D-day와 대기 우선순위 항목 점수를 한 번에.',
  h1: '어린이집 입소 D-day 계산기', crumbName: '어린이집 입소',
  lead: '입소 희망일까지 며칠 남았는지, 우선순위 항목은 몇 점인지 함께 확인해 보세요.',
  notice: '⚠ 우선순위 배점은 <strong>연도별 「보육사업안내」 개정</strong>에 따라 달라집니다. 실제 대기 순번은 <a href="https://www.childcare.go.kr" target="_blank" rel="noopener">아이사랑 포털</a>에서 확인하세요. 이 페이지는 참고용입니다.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>입소 정보</h2>
    <div class="row2">
      <div class="field">
        <label for="birth">아기 생년월일</label>
        <input type="date" id="birth" required>
      </div>
      <div class="field">
        <label for="target">입소 희망일</label>
        <input type="date" id="target" required>
      </div>
    </div>
    <h2 style="margin-top:16px">우선순위 항목 (해당하는 항목 체크)</h2>
    <div id="pribox">
      ${priorityChecks}
    </div>
    <button class="btn" type="submit" style="margin-top:12px">계산하기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>계산 결과</h2>
    <p class="res-big" id="ddayBig">—</p>
    <p class="res-sub" id="ddaySub"></p>
    <div class="kv"><span class="k">입소 시점 월령</span><span class="v" id="kAge">—</span></div>
    <div class="kv"><span class="k">해당 반 (일반적 구분)</span><span class="v" id="kClass">—</span></div>
    <div class="kv"><span class="k">예상 우선순위 점수</span><span class="v" id="kScore">—</span></div>
    <div id="priList"></div>
    <p class="res-sub" style="margin-top:12px">점수는 체크한 항목의 배점을 단순 합산한 <strong>참고값</strong>입니다 <span class="badge todo">확인 필요</span>. 실제 배점·합산 규칙은 해당 연도 보육사업안내와 지자체 기준을 따릅니다.</p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>`,
  introTitle: '입소 대기는 어떻게 정해지나요?',
  introHtml: '<p>어린이집 입소 대기는 <strong>아이사랑 포털(childcare.go.kr)</strong>에서 신청하고, 보건복지부 「보육사업안내」의 우선순위 기준에 따라 순번이 정해집니다. 1순위 항목(맞벌이·다자녀·형제자매 재원 등)은 각 100점, 2순위 항목은 50점으로 합산하는 방식이 널리 알려져 있으나, <strong>항목과 배점은 개정될 수 있습니다</strong>.</p>' +
    '<p>같은 점수일 때는 신청일이 빠른 순 등 세부 기준이 적용되고, 국공립·직장·민간 등 어린이집 유형에 따라 별도 우선순위가 있습니다.</p>',
  howtoHtml: '<ol><li>아기 생년월일과 입소 희망일을 입력합니다.</li>' +
    '<li>해당하는 우선순위 항목을 체크합니다.</li>' +
    '<li>입소 시점의 월령과 예상 점수를 확인하고, 실제 신청은 아이사랑 포털에서 진행하세요.</li></ol>',
  extraHtml: '<h2>알아 두면 좋은 점</h2>\n    <ul>' + DAYCARE_NOTES.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' +
    '<h2>대기 신청 팁</h2>' +
    '<ul><li>대기 신청은 <strong>여러 곳에 동시에</strong> 넣을 수 있습니다(가능 개수는 포털 기준 확인).</li>' +
    '<li>3월 신학기 전후로 자리가 가장 많이 나므로 역산해서 미리 신청해 두는 편이 좋습니다.</li>' +
    '<li>신청 후에도 정보가 바뀌면(맞벌이 시작 등) 갱신해야 점수에 반영됩니다.</li>' +
    '<li>입소 확정 후에는 필요 서류(재직증명서·가족관계증명서 등)를 기한 내 제출해야 합니다.</li></ul>',
  faq: [
    { q: '맞벌이면 무조건 1순위인가요?', a: '맞벌이는 대표적인 1순위 항목으로 안내되지만, 항목과 배점은 해당 연도 보육사업안내와 지자체 운영 기준에 따라 달라질 수 있습니다. 반드시 아이사랑 포털과 관할 지자체에서 확인하세요.' },
    { q: '점수가 같으면 어떻게 정해지나요?', a: '동점일 때는 신청일이 빠른 순 등 세부 기준이 적용되는 것이 일반적입니다. 구체적인 규칙은 어린이집·지자체마다 다를 수 있습니다.' },
    { q: '몇 개월부터 보낼 수 있나요?', a: '어린이집은 0세반부터 운영되지만 반 편성과 정원은 시설마다 다릅니다. 만 나이 기준으로 반이 나뉘며, 3월 학기 기준으로 반이 올라갑니다.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + DAYCARE_SRC.name + ' — <a href="' + DAYCARE_SRC.url + '" target="_blank" rel="noopener">childcare.go.kr</a> (확인일 ' + DAYCARE_SRC.checkedAt + '). ' +
    '배점표는 최신 연도 「보육사업안내」와 대조가 필요한 <span class="badge todo">확인 필요</span> 상태입니다.',
  disclaimer: '입소 점수 계산은 참고용이며 실제 심사 결과가 아닙니다. 신청·심사는 아이사랑 포털과 관할 지자체 기준을 따릅니다.',
  appCategory: 'LifestyleApplication',
  related: [
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@baby-cost/', ic: '💰', name: '육아 비용 계산기' },
    { href: '@UP@vaccine-schedule/', ic: '💉', name: '예방접종 일정표' },
    REL_TEC.age, REL_TEC.vaccine,
  ],
  script: `import { mkDate, babyAge, diffDays, fmtDateKo } from '@UP@assets/calc.mjs';
import { PRIORITY_ITEMS } from '@UP@data/daycare.mjs';
const $ = (s) => document.querySelector(s);
const BKEY = 'bc-baby-birth';
const KEY = 'bc-daycare';

function classOf(m) {
  if (m < 12) return '0세반 (만 0세)';
  if (m < 24) return '1세반 (만 1세)';
  if (m < 36) return '2세반 (만 2세)';
  if (m < 48) return '3세반 (만 3세)';
  return '4세반 이상';
}

function calc(birth, target, ids) {
  const today = new Date();
  const d = diffDays(today, target);
  $('#ddayBig').textContent = d > 0 ? '입소까지 D-' + d : (d === 0 ? '입소일 오늘 🎉' : '입소일에서 D+' + (-d));
  $('#ddaySub').textContent = fmtDateKo(target) + ' 입소 희망 기준';
  const a = babyAge(birth, target);
  if (a) {
    $('#kAge').textContent = a.months + '개월 ' + a.days + '일';
    $('#kClass').textContent = classOf(a.months);
  } else {
    $('#kAge').textContent = '—'; $('#kClass').textContent = '—';
  }
  const hits = PRIORITY_ITEMS.filter((p) => ids.indexOf(p.id) >= 0);
  const score = hits.reduce((s, p) => s + p.points, 0);
  $('#kScore').innerHTML = score + '점 <span class="badge todo">확인 필요</span>';
  $('#priList').innerHTML = hits.length
    ? '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>해당 항목</th><th>순위</th><th>배점</th></tr></thead><tbody>' +
      hits.map((h) => '<tr><td>' + h.label + '</td><td>' + h.rank + '순위</td><td>' + h.points + '점</td></tr>').join('') +
      '</tbody></table></div>'
    : '<p class="res-sub">체크한 우선순위 항목이 없습니다. 일반 신청으로 대기하게 됩니다.</p>';
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const b = $('#birth').value, t = $('#target').value;
  if (!b || !t) return;
  const ids = Array.prototype.map.call(document.querySelectorAll('.pri:checked'), (c) => c.dataset.id);
  bcStore.set(BKEY, b);
  bcStore.set(KEY, { t, ids });
  calc(mkDate(b), mkDate(t), ids);
});

const sb = bcStore.get(BKEY, null);
if (sb) $('#birth').value = sb;
const sd = bcStore.get(KEY, null);
if (sd && sd.t) {
  $('#target').value = sd.t;
  (sd.ids || []).forEach((id) => {
    const el = document.querySelector('.pri[data-id="' + id + '"]');
    if (el) el.checked = true;
  });
  if (sb) calc(mkDate(sb), mkDate(sd.t), sd.ids || []);
}`,
};

/* ───────────────────────── 9. 육아 비용 계산기 ───────────────────────── */
const costFields = COST_ITEMS.map((c) =>
  '<div class="field"><label for="c-' + c.id + '">' + esc(c.name) + '</label>' +
  '<input type="number" class="cost" id="c-' + c.id + '" data-id="' + c.id + '" data-name="' + esc(c.name) + '" min="0" step="1000" placeholder="0">' +
  (c.hint ? '<p class="hint">' + esc(c.hint) + '</p>' : '') + '</div>').join('\n      ');

const supportRows = SUPPORTS.map((s) =>
  '<tr><td>' + esc(s.name) + '</td><td>' + (s.monthly ? won(s.monthly) + ' / 월' : won(s.once) + ' (일시금)') + '</td><td>' + esc(s.note) + '</td><td><span class="badge todo">' + esc(s.todo || '확인 필요') + '</span></td></tr>').join('\n        ');

const babyCost = {
  slug: 'baby-cost', emoji: '💰',
  title: '육아 비용 계산기 — 월 지출과 부모급여·아동수당 차감 | BabyCalc',
  desc: '분유·기저귀·의류 등 월 지출을 입력하고 아기 월령을 넣으면 부모급여·아동수당 등 정부 지원금을 뺀 실제 부담액을 계산합니다. 지원금 금액은 연도별로 달라지므로 복지로에서 확인이 필요합니다.',
  ogTitle: '육아 비용 계산기 — 지원금 빼면 얼마?',
  ogDesc: '월 지출 입력 → 부모급여·아동수당 차감 후 실부담액 계산.',
  h1: '육아 비용 계산기', crumbName: '육아 비용',
  lead: '한 달에 얼마나 들까요? 지출을 적어 보고 지원금을 뺀 실제 부담액을 확인해 보세요.',
  notice: '⚠ 지원금 금액·지급 요건은 <strong>매년 달라질 수 있습니다</strong>. 신청 전 <a href="https://www.bokjiro.go.kr" target="_blank" rel="noopener">복지로</a>에서 반드시 확인하세요. 이 페이지는 참고용이며 금융·행정 자문이 아닙니다.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="field">
      <label for="month">아기 월령 (개월)</label>
      <input type="number" id="month" min="0" max="95" step="1" required placeholder="예: 8">
      <p class="hint">지원금 해당 여부를 판단하는 데만 사용합니다.</p>
    </div>
    <h2 style="margin-top:16px">월 지출 항목 (원)</h2>
    <div class="row2">
      ${costFields}
    </div>
    <button class="btn" type="submit">계산하기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>계산 결과</h2>
    <p class="res-big" id="netBig">—</p>
    <p class="res-sub" id="netSub">지원금을 뺀 월 실부담액</p>
    <div class="kv"><span class="k">월 지출 합계</span><span class="v" id="kOut">—</span></div>
    <div class="kv"><span class="k">월 지원금 합계</span><span class="v" id="kIn">—</span></div>
    <div class="kv"><span class="k">연간 환산 실부담</span><span class="v" id="kYear">—</span></div>
    <div id="breakdown"></div>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" id="csvBtn">내역 CSV 내보내기</button>
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
      <button class="btn sm danger" type="button" id="clearBtn">입력 전체 삭제</button>
    </div>
    <p class="local-note">✅ 입력한 금액은 이 브라우저(localStorage)에만 저장됩니다. <strong>서버 저장 없음.</strong></p>
  </section>`,
  introTitle: '어떻게 계산하나요?',
  introHtml: '<p>입력한 <strong>월 지출 합계</strong>에서, 아기 월령에 해당하는 <strong>월 지원금</strong>(부모급여·아동수당)을 빼서 실부담액을 계산합니다. 첫만남이용권처럼 일시금으로 받는 항목은 월 계산에 넣지 않고 따로 표시합니다.</p>' +
    '<p>지원금 금액은 <span class="badge todo">확인 필요</span> 상태입니다 — 2025년 기준으로 확인된 값이며 이후 개정 여부를 대조하지 못했습니다. 실제 수령액은 어린이집·유치원 이용 여부(보육료 바우처 차감)에 따라서도 달라집니다.</p>',
  howtoHtml: '<ol><li>아기 월령을 입력합니다(지원금 해당 여부 판단용).</li>' +
    '<li>한 달 지출을 항목별로 적습니다. 모르는 항목은 비워 두어도 됩니다.</li>' +
    '<li>지원금을 뺀 실부담액과 연간 환산액을 확인하고, 내역은 CSV로 내보낼 수 있습니다.</li></ol>',
  extraHtml: '<h2>정부 지원금 (참고)</h2>\n    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>지원</th><th>금액</th><th>내용</th><th>근거</th></tr></thead><tbody>\n        ' + supportRows + '\n      </tbody></table></div>' +
    '<p>이 밖에도 지자체별 출산·양육 지원금, 아이돌봄서비스, 전기요금 할인 등 별도 제도가 있습니다. 거주 지역 기준은 관할 주민센터나 복지로에서 확인하세요.</p>' +
    '<h2>지출을 줄이는 현실적인 방법</h2>' +
    '<ul><li>기저귀·분유는 사용량이 안정된 뒤에 대용량으로 사는 편이 낭비가 적습니다.</li>' +
    '<li>옷·장난감은 성장 속도가 빨라 대여·중고 활용 여지가 큽니다.</li>' +
    '<li>예방접종은 국가예방접종 지원 대상이면 지정 의료기관에서 무료입니다.</li>' +
    '<li>영유아 건강검진은 시기별 무료이며, 놓치면 자비 부담이 될 수 있습니다.</li></ul>',
  faq: [
    { q: '부모급여와 아동수당을 함께 받을 수 있나요?', a: '두 제도는 별개로 운영되어 중복 수급이 가능하다고 안내됩니다. 다만 요건과 금액은 연도별로 달라질 수 있으니 복지로에서 확인하세요.' },
    { q: '어린이집에 다니면 부모급여는 어떻게 되나요?', a: '어린이집을 이용하면 보육료 바우처로 지원되고, 부모급여에서 그만큼 차감되는 방식으로 안내됩니다. 실제 수령액은 이용 여부에 따라 달라집니다.' },
    { q: '금액이 실제와 다른데요?', a: '이 계산기의 지원금은 2025년 기준으로 확인된 값이며 이후 개정을 반영하지 못했을 수 있습니다. 신청 전 반드시 복지로나 주민센터에서 확인하세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + COST_SRC.name + ' — <a href="' + COST_SRC.url + '" target="_blank" rel="noopener">bokjiro.go.kr</a> (확인일 ' + COST_SRC.checkedAt + '). ' +
    '금액은 2025년 기준 확인값이며 <strong>이후 연도 개정 여부는 확인 필요</strong>합니다. 월 지출 프리셋은 통계값이 아니라 입력 편의를 위한 항목 목록입니다.',
  disclaimer: '비용·지원금 계산은 참고용이며 금융·행정 자문이 아닙니다. 지원금 수급 자격과 금액은 반드시 복지로 및 관할 기관에서 확인하세요.',
  appCategory: 'FinanceApplication',
  related: [
    { href: '@UP@daycare-dday/', ic: '🏫', name: '어린이집 입소 D-day' },
    { href: '@UP@diaper-size/', ic: '🧷', name: '기저귀 사이즈 찾기' },
    { href: '@UP@formula-amount/', ic: '🍼', name: '분유 수유량 계산기' },
    REL_TEC.due, REL_TEC.age,
  ],
  script: `import { SUPPORTS } from '@UP@data/cost.mjs';
const $ = (s) => document.querySelector(s);
const KEY = 'bc-cost';
const won = (n) => n.toLocaleString('ko-KR') + '원';

function monthlySupports(m) {
  const out = [];
  SUPPORTS.forEach((s) => {
    if (s.id === 'parent-benefit-0' && m <= 11) out.push(s);
    else if (s.id === 'parent-benefit-1' && m >= 12 && m <= 23) out.push(s);
    else if (s.id === 'child-allowance' && m < 96) out.push(s);
  });
  return out;
}

function calc(month, vals) {
  let out = 0;
  const rows = [];
  document.querySelectorAll('.cost').forEach((el) => {
    const v = parseInt(el.value, 10) || 0;
    if (v > 0) rows.push({ name: el.dataset.name, v });
    out += v;
  });
  const sup = monthlySupports(month);
  const inSum = sup.reduce((s, x) => s + (x.monthly || 0), 0);
  const net = out - inSum;
  $('#netBig').textContent = (net >= 0 ? '' : '+') + won(Math.abs(net)) + (net >= 0 ? '' : ' 여유');
  $('#netSub').textContent = '생후 ' + month + '개월 기준 · 월 지출에서 월 지원금을 뺀 값';
  $('#kOut').textContent = won(out);
  $('#kIn').textContent = won(inSum);
  $('#kYear').textContent = won(net * 12);
  const once = SUPPORTS.find((s) => s.once);
  $('#breakdown').innerHTML =
    '<h2 style="font-size:15px;margin-top:16px">적용된 지원금</h2>' +
    (sup.length
      ? '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>지원</th><th>월 금액</th><th>근거</th></tr></thead><tbody>' +
        sup.map((s) => '<tr><td>' + s.name + '</td><td>' + won(s.monthly) + '</td><td><span class="badge todo">확인 필요</span></td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="res-sub">해당하는 월 지원금이 없습니다.</p>') +
    (once ? '<p class="res-sub">※ ' + once.name + '은 일시금이라 월 계산에 포함하지 않았습니다 (' + once.note + ').</p>' : '') +
    (rows.length
      ? '<h2 style="font-size:15px;margin-top:16px">지출 내역</h2><div class="tbl-scroll"><table class="tbl"><thead><tr><th>항목</th><th>금액</th><th>비중</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td>' + r.name + '</td><td>' + won(r.v) + '</td><td>' + (out ? Math.round(r.v / out * 100) : 0) + '%</td></tr>').join('') +
        '</tbody></table></div>'
      : '');
  bcShowResult('result');
}

function readVals() {
  const v = { month: parseInt($('#month').value, 10) || 0, items: {} };
  document.querySelectorAll('.cost').forEach((el) => { v.items[el.dataset.id] = parseInt(el.value, 10) || 0; });
  return v;
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = parseInt($('#month').value, 10);
  if (isNaN(m)) return;
  bcStore.set(KEY, readVals());
  calc(m);
});
$('#csvBtn').addEventListener('click', () => {
  const lines = ['구분,항목,금액'];
  document.querySelectorAll('.cost').forEach((el) => {
    const v = parseInt(el.value, 10) || 0;
    if (v > 0) lines.push(['지출', el.dataset.name, v].map(bcCsvCell).join(','));
  });
  monthlySupports(parseInt($('#month').value, 10) || 0).forEach((s) => lines.push(['지원금', s.name, s.monthly].map(bcCsvCell).join(',')));
  bcDownload('baby-cost.csv', '\\ufeff' + lines.join('\\n'), 'text/csv');
});
$('#clearBtn').addEventListener('click', () => {
  if (confirm('입력한 금액을 모두 삭제할까요? (이 브라우저에서만 삭제됩니다)')) {
    bcStore.del(KEY);
    document.querySelectorAll('.cost').forEach((el) => { el.value = ''; });
  }
});

const saved = bcStore.get(KEY, null);
if (saved) {
  if (saved.month) $('#month').value = saved.month;
  Object.keys(saved.items || {}).forEach((k) => {
    const el = document.querySelector('.cost[data-id="' + k + '"]');
    if (el && saved.items[k]) el.value = saved.items[k];
  });
  if (saved.month) calc(saved.month);
}`,
};

/* ───────────────────────── 10. 이름 느낌 체크 (오락용) ───────────────────────── */
const nameCheck = {
  slug: 'name-check', emoji: '✨',
  title: '아기 이름 느낌 체크 — 부르기 쉬운 이름인지 재미로 보기 | BabyCalc',
  desc: '아기 이름의 음절 수, 받침 비율, 초성 조합을 분석해 부르기 쉬운 정도를 재미로 보여 줍니다. 작명·사주·운세가 아니며 오락용입니다. 입력한 이름은 서버로 전송되지 않습니다.',
  ogTitle: '아기 이름 느낌 체크 (오락용)',
  ogDesc: '음절·받침·초성으로 보는 이름의 소리 느낌 — 재미로만 보세요.',
  h1: '아기 이름 느낌 체크', crumbName: '이름 느낌 체크',
  lead: '고민 중인 이름을 소리 관점에서 재미로 살펴보는 도구예요. 작명이나 운세가 아닙니다.',
  notice: '🎈 이 페이지는 <strong>오락용</strong>입니다. <strong>작명·사주·운세·성명학이 아니며</strong> 결과에 어떤 예측이나 판단의 의미도 없습니다. 입력한 이름은 브라우저 밖으로 전송되지 않으며 저장하지도 않습니다.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>이름 입력</h2>
    <div class="field">
      <label for="name">한글 이름 (성 제외 권장)</label>
      <input type="text" id="name" maxlength="10" required placeholder="예: 하윤" autocomplete="off" inputmode="text">
      <p class="hint">입력값은 이 브라우저 안에서만 계산에 쓰이고 <strong>서버로 전송되지 않으며 저장하지도 않습니다</strong>. 실명 대신 후보 이름만 넣어 보셔도 됩니다.</p>
    </div>
    <button class="btn" type="submit">재미로 보기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>소리 분석 <span class="badge warn">오락용</span></h2>
    <p class="res-big" id="scoreBig">—</p>
    <p class="res-sub" id="scoreSub"></p>
    <div class="bar" aria-hidden="true"><span id="scoreBar" style="width:0"></span></div>
    <div class="kv"><span class="k">음절 수</span><span class="v" id="kSyl">—</span></div>
    <div class="kv"><span class="k">받침 있는 음절</span><span class="v" id="kJong">—</span></div>
    <div class="kv"><span class="k">초성</span><span class="v" id="kCho">—</span></div>
    <div class="kv"><span class="k">로마자 표기 (간이)</span><span class="v" id="kRoman">—</span></div>
    <p class="res-sub" id="comment" style="margin-top:12px"></p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" id="copyBtn">결과 복사</button>
    </div>
    <p class="local-note">이 결과는 글자의 소리 구조만 본 <strong>재미용 지표</strong>입니다. 이름의 좋고 나쁨을 판단하지 않습니다.</p>
  </section>`,
  introTitle: '무엇을 보나요?',
  introHtml: '<p>한글 음절은 <strong>초성 + 중성 + (받침)</strong> 구조로 분해할 수 있습니다. 이 도구는 입력한 이름을 이 구조로 나눠서 음절 수, 받침이 있는 음절의 비율, 초성이 반복되는지 등을 세어 <strong>"소리 내기 편한 정도"를 재미로</strong> 수치화합니다.</p>' +
    '<p>이 수치는 언어학적 기준도, 작명 기준도 아닙니다. <strong>운세·사주·성명학과는 아무 관계가 없고</strong>, 이름의 좋고 나쁨이나 아이의 미래에 대해 어떤 것도 말하지 않습니다. 순수하게 재미로만 봐 주세요.</p>',
  howtoHtml: '<ol><li>고민 중인 이름을 한글로 입력합니다(성은 빼도 됩니다).</li><li>음절·받침·초성 분석과 재미 점수가 나옵니다.</li><li>후보 이름을 바꿔 가며 소리 느낌을 비교해 보세요.</li></ol>',
  extraHtml: '<h2>이름 지을 때 실제로 확인해야 하는 것</h2>' +
    '<ul><li><strong>인명용 한자·표기 가능 여부</strong> — 출생신고 시 사용할 수 있는 글자인지 확인이 필요합니다.</li>' +
    '<li><strong>출생신고 기한</strong> — 출생 후 1개월 이내가 원칙입니다.</li>' +
    '<li>발음했을 때 성과 이어 부르기 자연스러운지, 별명이 되기 쉬운 소리는 아닌지.</li>' +
    '<li>영문 표기가 지나치게 길거나 오해를 부르지 않는지.</li></ul>' +
    '<p>이 도구의 로마자 표기는 규칙을 단순 적용한 <strong>간이 변환</strong>이라 공식 표기(여권 표기 등)와 다를 수 있습니다.</p>',
  faq: [
    { q: '점수가 낮으면 나쁜 이름인가요?', a: '전혀 아닙니다. 이 점수는 받침 비율·음절 수 같은 소리 구조만 본 재미용 수치이고, 이름의 가치와는 아무 관련이 없습니다.' },
    { q: '사주나 작명 결과인가요?', a: '아닙니다. 이 페이지는 사주·성명학·운세와 무관한 오락용 도구입니다. 어떤 예측도 제공하지 않습니다.' },
    { q: '입력한 이름이 저장되나요?', a: '저장되지 않습니다. 계산은 브라우저 안에서만 이뤄지고 서버로 전송되지 않으며, 이 페이지는 이름을 localStorage에도 저장하지 않습니다.' },
  ],
  srcHtml: '<strong>계산 방식</strong> · 한글 유니코드 음절 분해(초성 19 / 중성 21 / 종성 28)로 구조를 세는 자체 규칙입니다. 공신력 있는 기준이 아니라 <strong>오락용 자체 지표</strong>이며, 로마자 표기는 규칙을 단순 적용한 간이 변환입니다.',
  disclaimer: '이 페이지는 오락용입니다. 작명·사주·운세·성명학이 아니며, 결과에 어떤 예측이나 판단의 의미도 없습니다.',
  appCategory: 'EntertainmentApplication',
  related: [
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@milestone/', ic: '🧸', name: '발달 이정표 체크' },
    { href: 'https://tomatoeggcat.com/dydrms-taemyeong/', ic: '🍅', name: '태명 짓기 (TomatoEggCat)' },
    { href: 'https://tomatoeggcat.com/due-date-calc/', ic: '🍅', name: '출산 예정일 계산기' },
  ],
  script: `const $ = (s) => document.querySelector(s);
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_R = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const JUNG_R = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const JONG_R = ['','k','k','k','n','n','n','t','l','k','m','b','l','l','l','l','m','b','b','t','t','ng','t','t','k','t','p','t'];

function decompose(ch) {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return null;
  return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 };
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = $('#name').value.trim().replace(/\\s+/g, '');
  if (!raw) return;
  const parts = [];
  for (const ch of raw) {
    const d = decompose(ch);
    if (d) parts.push(d);
  }
  if (!parts.length) {
    $('#scoreBig').textContent = '한글 이름을 입력해 주세요';
    $('#scoreSub').textContent = '완성형 한글 음절만 분석할 수 있어요.';
    bcShowResult('result');
    return;
  }
  const syl = parts.length;
  const jong = parts.filter((p) => p.jong > 0).length;
  const chos = parts.map((p) => CHO[p.cho]);
  const uniqCho = new Set(chos).size;
  const roman = parts.map((p) => CHO_R[p.cho] + JUNG_R[p.jung] + JONG_R[p.jong]).join('');

  /* 재미용 지표: 받침이 적고, 음절이 2~3개이며, 초성이 겹치지 않을수록 높게 */
  let score = 60;
  score += (syl === 2 || syl === 3) ? 15 : (syl === 1 ? -5 : -10);
  score += Math.round((1 - jong / syl) * 18);
  score += (uniqCho === syl) ? 7 : 0;
  score = Math.max(20, Math.min(99, score));

  $('#scoreBig').innerHTML = '부르기 쉬움 ' + score + '<span class="unit"> / 100</span>';
  $('#scoreSub').textContent = '"' + raw + '" · 오락용 지표라 아무 의미도 없어요 😊';
  $('#scoreBar').style.width = score + '%';
  $('#kSyl').textContent = syl + '음절';
  $('#kJong').textContent = jong + ' / ' + syl + '음절 (' + Math.round(jong / syl * 100) + '%)';
  $('#kCho').textContent = chos.join(' · ');
  $('#kRoman').textContent = roman.charAt(0).toUpperCase() + roman.slice(1);

  const notes = [];
  notes.push(syl === 2 ? '두 음절 이름은 성과 이어 부를 때 리듬이 잘 맞는 편이에요.' : (syl === 3 ? '세 음절 이름은 개성이 잘 드러나는 길이예요.' : (syl === 1 ? '한 음절 이름은 짧고 강한 인상을 줘요.' : '긴 이름은 애칭이 자연스럽게 생기곤 해요.')));
  notes.push(jong === 0 ? '받침이 없어 소리가 부드럽게 이어져요.' : (jong === syl ? '받침이 많아 또렷하고 단단한 소리예요.' : '받침이 섞여 있어 발음의 균형이 좋아요.'));
  if (uniqCho < syl) notes.push('같은 초성이 반복돼 리듬감이 생겨요.');
  notes.push('다시 말하지만 이건 소리 구조만 본 <strong>재미용</strong>이에요. 작명·사주와는 아무 관계가 없습니다.');
  $('#comment').innerHTML = notes.join(' ');
  bcShowResult('result');
});

$('#copyBtn').addEventListener('click', () => {
  const txt = $('#scoreBig').textContent + ' — ' + $('#kSyl').textContent + ', 받침 ' + $('#kJong').textContent + ' (오락용)';
  navigator.clipboard && navigator.clipboard.writeText(txt);
  $('#copyBtn').textContent = '복사됨!';
  setTimeout(() => { $('#copyBtn').textContent = '결과 복사'; }, 1500);
});`,
};

/* ───────────────────────── 11. 발달 이정표 체크 ───────────────────────── */
const msBlocks = MILESTONES.map((g) =>
  '<div class="ms-group" data-from="' + g.fromM + '" data-to="' + g.toM + '">' +
  '<h2 style="font-size:15px;margin:18px 0 6px">' + esc(g.range) + '</h2>' +
  g.items.map((it, i) =>
    '<label class="chk-item"><input type="checkbox" class="ms" data-key="' + g.fromM + '-' + i + '">' +
    '<span class="chk-tx">' + esc(it) + '</span></label>').join('') +
  '</div>').join('\n      ');

const milestone = {
  slug: 'milestone', emoji: '🧸',
  title: '아기 발달 이정표 체크리스트 — 월령별 대표 항목 | BabyCalc',
  desc: '생년월일을 입력하면 지금 월령에 해당하는 대표 발달 항목을 체크리스트로 보여 줍니다. 체크 기록은 브라우저에 저장되고 CSV·JSON으로 내보낼 수 있습니다. 선별검사·진단을 대신하지 않습니다.',
  ogTitle: '아기 발달 이정표 체크리스트',
  ogDesc: '월령별 대표 발달 항목을 체크하고 기록으로 남겨 보세요.',
  h1: '발달 이정표 체크리스트', crumbName: '발달 이정표',
  lead: '지금 월령에 흔히 나타나는 발달 항목을 체크해 보고, 영유아 건강검진 문진 준비에 참고해 보세요.',
  notice: '⚠ 이 체크리스트는 <strong>K-DST 원문 문항이 아니며 선별검사·진단을 대신할 수 없습니다</strong>. 참고용이며 진단이 아닙니다. 아이마다 발달 속도가 다르니, 걱정되면 <strong>소아과 전문의와 상담</strong>하세요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="field">
      <label for="birth">생년월일</label>
      <input type="date" id="birth" required>
      <p class="hint">이른둥이는 교정연령 기준으로 보는 것이 일반적입니다.</p>
    </div>
    <button class="btn" type="submit">내 월령 항목 보기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>지금 월령</h2>
    <p class="res-big" id="ageBig">—</p>
    <p class="res-sub" id="ageSub"></p>
    <div class="bar" aria-hidden="true"><span id="progBar" style="width:0"></span></div>
    <p class="res-sub" id="progTxt"></p>
  </section>

  <section class="card">
    <h2>발달 항목 체크</h2>
    <div class="btnrow no-print" style="margin:0 0 6px">
      <button class="btn sm sec" type="button" id="toggleAll">전체 구간 보기 / 내 월령만 보기</button>
    </div>
    <div id="msList">
      ${msBlocks}
    </div>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" id="csvBtn">체크 CSV 내보내기</button>
      <button class="btn sm sec" type="button" id="jsonBtn">체크 JSON 내보내기</button>
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
      <button class="btn sm danger" type="button" id="clearBtn">체크 전체 삭제</button>
    </div>
    <p class="local-note">✅ 체크 기록은 이 브라우저(localStorage)에만 저장됩니다. <strong>서버 저장 없음.</strong></p>
  </section>`,
  introTitle: '이 체크리스트는 무엇인가요?',
  introHtml: '<p>월령대별로 흔히 나타나는 <strong>대표적인 발달 항목</strong>을 간추린 목록입니다. 영유아 건강검진 문진표를 작성하기 전에 아이를 관찰해 보는 용도로 쓰기 좋습니다.</p>' +
    '<p>다만 이것은 <strong>선별검사(K-DST)의 원문 문항이 아니고 진단 도구도 아닙니다</strong> <span class="badge todo">확인 필요</span>. 항목을 아직 못 한다고 해서 문제가 있다는 뜻이 아니며, 같은 월령이라도 아이마다 발달 순서와 속도가 다릅니다.</p>',
  howtoHtml: '<ol><li>생년월일을 입력하면 현재 월령 구간이 자동으로 표시됩니다.</li>' +
    '<li>아이가 할 수 있는 항목을 체크합니다. 체크는 브라우저에 저장돼 다음에 다시 열어도 유지됩니다.</li>' +
    '<li>"전체 구간 보기"로 이전·이후 월령 항목도 확인할 수 있고, CSV·JSON으로 내보낼 수 있습니다.</li></ol>',
  extraHtml: '<h2>영유아 건강검진</h2>\n    <p>' + esc(CHECKUP_NOTE) + '</p>' +
    '<h2>이런 경우에는 상담을 받아 보세요</h2>' +
    '<ul><li>이전에 하던 것을 더 이상 하지 않게 된 경우(발달 퇴행)</li>' +
    '<li>이름을 불러도 반응이 거의 없거나 눈맞춤이 잘 되지 않는 경우</li>' +
    '<li>또래보다 여러 영역에서 뚜렷하게 늦다고 느껴지는 경우</li>' +
    '<li>부모가 보기에 걱정이 지속되는 경우 — 이유가 분명하지 않아도 상담할 수 있습니다.</li></ul>',
  faq: [
    { q: '항목을 못 하면 발달 지연인가요?', a: '아닙니다. 발달에는 넓은 정상 범위가 있고 순서도 아이마다 다릅니다. 이 목록은 진단 기준이 아니라 관찰을 돕는 참고 목록입니다. 걱정되면 영유아 건강검진과 소아과 상담을 받으세요.' },
    { q: '이른둥이는 어떻게 보나요?', a: '일반적으로 만 2세 무렵까지는 교정연령을 기준으로 발달을 평가합니다. <a href="@UP@months-age/">개월수 계산기</a>에서 교정연령을 확인해 보세요.' },
    { q: 'K-DST와 같은 건가요?', a: '아닙니다. K-DST는 영유아 건강검진에서 사용하는 공식 발달선별검사이며, 이 체크리스트는 공개된 일반 발달 정보를 참고해 재구성한 목록입니다.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + MS_SRC.name + ' — <a href="' + MS_SRC.url + '" target="_blank" rel="noopener">health.kdca.go.kr</a> / <a href="' + MS_SRC.urlNhis + '" target="_blank" rel="noopener">nhis.or.kr</a> (확인일 ' + MS_SRC.checkedAt + '). ' +
    '항목은 공개 자료를 참고해 재구성한 <span class="badge todo">확인 필요</span> 수준의 목록이며 K-DST 원문 문항이 아닙니다.',
  disclaimer: '이 체크리스트는 참고용이며 발달 선별검사나 진단이 아닙니다. 발달이 걱정되면 영유아 건강검진을 받고 소아과 전문의와 상담하세요.',
  related: [
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@growth-percentile/', ic: '📈', name: '성장 백분위 계산기' },
    { href: '@UP@vaccine-schedule/', ic: '💉', name: '예방접종 일정표' },
    REL_TEC.vaccine, REL_TEC.age,
  ],
  script: `import { mkDate, babyAge, fmtDate } from '@UP@assets/calc.mjs';
const $ = (s) => document.querySelector(s);
const KEY = 'bc-milestone';
const BKEY = 'bc-baby-birth';
const groups = Array.prototype.slice.call(document.querySelectorAll('.ms-group'));
let showAll = false;
let curMonth = null;

function applyFilter() {
  groups.forEach((g) => {
    const from = parseInt(g.dataset.from, 10), to = parseInt(g.dataset.to, 10);
    const mine = curMonth != null && curMonth >= from && curMonth <= to;
    g.style.display = (showAll || curMonth == null || mine) ? '' : 'none';
    g.style.opacity = (!showAll && mine) ? '1' : '';
  });
}

function loadChecks() {
  const done = bcStore.get(KEY, {});
  document.querySelectorAll('.ms').forEach((cb) => { cb.checked = !!done[cb.dataset.key]; syncRow(cb); });
}
function syncRow(cb) {
  const item = cb.closest('.chk-item');
  if (item) item.classList.toggle('done', cb.checked);
}
function progress() {
  const vis = groups.filter((g) => g.style.display !== 'none');
  const boxes = [];
  vis.forEach((g) => Array.prototype.push.apply(boxes, Array.prototype.slice.call(g.querySelectorAll('.ms'))));
  const done = boxes.filter((b) => b.checked).length;
  const pct = boxes.length ? Math.round(done / boxes.length * 100) : 0;
  $('#progBar').style.width = pct + '%';
  $('#progTxt').textContent = '표시 중인 항목 ' + done + ' / ' + boxes.length + '개 체크 (' + pct + '%) · 못 한 항목이 있어도 이상이 있다는 뜻은 아닙니다.';
}

document.querySelectorAll('.ms').forEach((cb) => cb.addEventListener('change', () => {
  const done = bcStore.get(KEY, {});
  if (cb.checked) done[cb.dataset.key] = fmtDate(new Date()); else delete done[cb.dataset.key];
  bcStore.set(KEY, done);
  syncRow(cb);
  progress();
}));

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const b = $('#birth').value;
  if (!b) return;
  bcStore.set(BKEY, b);
  const a = babyAge(mkDate(b), new Date());
  if (!a) return;
  curMonth = a.months;
  $('#ageBig').textContent = '생후 ' + a.months + '개월 ' + a.days + '일';
  $('#ageSub').textContent = '해당 월령 구간의 항목만 표시하고 있어요. 전체를 보려면 아래 버튼을 누르세요.';
  showAll = false;
  applyFilter();
  progress();
  bcShowResult('result');
});

$('#toggleAll').addEventListener('click', () => { showAll = !showAll; applyFilter(); progress(); });
$('#csvBtn').addEventListener('click', () => {
  const done = bcStore.get(KEY, {});
  const lines = ['구간,항목,체크,체크일'];
  groups.forEach((g) => {
    const range = g.querySelector('h2').textContent;
    g.querySelectorAll('.chk-item').forEach((it) => {
      const cb = it.querySelector('.ms');
      lines.push([range, it.querySelector('.chk-tx').textContent, cb.checked ? 'Y' : 'N', done[cb.dataset.key] || ''].map(bcCsvCell).join(','));
    });
  });
  bcDownload('baby-milestone.csv', '\\ufeff' + lines.join('\\n'), 'text/csv');
});
$('#jsonBtn').addEventListener('click', () => bcDownload('baby-milestone.json', JSON.stringify(bcStore.get(KEY, {}), null, 2), 'application/json'));
$('#clearBtn').addEventListener('click', () => {
  if (confirm('체크 기록을 모두 삭제할까요? (이 브라우저에서만 삭제됩니다)')) {
    bcStore.del(KEY);
    document.querySelectorAll('.ms').forEach((cb) => { cb.checked = false; syncRow(cb); });
    progress();
  }
});

loadChecks();
const saved = bcStore.get(BKEY, null);
if (saved) {
  $('#birth').value = saved;
  const a = babyAge(mkDate(saved), new Date());
  if (a) {
    curMonth = a.months;
    $('#ageBig').textContent = '생후 ' + a.months + '개월 ' + a.days + '일';
    $('#ageSub').textContent = '해당 월령 구간의 항목만 표시하고 있어요.';
    applyFilter();
    bcShowResult('result');
  }
}
progress();`,
};

export const TOOLS_B = [sleepSchedule, feverGuide, diaperSize, daycareDday, babyCost, nameCheck, milestone];
