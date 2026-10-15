import type { ComponentType } from "react";
import type { CategoryKey } from "@/site.config";

export type Faq = { q: string; a: string };

export type ToolMeta = {
  slug: string;
  title: string;          // 검색어 그대로 (예: "글자수 세기")
  h1: string;             // 페이지 H1
  description: string;    // meta description 80~150자
  keywords: string[];
  category: CategoryKey;
  howto: string[];        // 사용법 3~5단계
  principle: string;      // 원리/근거 (마크다운 아님, 문단은 \n\n 구분)
  faq: Faq[];             // 5개 권장
  related: string[];      // 다른 도구 slug
  needsWorker?: boolean;
  pcRecommended?: boolean;
  component: () => Promise<{ default: ComponentType }>;
};

export const tools: ToolMeta[] = [
  {
    slug: "char-count",
    title: "글자수 세기",
    h1: "글자수 세기",
    description: "공백 포함/제외 글자수, 바이트, 단어 수, 줄 수를 즉시 계산합니다. 자소서·과제 글자수 확인에 쓰세요. 입력 내용은 서버로 전송되지 않습니다.",
    keywords: ["글자수 세기", "글자수 계산기", "공백 제외 글자수", "바이트 계산"],
    category: "text",
    howto: [
      "아래 입력창에 텍스트를 붙여넣거나 입력합니다.",
      "공백 포함/제외 글자수, 바이트, 단어·줄 수가 실시간으로 표시됩니다.",
      "필요하면 결과 카드의 숫자를 복사합니다.",
    ],
    principle:
      "글자수는 유니코드 코드포인트 기준으로 셉니다. 이모지처럼 여러 코드포인트로 이뤄진 문자는 화면에 한 글자로 보여도 2개 이상으로 셀 수 있습니다.\n\n바이트는 UTF-8 기준입니다. 한글 1자는 3바이트, 영문·숫자는 1바이트입니다. 채용 사이트마다 기준이 다르므로 해당 사이트 안내를 함께 확인하세요.",
    faq: [
      { q: "공백 제외 글자수는 어떻게 계산하나요?", a: "띄어쓰기, 줄바꿈, 탭을 모두 제거한 뒤 남은 문자를 셉니다." },
      { q: "자소서 사이트 글자수와 다르게 나와요.", a: "사이트마다 줄바꿈이나 특수문자 처리 기준이 달라 1~2자 차이가 날 수 있습니다. 최종 확인은 해당 사이트에서 하세요." },
      { q: "입력한 글은 저장되나요?", a: "아니요. 브라우저 안에서만 계산하고 서버로 보내지 않습니다." },
      { q: "바이트 기준이 왜 필요한가요?", a: "일부 시스템은 글자 수 대신 바이트로 길이를 제한합니다. 한글은 UTF-8에서 3바이트입니다." },
      { q: "원고지 매수도 볼 수 있나요?", a: "200자 원고지 기준 매수를 함께 표시합니다." },
    ],
    related: [],
    component: () => import("@/tools/sample/CharCount"),
  },
];

export const toolMap = Object.fromEntries(tools.map((t) => [t.slug, t]));
export const getTool = (slug: string) => toolMap[slug] as ToolMeta | undefined;
