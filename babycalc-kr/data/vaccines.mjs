/* 표준예방접종일정 (어린이 국가예방접종)
 * 출처: 질병관리청 예방접종도우미 — 표준예방접종일정표
 * 원문 확인: https://nip.kdca.go.kr
 * 주의: 접종 간격·차수 세부(최소 간격, 지연 시 따라잡기 일정 등)는 접종기관/질병관리청
 * 일정표 원문 기준. 여기서는 표준 권장 "시기(개월)" 창만 다룬다.
 */
export const SOURCE = {
  name: '질병관리청 예방접종도우미(표준예방접종일정표)',
  url: 'https://nip.kdca.go.kr',
  checkedAt: '2026-08-19',
};

/* startM/endM: 권장 시작·종료 시점(생후 개월). endM은 해당 개월의 말까지 의미.
 * 예) startM:12,endM:15 → 생후 12~15개월. todo:true 항목은 세부 간격 확인 필요. */
export const VACCINES = [
  {
    id: 'bcg', name: 'BCG(결핵, 피내용)',
    doses: [{ no: 1, startM: 0, endM: 1, label: '생후 4주 이내' }],
  },
  {
    id: 'hepb', name: 'B형간염(HepB)',
    doses: [
      { no: 1, startM: 0, endM: 0, label: '출생 직후(0개월)' },
      { no: 2, startM: 1, endM: 1, label: '생후 1개월' },
      { no: 3, startM: 6, endM: 6, label: '생후 6개월' },
    ],
  },
  {
    id: 'dtap', name: 'DTaP(디프테리아·파상풍·백일해)',
    doses: [
      { no: 1, startM: 2, endM: 2, label: '생후 2개월' },
      { no: 2, startM: 4, endM: 4, label: '생후 4개월' },
      { no: 3, startM: 6, endM: 6, label: '생후 6개월' },
      { no: 4, startM: 15, endM: 18, label: '생후 15~18개월' },
      { no: 5, startM: 48, endM: 83, label: '만 4~6세' },
    ],
  },
  {
    id: 'ipv', name: 'IPV(폴리오)',
    doses: [
      { no: 1, startM: 2, endM: 2, label: '생후 2개월' },
      { no: 2, startM: 4, endM: 4, label: '생후 4개월' },
      { no: 3, startM: 6, endM: 18, label: '생후 6~18개월' },
      { no: 4, startM: 48, endM: 83, label: '만 4~6세' },
    ],
  },
  {
    id: 'hib', name: 'Hib(b형 헤모필루스 인플루엔자)',
    doses: [
      { no: 1, startM: 2, endM: 2, label: '생후 2개월' },
      { no: 2, startM: 4, endM: 4, label: '생후 4개월' },
      { no: 3, startM: 6, endM: 6, label: '생후 6개월' },
      { no: 4, startM: 12, endM: 15, label: '생후 12~15개월' },
    ],
  },
  {
    id: 'pcv', name: 'PCV(폐렴구균)',
    doses: [
      { no: 1, startM: 2, endM: 2, label: '생후 2개월' },
      { no: 2, startM: 4, endM: 4, label: '생후 4개월' },
      { no: 3, startM: 6, endM: 6, label: '생후 6개월' },
      { no: 4, startM: 12, endM: 15, label: '생후 12~15개월' },
    ],
  },
  {
    id: 'rv', name: '로타바이러스(RV)',
    note: '로타릭스(1가) 2회(2·4개월) 또는 로타텍(5가) 3회(2·4·6개월). 제품에 따라 차수가 다르며 첫 접종 시작 가능 연령 제한이 있으니 접종기관에서 확인.',
    doses: [
      { no: 1, startM: 2, endM: 2, label: '생후 2개월' },
      { no: 2, startM: 4, endM: 4, label: '생후 4개월' },
      { no: 3, startM: 6, endM: 6, label: '생후 6개월 (로타텍 5가만)', optional: true },
    ],
  },
  {
    id: 'mmr', name: 'MMR(홍역·유행성이하선염·풍진)',
    doses: [
      { no: 1, startM: 12, endM: 15, label: '생후 12~15개월' },
      { no: 2, startM: 48, endM: 83, label: '만 4~6세' },
    ],
  },
  {
    id: 'var', name: '수두(VAR)',
    doses: [{ no: 1, startM: 12, endM: 15, label: '생후 12~15개월' }],
  },
  {
    id: 'hepa', name: 'A형간염(HepA)',
    note: '1차 접종 후 6개월 이상 간격을 두고 2차 접종.',
    doses: [
      { no: 1, startM: 12, endM: 23, label: '생후 12~23개월 (1차)' },
      { no: 2, startM: 18, endM: 35, label: '1차 후 6개월 이상 간격 (2차)' },
    ],
  },
  {
    id: 'ijev', name: '일본뇌염(불활성화 백신)',
    note: '1·2차는 생후 12~23개월에 시작. 3차는 24~35개월, 이후 만 6세·만 12세 추가. 차수 간 세부 간격은 질병관리청 일정표 원문 확인.',
    todo: true, // 차수 간 정확한 최소 간격 미기재 → 원문 확인 필요
    doses: [
      { no: 1, startM: 12, endM: 23, label: '생후 12~23개월 (1차)' },
      { no: 2, startM: 12, endM: 23, label: '생후 12~23개월 (2차, 1차와 간격 필요)' },
      { no: 3, startM: 24, endM: 35, label: '생후 24~35개월 (3차)' },
      { no: 4, startM: 72, endM: 83, label: '만 6세 (4차)' },
      { no: 5, startM: 144, endM: 155, label: '만 12세 (5차)' },
    ],
  },
  {
    id: 'ljev', name: '일본뇌염(약독화 생백신)',
    note: '불활성화 백신 대신 선택 시. 2회 접종.',
    doses: [
      { no: 1, startM: 12, endM: 23, label: '생후 12~23개월 (1차)' },
      { no: 2, startM: 24, endM: 35, label: '생후 24~35개월 (2차)' },
    ],
  },
  {
    id: 'iiv', name: '인플루엔자(IIV, 매년)',
    note: '생후 6개월부터 매년 접종. 첫 해에는 4주 간격 2회 접종이 필요할 수 있음(접종력 기준).',
    doses: [{ no: 1, startM: 6, endM: 6, label: '생후 6개월부터 매년(우선 첫 접종)' }],
  },
];
