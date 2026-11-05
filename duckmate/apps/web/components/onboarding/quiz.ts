/**
 * 궁합 퀴즈 10문항 — supabase/migrations/20260902000013 `quiz_questions` 시드 미러(폴백). 생활 궁합만(취미 지식 금지).
 */
import type { Json } from "@duckmate/db";

export type QuizOption = { value: number; label: string };
export type QuizQuestionItem = { id: number; key: string; text: string; options: QuizOption[]; sortOrder: number };

const Q = (id: number, key: string, text: string, labels: string[], sortOrder: number): QuizQuestionItem => ({
  id,
  key,
  text,
  options: labels.map((label, i) => ({ value: i + 1, label })),
  sortOrder,
});

export const QUIZ_FALLBACK: readonly QuizQuestionItem[] = [
  Q(1, "plan_confirm", "약속 전날, 나는", ["확인 연락을 꼭 한다", "정해졌으면 안 해도 된다", "당일 아침에 확인한다", "상대가 하면 답한다"], 1),
  Q(2, "weekend_morning", "주말 아침, 나는", ["일찍 나가서 활동", "느긋하게 집에서", "계획 없이 즉흥", "밀린 잠 보충"], 2),
  Q(3, "reply_speed", "메시지 답장은 보통", ["바로바로", "한두 시간 안에", "하루 안에", "생각날 때"], 3),
  Q(4, "social_battery", "모임이 끝나면 나는", ["더 놀고 싶다", "딱 좋다", "혼자 충전이 필요하다", "다음날까지 피곤하다"], 4),
  Q(5, "spending", "취미에 돈 쓸 때", ["아끼지 않는다", "정한 예산 안에서", "필요한 것만", "최소한만"], 5),
  Q(6, "conflict", "의견이 다르면", ["바로 말한다", "조심스럽게 꺼낸다", "시간을 두고 말한다", "그냥 넘어간다"], 6),
  Q(7, "first_meet", "처음 만난다면", ["카페에서 대화", "취미 활동을 같이", "온라인으로 먼저 충분히", "여럿이 같이"], 7),
  Q(8, "new_hobby", "새 취미를 시작하면", ["장비부터 산다", "정보를 파고든다", "일단 해본다", "아는 사람 따라간다"], 8),
  Q(9, "tidiness", "내 방은", ["항상 정리돼 있다", "대체로 정리", "필요할 때만 정리", "창작의 혼돈"], 9),
  Q(10, "day_rhythm", "나의 하루 리듬은", ["완전 아침형", "아침형에 가까움", "저녁형에 가까움", "완전 밤형"], 10),
];

/** DB `options` jsonb → QuizOption[] (형식이 깨졌으면 빈 배열) */
export function parseQuizOptions(json: Json | null | undefined): QuizOption[] {
  if (!Array.isArray(json)) return [];
  const out: QuizOption[] = [];
  for (const o of json) {
    if (typeof o === "object" && o !== null && !Array.isArray(o)) {
      const v = (o as Record<string, unknown>)["value"];
      const l = (o as Record<string, unknown>)["label"];
      if (typeof v === "number" && typeof l === "string") out.push({ value: v, label: l });
    }
  }
  return out;
}
