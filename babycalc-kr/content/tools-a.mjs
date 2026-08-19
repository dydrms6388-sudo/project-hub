/* 도구 페이지 정의 A — months-age / growth-percentile / formula-amount / weaning-stage
 * 브라우저용 script 문자열은 백틱·템플릿리터럴 없이 문자열 결합만 사용한다.
 */
import { INGREDIENTS, STAGES, STAGE_LABEL, SOURCE as WEAN_SRC } from '../data/weaning.mjs';
import { SOURCE as GROWTH_SRC, GROWTH } from '../data/growth.mjs';
import { SOURCE as FORMULA_SRC, DAILY_PER_KG, BY_MONTH } from '../data/formula.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const REL_TEC = {
  vaccine: { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미 (TomatoEggCat)' },
  due: { href: 'https://tomatoeggcat.com/due-date-calc/', ic: '🍅', name: '출산 예정일 계산기' },
  age: { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
  taemyeong: { href: 'https://tomatoeggcat.com/dydrms-taemyeong/', ic: '🍅', name: '태명 짓기' },
  ovul: { href: 'https://tomatoeggcat.com/ovulation-calendar/', ic: '🍅', name: '배란일 계산기' },
};

/* ───────────────────────── 1. 아기 개월수 계산기 ───────────────────────── */
const monthsAge = {
  slug: 'months-age', emoji: '📅',
  title: '아기 개월수 계산기 — 생후 개월·주수·일수와 교정연령 | BabyCalc',
  desc: '생년월일만 입력하면 오늘 기준 생후 몇 개월 며칠인지, 총 일수와 주수, 이른둥이 교정연령까지 한 번에 계산합니다. 50일·100일·200일·첫돌 D-day도 함께 보여드려요.',
  ogTitle: '아기 개월수 계산기 — 개월·주수·교정연령',
  ogDesc: '생후 몇 개월 며칠? 총 일수·주수·교정연령과 100일·돌 D-day까지 한 번에.',
  h1: '아기 개월수 계산기', crumbName: '아기 개월수',
  lead: '생후 몇 개월 며칠인지, 이른둥이라면 교정연령은 몇 개월인지 정확히 계산해 드려요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="field">
      <label for="birth">생년월일</label>
      <input type="date" id="birth" required>
      <p class="hint">입력값은 계산에만 쓰이고 서버로 전송되지 않습니다.</p>
    </div>
    <div class="row2">
      <div class="field">
        <label for="base">기준일</label>
        <input type="date" id="base">
        <p class="hint">비워 두면 오늘 날짜</p>
      </div>
      <div class="field">
        <label for="due">출산 예정일 <span style="font-weight:400;color:var(--muted)">(선택)</span></label>
        <input type="date" id="due">
        <p class="hint">이른둥이 교정연령 계산용</p>
      </div>
    </div>
    <button class="btn" type="submit">계산하기</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>계산 결과</h2>
    <p class="res-big" id="mainAge">—</p>
    <p class="res-sub" id="subAge"></p>
    <div id="corrBox"></div>
    <div class="kv"><span class="k">총 일수 (태어난 날 = 0일)</span><span class="v" id="kTotal">—</span></div>
    <div class="kv"><span class="k">주수</span><span class="v" id="kWeek">—</span></div>
    <div class="kv"><span class="k">한국식 일수 (태어난 날 = 1일)</span><span class="v" id="kKor">—</span></div>
    <div class="kv"><span class="k">만 나이</span><span class="v" id="kYear">—</span></div>
    <h2 style="margin-top:18px">기념일 D-day</h2>
    <div class="tbl-scroll"><table class="tbl" id="ddayTbl">
      <thead><tr><th>기념일</th><th>날짜</th><th>D-day</th></tr></thead><tbody></tbody>
    </table></div>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" id="copyBtn">결과 복사</button>
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
    <p class="local-note">마지막 입력 생년월일은 이 브라우저에만 저장됩니다. <strong>서버 저장 없음.</strong></p>
  </section>`,
  introTitle: '개월수는 어떻게 세나요?',
  introHtml: '<p>아기 개월수는 <strong>달력 기준</strong>으로 셉니다. 3월 10일에 태어난 아기는 4월 10일에 생후 1개월, 5월 10일에 생후 2개월이 됩니다. 말일에 태어난 경우(예: 1월 31일)는 다음 달에 같은 날짜가 없으므로 그 달의 마지막 날(2월 28·29일)을 기준으로 개월이 채워집니다.</p>' +
    '<p>병원과 예방접종 일정은 대부분 이 <strong>만 개월수</strong>를 씁니다. 반면 "100일"처럼 한국에서 세는 날수는 <strong>태어난 날을 1일째로</strong> 계산하는 관습이 있어, 이 도구는 두 가지를 모두 보여줍니다.</p>',
  howtoHtml: '<ol><li>생년월일을 입력합니다. 과거 또는 미래의 특정 날짜 기준으로 보고 싶다면 <em>기준일</em>도 함께 입력하세요.</li>' +
    '<li>이른둥이(37주 미만 출생)라면 <em>출산 예정일</em>을 입력하면 교정연령이 함께 계산됩니다.</li>' +
    '<li>아래 기념일 표에서 50일·100일·200일·첫돌 날짜와 남은 일수를 확인할 수 있습니다.</li></ol>',
  extraHtml: '<h2>교정연령이란?</h2>\n    <p>예정일보다 일찍 태어난 아기는 <strong>출산 예정일을 기준으로 다시 센 나이</strong>(교정연령)로 발달과 성장을 평가하는 것이 일반적입니다. 예를 들어 예정일보다 8주 일찍 태어난 생후 6개월 아기의 교정연령은 약 4개월입니다. 성장도표와 발달 이정표는 보통 <strong>만 2세(24개월)까지 교정연령으로</strong> 보고, 그 이후에는 실제 나이를 씁니다. 적용 시점과 방법은 담당 소아과에서 안내받는 것이 정확합니다.</p>',
  faq: [
    { q: '"생후 100일"은 태어난 날부터 며칠 뒤인가요?', a: '한국에서는 태어난 날을 1일째로 세기 때문에 100일은 <strong>생일 + 99일</strong>이 됩니다. 이 도구는 태어난 날을 0일로 보는 총 일수와, 태어난 날을 1일로 보는 한국식 일수를 함께 보여줍니다.' },
    { q: '말일에 태어났는데 개월수가 이상해요.', a: '1월 31일생 아기는 2월에 31일이 없으므로 2월 28일(윤년 29일)에 생후 1개월이 됩니다. 이 도구는 이런 말일 보정을 적용해 계산합니다.' },
    { q: '교정연령은 언제까지 쓰나요?', a: '일반적으로 만 2세 무렵까지 교정연령으로 성장·발달을 평가하고 이후에는 실제 나이를 사용합니다. 다만 출생 주수와 아이 상태에 따라 다르므로 담당 소아과 전문의의 안내를 따르세요.' },
  ],
  srcHtml: '<strong>계산 방식</strong> · 달력 기준 만 개월수(말일 보정 포함) + 총 일수. 교정연령은 출산 예정일을 기준일로 다시 계산합니다. 교정연령 적용 범위는 의료진 안내 기준.',
  disclaimer: '개월수 계산은 참고용입니다. 교정연령을 적용한 발달 평가는 진단이 아니며, 발달이 걱정되면 소아과 전문의와 상담하세요.',
  related: [
    { href: '@UP@vaccine-schedule/', ic: '💉', name: '예방접종 일정표' },
    { href: '@UP@growth-percentile/', ic: '📈', name: '성장 백분위 계산기' },
    { href: '@UP@milestone/', ic: '🧸', name: '발달 이정표 체크' },
    REL_TEC.age, REL_TEC.due,
  ],
  script: `import { mkDate, babyAge, correctedAge, diffDays, fmtDate, fmtDateKo, addMonths } from '@UP@assets/calc.mjs';
const $ = (s) => document.querySelector(s);
const BKEY = 'bc-baby-birth';

function ddayText(n) {
  if (n === 0) return '오늘 🎉';
  return n > 0 ? 'D-' + n : 'D+' + (-n);
}

function calc(birth, base, due) {
  const a = babyAge(birth, base);
  if (!a) {
    $('#mainAge').textContent = '기준일이 생년월일보다 빠릅니다';
    $('#subAge').textContent = '';
    bcShowResult('result');
    return;
  }
  $('#mainAge').innerHTML = '생후 ' + a.months + '개월 ' + a.days + '일';
  $('#subAge').textContent = fmtDateKo(birth) + ' 출생 · ' + fmtDateKo(base) + ' 기준';
  $('#kTotal').textContent = a.totalDays.toLocaleString('ko-KR') + '일';
  $('#kWeek').textContent = a.weeks + '주 ' + a.weekDays + '일';
  $('#kKor').textContent = (a.totalDays + 1).toLocaleString('ko-KR') + '일째';
  const years = Math.floor(a.months / 12);
  $('#kYear').textContent = years > 0 ? '만 ' + years + '세 ' + (a.months % 12) + '개월' : '만 0세';

  if (due) {
    const c = correctedAge(due, base);
    const gap = diffDays(birth, due);
    if (gap > 0) {
      const txt = c.beforeDue
        ? '<p class="res-sub">아직 출산 예정일 전이라 교정연령은 0개월 이전입니다 (예정일까지 ' + (-c.totalDays) + '일).</p>'
        : '<p class="res-big" style="font-size:22px">교정연령 ' + c.months + '개월 ' + c.days + '일</p>';
      $('#corrBox').innerHTML = txt + '<p class="res-sub">예정일보다 ' + Math.floor(gap / 7) + '주 ' + (gap % 7) + '일 일찍 태어났어요. 성장·발달 평가는 보통 만 2세까지 교정연령을 기준으로 봅니다.</p>';
    } else {
      $('#corrBox').innerHTML = '<p class="res-sub">출산 예정일이 생년월일보다 빠르거나 같아 교정연령을 적용하지 않습니다.</p>';
    }
  } else {
    $('#corrBox').innerHTML = '';
  }

  const marks = [
    { name: '50일', date: new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + 49) },
    { name: '100일', date: new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + 99) },
    { name: '200일', date: new Date(birth.getFullYear(), birth.getMonth(), birth.getDate() + 199) },
    { name: '6개월', date: addMonths(birth, 6) },
    { name: '첫 돌 (12개월)', date: addMonths(birth, 12) },
    { name: '두 돌 (24개월)', date: addMonths(birth, 24) },
  ];
  const tb = $('#ddayTbl tbody');
  tb.innerHTML = '';
  marks.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + m.name + '</td><td>' + fmtDate(m.date) + '</td><td>' + ddayText(diffDays(base, m.date)) + '</td>';
    tb.appendChild(tr);
  });
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const b = $('#birth').value;
  if (!b) return;
  bcStore.set(BKEY, b);
  const base = $('#base').value ? mkDate($('#base').value) : new Date();
  const due = $('#due').value ? mkDate($('#due').value) : null;
  calc(mkDate(b), base, due);
});

$('#copyBtn').addEventListener('click', () => {
  const txt = $('#mainAge').textContent + ' (' + $('#kTotal').textContent + ', ' + $('#kWeek').textContent + ')';
  navigator.clipboard && navigator.clipboard.writeText(txt);
  $('#copyBtn').textContent = '복사됨!';
  setTimeout(() => { $('#copyBtn').textContent = '결과 복사'; }, 1500);
});

const saved = bcStore.get(BKEY, null);
if (saved) { $('#birth').value = saved; calc(mkDate(saved), new Date(), null); }`,
};

/* ───────────────────────── 2. 성장 백분위 계산기 ───────────────────────── */
const growthPercentile = {
  slug: 'growth-percentile', emoji: '📈',
  title: '아기 성장 백분위 계산기 — LMS z점수로 보는 몸무게·키 백분위 | BabyCalc',
  desc: '아기의 몸무게·키·머리둘레를 입력하면 성장도표 LMS 값으로 z점수와 백분위를 계산하고 표준곡선(3·15·50·85·97 백분위) 그래프에 함께 그려 줍니다. 측정 기록 저장·CSV 내보내기 지원.',
  ogTitle: '아기 성장 백분위 계산기 — z점수·표준곡선 그래프',
  ogDesc: '몸무게·키를 입력하면 LMS z점수로 백분위 계산 + 표준곡선 그래프에 표시.',
  h1: '아기 성장 백분위 계산기', crumbName: '성장 백분위',
  lead: '몸무게·키·머리둘레가 또래 중 어디쯤인지, 성장도표 LMS 공식으로 계산해 그래프에 표시해 드려요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>측정값 입력</h2>
    <div class="row2">
      <div class="field">
        <label for="sex">성별</label>
        <select id="sex"><option value="boy">남아</option><option value="girl">여아</option></select>
      </div>
      <div class="field">
        <label for="measure">측정 항목</label>
        <select id="measure">
          <option value="weight">몸무게 (kg)</option>
          <option value="length">키 / 누운키 (cm)</option>
          <option value="head">머리둘레 (cm)</option>
        </select>
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label for="birth">생년월일</label>
        <input type="date" id="birth" required>
      </div>
      <div class="field">
        <label for="mdate">측정일</label>
        <input type="date" id="mdate">
        <p class="hint">비우면 오늘</p>
      </div>
    </div>
    <div class="field">
      <label for="value">측정값</label>
      <input type="number" id="value" step="0.01" min="0" required placeholder="예: 6.4">
      <p class="hint">몸무게는 kg, 키·머리둘레는 cm 단위로 입력하세요.</p>
    </div>
    <button class="btn" type="submit">백분위 계산</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>계산 결과</h2>
    <p class="res-big" id="pctBig">—</p>
    <p class="res-sub" id="pctSub"></p>
    <div id="detail"></div>
    <div class="chart-box" id="chartBox"></div>
    <p class="res-sub" id="chartNote" style="font-size:12.5px;color:var(--muted)"></p>
    <h2 style="margin-top:18px">내 기록</h2>
    <div class="tbl-scroll"><table class="tbl" id="recTbl">
      <thead><tr><th>측정일</th><th>월령</th><th>항목</th><th>값</th><th>z</th><th>백분위</th><th class="no-print">삭제</th></tr></thead><tbody></tbody>
    </table></div>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" id="csvBtn">기록 CSV 내보내기</button>
      <button class="btn sm sec" type="button" id="jsonBtn">기록 JSON 내보내기</button>
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
      <button class="btn sm danger" type="button" id="clearBtn">기록 전체 삭제</button>
    </div>
    <p class="local-note">✅ 측정 기록은 이 브라우저(localStorage)에만 저장됩니다. <strong>서버 저장 없음.</strong></p>
  </section>`,
  introTitle: '백분위는 어떻게 계산하나요?',
  introHtml: '<p>성장도표는 월령·성별마다 <strong>L(왜도) · M(중앙값) · S(변동계수)</strong> 세 값을 가지고 있습니다. 측정값 X의 z점수는 다음 공식으로 구합니다.</p>' +
    '<p style="background:var(--panel2);border:1px solid var(--line2);border-radius:10px;padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px">z = ((X / M)<sup>L</sup> − 1) / (L × S)&nbsp;&nbsp;<span style="color:var(--muted)">(L ≠ 0)</span><br>z = ln(X / M) / S&nbsp;&nbsp;<span style="color:var(--muted)">(L = 0)</span></p>' +
    '<p>이렇게 얻은 z점수를 표준정규분포 누적확률로 바꾸면 백분위가 됩니다. 예를 들어 측정값이 중앙값 M과 같으면 z = 0이고 백분위는 50%입니다. 그래프의 곡선은 반대로 z를 고정하고 X를 역산해(X = M(1 + LSz)<sup>1/L</sup>) 그린 <strong>표준곡선</strong>입니다.</p>',
  howtoHtml: '<ol><li>성별과 측정 항목을 고르고, 생년월일·측정일·측정값을 입력합니다.</li>' +
    '<li>계산하면 z점수·백분위와 함께 표준곡선 그래프 위에 아기의 위치가 점으로 표시됩니다.</li>' +
    '<li>계산할 때마다 기록이 브라우저에 쌓여 성장 추이를 볼 수 있고, CSV·JSON으로 내보낼 수 있습니다.</li></ol>',
  extraHtml: '<h2>백분위 숫자를 어떻게 읽어야 하나요?</h2>' +
    '<p>백분위 25%는 "또래 100명 중 아래에서 25번째쯤"이라는 <strong>위치</strong>일 뿐, 좋고 나쁨이 아닙니다. 소아과에서 실제로 중요하게 보는 것은 한 번의 숫자보다 <strong>자기 곡선을 따라 꾸준히 자라는지(성장 속도)</strong>입니다. 3백분위 미만이거나 97백분위를 넘는 경우, 또는 백분위가 짧은 기간에 크게 변한 경우에는 진료 시 상담하세요.</p>' +
    '<p>2세 미만은 <strong>누운 키(신장)</strong>, 2세 이상은 선 키로 측정 방식이 달라 도표도 달라집니다. 이른둥이는 <a href="@UP@months-age/">교정연령</a>을 기준으로 보는 것이 일반적입니다.</p>' +
    '<h2>데이터 범위 안내</h2>' +
    '<p>이 계산기는 원표와 대조해 확인된 월령의 LMS 값만 정밀 계산에 사용합니다. 아직 대조하지 못한 월령은 <span class="badge todo">확인 필요</span>로 표시하고 <strong>백분위를 계산하지 않습니다</strong> — 값을 추정해 채우지 않는 것이 안전하다고 판단했기 때문입니다.</p>',
  faq: [
    { q: '백분위가 낮으면 문제가 있는 건가요?', a: '아닙니다. 백분위는 또래 중 위치를 나타내는 값이며, 3~97백분위 사이는 일반적으로 정상 범위로 봅니다. 중요한 것은 한 시점의 숫자가 아니라 자기 성장 곡선을 따라 꾸준히 자라는지입니다. 걱정되면 소아과 전문의와 상담하세요.' },
    { q: '어떤 성장도표를 쓰나요?', a: '0~35개월 구간은 질병관리청 2017 소아청소년 성장도표가 WHO Child Growth Standards(2006)를 그대로 채택했기 때문에 두 표의 LMS 값이 같습니다. 이 계산기는 확인된 월령의 LMS 값만 사용합니다.' },
    { q: '어떤 월령은 왜 "확인 필요"라고 나오나요?', a: '해당 월령의 L·S 값을 원표와 대조하지 못했기 때문입니다. 근거 없이 값을 추정해 넣는 대신 계산을 하지 않고 표시만 합니다. 그 월령의 백분위는 병원 성장도표로 확인하세요.' },
    { q: '이른둥이는 어떻게 입력하나요?', a: '일반적으로 만 2세 무렵까지는 교정연령으로 평가합니다. 생년월일 대신 출산 예정일을 입력하면 교정연령 기준의 위치를 볼 수 있으나, 적용 여부는 담당 의료진과 상의하세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + GROWTH_SRC.name + ' — <a href="' + GROWTH_SRC.url + '" target="_blank" rel="noopener">' + GROWTH_SRC.url + '</a> / WHO LMS 원표 <a href="' + GROWTH_SRC.urlWho + '" target="_blank" rel="noopener">who.int</a> (확인일 ' + GROWTH_SRC.checkedAt + '). ' +
    '현재 정밀 계산이 가능한 월령: 몸무게·키 0~3개월, 머리둘레 0개월. 나머지 월령의 LMS 값은 원표 대조 후 추가 예정(확인 필요).',
  disclaimer: '성장 백분위는 참고용 계산입니다. 진단이 아니며, 성장 평가는 반복 측정과 진찰을 통해 소아과 전문의가 판단합니다.',
  related: [
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: '@UP@formula-amount/', ic: '🍼', name: '분유 수유량 계산기' },
    { href: '@UP@milestone/', ic: '🧸', name: '발달 이정표 체크' },
    REL_TEC.vaccine, REL_TEC.age,
  ],
  script: `import { mkDate, babyAge, fmtDate, zFromLMS, xFromZ, percentileFromZ } from '@UP@assets/calc.mjs';
import { GROWTH, MEASURE_LABEL, findRow } from '@UP@data/growth.mjs';
const $ = (s) => document.querySelector(s);
const RKEY = 'bc-growth-records';
const BKEY = 'bc-baby-birth';
const UNIT = { weight: 'kg', length: 'cm', head: 'cm' };
const CURVES = [
  { z: -1.881, label: '3%' },
  { z: -1.036, label: '15%' },
  { z: 0, label: '50%' },
  { z: 1.036, label: '85%' },
  { z: 1.881, label: '97%' },
];

function rowsChecked(measure, sex) {
  return ((GROWTH[measure] || {})[sex] || []).filter((r) => r.checked && r.L != null && r.S != null && r.M != null);
}

function drawChart(measure, sex, records) {
  const rows = rowsChecked(measure, sex);
  const box = $('#chartBox');
  const note = $('#chartNote');
  if (rows.length < 2) {
    box.innerHTML = '';
    note.textContent = '이 항목(' + MEASURE_LABEL[measure] + ')은 표준곡선을 그릴 만큼의 확인된 LMS 데이터가 아직 없습니다. (확인된 월령 ' + rows.length + '개)';
    return;
  }
  const W = 640, H = 340, PL = 52, PR = 74, PT = 18, PB = 40;
  const mMin = rows[0].m, mMax = rows[rows.length - 1].m;
  const series = CURVES.map((c) => ({
    label: c.label,
    pts: rows.map((r) => ({ x: r.m, y: xFromZ(c.z, r.L, r.M, r.S) })),
  }));
  let yMin = Infinity, yMax = -Infinity;
  series.forEach((s) => s.pts.forEach((p) => { if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y; }));
  const inRange = records.filter((r) => r.measure === measure && r.sex === sex && r.month >= mMin && r.month <= mMax);
  inRange.forEach((r) => { if (r.value < yMin) yMin = r.value; if (r.value > yMax) yMax = r.value; });
  const pad = (yMax - yMin) * 0.08 || 1;
  yMin -= pad; yMax += pad;
  const sx = (m) => PL + (m - mMin) / ((mMax - mMin) || 1) * (W - PL - PR);
  const sy = (v) => H - PB - (v - yMin) / ((yMax - yMin) || 1) * (H - PT - PB);

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + MEASURE_LABEL[measure] + ' 표준곡선 그래프">';
  svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"></rect>';
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (yMax - yMin) * i / 4;
    const y = sy(v);
    svg += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="currentColor" stroke-opacity="0.15"></line>';
    svg += '<text x="' + (PL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="currentColor" fill-opacity="0.6">' + v.toFixed(1) + '</text>';
  }
  rows.forEach((r) => {
    const x = sx(r.m);
    svg += '<line x1="' + x.toFixed(1) + '" y1="' + PT + '" x2="' + x.toFixed(1) + '" y2="' + (H - PB) + '" stroke="currentColor" stroke-opacity="0.08"></line>';
    svg += '<text x="' + x.toFixed(1) + '" y="' + (H - PB + 18) + '" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.6">' + r.m + '개월</text>';
  });
  svg += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.6">월령 (개월)</text>';
  series.forEach((s, i) => {
    const mid = i === 2;
    const d = s.pts.map((p, j) => (j ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
    svg += '<path d="' + d + '" fill="none" stroke="currentColor" stroke-opacity="' + (mid ? '0.85' : '0.35') + '" stroke-width="' + (mid ? 2 : 1.2) + '"' + (mid ? '' : ' stroke-dasharray="4 3"') + '></path>';
    const last = s.pts[s.pts.length - 1];
    svg += '<text x="' + (sx(last.x) + 6) + '" y="' + (sy(last.y) + 4).toFixed(1) + '" font-size="11" fill="currentColor" fill-opacity="0.7">' + s.label + '</text>';
  });
  inRange.forEach((r) => {
    svg += '<circle cx="' + sx(r.month).toFixed(1) + '" cy="' + sy(r.value).toFixed(1) + '" r="5" fill="#10b981" stroke="#fff" stroke-width="1.5"></circle>';
  });
  svg += '</svg>';
  box.innerHTML = svg;
  note.textContent = '실선 = 50백분위(중앙값), 점선 = 3·15·85·97백분위. 초록 점 = 저장된 내 기록. 확인된 LMS 데이터가 있는 ' + mMin + '~' + mMax + '개월 구간만 표시됩니다.';
}

function renderRecords() {
  const recs = bcStore.get(RKEY, []);
  const tb = $('#recTbl tbody');
  tb.innerHTML = '';
  if (!recs.length) {
    tb.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">아직 저장된 기록이 없어요.</td></tr>';
    return recs;
  }
  recs.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.date + '</td><td>' + r.month + '개월</td><td>' + (MEASURE_LABEL[r.measure] || r.measure) + '</td>' +
      '<td>' + r.value + '</td><td>' + (r.z == null ? '—' : r.z.toFixed(2)) + '</td>' +
      '<td>' + (r.pct == null ? '<span class="badge todo">확인 필요</span>' : r.pct.toFixed(1) + '%') + '</td>' +
      '<td class="no-print"><button class="btn sm sec" type="button" data-del="' + r.id + '">삭제</button></td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('button[data-del]').forEach((b) => {
    b.addEventListener('click', () => {
      bcStore.set(RKEY, bcStore.get(RKEY, []).filter((x) => x.id !== b.dataset.del));
      const rs = renderRecords();
      drawChart($('#measure').value, $('#sex').value, rs);
    });
  });
  return recs;
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const bv = $('#birth').value, vv = parseFloat($('#value').value);
  if (!bv || !(vv > 0)) return;
  bcStore.set(BKEY, bv);
  const birth = mkDate(bv);
  const mdate = $('#mdate').value ? mkDate($('#mdate').value) : new Date();
  const age = babyAge(birth, mdate);
  if (!age) { alert('측정일이 생년월일보다 빠릅니다.'); return; }
  const measure = $('#measure').value, sex = $('#sex').value;
  const row = findRow(measure, sex, age.months);
  let z = null, pct = null;
  if (row && row.checked && row.L != null && row.S != null) {
    z = zFromLMS(vv, row.L, row.M, row.S);
    pct = percentileFromZ(z);
  }

  if (pct != null) {
    $('#pctBig').textContent = '백분위 ' + pct.toFixed(1) + '%';
    $('#pctSub').textContent = '생후 ' + age.months + '개월 ' + (sex === 'boy' ? '남아' : '여아') + ' · ' + MEASURE_LABEL[measure] + ' ' + vv + UNIT[measure] + ' · z점수 ' + z.toFixed(2);
    let msg = '또래 100명 중 아래에서 약 ' + Math.max(1, Math.round(pct)) + '번째 위치예요.';
    if (pct < 3 || pct > 97) msg += ' 3~97백분위 밖이라면 다음 진료 때 성장에 대해 상담해 보세요.';
    $('#detail').innerHTML = '<div class="kv"><span class="k">z점수</span><span class="v">' + z.toFixed(3) + '</span></div>' +
      '<div class="kv"><span class="k">해당 월령 중앙값(M)</span><span class="v">' + row.M + UNIT[measure] + '</span></div>' +
      '<div class="kv"><span class="k">사용한 LMS</span><span class="v">L=' + row.L + ' / M=' + row.M + ' / S=' + row.S + '</span></div>' +
      '<p class="res-sub" style="margin-top:10px">' + msg + '</p>';
  } else {
    const anyRow = row;
    $('#pctBig').innerHTML = '백분위 계산 불가 <span class="badge todo">확인 필요</span>';
    $('#pctSub').textContent = '생후 ' + age.months + '개월 ' + (sex === 'boy' ? '남아' : '여아') + ' · ' + MEASURE_LABEL[measure] + ' ' + vv + UNIT[measure];
    $('#detail').innerHTML = '<p class="res-sub">이 월령(' + age.months + '개월)의 LMS 값이 아직 원표와 대조되지 않아 백분위를 계산하지 않습니다. 근거 없이 값을 추정하지 않기 위한 조치예요.' +
      (anyRow && anyRow.M ? ' 참고로 이 월령의 중앙값(M)은 약 <strong>' + anyRow.M + UNIT[measure] + '</strong>입니다.' : '') +
      '</p><p class="res-sub">정확한 백분위는 병원 성장도표나 아기수첩에서 확인하세요.</p>';
  }

  const recs = bcStore.get(RKEY, []);
  recs.push({ id: 'r' + Date.now(), date: fmtDate(mdate), month: age.months, measure, sex, value: vv, z, pct });
  bcStore.set(RKEY, recs);
  const rs = renderRecords();
  drawChart(measure, sex, rs);
  bcShowResult('result');
});

$('#csvBtn').addEventListener('click', () => {
  const recs = bcStore.get(RKEY, []);
  const lines = ['측정일,월령,성별,항목,값,z점수,백분위'];
  recs.forEach((r) => lines.push([r.date, r.month, r.sex === 'boy' ? '남아' : '여아', MEASURE_LABEL[r.measure] || r.measure, r.value, r.z == null ? '' : r.z.toFixed(3), r.pct == null ? '확인필요' : r.pct.toFixed(1)].map(bcCsvCell).join(',')));
  bcDownload('baby-growth.csv', '\\ufeff' + lines.join('\\n'), 'text/csv');
});
$('#jsonBtn').addEventListener('click', () => {
  bcDownload('baby-growth.json', JSON.stringify(bcStore.get(RKEY, []), null, 2), 'application/json');
});
$('#clearBtn').addEventListener('click', () => {
  if (confirm('저장된 성장 기록을 모두 삭제할까요? (이 브라우저에서만 삭제됩니다)')) {
    bcStore.del(RKEY);
    renderRecords();
    drawChart($('#measure').value, $('#sex').value, []);
  }
});
$('#measure').addEventListener('change', () => drawChart($('#measure').value, $('#sex').value, bcStore.get(RKEY, [])));
$('#sex').addEventListener('change', () => drawChart($('#measure').value, $('#sex').value, bcStore.get(RKEY, [])));

const savedB = bcStore.get(BKEY, null);
if (savedB) $('#birth').value = savedB;
if (bcStore.get(RKEY, []).length) {
  renderRecords();
  drawChart($('#measure').value, $('#sex').value, bcStore.get(RKEY, []));
  bcShowResult('result');
} else {
  renderRecords();
}`,
};

/* ───────────────────────── 3. 분유 수유량 계산기 ───────────────────────── */
const formulaRows = BY_MONTH.map((b) =>
  '<tr><td>' + esc(b.range) + '</td><td>' + esc(b.perFeed) + '</td><td>' + esc(b.feeds) + '</td><td>' +
  (b.checked ? '<span class="badge ok">확인됨</span>' : '<span class="badge todo">확인 필요</span>') + '</td></tr>').join('\n        ');

const formulaAmount = {
  slug: 'formula-amount', emoji: '🍼',
  title: '분유 수유량 계산기 — 체중으로 보는 하루 총량과 1회 수유량 | BabyCalc',
  desc: '아기 체중을 입력하면 하루 총 분유량(체중 1kg당 120~150mL 참고 범위)과 수유 횟수에 따른 1회 수유량을 계산합니다. 월령별 참고 수유량 표도 함께 제공합니다.',
  ogTitle: '분유 수유량 계산기 — 하루 총량·1회량',
  ogDesc: '체중 입력 → 하루 총 분유량과 1회 수유량 참고 범위를 바로 계산.',
  h1: '분유 수유량 계산기', crumbName: '분유 수유량',
  lead: '아기 체중과 수유 횟수를 넣으면 하루 총량과 1회 수유량의 일반적인 참고 범위를 계산해 드려요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="row2">
      <div class="field">
        <label for="kg">현재 체중 (kg)</label>
        <input type="number" id="kg" step="0.01" min="1" max="20" required placeholder="예: 5.2">
      </div>
      <div class="field">
        <label for="feeds">하루 수유 횟수</label>
        <input type="number" id="feeds" step="1" min="1" max="14" value="7" required>
      </div>
    </div>
    <button class="btn" type="submit">수유량 계산</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>계산 결과</h2>
    <p class="res-big" id="perFeed">—</p>
    <p class="res-sub" id="perFeedSub">1회 수유량 참고 범위</p>
    <div class="kv"><span class="k">하루 총량 (체중 × 120~150mL)</span><span class="v" id="kTotal">—</span></div>
    <div class="kv"><span class="k">적용된 하루 총량</span><span class="v" id="kApplied">—</span></div>
    <div class="kv"><span class="k">수유 횟수</span><span class="v" id="kFeeds">—</span></div>
    <p class="res-sub" id="capNote" style="margin-top:10px"></p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>`,
  introTitle: '어떤 기준으로 계산하나요?',
  introHtml: '<p>분유 수유량은 흔히 <strong>체중 1kg당 하루 120~150mL</strong>를 참고 범위로 안내합니다. 체중 5kg 아기라면 하루 600~750mL 정도가 되고, 여기에 수유 횟수를 나누면 1회 수유량의 대략적인 범위가 나옵니다. 다만 하루 총량은 일반적으로 약 <strong>1,000mL를 넘지 않게</strong> 안내되는 경우가 많습니다.</p>' +
    '<p>이 수치는 <span class="badge todo">확인 필요</span> — 널리 통용되는 일반 참고 범위이며, 아기마다 필요량 차이가 매우 큽니다. 실제로 중요한 것은 계산값보다 <strong>아기의 배고픔·포만 신호</strong>와 <strong>체중이 성장 곡선을 따라 늘고 있는지</strong>입니다.</p>',
  howtoHtml: '<ol><li>최근에 잰 체중(kg)과 하루 수유 횟수를 입력합니다.</li>' +
    '<li>하루 총량 범위와 1회 수유량 범위가 계산됩니다.</li>' +
    '<li>아래 월령별 표와 비교해 보되, 두 값이 다르면 아기의 반응과 체중 증가를 우선하세요.</li></ol>',
  extraHtml: '<h2>월령별 참고 수유량</h2>\n    <div class="tbl-scroll"><table class="tbl">\n      <thead><tr><th>월령</th><th>1회 수유량</th><th>횟수</th><th>근거</th></tr></thead>\n      <tbody>\n        ' + formulaRows + '\n      </tbody>\n    </table></div>' +
    '<p>표의 값은 <span class="badge todo">확인 필요</span> 상태입니다 — 분유 제조사 안내와 육아 서적에서 널리 쓰이는 관행 수준의 범위이며, 공식 표준표와 대조하기 전까지는 참고용으로만 봐 주세요.</p>' +
    '<h2>이런 경우에는 진료를 받으세요</h2>' +
    '<ul><li>하루 수유량이 갑자기 크게 줄고 늘지 않을 때</li><li>소변 기저귀 수가 눈에 띄게 줄었을 때(탈수 신호)</li><li>체중이 늘지 않거나 오히려 줄 때</li><li>수유 때마다 심하게 토하거나 힘들어할 때</li></ul>',
  faq: [
    { q: '계산한 양보다 적게 먹어요.', a: '아기마다 필요량은 다르고 하루하루도 달라집니다. 활기가 있고 소변 기저귀가 충분히 나오며 체중이 곡선을 따라 늘고 있다면 대개 괜찮습니다. 지속적으로 적게 먹고 체중이 늘지 않으면 진료를 받으세요.' },
    { q: '모유 수유 중인데도 쓸 수 있나요?', a: '이 계산기는 분유 기준입니다. 모유 수유는 양을 재기 어렵기 때문에 수유 횟수, 소변·대변 횟수, 체중 증가로 판단하며 계산값을 그대로 적용하기 어렵습니다.' },
    { q: '이유식을 시작했는데 분유량은 어떻게 하나요?', a: '이유식 초기에는 모유·분유가 여전히 주식이고 이유식은 연습 단계입니다. 후기로 갈수록 이유식 비중이 늘면서 수유량이 자연스럽게 줄어듭니다. <a href="@UP@weaning-stage/">이유식 단계 계산기</a>에서 단계를 확인해 보세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + FORMULA_SRC.name + ' — <a href="' + FORMULA_SRC.url + '" target="_blank" rel="noopener">' + FORMULA_SRC.url + '</a> (확인일 ' + FORMULA_SRC.checkedAt + '). ' +
    '체중당 ' + DAILY_PER_KG.min + '~' + DAILY_PER_KG.max + 'mL/일, 하루 상한 약 ' + DAILY_PER_KG.dailyCap + 'mL는 널리 통용되는 일반 참고 범위로 <strong>원문 문구 대조가 필요한 상태(확인 필요)</strong>입니다.',
  disclaimer: '수유량 계산은 참고용이며 진단·처방이 아닙니다. 수유량·체중 증가가 걱정되면 소아과 전문의와 상담하세요.',
  related: [
    { href: '@UP@growth-percentile/', ic: '📈', name: '성장 백분위 계산기' },
    { href: '@UP@weaning-stage/', ic: '🥣', name: '이유식 단계 계산기' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    REL_TEC.vaccine, REL_TEC.due,
  ],
  script: `import { DAILY_PER_KG } from '@UP@data/formula.mjs';
const $ = (s) => document.querySelector(s);
const KEY = 'bc-formula-input';

function calc(kg, feeds) {
  const lo = kg * DAILY_PER_KG.min, hi = kg * DAILY_PER_KG.max;
  const cap = DAILY_PER_KG.dailyCap;
  const loA = Math.min(lo, cap), hiA = Math.min(hi, cap);
  const r = (n) => Math.round(n / 5) * 5;
  $('#kTotal').textContent = r(lo) + ' ~ ' + r(hi) + ' mL';
  $('#kApplied').textContent = r(loA) + ' ~ ' + r(hiA) + ' mL';
  $('#kFeeds').textContent = feeds + '회';
  $('#perFeed').innerHTML = r(loA / feeds) + ' ~ ' + r(hiA / feeds) + ' <span class="unit">mL / 1회</span>';
  $('#perFeedSub').textContent = '체중 ' + kg + 'kg · 하루 ' + feeds + '회 기준 참고 범위';
  $('#capNote').innerHTML = (hi > cap
    ? '⚠ 계산값이 하루 참고 상한(약 ' + cap + 'mL)을 넘어 상한을 적용했습니다. '
    : '') + '이 수치는 <span class="badge todo">확인 필요</span> 상태의 일반 참고 범위입니다. 아기의 배고픔 신호와 체중 증가가 계산값보다 우선입니다.';
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = parseFloat($('#kg').value), feeds = parseInt($('#feeds').value, 10);
  if (!(kg > 0) || !(feeds > 0)) return;
  bcStore.set(KEY, { kg, feeds });
  calc(kg, feeds);
});

const saved = bcStore.get(KEY, null);
if (saved && saved.kg) { $('#kg').value = saved.kg; $('#feeds').value = saved.feeds; calc(saved.kg, saved.feeds); }`,
};

/* ───────────────────────── 4. 이유식 단계 계산기 ───────────────────────── */
const stageRows = STAGES.map((s) =>
  '<tr><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.months) + '</td><td>' + esc(s.texture) + '</td><td>' + esc(s.desc) + '</td></tr>').join('\n        ');

const VERDICT_BADGE = {
  ok: '<span class="badge ok">가능</span>',
  caution: '<span class="badge warn">주의</span>',
  no: '<span class="badge danger">금지</span>',
};

const ingRows = INGREDIENTS.map((i) =>
  '<tr data-name="' + esc(i.name) + '" data-stage="' + i.stage + '" data-verdict="' + i.verdict + '">' +
  '<td><a href="@UP@weaning-stage/' + i.slug + '/">' + esc(i.name) + '</a></td>' +
  '<td>' + esc(STAGE_LABEL[i.stage] || i.stage) + '</td>' +
  '<td>' + VERDICT_BADGE[i.verdict] + '</td>' +
  '<td>' + esc(i.caution || '—') + '</td></tr>').join('\n        ');

const weaningStage = {
  slug: 'weaning-stage', emoji: '🥣',
  title: '이유식 단계 계산기 — 초기·중기·후기·완료기 시기와 재료 ' + INGREDIENTS.length + '종 | BabyCalc',
  desc: '생년월일을 넣으면 지금이 이유식 초기·중기·후기·완료기 중 어디인지, 다음 단계까지 며칠 남았는지 알려 드립니다. 재료 ' + INGREDIENTS.length + '종의 도입 시기와 알레르기·질식 주의사항도 검색할 수 있습니다.',
  ogTitle: '이유식 단계 계산기 — 지금 우리 아기는?',
  ogDesc: '초기·중기·후기·완료기 판정 + 재료별 시작 시기 검색.',
  h1: '이유식 단계 계산기', crumbName: '이유식 단계',
  lead: '지금 우리 아기는 이유식 몇 단계일까요? 다음 단계까지 남은 날과 재료별 시작 시기를 확인해 보세요.',
  bodyHtml: `<form class="card" id="form" autocomplete="off">
    <h2>아기 정보</h2>
    <div class="field">
      <label for="birth">생년월일</label>
      <input type="date" id="birth" required>
      <p class="hint">이른둥이는 교정연령을 기준으로 보는 것이 일반적입니다.</p>
    </div>
    <button class="btn" type="submit">단계 확인</button>
  </form>

  <section class="card result" id="result" aria-live="polite">
    <h2>현재 단계</h2>
    <p class="res-big" id="stageBig">—</p>
    <p class="res-sub" id="stageSub"></p>
    <div class="kv"><span class="k">권장 형태</span><span class="v" id="kTexture">—</span></div>
    <div class="kv"><span class="k">다음 단계</span><span class="v" id="kNext">—</span></div>
    <p class="res-sub" id="stageDesc" style="margin-top:10px"></p>
    <div class="btnrow no-print">
      <button class="btn sm sec" type="button" onclick="window.print()">인쇄</button>
    </div>
  </section>

  <section class="card">
    <h2>단계별 한눈에 보기</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>단계</th><th>시기</th><th>형태</th><th>내용</th></tr></thead>
      <tbody>
        ${stageRows}
      </tbody>
    </table></div>
  </section>

  <section class="card">
    <h2>재료별 시작 시기 (${INGREDIENTS.length}종)</h2>
    <div class="field">
      <label for="q">재료 검색</label>
      <input type="search" id="q" placeholder="예: 달걀, 새우, 꿀" autocomplete="off">
      <p class="hint">재료 이름을 클릭하면 시기·주의사항 상세 페이지로 이동합니다.</p>
    </div>
    <div class="tbl-scroll"><table class="tbl" id="ingTbl">
      <thead><tr><th>재료</th><th>권장 단계</th><th>판정</th><th>주의</th></tr></thead>
      <tbody>
        ${ingRows}
      </tbody>
    </table></div>
    <p class="local-note" id="ingCount"></p>
  </section>`,
  introTitle: '이유식 단계는 어떻게 나누나요?',
  introHtml: '<p>국내외 지침은 공통적으로 <strong>생후 6개월경(약 180일)에 이유식을 시작하고 모유·분유는 계속 유지</strong>할 것을 권합니다. 이후 아기가 삼키고 씹는 능력이 자라는 속도에 맞춰 초기(미음) → 중기(으깬 입자) → 후기(진밥·핑거푸드) → 완료기(유아식)로 넘어갑니다.</p>' +
    '<p>단계 구분은 <strong>월령보다 아기의 준비 신호</strong>가 우선입니다. 목을 잘 가누고, 앉은 자세를 유지하며, 음식에 관심을 보이고, 혀로 밀어내는 반사가 줄었다면 시작할 준비가 된 것으로 봅니다.</p>',
  howtoHtml: '<ol><li>생년월일을 입력하면 오늘 기준 단계와 다음 단계까지 남은 날이 나옵니다.</li>' +
    '<li>아래 표에서 단계별 형태와 진행 방법을 확인하세요.</li>' +
    '<li>재료 검색창에 궁금한 재료를 입력하면 시작 시기와 주의사항 페이지로 갈 수 있습니다.</li></ol>',
  extraHtml: '<h2>새 재료 도입 3원칙</h2>' +
    '<ul><li><strong>한 번에 하나씩</strong> — 반응이 생겼을 때 원인을 알 수 있습니다.</li>' +
    '<li><strong>오전에 소량부터</strong> — 이상이 생겨도 낮에 병원에 갈 수 있습니다.</li>' +
    '<li><strong>2~3일 관찰</strong> — 발진·구토·설사가 없으면 다음 재료로 넘어갑니다.</li></ul>' +
    '<h2>돌 전에는 주지 않는 것</h2>' +
    '<p><strong>꿀</strong>(영아 보툴리눔증 위험), <strong>음료로 주는 생우유</strong>, <strong>소금 간</strong>, <strong>과일주스</strong>는 돌 이전에는 권장되지 않습니다. 또 통포도·방울토마토·통견과·통콩처럼 둥글고 단단한 음식은 <strong>질식 위험</strong>이 커서 반드시 잘게 잘라 주고, 먹는 동안에는 앉힌 상태로 지켜봐야 합니다.</p>',
  faq: [
    { q: '이유식은 언제 시작하는 게 맞나요?', a: '세계보건기구와 국내 지침 모두 생후 6개월경 시작을 기본 권고로 합니다. 아기의 준비 신호(목 가누기, 앉기, 음식에 관심)를 함께 보고 판단하며, 시작 시기가 걱정되면 소아과 전문의와 상담하세요.' },
    { q: '알레르기 재료는 늦게 주는 게 좋나요?', a: '최근 연구 흐름은 이유식 시기에 다양한 재료를 <strong>지나치게 늦추지 않고</strong> 소량씩 도입하는 쪽입니다. 다만 아이마다 상황이 다르고 가족력이 있으면 접근이 달라지므로 전문의와 상의하세요.' },
    { q: '단계보다 빨리/늦게 가도 되나요?', a: '월령은 기준일 뿐이고 아기마다 속도가 다릅니다. 잘 삼키고 잘 먹는다면 조금 빠르게, 아직 힘들어하면 천천히 가도 됩니다. 억지로 진도를 맞출 필요는 없습니다.' },
    { q: '이유식을 시작하면 분유는 줄여야 하나요?', a: '초기에는 모유·분유가 여전히 주된 영양원입니다. 후기로 갈수록 이유식 비중이 늘면서 자연스럽게 수유량이 줄어듭니다.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + WEAN_SRC.name + ' — <a href="' + WEAN_SRC.url + '" target="_blank" rel="noopener">' + WEAN_SRC.url + '</a> / WHO 보충식 권고 <a href="' + WEAN_SRC.urlWho + '" target="_blank" rel="noopener">who.int</a> (확인일 ' + WEAN_SRC.checkedAt + '). ' +
    '재료별 도입 시기는 자료·기관마다 안내가 달라 대부분 <span class="badge todo">확인 필요</span>(일반 안내 수준)로 표기합니다. 꿀·생우유·과일주스·통견과 등 금지·질식 항목은 출처가 분명한 확정 정보입니다.',
  disclaimer: '이유식 안내는 참고용이며 진단·처방이 아닙니다. 알레르기 가족력이 있거나 반응이 의심되면 반드시 소아과 전문의와 상담하세요.',
  related: [
    { href: '@UP@guide/weaning-start/', ic: '📖', name: '이유식 시작 가이드' },
    { href: '@UP@formula-amount/', ic: '🍼', name: '분유 수유량 계산기' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    REL_TEC.age, REL_TEC.vaccine,
  ],
  appCategory: 'LifestyleApplication',
  script: `import { mkDate, babyAge, addMonths, diffDays, fmtDate } from '@UP@assets/calc.mjs';
import { STAGES } from '@UP@data/weaning.mjs';
const $ = (s) => document.querySelector(s);
const BKEY = 'bc-baby-birth';

function calc(birth) {
  const today = new Date();
  const a = babyAge(birth, today);
  if (!a) { $('#stageBig').textContent = '생년월일을 확인해 주세요'; bcShowResult('result'); return; }
  const m = a.months;
  let cur = null, next = null;
  for (let i = 0; i < STAGES.length; i++) {
    if (m >= STAGES[i].startM && m <= STAGES[i].endM) { cur = STAGES[i]; next = STAGES[i + 1] || null; break; }
  }
  if (!cur) {
    if (m < STAGES[0].startM) { cur = null; next = STAGES[0]; }
    else { cur = STAGES[STAGES.length - 1]; next = null; }
  }
  if (!cur && next) {
    const start = addMonths(birth, next.startM);
    const d = diffDays(today, start);
    $('#stageBig').textContent = '아직 이유식 시작 전';
    $('#stageSub').textContent = '생후 ' + m + '개월 ' + a.days + '일 · 모유·분유가 주된 영양원인 시기예요.';
    $('#kTexture').textContent = '—';
    $('#kNext').textContent = next.name + ' 시작 ' + (d > 0 ? 'D-' + d : '지금') + ' (' + fmtDate(start) + ')';
    $('#stageDesc').innerHTML = '일반적으로 생후 6개월경 시작을 권합니다. 목을 잘 가누고 앉은 자세를 유지하며 음식에 관심을 보이면 준비 신호로 봅니다.';
  } else {
    $('#stageBig').textContent = '이유식 ' + cur.name;
    $('#stageSub').textContent = '생후 ' + m + '개월 ' + a.days + '일 · 권장 시기 ' + cur.months;
    $('#kTexture').textContent = cur.texture;
    if (next) {
      const start = addMonths(birth, next.startM);
      const d = diffDays(today, start);
      $('#kNext').textContent = next.name + ' ' + (d > 0 ? 'D-' + d : '이미 시작 가능') + ' (' + fmtDate(start) + ')';
    } else {
      $('#kNext').textContent = '완료기 이후 — 유아식으로 이행';
    }
    $('#stageDesc').textContent = cur.desc;
  }
  bcShowResult('result');
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const b = $('#birth').value;
  if (!b) return;
  bcStore.set(BKEY, b);
  calc(mkDate(b));
});

const rows = Array.prototype.slice.call(document.querySelectorAll('#ingTbl tbody tr'));
function filter() {
  const q = $('#q').value.trim();
  let n = 0;
  rows.forEach((r) => {
    const hit = !q || r.dataset.name.indexOf(q) >= 0;
    r.style.display = hit ? '' : 'none';
    if (hit) n++;
  });
  $('#ingCount').textContent = q ? ('"' + q + '" 검색 결과 ' + n + '건') : ('전체 ' + rows.length + '종');
}
$('#q').addEventListener('input', filter);
filter();

const saved = bcStore.get(BKEY, null);
if (saved) { $('#birth').value = saved; calc(mkDate(saved)); }`,
};

export const TOOLS_A = [monthsAge, growthPercentile, formulaAmount, weaningStage];
