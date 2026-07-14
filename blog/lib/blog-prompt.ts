// blog-prompt.ts — buildBlogPrompt(topic)
// Claude 프롬프트를 매 호출마다 구조/길이/톤을 랜덤화해서 "AI 템플릿 티"를 지운다.
// (저품질·봇 패턴 회피가 목적)

import type { BlogTopic } from "./blog-topics";

const STRUCTURES = [
  { name: "문제제기형", hint: "독자가 실제로 겪는 구체적 상황이나 흔한 실수를 먼저 던지고, 그걸 풀어가는 흐름으로 전개한다." },
  { name: "두괄식", hint: "가장 중요한 결론·핵심 수치를 첫 문단에 바로 제시하고, 이후에 근거와 세부를 붙인다." },
  { name: "예시시작형", hint: "구체적인 예시(가상의 인물·금액·상황)로 문을 열고, 거기서 일반 원리로 확장한다." },
  { name: "문답형", hint: "독자가 검색하며 떠올릴 법한 질문들을 소제목으로 세우고 하나씩 답해준다." },
  { name: "오해바로잡기형", hint: "흔히 잘못 알려진 통념을 먼저 짚고, 실제는 어떤지 바로잡아가며 설명한다." },
];

const LENGTHS = [800, 1200, 1500];

const TONES = [
  { name: "친근한 존댓말", hint: "옆에서 편하게 알려주듯, 다정하지만 과하지 않은 존댓말." },
  { name: "신뢰감 존댓말", hint: "차분하고 근거 있는, 전문가가 정확히 설명해주는 듯한 존댓말." },
  { name: "담백한 존댓말", hint: "군더더기 없이 담백하게, 핵심만 또렷하게 전하는 존댓말." },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface BlogPrompt {
  system: string;
  user: string;
  meta: { structure: string; length: number; tone: string };
}

export function buildBlogPrompt(topic: BlogTopic): BlogPrompt {
  const structure = pick(STRUCTURES);
  const length = pick(LENGTHS);
  const tone = pick(TONES);

  const toolUrl = `https://tomatoeggcat.com/${topic.toolSlug}/`;

  const system =
    "당신은 특정 분야를 오래 다뤄온 한국어 블로거입니다. " +
    "사람이 직접 쓴 것처럼 자연스럽고 진솔하게, 과장이나 클릭베이트 없이 씁니다. " +
    "정보의 정확성을 중시하고, 확실하지 않은 수치는 단정하지 않습니다. " +
    "출력은 항상 지정된 JSON 형식만 반환하고 그 외의 말은 하지 않습니다.";

  const user = [
    `주제: ${topic.searchTopic}`,
    `핵심 검색어: ${topic.keyword}`,
    `이 글에서 특히 살릴 초점: ${topic.angle}`,
    ``,
    `[글의 구조 — ${structure.name}]`,
    structure.hint,
    ``,
    `[분량] 공백 제외 약 ${length}자 내외. 억지로 늘리지 말고 이 분량 안에서 알차게.`,
    ``,
    `[톤 — ${tone.name}]`,
    tone.hint,
    ``,
    `[반드시 지킬 규칙]`,
    `- 글의 80% 이상은 독자에게 실제로 도움이 되는 정보로 채운다. 광고가 목적이 아니다.`,
    `- 글 후반부에 딱 한 번만, 관련 계산/확인 도구로 ${toolUrl} 를 자연스럽게 링크한다. ("직접 계산해보려면 여기서 해볼 수 있어요" 같은 담백한 맥락. 광고 문구·호들갑 금지.)`,
    `- 링크는 이 URL 하나만. 두 번 이상 넣지 않는다.`,
    `- "우리 서비스", "톳에그캣이 만든", "저희가 준비한" 같은 자기지칭·홍보 표현 금지. 도구는 그냥 참고할 수 있는 것으로만 언급.`,
    `- AI 상투구 금지: "오늘은 ~에 대해 알아보겠습니다", "지금부터 살펴보겠습니다", "~에 대해 알아보는 시간을 가져볼게요", "결론적으로", "마무리하며" 같은 뻔한 도입/마무리 표현을 쓰지 않는다.`,
    `- 실제 사람이 자기 블로그에 쓴 글처럼, 자연스러운 문장 리듬과 약간의 개인적 관점을 담는다.`,
    `- 확실하지 않은 최신 제도·수치는 "대체로", "일반적으로" 처럼 여지를 두거나, 공식 확인을 권한다.`,
    ``,
    `[출력 형식] 아래 JSON 객체 하나만 반환한다. 코드펜스 없이 순수 JSON.`,
    `{`,
    `  "title": "글 제목 (자연스럽고 검색어를 살린)",`,
    `  "slug": "english-lowercase-hyphen-slug",  // URL용. 영문 소문자와 하이픈만.`,
    `  "excerpt": "1~2문장 요약 (검색결과·목록 카드에 노출)",`,
    `  "tags": ["관련", "태그", "3~6개"],`,
    `  "html": "<p>...</p><h2>...</h2><ul><li>...</li></ul> 형태의 본문. p·h2·ul·li 사용. 도구 링크는 <a href=\\"${toolUrl}\\">앵커텍스트</a>. <html>/<body> 태그는 넣지 않는다."`,
    `}`,
  ].join("\n");

  return { system, user, meta: { structure: structure.name, length, tone: tone.name } };
}
