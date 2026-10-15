/* 가이드 콘텐츠 2편 — guide/vaccine-2026 · guide/weaning-start */
import { VACCINES, SOURCE as VAC_SRC } from '../data/vaccines.mjs';
import { STAGES, INGREDIENTS, SOURCE as WEAN_SRC } from '../data/weaning.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const vacRows = VACCINES.map((v) =>
  '<tr><td><strong>' + esc(v.name) + '</strong>' + (v.todo ? ' <span class="badge todo">간격 확인 필요</span>' : '') + '</td>' +
  '<td>' + v.doses.length + '회</td>' +
  '<td>' + v.doses.map((d) => d.no + '차 ' + esc(d.label)).join('<br>') + '</td></tr>').join('\n        ');

const vacNotes = VACCINES.filter((v) => v.note).map((v) =>
  '<li><strong>' + esc(v.name) + '</strong> — ' + esc(v.note) + '</li>').join('\n      ');

const vaccine2026 = {
  slug: 'vaccine-2026', emoji: '💉',
  hubName: '아기 예방접종 총정리',
  hubDesc: '표준일정 한눈에 보기 · 접종 전후 주의사항 · 지연 시 대처',
  title: '아기 예방접종 총정리 — 표준일정 한눈에 보기와 접종 전후 주의사항 | BabyCalc',
  desc: '생후 0개월부터 만 12세까지 국가예방접종 표준일정을 백신별로 정리하고, 접종 전후 확인할 것과 일정이 밀렸을 때의 대처, 자주 하는 질문을 담았습니다. 질병관리청 예방접종도우미 기준.',
  ogTitle: '아기 예방접종 총정리 — 표준일정과 주의사항',
  ogDesc: '백신별 표준일정, 접종 전후 체크리스트, 일정이 밀렸을 때의 대처까지.',
  h1: '아기 예방접종 총정리', crumbName: '예방접종 총정리',
  lead: '무슨 백신을 언제, 몇 번 맞는지 한 장으로 정리했어요. 접종 전후 확인할 것도 함께 담았습니다.',
  published: '2026-08-19', modified: '2026-08-19',
  bodyHtml: `<section class="card">
    <h2>1. 국가예방접종이란</h2>
    <p class="res-sub">국가예방접종 사업 대상 백신은 <strong>지정 의료기관에서 무료로</strong> 접종할 수 있습니다. 접종 기록은 예방접종도우미(nip.kdca.go.kr)에 전산으로 남고, 어린이집·학교 제출용 증명서도 여기에서 발급받을 수 있습니다.</p>
    <p class="res-sub">접종 시기는 "권장 범위"입니다. 며칠 차이로 어긋나는 것은 큰 문제가 되지 않지만, <strong>백신마다 최소 접종 간격</strong>이 정해져 있어 너무 앞당겨 맞으면 그 회차를 인정받지 못할 수 있습니다.</p>
  </section>

  <section class="card">
    <h2>2. 백신별 표준일정 한눈에</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>백신</th><th>총 횟수</th><th>권장 시기</th></tr></thead>
      <tbody>
        ${vacRows}
      </tbody>
    </table></div>
    <p class="local-note">우리 아기 생년월일로 실제 날짜와 D-day를 보려면 <a href="@UP@vaccine-schedule/">예방접종 일정표 계산기</a>를 이용하세요. 캘린더(.ics) 내보내기도 됩니다.</p>
  </section>

  <section class="card">
    <h2>3. 백신별로 알아 둘 점</h2>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      ${vacNotes}
    </ul>
  </section>

  <section class="card">
    <h2>4. 접종 전 확인할 것</h2>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      <li>아기수첩(또는 접종 기록)을 챙깁니다. 지난 접종 이력이 있어야 다음 차수를 정확히 잡을 수 있습니다.</li>
      <li>열이 있거나 컨디션이 확연히 나쁘면 접종을 미루기도 합니다 — 접종 여부는 의료진이 판단합니다.</li>
      <li>이전 접종 후 이상반응(고열, 심한 부기, 알레르기 반응)이 있었다면 <strong>반드시 미리</strong> 알립니다.</li>
      <li>가능하면 수유·식사와 기저귀 교체를 마치고 방문하면 아기가 덜 힘들어합니다.</li>
    </ul>
    <h2 style="margin-top:18px">5. 접종 후</h2>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      <li>접종 기관에서 <strong>15~30분간 대기</strong>하며 즉시형 이상반응 여부를 관찰하도록 안내받는 경우가 많습니다.</li>
      <li>접종 부위가 붓거나 붉어지는 것, 미열, 보채는 것은 흔한 반응입니다.</li>
      <li>당일 목욕은 아기 상태가 좋으면 대체로 가능하다고 안내되지만, 접종 기관의 안내를 우선하세요.</li>
      <li>고열이 지속되거나 경련·호흡곤란·심한 처짐이 있으면 <strong>즉시 진료</strong>를 받으세요. → <a href="@UP@fever-guide/">발열 대처 가이드</a></li>
    </ul>
  </section>

  <section class="card">
    <h2>6. 일정이 밀렸다면</h2>
    <p class="res-sub">접종이 늦어졌다고 처음부터 다시 맞아야 하는 경우는 드뭅니다. 대부분은 <strong>따라잡기(catch-up) 일정</strong>에 따라 이어서 접종합니다. 다만 백신·나이별로 필요한 횟수와 간격이 달라지므로, 밀린 경우에는 임의로 판단하지 말고 접종기관이나 예방접종도우미에서 확인하세요.</p>
    <p class="res-sub">해외에서 접종한 이력이 있다면 접종 기록(영문 증명서 등)을 지참해야 국내 일정에 반영할 수 있습니다.</p>
  </section>`,
  faq: [
    { q: '두 가지 백신을 같은 날 맞아도 되나요?', a: '표준일정상 같은 시기에 겹치는 백신들은 동시 접종이 가능하도록 안내되는 경우가 많습니다. 다만 백신 조합과 아기 상태에 따라 다르므로 접종기관에서 판단합니다.' },
    { q: '일본뇌염은 어떤 백신을 골라야 하나요?', a: '불활성화 백신(총 5회)과 약독화 생백신(총 2회) 중 하나를 선택해 접종하며, 교차 접종은 원칙적으로 권장되지 않습니다. 처음 선택한 종류를 유지하는 것이 일반적입니다.' },
    { q: '접종 기록은 어디서 확인하나요?', a: '질병관리청 예방접종도우미(nip.kdca.go.kr)에서 확인·출력할 수 있습니다. 어린이집·학교 제출용 증명서도 이곳에서 발급됩니다.' },
    { q: '접종 후 열이 나면 해열제를 먹여도 되나요?', a: '해열제 사용 여부와 용량은 접종기관에서 안내받은 대로 따르세요. 이 사이트는 해열제 용량을 계산하지 않습니다. 고열이 지속되거나 아이가 처지면 진료를 받으세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + VAC_SRC.name + ' — <a href="' + VAC_SRC.url + '" target="_blank" rel="noopener">' + VAC_SRC.url + '</a> (확인일 ' + VAC_SRC.checkedAt + '). ' +
    '이 글은 표준 권장 "시기(개월)"만 다룹니다. 차수 간 최소 간격과 따라잡기 일정은 원문·접종기관 기준이며, 일부 항목은 <span class="badge todo">확인 필요</span>로 표기했습니다.',
  related: [
    { href: '@UP@vaccine-schedule/', ic: '💉', name: '예방접종 일정표 계산기' },
    { href: '@UP@fever-guide/', ic: '🌡️', name: '발열 대처 가이드' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미 (TomatoEggCat)' },
    { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
  ],
};

const stageCards = STAGES.map((s) =>
  '<div class="kv"><span class="k"><strong>' + esc(s.name) + '</strong><br><span style="font-size:12.5px">' + esc(s.months) + '</span></span>' +
  '<span class="v" style="font-weight:400;text-align:left;color:var(--tx3)">' + esc(s.desc) + '</span></div>').join('\n    ');

const firstIngredients = INGREDIENTS.filter((i) => i.stage === 'early').slice(0, 10);
const banned = INGREDIENTS.filter((i) => i.verdict === 'no');

const weaningStart = {
  slug: 'weaning-start', emoji: '🥄',
  hubName: '이유식 시작 가이드',
  hubDesc: '언제 시작할까 · 첫 재료 · 하루 흐름 · 돌 전 금지 음식',
  title: '이유식 시작 가이드 — 언제, 무엇부터, 어떻게 시작할까 | BabyCalc',
  desc: '이유식은 생후 6개월경 시작이 기본 권고입니다. 시작 신호와 첫 재료 고르는 법, 하루 흐름 예시, 새 재료 3원칙, 돌 전에는 주지 않는 음식까지 처음 시작하는 부모를 위해 정리했습니다.',
  ogTitle: '이유식 시작 가이드 — 처음이라면 여기부터',
  ogDesc: '시작 시기·첫 재료·하루 흐름·돌 전 금지 음식까지 한 번에.',
  h1: '이유식 시작 가이드', crumbName: '이유식 시작',
  lead: '언제부터, 무엇부터, 얼마나. 처음 이유식을 시작할 때 꼭 알아야 할 것만 모았어요.',
  published: '2026-08-19', modified: '2026-08-19',
  bodyHtml: `<section class="card">
    <h2>1. 언제 시작하나요</h2>
    <p class="res-sub">세계보건기구와 국내 지침은 공통적으로 <strong>생후 6개월경(약 180일)에 시작하고, 모유·분유는 계속 유지</strong>할 것을 권합니다. 너무 이르면 소화·알레르기 부담이, 너무 늦으면 철분 부족과 씹는 연습 지연이 문제가 될 수 있습니다.</p>
    <p class="res-sub">월령보다 중요한 것은 <strong>아기의 준비 신호</strong>입니다.</p>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      <li>목을 잘 가누고, 받쳐 주면 앉은 자세를 유지한다</li>
      <li>어른이 먹는 것을 보며 입을 오물거리거나 관심을 보인다</li>
      <li>혀로 밀어내는 반사(혀내밀기)가 줄었다</li>
      <li>숟가락을 입에 대면 입을 벌린다</li>
    </ul>
    <p class="local-note">우리 아기가 지금 몇 단계인지는 <a href="@UP@weaning-stage/">이유식 단계 계산기</a>에서 바로 확인할 수 있어요.</p>
  </section>

  <section class="card">
    <h2>2. 단계별 흐름</h2>
    ${stageCards}
    <p class="local-note">진도는 표가 아니라 아기가 정합니다. 잘 삼키면 조금 빠르게, 힘들어하면 천천히 가도 괜찮습니다.</p>
  </section>

  <section class="card">
    <h2>3. 첫 재료는 무엇으로</h2>
    <p class="res-sub">첫 재료로는 알레르기 위험이 낮고 소화가 쉬운 <strong>쌀미음</strong>으로 시작하는 경우가 가장 많습니다. 이후 채소·과일 퓌레를 하나씩 늘리고, 국내에서는 철분 보충을 위해 <strong>소고기를 비교적 이른 시기에</strong> 도입하도록 권하는 안내가 많습니다.</p>
    <div class="rel-grid">
      ${firstIngredients.map((i) => '<a class="rel" href="@UP@weaning-stage/' + i.slug + '/"><span class="ic">🥄</span>' + esc(i.name) + '</a>').join('\n      ')}
    </div>
  </section>

  <section class="card">
    <h2>4. 하루 흐름 예시 (초기)</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>시점</th><th>내용</th></tr></thead>
      <tbody>
        <tr><td>오전 (수유 사이)</td><td>이유식 1회 — 처음엔 1~2작은술부터, 수유는 평소대로</td></tr>
        <tr><td>이후 2~3일</td><td>같은 재료를 유지하며 반응 관찰, 이상 없으면 양을 조금씩 늘림</td></tr>
        <tr><td>1~2주 후</td><td>새 재료 하나 추가 (한 번에 하나씩)</td></tr>
        <tr><td>중기 진입</td><td>하루 2회로 늘리고 입자를 조금 굵게</td></tr>
      </tbody>
    </table></div>
    <p class="local-note">초기에는 "얼마나 먹였는지"보다 <strong>숟가락과 새로운 맛에 익숙해지는 것</strong>이 목표입니다. 남겨도 괜찮습니다.</p>
  </section>

  <section class="card">
    <h2>5. 새 재료 3원칙</h2>
    <ul style="margin:0;padding-left:20px;color:var(--tx2);font-size:14.5px">
      <li><strong>한 번에 하나씩</strong> — 반응이 나타났을 때 원인을 알 수 있습니다.</li>
      <li><strong>오전에 소량부터</strong> — 이상이 생겨도 낮에 병원에 갈 수 있습니다.</li>
      <li><strong>2~3일 관찰</strong> — 발진·구토·설사·호흡 변화가 없으면 다음 재료로.</li>
    </ul>
    <p class="med-notice" style="margin-top:14px">⚠ 두드러기, 입술·눈 주위 부종, 구토, 호흡곤란 등 급성 반응이 나타나면 즉시 진료를 받으세요(심하면 119). 알레르기 가족력이 있으면 도입 전에 소아과 전문의와 상담하는 것이 안전합니다.</p>
  </section>

  <section class="card">
    <h2>6. 돌 전에는 주지 않는 것</h2>
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>음식</th><th>이유</th></tr></thead>
      <tbody>
        ${banned.map((b) => '<tr><td><a href="@UP@weaning-stage/' + b.slug + '/">' + esc(b.name) + '</a></td><td>' + esc(b.summary) + '</td></tr>').join('\n        ')}
      </tbody>
    </table></div>
    <h2 style="margin-top:18px">질식 위험 음식</h2>
    <p class="res-sub">둥글고 단단하거나 미끄러운 음식은 그대로 주지 않습니다. <strong>통포도·방울토마토는 세로로 4등분</strong>, <strong>통견과·통콩은 만 4세 전까지 금지</strong>(갈아서만), 생당근·사과 조각은 익히거나 얇게 저며 줍니다. 먹는 동안에는 반드시 앉힌 자세로, 옆에서 지켜보세요.</p>
  </section>`,
  faq: [
    { q: '이유식을 시작하면 분유량을 줄여야 하나요?', a: '초기에는 모유·분유가 여전히 주된 영양원이라 그대로 유지합니다. 후기로 갈수록 이유식 비중이 늘면서 자연스럽게 수유량이 줄어듭니다.' },
    { q: '아기가 이유식을 뱉어요.', a: '초기에는 혀로 밀어내는 반사가 남아 있어 흔한 일입니다. 억지로 먹이지 말고 며칠 뒤 다시 시도해 보세요. 지속적으로 거부하고 체중이 늘지 않으면 진료를 받으세요.' },
    { q: '간은 언제부터 하나요?', a: '돌 전 이유식에는 소금·설탕을 넣지 않는 것이 표준 권고입니다. 돌 이후에도 저염을 유지하고 가족 식사에서 간을 하기 전에 덜어 주는 방식이 권장됩니다.' },
    { q: '시판 이유식을 써도 되나요?', a: '영양 균형이 맞춰진 제품을 활용하는 것 자체는 문제가 없습니다. 다만 새 재료 도입 원칙(하나씩·소량·관찰)은 동일하게 적용하고, 원재료 표시를 확인하세요.' },
  ],
  srcHtml: '<strong>출처</strong> · ' + WEAN_SRC.name + ' — <a href="' + WEAN_SRC.url + '" target="_blank" rel="noopener">' + WEAN_SRC.url + '</a> / WHO 보충식 권고 <a href="' + WEAN_SRC.urlWho + '" target="_blank" rel="noopener">who.int</a> (확인일 ' + WEAN_SRC.checkedAt + '). ' +
    '재료별 도입 시기는 자료마다 안내가 달라 대부분 <span class="badge todo">확인 필요</span>(일반 안내 수준)이며, 꿀·생우유·과일주스·통견과 등 금지·질식 항목은 출처가 분명한 확정 정보입니다.',
  related: [
    { href: '@UP@weaning-stage/', ic: '🥣', name: '이유식 단계 계산기' },
    { href: '@UP@formula-amount/', ic: '🍼', name: '분유 수유량 계산기' },
    { href: '@UP@months-age/', ic: '📅', name: '아기 개월수 계산기' },
    { href: 'https://tomatoeggcat.com/korean-age/', ic: '🍅', name: '만 나이 계산기' },
    { href: 'https://tomatoeggcat.com/baby-vaccine-schedule/', ic: '🍅', name: '예방접종 도우미 (TomatoEggCat)' },
  ],
};

export const GUIDES = [vaccine2026, weaningStart];
