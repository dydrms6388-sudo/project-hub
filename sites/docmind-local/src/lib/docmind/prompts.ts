/**
 * 프롬프트 템플릿 — 순수 함수. 도구별 map/reduce 프롬프트를 한 곳에 모은다.
 * 모든 프롬프트는 "문서에 없는 내용을 지어내지 말 것"을 명시한다(환각 억제).
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type SummaryLength = "3줄" | "문단" | "상세";

export const SUMMARY_LENGTHS: { value: SummaryLength; label: string; hint: string }[] = [
  { value: "3줄", label: "3줄 요약", hint: "핵심만 3문장" },
  { value: "문단", label: "한 문단", hint: "5~7문장 분량" },
  { value: "상세", label: "상세 요약", hint: "소제목 + 불릿" },
];

const BASE_RULES = [
  "너는 문서 요약 도우미다. 반드시 한국어로만 답한다.",
  "주어진 발췌문에 실제로 적힌 내용만 사용한다. 없는 사실·숫자·인용을 지어내지 않는다.",
  "발췌문에 근거가 없으면 '문서에 없음'이라고 쓴다.",
  "인사말, 사과, 자기소개, '요약하겠습니다' 같은 서두 없이 결과만 출력한다.",
].join(" ");

export function systemMessage(extra?: string): ChatMessage {
  return { role: "system", content: extra ? `${BASE_RULES} ${extra}` : BASE_RULES };
}

function pageLabel(startPage: number, endPage: number): string {
  return startPage === endPage ? `${startPage}쪽` : `${startPage}~${endPage}쪽`;
}

/* ------------------------------------------------------------------ */
/* 1. summarize — 청크 요약(map) → 병합(reduce)                        */
/* ------------------------------------------------------------------ */

export function summarizeMap(chunk: { text: string; startPage: number; endPage: number }): ChatMessage[] {
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `다음은 문서의 ${pageLabel(chunk.startPage, chunk.endPage)} 발췌다.\n` +
        `이 발췌의 핵심을 불릿 3~5개로 정리하라. 각 불릿은 한 문장이며 "- "로 시작한다.\n` +
        `숫자·고유명사·날짜는 원문 그대로 옮긴다.\n\n` +
        `--- 발췌 시작 ---\n${chunk.text}\n--- 발췌 끝 ---`,
    },
  ];
}

const LENGTH_INSTRUCTION: Record<SummaryLength, string> = {
  "3줄": "정확히 3문장으로 요약하라. 각 문장은 줄바꿈으로 구분하고 번호나 기호는 붙이지 않는다.",
  문단: "5~7문장의 한 문단으로 요약하라. 불릿이나 제목은 쓰지 않는다.",
  상세:
    "다음 형식으로 상세 요약하라.\n" +
    "## 한 줄 요약\n(한 문장)\n" +
    "## 핵심 내용\n- 불릿 5~8개\n" +
    "## 세부 사항\n- 숫자·조건·예외 등 놓치면 안 되는 항목 3~6개",
};

export function summarizeReduce(
  parts: string[],
  length: SummaryLength,
  isFinal: boolean,
): ChatMessage[] {
  const joined = parts.map((p, i) => `[부분 ${i + 1}]\n${p}`).join("\n\n");
  if (!isFinal) {
    return [
      systemMessage(),
      {
        role: "user",
        content:
          `아래는 같은 문서의 연속된 부분 요약들이다. 중복을 없애고 순서를 유지한 채 ` +
          `불릿 5~8개로 압축하라. 새로운 내용을 추가하지 않는다.\n\n${joined}`,
      },
    ];
  }
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `아래는 한 문서 전체의 부분 요약들이다. 이를 종합해 문서 전체 요약을 만들어라.\n` +
        `${LENGTH_INSTRUCTION[length]}\n\n${joined}`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 2. ask — RAG                                                        */
/* ------------------------------------------------------------------ */

export type Passage = { text: string; startPage: number; endPage: number };

export function askPrompt(
  question: string,
  passages: Passage[],
  history: ChatMessage[] = [],
): ChatMessage[] {
  const ctx = passages
    .map((p, i) => `[근거 ${i + 1} · ${pageLabel(p.startPage, p.endPage)}]\n${p.text}`)
    .join("\n\n");
  return [
    systemMessage(
      "답변 문장 끝에 사용한 근거 번호를 [근거 1] 형태로 표시한다. 근거에 없는 질문에는 " +
        "'문서에서 찾지 못했습니다'라고만 답한다.",
    ),
    ...history.slice(-4),
    {
      role: "user",
      content:
        `아래 근거 발췌만 사용해 질문에 답하라.\n\n${ctx}\n\n` +
        `--- 질문 ---\n${question}\n\n` +
        `3~6문장으로 답하고, 각 문장 끝에 [근거 n] 을 붙여라.`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 3. keypoints — 불릿 10 + 용어 5                                     */
/* ------------------------------------------------------------------ */

export function keypointsMap(chunk: { text: string; startPage: number; endPage: number }): ChatMessage[] {
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `다음은 문서의 ${pageLabel(chunk.startPage, chunk.endPage)} 발췌다.\n` +
        `(1) 핵심 포인트를 "- "로 시작하는 불릿 3개로,\n` +
        `(2) 이 발췌에 나온 전문 용어/약어를 최대 3개 "* 용어 = 뜻" 형식으로 적어라.\n` +
        `용어가 없으면 (2)는 비워 둔다.\n\n--- 발췌 시작 ---\n${chunk.text}\n--- 발췌 끝 ---`,
    },
  ];
}

export function keypointsReduce(parts: string[], isFinal: boolean): ChatMessage[] {
  const joined = parts.map((p, i) => `[부분 ${i + 1}]\n${p}`).join("\n\n");
  if (!isFinal) {
    return [
      systemMessage(),
      {
        role: "user",
        content: `아래 부분 정리들을 중복 없이 합쳐라. 불릿과 "* 용어 = 뜻" 형식을 유지한다.\n\n${joined}`,
      },
    ];
  }
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `아래 부분 정리를 종합해 다음 형식으로만 출력하라.\n` +
        `## 핵심 10가지\n1. ~ 10. 번호 매긴 한 문장씩 (정확히 10개, 중복 금지)\n` +
        `## 꼭 알아야 할 용어 5개\n- 용어 = 한 문장 설명 (정확히 5개)\n` +
        `문서에 용어가 5개보다 적으면 "문서에 없음"으로 채운다.\n\n${joined}`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 4. translate-summary — 영어 문헌 → 한국어 요약                      */
/* ------------------------------------------------------------------ */

export function translateMap(chunk: { text: string; startPage: number; endPage: number }): ChatMessage[] {
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `다음은 영어 문헌의 ${pageLabel(chunk.startPage, chunk.endPage)} 발췌다.\n` +
        `내용을 한국어 불릿 3~5개로 옮겨 정리하라. 전문 용어는 "한국어(English)" 형태로 병기한다.\n` +
        `수치와 단위는 원문 그대로 유지한다.\n\n--- 발췌 시작 ---\n${chunk.text}\n--- 발췌 끝 ---`,
    },
  ];
}

export function translateReduce(parts: string[], isFinal: boolean): ChatMessage[] {
  const joined = parts.map((p, i) => `[부분 ${i + 1}]\n${p}`).join("\n\n");
  if (!isFinal) {
    return [
      systemMessage(),
      {
        role: "user",
        content: `아래 한국어 부분 정리를 중복 없이 불릿 5~8개로 압축하라.\n\n${joined}`,
      },
    ];
  }
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `아래 부분 정리를 종합해 논문/문헌 요약을 한국어로 작성하라. 형식은 다음과 같다.\n` +
        `## 한 줄 요약\n## 배경·목적\n## 방법\n## 주요 결과(수치 포함)\n## 한계와 주의점\n` +
        `각 항목은 불릿 1~4개. 원문에 없는 항목은 "문서에 없음"으로 적는다.\n\n${joined}`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 5. compare — 문서 2개 비교                                          */
/* ------------------------------------------------------------------ */

export function comparePrompt(a: { name: string; summary: string }, b: { name: string; summary: string }): ChatMessage[] {
  return [
    systemMessage(),
    {
      role: "user",
      content:
        `아래는 서로 다른 두 문서의 요약이다. 두 문서를 비교하라.\n\n` +
        `[문서 A: ${a.name}]\n${a.summary}\n\n[문서 B: ${b.name}]\n${b.summary}\n\n` +
        `다음 형식으로만 출력하라.\n` +
        `## 공통점\n- 3~5개\n` +
        `## 차이점\n- "A는 ~, B는 ~" 형태로 3~6개\n` +
        `## 한쪽에만 있는 내용\n- A에만: / - B에만:\n` +
        `## 한 줄 결론\n(한 문장)\n` +
        `한쪽 요약에 근거가 없으면 추측하지 말고 "문서에 없음"이라 쓴다.`,
    },
  ];
}

/** 모든 결과 하단에 고정 노출되는 고지 문구 */
export const AI_NOTICE = "AI 생성 결과입니다. 사실관계는 반드시 원문에서 확인하세요.";
