/**
 * 온보딩·인증 입력 zod 스키마 (서버 액션 입력 검증 단일 소스). E1 폼 검증도 이 스키마를 import 한다.
 * 수치는 @duckmate/db constants 를 그대로 쓴다(DB check 와 일치: 닉네임 2~10자 등).
 */
import { z } from "zod";
import {
  AVAILABILITY_SLOTS,
  FAV_NOTE_MAX,
  GENDERS,
  HOBBY_MAX,
  HOBBY_MIN,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NOW_INTO_MAX,
  QUIZ_QUESTION_COUNT,
  REGION,
  SEEKING_GENDERS,
} from "@duckmate/db";

// ---------- 공통 ----------
const trimmed = (max: number) => z.string().trim().max(max);

/** YYYY-MM-DD, 실존 날짜, 미래 불가, 1900 이후 */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 다시 확인해 주세요")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1900;
  }, "날짜를 다시 확인해 주세요")
  .refine((s) => s <= kstToday(), "날짜를 다시 확인해 주세요");

/** KST 오늘 'YYYY-MM-DD' */
export function kstToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** 만 나이(KST 기준). SQL age_years_kst 와 동일 규칙 */
export function ageYearsKst(birthDate: string, now = new Date()): number {
  const today = kstToday(now);
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export const phoneSchema = z.object({
  phone: z.string().trim().min(10, "휴대폰 번호를 확인해 주세요").max(20),
});

export const consentSchema = z.object({
  terms: z.boolean(),
  privacy: z.boolean(),
  youthPolicy: z.boolean(),
  evidenceSnapshot: z.boolean(),
  marketingPush: z.boolean().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(10).max(20),
  token: z.string().trim().regex(/^\d{6}$/, "코드 6자리를 입력해 주세요"),
  /** 가입 플로우(S1 드래프트). 재방문 로그인은 생략 */
  birthDate: birthDateSchema.optional(),
  /** 가입 플로우 필수. birthDate 가 있으면 consents 도 있어야 한다 */
  consents: consentSchema.optional(),
});

export const submitBirthDateSchema = z.object({ birthDate: birthDateSchema });

// ---------- S3 기본 정보 ----------
export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자예요`)
  .max(NICKNAME_MAX, `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자예요`)
  .regex(/^[가-힣a-zA-Z0-9_.]+$/, "한글·영문·숫자·_ . 만 쓸 수 있어요");

export const availabilityCellSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  slot: z.enum(AVAILABILITY_SLOTS),
});

export const basicSchema = z.object({
  nickname: nicknameSchema,
  gender: z.enum(GENDERS),
  regionCode: z.string().regex(REGION.pattern, "지역을 선택해 주세요"),
  availability: z.array(availabilityCellSchema).min(1, "활동 시간을 1칸 이상 골라 주세요").max(28),
});

// ---------- S4 취미 ----------
export const hobbyItemSchema = z.object({
  hobbyId: z.number().int().positive(),
  rank: z.number().int().min(1).max(HOBBY_MAX),
  intensity: z.number().int().min(1).max(5).default(2),
  favNote: trimmed(FAV_NOTE_MAX).optional().transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const hobbiesSchema = z
  .object({ hobbies: z.array(hobbyItemSchema).min(HOBBY_MIN, `취미를 ${HOBBY_MIN}개 이상 골라 주세요`).max(HOBBY_MAX, `${HOBBY_MAX}개까지 고를 수 있어요`) })
  .refine((v) => new Set(v.hobbies.map((h) => h.hobbyId)).size === v.hobbies.length, { message: "같은 취미를 두 번 고를 수 없어요", path: ["hobbies"] })
  .refine(
    (v) => {
      const ranks = v.hobbies.map((h) => h.rank).sort((a, b) => a - b);
      return ranks.every((r, i) => r === i + 1);
    },
    { message: "순서(rank)는 1부터 빈틈없이 매겨야 해요", path: ["hobbies"] },
  );

// ---------- S5 퀴즈 ----------
export const quizAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  choice: z.number().int().min(1).max(4),
});
export const quizAnswersSchema = z.object({
  answers: z.array(quizAnswerSchema).min(1).max(QUIZ_QUESTION_COUNT),
});
export const finishQuizSchema = z.object({ skipped: z.boolean().default(false) });

// ---------- S6-a 덕질 카드 ----------
export const cardSchema = z.object({
  nowInto: z.string().trim().min(1, "요즘 빠진 것을 적어 주세요").max(NOW_INTO_MAX, `${NOW_INTO_MAX}자까지 쓸 수 있어요`),
  /** rank 1 취미의 최애 (비우면 카드에서 행 숨김) */
  favNote: trimmed(FAV_NOTE_MAX).optional().transform((v) => (v && v.length > 0 ? v : null)),
});

// ---------- S6-b 사진 ----------
export const finishPhotosSchema = z.object({ skipped: z.boolean().default(false) });

// ---------- 모드 전환 ----------
export const setModeSchema = z.object({
  mode: z.enum(["friend", "dating"]),
  seekingGender: z.enum(SEEKING_GENDERS).optional(),
  /** 공개 범위 미리보기를 끝까지 봤는지(C3 §6.2 필수) */
  previewViewed: z.boolean(),
});

export type BasicInput = z.infer<typeof basicSchema>;
export type HobbiesInput = z.infer<typeof hobbiesSchema>;
export type QuizAnswersInput = z.infer<typeof quizAnswersSchema>;
export type CardInput = z.infer<typeof cardSchema>;
export type SetModeInput = z.infer<typeof setModeSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** zod 실패 → {field, message} 첫 이슈 */
export function firstIssue(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  return { field: issue ? issue.path.join(".") : "", message: issue?.message ?? "입력값을 다시 확인해 주세요" };
}
