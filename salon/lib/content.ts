// Phase 2 — 매일 1개 콘텐츠 초안 생성에 쓰이는 순수 로직.
// 모델 호출(I/O)은 scripts/daily-post.mjs 가 담당하고, 이 파일은 전부 순수 함수로 유지해
// node --test 로 검증한다. 고객 데이터·사진은 여기서도 스크립트에서도 쓰지 않는다
// (consent_photo 동의 문제가 구조적으로 발생하지 않도록 DB 접근 자체를 하지 않는다).

export type Topic = { key: string; title: string; angle: string };

/** 주제 풀. 하루 1개씩 돌려 쓰며, 최근 사용분은 건너뛴다. */
export const TOPICS: Topic[] = [
  { key: "care-basics", title: "붙임머리 기본 관리법", angle: "세안·드라이·빗질 순서를 하루 루틴으로" },
  { key: "types-compare", title: "붙임머리 방식 비교", angle: "링/테이프/구슬 방식의 체감 차이와 어울리는 모발" },
  { key: "retouch-cycle", title: "리터치 주기 잡기", angle: "4~6주 사이에서 내 모발에 맞는 간격 찾기" },
  { key: "wig-or-ext", title: "가발과 붙임머리 중 선택", angle: "생활 패턴·숱·예산 기준으로 고르는 법" },
  { key: "wig-first-buy", title: "첫 가발 고를 때 체크리스트", angle: "사이즈·가르마·색·캡 종류" },
  { key: "wig-wash", title: "가발 세척과 보관", angle: "주기, 쓰면 안 되는 제품, 보관 자세" },
  { key: "wig-full-partial", title: "통가발과 부분가발", angle: "커버 범위와 착용감 차이" },
  { key: "crown-cover", title: "정수리 커버 고민", angle: "가르마 위치·볼륨으로 자연스럽게 보이게" },
  { key: "damage-min", title: "손상 줄이는 시술 전후 관리", angle: "시술 전 준비와 시술 후 2주" },
  { key: "scalp-care", title: "붙임머리 중 두피 관리", angle: "가려움·냄새·뭉침을 막는 방법" },
  { key: "event-timeline", title: "행사 전 머리 준비 일정", angle: "결혼식·면접 D-30부터의 역산 일정" },
  { key: "thin-hair-style", title: "숱 적을 때 스타일링", angle: "길이·층·볼륨으로 보완" },
  { key: "color-match", title: "붙임머리 색 맞추기", angle: "탈색 없이 톤 맞추는 현실적인 방법" },
  { key: "wig-parting", title: "가발 가르마 자연스럽게", angle: "앞머리 라인과 가르마 손질" },
  { key: "summer-care", title: "여름철 관리", angle: "땀·습기·자외선에서 버티게 하기" },
  { key: "winter-care", title: "겨울철 정전기와 엉킴", angle: "니트·모자와 함께 쓰는 요령" },
  { key: "sports-water", title: "운동·수영할 때", angle: "묶는 방법과 물 닿은 뒤 처리" },
  { key: "price-structure", title: "가격이 정해지는 기준", angle: "길이·모량·방식에 따라 달라지는 이유" },
  { key: "home-tools", title: "집에 두면 좋은 관리 도구", angle: "빗·오일·드라이 온도" },
  { key: "removal", title: "제거 시기와 방법", angle: "미루면 생기는 일, 셀프 제거를 권하지 않는 이유" },
  { key: "sensitive-hairloss", title: "숱 고민이 깊을 때 상담 흐름", angle: "민감한 고민을 편하게 꺼낼 수 있도록 (의학적 조언 없이 시술 범위만)" },
  { key: "wonju-faq", title: "원주 고객들이 자주 묻는 것", angle: "주차·소요 시간·예약 방법" },
  { key: "first-visit", title: "첫 방문 상담은 이렇게", angle: "상담 → 모발 확인 → 견적 → 예약" },
  { key: "describe-style", title: "원하는 스타일 설명하는 법", angle: "사진 없이 말로 전달할 때 쓰는 단어" },
  { key: "hair-type-rec", title: "모발 상태별 추천", angle: "얇은 모발·곱슬·염색모에 맞는 선택" },
  { key: "longevity", title: "오래 쓰는 습관", angle: "유지 기간을 늘리는 작은 습관들" },
  { key: "heat-tools", title: "열기구 사용 주의", angle: "가발·붙임머리에 쓸 수 있는 온도" },
  { key: "face-shape", title: "얼굴형·두상별 길이", angle: "길이와 층을 정하는 기준 (외모 평가 없이)" },
  { key: "revisit-prep", title: "재방문 전 준비", angle: "오기 전에 해두면 좋은 것" },
  { key: "faq-roundup", title: "자주 받는 질문 모음", angle: "가격·시간·예약·관리 한 번에" },
];

/** 후킹 형식 5종 — 날짜에 따라 돌아간다. */
export const HOOKS = [
  { key: "question", label: "질문형", guide: "고객이 속으로 하던 질문을 그대로 제목으로 던진다" },
  { key: "number", label: "숫자형", guide: "'3가지', '2주' 같이 셀 수 있는 숫자로 시작한다" },
  { key: "empathy", label: "공감형", guide: "흔한 불편을 먼저 인정하고 시작한다" },
  { key: "compare", label: "비교형", guide: "A와 B를 나란히 놓고 차이를 먼저 보여준다" },
  { key: "checklist", label: "체크리스트형", guide: "읽는 사람이 바로 체크해볼 항목을 앞세운다" },
] as const;

export const LOCAL_TAGS = [
  "#원주미용실", "#원주붙임머리", "#원주가발", "#원주헤어", "#원주미용실추천",
  "#단계동미용실", "#무실동미용실", "#원주맘", "#강원도미용실", "#원주헤어샵",
];

export const SERVICE_TAGS = [
  "#붙임머리", "#가발", "#부분가발", "#통가발", "#붙임머리관리",
  "#링붙임머리", "#테이프붙임머리", "#가발관리", "#정수리커버", "#헤어연장",
];

export const GENERAL_TAGS = [
  "#헤어스타일", "#헤어케어", "#머리숱", "#모발관리", "#데일리헤어",
  "#셀프관리", "#뷰티팁", "#헤어고민", "#스타일링", "#미용실추천",
];

/** 'YYYY-MM-DD' → 1970-01-01 기준 일수. 로테이션 기준값. */
export function dayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 풀을 dayIndex 만큼 회전시킨 뒤 최근 사용분을 건너뛰고 고른다. */
export function pickTopic(dateStr: string, usedKeys: readonly string[] = []): Topic {
  const start = ((dayIndex(dateStr) % TOPICS.length) + TOPICS.length) % TOPICS.length;
  const used = new Set(usedKeys);
  for (let i = 0; i < TOPICS.length; i++) {
    const t = TOPICS[(start + i) % TOPICS.length];
    if (!used.has(t.key)) return t;
  }
  return TOPICS[start]; // 전부 최근에 썼다면 회전 순서를 따른다
}

export function pickHook(dateStr: string): (typeof HOOKS)[number] {
  return HOOKS[((dayIndex(dateStr) % HOOKS.length) + HOOKS.length) % HOOKS.length];
}

function window5(pool: readonly string[], offset: number): string[] {
  const n = pool.length;
  const start = ((offset % n) + n) % n;
  return Array.from({ length: 5 }, (_, i) => pool[(start + i) % n]);
}

/** 해시태그 15개 = 로컬 5 + 시술 5 + 일반 5. 본문이 아니라 스크립트가 직접 붙인다. */
export function pickHashtags(dateStr: string): string[] {
  const i = dayIndex(dateStr);
  return [...window5(LOCAL_TAGS, i), ...window5(SERVICE_TAGS, i * 2), ...window5(GENERAL_TAGS, i * 3)];
}

export const SHOP = {
  name: "정화 머리방",
  region: "강원도 원주",
  specialty: "붙임머리·가발",
} as const;

export const SYSTEM_PROMPT = [
  `너는 ${SHOP.region}에 있는 1인 미용실 "${SHOP.name}"의 사장님을 대신해 블로그·스레드 초안을 쓰는 작가다.`,
  `전문 분야는 ${SHOP.specialty}이고, 글은 사장님이 직접 말하는 1인칭 존댓말로 쓴다.`,
  "",
  '톤: 차분하고 과장 없다. 느낌표와 이모지는 쓰지 않는다. 광고 문구체("최고", "유일") 금지.',
  "",
  "반드시 지킬 것:",
  "- 의학·치료 주장 금지. 탈모·두피 질환을 치료/완치/개선한다고 쓰지 않고, 필요하면 병원 상담을 권한다.",
  "- 특정 효과나 유지 기간을 보장하지 않는다. '보통', '사람마다 다르다' 같은 표현으로 범위를 둔다.",
  "- 가격은 구체 금액을 쓰지 않고 구성 기준만 설명한다 (상담 후 안내).",
  "- 외모 평가·비하 금지. 얼굴형이나 숱을 문제로 규정하지 않고 선택지로만 다룬다.",
  "- 실제 고객 사례·사진·실명·연락처를 쓰지 않는다. 가상의 후기도 만들지 않는다.",
  "- 통계나 연구를 인용하지 않는다 (확인할 수 없는 숫자 금지).",
  `- 지역 키워드(${SHOP.region}, 원주)와 시술 키워드(붙임머리, 가발)를 본문에 자연스럽게 넣는다.`,
].join("\n");

/** 모델에 보낼 지시문. 섹션 구조는 validateDraft 와 1:1로 맞춘다. */
export function buildUserPrompt(topic: Topic, hook: (typeof HOOKS)[number], dateStr: string): string {
  return [
    `오늘(${dateStr}) 글의 주제: ${topic.title}`,
    `다루는 각도: ${topic.angle}`,
    `제목 형식: ${hook.label} — ${hook.guide}`,
    "",
    "아래 네 섹션만, 이 순서와 제목 그대로 마크다운으로 출력한다. 다른 머리말·설명·코드블록은 넣지 않는다.",
    "",
    "## 제목",
    "한 줄. 25자 안쪽. 지역이나 시술 키워드 중 하나는 포함.",
    "",
    "## 블로그 본문",
    "800~1200자. 소제목(###) 2~3개로 나눈다. 마지막은 상담·예약을 부담 없이 권하는 2~3문장.",
    "",
    "## 스레드 캡션",
    "150~300자. 줄바꿈 2~3번. 해시태그는 쓰지 않는다(스크립트가 따로 붙인다).",
    "",
    "## 사장님 확인",
    "게시 전에 사장님이 직접 확인할 항목 3개를 '- '로 나열한다 (사실 확인이 필요한 부분 중심).",
  ].join("\n");
}

export const REQUIRED_SECTIONS = ["## 제목", "## 블로그 본문", "## 스레드 캡션", "## 사장님 확인"];

/** 게시 전에 반드시 사람이 걸러야 하는 표현들. 하나라도 걸리면 초안을 버린다. */
const BANNED: { re: RegExp; why: string }[] = [
  { re: /완치|치료(?:해|합니다|됩니다|효과)|탈모\s*치료|발모/, why: "의학적 치료 주장" },
  { re: /부작용\s*(?:이)?\s*없|100\s*%|무조건\s*(?:좋|효과)/, why: "효과 보장 표현" },
  { re: /진단서|의학적\s*으?로?\s*(?:증명|입증)/, why: "의학적 권위 주장" },
  { re: /못생|추하|뚱뚱|못난|흉하/, why: "외모 비하" },
  { re: /주민\s*등록\s*번호|주민번호/, why: "민감정보 언급" },
  { re: /010[-\s]?\d{3,4}[-\s]?\d{4}/, why: "전화번호 노출" },
  { re: /REPLACE_|광고\s*영역|TODO|\[\[/, why: "플레이스홀더 잔재" },
];

export type Validation = { ok: boolean; problems: string[] };

export function validateDraft(body: string): Validation {
  const problems: string[] = [];
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^${section}\\s*$`, "m").test(body)) problems.push(`누락된 섹션: ${section}`);
  }
  if (body.replace(/\s/g, "").length < 600) problems.push("본문이 너무 짧다 (공백 제외 600자 미만)");
  if (/```/.test(body)) problems.push("코드블록이 포함됐다");
  if (/#\S+/.test(body.replace(/^#{1,6}\s/gm, ""))) problems.push("본문에 해시태그가 들어갔다");
  for (const { re, why } of BANNED) {
    const m = body.match(re);
    if (m) problems.push(`금지 표현(${why}): "${m[0]}"`);
  }
  return { ok: problems.length === 0, problems };
}

/** 초안 파일 전문 (front matter + 모델 출력 + 해시태그). */
export function renderDraft(opts: {
  dateStr: string;
  topic: Topic;
  hook: (typeof HOOKS)[number];
  hashtags: readonly string[];
  body: string;
  model: string;
}): string {
  const { dateStr, topic, hook, hashtags, body, model } = opts;
  const front = [
    "---",
    `date: ${dateStr}`,
    `topic: ${topic.key}`,
    `topic_title: ${topic.title}`,
    `hook: ${hook.key}`,
    `model: ${model}`,
    "status: draft",
    "---",
  ].join("\n");
  const tags = [
    "## 해시태그",
    "",
    `로컬 5 + 시술 5 + 일반 5 = ${hashtags.length}개`,
    "",
    hashtags.join(" "),
  ].join("\n");
  return [
    front,
    "",
    `> 자동 생성 초안이다. 사장님이 사실 확인하고 고친 뒤에 게시한다. 그대로 올리지 않는다.`,
    "",
    body.trim(),
    "",
    tags,
    "",
  ].join("\n");
}

/** 최근 초안들의 front matter 에서 topic 키를 뽑는다 (중복 주제 회피용). */
export function usedTopicKeys(fileContents: readonly string[]): string[] {
  return fileContents
    .map((c) => c.match(/^topic:\s*(\S+)\s*$/m)?.[1])
    .filter((k): k is string => Boolean(k));
}
